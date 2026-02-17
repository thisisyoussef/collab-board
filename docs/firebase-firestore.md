# Firebase Firestore — Web (v9+ Modular SDK)

> Source: https://firebase.google.com/docs/firestore/

## Overview

Cloud Firestore is a NoSQL document database. Data is stored in **documents** organized into **collections**. Documents contain key-value pairs (fields) and can contain subcollections.

**Installation:**
```bash
npm install firebase
```

---

## Setup & Initialization

```js
// src/lib/firebase.ts
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
```

---

## Data Model

```
Collection ("boards")
  └── Document ("board-uuid-123")
        ├── Field: title = "My Board"
        ├── Field: createdBy = "user-uid"
        ├── Field: createdAt = Timestamp
        ├── Field: objects = { ... }  (map of board objects)
        └── Subcollection ("members")
              └── Document ("user-uid")
                    ├── Field: role = "editor"
                    └── Field: joinedAt = Timestamp
```

**Limits:**
- Max document size: 1 MB
- Max depth: 100 levels of subcollections
- Max field value size: 1 MB
- Max writes/sec per document: 1 (sustained)

---

## References

```js
import { doc, collection } from "firebase/firestore";

// Document reference
const boardRef = doc(db, "boards", "board-uuid-123");

// Collection reference
const boardsRef = collection(db, "boards");

// Subcollection document reference
const memberRef = doc(db, "boards", "board-uuid-123", "members", "user-uid");

// Equivalent using doc chaining
const memberRef2 = doc(collection(boardRef, "members"), "user-uid");
```

---

## Create / Set Data

### setDoc — Create or Overwrite

```js
import { doc, setDoc, serverTimestamp } from "firebase/firestore";

// Create (or overwrite) a document with a known ID
await setDoc(doc(db, "boards", "board-uuid-123"), {
  title: "My Board",
  createdBy: "user-uid",
  createdAt: serverTimestamp(),
  objects: {},
});

// Merge (update only specified fields, create if missing)
await setDoc(
  doc(db, "boards", "board-uuid-123"),
  { title: "New Title", updatedAt: serverTimestamp() },
  { merge: true }
);
```

### addDoc — Create with Auto-Generated ID

```js
import { collection, addDoc, serverTimestamp } from "firebase/firestore";

const docRef = await addDoc(collection(db, "boards"), {
  title: "My Board",
  createdBy: "user-uid",
  createdAt: serverTimestamp(),
  objects: {},
});

console.log("Document ID:", docRef.id);
```

---

## Read Data

### getDoc — Single Document

```js
import { doc, getDoc } from "firebase/firestore";

const docRef = doc(db, "boards", "board-uuid-123");
const docSnap = await getDoc(docRef);

if (docSnap.exists()) {
  const data = docSnap.data();
  console.log(data.title, data.objects);
} else {
  console.log("No such document");
}

// Access specific field
const title = docSnap.get("title");
```

### getDocs — Multiple Documents (Query)

```js
import { collection, getDocs } from "firebase/firestore";

const querySnapshot = await getDocs(collection(db, "boards"));

querySnapshot.forEach((doc) => {
  console.log(doc.id, "=>", doc.data());
});

// Convert to array
const boards = querySnapshot.docs.map((doc) => ({
  id: doc.id,
  ...doc.data(),
}));
```

---

## Update Data

### updateDoc — Update Fields

```js
import { doc, updateDoc, serverTimestamp } from "firebase/firestore";

const boardRef = doc(db, "boards", "board-uuid-123");

// Update specific fields (document must exist)
await updateDoc(boardRef, {
  title: "Updated Title",
  updatedAt: serverTimestamp(),
});
```

### Nested Fields

```js
import { doc, updateDoc } from "firebase/firestore";

// Update nested field using dot notation
await updateDoc(doc(db, "boards", "board-uuid-123"), {
  "objects.sticky-1.text": "New text",
  "objects.sticky-1.updatedAt": new Date().toISOString(),
});
```

### Special Field Values

```js
import { doc, updateDoc, arrayUnion, arrayRemove, increment, deleteField, serverTimestamp } from "firebase/firestore";

const ref = doc(db, "boards", "board-uuid-123");

// Array operations
await updateDoc(ref, {
  tags: arrayUnion("new-tag"),      // Add to array (no duplicates)
});
await updateDoc(ref, {
  tags: arrayRemove("old-tag"),     // Remove from array
});

// Numeric increment
await updateDoc(ref, {
  viewCount: increment(1),
});

// Delete a field
await updateDoc(ref, {
  obsoleteField: deleteField(),
});

// Server timestamp
await updateDoc(ref, {
  updatedAt: serverTimestamp(),
});
```

---

## Delete Data

### Delete Document

```js
import { doc, deleteDoc } from "firebase/firestore";

await deleteDoc(doc(db, "boards", "board-uuid-123"));
```

### Delete Fields

```js
import { doc, updateDoc, deleteField } from "firebase/firestore";

await updateDoc(doc(db, "boards", "board-uuid-123"), {
  "objects.sticky-1": deleteField(),
});
```

**Note:** Deleting a document does NOT delete its subcollections.

---

## Queries

### Basic Query

```js
import { collection, query, where, getDocs } from "firebase/firestore";

const q = query(
  collection(db, "boards"),
  where("createdBy", "==", "user-uid")
);

const querySnapshot = await getDocs(q);
querySnapshot.forEach((doc) => {
  console.log(doc.id, doc.data());
});
```

### Query Operators

```js
import { query, where, collection } from "firebase/firestore";

// Comparison operators
where("age", "==", 25)
where("age", "!=", 25)
where("age", "<", 30)
where("age", "<=", 30)
where("age", ">", 20)
where("age", ">=", 20)

// Array contains
where("tags", "array-contains", "important")

// In (up to 30 values)
where("status", "in", ["active", "pending"])

// Array contains any (up to 30 values)
where("tags", "array-contains-any", ["urgent", "important"])

// Not in (up to 10 values)
where("status", "not-in", ["deleted", "archived"])
```

### Compound Queries

```js
import { collection, query, where, orderBy, limit } from "firebase/firestore";

const q = query(
  collection(db, "boards"),
  where("createdBy", "==", "user-uid"),
  where("createdAt", ">", someDate),
  orderBy("createdAt", "desc"),
  limit(10)
);
```

**Compound query rules:**
- Range filters (`<`, `<=`, `>`, `>=`, `!=`) on different fields require a composite index
- `array-contains` can only be used once per query
- `in`, `not-in`, `array-contains-any` can only be used once per query
- `not-in` cannot be combined with `!=`

### Ordering & Limiting

```js
import { query, orderBy, limit, limitToLast, startAt, startAfter, endAt, endBefore } from "firebase/firestore";

// Order by field
query(ref, orderBy("createdAt", "desc"));

// Multiple ordering
query(ref, orderBy("status"), orderBy("createdAt", "desc"));

// Limit results
query(ref, orderBy("createdAt"), limit(10));
query(ref, orderBy("createdAt"), limitToLast(10));

// Pagination cursors
query(ref, orderBy("createdAt"), startAfter(lastDoc));
query(ref, orderBy("createdAt"), endBefore(firstDoc));

// Start at a specific value
query(ref, orderBy("population"), startAt(1000000));
```

---

## Real-Time Listeners (onSnapshot)

### Listen to a Document

```js
import { doc, onSnapshot } from "firebase/firestore";

const unsubscribe = onSnapshot(
  doc(db, "boards", "board-uuid-123"),
  (docSnap) => {
    if (docSnap.exists()) {
      const data = docSnap.data();
      console.log("Current data:", data);
    } else {
      console.log("Document deleted");
    }
  },
  (error) => {
    console.error("Listen error:", error);
  }
);

// Stop listening
unsubscribe();
```

### Listen to a Collection/Query

```js
import { collection, query, where, onSnapshot } from "firebase/firestore";

const q = query(
  collection(db, "boards"),
  where("createdBy", "==", "user-uid")
);

const unsubscribe = onSnapshot(q, (querySnapshot) => {
  const boards = [];
  querySnapshot.forEach((doc) => {
    boards.push({ id: doc.id, ...doc.data() });
  });
  console.log("Boards:", boards);
});
```

### Listen to Document Changes

```js
import { collection, onSnapshot } from "firebase/firestore";

const unsubscribe = onSnapshot(
  collection(db, "boards"),
  (snapshot) => {
    snapshot.docChanges().forEach((change) => {
      const data = { id: change.doc.id, ...change.doc.data() };

      if (change.type === "added") {
        console.log("New board:", data);
      }
      if (change.type === "modified") {
        console.log("Modified board:", data);
      }
      if (change.type === "removed") {
        console.log("Removed board:", data);
      }
    });
  }
);
```

### Metadata Changes

```js
import { doc, onSnapshot } from "firebase/firestore";

const unsubscribe = onSnapshot(
  doc(db, "boards", "board-uuid-123"),
  { includeMetadataChanges: true },
  (docSnap) => {
    const source = docSnap.metadata.hasPendingWrites ? "Local" : "Server";
    console.log(`${source} data:`, docSnap.data());

    // fromCache indicates if data came from cache
    if (docSnap.metadata.fromCache) {
      console.log("Data from cache (offline)");
    }
  }
);
```

---

## Batch Writes

Atomic writes to multiple documents (up to 500 operations).

```js
import { writeBatch, doc, serverTimestamp } from "firebase/firestore";

const batch = writeBatch(db);

// Set
batch.set(doc(db, "boards", "board-1"), {
  title: "Board 1",
  createdAt: serverTimestamp(),
});

// Update
batch.update(doc(db, "boards", "board-2"), {
  title: "Updated Board 2",
});

// Delete
batch.delete(doc(db, "boards", "board-3"));

// Commit atomically
await batch.commit();
```

---

## Transactions

Read-then-write operations that are atomic. If a concurrent edit happens, the transaction retries.

```js
import { runTransaction, doc, serverTimestamp } from "firebase/firestore";

try {
  const result = await runTransaction(db, async (transaction) => {
    const boardRef = doc(db, "boards", "board-uuid-123");
    const boardDoc = await transaction.get(boardRef);

    if (!boardDoc.exists()) {
      throw new Error("Board does not exist");
    }

    const currentData = boardDoc.data();
    const newObjectCount = Object.keys(currentData.objects).length + 1;

    transaction.update(boardRef, {
      objectCount: newObjectCount,
      updatedAt: serverTimestamp(),
    });

    return newObjectCount;
  });

  console.log("New object count:", result);
} catch (error) {
  console.error("Transaction failed:", error);
}
```

**Transaction rules:**
- Read operations must come before write operations
- Max 500 documents per transaction
- Transactions auto-retry up to 5 times on contention
- Don't modify app state inside transaction function (it may re-run)

---

## Offline Support

Firestore has built-in offline persistence for web (disabled by default in web).

### Enable Offline Persistence

```js
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager } from "firebase/firestore";

const db = initializeFirestore(app, {
  localCache: persistentLocalCache({
    tabManager: persistentMultipleTabManager(),
  }),
});
```

### Memory-Only Cache (Default)

```js
import { initializeFirestore, memoryLocalCache } from "firebase/firestore";

const db = initializeFirestore(app, {
  localCache: memoryLocalCache(),
});
```

When offline:
- `getDoc()` returns cached data
- `onSnapshot()` fires with cached data (metadata.fromCache = true)
- Writes are queued and synced when back online

---

## Common Patterns for CollabBoard

### Board Document Structure

```js
// boards/{boardId}
{
  title: "My Whiteboard",
  createdBy: "user-uid",
  createdAt: serverTimestamp(),
  updatedAt: serverTimestamp(),
  objects: {
    "sticky-1": {
      id: "sticky-1",
      type: "sticky",
      x: 100, y: 200,
      width: 150, height: 100,
      text: "Hello",
      color: "#FFEB3B",
      createdBy: "user-uid",
      updatedAt: "2026-02-17T12:00:00Z",
    },
    "rect-2": {
      id: "rect-2",
      type: "rect",
      x: 300, y: 100,
      width: 200, height: 150,
      color: "#4CAF50",
      createdBy: "user-uid",
      updatedAt: "2026-02-17T12:01:00Z",
    },
  },
}
```

### Debounced Board Save

```js
import { doc, updateDoc, serverTimestamp } from "firebase/firestore";

function createDebouncedSave(db, boardId, delay = 3000) {
  let timeoutId = null;

  return function save(objects) {
    if (timeoutId) clearTimeout(timeoutId);

    timeoutId = setTimeout(async () => {
      try {
        await updateDoc(doc(db, "boards", boardId), {
          objects,
          updatedAt: serverTimestamp(),
        });
        console.log("Board saved to Firestore");
      } catch (error) {
        console.error("Save failed:", error);
      }
    }, delay);
  };
}

// Usage
const debouncedSave = createDebouncedSave(db, "board-uuid-123");
debouncedSave(currentObjects); // Call after every object change
```

### Load Board on Join

```js
import { doc, getDoc } from "firebase/firestore";

async function loadBoard(boardId) {
  const boardRef = doc(db, "boards", boardId);
  const boardSnap = await getDoc(boardRef);

  if (!boardSnap.exists()) {
    throw new Error("Board not found");
  }

  return { id: boardSnap.id, ...boardSnap.data() };
}
```

### Create New Board

```js
import { doc, setDoc, serverTimestamp } from "firebase/firestore";

async function createBoard(userId, title = "Untitled Board") {
  const boardId = crypto.randomUUID();
  const boardRef = doc(db, "boards", boardId);

  await setDoc(boardRef, {
    title,
    createdBy: userId,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    objects: {},
  });

  return boardId;
}
```

### List User's Boards

```js
import { collection, query, where, orderBy, getDocs } from "firebase/firestore";

async function getUserBoards(userId) {
  const q = query(
    collection(db, "boards"),
    where("createdBy", "==", userId),
    orderBy("updatedAt", "desc")
  );

  const snapshot = await getDocs(q);
  return snapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  }));
}
```

---

## Security Rules

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Boards: authenticated users can read/write
    match /boards/{boardId} {
      allow read: if request.auth != null;
      allow create: if request.auth != null
                    && request.resource.data.createdBy == request.auth.uid;
      allow update: if request.auth != null;
      allow delete: if request.auth != null
                    && resource.data.createdBy == request.auth.uid;
    }
  }
}
```

---

## Indexes

Firestore automatically creates single-field indexes. For compound queries, create composite indexes:

1. **Firebase Console** → Firestore → Indexes → Create Index
2. **Or** let Firestore generate the link — error messages include a direct URL to create the missing index
3. **Or** define in `firestore.indexes.json`:

```json
{
  "indexes": [
    {
      "collectionGroup": "boards",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "createdBy", "order": "ASCENDING" },
        { "fieldPath": "updatedAt", "order": "DESCENDING" }
      ]
    }
  ]
}
```

---

## Free Tier Limits

| Resource | Daily Free Limit |
|----------|-----------------|
| Document reads | 50,000/day |
| Document writes | 20,000/day |
| Document deletes | 20,000/day |
| Stored data | 1 GiB total |
| Network egress | 10 GiB/month |

**Cost optimization:** Debounce writes (3-5s) to stay well within free tier.
