import { Contact } from '/lib/models/contacts.ts';

export function getIdFromVCard(vCard: string): string {
  const lines = vCard.split('\n').map((line) => line.trim()).filter(Boolean);

  // Loop through every line and find the UID line
  for (const line of lines) {
    if (line.startsWith('UID:')) {
      const uid = line.replace('UID:', '');
      return uid.trim();
    }
  }

  return crypto.randomUUID();
}

export function splitTextIntoVCards(text: string): string[] {
  const lines = text.split('\n').map((line) => line.trim()).filter(Boolean);
  const vCards: string[] = [];
  const currentVCard: string[] = [];

  for (const line of lines) {
    currentVCard.push(line);

    if (line.startsWith('END:VCARD')) {
      vCards.push(currentVCard.join('\n'));
      currentVCard.length = 0;
    }
  }

  return vCards;
}

export function generateVCard(contactId: string, firstName: string, lastName?: string): string {
  const vCardText = `BEGIN:VCARD
VERSION:4.0
N:${getSafelyEscapedTextForVCard(lastName || '')};${getSafelyEscapedTextForVCard(firstName)};
FN:${getSafelyEscapedTextForVCard(firstName)} ${getSafelyEscapedTextForVCard(lastName || '')}
UID:${getSafelyEscapedTextForVCard(contactId)}
END:VCARD`;

  return vCardText;
}

export function updateVCard(
  vCard: string,
  { firstName, lastName, email, phone, notes }: {
    firstName?: string;
    lastName?: string;
    email?: string;
    phone?: string;
    notes?: string;
  },
): string {
  const lines = vCard.split('\n').map((line) => line.trim()).filter(Boolean);

  let replacedName = false;
  let replacedFormattedName = false;
  let replacedEmail = false;
  let replacedPhone = false;
  let replacedNotes = false;

  const updatedVCardLines = lines.map((line) => {
    if (line.startsWith('N:') && firstName && !replacedName) {
      replacedName = true;
      return `N:${getSafelyEscapedTextForVCard(lastName || '')};${getSafelyEscapedTextForVCard(firstName)};`;
    }

    if (line.startsWith('FN:') && firstName && !replacedFormattedName) {
      replacedFormattedName = true;
      return `FN:${getSafelyEscapedTextForVCard(firstName)} ${getSafelyEscapedTextForVCard(lastName || '')}`;
    }

    if ((line.startsWith('EMAIL:') || line.startsWith('EMAIL;')) && email && !replacedEmail) {
      replacedEmail = true;
      return line.replace(line.split(':')[1], getSafelyEscapedTextForVCard(email));
    }

    if ((line.startsWith('TEL:') || line.startsWith('TEL;')) && phone && !replacedPhone) {
      replacedPhone = true;
      return line.replace(line.split(':')[1], getSafelyEscapedTextForVCard(phone));
    }

    if (line.startsWith('NOTE:') && notes && !replacedNotes) {
      replacedNotes = true;
      return line.replace(line.split(':')[1], getSafelyEscapedTextForVCard(notes.replaceAll('\r', '')));
    }

    return line;
  });

  // Remove last line with END:VCARD
  const endLineIndex = updatedVCardLines.findIndex((line) => line.startsWith('END:VCARD'));
  updatedVCardLines.splice(endLineIndex, 1);

  if (!replacedEmail && email) {
    updatedVCardLines.push(`EMAIL;TYPE=HOME:${getSafelyEscapedTextForVCard(email)}`);
  }
  if (!replacedPhone && phone) {
    updatedVCardLines.push(`TEL;TYPE=HOME:${getSafelyEscapedTextForVCard(phone)}`);
  }
  if (!replacedNotes && notes) {
    updatedVCardLines.push(`NOTE:${getSafelyEscapedTextForVCard(notes.replaceAll('\r', ''))}`);
  }

  updatedVCardLines.push('END:VCARD');

  const updatedVCard = updatedVCardLines.map((line) => line.trim()).filter(Boolean).join('\n');

  return updatedVCard;
}

function getSafelyEscapedTextForVCard(text: string) {
  return text.replaceAll('\n', '\\n').replaceAll(',', '\\,');
}

function getSafelyUnescapedTextFromVCard(text: string): string {
  return text.replaceAll('\\n', '\n').replaceAll('\\,', ',');
}

type VCardVersion = '2.1' | '3.0' | '4.0';

export function parseVCard(text: string): Partial<Contact>[] {
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

      partialContact.uid = uid;

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

      partialContact.firstName = firstName;
      partialContact.lastName = lastName;
      partialContact.middleNames = middleNames;
      partialContact.title = title;

      continue;
    }

    if (line.startsWith('NOTE:')) {
      const notes = getSafelyUnescapedTextFromVCard(line.split('NOTE:')[1] || '');

      partialContact.notes = notes;

      continue;
    }

    if ((line.includes('TEL;') || line.includes('TEL:')) && !partialContact.phone) {
      const phoneInfo = line.split('TEL;')[1] || line.split('TEL')[1] || '';
      const phoneNumber = phoneInfo.split(':')[1] || '';
      // const label = (phoneInfo.split(':')[0].split('TYPE=')[1] || 'home').replaceAll(';', '');

      if (!phoneNumber) {
        continue;
      }

      partialContact.phone = phoneNumber;

      continue;
    }

    if ((line.includes('EMAIL;') || line.includes('EMAIL:')) && !partialContact.email) {
      const emailInfo = line.split('EMAIL;')[1] || line.split('EMAIL')[1] || '';
      const emailAddress = emailInfo.split(':')[1] || '';
      // const label = (emailInfo.split(':')[0].split('TYPE=')[1] || 'home').replaceAll(';', '');

      if (!emailAddress) {
        continue;
      }

      partialContact.email = emailAddress;

      continue;
    }
  }

  return partialContacts;
}
