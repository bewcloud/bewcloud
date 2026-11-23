import { assertEquals, assertNotEquals } from '@std/assert';

import routes from './routes.ts';

// Regression tests for #32: /dav/ URLs used to 307-redirect on a trailing slash (a Fresh leftover).

Deno.test('that /dav routes match both with and without a trailing slash, and to the same filePath', () => {
  const withoutSlash = routes.dav.pattern.exec('http://localhost:8000/dav/litmus');
  const withSlash = routes.dav.pattern.exec('http://localhost:8000/dav/litmus/');

  assertNotEquals(withoutSlash, null);
  assertNotEquals(withSlash, null);
  assertEquals(withoutSlash!.pathname.groups.filePath, 'litmus');
  assertEquals(withSlash!.pathname.groups.filePath, 'litmus');
});

Deno.test('that MKCOL on /dav/litmus and /dav/litmus/ are both handled directly (no redirect)', async () => {
  for (const url of ['http://localhost:8000/dav/litmus', 'http://localhost:8000/dav/litmus/']) {
    const match = routes.dav.pattern.exec(url)!;
    const request = new Request(url, { method: 'MKCOL' });

    const response = await routes.dav.handler(request, match);

    // No redirect: reached dav.ts's handler directly, which returns 401 without credentials.
    assertEquals(response.headers.get('location'), null);
    assertEquals(response.status, 401);
  }
});

Deno.test('that PROPFIND on /dav/litmus and /dav/litmus/ are both handled directly (no redirect)', async () => {
  for (const url of ['http://localhost:8000/dav/litmus', 'http://localhost:8000/dav/litmus/']) {
    const match = routes.dav.pattern.exec(url)!;
    const request = new Request(url, { method: 'PROPFIND' });

    const response = await routes.dav.handler(request, match);

    assertEquals(response.headers.get('location'), null);
    assertEquals(response.status, 401);
  }
});

Deno.test('that PROPFIND on /dav (no filePath) and /dav/ are both handled directly (no redirect)', async () => {
  for (const url of ['http://localhost:8000/dav', 'http://localhost:8000/dav/']) {
    const match = routes.dav.pattern.exec(url)!;
    const request = new Request(url, { method: 'PROPFIND' });

    const response = await routes.dav.handler(request, match);

    assertEquals(response.headers.get('location'), null);
    assertEquals(response.status, 401);
  }
});

Deno.test('that stale /public/scss/*.scss requests are served as the css file', async () => {
  const url = 'http://localhost:8000/public/scss/style.scss';
  const match = routes.public.pattern.exec(url)!;
  const response = await routes.public.handler(new Request(url), match);

  assertEquals(response.status, 200);
  assertEquals(response.headers.get('content-type')?.includes('text/css'), true);
});

Deno.test('that app code under /public is always revalidated', async () => {
  for (const path of ['ts/utils/form.ts', 'components/Loading.js']) {
    const url = `http://localhost:8000/public/${path}`;
    const match = routes.public.pattern.exec(url)!;
    const response = await routes.public.handler(new Request(url), match);

    assertEquals(response.status, 200, path);
    assertEquals(response.headers.get('cache-control'), 'no-cache', path);
    assertEquals(Boolean(response.headers.get('etag')), true, path);
    await response.body?.cancel();
  }

  const imageUrl = 'http://localhost:8000/public/images/favicon-dark.png';
  const imageResponse = await routes.public.handler(new Request(imageUrl), routes.public.pattern.exec(imageUrl)!);

  assertEquals(imageResponse.headers.get('cache-control'), `max-age=${24 * 60 * 60}, public`);
  await imageResponse.body?.cancel();
});
