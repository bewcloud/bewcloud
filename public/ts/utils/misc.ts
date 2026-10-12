import { SupportedCurrency, SupportedCurrencySymbol } from '/lib/types.ts';

// This allows us to have nice html syntax highlighting in template literals
export const html = String.raw;

export function isRunningLocally(request: Request): boolean {
  try {
    const url = new URL(request.url);
    const hostname = url.hostname;

    // Local hostnames check
    if (['localhost', '127.0.0.1', '0.0.0.0'].includes(hostname)) {
      return true;
    }

    // Private IP ranges check
    const ipParts = hostname.split('.').map(Number);

    // Check if the IP address is valid
    if (ipParts.length !== 4 || ipParts.some((part) => isNaN(part) || part < 0 || part > 255)) {
      return false;
    }

    // 10.0.0.0 - 10.255.255.255
    if (ipParts[0] === 10) {
      return true;
    }

    // 172.16.0.0 - 172.31.255.255
    if (ipParts[0] === 172 && ipParts[1] >= 16 && ipParts[1] <= 31) {
      return true;
    }

    // 192.168.0.0 - 192.168.255.255
    if (ipParts[0] === 192 && ipParts[1] === 168) {
      return true;
    }

    return false;
  } catch (error) {
    console.info('Failed to check if the request is running locally', error);
    return false;
  }
}

export function escapeHtml(unsafe: string) {
  return unsafe.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

export function escapeXml(unsafe: string) {
  return escapeHtml(unsafe).replaceAll('\r', '&#13;');
}

export function serializeForInlineScript(value: unknown): string {
  return JSON.stringify(value).replace(/</g, '\\u003c');
}

export function generateRandomCode(length = 6) {
  const getRandomDigit = () => Math.floor(Math.random() * (10)); // 0-9

  const codeDigits = Array.from({ length }).map(getRandomDigit);

  return codeDigits.join('');
}

/** This generates a random string, including unicode characters. */
export function generateRandomString(length = 10) {
  const array = new Uint8Array(length * 2);
  crypto.getRandomValues(array);

  return Array.from(array)
    .map((byte) => String.fromCharCode(byte))
    .join('')
    .slice(0, length);
}

export async function generateHash(value: string, algorithm: AlgorithmIdentifier) {
  const hashedValueData = await crypto.subtle.digest(
    algorithm,
    new TextEncoder().encode(value),
  );

  const hashedValue = Array.from(new Uint8Array(hashedValueData)).map(
    (byte) => byte.toString(16).padStart(2, '0'),
  ).join('');

  return hashedValue;
}

export function splitArrayInChunks<T = any>(array: T[], chunkLength: number) {
  const chunks = [];
  let chunkIndex = 0;
  const arrayLength = array.length;

  while (chunkIndex < arrayLength) {
    chunks.push(array.slice(chunkIndex, chunkIndex += chunkLength));
  }

  return chunks;
}

export function validateEmail(email: string) {
  const trimmedEmail = (email || '').trim().toLocaleLowerCase();
  if (!trimmedEmail) {
    return false;
  }

  const requiredCharsNotInEdges = ['@', '.'];
  return requiredCharsNotInEdges.every((char) =>
    trimmedEmail.includes(char) && !trimmedEmail.startsWith(char) && !trimmedEmail.endsWith(char)
  );
}

export function validateUrl(url: string) {
  const trimmedUrl = (url || '').trim().toLocaleLowerCase();
  if (!trimmedUrl) {
    return false;
  }

  if (!trimmedUrl.includes('://')) {
    return false;
  }

  const protocolIndex = trimmedUrl.indexOf('://');
  const urlAfterProtocol = trimmedUrl.substring(protocolIndex + 3);

  if (!urlAfterProtocol) {
    return false;
  }

  return true;
}

// Adapted from https://gist.github.com/fasiha/7f20043a12ce93401d8473aee037d90a
export async function concurrentPromises<T>(
  generators: (() => Promise<T>)[],
  maxConcurrency: number,
): Promise<T[]> {
  const iterator = generators.entries();

  const results: T[] = [];

  let hasFailed = false;

  await Promise.all(
    Array.from(Array(maxConcurrency), async () => {
      for (const [index, promiseToExecute] of iterator) {
        if (hasFailed) {
          break;
        }
        try {
          results[index] = await promiseToExecute();
        } catch (error) {
          hasFailed = true;
          throw error;
        }
      }
    }),
  );

  return results;
}

const MAX_RESPONSE_TIME_IN_MS = 10_000;
const MAX_FETCH_REDIRECTS = 5;
const FETCHABLE_PROTOCOLS = ['http:', 'https:'];
const INTERNAL_HOSTNAME_SUFFIXES = ['.localhost', '.local', '.internal', '.home.arpa'];

function parseIpv4(hostname: string): number[] | null {
  const parts = hostname.split('.');

  if (parts.length !== 4) {
    return null;
  }

  const numbers = parts.map((part) => /^\d{1,3}$/.test(part) ? Number(part) : NaN);

  if (numbers.some((number) => isNaN(number) || number > 255)) {
    return null;
  }

  return numbers;
}

/** Parses the bracketed, hexadecimal form `new URL()` normalizes IPv6 hostnames into. */
function parseIpv6(hostname: string): number[] | null {
  if (!hostname.startsWith('[') || !hostname.endsWith(']')) {
    return null;
  }

  const halves = hostname.slice(1, -1).split('::');

  if (halves.length > 2) {
    return null;
  }

  const start = halves[0] ? halves[0].split(':') : [];
  const end = halves[1] ? halves[1].split(':') : [];
  const omitted = halves.length === 2 ? 8 - start.length - end.length : 0;

  if (omitted < 0) {
    return null;
  }

  const groups = [...start, ...Array.from({ length: omitted }).map(() => '0'), ...end]
    .map((group) => /^[0-9a-f]{1,4}$/.test(group) ? parseInt(group, 16) : NaN);

  if (groups.length !== 8 || groups.some((group) => isNaN(group))) {
    return null;
  }

  return groups;
}

function isInternalIpv4([first, second, third]: number[]): boolean {
  return first === 0 || // 0.0.0.0/8, "this network"
    first === 10 || // private
    first === 127 || // loopback
    (first === 100 && second >= 64 && second <= 127) || // carrier-grade NAT
    (first === 169 && second === 254) || // link-local, which includes the cloud metadata address
    (first === 172 && second >= 16 && second <= 31) || // private
    (first === 192 && second === 0 && third === 0) || // IETF protocol assignments
    (first === 192 && second === 168) || // private
    (first === 198 && (second === 18 || second === 19)) || // benchmarking
    first >= 224; // multicast, reserved and the broadcast address
}

function isInternalIpv6(groups: number[]): boolean {
  if (groups.every((group) => group === 0)) { // the unspecified address, ::
    return true;
  }

  if (groups.slice(0, 7).every((group) => group === 0) && groups[7] === 1) { // loopback, ::1
    return true;
  }

  if ((groups[0] & 0xfe00) === 0xfc00) { // unique local, fc00::/7
    return true;
  }

  if ((groups[0] & 0xffc0) === 0xfe80) { // link-local, fe80::/10
    return true;
  }

  if (groups.slice(0, 5).every((group) => group === 0) && groups[5] === 0xffff) { // IPv4-mapped
    return isInternalIpv4([groups[6] >> 8, groups[6] & 0xff, groups[7] >> 8, groups[7] & 0xff]);
  }

  return false;
}

export function isInternalHostname(hostname: string): boolean {
  const normalizedHostname = hostname.toLocaleLowerCase().replace(/\.+$/, '');

  if (!normalizedHostname) {
    return true;
  }

  const ipv6 = parseIpv6(normalizedHostname);

  if (ipv6) {
    return isInternalIpv6(ipv6);
  }

  const ipv4 = parseIpv4(normalizedHostname);

  if (ipv4) {
    return isInternalIpv4(ipv4);
  }

  if (
    normalizedHostname === 'localhost' ||
    INTERNAL_HOSTNAME_SUFFIXES.some((suffix) => normalizedHostname.endsWith(suffix))
  ) {
    return true;
  }

  // A single-label name only resolves inside the network, which is how container hostnames
  // like `radicale` in the default docker compose setup are reached.
  return !normalizedHostname.includes('.');
}

/**
 * Whether the server may fetch this URL on a user's behalf. Feed and preview URLs come
 * straight from the user, so without this the server reaches loopback, private, link-local
 * and container addresses for them.
 *
 * This checks the URL itself: a public hostname that resolves to a private address still
 * gets through.
 */
export function isFetchableUrl(url: string): boolean {
  try {
    const parsedUrl = new URL(url);

    if (!FETCHABLE_PROTOCOLS.includes(parsedUrl.protocol)) {
      return false;
    }

    return !isInternalHostname(parsedUrl.hostname);
  } catch (_error) {
    return false;
  }
}

/**
 * Fetches a user-supplied URL, checking every hop. Redirects are followed manually because
 * `fetch` would otherwise follow them for us, and a public URL is free to redirect to an
 * internal one.
 */
async function fetchFetchableUrl(url: string, requestInit: RequestInit = {}): Promise<Response> {
  let currentUrl = url;

  for (let redirectCount = 0; redirectCount <= MAX_FETCH_REDIRECTS; redirectCount++) {
    if (!isFetchableUrl(currentUrl)) {
      throw new Error(`Refusing to fetch non-public URL: ${currentUrl}`);
    }

    const response = await fetch(currentUrl, { ...requestInit, redirect: 'manual' });

    const location = response.headers.get('location');

    if (!(response.status >= 300 && response.status <= 399) || !location) {
      return response;
    }

    await response.body?.cancel();

    currentUrl = new URL(location, currentUrl).toString();
  }

  throw new Error(`Too many redirects when fetching: ${url}`);
}

async function fetchUrlContents(url: string, requestInit: RequestInit = {}) {
  const abortController = new AbortController();
  const requestCancelTimeout = setTimeout(() => {
    abortController.abort();
  }, MAX_RESPONSE_TIME_IN_MS);

  try {
    const response = await fetchFetchableUrl(url, { ...requestInit, signal: abortController.signal });

    const urlContents = await response.text();
    return urlContents;
  } finally {
    if (requestCancelTimeout) {
      clearTimeout(requestCancelTimeout);
    }
  }
}

export async function fetchUrl(url: string) {
  return await fetchUrlContents(url);
}

export async function fetchUrlAsGooglebot(url: string) {
  return await fetchUrlContents(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
    },
  });
}

export async function fetchUrlWithProxy(url: string) {
  if (!isFetchableUrl(url)) {
    throw new Error(`Refusing to fetch non-public URL: ${url}`);
  }

  return await fetchUrlContents(`https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`);
}

export async function fetchUrlWithRetries(url: string) {
  try {
    const text = await fetchUrl(url);
    return text;
  } catch (_error) {
    try {
      const text = await fetchUrlAsGooglebot(url);
      return text;
    } catch (_error) {
      const text = await fetchUrlWithProxy(url);
      return text;
    }
  }
}

export function convertFormDataToObject(formData: FormData): Record<string, any> {
  return JSON.parse(JSON.stringify(Object.fromEntries(formData)));
}

export function convertObjectToFormData(formDataObject: Record<string, any>): FormData {
  const formData = new FormData();

  for (const key of Object.keys(formDataObject || {})) {
    if (Array.isArray(formDataObject[key])) {
      formData.append(key, formDataObject[key].join(','));
    } else {
      formData.append(key, formDataObject[key]);
    }
  }

  return formData;
}

export const capitalizeWord = (string: string) => {
  return `${string.charAt(0).toLocaleUpperCase()}${string.slice(1)}`;
};

export function getRandomItem<T>(items: Readonly<Array<T>>): T {
  return items[Math.floor(Math.random() * items.length)];
}

export const currencyMap = new Map<SupportedCurrencySymbol, SupportedCurrency>([
  ['$', 'USD'],
  ['€', 'EUR'],
  ['£', 'GBP'],
  ['¥', 'JPY'],
  ['₹', 'INR'],
]);

export function formatNumber(currency: SupportedCurrencySymbol, number: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currencyMap.get(currency) || 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(Number.parseFloat(`${number}`.replace(',', '.')));
}

export function formatInputToNumber(numberInput: number | string): number {
  return Number.parseFloat(`${numberInput}`.replace(',', '.'));
}
