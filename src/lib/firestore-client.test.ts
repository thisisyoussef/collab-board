import { describe, expect, it, vi } from 'vitest';
import { toFirestoreUserMessage, withFirestoreTimeout } from './firestore-client';

describe('withFirestoreTimeout', () => {
  it('resolves when the promise resolves before timeout', async () => {
    const result = await withFirestoreTimeout('test', Promise.resolve('ok'), 1000);
    expect(result).toBe('ok');
  });

  it('rejects with timeout error when the promise is slower than the timeout', async () => {
    const slow = new Promise<string>((resolve) => {
      setTimeout(() => resolve('too late'), 500);
    });

    await expect(withFirestoreTimeout('Load boards', slow, 50)).rejects.toThrow(
      'Load boards timed out',
    );
  });

  it('includes the firestore hint in the timeout error message', async () => {
    const slow = new Promise<never>(() => {});

    await expect(withFirestoreTimeout('Saving', slow, 10)).rejects.toThrow(
      'firestore.googleapis.com',
    );
  });

  it('rejects with the original error if the promise itself rejects', async () => {
    const failing = Promise.reject(new Error('Firestore unavailable'));

    await expect(withFirestoreTimeout('Load', failing, 5000)).rejects.toThrow(
      'Firestore unavailable',
    );
  });

  it('clears the timeout after the promise resolves', async () => {
    const clearSpy = vi.spyOn(window, 'clearTimeout');

    await withFirestoreTimeout('test', Promise.resolve(42), 5000);

    expect(clearSpy).toHaveBeenCalled();
    clearSpy.mockRestore();
  });

  it('uses the default timeout when none is provided', async () => {
    // Default is 12000ms — a fast promise should always beat it
    const result = await withFirestoreTimeout('test', Promise.resolve('fast'));
    expect(result).toBe('fast');
  });
});

describe('toFirestoreUserMessage', () => {
  it('returns permission-denied message for permission errors', () => {
    const err = { code: 'permission-denied' };
    const result = toFirestoreUserMessage('Could not load boards.', err);
    expect(result).toContain('Permission denied');
  });

  it('returns the firestore hint for unavailable errors', () => {
    const err = { code: 'unavailable' };
    const result = toFirestoreUserMessage('Failed.', err);
    expect(result).toContain('firestore.googleapis.com');
  });

  it('returns the firestore hint for deadline-exceeded errors', () => {
    const err = { code: 'deadline-exceeded' };
    const result = toFirestoreUserMessage('Failed.', err);
    expect(result).toContain('firestore.googleapis.com');
  });

  it('returns the firestore hint when the error message contains "timed out"', () => {
    const err = new Error('The request timed out.');
    const result = toFirestoreUserMessage('Failed.', err);
    expect(result).toContain('firestore.googleapis.com');
  });

  it('returns the firestore hint when the error message contains "blocked by client"', () => {
    const err = new Error('Request blocked by client extension');
    const result = toFirestoreUserMessage('Oops.', err);
    expect(result).toContain('firestore.googleapis.com');
  });

  it('returns the fallback for unknown errors', () => {
    const err = new Error('Something weird');
    const result = toFirestoreUserMessage('Oops.', err);
    expect(result).toBe('Oops.');
  });

  it('returns the fallback for null errors', () => {
    const result = toFirestoreUserMessage('Fallback message.', null);
    expect(result).toBe('Fallback message.');
  });

  it('returns the fallback for undefined errors', () => {
    const result = toFirestoreUserMessage('Fallback.', undefined);
    expect(result).toBe('Fallback.');
  });
});
