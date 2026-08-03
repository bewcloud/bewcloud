import { assertEquals, assertNotEquals } from '@std/assert';

import { generateUploadSessionTag } from './auth.ts';

Deno.test('that generateUploadSessionTag works', async () => {
  const tag = await generateUploadSessionTag('cf8b3a5e-0e6e-4a9a-9a1e-1f4c0d8b1a11');

  assertEquals(tag, await generateUploadSessionTag('cf8b3a5e-0e6e-4a9a-9a1e-1f4c0d8b1a11'));

  // A queue tagged by another session must not match, otherwise leftover uploads would be accepted under the session that's logged in now
  assertNotEquals(tag, await generateUploadSessionTag('0b2d4f6a-1c3e-4b5d-8e7f-2a9c0b1d3e42'));

  // The raw session id never leaves the server
  assertNotEquals(tag, 'cf8b3a5e-0e6e-4a9a-9a1e-1f4c0d8b1a11');

  // Requests without a session (WebDAV/basic auth) get an empty tag, which the upload endpoints skip checking
  assertEquals(await generateUploadSessionTag(), '');
  assertEquals(await generateUploadSessionTag(''), '');
});
