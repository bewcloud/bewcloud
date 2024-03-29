import { assertEquals } from 'std/assert/assert_equals.ts';
import {
  convertFormDataToObject,
  convertObjectToDavXml,
  convertObjectToFormData,
  escapeHtml,
  generateHash,
  generateRandomCode,
  splitArrayInChunks,
  validateEmail,
  validateUrl,
} from './misc.ts';

Deno.test('that escapeHtml works', () => {
  const tests: { input: string; expected: string }[] = [
    {
      input: '<a href="https://brunobernardino.com">URL</a>',
      expected: '&lt;a href=&quot;https://brunobernardino.com&quot;&gt;URL&lt;/a&gt;',
    },
    {
      input: "\"><img onerror='alert(1)' />",
      expected: '&quot;&gt;&lt;img onerror=&#039;alert(1)&#039; /&gt;',
    },
  ];

  for (const test of tests) {
    const output = escapeHtml(test.input);
    assertEquals(output, test.expected);
  }
});

Deno.test('that generateRandomCode works', () => {
  const tests: { length: number }[] = [
    {
      length: 6,
    },
    {
      length: 7,
    },
    {
      length: 8,
    },
  ];

  for (const test of tests) {
    const output = generateRandomCode(test.length);
    assertEquals(output.length, test.length);
  }
});

Deno.test('that splitArrayInChunks works', () => {
  const tests: { input: { array: { number: number }[]; chunkLength: number }; expected: { number: number }[][] }[] = [
    {
      input: {
        array: [
          { number: 1 },
          { number: 2 },
          { number: 3 },
          { number: 4 },
          { number: 5 },
          { number: 6 },
        ],
        chunkLength: 2,
      },
      expected: [
        [{ number: 1 }, { number: 2 }],
        [{ number: 3 }, { number: 4 }],
        [{ number: 5 }, { number: 6 }],
      ],
    },
    {
      input: {
        array: [
          { number: 1 },
          { number: 2 },
          { number: 3 },
          { number: 4 },
          { number: 5 },
        ],
        chunkLength: 2,
      },
      expected: [
        [{ number: 1 }, { number: 2 }],
        [{ number: 3 }, { number: 4 }],
        [{ number: 5 }],
      ],
    },
    {
      input: {
        array: [
          { number: 1 },
          { number: 2 },
          { number: 3 },
          { number: 4 },
          { number: 5 },
          { number: 6 },
        ],
        chunkLength: 3,
      },
      expected: [
        [{ number: 1 }, { number: 2 }, { number: 3 }],
        [{ number: 4 }, { number: 5 }, { number: 6 }],
      ],
    },
  ];

  for (const test of tests) {
    const output = splitArrayInChunks(
      test.input.array,
      test.input.chunkLength,
    );
    assertEquals(output, test.expected);
  }
});

Deno.test('that generateHash works', async () => {
  const tests: { input: { value: string; algorithm: string }; expected: string }[] = [
    {
      input: {
        value: 'password',
        algorithm: 'SHA-256',
      },
      expected: '5e884898da28047151d0e56f8dc6292773603d0d6aabbdd62a11ef721d1542d8',
    },
    {
      input: {
        value: '123456',
        algorithm: 'SHA-256',
      },
      expected: '8d969eef6ecad3c29a3a629280e686cf0c3f5d5a86aff3ca12020c923adc6c92',
    },
  ];

  for (const test of tests) {
    const output = await generateHash(test.input.value, test.input.algorithm);
    assertEquals(output, test.expected);
  }
});

Deno.test('that validateEmail works', () => {
  const tests: { email: string; expected: boolean }[] = [
    { email: 'user@example.com', expected: true },
    { email: 'u@e.c', expected: true },
    { email: 'user@example.', expected: false },
    { email: '@example.com', expected: false },
    { email: 'user@example.', expected: false },
    { email: 'ABC', expected: false },
  ];

  for (const test of tests) {
    const result = validateEmail(test.email);
    assertEquals(result, test.expected);
  }
});

Deno.test('that validateUrl works', () => {
  const tests: { url: string; expected: boolean }[] = [
    { url: 'https://bewcloud.com', expected: true },
    { url: 'ftp://something', expected: true },
    { url: 'http', expected: false },
    { url: 'https://', expected: false },
    { url: 'http://a', expected: true },
    { url: 'ABC', expected: false },
  ];

  for (const test of tests) {
    const result = validateUrl(test.url);
    assertEquals(result, test.expected);
  }
});

Deno.test('that convertFormDataToObject works', () => {
  const formData1 = new FormData();
  formData1.append('user', '1');
  formData1.append('is_real', 'false');
  formData1.append('tags', 'one');
  formData1.append('tags', 'two');

  const formData2 = new FormData();
  formData2.append('user', '2');
  formData2.append('is_real', 'true');
  formData2.append('tags', 'one');
  formData2.append('empty', '');

  const tests: { input: FormData; expected: Record<string, any> }[] = [
    {
      input: formData1,
      expected: {
        user: '1',
        is_real: 'false',
        // tags: ['one', 'two'],
        tags: 'two', // NOTE: This is a limitation of the simple logic, but it should ideally be the array above
      },
    },
    {
      input: formData2,
      expected: {
        user: '2',
        is_real: 'true',
        tags: 'one',
        empty: '',
      },
    },
  ];

  for (const test of tests) {
    const output = convertFormDataToObject(test.input);
    assertEquals(output, test.expected);
  }
});

Deno.test('that convertObjectToFormData works', () => {
  const formData1 = new FormData();
  formData1.append('user', '1');
  formData1.append('is_real', 'false');
  formData1.append('tags', 'one');
  // formData1.append('tags', 'two');// NOTE: This is a limitation of the simple logic, but it should ideally be an array below

  const formData2 = new FormData();
  formData2.append('user', '2');
  formData2.append('is_real', 'true');
  formData2.append('tags', 'one');
  formData2.append('empty', '');

  const tests: { input: Record<string, any>; expected: FormData }[] = [
    {
      input: {
        user: '1',
        is_real: 'false',
        tags: 'one',
      },
      expected: formData1,
    },
    {
      input: {
        user: '2',
        is_real: 'true',
        tags: 'one',
        empty: '',
      },
      expected: formData2,
    },
  ];

  for (const test of tests) {
    const output = convertObjectToFormData(test.input);
    assertEquals(convertFormDataToObject(output), convertFormDataToObject(test.expected));
  }
});

Deno.test('that convertObjectToDavXml works', () => {
  const tests: { input: Record<string, any>; expected: string }[] = [
    {
      input: {
        url: 'https://bewcloud.com',
      },
      expected: `<url>https://bewcloud.com</url>`,
    },
    {
      input: {
        a: 'Website',
        a_attributes: {
          href: 'https://bewcloud.com',
          target: '_blank',
        },
      },
      expected: `<a href="https://bewcloud.com" target="_blank">Website</a>`,
    },
    {
      input: {
        article: {
          p: [
            {
              strong: 'Indeed',
            },
            {
              i: {},
            },
            'Mighty!',
          ],
        },
        article_attributes: {
          class: 'center',
        },
      },
      expected: `<article class="center"><p><strong>Indeed</strong></p>\n<p><i /></p>\n<p>Mighty!</p></article>`,
    },
  ];

  for (const test of tests) {
    const result = convertObjectToDavXml(test.input);
    assertEquals(result, test.expected);
  }
});
