import { assertEquals } from '@std/assert';

import { getContentDispositionHeader, getUserFileResponseHeaders } from './misc.ts';

Deno.test('that getContentDispositionHeader safely encodes file names', () => {
  assertEquals(
    getContentDispositionHeader('attachment', 'a "quoted"\\name.txt'),
    `attachment; filename="a _quoted__name.txt"; filename*=UTF-8''a%20%22quoted%22%5Cname.txt`,
  );
  assertEquals(
    getContentDispositionHeader('inline', 'Família (1).png'),
    `inline; filename="Fam_lia (1).png"; filename*=UTF-8''Fam%C3%ADlia%20%281%29.png`,
  );
});

Deno.test('that getUserFileResponseHeaders never lets active content render inline', () => {
  const activeContentTypes = [
    'text/html',
    'text/html; charset=utf-8',
    'application/xhtml+xml',
    'image/svg+xml',
    'text/xml',
    'application/xml',
    'application/xslt+xml',
    'application/octet-stream',
  ];

  for (const contentType of activeContentTypes) {
    const headers = getUserFileResponseHeaders({ contentType, byteSize: 1, fileName: 'file' });

    assertEquals(headers['content-disposition'].startsWith('attachment;'), true, contentType);
    assertEquals(headers['x-content-type-options'], 'nosniff');
    assertEquals(headers['content-security-policy'].includes('sandbox'), true, contentType);
  }

  const inlineContentTypes = ['image/png', 'image/jpeg', 'video/mp4', 'audio/mpeg', 'text/plain', 'application/json'];

  for (const contentType of inlineContentTypes) {
    const headers = getUserFileResponseHeaders({ contentType, byteSize: 1, fileName: 'file' });

    assertEquals(headers['content-disposition'].startsWith('inline;'), true, contentType);
    assertEquals(headers['content-type'], contentType);
    assertEquals(headers['content-security-policy'].includes('sandbox'), true, contentType);
  }

  const pdfHeaders = getUserFileResponseHeaders({ contentType: 'application/pdf', byteSize: 1, fileName: 'file.pdf' });

  assertEquals(pdfHeaders['content-disposition'].startsWith('inline;'), true);
  assertEquals(pdfHeaders['content-security-policy'], undefined);
});
