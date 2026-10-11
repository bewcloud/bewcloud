import { assertEquals } from '@std/assert';

import { getSafeRedirectUrl } from './redirect.ts';

Deno.test('that getSafeRedirectUrl only allows same-origin paths', () => {
  const tests: { input: string | null | undefined; expected: string }[] = [
    { input: '/files', expected: '/files' },
    { input: '/files?sort=name', expected: '/files?sort=name' },
    { input: '/files?sort=name#top', expected: '/files?sort=name#top' },
    { input: '/', expected: '/' },
    { input: '/foo//bar', expected: '/foo//bar' },
    { input: null, expected: '/' },
    { input: undefined, expected: '/' },
    { input: '', expected: '/' },
    { input: 'files', expected: '/' },
    { input: 'https://evil.example/', expected: '/' },
    { input: '//evil.example', expected: '/' },
    { input: '///evil.example', expected: '/' },
    { input: '/\\evil.example', expected: '/' },
    { input: 'https://localhost:8000@evil.example/', expected: '/' },
    { input: 'javascript:alert(1)', expected: '/' },
    { input: '/files\r\nLocation: https://evil.example', expected: '/' },
    { input: '/\tevil.example', expected: '/' },
  ];

  for (const test of tests) {
    assertEquals(getSafeRedirectUrl(test.input), test.expected, String(test.input));
  }
});
