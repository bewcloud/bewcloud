import { Calendar, CalendarEvent, Contact, ContactAddress, ContactField } from './types.ts';

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

export const CONTACTS_PER_PAGE_COUNT = 20;

export const DAV_RESPONSE_HEADER = '1, 2, 3, 4, addressbook, calendar-access';
// Response headers from Nextcloud:
// 1, 3, extended-mkcol, access-control, calendarserver-principal-property-search, oc-resource-sharing, addressbook, nextcloud-checksum-update, nc-calendar-search, nc-enable-birthday-calendar
// 1, 3, extended-mkcol, access-control, calendarserver-principal-property-search, calendar-access, calendar-proxy, calendar-auto-schedule, calendar-availability, nc-calendar-trashbin, nc-calendar-webcal-cache, calendarserver-subscribed, oc-resource-sharing, oc-calendar-publishing, calendarserver-sharing, addressbook, nextcloud-checksum-update, nc-calendar-search, nc-enable-birthday-calendar
// 1, 3, extended-mkcol, access-control, calendarserver-principal-property-search, calendar-access, calendar-proxy, calendar-auto-schedule, calendar-availability, nc-calendar-trashbin, nc-calendar-webcal-cache, calendarserver-subscribed, oc-resource-sharing, oc-calendar-publishing, calendarserver-sharing, nextcloud-checksum-update, nc-calendar-search, nc-enable-birthday-calendar

export const CALENDAR_COLOR_OPTIONS = [
  'bg-red-700',
  'bg-red-950',
  'bg-orange-700',
  'bg-orange-950',
  'bg-amber-700',
  'bg-yellow-800',
  'bg-lime-700',
  'bg-lime-950',
  'bg-green-700',
  'bg-emerald-800',
  'bg-teal-700',
  'bg-cyan-700',
  'bg-sky-800',
  'bg-blue-900',
  'bg-indigo-700',
  'bg-violet-700',
  'bg-purple-800',
  'bg-fuchsia-700',
  'bg-pink-800',
  'bg-rose-700',
] as const;

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

export function formatContactToVCard(contacts: Contact[]): string {
  const vCardText = contacts.map((contact) =>
    `BEGIN:VCARD
VERSION:4.0
N:${contact.last_name};${contact.first_name};${
      contact.extra.middle_names ? contact.extra.middle_names?.map((name) => name.trim()).filter(Boolean).join(' ') : ''
    };${contact.extra.name_title || ''};
FN:${contact.extra.name_title ? `${contact.extra.name_title || ''} ` : ''}${contact.first_name} ${contact.last_name}
${contact.extra.organization ? `ORG:${contact.extra.organization.replaceAll(',', '\\,')}` : ''}
${contact.extra.role ? `TITLE:${contact.extra.role}` : ''}
${contact.extra.birthday ? `BDAY:${contact.extra.birthday}` : ''}
${contact.extra.nickname ? `NICKNAME:${contact.extra.nickname}` : ''}
${contact.extra.photo_url ? `PHOTO;MEDIATYPE=${contact.extra.photo_mediatype}:${contact.extra.photo_url}` : ''}
${
      contact.extra.fields?.filter((field) => field.type === 'phone').map((phone) =>
        `TEL;TYPE=${phone.name}:${phone.value}`
      ).join('\n') || ''
    }
${
      contact.extra.addresses?.map((address) =>
        `ADR;TYPE=${address.label}:${(address.line_2 || '').replaceAll('\n', '\\n').replaceAll(',', '\\,')};${
          (address.line_1 || '').replaceAll('\n', '\\n').replaceAll(',', '\\,')
        };${(address.city || '').replaceAll('\n', '\\n').replaceAll(',', '\\,')};${
          (address.state || '').replaceAll('\n', '\\n').replaceAll(',', '\\,')
        };${(address.postal_code || '').replaceAll('\n', '\\n').replaceAll(',', '\\,')};${
          (address.country || '').replaceAll('\n', '\\n').replaceAll(',', '\\,')
        }`
      ).join('\n') || ''
    }
${
      contact.extra.fields?.filter((field) => field.type === 'email').map((email) =>
        `EMAIL;TYPE=${email.name}:${email.value}`
      ).join('\n') || ''
    }
REV:${new Date(contact.updated_at).toISOString()}
${
      contact.extra.fields?.filter((field) => field.type === 'other').map((other) => `x-${other.name}:${other.value}`)
        .join('\n') || ''
    }
${
      contact.extra.notes
        ? `NOTE:${contact.extra.notes.replaceAll('\r', '').replaceAll('\n', '\\n').replaceAll(',', '\\,')}`
        : ''
    }
${contact.extra.uid ? `UID:${contact.extra.uid}` : ''}
END:VCARD`
  ).join('\n');

  return vCardText.split('\n').map((line) => line.trim()).filter(Boolean).join('\n');
}

type VCardVersion = '2.1' | '3.0' | '4.0';

export function parseVCardFromTextContents(text: string): Partial<Contact>[] {
  const lines = text.split('\n').map((line) => line.trim()).filter(Boolean);

  const partialContacts: Partial<Contact>[] = [];

  let partialContact: Partial<Contact> = {};
  let vCardVersion: VCardVersion = '2.1';

  // Loop through every line
  for (const line of lines) {
    // Start new contact and vCard version
    if (line.startsWith('BEGIN:VCARD')) {
      partialContact = {};
      vCardVersion = '2.1';
      continue;
    }

    // Finish contact
    if (line.startsWith('END:VCARD')) {
      partialContacts.push(partialContact);
      continue;
    }

    // Select proper vCard version
    if (line.startsWith('VERSION:')) {
      if (line.startsWith('VERSION:2.1')) {
        vCardVersion = '2.1';
      } else if (line.startsWith('VERSION:3.0')) {
        vCardVersion = '3.0';
      } else if (line.startsWith('VERSION:4.0')) {
        vCardVersion = '4.0';
      } else {
        // Default to 2.1, log warning
        vCardVersion = '2.1';
        console.warn(`Invalid vCard version found: "${line}". Defaulting to 2.1 parser.`);
      }

      continue;
    }

    if (vCardVersion !== '2.1' && vCardVersion !== '3.0' && vCardVersion !== '4.0') {
      console.warn(`Invalid vCard version found: "${vCardVersion}". Defaulting to 2.1 parser.`);
      vCardVersion = '2.1';
    }

    if (line.startsWith('UID:')) {
      const uid = line.replace('UID:', '');

      if (!uid) {
        continue;
      }

      partialContact.extra = {
        ...(partialContact.extra || {}),
        uid,
      };

      continue;
    }

    if (line.startsWith('N:')) {
      const names = line.split('N:')[1].split(';');

      const lastName = names[0] || '';
      const firstName = names[1] || '';
      const middleNames = names.slice(2, -1).filter(Boolean);
      const title = names.slice(-1).join(' ') || '';

      if (!firstName) {
        continue;
      }

      partialContact.first_name = firstName;
      partialContact.last_name = lastName;
      partialContact.extra = {
        ...(partialContact.extra || {}),
        middle_names: middleNames,
        name_title: title,
      };

      continue;
    }

    if (line.startsWith('ORG:')) {
      const organization = ((line.split('ORG:')[1] || '').split(';').join(' ') || '').replaceAll('\\,', ',');

      if (!organization) {
        continue;
      }

      partialContact.extra = {
        ...(partialContact.extra || {}),
        organization,
      };

      continue;
    }

    if (line.startsWith('BDAY:')) {
      const birthday = line.split('BDAY:')[1] || '';

      partialContact.extra = {
        ...(partialContact.extra || {}),
        birthday,
      };

      continue;
    }

    if (line.startsWith('NICKNAME:')) {
      const nickname = (line.split('NICKNAME:')[1] || '').split(';').join(' ') || '';

      if (!nickname) {
        continue;
      }

      partialContact.extra = {
        ...(partialContact.extra || {}),
        nickname,
      };

      continue;
    }

    if (line.startsWith('TITLE:')) {
      const role = line.split('TITLE:')[1] || '';

      partialContact.extra = {
        ...(partialContact.extra || {}),
        role,
      };

      continue;
    }

    if (line.startsWith('NOTE:')) {
      const notes = (line.split('NOTE:')[1] || '').replaceAll('\\n', '\n').replaceAll('\\,', ',');

      partialContact.extra = {
        ...(partialContact.extra || {}),
        notes,
      };

      continue;
    }

    if (line.includes('ADR;')) {
      const addressInfo = line.split('ADR;')[1] || '';
      const addressParts = (addressInfo.split(':')[1] || '').split(';');
      const country = addressParts.slice(-1, addressParts.length).join(' ').replaceAll('\\n', '\n').replaceAll(
        '\\,',
        ',',
      );
      const postalCode = addressParts.slice(-2, addressParts.length - 1).join(' ').replaceAll('\\n', '\n').replaceAll(
        '\\,',
        ',',
      );
      const state = addressParts.slice(-3, addressParts.length - 2).join(' ').replaceAll('\\n', '\n').replaceAll(
        '\\,',
        ',',
      );
      const city = addressParts.slice(-4, addressParts.length - 3).join(' ').replaceAll('\\n', '\n').replaceAll(
        '\\,',
        ',',
      );
      const line1 = addressParts.slice(-5, addressParts.length - 4).join(' ').replaceAll('\\n', '\n').replaceAll(
        '\\,',
        ',',
      );
      const line2 = addressParts.slice(-6, addressParts.length - 5).join(' ').replaceAll('\\n', '\n').replaceAll(
        '\\,',
        ',',
      );

      const label = ((addressInfo.split(':')[0] || '').split('TYPE=')[1] || 'home').replaceAll(';', '').replaceAll(
        '\\n',
        '\n',
      ).replaceAll('\\,', ',');

      if (!country && !postalCode && !state && !city && !line2 && !line1) {
        continue;
      }

      const address: ContactAddress = {
        label,
        line_1: line1,
        line_2: line2,
        city,
        state,
        postal_code: postalCode,
        country,
      };

      partialContact.extra = {
        ...(partialContact.extra || {}),
        addresses: [...(partialContact.extra?.addresses || []), address],
      };

      continue;
    }

    if (line.includes('PHOTO;')) {
      const photoInfo = line.split('PHOTO;')[1] || '';
      const photoUrl = photoInfo.split(':')[1];
      const photoMediaTypeInfo = photoInfo.split(':')[0];
      let photoMediaType = photoMediaTypeInfo.split('TYPE=')[1] || '';

      if (!photoMediaType) {
        photoMediaType = 'image/jpeg';
      }

      if (!photoMediaType.startsWith('image/')) {
        photoMediaType = `image/${photoMediaType.toLowerCase()}`;
      }

      if (!photoUrl) {
        continue;
      }

      partialContact.extra = {
        ...(partialContact.extra || {}),
        photo_mediatype: photoMediaType,
        photo_url: photoUrl,
      };

      continue;
    }

    if (line.includes('TEL;')) {
      const phoneInfo = line.split('TEL;')[1] || '';
      const phoneNumber = phoneInfo.split(':')[1] || '';
      const name = (phoneInfo.split(':')[0].split('TYPE=')[1] || 'home').replaceAll(';', '');

      if (!phoneNumber) {
        continue;
      }

      const field: ContactField = {
        name,
        value: phoneNumber,
        type: 'phone',
      };

      partialContact.extra = {
        ...(partialContact.extra || {}),
        fields: [...(partialContact.extra?.fields || []), field],
      };

      continue;
    }

    if (line.includes('EMAIL;')) {
      const emailInfo = line.split('EMAIL;')[1] || '';
      const emailAddress = emailInfo.split(':')[1] || '';
      const name = (emailInfo.split(':')[0].split('TYPE=')[1] || 'home').replaceAll(';', '');

      if (!emailAddress) {
        continue;
      }

      const field: ContactField = {
        name,
        value: emailAddress,
        type: 'email',
      };

      partialContact.extra = {
        ...(partialContact.extra || {}),
        fields: [...(partialContact.extra?.fields || []), field],
      };

      continue;
    }
  }

  return partialContacts;
}

// TODO: Build this
export function formatCalendarEventsToVCalendar(calendarEvents: CalendarEvent[], _calendar: Calendar): string {
  const vCalendarText = calendarEvents.map((calendarEvent) =>
    `BEGIN:VEVENT
DTSTAMP:${calendarEvent.start_date.toISOString().substring(0, 19).replaceAll('T', '').replaceAll(':', '')}
DTSTART:${calendarEvent.start_date.toISOString().substring(0, 19).replaceAll('T', '').replaceAll(':', '')}
DTEND:${calendarEvent.end_date.toISOString().substring(0, 19).replaceAll('T', '').replaceAll(':', '')}
ORGANIZER;CN=:MAILTO:${calendarEvent.extra.organizer_email}
SUMMARY:${calendarEvent.title}
${calendarEvent.extra.uid ? `UID:${calendarEvent.extra.uid}` : ''}
END:VEVENT`
  ).join('\n');

  return `BEGIN:VCALENDAR\nVERSION:2.0\nCALSCALE:GREGORIAN\n${vCalendarText}\nEND:VCALENDAR`.split('\n').map((line) =>
    line.trim()
  ).filter(
    Boolean,
  ).join('\n');
}

type VCalendarVersion = '1.0' | '2.0';

export function parseVCalendarFromTextContents(text: string): Partial<CalendarEvent>[] {
  const lines = text.split('\n').map((line) => line.trim()).filter(Boolean);

  const partialCalendarEvents: Partial<CalendarEvent>[] = [];

  let partialCalendarEvent: Partial<CalendarEvent> = {};
  let vCalendarVersion: VCalendarVersion = '2.0';

  // Loop through every line
  for (const line of lines) {
    // Start new vCard version
    if (line.startsWith('BEGIN:VCALENDAR')) {
      vCalendarVersion = '2.0';
      continue;
    }

    // Start new event
    if (line.startsWith('BEGIN:VEVENT')) {
      partialCalendarEvent = {};
      continue;
    }

    // Finish contact
    if (line.startsWith('END:VCARD')) {
      partialCalendarEvents.push(partialCalendarEvent);
      continue;
    }

    // Select proper vCalendar version
    if (line.startsWith('VERSION:')) {
      if (line.startsWith('VERSION:1.0')) {
        vCalendarVersion = '1.0';
      } else if (line.startsWith('VERSION:2.0')) {
        vCalendarVersion = '2.0';
      } else {
        // Default to 2.0, log warning
        vCalendarVersion = '2.0';
        console.warn(`Invalid vCalendar version found: "${line}". Defaulting to 2.0 parser.`);
      }

      continue;
    }

    if (vCalendarVersion !== '1.0' && vCalendarVersion !== '2.0') {
      console.warn(`Invalid vCalendar version found: "${vCalendarVersion}". Defaulting to 2.0 parser.`);
      vCalendarVersion = '2.0';
    }

    if (line.startsWith('UID:')) {
      const uid = line.replace('UID:', '');

      if (!uid) {
        continue;
      }

      partialCalendarEvent.extra = {
        ...(partialCalendarEvent.extra! || {}),
        uid,
      };

      continue;
    }

    // TODO: Build this ( https://en.wikipedia.org/wiki/ICalendar#List_of_components,_properties,_and_parameters )

    if (line.startsWith('SUMMARY:')) {
      const title = line.split('SUMMARY:')[1] || '';

      partialCalendarEvent.title = title;

      continue;
    }
  }

  return partialCalendarEvents;
}

export const capitalizeWord = (string: string) => {
  return `${string.charAt(0).toLocaleUpperCase()}${string.slice(1)}`;
};

// NOTE: Considers weeks starting Monday, not Sunday
export function getWeeksForMonth(date: Date): { date: Date; isSameMonth: boolean }[][] {
  const year = date.getFullYear();
  const month = date.getMonth();

  const firstOfMonth = new Date(year, month, 1);
  const lastOfMonth = new Date(year, month + 1, 0);

  const daysToShow = firstOfMonth.getDay() + (firstOfMonth.getDay() === 0 ? 6 : -1) + lastOfMonth.getDate();

  const weekCount = Math.ceil(daysToShow / 7);

  const weeks: { date: Date; isSameMonth: boolean }[][] = [];

  const startingDate = new Date(firstOfMonth);
  startingDate.setDate(
    startingDate.getDate() - Math.abs(firstOfMonth.getDay() === 0 ? 6 : (firstOfMonth.getDay() - 1)),
  );

  for (let weekIndex = 0; weeks.length < weekCount; ++weekIndex) {
    for (let dayIndex = 0; dayIndex < 7; ++dayIndex) {
      if (!Array.isArray(weeks[weekIndex])) {
        weeks[weekIndex] = [];
      }

      const weekDayDate = new Date(startingDate);
      weekDayDate.setDate(weekDayDate.getDate() + (dayIndex + weekIndex * 7));

      const isSameMonth = weekDayDate.getMonth() === month;

      weeks[weekIndex].push({ date: weekDayDate, isSameMonth });
    }
  }

  return weeks;
}

// NOTE: Considers week starting Monday, not Sunday
export function getDaysForWeek(
  date: Date,
): { date: Date; isSameDay: boolean; hours: { date: Date; isCurrentHour: boolean }[] }[] {
  const shortIsoDate = date.toISOString().substring(0, 10);
  const currentHour = new Date().getHours();

  const days: { date: Date; isSameDay: boolean; hours: { date: Date; isCurrentHour: boolean }[] }[] = [];

  const startingDate = new Date(date);
  startingDate.setDate(
    startingDate.getDate() - Math.abs(startingDate.getDay() === 0 ? 6 : (startingDate.getDay() - 1)),
  );

  for (let dayIndex = 0; days.length < 7; ++dayIndex) {
    const dayDate = new Date(startingDate);
    dayDate.setDate(dayDate.getDate() + dayIndex);

    const isSameDay = dayDate.toISOString().substring(0, 10) === shortIsoDate;

    days[dayIndex] = {
      date: dayDate,
      isSameDay,
      hours: [],
    };

    for (let hourIndex = 0; hourIndex < 24; ++hourIndex) {
      const dayHourDate = new Date(dayDate);
      dayHourDate.setHours(hourIndex);

      const isCurrentHour = isSameDay && hourIndex === currentHour;

      days[dayIndex].hours.push({ date: dayHourDate, isCurrentHour });
    }
  }

  return days;
}

export function getRandomItem<T>(items: Readonly<Array<T>>): T {
  return items[Math.floor(Math.random() * items.length)];
}
