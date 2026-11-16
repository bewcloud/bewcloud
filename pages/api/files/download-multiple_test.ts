import { assertEquals, assertRejects } from '@std/assert';
import { join } from '@std/path';

import { AppConfig } from '/lib/config.ts';
import { createZipArchiveResponse } from '/lib/models/files.ts';
import { User } from '/lib/types.ts';

import downloadMultiplePage from './download-multiple.ts';

function createMockUser(userId: string): User {
  return {
    id: userId,
    email: `${userId}@example.com`,
    hashed_password: 'unused-in-tests',
    subscription: { external: {}, expires_at: '', updated_at: '' },
    status: 'active',
    extra: { is_email_verified: true },
    created_at: new Date(),
  };
}

async function withDownloadsConfig<T>(
  { allowMultipleFileDownloads, allowDirectoryDownloads }: {
    allowMultipleFileDownloads: boolean;
    allowDirectoryDownloads: boolean;
  },
  callback: () => Promise<T>,
): Promise<T> {
  const config = await AppConfig.getConfig();
  const previousFilesConfig = { ...config.files };
  const previousApps = [...config.core.enabledApps];

  config.files.allowMultipleFileDownloads = allowMultipleFileDownloads;
  config.files.allowDirectoryDownloads = allowDirectoryDownloads;

  if (!config.core.enabledApps.includes('files')) {
    config.core.enabledApps.push('files');
  }

  try {
    return await callback();
  } finally {
    config.files = previousFilesConfig;
    config.core.enabledApps = previousApps;
  }
}

async function withUserFiles(test: (user: User, userRootPath: string) => Promise<void>) {
  const user = createMockUser(crypto.randomUUID());
  const userRootPath = join(await AppConfig.getFilesRootPath(), user.id);

  await Deno.mkdir(join(userRootPath, 'Documents', 'Reports'), { recursive: true });
  await Deno.writeTextFile(join(userRootPath, 'Documents', 'notes.txt'), 'notes');
  await Deno.writeTextFile(join(userRootPath, 'Documents', '-draft.txt'), 'draft');
  await Deno.writeTextFile(join(userRootPath, 'Documents', '[1].txt'), 'one');
  await Deno.writeTextFile(join(userRootPath, 'Documents', '1.txt'), 'not chosen');
  await Deno.writeTextFile(join(userRootPath, 'Documents', 'Reports', 'q1.txt'), 'q1');

  try {
    await test(user, userRootPath);
  } finally {
    await Deno.remove(userRootPath, { recursive: true });
  }
}

async function downloadMultiple(user: User, parentPath: string | null, names: string[]): Promise<Response> {
  const formData = new URLSearchParams();

  if (parentPath !== null) {
    formData.set('parentPath', parentPath);
  }

  for (const name of names) {
    formData.append('name', name);
  }

  const request = new Request('http://localhost:8000/api/files/download-multiple', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: formData.toString(),
  });

  return await downloadMultiplePage.post!({
    request,
    match: { pathname: { groups: {} } } as unknown as URLPatternResult,
    user,
    session: null,
    isRunningLocally: true,
  });
}

async function listZipEntries(response: Response): Promise<string[]> {
  const zipFilePath = await Deno.makeTempFile({ prefix: 'bewcloud-download-', suffix: '.zip' });

  try {
    await Deno.writeFile(zipFilePath, new Uint8Array(await response.arrayBuffer()));

    const { success, stdout } = await new Deno.Command('unzip', { args: ['-Z1', zipFilePath] }).output();

    assertEquals(success, true);

    return new TextDecoder().decode(stdout).split('\n').filter(Boolean).sort();
  } finally {
    await Deno.remove(zipFilePath);
  }
}

Deno.test('that multiple chosen files and directories are downloaded as a single zip', async () => {
  await withUserFiles(async (user) => {
    const response = await withDownloadsConfig(
      { allowMultipleFileDownloads: true, allowDirectoryDownloads: true },
      () => downloadMultiple(user, '/Documents/', ['notes.txt', '-draft.txt', '[1].txt', 'Reports']),
    );

    assertEquals(response.status, 200);
    assertEquals(response.headers.get('content-type'), 'application/zip');
    assertEquals(
      response.headers.get('content-disposition'),
      `attachment; filename="Documents.zip"; filename*=UTF-8''Documents.zip`,
    );
    assertEquals(await listZipEntries(response), ['-draft.txt', 'Reports/', 'Reports/q1.txt', '[1].txt', 'notes.txt']);
  });
});

Deno.test('that a single chosen file is downloaded as a zip named after it', async () => {
  await withUserFiles(async (user) => {
    const response = await withDownloadsConfig(
      { allowMultipleFileDownloads: true, allowDirectoryDownloads: false },
      () => downloadMultiple(user, '/Documents/', ['notes.txt']),
    );

    assertEquals(response.status, 200);
    assertEquals(
      response.headers.get('content-disposition'),
      `attachment; filename="notes.txt.zip"; filename*=UTF-8''notes.txt.zip`,
    );
    assertEquals(await listZipEntries(response), ['notes.txt']);
  });
});

Deno.test('that files chosen in the root directory are downloaded as files.zip', async () => {
  await withUserFiles(async (user, userRootPath) => {
    await Deno.writeTextFile(join(userRootPath, 'todo.txt'), 'todo');

    const response = await withDownloadsConfig(
      { allowMultipleFileDownloads: true, allowDirectoryDownloads: true },
      () => downloadMultiple(user, null, ['todo.txt', 'Documents']),
    );

    assertEquals(response.status, 200);
    assertEquals(
      response.headers.get('content-disposition'),
      `attachment; filename="files.zip"; filename*=UTF-8''files.zip`,
    );
    assertEquals(await listZipEntries(response), [
      'Documents/',
      'Documents/-draft.txt',
      'Documents/1.txt',
      'Documents/Reports/',
      'Documents/Reports/q1.txt',
      'Documents/[1].txt',
      'Documents/notes.txt',
      'todo.txt',
    ]);
  });
});

Deno.test('that multiple file downloads are rejected unless enabled', async () => {
  await withUserFiles(async (user) => {
    const response = await withDownloadsConfig(
      { allowMultipleFileDownloads: false, allowDirectoryDownloads: true },
      () => downloadMultiple(user, '/Documents/', ['notes.txt', '1.txt']),
    );

    assertEquals(response.status, 403);
    await response.body?.cancel();
  });
});

Deno.test('that chosen directories are rejected unless directory downloads are enabled', async () => {
  await withUserFiles(async (user) => {
    const response = await withDownloadsConfig(
      { allowMultipleFileDownloads: true, allowDirectoryDownloads: false },
      () => downloadMultiple(user, '/Documents/', ['notes.txt', 'Reports']),
    );

    assertEquals(response.status, 403);
    assertEquals(await response.text(), 'Directory downloads are not enabled');
  });
});

Deno.test('that a chosen file named like an option is archived with its own content', async () => {
  await withUserFiles(async (user, userRootPath) => {
    await Deno.writeTextFile(join(userRootPath, 'Documents', '-'), 'dash');

    const response = await withDownloadsConfig(
      { allowMultipleFileDownloads: true, allowDirectoryDownloads: false },
      () => downloadMultiple(user, '/Documents/', ['-', 'notes.txt']),
    );

    assertEquals(response.status, 200);
    assertEquals(await listZipEntries(response), ['-', 'notes.txt']);
  });
});

Deno.test('that the contents of a directory are not archived unless directories are meant to be included', async () => {
  await withUserFiles(async (_user, userRootPath) => {
    const workingDirectoryPath = join(userRootPath, 'Documents');
    const request = new Request('http://localhost:8000/api/files/download-multiple', { method: 'POST' });

    const response = createZipArchiveResponse({
      request,
      workingDirectoryPath,
      entryNames: ['./notes.txt', './Reports'],
      includeDirectoryContents: false,
      sizeInBytes: 0,
      archiveFileName: 'Documents.zip',
    });

    assertEquals(await listZipEntries(response), ['Reports/', 'notes.txt']);
  });
});

Deno.test('that the download fails if a chosen entry is gone by the time it is archived', async () => {
  await withUserFiles(async (_user, userRootPath) => {
    const request = new Request('http://localhost:8000/api/files/download-multiple', { method: 'POST' });

    const response = createZipArchiveResponse({
      request,
      workingDirectoryPath: join(userRootPath, 'Documents'),
      entryNames: ['./notes.txt', './missing.txt'],
      includeDirectoryContents: false,
      sizeInBytes: 0,
      archiveFileName: 'Documents.zip',
    });

    await assertRejects(() => response.arrayBuffer());
  });
});

Deno.test('that a missing chosen file is not found', async () => {
  await withUserFiles(async (user) => {
    const response = await withDownloadsConfig(
      { allowMultipleFileDownloads: true, allowDirectoryDownloads: true },
      () => downloadMultiple(user, '/Documents/', ['notes.txt', 'missing.txt']),
    );

    assertEquals(response.status, 404);
    await response.body?.cancel();
  });
});

Deno.test('that names outside of the parent path are rejected', async () => {
  await withUserFiles(async (user) => {
    const requests: [string, string[]][] = [
      ['/Documents/', []],
      ['/Documents/', ['']],
      ['/Documents/', ['..']],
      ['/Documents/', ['/']],
      ['/Documents/', ['/notes.txt']],
      ['/Documents/', ['Reports/q1.txt']],
      ['/Documents/', ['../notes.txt']],
      ['/Documents/../../', ['notes.txt']],
      ['Documents/', ['notes.txt']],
    ];

    for (const [parentPath, names] of requests) {
      const response = await withDownloadsConfig(
        { allowMultipleFileDownloads: true, allowDirectoryDownloads: true },
        () => downloadMultiple(user, parentPath, names),
      );

      assertEquals(response.status, 400, `${parentPath} ${JSON.stringify(names)}`);
      await response.body?.cancel();
    }
  });
});
