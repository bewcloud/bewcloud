// This is a simple, in-memory lock, which works well enough if you're serving from a single source/server

function wait(milliseconds = 100) {
  return new Promise((resolve) => setTimeout(() => resolve(true), milliseconds));
}

const expirationInMilliseconds = 15 * 1000;

const locks: Map<string, { expiresAt: Date }> = new Map();

export default class Locker {
  protected lockName: string = '';

  constructor(lockName: string) {
    this.lockName = lockName;
  }

  public async acquire() {
    const currentLock = locks.get(this.lockName);

    while (currentLock) {
      // Only wait if the lock hasn't expired
      if (currentLock.expiresAt > new Date()) {
        await wait();
      }
    }

    locks.set(this.lockName, {
      expiresAt: new Date(new Date().setMilliseconds(new Date().getMilliseconds() + expirationInMilliseconds)),
    });
  }

  public release() {
    locks.delete(this.lockName);
  }
}
