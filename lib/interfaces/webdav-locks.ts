// In-memory WebDAV lock table (RFC 4918 §6/§7); single-instance only, same constraint as ./locker.ts.

export interface WebDavLock {
  token: string;
  path: string;
  depth: 'infinity' | '0';
  expiresAt: Date;
}

const LOCK_TIMEOUT_IN_MILLISECONDS = 600_000;

const locksByKey = new Map<string, WebDavLock>();

function buildKey(userId: string, path: string) {
  return `${userId}:${path}`;
}

function isExpired(lock: WebDavLock) {
  return lock.expiresAt.getTime() <= Date.now();
}

function getAncestorPaths(path: string) {
  const segments = path.split('/').filter(Boolean);
  return segments.map((_segment, index) => segments.slice(0, index).join('/'));
}

function hasDescendantLock(userId: string, path: string) {
  const prefix = buildKey(userId, path ? `${path}/` : '');

  for (const [key, lock] of locksByKey) {
    if (key !== buildKey(userId, path) && key.startsWith(prefix) && !isExpired(lock)) {
      return true;
    }
  }

  return false;
}

// A lock on any ancestor collection with Depth: infinity covers this path too.
export function findBlockingLock(userId: string, path: string, presentedTokens: string[]): WebDavLock | null {
  const exactLock = locksByKey.get(buildKey(userId, path));

  if (exactLock && !isExpired(exactLock) && !presentedTokens.includes(exactLock.token)) {
    return exactLock;
  }

  for (const ancestorPath of getAncestorPaths(path)) {
    const ancestorLock = locksByKey.get(buildKey(userId, ancestorPath));

    if (
      ancestorLock && ancestorLock.depth === 'infinity' && !isExpired(ancestorLock) &&
      !presentedTokens.includes(ancestorLock.token)
    ) {
      return ancestorLock;
    }
  }

  return null;
}

export function acquireLock(userId: string, path: string, depth: 'infinity' | '0'): { token: string } | null {
  if (findBlockingLock(userId, path, [])) {
    return null;
  }

  if (depth === 'infinity' && hasDescendantLock(userId, path)) {
    return null;
  }

  const token = `opaquelocktoken:${crypto.randomUUID()}`;

  locksByKey.set(buildKey(userId, path), {
    token,
    path,
    depth,
    expiresAt: new Date(Date.now() + LOCK_TIMEOUT_IN_MILLISECONDS),
  });

  return { token };
}

export function refreshLock(userId: string, path: string, presentedTokens: string[]): { token: string } | null {
  const lock = locksByKey.get(buildKey(userId, path));

  if (!lock || isExpired(lock) || !presentedTokens.includes(lock.token)) {
    return null;
  }

  lock.expiresAt = new Date(Date.now() + LOCK_TIMEOUT_IN_MILLISECONDS);

  return { token: lock.token };
}

export function releaseLock(userId: string, path: string, presentedToken: string): boolean {
  const key = buildKey(userId, path);
  const lock = locksByKey.get(key);

  if (!lock || isExpired(lock) || lock.token !== presentedToken) {
    return false;
  }

  locksByKey.delete(key);

  return true;
}
