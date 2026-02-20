import { useSignal } from '@preact/signals';
import { convertObjectToFormData } from '/public/ts/utils/misc.ts';
import { generateFieldHtml } from '/public/ts/utils/form.ts';
export function formFields(contact, updateType) {
  const fields = [{
    name: 'update-type',
    label: 'Update type',
    type: 'hidden',
    value: updateType,
    readOnly: true
  }];
  if (updateType === 'ui') {
    fields.push({
      name: 'first_name',
      label: 'First name',
      type: 'text',
      placeholder: 'John',
      value: contact.firstName,
      required: true
    }, {
      name: 'last_name',
      label: 'Last name',
      type: 'text',
      placeholder: 'Doe',
      value: contact.lastName,
      required: false
    }, {
      name: 'main_phone',
      label: 'Main phone',
      type: 'tel',
      placeholder: '+44 0000 111 2222',
      value: contact.phone,
      required: false
    }, {
      name: 'main_email',
      label: 'Main email',
      type: 'email',
      placeholder: 'john.doe@example.com',
      value: contact.email,
      required: false
    }, {
      name: 'notes',
      label: 'Notes',
      type: 'textarea',
      placeholder: 'Some notes...',
      value: contact.notes,
      required: false
    });
  } else if (updateType === 'raw') {
    fields.push({
      name: 'vcard',
      label: 'Raw vCard',
      type: 'textarea',
      placeholder: 'Raw vCard...',
      value: contact.data,
      description: 'This is the raw vCard for this contact. Use this to manually update the contact _if_ you know what you are doing.',
      rows: '10'
    });
  }
  return fields;
}
export default function ViewContact({
  initialContact,
  formData: formDataObject,
  error,
  notice,
  addressBookId
}) {
  const isDeleting = useSignal(false);
  const contact = useSignal(initialContact);
  const formData = convertObjectToFormData(formDataObject);
  async function onClickDeleteContact() {
    if (confirm('Are you sure you want to delete this contact?')) {
      if (isDeleting.value) {
        return;
      }
      isDeleting.value = true;
      try {
        const requestBody = {
          contactId: contact.value.uid,
          addressBookId
        };
        const response = await fetch(`/api/contacts/delete`, {
          method: 'POST',
          body: JSON.stringify(requestBody)
        });
        if (!response.ok) {
          throw new Error(`Failed to delete contact. ${response.statusText} ${await response.text()}`);
        }
        const result = await response.json();
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
  return h(Fragment, null, h("section", {
    class: "flex flex-row items-center justify-between mb-4"
  }, h("a", {
    href: "/contacts",
    class: "mr-2"
  }, "View contacts"), h("section", {
    class: "flex items-center"
  }, h("button", {
    class: "inline-block justify-center gap-x-1.5 rounded-md bg-red-800 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-red-600 ml-2",
    type: "button",
    title: "Delete contact",
    onClick: () => onClickDeleteContact()
  }, h("img", {
    src: "/public/images/delete.svg",
    alt: "Delete contact",
    class: `white ${isDeleting.value ? 'animate-spin' : ''}`,
    width: 20,
    height: 20
  })))), h("section", {
    class: "mx-auto max-w-7xl my-8"
  }, error ? h("section", {
    class: "notification-error"
  }, h("h3", null, "Failed to update!"), h("p", null, error)) : null, notice ? h("section", {
    class: "notification-success"
  }, h("h3", null, "Success!"), h("p", null, notice)) : null, h("form", {
    method: "POST",
    class: "mb-12"
  }, h("div", {
    dangerouslySetInnerHTML: {
      __html: formFields(contact.peek(), 'ui').map(field => generateFieldHtml(field, formData)).join('')
    }
  }), h("section", {
    class: "flex justify-end mt-8 mb-4"
  }, h("button", {
    class: "button",
    type: "submit"
  }, "Update contact"))), h("hr", {
    class: "my-8 border-slate-700"
  }), h("details", {
    class: "mb-12 group"
  }, h("summary", {
    class: "text-slate-100 flex items-center font-bold cursor-pointer text-center justify-center mx-auto hover:text-sky-400"
  }, "Edit Raw vCard", ' ', h("span", {
    class: "ml-2 text-slate-400 group-open:rotate-90 transition-transform duration-200"
  }, h("img", {
    src: "/public/images/right.svg",
    alt: "Expand",
    width: 16,
    height: 16,
    class: "white"
  }))), h("form", {
    method: "POST",
    class: "mb-12"
  }, h("div", {
    dangerouslySetInnerHTML: {
      __html: formFields(contact.peek(), 'raw').map(field => generateFieldHtml(field, formData)).join('')
    }
  }), h("section", {
    class: "flex justify-end mt-8 mb-4"
  }, h("button", {
    class: "button",
    type: "submit"
  }, "Update vCard")))), h("span", {
    class: `flex justify-end items-center text-sm mt-1 mx-2 text-slate-100`
  }, isDeleting.value ? h(Fragment, null, h("img", {
    src: "/public/images/loading.svg",
    class: "white mr-2",
    width: 18,
    height: 18
  }), "Deleting...") : null, !isDeleting.value ? h(Fragment, null, "\xA0") : null)));
}