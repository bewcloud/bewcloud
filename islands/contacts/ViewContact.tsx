import { useSignal } from '@preact/signals';

import { Contact } from '/lib/types.ts';
import { convertObjectToFormData } from '/lib/utils.ts';
import { FormField, generateFieldHtml } from '/lib/form-utils.tsx';
import { RequestBody as DeleteRequestBody, ResponseBody as DeleteResponseBody } from '/routes/api/contacts/delete.tsx';

interface ViewContactProps {
  initialContact: Contact;
  formData: Record<string, any>;
  error?: string;
  notice?: string;
}

export function formFields(contact: Contact) {
  const fields: FormField[] = [
    {
      name: 'name_title',
      label: 'Honorary title/prefix',
      type: 'text',
      placeholder: 'Dr.',
      value: contact.extra.name_title,
      required: false,
    },
    {
      name: 'first_name',
      label: 'First name',
      type: 'text',
      placeholder: 'John',
      value: contact.first_name,
      required: true,
    },
    {
      name: 'middle_names',
      label: 'Middle name(s)',
      type: 'text',
      placeholder: '',
      value: contact.extra.middle_names?.map((name) => (name || '').trim()).filter(Boolean).join(' '),
      required: false,
    },
    {
      name: 'last_name',
      label: 'Last name',
      type: 'text',
      placeholder: 'Doe',
      value: contact.last_name,
      required: false,
    },
    {
      name: 'birthday',
      label: 'Birthday',
      type: 'text',
      placeholder: 'YYYYMMDD',
      value: contact.extra.birthday,
      required: false,
    },
    {
      name: 'nickname',
      label: 'Nickname',
      type: 'text',
      placeholder: 'Johnny',
      value: contact.extra.nickname,
      required: false,
    },
    {
      name: 'organization',
      label: 'Company/Organization',
      type: 'text',
      placeholder: 'Acme Corporation',
      value: contact.extra.organization,
      required: false,
    },
    {
      name: 'role',
      label: 'Job/Role',
      type: 'text',
      placeholder: '(Super) Genius',
      value: contact.extra.role,
      required: false,
    },
    {
      name: 'photo_url',
      label: 'Photo URL',
      type: 'url',
      placeholder: 'https://example.com/image.jpg',
      value: contact.extra.photo_url,
      required: false,
    },
  ];

  // Phones
  const phones = contact.extra.fields?.filter((field) => field.type === 'phone') || [];
  for (const [index, phone] of phones.entries()) {
    fields.push({
      name: 'phone_numbers',
      label: `Phone number #${index + 1}`,
      type: 'tel',
      placeholder: '+44 0000 111 2222',
      value: phone.value,
      required: false,
    });

    fields.push({
      name: 'phone_labels',
      label: `Phone label #${index + 1}`,
      type: 'text',
      placeholder: 'Home, Work, etc.',
      value: phone.name,
      required: false,
    });
  }

  fields.push({
    name: 'phone_numbers',
    label: `Phone number #${phones.length + 1}`,
    type: 'tel',
    placeholder: '+44 0000 111 2222',
    value: '',
    required: false,
  }, {
    name: 'phone_labels',
    label: `Phone label #${phones.length + 1}`,
    type: 'text',
    placeholder: 'Home, Work, etc.',
    value: '',
    required: false,
  });

  // Emails
  const emails = contact.extra.fields?.filter((field) => field.type === 'email') || [];
  for (const [index, email] of emails.entries()) {
    fields.push({
      name: 'email_addresses',
      label: `Email #${index + 1}`,
      type: 'email',
      placeholder: 'user@example.com',
      value: email.value,
      required: false,
    });

    fields.push({
      name: 'email_labels',
      label: `Email label #${index + 1}`,
      type: 'text',
      placeholder: 'Home, Work, etc.',
      value: email.name,
      required: false,
    });
  }

  fields.push({
    name: 'email_addresses',
    label: `Email #${emails.length + 1}`,
    type: 'email',
    placeholder: 'user@example.com',
    value: '',
    required: false,
  }, {
    name: 'email_labels',
    label: `Email label #${emails.length + 1}`,
    type: 'text',
    placeholder: 'Home, Work, etc.',
    value: '',
    required: false,
  });

  // URLs
  const urls = contact.extra.fields?.filter((field) => field.type === 'url') || [];
  for (const [index, url] of urls.entries()) {
    fields.push({
      name: 'url_addresses',
      label: `URL #${index + 1}`,
      type: 'url',
      placeholder: 'https://example.com',
      value: url.value,
      required: false,
    });

    fields.push({
      name: 'url_labels',
      label: `URL label #${index + 1}`,
      type: 'text',
      placeholder: 'Home, Work, etc.',
      value: url.name,
      required: false,
    });
  }

  fields.push({
    name: 'url_addresses',
    label: `URL #${urls.length + 1}`,
    type: 'url',
    placeholder: 'https://example.com',
    value: '',
    required: false,
  }, {
    name: 'url_labels',
    label: `URL label #${urls.length + 1}`,
    type: 'text',
    placeholder: 'Home, Work, etc.',
    value: '',
    required: false,
  });

  // Others
  const others = contact.extra.fields?.filter((field) => field.type === 'other') || [];
  for (const [index, other] of others.entries()) {
    fields.push({
      name: 'other_values',
      label: `Other contact #${index + 1}`,
      type: 'text',
      placeholder: '@acme',
      value: other.value,
      required: false,
    });

    fields.push({
      name: 'other_labels',
      label: `Other label #${index + 1}`,
      type: 'text',
      placeholder: 'Home, Work, etc.',
      value: other.name,
      required: false,
    });
  }

  fields.push({
    name: 'other_values',
    label: `Other contact #${others.length + 1}`,
    type: 'text',
    placeholder: '@acme',
    value: '',
    required: false,
  }, {
    name: 'other_labels',
    label: `Other label #${others.length + 1}`,
    type: 'text',
    placeholder: 'Home, Work, etc.',
    value: '',
    required: false,
  });

  // Addresses
  const addresses = contact.extra.addresses || [];
  for (const [index, address] of addresses.entries()) {
    fields.push({
      name: 'address_line_1s',
      label: `Address line 1 #${index + 1}`,
      type: 'text',
      placeholder: '992 Tyburn Rd',
      value: address.line_1,
      required: false,
    });

    fields.push({
      name: 'address_line_2s',
      label: `Address line 2 #${index + 1}`,
      type: 'text',
      placeholder: 'Apt 2',
      value: address.line_2,
      required: false,
    });

    fields.push({
      name: 'address_cities',
      label: `Address city #${index + 1}`,
      type: 'text',
      placeholder: 'Birmingham',
      value: address.city,
      required: false,
    });

    fields.push({
      name: 'address_postal_codes',
      label: `Address postal code #${index + 1}`,
      type: 'text',
      placeholder: 'B24 0TL',
      value: address.postal_code,
      required: false,
    });

    fields.push({
      name: 'address_states',
      label: `Address state #${index + 1}`,
      type: 'text',
      placeholder: 'West Midlands',
      value: address.state,
      required: false,
    });

    fields.push({
      name: 'address_countries',
      label: `Address country #${index + 1}`,
      type: 'text',
      placeholder: 'United Kingdom',
      value: address.country,
      required: false,
    });

    fields.push({
      name: 'address_labels',
      label: `Address label #${index + 1}`,
      type: 'text',
      placeholder: 'Home, Work, etc.',
      value: address.label,
      required: false,
    });
  }

  fields.push({
    name: 'address_line_1s',
    label: `Address line 1 #${addresses.length + 1}`,
    type: 'text',
    placeholder: '992 Tyburn Rd',
    value: '',
    required: false,
  }, {
    name: 'address_line_2s',
    label: `Address line 2 #${addresses.length + 1}`,
    type: 'text',
    placeholder: 'Apt 2',
    value: '',
    required: false,
  }, {
    name: 'address_cities',
    label: `Address city #${addresses.length + 1}`,
    type: 'text',
    placeholder: 'Birmingham',
    value: '',
    required: false,
  }, {
    name: 'address_postal_codes',
    label: `Address postal code #${addresses.length + 1}`,
    type: 'text',
    placeholder: 'B24 0TL',
    value: '',
    required: false,
  }, {
    name: 'address_states',
    label: `Address state #${addresses.length + 1}`,
    type: 'text',
    placeholder: 'West Midlands',
    value: '',
    required: false,
  }, {
    name: 'address_countries',
    label: `Address country #${addresses.length + 1}`,
    type: 'text',
    placeholder: 'United Kingdom',
    value: '',
    required: false,
  }, {
    name: 'address_labels',
    label: `Address label #${addresses.length + 1}`,
    type: 'text',
    placeholder: 'Home, Work, etc.',
    value: '',
    required: false,
  });

  fields.push({
    name: 'notes',
    label: 'Notes',
    type: 'textarea',
    placeholder: 'Some notes...',
    value: contact.extra.notes,
    required: false,
  });

  return fields;
}

export default function ViewContact({ initialContact, formData: formDataObject, error, notice }: ViewContactProps) {
  const isDeleting = useSignal<boolean>(false);
  const contact = useSignal<Contact>(initialContact);

  const formData = convertObjectToFormData(formDataObject);

  async function onClickDeleteContact() {
    if (confirm('Are you sure you want to delete this contact?')) {
      if (isDeleting.value) {
        return;
      }

      isDeleting.value = true;

      try {
        const requestBody: DeleteRequestBody = { contactId: contact.value.id, page: 1 };
        const response = await fetch(`/api/contacts/delete`, {
          method: 'POST',
          body: JSON.stringify(requestBody),
        });
        const result = await response.json() as DeleteResponseBody;

        if (!result.success) {
          throw new Error('Failed to delete contact!');
        }

        window.location.href = '/contacts';
      } catch (error) {
        console.error(error);
      }

      isDeleting.value = false;
    }
  }

  return (
    <>
      <section class='flex flex-row items-center justify-between mb-4'>
        <a href='/contacts' class='mr-2'>View contacts</a>
        <section class='flex items-center'>
          <button
            class='inline-block justify-center gap-x-1.5 rounded-md bg-red-800 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-red-600 ml-2'
            type='button'
            title='Delete contact'
            onClick={() => onClickDeleteContact()}
          >
            <img
              src='/images/delete.svg'
              alt='Delete contact'
              class={`white ${isDeleting.value ? 'animate-spin' : ''}`}
              width={20}
              height={20}
            />
          </button>
        </section>
      </section>

      <section class='mx-auto max-w-7xl my-8'>
        {error
          ? (
            <section class='notification-error'>
              <h3>Failed to update!</h3>
              <p>{error}</p>
            </section>
          )
          : null}
        {notice
          ? (
            <section class='notification-success'>
              <h3>Success!</h3>
              <p>{notice}</p>
            </section>
          )
          : null}

        <form method='POST' class='mb-12'>
          {formFields(contact.peek()).map((field) => generateFieldHtml(field, formData))}

          <section class='flex justify-end mt-8 mb-4'>
            <button class='button' type='submit'>Update contact</button>
          </section>
        </form>

        <span
          class={`flex justify-end items-center text-sm mt-1 mx-2 text-slate-100`}
        >
          {isDeleting.value
            ? (
              <>
                <img src='/images/loading.svg' class='white mr-2' width={18} height={18} />Deleting...
              </>
            )
            : null}
          {!isDeleting.value ? <>&nbsp;</> : null}
        </span>
      </section>
    </>
  );
}
