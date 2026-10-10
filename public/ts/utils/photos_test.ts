import { assertEquals } from '@std/assert';

import { isPhotoFile } from './photos.ts';

Deno.test('that isPhotoFile accepts images and videos by MIME type', () => {
  assertEquals(isPhotoFile(new File([], 'photo', { type: 'image/jpeg' })), true);
  assertEquals(isPhotoFile(new File([], 'clip', { type: 'video/mp4' })), true);
});

Deno.test('that isPhotoFile falls back to the extension when the MIME type is empty or generic', () => {
  assertEquals(isPhotoFile(new File([], 'IMG_0001.HEIC')), true);
  assertEquals(isPhotoFile(new File([], 'IMG_0001.heic', { type: 'application/octet-stream' })), true);
});

Deno.test('that isPhotoFile rejects anything else', () => {
  assertEquals(isPhotoFile(new File([], 'notes.txt', { type: 'text/plain' })), false);
  assertEquals(isPhotoFile(new File([], 'archive.zip', { type: 'application/octet-stream' })), false);
});
