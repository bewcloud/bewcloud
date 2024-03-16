import { useSignal } from '@preact/signals';

import { Contact } from '/lib/types.ts';
import { baseUrl, CONTACTS_PER_PAGE_COUNT, formatContactToVCard, parseVCardFromTextContents } from '/lib/utils.ts';
import { RequestBody as GetRequestBody, ResponseBody as GetResponseBody } from '/routes/api/contacts/get.tsx';
import { RequestBody as AddRequestBody, ResponseBody as AddResponseBody } from '/routes/api/contacts/add.tsx';
import { RequestBody as DeleteRequestBody, ResponseBody as DeleteResponseBody } from '/routes/api/contacts/delete.tsx';
import { RequestBody as ImportRequestBody, ResponseBody as ImportResponseBody } from '/routes/api/contacts/import.tsx';

interface ContactsProps {
  initialContacts: Pick<Contact, 'id' | 'first_name' | 'last_name'>[];
  page: number;
  contactsCount: number;
  search?: string;
}

export default function Contacts({ initialContacts, page, contactsCount, search }: ContactsProps) {
  const isAdding = useSignal<boolean>(false);
  const isDeleting = useSignal<boolean>(false);
  const isExporting = useSignal<boolean>(false);
  const isImporting = useSignal<boolean>(false);
  const contacts = useSignal<Pick<Contact, 'id' | 'first_name' | 'last_name'>[]>(initialContacts);
  const isOptionsDropdownOpen = useSignal<boolean>(false);

  async function onClickAddContact() {
    if (isAdding.value) {
      return;
    }

    const firstName = (prompt(`What's the **first name** for the new contact?`) || '').trim();

    if (!firstName) {
      alert('A first name is required for a new contact!');
      return;
    }

    const lastName = (prompt(`What's the **last name** for the new contact?`) || '').trim();

    isAdding.value = true;

    try {
      const requestBody: AddRequestBody = { firstName, lastName, page };
      const response = await fetch(`/api/contacts/add`, {
        method: 'POST',
        body: JSON.stringify(requestBody),
      });
      const result = await response.json() as AddResponseBody;

      if (!result.success) {
        throw new Error('Failed to add contact!');
      }

      contacts.value = [...result.contacts];
    } catch (error) {
      console.error(error);
    }

    isAdding.value = false;
  }

  function toggleOptionsDropdown() {
    isOptionsDropdownOpen.value = !isOptionsDropdownOpen.value;
  }

  async function onClickDeleteContact(contactId: string) {
    if (confirm('Are you sure you want to delete this contact?')) {
      if (isDeleting.value) {
        return;
      }

      isDeleting.value = true;

      try {
        const requestBody: DeleteRequestBody = { contactId, page };
        const response = await fetch(`/api/contacts/delete`, {
          method: 'POST',
          body: JSON.stringify(requestBody),
        });
        const result = await response.json() as DeleteResponseBody;

        if (!result.success) {
          throw new Error('Failed to delete contact!');
        }

        contacts.value = [...result.contacts];
      } catch (error) {
        console.error(error);
      }

      isDeleting.value = false;
    }
  }

  function onClickImportVCard() {
    isOptionsDropdownOpen.value = false;

    if (isImporting.value) {
      return;
    }

    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.click();

    fileInput.onchange = (event) => {
      const files = (event.target as HTMLInputElement)?.files!;
      const file = files[0];

      if (!file) {
        return;
      }

      const reader = new FileReader();
      reader.onload = async (fileRead) => {
        const importFileContents = fileRead.target?.result;

        if (!importFileContents || isImporting.value) {
          return;
        }

        isImporting.value = true;

        try {
          const partialContacts = parseVCardFromTextContents(importFileContents!.toString());

          const requestBody: ImportRequestBody = { partialContacts, page };
          const response = await fetch(`/api/contacts/import`, {
            method: 'POST',
            body: JSON.stringify(requestBody),
          });
          const result = await response.json() as ImportResponseBody;

          if (!result.success) {
            throw new Error('Failed to import contact!');
          }

          contacts.value = [...result.contacts];
        } catch (error) {
          console.error(error);
        }

        isImporting.value = false;
      };

      reader.readAsText(file, 'UTF-8');
    };
  }

  async function onClickExportVCard() {
    isOptionsDropdownOpen.value = false;

    if (isExporting.value) {
      return;
    }

    isExporting.value = true;

    const fileName = ['contacts-', new Date().toISOString().substring(0, 19).replace(/:/g, '-'), '.vcf']
      .join('');

    try {
      const requestBody: GetRequestBody = {};
      const response = await fetch(`/api/contacts/get`, {
        method: 'POST',
        body: JSON.stringify(requestBody),
      });
      const result = await response.json() as GetResponseBody;

      if (!result.success) {
        throw new Error('Failed to get contact!');
      }

      const exportContents = formatContactToVCard([...result.contacts]);

      // Add content-type
      const vCardContent = ['data:text/vcard; charset=utf-8,', encodeURIComponent(exportContents)].join('');

      // Download the file
      const data = vCardContent;
      const link = document.createElement('a');
      link.setAttribute('href', data);
      link.setAttribute('download', fileName);
      link.click();
      link.remove();
    } catch (error) {
      console.error(error);
    }

    isExporting.value = false;
  }

  const pagesCount = Math.ceil(contactsCount / CONTACTS_PER_PAGE_COUNT);
  const pages = Array.from({ length: pagesCount }).map((_value, index) => index + 1);

  return (
    <>
      <section class='flex flex-row items-center justify-between mb-4'>
        <section class='relative inline-block text-left mr-2'>
          <form method='GET' action='/contacts' class='m-0 p-0'>
            <input
              class='input-field w-60'
              type='search'
              name='search'
              value={search}
              placeholder='Search contacts...'
            />
          </form>
        </section>
        <section class='flex items-center'>
          <section class='relative inline-block text-left ml-2'>
            <div>
              <button
                type='button'
                class='inline-flex w-full justify-center gap-x-1.5 rounded-md bg-slate-700 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-slate-600'
                id='filter-button'
                aria-expanded='true'
                aria-haspopup='true'
                onClick={() => toggleOptionsDropdown()}
              >
                VCF
                <svg class='-mr-1 h-5 w-5 text-slate-400' viewBox='0 0 20 20' fill='currentColor' aria-hidden='true'>
                  <path
                    fill-rule='evenodd'
                    d='M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z'
                    clip-rule='evenodd'
                  />
                </svg>
              </button>
            </div>

            <div
              class={`absolute right-0 z-10 mt-2 w-44 origin-top-right rounded-md bg-slate-700 shadow-lg ring-1 ring-black ring-opacity-15 focus:outline-none ${
                !isOptionsDropdownOpen.value ? 'hidden' : ''
              }`}
              role='menu'
              aria-orientation='vertical'
              aria-labelledby='filter-button'
              tabindex={-1}
            >
              <div class='py-1'>
                <button
                  class={`text-white block px-4 py-2 text-sm w-full text-left hover:bg-slate-600`}
                  onClick={() => onClickImportVCard()}
                >
                  Import vCard
                </button>
                <button
                  class={`text-white block px-4 py-2 text-sm w-full text-left hover:bg-slate-600`}
                  onClick={() => onClickExportVCard()}
                >
                  Export vCard
                </button>
              </div>
            </div>
          </section>
          <button
            class='inline-block justify-center gap-x-1.5 rounded-md bg-[#51A4FB] px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-sky-400 ml-2'
            type='button'
            title='Add new contact'
            onClick={() => onClickAddContact()}
          >
            <img
              src='/images/add.svg'
              alt='Add new contact'
              class={`white ${isAdding.value ? 'animate-spin' : ''}`}
              width={20}
              height={20}
            />
          </button>
        </section>
      </section>

      <section class='mx-auto max-w-7xl my-8'>
        <table class='w-full border-collapse bg-gray-900 text-left text-sm text-slate-500 shadow-sm rounded-t-md'>
          <thead>
            <tr class='border-b border-slate-600'>
              <th scope='col' class='px-6 py-4 font-medium text-white'>First Name</th>
              <th scope='col' class='px-6 py-4 font-medium text-white'>Last Name</th>
              <th scope='col' class='px-6 py-4 font-medium text-white w-20'></th>
            </tr>
          </thead>
          <tbody class='divide-y divide-slate-600 border-t border-slate-600'>
            {contacts.value.map((contact) => (
              <tr class='bg-slate-700 hover:bg-slate-600 group'>
                <td class='flex gap-3 px-6 py-4 font-normal text-white'>
                  <a href={`/contacts/${contact.id}`}>{contact.first_name}</a>
                </td>
                <td class='px-6 py-4 text-slate-200'>
                  {contact.last_name}
                </td>
                <td class='px-6 py-4'>
                  <span
                    class='invisible cursor-pointer group-hover:visible opacity-50 hover:opacity-100'
                    onClick={() => onClickDeleteContact(contact.id)}
                  >
                    <img
                      src='/images/delete.svg'
                      class='red drop-shadow-md'
                      width={24}
                      height={24}
                      alt='Delete contact'
                      title='Delete contact'
                    />
                  </span>
                </td>
              </tr>
            ))}
            {contacts.value.length === 0
              ? (
                <tr>
                  <td class='flex gap-3 px-6 py-4 font-normal' colspan={3}>
                    <div class='text-md'>
                      <div class='font-medium text-slate-400'>No contacts to show</div>
                    </div>
                  </td>
                </tr>
              )
              : null}
          </tbody>
        </table>

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
          {isExporting.value
            ? (
              <>
                <img src='/images/loading.svg' class='white mr-2' width={18} height={18} />Exporting...
              </>
            )
            : null}
          {isImporting.value
            ? (
              <>
                <img src='/images/loading.svg' class='white mr-2' width={18} height={18} />Importing...
              </>
            )
            : null}
          {!isDeleting.value && !isExporting.value && !isImporting.value ? <>&nbsp;</> : null}
        </span>
      </section>

      {pagesCount > 0
        ? (
          <section class='flex justify-end'>
            <nav class='isolate inline-flex -space-x-px rounded-md shadow-sm' aria-label='Pagination'>
              <a
                href={page > 1 ? `/contacts?search=${search}&page=${page - 1}` : 'javascript:void(0)'}
                class='relative inline-flex items-center rounded-l-md px-2 py-2 text-white hover:bg-slate-600 bg-slate-700'
                title='Previous'
              >
                <svg class='h-5 w-5' viewBox='0 0 20 20' fill='currentColor' aria-hidden='true'>
                  <path
                    fill-rule='evenodd'
                    d='M12.79 5.23a.75.75 0 01-.02 1.06L8.832 10l3.938 3.71a.75.75 0 11-1.04 1.08l-4.5-4.25a.75.75 0 010-1.08l4.5-4.25a.75.75 0 011.06.02z'
                    clip-rule='evenodd'
                  />
                </svg>
              </a>
              {pages.map((pageNumber) => {
                const isCurrent = pageNumber === page;

                return (
                  <a
                    href={`/contacts?search=${search}&page=${pageNumber}`}
                    aria-current='page'
                    class={`relative inline-flex items-center ${
                      isCurrent ? 'bg-[#51A4FB] hover:bg-sky-400' : 'bg-slate-700 hover:bg-slate-600'
                    } px-4 py-2 text-sm font-semibold text-white`}
                  >
                    {pageNumber}
                  </a>
                );
              })}
              <a
                href={page < pagesCount ? `/contacts?search=${search}&page=${page + 1}` : 'javascript:void(0)'}
                class='relative inline-flex items-center rounded-r-md px-2 py-2 text-white hover:bg-slate-600 bg-slate-700'
                title='Next'
              >
                <svg class='h-5 w-5' viewBox='0 0 20 20' fill='currentColor' aria-hidden='true'>
                  <path
                    fill-rule='evenodd'
                    d='M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z'
                    clip-rule='evenodd'
                  />
                </svg>
              </a>
            </nav>
          </section>
        )
        : null}

      <section class='flex flex-row items-center justify-start my-12'>
        <span class='font-semibold'>CardDAV URLs:</span>{' '}
        <code class='bg-slate-600 mx-2 px-2 py-1 rounded-md'>{baseUrl}/dav/principals/</code>{' '}
        <code class='bg-slate-600 mx-2 px-2 py-1 rounded-md'>{baseUrl}/dav/addressbooks/</code>
      </section>
    </>
  );
}
