import { Contact, ContactAddress, ContactField } from '../types.ts';

export const CONTACTS_PER_PAGE_COUNT = 20;

function getSafelyEscapedTextForVCard(text: string) {
  return text.replaceAll('\n', '\\n').replaceAll(',', '\\,');
}

function getSafelyUnescapedTextFromVCard(text: string) {
  return text.replaceAll('\\n', '\n').replaceAll('\\,', ',');
}

export function formatContactToVCard(contacts: Contact[]): string {
  const vCardText = contacts.map((contact) =>
    `BEGIN:VCARD
VERSION:4.0
N:${contact.last_name};${contact.first_name};${
      contact.extra.middle_names ? contact.extra.middle_names?.map((name) => name.trim()).filter(Boolean).join(' ') : ''
    };${contact.extra.name_title || ''};
FN:${contact.extra.name_title ? `${contact.extra.name_title || ''} ` : ''}${contact.first_name} ${contact.last_name}
${contact.extra.organization ? `ORG:${getSafelyEscapedTextForVCard(contact.extra.organization)}` : ''}
${contact.extra.role ? `TITLE:${getSafelyEscapedTextForVCard(contact.extra.role)}` : ''}
${contact.extra.birthday ? `BDAY:${contact.extra.birthday}` : ''}
${contact.extra.nickname ? `NICKNAME:${getSafelyEscapedTextForVCard(contact.extra.nickname)}` : ''}
${contact.extra.photo_url ? `PHOTO;MEDIATYPE=${contact.extra.photo_mediatype}:${contact.extra.photo_url}` : ''}
${
      contact.extra.fields?.filter((field) => field.type === 'phone').map((phone) =>
        `TEL;TYPE=${phone.name}:${phone.value}`
      ).join('\n') || ''
    }
${
      contact.extra.addresses?.map((address) =>
        `ADR;TYPE=${address.label}:${getSafelyEscapedTextForVCard(address.line_2 || '')};${
          getSafelyEscapedTextForVCard(address.line_1 || '')
        };${getSafelyEscapedTextForVCard(address.city || '')};${getSafelyEscapedTextForVCard(address.state || '')};${
          getSafelyEscapedTextForVCard(address.postal_code || '')
        };${getSafelyEscapedTextForVCard(address.country || '')}`
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
${contact.extra.notes ? `NOTE:${getSafelyEscapedTextForVCard(contact.extra.notes.replaceAll('\r', ''))}` : ''}
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
      const notes = getSafelyUnescapedTextFromVCard(line.split('NOTE:')[1] || '');

      partialContact.extra = {
        ...(partialContact.extra || {}),
        notes,
      };

      continue;
    }

    if (line.includes('ADR;')) {
      const addressInfo = line.split('ADR;')[1] || '';
      const addressParts = (addressInfo.split(':')[1] || '').split(';');
      const country = getSafelyUnescapedTextFromVCard(addressParts.slice(-1, addressParts.length).join(' '));
      const postalCode = getSafelyUnescapedTextFromVCard(addressParts.slice(-2, addressParts.length - 1).join(' '));
      const state = getSafelyUnescapedTextFromVCard(addressParts.slice(-3, addressParts.length - 2).join(' '));
      const city = getSafelyUnescapedTextFromVCard(addressParts.slice(-4, addressParts.length - 3).join(' '));
      const line1 = getSafelyUnescapedTextFromVCard(addressParts.slice(-5, addressParts.length - 4).join(' '));
      const line2 = getSafelyUnescapedTextFromVCard(addressParts.slice(-6, addressParts.length - 5).join(' '));

      const label = getSafelyUnescapedTextFromVCard(
        ((addressInfo.split(':')[0] || '').split('TYPE=')[1] || 'home').replaceAll(';', ''),
      );

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
