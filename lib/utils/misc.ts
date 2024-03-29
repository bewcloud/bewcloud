let BASE_URL = typeof window !== 'undefined' && window.location
  ? `${window.location.protocol}//${window.location.host}`
  : '';

if (typeof Deno !== 'undefined') {
  await import('std/dotenv/load.ts');

  BASE_URL = Deno.env.get('BASE_URL') || '';
}

export const baseUrl = BASE_URL || 'http://localhost:8000';
export const defaultTitle = 'bewCloud is a modern and simpler alternative to Nextcloud and ownCloud';
export const defaultDescription = `Have your calendar, contacts, tasks, and files under your own control.`;
export const helpEmail = 'help@bewcloud.com';

export const DAV_RESPONSE_HEADER = '1, 2, 3, 4, addressbook, calendar-access';
// Response headers from Nextcloud:
// 1, 3, extended-mkcol, access-control, calendarserver-principal-property-search, oc-resource-sharing, addressbook, nextcloud-checksum-update, nc-calendar-search, nc-enable-birthday-calendar
// 1, 3, extended-mkcol, access-control, calendarserver-principal-property-search, calendar-access, calendar-proxy, calendar-auto-schedule, calendar-availability, nc-calendar-trashbin, nc-calendar-webcal-cache, calendarserver-subscribed, oc-resource-sharing, oc-calendar-publishing, calendarserver-sharing, addressbook, nextcloud-checksum-update, nc-calendar-search, nc-enable-birthday-calendar
// 1, 3, extended-mkcol, access-control, calendarserver-principal-property-search, calendar-access, calendar-proxy, calendar-auto-schedule, calendar-availability, nc-calendar-trashbin, nc-calendar-webcal-cache, calendarserver-subscribed, oc-resource-sharing, oc-calendar-publishing, calendarserver-sharing, nextcloud-checksum-update, nc-calendar-search, nc-enable-birthday-calendar

export function isRunningLocally(request: Request) {
  return request.url.includes('localhost');
}

export function escapeHtml(unsafe: string) {
  return unsafe.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

export function escapeXml(unsafe: string) {
  return escapeHtml(unsafe).replaceAll('\r', '&#13;');
}

export function generateRandomCode(length = 6) {
  const getRandomDigit = () => Math.floor(Math.random() * (10)); // 0-9

  const codeDigits = Array.from({ length }).map(getRandomDigit);

  return codeDigits.join('');
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

const MAX_RESPONSE_TIME_IN_MS = 10 * 1000;

export async function fetchUrl(url: string) {
  const abortController = new AbortController();
  const requestCancelTimeout = setTimeout(() => {
    abortController.abort();
  }, MAX_RESPONSE_TIME_IN_MS);

  const response = await fetch(url, {
    signal: abortController.signal,
  });

  if (requestCancelTimeout) {
    clearTimeout(requestCancelTimeout);
  }

  const urlContents = await response.text();
  return urlContents;
}

export async function fetchUrlAsGooglebot(url: string) {
  const abortController = new AbortController();
  const requestCancelTimeout = setTimeout(() => {
    abortController.abort();
  }, MAX_RESPONSE_TIME_IN_MS);

  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
    },
    signal: abortController.signal,
  });

  if (requestCancelTimeout) {
    clearTimeout(requestCancelTimeout);
  }

  const urlContents = await response.text();
  return urlContents;
}

export async function fetchUrlWithProxy(url: string) {
  const abortController = new AbortController();
  const requestCancelTimeout = setTimeout(() => {
    abortController.abort();
  }, MAX_RESPONSE_TIME_IN_MS);

  const response = await fetch(`https://api.allorigins.win/raw?url=${url}`, {
    signal: abortController.signal,
  });

  if (requestCancelTimeout) {
    clearTimeout(requestCancelTimeout);
  }

  const urlContents = await response.text();
  return urlContents;
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

function writeXmlTag(tagName: string, value: any, attributes?: Record<string, any>) {
  const attributesXml = attributes
    ? Object.keys(attributes || {}).map((attributeKey) => `${attributeKey}="${escapeHtml(attributes[attributeKey])}"`)
      .join(' ')
    : '';

  if (Array.isArray(value)) {
    if (value.length === 0) {
      return `<${tagName}${attributesXml ? ` ${attributesXml}` : ''} />`;
    }

    const xmlLines: string[] = [];

    for (const valueItem of value) {
      xmlLines.push(writeXmlTag(tagName, valueItem));
    }

    return xmlLines.join('\n');
  }

  if (typeof value === 'object') {
    if (Object.keys(value).length === 0) {
      return `<${tagName}${attributesXml ? ` ${attributesXml}` : ''} />`;
    }

    return `<${tagName}${attributesXml ? ` ${attributesXml}` : ''}>${convertObjectToDavXml(value)}</${tagName}>`;
  }

  return `<${tagName}${attributesXml ? ` ${attributesXml}` : ''}>${value}</${tagName}>`;
}

export function convertObjectToDavXml(davObject: Record<string, any>, isInitial = false): string {
  const xmlLines: string[] = [];

  if (isInitial) {
    xmlLines.push(`<?xml version="1.0" encoding="UTF-8"?>`);
  }

  for (const key of Object.keys(davObject)) {
    if (key.endsWith('_attributes')) {
      continue;
    }

    xmlLines.push(writeXmlTag(key, davObject[key], davObject[`${key}_attributes`]));
  }

  return xmlLines.join('\n');
}

function addLeadingZero(number: number) {
  if (number < 10) {
    return `0${number}`;
  }

  return number.toString();
}

export function buildRFC822Date(dateString: string) {
  const dayStrings = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const monthStrings = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  const timeStamp = Date.parse(dateString);
  const date = new Date(timeStamp);

  const day = dayStrings[date.getDay()];
  const dayNumber = addLeadingZero(date.getUTCDate());
  const month = monthStrings[date.getUTCMonth()];
  const year = date.getUTCFullYear();
  const time = `${addLeadingZero(date.getUTCHours())}:${addLeadingZero(date.getUTCMinutes())}:00`;

  return `${day}, ${dayNumber} ${month} ${year} ${time} +0000`;
}

export const capitalizeWord = (string: string) => {
  return `${string.charAt(0).toLocaleUpperCase()}${string.slice(1)}`;
};

export function getRandomItem<T>(items: Readonly<Array<T>>): T {
  return items[Math.floor(Math.random() * items.length)];
}
