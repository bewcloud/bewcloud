import { assertEquals } from '@std/assert';
import { join } from '@std/path';

import { AppConfig } from '/lib/config.ts';
import { User } from '/lib/types.ts';

import downloadDirectoryPage from './download-directory.ts';

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

Deno.test('that a directory with non-Latin-1 characters in its name is downloaded as a zip', async () => {
  const config = await AppConfig.getConfig();
  const previousFilesConfig = { ...config.files };
  const previousApps = [...config.core.enabledApps];
  const user = createMockUser(crypto.randomUUID());
  const userRootPath = join(await AppConfig.getFilesRootPath(), user.id);

  config.files.allowDirectoryDownloads = true;

  if (!config.core.enabledApps.includes('files')) {
    config.core.enabledApps.push('files');
  }

  try {
    await Deno.mkdir(join(userRootPath, 'Fotos 日本'), { recursive: true });
    await Deno.writeTextFile(join(userRootPath, 'Fotos 日本', 'photo.txt'), 'photo');

    const searchParams = new URLSearchParams({ parentPath: '/', name: 'Fotos 日本' });
    const response = await downloadDirectoryPage.get!({
      request: new Request(`http://localhost:8000/api/files/download-directory?${searchParams.toString()}`),
      match: { pathname: { groups: {} } } as unknown as URLPatternResult,
      user,
      session: null,
      isRunningLocally: true,
    });

    assertEquals(response.status, 200);
    assertEquals(
      response.headers.get('content-disposition'),
      `attachment; filename="Fotos __.zip"; filename*=UTF-8''Fotos%20%E6%97%A5%E6%9C%AC.zip`,
    );
    assertEquals(new Uint8Array(await response.arrayBuffer()).slice(0, 2), new TextEncoder().encode('PK'));
  } finally {
    config.files = previousFilesConfig;
    config.core.enabledApps = previousApps;
    await Deno.remove(userRootPath, { recursive: true }).catch(() => {});
  }
});
