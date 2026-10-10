import { assertEquals } from '@std/assert';
import { join, relative } from '@std/path';

import { AppConfig } from '/lib/config.ts';
import { DirectoryModel, FileModel } from '/lib/models/files.ts';

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
