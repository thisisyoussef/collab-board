// --------------------------------------------------------------------------
// LogTerminal — in-app log viewer with filtering, search, and copy-paste
// --------------------------------------------------------------------------
//
// A collapsible terminal overlay that shows structured log entries from the
// global logger. Users can filter by level/category, search, and copy all
// visible logs to share with AI agents or developers for debugging.
//
// Rendering strategy:
//   • Uses useSyncExternalStore to subscribe to logger changes.
//   • Each LogLine is React.memo'd — unchanged entries never re-render.
//   • Auto-scrolls to bottom; pauses when user scrolls up.
//   • Completely outside the Konva canvas — zero canvas performance impact.
// --------------------------------------------------------------------------

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react';
import {
  logger,
  type LogCategory,
  type LogEntry,
  type LogLevel,
} from '../lib/logger';

// --------------------------------------------------------------------------
// Constants
// --------------------------------------------------------------------------

const ALL_CATEGORIES: LogCategory[] = [
  'AUTH',
  'SOCKET',
  'CANVAS',
  'FIRESTORE',
  'AI',
  'PRESENCE',
  'SYNC',
  'PERFORMANCE',
];

const LEVEL_COLORS: Record<LogLevel, string> = {
  debug: '#8b949e',
  info: '#58a6ff',
  warn: '#d29922',
  error: '#f85149',
};

const CATEGORY_COLOR = '#bc8cff';
const TIMESTAMP_COLOR = '#484f58';
const CONTEXT_COLOR = '#484f58';

// --------------------------------------------------------------------------
// Visibility check — same pattern as MetricsOverlay
// --------------------------------------------------------------------------

const importMetaEnv =
  typeof import.meta !== 'undefined' && typeof import.meta.env === 'object'
    ? (import.meta.env as Record<string, unknown>)
    : undefined;

const enableLogsFromEnv = String(importMetaEnv?.VITE_ENABLE_LOGS || '').toLowerCase() === 'true';
const shouldShowLogs = importMetaEnv?.DEV === true || enableLogsFromEnv;

// --------------------------------------------------------------------------
// LogLine — memoized single entry
// --------------------------------------------------------------------------

interface LogLineProps {
  entry: LogEntry;
}

const LogLine = React.memo(function LogLine({ entry }: LogLineProps) {
  const ts = entry.timestamp.slice(11, 23); // HH:MM:SS.mmm

  return (
    <div
      style={{
        lineHeight: '20px',
        whiteSpace: 'pre-wrap',
        wordBreak: 'break-word',
        padding: '1px 0',
      }}
    >
      <span style={{ color: TIMESTAMP_COLOR }}>{ts}</span>{' '}
      <span
        style={{
          color: LEVEL_COLORS[entry.level],
          fontWeight: 600,
          display: 'inline-block',
          width: '42px',
        }}
      >
        {entry.level.toUpperCase()}
      </span>{' '}
      <span style={{ color: CATEGORY_COLOR }}>[{entry.category}]</span>{' '}
      <span>{entry.message}</span>
      {entry.context && Object.keys(entry.context).length > 0 && (
        <span style={{ color: CONTEXT_COLOR }}>
          {' '}
          {JSON.stringify(entry.context)}
        </span>
      )}
    </div>
  );
});

// --------------------------------------------------------------------------
// LogTerminal — main component
// --------------------------------------------------------------------------

export function LogTerminal() {
  // Subscribe to logger — re-render only on new entries (batched via microtask)
  const entries = useSyncExternalStore(logger.subscribe, logger.getEntries);

  const [isExpanded, setIsExpanded] = useState(false);
  const [filterLevel, setFilterLevel] = useState<LogLevel | 'all'>('all');
  const [filterCategory, setFilterCategory] = useState<LogCategory | 'all'>(
    'all',
  );
  const [searchQuery, setSearchQuery] = useState('');
  const [isAutoScroll, setIsAutoScroll] = useState(true);
  const [copyFeedback, setCopyFeedback] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  const prevEntryCountRef = useRef(0);

  // Filter entries
  const filteredEntries = useMemo(() => {
    let result = entries as LogEntry[];
    if (filterLevel !== 'all') {
      result = result.filter((e) => e.level === filterLevel);
    }
    if (filterCategory !== 'all') {
      result = result.filter((e) => e.category === filterCategory);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (e) =>
          e.message.toLowerCase().includes(q) ||
          (e.context &&
            JSON.stringify(e.context).toLowerCase().includes(q)),
      );
    }
    return result;
  }, [entries, filterLevel, filterCategory, searchQuery]);

  // Auto-scroll to bottom when new entries arrive
  useEffect(() => {
    if (
      isAutoScroll &&
      scrollRef.current &&
      entries.length > prevEntryCountRef.current
    ) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
    prevEntryCountRef.current = entries.length;
  }, [entries.length, isAutoScroll]);

  // Detect user scrolling up → pause auto-scroll
  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
    setIsAutoScroll(atBottom);
  }, []);

  // Copy all visible logs as formatted text
  const handleCopy = useCallback(() => {
    const text = filteredEntries
      .map((e) => {
        const ts = e.timestamp.slice(11, 23);
        const ctx = e.context ? ` | ${JSON.stringify(e.context)}` : '';
        return `[${ts}] ${e.level.toUpperCase().padEnd(5)} [${e.category}] ${e.message}${ctx}`;
      })
      .join('\n');
    navigator.clipboard.writeText(text).then(() => {
      setCopyFeedback(true);
      setTimeout(() => setCopyFeedback(false), 1500);
    });
  }, [filteredEntries]);

  // Clear all logs
  const handleClear = useCallback(() => {
    logger.clear();
  }, []);

  // Toggle debug mode
  const handleToggleDebug = useCallback(() => {
    const current = logger.getConfig().enableDebug;
    logger.setConfig({ enableDebug: !current });
  }, []);

  if (!shouldShowLogs) {
    return null;
  }

  // ---- Collapsed state: just a small toggle button ----
  if (!isExpanded) {
    return (
      <button
        onClick={() => setIsExpanded(true)}
        title="Open log terminal"
        style={{
          position: 'fixed',
          bottom: 8,
          left: 8,
          zIndex: 10000,
          background: '#1a1a2e',
          color: '#58a6ff',
          border: '1px solid #30363d',
          borderRadius: 6,
          padding: '5px 14px',
          fontFamily:
            '"Cascadia Code", "Fira Code", "JetBrains Mono", "Consolas", monospace',
          fontSize: 12,
          cursor: 'pointer',
          opacity: 0.85,
          transition: 'opacity 0.15s',
        }}
        onMouseEnter={(e) => {
          (e.target as HTMLButtonElement).style.opacity = '1';
        }}
        onMouseLeave={(e) => {
          (e.target as HTMLButtonElement).style.opacity = '0.85';
        }}
      >
        &#9654; Logs ({entries.length})
      </button>
    );
  }

  // ---- Expanded state: full terminal panel ----
  return (
    <aside
      className="log-terminal"
      style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        height: 320,
        zIndex: 10000,
        background: '#0d1117',
        color: '#c9d1d9',
        fontFamily:
          '"Cascadia Code", "Fira Code", "JetBrains Mono", "Consolas", monospace',
        fontSize: 12,
        display: 'flex',
        flexDirection: 'column',
        borderTop: '2px solid #58a6ff',
        boxShadow: '0 -4px 20px rgba(0,0,0,0.5)',
      }}
      aria-label="Application log terminal"
    >
      {/* ---- Header bar ---- */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          padding: '5px 10px',
          borderBottom: '1px solid #21262d',
          flexShrink: 0,
          flexWrap: 'wrap',
        }}
      >
        <span style={{ fontWeight: 700, color: '#58a6ff', marginRight: 4 }}>
          Log Terminal
        </span>

        {/* Level filter */}
        <select
          value={filterLevel}
          onChange={(e) =>
            setFilterLevel(e.target.value as LogLevel | 'all')
          }
          style={selectStyle}
        >
          <option value="all">All Levels</option>
          <option value="debug">DEBUG</option>
          <option value="info">INFO</option>
          <option value="warn">WARN</option>
          <option value="error">ERROR</option>
        </select>

        {/* Category filter */}
        <select
          value={filterCategory}
          onChange={(e) =>
            setFilterCategory(e.target.value as LogCategory | 'all')
          }
          style={selectStyle}
        >
          <option value="all">All Categories</option>
          {ALL_CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>

        {/* Search */}
        <input
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search logs..."
          style={{
            flex: 1,
            minWidth: 120,
            background: '#161b22',
            color: '#c9d1d9',
            border: '1px solid #30363d',
            borderRadius: 4,
            padding: '3px 8px',
            fontSize: 11,
            fontFamily: 'inherit',
            outline: 'none',
          }}
        />

        {/* Action buttons */}
        <button
          onClick={handleToggleDebug}
          title={`Debug logging: ${logger.getConfig().enableDebug ? 'ON' : 'OFF'}`}
          style={{
            ...btnStyle,
            color: logger.getConfig().enableDebug ? '#3fb950' : '#8b949e',
          }}
        >
          Debug: {logger.getConfig().enableDebug ? 'ON' : 'OFF'}
        </button>
        <button
          onClick={handleCopy}
          title="Copy all visible logs to clipboard"
          style={btnStyle}
        >
          {copyFeedback ? '✓ Copied!' : 'Copy'}
        </button>
        <button onClick={handleClear} title="Clear all logs" style={btnStyle}>
          Clear
        </button>
        <button
          onClick={() => setIsExpanded(false)}
          title="Close log terminal"
          style={{ ...btnStyle, color: '#f85149' }}
        >
          ✕
        </button>

        {/* Entry count */}
        <span style={{ color: '#484f58', fontSize: 10, marginLeft: 'auto' }}>
          {filteredEntries.length}/{entries.length} entries
          {!isAutoScroll && (
            <span style={{ color: '#d29922', marginLeft: 6 }}>
              ⏸ scroll paused
            </span>
          )}
        </span>
      </div>

      {/* ---- Log entries ---- */}
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '4px 10px',
        }}
      >
        {filteredEntries.length === 0 ? (
          <div
            style={{
              color: '#484f58',
              padding: '20px 0',
              textAlign: 'center',
            }}
          >
            {entries.length === 0
              ? 'No log entries yet. Interact with the app to generate logs.'
              : 'No entries match current filters.'}
          </div>
        ) : (
          filteredEntries.map((entry) => (
            <LogLine key={entry.id} entry={entry} />
          ))
        )}
      </div>
    </aside>
  );
}

// --------------------------------------------------------------------------
// Shared inline styles for terminal controls
// --------------------------------------------------------------------------

const selectStyle: React.CSSProperties = {
  background: '#161b22',
  color: '#c9d1d9',
  border: '1px solid #30363d',
  borderRadius: 4,
  padding: '3px 6px',
  fontSize: 11,
  fontFamily: 'inherit',
  outline: 'none',
  cursor: 'pointer',
};

const btnStyle: React.CSSProperties = {
  background: '#21262d',
  color: '#c9d1d9',
  border: '1px solid #30363d',
  borderRadius: 4,
  padding: '3px 10px',
  fontSize: 11,
  fontFamily: 'inherit',
  cursor: 'pointer',
};
