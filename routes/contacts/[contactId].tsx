import { Handlers, PageProps } from 'fresh/server.ts';

import { Contact, ContactAddress, ContactField, FreshContextState } from '/lib/types.ts';
import { convertFormDataToObject } from '/lib/utils.ts';
import { getContact, updateContact } from '/lib/data/contacts.ts';
import { getFormDataField, getFormDataFieldArray } from '/lib/form-utils.tsx';
import ViewContact, { formFields } from '/islands/contacts/ViewContact.tsx';

interface Data {
  contact: Contact;
  error?: string;
  notice?: string;
  formData: Record<string, any>;
}

export const handler: Handlers<Data, FreshContextState> = {
  async GET(request, context) {
    if (!context.state.user) {
      return new Response('Redirect', { status: 303, headers: { 'Location': `/login` } });
    }

    const { contactId } = context.params;

    const contact = await getContact(contactId, context.state.user.id);

    if (!contact) {
      return new Response('Not found', { status: 404 });
    }

    return await context.render({ contact, formData: {} });
  },
  async POST(request, context) {
    if (!context.state.user) {
      return new Response('Redirect', { status: 303, headers: { 'Location': `/login` } });
    }

    const { contactId } = context.params;

    const contact = await getContact(contactId, context.state.user.id);

    if (!contact) {
      return new Response('Not found', { status: 404 });
    }

    const formData = await request.formData();

    contact.extra.name_title = getFormDataField(formData, 'name_title') || undefined;
    contact.first_name = getFormDataField(formData, 'first_name');
    contact.last_name = getFormDataField(formData, 'last_name');
    contact.extra.middle_names = getFormDataField(formData, 'middle_names').split(' ').map((name) =>
      (name || '').trim()
    ).filter(Boolean);
    if (contact.extra.middle_names.length === 0) {
      contact.extra.middle_names = undefined;
    }
    contact.extra.birthday = getFormDataField(formData, 'birthday') || undefined;
    contact.extra.nickname = getFormDataField(formData, 'nickname') || undefined;
    contact.extra.organization = getFormDataField(formData, 'organization') || undefined;
    contact.extra.role = getFormDataField(formData, 'role') || undefined;
    contact.extra.photo_url = getFormDataField(formData, 'photo_url') || undefined;
    contact.extra.photo_mediatype = contact.extra.photo_url
      ? `image/${contact.extra.photo_url.split('.').slice(-1, 1).join('').toLowerCase()}`
      : undefined;
    contact.extra.notes = getFormDataField(formData, 'notes') || undefined;

    contact.extra.fields = [];

    // Phones
    const phoneNumbers = getFormDataFieldArray(formData, 'phone_numbers');
    const phoneLabels = getFormDataFieldArray(formData, 'phone_labels');

    for (const [index, phoneNumber] of phoneNumbers.entries()) {
      if (phoneNumber.trim().length === 0) {
        continue;
      }

      const field: ContactField = {
        name: phoneLabels[index] || 'Home',
        value: phoneNumber.trim(),
        type: 'phone',
      };

      contact.extra.fields.push(field);
    }

    // Emails
    const emailAddresses = getFormDataFieldArray(formData, 'email_addresses');
    const emailLabels = getFormDataFieldArray(formData, 'email_labels');

    for (const [index, emailAddress] of emailAddresses.entries()) {
      if (emailAddress.trim().length === 0) {
        continue;
      }

      const field: ContactField = {
        name: emailLabels[index] || 'Home',
        value: emailAddress.trim(),
        type: 'email',
      };

      contact.extra.fields.push(field);
    }

    // URLs
    const urlAddresses = getFormDataFieldArray(formData, 'url_addresses');
    const urlLabels = getFormDataFieldArray(formData, 'url_labels');

    for (const [index, urlAddress] of urlAddresses.entries()) {
      if (urlAddress.trim().length === 0) {
        continue;
      }

      const field: ContactField = {
        name: urlLabels[index] || 'Home',
        value: urlAddress.trim(),
        type: 'url',
      };

      contact.extra.fields.push(field);
    }

    // Others
    const otherValues = getFormDataFieldArray(formData, 'other_values');
    const otherLabels = getFormDataFieldArray(formData, 'other_labels');

    for (const [index, otherValue] of otherValues.entries()) {
      if (otherValue.trim().length === 0) {
        continue;
      }

      const field: ContactField = {
        name: otherLabels[index] || 'Home',
        value: otherValue.trim(),
        type: 'other',
      };

      contact.extra.fields.push(field);
    }

    contact.extra.addresses = [];

    // Addresses
    const addressLine1s = getFormDataFieldArray(formData, 'address_line_1s');
    const addressLine2s = getFormDataFieldArray(formData, 'address_line_2s');
    const addressCities = getFormDataFieldArray(formData, 'address_cities');
    const addressPostalCodes = getFormDataFieldArray(formData, 'address_postal_codes');
    const addressStates = getFormDataFieldArray(formData, 'address_states');
    const addressCountries = getFormDataFieldArray(formData, 'address_countries');
    const addressLabels = getFormDataFieldArray(formData, 'address_labels');

    for (const [index, addressLine1] of addressLine1s.entries()) {
      if (addressLine1.trim().length === 0) {
        continue;
      }

      const address: ContactAddress = {
        label: addressLabels[index] || 'Home',
        line_1: addressLine1.trim(),
        line_2: addressLine2s[index] || undefined,
        city: addressCities[index] || undefined,
        postal_code: addressPostalCodes[index] || undefined,
        state: addressStates[index] || undefined,
        country: addressCountries[index] || undefined,
      };

      contact.extra.addresses.push(address);
    }

    try {
      if (!contact.first_name) {
        throw new Error(`First name is required.`);
      }

      formFields(contact).forEach((field) => {
        if (field.required) {
          const value = formData.get(field.name);

          if (!value) {
            throw new Error(`${field.label} is required`);
          }
        }
      });

      await updateContact(contact);

      return await context.render({
        contact,
        notice: 'Contact updated successfully!',
        formData: convertFormDataToObject(formData),
      });
    } catch (error) {
      console.error(error);
      return await context.render({ contact, error: error.toString(), formData: convertFormDataToObject(formData) });
    }
  },
};

export default function ContactsPage({ data }: PageProps<Data, FreshContextState>) {
  return (
    <main>
      <ViewContact initialContact={data.contact} formData={data.formData} error={data.error} notice={data.notice} />
    </main>
  );
}
