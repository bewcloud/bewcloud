import { Handlers, PageProps } from 'fresh/server.ts';

import { FreshContextState } from '/lib/types.ts';
import { convertFormDataToObject } from '/lib/utils/misc.ts';
import { Contact, ContactModel } from '/lib/models/contacts.ts';
import { getFormDataField } from '/lib/form-utils.tsx';
import ViewContact, { formFields } from '/islands/contacts/ViewContact.tsx';
import { updateVCard } from '/lib/utils/contacts.ts';

interface Data {
  contact: Contact;
  error?: string;
  notice?: string;
  formData: Record<string, any>;
  addressBookId: string;
}

export const handler: Handlers<Data, FreshContextState> = {
  async GET(request, context) {
    if (!context.state.user) {
      return new Response('Redirect', { status: 303, headers: { 'Location': `/login` } });
    }

    const { contactId } = context.params;

    const searchParams = new URL(request.url).searchParams;
    const addressBookId = searchParams.get('addressBookId') || undefined;

    if (!addressBookId) {
      return new Response('Bad request', { status: 400 });
    }

    const contact = await ContactModel.get(context.state.user.id, addressBookId, contactId);

    if (!contact) {
      return new Response('Not found', { status: 404 });
    }

    return await context.render({ contact, formData: {}, addressBookId });
  },
  async POST(request, context) {
    if (!context.state.user) {
      return new Response('Redirect', { status: 303, headers: { 'Location': `/login` } });
    }

    const { contactId } = context.params;

    const searchParams = new URL(request.url).searchParams;
    const addressBookId = searchParams.get('addressBookId') || undefined;

    if (!addressBookId) {
      return new Response('Bad request', { status: 400 });
    }

    const contact = await ContactModel.get(context.state.user.id, addressBookId, contactId);

    if (!contact) {
      return new Response('Not found', { status: 404 });
    }

    const formData = await request.formData();

    const updateType = getFormDataField(formData, 'update-type') as 'raw' | 'ui';

    const firstName = getFormDataField(formData, 'first_name');
    const lastName = getFormDataField(formData, 'last_name');
    const email = getFormDataField(formData, 'main_email');
    const phone = getFormDataField(formData, 'main_phone');
    const notes = getFormDataField(formData, 'notes');
    const rawVCard = getFormDataField(formData, 'vcard');

    try {
      formFields(contact, updateType).forEach((field) => {
        if (field.required) {
          const value = formData.get(field.name);

          if (!value) {
            throw new Error(`${field.label} is required`);
          }
        }
      });

      let updatedVCard = '';

      if (updateType === 'raw') {
        updatedVCard = rawVCard;
      } else if (updateType === 'ui') {
        if (!firstName) {
          throw new Error(`First name is required.`);
        }

        updatedVCard = updateVCard(contact.data || '', { firstName, lastName, email, phone, notes });
      }

      await ContactModel.update(context.state.user.id, contact.url, updatedVCard);

      return await context.render({
        contact,
        notice: 'Contact updated successfully!',
        formData: convertFormDataToObject(formData),
        addressBookId,
      });
    } catch (error) {
      console.error(error);
      return await context.render({
        contact,
        error: (error as Error).toString(),
        formData: convertFormDataToObject(formData),
        addressBookId,
      });
    }
  },
};

export default function ContactsPage({ data }: PageProps<Data, FreshContextState>) {
  return (
    <main>
      <ViewContact
        initialContact={data.contact}
        formData={data.formData}
        error={data.error}
        notice={data.notice}
        addressBookId={data.addressBookId}
      />
    </main>
  );
}
