import { assertEquals, assertRejects } from '@std/assert';
import { join, relative } from '@std/path';

import { AppConfig } from '/lib/config.ts';
import { FileShareModel } from '/lib/models/files.ts';
import { FileShare } from '/lib/types.ts';

import openFileSharePage from './[fileShareId]/open/[fileName].ts';

// These tests swap process-wide config and FileShareModel.getById. deno test --parallel would otherwise interleave them.
let openShareTail: Promise<void> = Promise.resolve();

function withOpenShareLock<T>(callback: () => Promise<T>): Promise<T> {
  const run = openShareTail.then(callback, callback);
  openShareTail = run.then(() => {}, () => {});
  return run;
}

async function withPublicFiles<T>(callback: () => Promise<T>): Promise<T> {
  return await withOpenShareLock(async () => {
    const config = await AppConfig.getConfig();
    const previousSharing = config.files.allowPublicSharing;
    const previousApps = [...config.core.enabledApps];

    config.files.allowPublicSharing = true;

    if (!config.core.enabledApps.includes('files')) {
      config.core.enabledApps.push('files');
    }

    try {
      return await callback();
    } finally {
      config.files.allowPublicSharing = previousSharing;
      config.core.enabledApps = previousApps;
    }
  });
}

async function openShare(fileShare: FileShare, fileName: string, path = '/'): Promise<Response> {
  const originalGetById = FileShareModel.getById;

  FileShareModel.getById = (id: string) => {
    return Promise.resolve(id === fileShare.id ? fileShare : null);
  };

  try {
    const request = new Request(
      `http://localhost:8000/file-share/${fileShare.id}/open/${fileName}?path=${encodeURIComponent(path)}`,
    );
    const match = {
      pathname: { groups: { fileShareId: fileShare.id, fileName } },
    } as unknown as URLPatternResult;

    return await openFileSharePage.get!({ request, match, isRunningLocally: true });
  } finally {
    FileShareModel.getById = originalGetById;
  }
}

function shareFor(userId: string, filePath: string): FileShare {
  return {
    id: crypto.randomUUID(),
    user_id: userId,
    file_path: filePath,
    extra: {},
    created_at: new Date(),
  };
}

Deno.test('that a public directory share opens a file inside the share', async () => {
  const filesRoot = await AppConfig.getFilesRootPath();
  const userId = crypto.randomUUID();
  const userRoot = join(filesRoot, userId);

  try {
    await Deno.mkdir(join(userRoot, 'Public'), { recursive: true });
    await Deno.writeTextFile(join(userRoot, 'Public', 'shared.txt'), 'SHARED');

    const response = await withPublicFiles(() => openShare(shareFor(userId, '/Public/'), 'shared.txt'));

    assertEquals(response.status, 200);
    assertEquals(await response.text(), 'SHARED');
  } finally {
    await Deno.remove(userRoot, { recursive: true }).catch(() => {});
  }
});

Deno.test('that a public directory share does not open a file outside the share', async () => {
  const filesRoot = await AppConfig.getFilesRootPath();
  const userId = crypto.randomUUID();
  const userRoot = join(filesRoot, userId);

  try {
    await Deno.mkdir(join(userRoot, 'Public'), { recursive: true });
    await Deno.writeTextFile(join(userRoot, 'Public', 'shared.txt'), 'SHARED');
    await Deno.writeTextFile(join(userRoot, 'private.txt'), 'PRIVATE');

    await withPublicFiles(() =>
      assertRejects(
        () => openShare(shareFor(userId, '/Public/'), '..%2Fprivate.txt'),
        Error,
        'NotFound',
      )
    );

    assertEquals(await Deno.readTextFile(join(userRoot, 'private.txt')), 'PRIVATE');
  } finally {
    await Deno.remove(userRoot, { recursive: true }).catch(() => {});
  }
});

Deno.test('that a public file share opens that file', async () => {
  const filesRoot = await AppConfig.getFilesRootPath();
  const userId = crypto.randomUUID();
  const userRoot = join(filesRoot, userId);

  try {
    await Deno.mkdir(userRoot, { recursive: true });
    await Deno.writeTextFile(join(userRoot, 'shared.txt'), 'SHARED');

    const response = await withPublicFiles(() => openShare(shareFor(userId, '/shared.txt'), 'shared.txt'));

    assertEquals(response.status, 200);
    assertEquals(await response.text(), 'SHARED');
  } finally {
    await Deno.remove(userRoot, { recursive: true }).catch(() => {});
  }
});

Deno.test('that a public directory share opens a file in a subdirectory', async () => {
  const filesRoot = await AppConfig.getFilesRootPath();
  const userId = crypto.randomUUID();
  const userRoot = join(filesRoot, userId);

  try {
    await Deno.mkdir(join(userRoot, 'Public', 'Sub'), { recursive: true });
    await Deno.writeTextFile(join(userRoot, 'Public', 'Sub', 'note.txt'), 'NOTE');

    const response = await withPublicFiles(() => openShare(shareFor(userId, '/Public/'), 'note.txt', '/Sub/'));

    assertEquals(response.status, 200);
    assertEquals(await response.text(), 'NOTE');
  } finally {
    await Deno.remove(userRoot, { recursive: true }).catch(() => {});
  }
});

Deno.test('that a public file share inside a directory opens that file', async () => {
  const filesRoot = await AppConfig.getFilesRootPath();
  const userId = crypto.randomUUID();
  const userRoot = join(filesRoot, userId);

  try {
    await Deno.mkdir(join(userRoot, 'Public'), { recursive: true });
    await Deno.writeTextFile(join(userRoot, 'Public', 'shared.txt'), 'SHARED');

    const response = await withPublicFiles(() => openShare(shareFor(userId, '/Public/shared.txt'), 'shared.txt'));

    assertEquals(response.status, 200);
    assertEquals(await response.text(), 'SHARED');
  } finally {
    await Deno.remove(userRoot, { recursive: true }).catch(() => {});
  }
});

Deno.test('that a public file share does not open a sibling file', async () => {
  const filesRoot = await AppConfig.getFilesRootPath();
  const userId = crypto.randomUUID();
  const userRoot = join(filesRoot, userId);

  try {
    await Deno.mkdir(userRoot, { recursive: true });
    await Deno.writeTextFile(join(userRoot, 'shared.txt'), 'SHARED');
    await Deno.writeTextFile(join(userRoot, 'private.txt'), 'PRIVATE');

    await withPublicFiles(() =>
      assertRejects(
        () => openShare(shareFor(userId, '/shared.txt'), 'private.txt'),
        Error,
        'NotFound',
      )
    );
  } finally {
    await Deno.remove(userRoot, { recursive: true }).catch(() => {});
  }
});

Deno.test("that a public share does not open another user's file", async () => {
  const filesRoot = await AppConfig.getFilesRootPath();
  const userId = crypto.randomUUID();
  const otherUserId = crypto.randomUUID();
  const userRoot = join(filesRoot, userId);
  const otherRoot = join(filesRoot, otherUserId);

  try {
    await Deno.mkdir(join(userRoot, 'Public'), { recursive: true });
    await Deno.writeTextFile(join(userRoot, 'Public', 'shared.txt'), 'SHARED');
    await Deno.mkdir(otherRoot, { recursive: true });
    await Deno.writeTextFile(join(otherRoot, 'secret.txt'), 'OTHER');

    const escapedName = relative(join(userRoot, 'Public'), join(otherRoot, 'secret.txt'));
    assertEquals(escapedName.startsWith('..'), true);

    await withPublicFiles(() =>
      assertRejects(
        () => openShare(shareFor(userId, '/Public/'), encodeURIComponent(escapedName).replaceAll('/', '%2F')),
        Error,
        'NotFound',
      )
    );
  } finally {
    await Deno.remove(userRoot, { recursive: true }).catch(() => {});
    await Deno.remove(otherRoot, { recursive: true }).catch(() => {});
  }
});

Deno.test('that a public share downloads active content (HTML, SVG) instead of rendering it', async () => {
  const filesRoot = await AppConfig.getFilesRootPath();
  const userId = crypto.randomUUID();
  const userRoot = join(filesRoot, userId);

  try {
    await Deno.mkdir(join(userRoot, 'Public'), { recursive: true });
    await Deno.writeTextFile(join(userRoot, 'Public', 'evil.html'), '<script>alert(document.domain)</script>');
    await Deno.writeTextFile(
      join(userRoot, 'Public', 'evil.svg'),
      '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>',
    );

    for (const fileName of ['evil.html', 'evil.svg']) {
      const response = await withPublicFiles(() => openShare(shareFor(userId, '/Public/'), fileName));

      assertEquals(response.status, 200);
      assertEquals(response.headers.get('content-disposition')?.startsWith('attachment;'), true);
      assertEquals(response.headers.get('x-content-type-options'), 'nosniff');
      assertEquals(response.headers.get('content-security-policy')?.includes('sandbox'), true);
      await response.body?.cancel();
    }
  } finally {
    await Deno.remove(userRoot, { recursive: true }).catch(() => {});
  }
});

Deno.test('that a public share still shows plain text and images inline, sandboxed', async () => {
  const filesRoot = await AppConfig.getFilesRootPath();
  const userId = crypto.randomUUID();
  const userRoot = join(filesRoot, userId);

  try {
    await Deno.mkdir(join(userRoot, 'Public'), { recursive: true });
    await Deno.writeTextFile(join(userRoot, 'Public', 'shared.txt'), '<script>alert(1)</script>');

    const response = await withPublicFiles(() => openShare(shareFor(userId, '/Public/'), 'shared.txt'));

    assertEquals(response.status, 200);
    assertEquals(response.headers.get('content-type'), 'text/plain');
    assertEquals(response.headers.get('content-disposition')?.startsWith('inline;'), true);
    assertEquals(response.headers.get('content-security-policy')?.includes('sandbox'), true);
    assertEquals(await response.text(), '<script>alert(1)</script>');
  } finally {
    await Deno.remove(userRoot, { recursive: true }).catch(() => {});
  }
});
