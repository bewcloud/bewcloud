import { assertEquals, assertRejects } from '@std/assert';

import { SupportedCurrencySymbol } from '/lib/types.ts';
import {
  convertFormDataToObject,
  convertObjectToFormData,
  escapeHtml,
  fetchUrl,
  fetchUrlWithProxy,
  formatInputToNumber,
  formatNumber,
  generateHash,
  generateRandomCode,
  isFetchableUrl,
  isRunningLocally,
  serializeForInlineScript,
  splitArrayInChunks,
  validateEmail,
  validateUrl,
} from './misc.ts';

Deno.test('that serializeForInlineScript escapes angle brackets', () => {
  const payload = { summary: 'foo</script><script>alert(1)</script>' };
  const serialized = serializeForInlineScript(payload);

  assertEquals(serialized.includes('</script>'), false);
  assertEquals(serialized.includes('\\u003c'), true);
  assertEquals(JSON.parse(serialized.replace(/\\u003c/g, '<')), payload);
});

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

Deno.test('that isRunningLocally works', () => {
  const tests: { url: string; expected: boolean }[] = [
    { url: 'http://localhost:8000', expected: true },
    { url: 'http://127.0.0.1:8000', expected: true },
    { url: 'http://0.0.0.0:8000', expected: true },
    { url: 'http://10.0.0.1:8000', expected: true },
    { url: 'http://172.16.0.1:8000', expected: true },
    { url: 'http://192.168.0.1:8000', expected: true },
    { url: 'http://example.com', expected: false },
    { url: 'http://68.18.161.245:8000', expected: false },
    { url: 'https://example.com', expected: false },
    { url: 'http://2000.10.5000.1111', expected: false },
    { url: 'http://192.168.0.1', expected: true },
  ];

  for (const test of tests) {
    const request = { url: test.url } as Request;
    const result = isRunningLocally(request);
    assertEquals(result, test.expected);
  }
});

Deno.test('that formatNumber works', () => {
  const tests: { currency: SupportedCurrencySymbol; number: number; expected: string }[] = [
    { currency: '$', number: 10000, expected: '$10,000' },
    { currency: '$', number: 10000.5, expected: '$10,000.5' },
    { currency: '€', number: 10000, expected: '€10,000' },
    { currency: '€', number: 900.999, expected: '€901' },
    { currency: '€', number: 900.991, expected: '€900.99' },
    { currency: '$', number: 50.11, expected: '$50.11' },
    { currency: '£', number: 900.999, expected: '£901' },
    { currency: '£', number: 900.991, expected: '£900.99' },
    { currency: '£', number: 50.11, expected: '£50.11' },
  ];

  for (const test of tests) {
    const result = formatNumber(test.currency, test.number);
    assertEquals(result, test.expected);
  }
});

Deno.test('that formatInputToNumber works', () => {
  const tests: { input: number | string; expected: number }[] = [
    { input: 42, expected: 42 },
    { input: '42', expected: 42 },
    { input: 42.5, expected: 42.5 },
    { input: '42.5', expected: 42.5 },
    { input: '42,5', expected: 42.5 },
    { input: '1234,56', expected: 1234.56 },
    { input: 0, expected: 0 },
    { input: '0', expected: 0 },
    { input: '0,0', expected: 0 },
    { input: '0.0', expected: 0 },
  ];

  for (const test of tests) {
    const result = formatInputToNumber(test.input);
    assertEquals(result, test.expected);
  }
});

Deno.test('that isFetchableUrl rejects URLs pointing inside the network', () => {
  const internalUrls = [
    'http://localhost:8000/feed.xml',
    'http://LOCALHOST./feed.xml',
    'http://api.localhost/feed.xml',
    'http://nextcloud.local/feed.xml',
    'http://db.internal/feed.xml',
    'http://radicale:5232/', // a container hostname from the default docker compose setup
    'http://127.0.0.1/feed.xml',
    'http://127.1/feed.xml', // the same address, short form
    'http://2130706433/feed.xml', // the same address, as a single number
    'http://0177.0.0.1/feed.xml', // the same address, octal
    'http://0.0.0.0/feed.xml',
    'http://10.1.2.3/feed.xml',
    'http://172.16.0.1/feed.xml',
    'http://192.168.1.1/feed.xml',
    'http://100.100.0.1/feed.xml',
    'http://198.18.0.1/feed.xml',
    'http://255.255.255.255/feed.xml',
    'http://169.254.169.254/latest/meta-data/iam/security-credentials/', // cloud metadata
    'http://[::1]/feed.xml',
    'http://[::ffff:127.0.0.1]/feed.xml', // IPv4-mapped loopback
    'http://[fd00::1]/feed.xml',
    'http://[fe80::1]/feed.xml',
    'file:///etc/passwd',
    'gopher://example.com/',
    'not a url',
    '',
  ];

  for (const url of internalUrls) {
    assertEquals(isFetchableUrl(url), false, `${url} should not be fetchable`);
  }
});

Deno.test('that isFetchableUrl accepts public feed URLs', () => {
  const publicUrls = [
    'https://example.com/feed.xml',
    'http://example.com/feed.xml',
    'https://blog.example.co.uk/rss?format=xml',
    'https://example.com./feed.xml',
    'https://93.184.216.34/feed.xml',
    'https://[2606:2800:220:1:248:1893:25c8:1946]/feed.xml',
  ];

  for (const url of publicUrls) {
    assertEquals(isFetchableUrl(url), true, `${url} should be fetchable`);
  }
});

function stubFetch(handler: (url: string) => Response) {
  const originalFetch = globalThis.fetch;
  const requestedUrls: string[] = [];

  globalThis.fetch = (input: string | URL | Request, _init?: RequestInit) => {
    const url = input instanceof Request ? input.url : input.toString();
    requestedUrls.push(url);
    return Promise.resolve(handler(url));
  };

  return {
    requestedUrls,
    restore: () => {
      globalThis.fetch = originalFetch;
    },
  };
}

Deno.test('that fetchUrl does not request an internal URL at all', async () => {
  const fetchStub = stubFetch(() => new Response('secret', { status: 200 }));

  try {
    await assertRejects(
      () => fetchUrl('http://169.254.169.254/latest/meta-data/'),
      Error,
      'Refusing to fetch non-public URL',
    );

    assertEquals(fetchStub.requestedUrls, []);
  } finally {
    fetchStub.restore();
  }
});

Deno.test('that fetchUrl refuses a redirect that lands inside the network', async () => {
  const fetchStub = stubFetch((url) =>
    url === 'https://example.com/feed.xml'
      ? new Response(null, { status: 302, headers: { location: 'http://169.254.169.254/latest/meta-data/' } })
      : new Response('secret', { status: 200 })
  );

  try {
    await assertRejects(
      () => fetchUrl('https://example.com/feed.xml'),
      Error,
      'Refusing to fetch non-public URL',
    );

    assertEquals(fetchStub.requestedUrls, ['https://example.com/feed.xml']);
  } finally {
    fetchStub.restore();
  }
});

Deno.test('that fetchUrl still follows a redirect to another public URL', async () => {
  const fetchStub = stubFetch((url) =>
    url === 'https://example.com/feed'
      ? new Response(null, { status: 301, headers: { location: '/feed.xml' } })
      : new Response('<rss />', { status: 200 })
  );

  try {
    assertEquals(await fetchUrl('https://example.com/feed'), '<rss />');
    assertEquals(fetchStub.requestedUrls, ['https://example.com/feed', 'https://example.com/feed.xml']);
  } finally {
    fetchStub.restore();
  }
});

Deno.test('that fetchUrl only follows redirect statuses, not every 3xx with a location', async () => {
  const fetchStub = stubFetch(() =>
    new Response('<rss />', { status: 300, headers: { location: 'http://169.254.169.254/latest/meta-data/' } })
  );

  try {
    assertEquals(await fetchUrl('https://example.com/feed.xml'), '<rss />');
    assertEquals(fetchStub.requestedUrls, ['https://example.com/feed.xml']);
  } finally {
    fetchStub.restore();
  }
});

Deno.test('that fetchUrlWithProxy checks and encodes the URL it tunnels', async () => {
  const internalFetchStub = stubFetch(() => new Response('secret', { status: 200 }));

  try {
    await assertRejects(
      () => fetchUrlWithProxy('http://10.0.0.1/feed.xml'),
      Error,
      'Refusing to fetch non-public URL',
    );

    assertEquals(internalFetchStub.requestedUrls, []);
  } finally {
    internalFetchStub.restore();
  }

  const publicFetchStub = stubFetch(() => new Response('<rss />', { status: 200 }));

  try {
    assertEquals(await fetchUrlWithProxy('https://example.com/feed.xml?a=1&b=2'), '<rss />');
    assertEquals(publicFetchStub.requestedUrls, [
      'https://api.allorigins.win/raw?url=https%3A%2F%2Fexample.com%2Ffeed.xml%3Fa%3D1%26b%3D2',
    ]);
  } finally {
    publicFetchStub.restore();
  }
});
