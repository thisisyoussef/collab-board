import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { getOrCreateGuestIdentity } from './guest';

const GUEST_KEY = 'collab-board-guest-id';

type MockStorage = {
  getItem: ReturnType<typeof vi.fn>;
  setItem: ReturnType<typeof vi.fn>;
  removeItem: ReturnType<typeof vi.fn>;
};

let originalLocalStorage: Storage | undefined;
let storageMock: MockStorage;

function installStorageMock(seed: Record<string, string> = {}) {
  const store = new Map<string, string>(Object.entries(seed));
  storageMock = {
    getItem: vi.fn((key: string) => (store.has(key) ? store.get(key)! : null)),
    setItem: vi.fn((key: string, value: string) => {
      store.set(key, value);
    }),
    removeItem: vi.fn((key: string) => {
      store.delete(key);
    }),
  };

  Object.defineProperty(window, 'localStorage', {
    configurable: true,
    value: storageMock,
  });
}

describe('getOrCreateGuestIdentity', () => {
  beforeAll(() => {
    originalLocalStorage = window.localStorage;
  });

  afterAll(() => {
    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      value: originalLocalStorage,
    });
  });

  beforeEach(() => {
    vi.restoreAllMocks();
    installStorageMock();
  });

  it('reuses an existing stored guest id', () => {
    installStorageMock({ [GUEST_KEY]: 'guest-existing' });

    const identity = getOrCreateGuestIdentity();

    expect(identity.userId).toBe('guest-existing');
    expect(identity.displayName).toBe('Guest ting');
    expect(identity.color).toMatch(/^hsl\(\d+, 65%, 55%\)$/);
    expect(storageMock.getItem).toHaveBeenCalledWith(GUEST_KEY);
    expect(storageMock.setItem).not.toHaveBeenCalled();
  });

  it('creates and stores a new guest id when storage is empty', () => {
    const randomUuidSpy = vi.spyOn(crypto, 'randomUUID').mockReturnValue('abc123');

    const identity = getOrCreateGuestIdentity();

    expect(identity.userId).toBe('guest-abc123');
    expect(identity.displayName).toBe('Guest c123');
    expect(storageMock.getItem).toHaveBeenCalledWith(GUEST_KEY);
    expect(storageMock.setItem).toHaveBeenCalledWith(GUEST_KEY, 'guest-abc123');
    expect(randomUuidSpy).toHaveBeenCalledOnce();
  });

  it('still returns an identity when localStorage access throws', () => {
    storageMock.getItem.mockImplementation(() => {
      throw new Error('blocked');
    });
    storageMock.setItem.mockImplementation(() => {
      throw new Error('blocked');
    });
    vi.spyOn(crypto, 'randomUUID').mockReturnValue('xyz987');

    const identity = getOrCreateGuestIdentity();

    expect(identity.userId).toBe('guest-xyz987');
    expect(identity.displayName).toBe('Guest z987');
    expect(identity.color).toMatch(/^hsl\(\d+, 65%, 55%\)$/);
    expect(storageMock.getItem).toHaveBeenCalledWith(GUEST_KEY);
    expect(storageMock.setItem).toHaveBeenCalledWith(GUEST_KEY, 'guest-xyz987');
  });
});
