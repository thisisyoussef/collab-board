// --------------------------------------------------------------------------
// Server Logger — structured JSON logging for Render dashboard
// --------------------------------------------------------------------------
//
// Usage:
//   import { logger } from './logger.js';
//   logger.info('SOCKET', `Client connected: '${name}'`, { socketId, userId });
//   logger.error('AUTH', `Token verification failed`, { reason });
//
// Design:
//   • Same API as the frontend logger (debug/info/warn/error).
//   • Outputs one JSON line per log entry to stdout/stderr.
//   • Render captures stdout/stderr and displays in log dashboard.
//   • LOG_LEVEL env var controls verbosity (default: 'info').
//   • No ring buffer — Render retains logs for 7 days.
// --------------------------------------------------------------------------

const LOG_LEVEL_PRIORITY = { debug: 0, info: 1, warn: 2, error: 3 };
const CURRENT_LEVEL = process.env.LOG_LEVEL || 'info';

function shouldLog(level) {
  return (
    (LOG_LEVEL_PRIORITY[level] ?? 1) >=
    (LOG_LEVEL_PRIORITY[CURRENT_LEVEL] ?? 1)
  );
}

/**
 * Write a structured JSON log entry to stdout (or stderr for errors).
 *
 * @param {'debug'|'info'|'warn'|'error'} level
 * @param {string} category - AUTH, SOCKET, PRESENCE, SYNC, PERFORMANCE
 * @param {string} message  - Natural-language description of what happened
 * @param {Record<string, unknown>} [context] - Structured data for filtering
 */
function log(level, category, message, context) {
  if (!shouldLog(level)) return;

  const entry = {
    timestamp: new Date().toISOString(),
    level,
    category,
    message,
    ...(context || {}),
  };

  const line = JSON.stringify(entry) + '\n';

  if (level === 'error') {
    process.stderr.write(line);
  } else {
    process.stdout.write(line);
  }
}

export const logger = {
  debug(category, message, context) {
    log('debug', category, message, context);
  },
  info(category, message, context) {
    log('info', category, message, context);
  },
  warn(category, message, context) {
    log('warn', category, message, context);
  },
  error(category, message, context) {
    log('error', category, message, context);
  },
};
