// This is a simple, in-memory lock, which works well enough if you're serving from a single source/server

function wait(milliseconds = 100) {
  return new Promise((resolve) => setTimeout(() => resolve(true), milliseconds));
}

const expirationInMilliseconds = 15_000;

const locks: Map<string, { expiresAt: Date }> = new Map();

export default class Locker {
  protected lockName: string = '';

  constructor(lockName: string) {
    this.lockName = lockName;
  }

  public async acquire() {
    console.debug('Acquiring lock:', this.lockName);
    let currentLock = locks.get(this.lockName);

    while (currentLock) {
      // Only wait if the lock hasn't expired
      if (currentLock.expiresAt > new Date()) {
        console.debug('Waiting for lock to expire:', this.lockName);
        await wait();
      } else {
        // Release lock since it has expired
        this.release();
      }

      currentLock = locks.get(this.lockName);
    }

    locks.set(this.lockName, {
      expiresAt: new Date(new Date().setMilliseconds(new Date().getMilliseconds() + expirationInMilliseconds)),
    });
  }

  public release() {
    console.debug('Releasing lock:', this.lockName);
    locks.delete(this.lockName);
  }
}
