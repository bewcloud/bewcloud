import { assertEquals, assertMatch } from '@std/assert';
import { join } from '@std/path';

import { AppConfig } from '/lib/config.ts';
import { User } from '/lib/types.ts';

import davPage from './dav.ts';

// Calls dav.ts's handler directly with an already-resolved `user`, bypassing routes.ts/DB auth.
const tempRootDir = await Deno.makeTempDir({ prefix: 'bewcloud-dav-test-' });
const config = await AppConfig.getConfig();
config.files.rootPath = tempRootDir;

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

async function setUpUser(): Promise<{ user: User; userRootPath: string }> {
  const userId = crypto.randomUUID();
  const userRootPath = join(tempRootDir, userId);
  await Deno.mkdir(userRootPath, { recursive: true });
  return { user: createMockUser(userId), userRootPath };
}

async function callDav(
  method: string,
  filePath: string | undefined,
  user: User,
  init: RequestInit = {},
): Promise<Response> {
  const url = `http://localhost:8000/dav/${filePath ?? ''}`;
  const request = new Request(url, { method, ...init });
  const match = { pathname: { groups: { filePath } } } as unknown as URLPatternResult;

  return await davPage.catchAll!({ request, match, user, isRunningLocally: true });
}

const lockRequestBody =
  `<?xml version="1.0" encoding="utf-8"?><D:lockinfo xmlns:D="DAV:"><D:lockscope><D:exclusive/></D:lockscope><D:locktype><D:write/></D:locktype><D:owner><D:href>test-owner</D:href></D:owner></D:lockinfo>`;

async function lockPath(filePath: string, user: User, depth?: string): Promise<Response> {
  const headers: Record<string, string> = {};
  if (depth) {
    headers.depth = depth;
  }
  return await callDav('LOCK', filePath, user, { body: lockRequestBody, headers });
}

function getLockTokenFromResponse(response: Response): string {
  const lockTokenHeader = response.headers.get('lock-token') || '';
  return lockTokenHeader.replace(/^<|>$/g, '');
}

Deno.test('that GET returns a file that exists', async () => {
  const { user, userRootPath } = await setUpUser();
  await Deno.writeTextFile(join(userRootPath, 'hello.txt'), 'hello world');

  const response = await callDav('GET', 'hello.txt', user);

  assertEquals(response.status, 200);
  assertEquals(await response.text(), 'hello world');
});

Deno.test('that GET returns 404 for a file that does not exist', async () => {
  const { user } = await setUpUser();

  const response = await callDav('GET', 'does-not-exist.txt', user);

  assertEquals(response.status, 404);
});

Deno.test('that PUT creates a new file', async () => {
  const { user, userRootPath } = await setUpUser();

  const response = await callDav('PUT', 'new-file.txt', user, { body: 'some content' });

  assertEquals(response.status, 201);
  assertEquals(await Deno.readTextFile(join(userRootPath, 'new-file.txt')), 'some content');
});

Deno.test('that DELETE removes a file that exists', async () => {
  const { user, userRootPath } = await setUpUser();
  await Deno.writeTextFile(join(userRootPath, 'to-delete.txt'), 'bye');

  const response = await callDav('DELETE', 'to-delete.txt', user);

  assertEquals(response.status, 204);

  let stillExists = true;
  try {
    await Deno.stat(join(userRootPath, 'to-delete.txt'));
  } catch {
    stillExists = false;
  }
  assertEquals(stillExists, false);
});

Deno.test('that DELETE returns 404 for a file that does not exist', async () => {
  const { user } = await setUpUser();

  const response = await callDav('DELETE', 'does-not-exist.txt', user);

  assertEquals(response.status, 404);
});

Deno.test('that MKCOL creates a new collection', async () => {
  const { user, userRootPath } = await setUpUser();

  const response = await callDav('MKCOL', 'new-folder', user);

  assertEquals(response.status, 201);
  const stat = await Deno.stat(join(userRootPath, 'new-folder'));
  assertEquals(stat.isDirectory, true);
});

Deno.test('that MKCOL returns 409 and does not create anything when the parent is missing', async () => {
  const { user, userRootPath } = await setUpUser();

  const response = await callDav('MKCOL', 'no-such-parent/new-folder', user);

  assertEquals(response.status, 409);

  let parentWasCreated = true;
  try {
    await Deno.stat(join(userRootPath, 'no-such-parent'));
  } catch {
    parentWasCreated = false;
  }
  assertEquals(parentWasCreated, false);
});

Deno.test('that MKCOL returns 409 for a collection that already exists', async () => {
  const { user, userRootPath } = await setUpUser();
  await Deno.mkdir(join(userRootPath, 'existing-folder'));

  const response = await callDav('MKCOL', 'existing-folder', user);

  assertEquals(response.status, 409);
});

Deno.test('that COPY creates a new destination file and keeps the source', async () => {
  const { user, userRootPath } = await setUpUser();
  await Deno.writeTextFile(join(userRootPath, 'source.txt'), 'original content');

  const response = await callDav('COPY', 'source.txt', user, {
    headers: { destination: 'http://localhost:8000/dav/destination.txt' },
  });

  assertEquals(response.status, 201);
  assertEquals(await Deno.readTextFile(join(userRootPath, 'source.txt')), 'original content');
  assertEquals(await Deno.readTextFile(join(userRootPath, 'destination.txt')), 'original content');
});

Deno.test('that MOVE moves a file to a new destination', async () => {
  const { user, userRootPath } = await setUpUser();
  await Deno.writeTextFile(join(userRootPath, 'source.txt'), 'original content');

  const response = await callDav('MOVE', 'source.txt', user, {
    headers: { destination: 'http://localhost:8000/dav/destination.txt' },
  });

  assertEquals(response.status, 201);
  assertEquals(await Deno.readTextFile(join(userRootPath, 'destination.txt')), 'original content');

  let sourceStillExists = true;
  try {
    await Deno.stat(join(userRootPath, 'source.txt'));
  } catch {
    sourceStillExists = false;
  }
  assertEquals(sourceStillExists, false);
});

Deno.test('that MOVE works when the Destination header keeps the /dav/ prefix (regression for #155)', async () => {
  const { user, userRootPath } = await setUpUser();
  await Deno.mkdir(join(userRootPath, 'Choraufnahmen'));
  await Deno.writeTextFile(join(userRootPath, 'Choraufnahmen', 'Noten'), 'sheet music');

  const response = await callDav('MOVE', 'Choraufnahmen/Noten', user, {
    headers: { destination: 'https://storage.yukis.eu/dav/Choraufnahmen/Noten2' },
  });

  assertEquals(response.status, 201);
  assertEquals(await Deno.readTextFile(join(userRootPath, 'Choraufnahmen', 'Noten2')), 'sheet music');
});

Deno.test('that COPY/MOVE return 404 when the source does not exist', async () => {
  const { user } = await setUpUser();

  const copyResponse = await callDav('COPY', 'does-not-exist.txt', user, {
    headers: { destination: 'http://localhost:8000/dav/destination.txt' },
  });
  assertEquals(copyResponse.status, 404);

  const moveResponse = await callDav('MOVE', 'does-not-exist.txt', user, {
    headers: { destination: 'http://localhost:8000/dav/destination.txt' },
  });
  assertEquals(moveResponse.status, 404);
});

Deno.test("that COPY/MOVE return 409 when the destination's parent collection does not exist", async () => {
  const { user, userRootPath } = await setUpUser();
  await Deno.writeTextFile(join(userRootPath, 'source.txt'), 'content');

  const copyResponse = await callDav('COPY', 'source.txt', user, {
    headers: { destination: 'http://localhost:8000/dav/no-such-folder/destination.txt' },
  });
  assertEquals(copyResponse.status, 409);

  const moveResponse = await callDav('MOVE', 'source.txt', user, {
    headers: { destination: 'http://localhost:8000/dav/no-such-folder/destination.txt' },
  });
  assertEquals(moveResponse.status, 409);
});

Deno.test('that COPY/MOVE respect "Overwrite: F" and fail with 412 without touching the destination', async () => {
  const { user, userRootPath } = await setUpUser();
  await Deno.writeTextFile(join(userRootPath, 'source.txt'), 'new content');
  await Deno.writeTextFile(join(userRootPath, 'destination.txt'), 'existing content');

  const response = await callDav('COPY', 'source.txt', user, {
    headers: {
      destination: 'http://localhost:8000/dav/destination.txt',
      overwrite: 'F',
    },
  });

  assertEquals(response.status, 412);
  assertEquals(await Deno.readTextFile(join(userRootPath, 'destination.txt')), 'existing content');
});

Deno.test('that COPY/MOVE allow overwriting an existing destination by default and return 204', async () => {
  const { user, userRootPath } = await setUpUser();
  await Deno.writeTextFile(join(userRootPath, 'source.txt'), 'new content');
  await Deno.writeTextFile(join(userRootPath, 'destination.txt'), 'existing content');

  const response = await callDav('COPY', 'source.txt', user, {
    headers: { destination: 'http://localhost:8000/dav/destination.txt' },
  });

  assertEquals(response.status, 204);
  assertEquals(await Deno.readTextFile(join(userRootPath, 'destination.txt')), 'new content');
});

Deno.test('that LOCK on an existing file succeeds and returns a lock token', async () => {
  const { user, userRootPath } = await setUpUser();
  await Deno.writeTextFile(join(userRootPath, 'file.txt'), 'content');

  const response = await lockPath('file.txt', user);

  assertEquals(response.status, 200);
  assertMatch(getLockTokenFromResponse(response), /^opaquelocktoken:/);
});

Deno.test('that LOCK on a resource that does not exist returns 404', async () => {
  const { user } = await setUpUser();

  const response = await lockPath('does-not-exist.txt', user);

  assertEquals(response.status, 404);
});

Deno.test('that LOCK on an already-locked resource returns 423 without a matching token', async () => {
  const { user, userRootPath } = await setUpUser();
  await Deno.writeTextFile(join(userRootPath, 'file.txt'), 'content');
  await lockPath('file.txt', user);

  const response = await lockPath('file.txt', user);

  assertEquals(response.status, 423);
});

Deno.test('that a LOCK refresh (empty body + matching If token) keeps the same token', async () => {
  const { user, userRootPath } = await setUpUser();
  await Deno.writeTextFile(join(userRootPath, 'file.txt'), 'content');
  const firstResponse = await lockPath('file.txt', user);
  const token = getLockTokenFromResponse(firstResponse);

  const refreshResponse = await callDav('LOCK', 'file.txt', user, { headers: { if: `(<${token}>)` } });

  assertEquals(refreshResponse.status, 200);
  assertEquals(getLockTokenFromResponse(refreshResponse), token);
});

Deno.test('that UNLOCK releases a lock, allowing it to be locked again', async () => {
  const { user, userRootPath } = await setUpUser();
  await Deno.writeTextFile(join(userRootPath, 'file.txt'), 'content');
  const lockResponse = await lockPath('file.txt', user);
  const token = getLockTokenFromResponse(lockResponse);

  const unlockResponse = await callDav('UNLOCK', 'file.txt', user, { headers: { 'lock-token': `<${token}>` } });
  assertEquals(unlockResponse.status, 204);

  const secondLockResponse = await lockPath('file.txt', user);
  assertEquals(secondLockResponse.status, 200);
});

Deno.test('that UNLOCK with a wrong or missing token returns 409', async () => {
  const { user, userRootPath } = await setUpUser();
  await Deno.writeTextFile(join(userRootPath, 'file.txt'), 'content');
  await lockPath('file.txt', user);

  const wrongTokenResponse = await callDav('UNLOCK', 'file.txt', user, {
    headers: { 'lock-token': '<opaquelocktoken:wrong>' },
  });
  assertEquals(wrongTokenResponse.status, 409);

  const missingTokenResponse = await callDav('UNLOCK', 'file.txt', user);
  assertEquals(missingTokenResponse.status, 409);
});

Deno.test('that PUT/DELETE on a locked file are blocked without a token and allowed with it', async () => {
  const { user, userRootPath } = await setUpUser();
  await Deno.writeTextFile(join(userRootPath, 'file.txt'), 'content');
  const lockResponse = await lockPath('file.txt', user);
  const token = getLockTokenFromResponse(lockResponse);

  const blockedPut = await callDav('PUT', 'file.txt', user, { body: 'new content' });
  assertEquals(blockedPut.status, 423);

  const allowedPut = await callDav('PUT', 'file.txt', user, {
    body: 'new content',
    headers: { if: `(<${token}>)` },
  });
  assertEquals(allowedPut.status, 201);

  await callDav('UNLOCK', 'file.txt', user, { headers: { 'lock-token': `<${token}>` } });
  const secondLock = await lockPath('file.txt', user);
  const secondToken = getLockTokenFromResponse(secondLock);

  const blockedDelete = await callDav('DELETE', 'file.txt', user);
  assertEquals(blockedDelete.status, 423);

  const allowedDelete = await callDav('DELETE', 'file.txt', user, { headers: { if: `(<${secondToken}>)` } });
  assertEquals(allowedDelete.status, 204);
});

Deno.test('that MOVE/COPY are blocked when source or destination is locked, and allowed with the token', async () => {
  const { user, userRootPath } = await setUpUser();
  await Deno.writeTextFile(join(userRootPath, 'source.txt'), 'content');
  await Deno.writeTextFile(join(userRootPath, 'destination.txt'), 'existing');
  const destinationLock = await lockPath('destination.txt', user);
  const destinationToken = getLockTokenFromResponse(destinationLock);

  const blockedCopy = await callDav('COPY', 'source.txt', user, {
    headers: { destination: 'http://localhost:8000/dav/destination.txt' },
  });
  assertEquals(blockedCopy.status, 423);

  const allowedCopy = await callDav('COPY', 'source.txt', user, {
    headers: {
      destination: 'http://localhost:8000/dav/destination.txt',
      if: `(<${destinationToken}>)`,
    },
  });
  assertEquals(allowedCopy.status, 204);
});

Deno.test('that a Depth: infinity lock on a directory blocks operations on files within it', async () => {
  const { user, userRootPath } = await setUpUser();
  await Deno.mkdir(join(userRootPath, 'folder'));
  await Deno.writeTextFile(join(userRootPath, 'folder', 'nested.txt'), 'content');
  const folderLock = await lockPath('folder', user, 'infinity');
  const folderToken = getLockTokenFromResponse(folderLock);

  const blockedDelete = await callDav('DELETE', 'folder/nested.txt', user);
  assertEquals(blockedDelete.status, 423);

  const allowedDelete = await callDav('DELETE', 'folder/nested.txt', user, {
    headers: { if: `(<${folderToken}>)` },
  });
  assertEquals(allowedDelete.status, 204);
});

Deno.test('that a Depth: 0 lock on a directory does not block operations on files within it', async () => {
  const { user, userRootPath } = await setUpUser();
  await Deno.mkdir(join(userRootPath, 'folder'));
  await Deno.writeTextFile(join(userRootPath, 'folder', 'nested.txt'), 'content');
  await lockPath('folder', user, '0');

  const response = await callDav('DELETE', 'folder/nested.txt', user);

  assertEquals(response.status, 204);
});

Deno.test('that acquiring a lock within an already Depth: infinity-locked ancestor is blocked', async () => {
  const { user, userRootPath } = await setUpUser();
  await Deno.mkdir(join(userRootPath, 'folder'));
  await Deno.writeTextFile(join(userRootPath, 'folder', 'nested.txt'), 'content');
  await lockPath('folder', user, 'infinity');

  const response = await lockPath('folder/nested.txt', user);

  assertEquals(response.status, 423);
});

Deno.test('that OPTIONS advertises class 2 (locking) and the actually-supported methods', async () => {
  const { user } = await setUpUser();

  const response = await callDav('OPTIONS', undefined, user);

  assertEquals(response.status, 200);
  assertEquals(response.headers.get('dav'), '1, 2');
  assertEquals(
    response.headers.get('allow'),
    'OPTIONS, GET, HEAD, PUT, DELETE, COPY, MOVE, MKCOL, PROPFIND, LOCK, UNLOCK',
  );
});

Deno.test('that PROPFIND returns 207 for an existing directory and 404 for a missing one', async () => {
  const { user, userRootPath } = await setUpUser();
  await Deno.writeTextFile(join(userRootPath, 'file-in-root.txt'), 'content');

  const foundResponse = await callDav('PROPFIND', undefined, user, { headers: { depth: '1' } });
  assertEquals(foundResponse.status, 207);

  const notFoundResponse = await callDav('PROPFIND', 'does-not-exist', user, { headers: { depth: '1' } });
  assertEquals(notFoundResponse.status, 404);
});
