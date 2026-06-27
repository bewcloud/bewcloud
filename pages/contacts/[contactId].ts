import page, { RequestHandlerParams } from '/lib/page.ts';

import { convertFormDataToObject, html } from '/public/ts/utils/misc.ts';
import { Contact, ContactModel } from '/lib/models/contacts.ts';
import { getFormDataField } from '/public/ts/utils/form.ts';
import { updateVCard } from '/public/ts/utils/contacts.ts';
import { AppConfig } from '/lib/config.ts';
import { formFields } from '/components/contacts/ViewContact.tsx';
import { basicLayoutResponse } from '/lib/utils/layout.tsx';
import Loading from '/components/Loading.ts';

async function get({ request, user, match, session, isRunningLocally }: RequestHandlerParams) {
  if (!(await AppConfig.isAppEnabled('contacts'))) {
    throw new Error('Contacts app is not enabled');
  }

  if (!match.pathname.groups.contactId) {
    throw new Error('NotFound');
  }

  const { contactId } = match.pathname.groups;

  const searchParams = new URL(request.url).searchParams;
  const addressBookId = searchParams.get('addressBookId') || undefined;

  if (!addressBookId) {
    return new Response('Bad request', { status: 400 });
  }

  const contact = await ContactModel.get(user!.id, addressBookId, contactId);

  if (!contact) {
    throw new Error('NotFound');
  }

  const htmlContent = defaultHtmlContent({ contact, formData: {}, addressBookId });

  return basicLayoutResponse(htmlContent, {
    currentPath: match.pathname.input,
    titlePrefix: `${contact.firstName} ${contact.lastName} - Contact`,
    match,
    request,
    user,
    session,
    isRunningLocally,
  });
}

async function post({ request, user, match, session, isRunningLocally }: RequestHandlerParams) {
  if (!(await AppConfig.isAppEnabled('contacts'))) {
    throw new Error('Contacts app is not enabled');
  }

  if (!match.pathname.groups.contactId) {
    throw new Error('NotFound');
  }

  const { contactId } = match.pathname.groups;

  const searchParams = new URL(request.url).searchParams;
  const addressBookId = searchParams.get('addressBookId') || undefined;

  if (!addressBookId) {
    return new Response('Bad request', { status: 400 });
  }

  const contact = await ContactModel.get(user!.id, addressBookId, contactId);

  if (!contact) {
    throw new Error('NotFound');
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

    await ContactModel.update(user!.id, contact.url, updatedVCard);

    const updatedContact = (await ContactModel.get(user!.id, addressBookId, contactId))!;

    const htmlContent = defaultHtmlContent({
      contact: updatedContact,
      notice: 'Contact updated successfully!',
      formData: convertFormDataToObject(formData),
      addressBookId,
    });

    return basicLayoutResponse(htmlContent, {
      currentPath: match.pathname.input,
      titlePrefix: `${contact.firstName} ${contact.lastName} - Contact`,
      match,
      request,
      user,
      session,
      isRunningLocally,
    });
  } catch (error) {
    console.error(error);
    const htmlContent = defaultHtmlContent({
      contact,
      error: (error as Error).toString(),
      formData: convertFormDataToObject(formData),
      addressBookId,
    });

    return basicLayoutResponse(htmlContent, {
      currentPath: match.pathname.input,
      titlePrefix: `${contact.firstName} ${contact.lastName} - Contact`,
      match,
      request,
      user,
      session,
      isRunningLocally,
    });
  }
}

function defaultHtmlContent({ contact, error, notice, formData, addressBookId }: {
  contact: Contact;
  error?: string;
  notice?: string;
  formData: Record<string, any>;
  addressBookId: string;
}) {
  return html`
    <main id="main">
      <section id="view-contact">
        ${Loading()}
      </section>
    </main>

    <script type="module">
    import { h, render, Fragment } from 'preact';

    // Imported files need some preact globals to work
    window.h = h;
    window.Fragment = Fragment;

    import ViewContact from '/public/components/contacts/ViewContact.js';

    const viewContactElement = document.getElementById('view-contact');

    if (viewContactElement) {
      const viewContactApp = h(ViewContact, {
        initialAddressBookId: ${JSON.stringify(addressBookId)},
        initialContact: ${JSON.stringify(contact)},
        formData: ${JSON.stringify(formData)},
        error: ${JSON.stringify(error)},
        notice: ${JSON.stringify(notice)},
        addressBookId: ${JSON.stringify(addressBookId)},
      });

      render(viewContactApp, viewContactElement);

      document.getElementById('loading')?.remove();
    }
    </script>
  `;
}

export default page({
  get,
  post,
  accessMode: 'user',
});
