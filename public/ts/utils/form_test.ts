import { assertEquals } from '@std/assert';

import { generateFieldHtml } from './form.ts';

Deno.test('that generateFieldHtml escapes select option labels and values', () => {
  const fieldHtml = generateFieldHtml({
    name: 'calendarId',
    label: 'Calendar',
    type: 'select',
    value: 'personal',
    options: [
      { label: '<img src=x onerror=alert(1)>', value: 'personal' },
      { label: 'Work', value: '"><img src=x onerror=alert(2)>' },
    ],
  }, new FormData());

  assertEquals(fieldHtml.includes('<img'), false);
  assertEquals(fieldHtml.includes('&lt;img src=x onerror=alert(1)&gt;'), true);
  assertEquals(fieldHtml.includes('value="&quot;&gt;&lt;img src=x onerror=alert(2)&gt;"'), true);
});
