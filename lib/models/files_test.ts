import { assertEquals } from '@std/assert';
import { join } from '@std/path';

import { AppConfig } from '/lib/config.ts';
import { FileModel } from './files.ts';

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
