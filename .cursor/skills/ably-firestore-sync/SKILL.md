---
name: ably-firestore-sync
description: Ably + Firestore dual-layer sync pattern for CollabBoard. Covers channel setup, cursor broadcasting, object sync, presence, debounced persistence, reconnect handling, and data ownership rules. Use when implementing real-time features, debugging sync issues, or setting up Ably/Firestore integration.
---

# Ably + Firestore Sync Pattern

## Core Principle

- **Ably** = instant visual feedback (ephemeral, in-memory, <50ms)
- **Firestore** = persistent storage (debounced, survives refresh)
- **Konva refs** = render state (positions, transforms on canvas)

Never block UI on Firestore. Never persist cursors to Firestore.

## Data Ownership

| Data                    | Owner                         | Persist?                      |
| ----------------------- | ----------------------------- | ----------------------------- |
| Cursor positions        | Ably broadcast                | NO                            |
| Object live updates     | Ably broadcast                | Debounced to Firestore (3s)   |
| Board state on load     | Firestore                     | YES (source of truth on join) |
| Presence (who's online) | Ably Presence API             | NO                            |
| User metadata           | Firestore (via Firebase Auth) | YES                           |

## Message Flow

### Object Updates

```
1. User drags object → Update Konva via ref (instant, local)
2. Publish to Ably `board:{boardId}` → Other users see in <100ms
3. Debounced Firestore write (3s) → Persist for reload
```

### Cursor Updates

```
1. User moves mouse → Track position in world coords
2. Throttled Ably publish (every 50ms, max 20/sec)
3. NEVER write cursors to Firestore
```

### Board Join

```
1. Load board document from Firestore → Render all objects on canvas
2. Subscribe to Ably `board:{boardId}` channel
3. Enter Ably presence with { name, color }
4. Start broadcasting cursor position
```

## useRealtimeBoard Hook

```javascript
function useRealtimeBoard(boardId, userId, stageRef) {
  const channelRef = useRef(null);

  const debouncedSave = useRef(
    debounce((objects) => {
      updateDoc(doc(db, "boards", boardId), {
        objects,
        updatedAt: serverTimestamp(),
      });
    }, 3000),
  ).current;

  useEffect(() => {
    const channel = getAblyClient().channels.get(`board:${boardId}`);
    channelRef.current = channel;

    // Subscribe to object events
    channel.subscribe("object:create", (msg) => {
      if (msg.clientId === getAblyClient().auth.clientId) return; // Skip own
      addObjectToCanvas(stageRef, msg.data);
    });

    channel.subscribe("object:update", (msg) => {
      if (msg.clientId === getAblyClient().auth.clientId) return;
      const shape = stageRef.current.findOne(`#${msg.data.id}`);
      if (shape) {
        shape.setAttrs(msg.data.attrs);
        shape.getLayer().batchDraw();
      }
    });

    channel.subscribe("object:delete", (msg) => {
      if (msg.clientId === getAblyClient().auth.clientId) return;
      const shape = stageRef.current.findOne(`#${msg.data.id}`);
      if (shape) {
        shape.destroy();
        shape.getLayer().batchDraw();
      }
    });

    // Join presence
    channel.presence.enter({ name: userName, color: userColor });

    return () => {
      channel.presence.leave();
      channel.unsubscribe();
    };
  }, [boardId]);

  const publishObjectUpdate = useCallback((id, attrs) => {
    channelRef.current?.publish("object:update", {
      id,
      attrs,
      _ts: Date.now(),
    });
    debouncedSave(getAllObjectsFromCanvas(stageRef));
  }, []);

  const publishObjectCreate = useCallback((object) => {
    channelRef.current?.publish("object:create", object);
    debouncedSave(getAllObjectsFromCanvas(stageRef));
  }, []);

  const publishObjectDelete = useCallback((id) => {
    channelRef.current?.publish("object:delete", { id });
    debouncedSave(getAllObjectsFromCanvas(stageRef));
  }, []);

  return { publishObjectUpdate, publishObjectCreate, publishObjectDelete };
}
```

## useCursors Hook

```javascript
function useCursors(boardId) {
  const channelRef = useRef(null);
  const [remoteCursors, setRemoteCursors] = useState(new Map());

  const throttledPublish = useRef(
    throttle((position) => {
      channelRef.current?.publish("cursor:move", {
        x: position.x,
        y: position.y,
        _ts: Date.now(),
      });
    }, 50),
  ).current;

  useEffect(() => {
    const channel = getAblyClient().channels.get(`board:${boardId}`);
    channelRef.current = channel;

    channel.subscribe("cursor:move", (msg) => {
      if (msg.clientId === getAblyClient().auth.clientId) return;
      setRemoteCursors((prev) => {
        const next = new Map(prev);
        next.set(msg.clientId, {
          x: msg.data.x,
          y: msg.data.y,
          _ts: msg.data._ts,
        });
        return next;
      });
    });

    channel.presence.subscribe("leave", (member) => {
      setRemoteCursors((prev) => {
        const next = new Map(prev);
        next.delete(member.clientId);
        return next;
      });
    });

    return () => channel.unsubscribe();
  }, [boardId]);

  return { remoteCursors, publishCursor: throttledPublish };
}
```

## usePresence Hook

```javascript
function usePresence(boardId) {
  const [members, setMembers] = useState([]);

  useEffect(() => {
    const channel = getAblyClient().channels.get(`board:${boardId}`);

    const updateMembers = async () => {
      const present = await channel.presence.get();
      setMembers(present.map((m) => ({ clientId: m.clientId, ...m.data })));
    };

    channel.presence.subscribe("enter", updateMembers);
    channel.presence.subscribe("leave", updateMembers);
    channel.presence.subscribe("update", updateMembers);
    updateMembers(); // Initial fetch

    return () => channel.presence.unsubscribe();
  }, [boardId]);

  return members;
}
```

## Conflict Resolution

```javascript
// Last-write-wins: compare timestamps
function resolveConflict(localObj, remoteObj) {
  if (new Date(remoteObj.updatedAt) > new Date(localObj.updatedAt)) {
    return remoteObj; // Remote wins
  }
  return localObj; // Local wins, discard remote
}
```

## Reconnect Handling

Ably auto-reconnects with exponential backoff. On reconnect:

```javascript
getAblyClient().connection.on("connected", async () => {
  // Re-fetch full board state from Firestore to reconcile
  const boardDoc = await getDoc(doc(db, "boards", boardId));
  if (boardDoc.exists()) {
    renderFullBoard(stageRef, boardDoc.data().objects);
  }
  // Ably subscriptions auto-restore
});

getAblyClient().connection.on("disconnected", () => {
  showReconnectBanner();
});
```

## Cost Optimization

| Without debouncing         | With debouncing (3s) |
| -------------------------- | -------------------- |
| 6,000 Firestore writes/min | ~20 writes/min       |
| Hits free tier limits fast | Stays in free tier   |

## Ably Free Tier Budget

- 6M messages/month
- 5 concurrent connections (sufficient for showcase testing)
- 200 peak connections/sec
