import { assertEquals } from '@std/assert';

import { parseTextFromHtml } from './feed.ts';

Deno.test('parseTextFromHtml strips script tags and returns plain text', async () => {
  const html =
    '<p>Last night I received an email</p><script src="https://example.com/embed.js" defer></script><div class="vote"></div><script src="https://example.com/vote.js" defer></script>';

  const result = await parseTextFromHtml(html);

  assertEquals(result, 'Last night I received an email');
  assertEquals(/<[a-z]/i.test(result), false);
});

Deno.test('parseTextFromHtml strips style and iframe elements', async () => {
  const html =
    '<p>Hello</p><style>body { display: none; }</style><iframe src="https://evil.example"></iframe><p>World</p>';

  const result = await parseTextFromHtml(html);

  assertEquals(result, 'HelloWorld');
});

Deno.test('parseTextFromHtml preserves single line breaks and collapses excess whitespace', async () => {
  const html = '<p>Line one</p>\n<p>Line two</p>\n\n\n<p>Line three</p>';

  const result = await parseTextFromHtml(html);

  assertEquals(result, 'Line one\nLine two\n\nLine three');
});

Deno.test('parseTextFromHtml returns empty string for empty input', async () => {
  assertEquals(await parseTextFromHtml(''), '');
  assertEquals(await parseTextFromHtml('   '), '');
});
