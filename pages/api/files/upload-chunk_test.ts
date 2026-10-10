import { assertEquals } from '@std/assert';
import { join, relative } from '@std/path';

import { AppConfig } from '/lib/config.ts';
import { User } from '/lib/types.ts';

import uploadChunkPage from './upload-chunk.ts';

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

async function pathExists(path: string): Promise<boolean> {
  try {
    await Deno.stat(path);
    return true;
  } catch {
    return false;
  }
}

async function uploadChunk(user: User, parentPath: string, name: string, contents: string): Promise<Response> {
  const form = new FormData();
  form.set('upload_id', crypto.randomUUID());
  form.set('chunk_index', '0');
  form.set('total_chunks', '1');
  form.set('path_in_view', parentPath);
  form.set('parent_path', parentPath);
  form.set('name', name);
  form.set('chunk', new File([new TextEncoder().encode(contents)], 'chunk.txt'));
  form.set('upload_session_tag', '');

  const request = new Request('http://localhost:8000/api/files/upload-chunk', { method: 'POST', body: form });

  return await uploadChunkPage.post!({
    request,
    match: { pathname: { groups: {} } } as unknown as URLPatternResult,
    user,
    session: null,
    isRunningLocally: true,
  });
}

Deno.test('that a chunk upload writes a file inside the user directory', async () => {
  const filesRoot = await AppConfig.getFilesRootPath();
  const user = createMockUser(crypto.randomUUID());
  const userRoot = join(filesRoot, user.id);

  try {
    await Deno.mkdir(userRoot, { recursive: true });

    const response = await uploadChunk(user, '/', 'notes.txt', 'inside');
    const body = await response.json();

    assertEquals(response.status, 200);
    assertEquals(body.success, true);
    assertEquals(await Deno.readTextFile(join(userRoot, 'notes.txt')), 'inside');
  } finally {
    await Deno.remove(userRoot, { recursive: true }).catch(() => {});
  }
});

Deno.test('that a chunk upload does not write outside the user directory', async () => {
  const filesRoot = await AppConfig.getFilesRootPath();
  const user = createMockUser(crypto.randomUUID());
  const userRoot = join(filesRoot, user.id);
  const outsideDir = await Deno.makeTempDir({ prefix: 'bewcloud-outside-' });
  const outsideFile = join(outsideDir, 'created.txt');

  try {
    await Deno.mkdir(userRoot, { recursive: true });

    const escapedName = relative(userRoot, outsideFile);
    assertEquals(escapedName.startsWith('..'), true);

    const response = await uploadChunk(user, '/', escapedName, 'nope');

    assertEquals(await pathExists(outsideFile), false);
    assertEquals(response.status, 400);
  } finally {
    await Deno.remove(userRoot, { recursive: true }).catch(() => {});
    await Deno.remove(outsideDir, { recursive: true }).catch(() => {});
  }
});
