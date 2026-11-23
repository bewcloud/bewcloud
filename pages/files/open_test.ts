import { assertEquals } from '@std/assert';
import { join } from '@std/path';

import { AppConfig } from '/lib/config.ts';
import { User } from '/lib/types.ts';
import { Page } from '/lib/page.ts';

import openFilePage from './open/[fileName].ts';
import photoThumbnailPage from '../photos/thumbnail/[fileName].ts';

function createMockUser(userId: string): User {
  return {
    id: userId,
    email: `${userId}@example.com`,
    hashed_password: '',
    subscription: { external: {}, expires_at: '', updated_at: '' },
    status: 'active',
    extra: { is_email_verified: true },
    created_at: new Date(),
  };
}

async function openFile(page: Page, user: User, fileName: string, query = ''): Promise<Response> {
  const request = new Request(`http://localhost:8000/open/${fileName}?path=%2F${query}`);
  const match = { pathname: { groups: { fileName } } } as unknown as URLPatternResult;

  return await page.get!({ request, match, user, isRunningLocally: true });
}

Deno.test('that opened files and SVG thumbnails download active content instead of rendering it', async () => {
  const userId = crypto.randomUUID();
  const userRoot = join(await AppConfig.getFilesRootPath(), userId);
  const user = createMockUser(userId);

  try {
    await Deno.mkdir(userRoot, { recursive: true });
    await Deno.writeTextFile(join(userRoot, 'page.html'), '<script>alert(1)</script>');
    await Deno.writeTextFile(
      join(userRoot, 'image.svg'),
      '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>',
    );

    const responses = [
      await openFile(openFilePage, user, 'page.html'),
      await openFile(photoThumbnailPage, user, 'image.svg', '&width=100&height=100'),
    ];

    for (const response of responses) {
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
