import { assert, assertEquals } from '@std/assert';
import { join, relative } from '@std/path';

import { AppConfig } from '/lib/config.ts';
import {
  cacheDirectorySize,
  DirectoryModel,
  FileModel,
  getDirectorySize,
  getDirectorySizes,
} from '/lib/models/files.ts';
import { bytesFromHumanFileSize } from '/public/ts/utils/files.ts';

async function withUserDirectory(test: (userRootPath: string, userId: string) => Promise<void>) {
  const userId = crypto.randomUUID();
  const userRootPath = join(await AppConfig.getFilesRootPath(), userId);
  await Deno.mkdir(userRootPath, { recursive: true });

  try {
    await test(userRootPath, userId);
  } finally {
    await Deno.remove(userRootPath, { recursive: true });
  }
}

async function listTempFiles(userRootPath: string) {
  const names: string[] = [];

  try {
    for await (const entry of Deno.readDir(join(userRootPath, '.chunk-uploads'))) {
      names.push(entry.name);
    }
  } catch {
    // No temp directory at all is fine too.
  }

  return names;
}

Deno.test('that FileModel.create refuses to write over an existing file unless asked to overwrite', async () => {
  await withUserDirectory(async (userRootPath, userId) => {
    await Deno.writeTextFile(join(userRootPath, 'notes.txt'), 'original');

    const originalConsoleError = console.error;
    console.error = () => {};

    try {
      const result = await FileModel.create(userId, '/', 'notes.txt', 'new');

      assertEquals(result, { success: false, alreadyExists: true });
    } finally {
      console.error = originalConsoleError;
    }

    assertEquals(await Deno.readTextFile(join(userRootPath, 'notes.txt')), 'original');
  });
});

Deno.test('that FileModel.create replaces an existing file when asked to overwrite, leaving no temp file behind', async () => {
  await withUserDirectory(async (userRootPath, userId) => {
    await Deno.writeTextFile(join(userRootPath, 'notes.txt'), 'original');

    // The link only still reads "original" if the file was swapped out rather than written over in place.
    await Deno.link(join(userRootPath, 'notes.txt'), join(userRootPath, 'original-notes.txt'));

    const result = await FileModel.create(userId, '/', 'notes.txt', new TextEncoder().encode('new').buffer, true);

    assertEquals(result, { success: true });
    assertEquals(await Deno.readTextFile(join(userRootPath, 'notes.txt')), 'new');
    assertEquals(await Deno.readTextFile(join(userRootPath, 'original-notes.txt')), 'original');
    assertEquals(await listTempFiles(userRootPath), []);
  });
});

Deno.test('that a failed overwrite leaves what was there untouched, with no temp file behind', async () => {
  await withUserDirectory(async (userRootPath, userId) => {
    await Deno.mkdir(join(userRootPath, 'photos'));
    await Deno.writeTextFile(join(userRootPath, 'photos', 'a.jpg'), 'original');

    const originalConsoleError = console.error;
    console.error = () => {};

    try {
      const result = await FileModel.create(userId, '/', 'photos', 'new', true);

      assertEquals(result.success, false);
    } finally {
      console.error = originalConsoleError;
    }

    assertEquals(await Deno.readTextFile(join(userRootPath, 'photos', 'a.jpg')), 'original');
    assertEquals(await listTempFiles(userRootPath), []);
  });
});

async function pathExists(path: string): Promise<boolean> {
  try {
    await Deno.stat(path);
    return true;
  } catch {
    return false;
  }
}

Deno.test('that FileModel.get reads a file inside the user directory', async () => {
  const filesRoot = await AppConfig.getFilesRootPath();
  const userId = crypto.randomUUID();
  const userRoot = join(filesRoot, userId);

  try {
    await Deno.mkdir(userRoot, { recursive: true });
    await Deno.writeTextFile(join(userRoot, 'notes.txt'), 'inside');

    const fileResult = await FileModel.get(userId, '/', 'notes.txt');

    assertEquals(fileResult.success, true);
    assertEquals(new TextDecoder().decode(fileResult.contents), 'inside');
  } finally {
    await Deno.remove(userRoot, { recursive: true }).catch(() => {});
  }
});

Deno.test('that FileModel.get does not read a file outside the user directory', async () => {
  const filesRoot = await AppConfig.getFilesRootPath();
  const userId = crypto.randomUUID();
  const userRoot = join(filesRoot, userId);
  const outsideDir = await Deno.makeTempDir({ prefix: 'bewcloud-outside-' });
  const outsideFile = join(outsideDir, 'secret.txt');

  try {
    await Deno.mkdir(userRoot, { recursive: true });
    await Deno.writeTextFile(outsideFile, 'OUTSIDE');

    const escapedName = relative(userRoot, outsideFile);
    assertEquals(escapedName.startsWith('..'), true);

    const fileResult = await FileModel.get(userId, '/', escapedName);

    assertEquals(fileResult.success, false);
    assertEquals(await Deno.readTextFile(outsideFile), 'OUTSIDE');
  } finally {
    await Deno.remove(userRoot, { recursive: true }).catch(() => {});
    await Deno.remove(outsideDir, { recursive: true }).catch(() => {});
  }
});

Deno.test("that FileModel.get does not read another user's file", async () => {
  const filesRoot = await AppConfig.getFilesRootPath();
  const userId = crypto.randomUUID();
  const otherUserId = crypto.randomUUID();
  const userRoot = join(filesRoot, userId);
  const otherRoot = join(filesRoot, otherUserId);

  try {
    await Deno.mkdir(userRoot, { recursive: true });
    await Deno.mkdir(otherRoot, { recursive: true });
    await Deno.writeTextFile(join(otherRoot, 'secret.txt'), 'OTHER');

    const escapedName = relative(userRoot, join(otherRoot, 'secret.txt'));
    assertEquals(escapedName.startsWith('..'), true);

    const fileResult = await FileModel.get(userId, '/', escapedName);

    assertEquals(fileResult.success, false);
    assertEquals(await Deno.readTextFile(join(otherRoot, 'secret.txt')), 'OTHER');
  } finally {
    await Deno.remove(userRoot, { recursive: true }).catch(() => {});
    await Deno.remove(otherRoot, { recursive: true }).catch(() => {});
  }
});

Deno.test('that FileModel.create does not write outside the user directory', async () => {
  const filesRoot = await AppConfig.getFilesRootPath();
  const userId = crypto.randomUUID();
  const userRoot = join(filesRoot, userId);
  const outsideDir = await Deno.makeTempDir({ prefix: 'bewcloud-outside-' });
  const outsideFile = join(outsideDir, 'created.txt');

  try {
    await Deno.mkdir(userRoot, { recursive: true });

    const escapedName = relative(userRoot, outsideFile);
    assertEquals(escapedName.startsWith('..'), true);

    const createdFile = await FileModel.create(userId, '/', escapedName, 'nope');

    assertEquals(createdFile.success, false);
    assertEquals(await pathExists(outsideFile), false);
  } finally {
    await Deno.remove(userRoot, { recursive: true }).catch(() => {});
    await Deno.remove(outsideDir, { recursive: true }).catch(() => {});
  }
});

Deno.test('that FileModel.create writes a file inside the user directory', async () => {
  const filesRoot = await AppConfig.getFilesRootPath();
  const userId = crypto.randomUUID();
  const userRoot = join(filesRoot, userId);

  try {
    await Deno.mkdir(userRoot, { recursive: true });

    const createdFile = await FileModel.create(userId, '/', 'notes.txt', 'inside');

    assertEquals(createdFile.success, true);
    assertEquals(await Deno.readTextFile(join(userRoot, 'notes.txt')), 'inside');
  } finally {
    await Deno.remove(userRoot, { recursive: true }).catch(() => {});
  }
});

Deno.test('that DirectoryModel.create does not create a directory outside the user directory', async () => {
  const filesRoot = await AppConfig.getFilesRootPath();
  const userId = crypto.randomUUID();
  const userRoot = join(filesRoot, userId);
  const outsideDir = await Deno.makeTempDir({ prefix: 'bewcloud-outside-' });
  const outsideDirectory = join(outsideDir, 'nested');

  try {
    await Deno.mkdir(userRoot, { recursive: true });

    const escapedName = relative(userRoot, outsideDirectory);
    assertEquals(escapedName.startsWith('..'), true);

    const createdDirectory = await DirectoryModel.create(userId, '/', escapedName);

    assertEquals(createdDirectory, false);
    assertEquals(await pathExists(outsideDirectory), false);
  } finally {
    await Deno.remove(userRoot, { recursive: true }).catch(() => {});
    await Deno.remove(outsideDir, { recursive: true }).catch(() => {});
  }
});

// PATH is shared by parallel test workers, but Deno.Command belongs to this worker.
async function withDuCommand(commandPath: string, test: () => Promise<void>) {
  const OriginalCommand = Deno.Command;

  Deno.Command = class extends OriginalCommand {
    constructor(command: string | URL, options?: Deno.CommandOptions) {
      super(command === 'du' ? commandPath : command, options);
    }
  };

  try {
    await test();
  } finally {
    Deno.Command = OriginalCommand;
  }
}

async function withFakeDu(duration: string, test: (logPath: string) => Promise<void>) {
  const binPath = await Deno.makeTempDir();
  const logPath = join(binPath, 'du.log');

  await Deno.writeTextFile(
    join(binPath, 'du'),
    `#!/bin/sh\necho started >> "${logPath}"\nsleep ${duration}\necho finished >> "${logPath}"\nprintf '12K\\t%s\\n' "$2"\n`,
    { mode: 0o755 },
  );

  try {
    await withDuCommand(join(binPath, 'du'), () => test(logPath));
  } finally {
    await Deno.remove(binPath, { recursive: true });
  }
}

async function readLog(logPath: string): Promise<string[]> {
  return (await Deno.readTextFile(logPath)).split('\n').filter(Boolean);
}

Deno.test('that a fake du does not change PATH for other test workers', async () => {
  const originalPath = Deno.env.get('PATH');

  await withFakeDu('0', async () => {
    assertEquals(await getDirectorySize(`/nonexistent/${crypto.randomUUID()}`), 12 * 1024);
    assertEquals(Deno.env.get('PATH'), originalPath);
  });
});

Deno.test('that getDirectorySize follows the requested directory symlink but not nested symlinks', async () => {
  const directoryPath = await Deno.makeTempDir();
  const targetPath = join(directoryPath, 'target');
  const outsidePath = join(directoryPath, 'outside');
  const linkPath = join(directoryPath, 'link');

  try {
    await Deno.mkdir(targetPath);
    await Deno.mkdir(outsidePath);
    const contents = new Uint8Array(12 * 1024 * 1024);
    await Deno.writeFile(join(targetPath, 'file.bin'), contents);
    await Deno.writeFile(join(outsidePath, 'file.bin'), contents);
    await Deno.symlink(outsidePath, join(targetPath, 'nested-link'), { type: 'dir' });
    await Deno.symlink(targetPath, linkPath, { type: 'dir' });

    const sizeInBytes = await getDirectorySize(linkPath);

    assert(sizeInBytes !== null);
    assert(sizeInBytes >= 12 * 1024 * 1024);
    assert(sizeInBytes < 20 * 1024 * 1024);
  } finally {
    await Deno.remove(directoryPath, { recursive: true });
  }
});

Deno.test('that getDirectorySize recalculates fast directories every time', async () => {
  await withFakeDu('0', async (logPath) => {
    const path = `/nonexistent/${crypto.randomUUID()}`;

    assertEquals(await getDirectorySize(path), bytesFromHumanFileSize('12 KB'));
    assertEquals(await getDirectorySize(path), bytesFromHumanFileSize('12 KB'));

    assertEquals((await readLog(logPath)).filter((line) => line === 'started').length, 2);
  });
});

async function withScriptedDu(script: string, test: () => Promise<void>) {
  const binPath = await Deno.makeTempDir();
  const originalConsoleError = console.error;

  await Deno.writeTextFile(join(binPath, 'du'), `#!/bin/sh\n${script}\n`, { mode: 0o755 });

  console.error = () => {};

  try {
    await withDuCommand(join(binPath, 'du'), test);
  } finally {
    console.error = originalConsoleError;
    await Deno.remove(binPath, { recursive: true });
  }
}

Deno.test('that getDirectorySize returns 0, not null, without walking the directory when du fails', async () => {
  const directoryPath = await Deno.makeTempDir();
  await Deno.writeTextFile(join(directoryPath, 'file.txt'), '12345');

  try {
    await withScriptedDu(`echo "du failed" >&2\nexit 1`, async () => {
      assertEquals(await getDirectorySize(directoryPath), 0);
    });
  } finally {
    await Deno.remove(directoryPath, { recursive: true });
  }
});

Deno.test('that getDirectorySize uses what du could read when it fails partway', async () => {
  await withScriptedDu(`echo "cannot read directory" >&2\nprintf '12K\\t%s\\n' "$2"\nexit 1`, async () => {
    assertEquals(await getDirectorySize(`/nonexistent/${crypto.randomUUID()}`), bytesFromHumanFileSize('12 KB'));
  });
});

Deno.test('that getDirectorySize walks the directory when du is missing', async () => {
  const binPath = await Deno.makeTempDir();
  const directoryPath = await Deno.makeTempDir();

  await Deno.mkdir(join(directoryPath, 'subdirectory'));
  await Deno.writeTextFile(join(directoryPath, 'file.txt'), '12345');
  await Deno.writeTextFile(join(directoryPath, 'subdirectory', 'file.txt'), '123');

  try {
    await withDuCommand(join(binPath, 'du'), async () => {
      assertEquals(await getDirectorySize(directoryPath), 8);
    });
  } finally {
    await Deno.remove(binPath, { recursive: true });
    await Deno.remove(directoryPath, { recursive: true });
  }
});

Deno.test('that getDirectorySize continues slow directories in the background and caches them', async () => {
  await withFakeDu('2', async (logPath) => {
    const path = `/nonexistent/${crypto.randomUUID()}`;

    const startedAt = Date.now();
    const sizes = await Promise.all([getDirectorySize(path), getDirectorySize(path), getDirectorySize(path)]);

    assertEquals(sizes, [null, null, null]);
    assertEquals(Date.now() - startedAt < 2_000, true);

    while (!(await readLog(logPath)).includes('finished')) {
      await new Promise((resolve) => setTimeout(resolve, 50));
    }

    // Lets the background calculation store its result
    await new Promise((resolve) => setTimeout(resolve, 50));

    assertEquals(await getDirectorySize(path), bytesFromHumanFileSize('12 KB'));
    assertEquals(await readLog(logPath), ['started', 'finished']);
  });
});

Deno.test('that getDirectorySizes sizes every path, a few at a time', async () => {
  await withFakeDu('0.2', async (logPath) => {
    const paths = Array.from({ length: 20 }, () => `/nonexistent/${crypto.randomUUID()}`);

    const sizes = await getDirectorySizes(paths);

    assertEquals(sizes, paths.map(() => bytesFromHumanFileSize('12 KB')));

    let inFlight = 0;
    let maxInFlight = 0;

    for (const line of await readLog(logPath)) {
      inFlight += line === 'started' ? 1 : -1;
      maxInFlight = Math.max(maxInFlight, inFlight);
    }

    assertEquals(maxInFlight, 8);
  });
});

Deno.test('that getDirectorySizes stops starting du once enough are running, instead of waiting on each in turn', async () => {
  await withFakeDu('1.5', async (logPath) => {
    const paths = Array.from({ length: 24 }, () => `/nonexistent/${crypto.randomUUID()}`);

    const startedAt = Date.now();
    const sizes = await getDirectorySizes(paths);

    assertEquals(sizes, paths.map(() => null));
    assertEquals(Date.now() - startedAt < 1_500, true);
    assertEquals((await readLog(logPath)).filter((line) => line === 'started').length, 8);

    // The ones already running still finish, so nothing outlives the fake "du"
    while ((await readLog(logPath)).filter((line) => line === 'finished').length < 8) {
      await new Promise((resolve) => setTimeout(resolve, 50));
    }

    await new Promise((resolve) => setTimeout(resolve, 50));
  });
});

Deno.test('that the directory size cache evicts the oldest measurement once full', async () => {
  await withFakeDu('0', async (logPath) => {
    const [remeasuredPath, oldestPath, ...otherPaths] = Array.from(
      { length: 1_001 },
      () => `/nonexistent/${crypto.randomUUID()}`,
    );

    cacheDirectorySize(remeasuredPath, 1);
    cacheDirectorySize(oldestPath, 2);
    cacheDirectorySize(remeasuredPath, 1);

    for (const path of otherPaths) {
      cacheDirectorySize(path, 3);
    }

    assertEquals(await getDirectorySize(remeasuredPath), 1);
    assertEquals(await getDirectorySize(otherPaths[otherPaths.length - 1]), 3);
    assertEquals(await getDirectorySize(oldestPath), bytesFromHumanFileSize('12 KB'));
    assertEquals(await readLog(logPath), ['started', 'finished']);
  });
});
