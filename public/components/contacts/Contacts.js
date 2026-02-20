import { useSignal } from '@preact/signals';
const CONTACTS_PER_PAGE_COUNT = 10;
export default function Contacts({
  initialContacts,
  initialAddressBooks,
  page,
  contactsCount,
  search,
  initialAddressBookId,
  baseUrl
}) {
  const isAdding = useSignal(false);
  const isDeleting = useSignal(false);
  const isExporting = useSignal(false);
  const isImporting = useSignal(false);
  const contacts = useSignal(initialContacts);
  const addressBooks = useSignal(initialAddressBooks);
  const selectedAddressBookId = useSignal(initialAddressBookId);
  const selectedAddressBookName = useSignal(initialAddressBooks.find(addressBook => addressBook.uid === initialAddressBookId)?.displayName || 'Address Book');
  const isAddressBooksDropdownOpen = useSignal(false);
  const isOptionsDropdownOpen = useSignal(false);
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
      const requestBody = {
        firstName,
        lastName,
        addressBookId: selectedAddressBookId.value
      };
      const response = await fetch(`/api/contacts/add`, {
        method: 'POST',
        body: JSON.stringify(requestBody)
      });
      if (!response.ok) {
        throw new Error(`Failed to add contact. ${response.statusText} ${await response.text()}`);
      }
      const result = await response.json();
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
  async function onClickAddAddressBook() {
    if (isAdding.value) {
      return;
    }
    const name = (prompt(`What's the **name** for the new address book?`) || '').trim();
    if (!name) {
      alert('A name is required for a new address book!');
      return;
    }
    isAdding.value = true;
    isAddressBooksDropdownOpen.value = false;
    try {
      const requestBody = {
        name
      };
      const response = await fetch(`/api/contacts/add-addressbook`, {
        method: 'POST',
        body: JSON.stringify(requestBody)
      });
      if (!response.ok) {
        throw new Error(`Failed to add address book. ${response.statusText} ${await response.text()}`);
      }
      const result = await response.json();
      if (!result.success) {
        throw new Error('Failed to add address book!');
      }
      addressBooks.value = [...result.addressBooks];
    } catch (error) {
      console.error(error);
    }
    isAdding.value = false;
  }
  function toggleAddressBooksDropdown() {
    isAddressBooksDropdownOpen.value = !isAddressBooksDropdownOpen.value;
  }
  function onClickSelectAddressBook(addressBookId) {
    selectedAddressBookId.value = addressBookId;
    selectedAddressBookName.value = addressBooks.value.find(addressBook => addressBook.uid === addressBookId)?.displayName || 'Address Book';
    isAddressBooksDropdownOpen.value = false;
    window.location.href = `/contacts?addressBookId=${addressBookId}`;
  }
  async function onClickDeleteAddressBook(addressBookId) {
    if (confirm('Are you sure you want to delete this address book?')) {
      if (isDeleting.value) {
        return;
      }
      isDeleting.value = true;
      try {
        const requestBody = {
          addressBookId
        };
        const response = await fetch(`/api/contacts/delete-addressbook`, {
          method: 'POST',
          body: JSON.stringify(requestBody)
        });
        if (!response.ok) {
          throw new Error(`Failed to delete address book. ${response.statusText} ${await response.text()}`);
        }
        const result = await response.json();
        if (!result.success) {
          throw new Error('Failed to delete address book!');
        }
        addressBooks.value = [...result.addressBooks];
        selectedAddressBookId.value = '';
        selectedAddressBookName.value = '';
        window.location.href = `/contacts`;
      } catch (error) {
        console.error(error);
      }
      isDeleting.value = false;
    }
  }
  async function onClickDeleteContact(contactId) {
    if (confirm('Are you sure you want to delete this contact?')) {
      if (isDeleting.value) {
        return;
      }
      isDeleting.value = true;
      try {
        const requestBody = {
          contactId,
          addressBookId: selectedAddressBookId.value
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
    fileInput.onchange = event => {
      const files = event.target?.files;
      const file = files[0];
      if (!file) {
        return;
      }
      const reader = new FileReader();
      reader.onload = async fileRead => {
        const importFileContents = fileRead.target?.result;
        if (!importFileContents || isImporting.value) {
          return;
        }
        isImporting.value = true;
        try {
          const vCards = importFileContents.toString();
          const requestBody = {
            addressBookId: selectedAddressBookId.value,
            vCards
          };
          const response = await fetch(`/api/contacts/import`, {
            method: 'POST',
            body: JSON.stringify(requestBody)
          });
          if (!response.ok) {
            throw new Error(`Failed to import contact. ${response.statusText} ${await response.text()}`);
          }
          const result = await response.json();
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
    const fileName = ['contacts-', new Date().toISOString().substring(0, 19).replace(/:/g, '-'), '.vcf'].join('');
    try {
      const requestBody = {
        addressBookId: selectedAddressBookId.value
      };
      const response = await fetch(`/api/contacts/get`, {
        method: 'POST',
        body: JSON.stringify(requestBody)
      });
      if (!response.ok) {
        throw new Error(`Failed to export contact. ${response.statusText} ${await response.text()}`);
      }
      const result = await response.json();
      if (!result.success) {
        throw new Error('Failed to get contact!');
      }
      const exportContents = result.contacts.map(contact => contact.data).join('\n\n');
      const vCardContent = ['data:text/vcard; charset=utf-8,', encodeURIComponent(exportContents)].join('');
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
  const pages = Array.from({
    length: pagesCount
  }).map((_value, index) => index + 1);
  return h(Fragment, null, h("section", {
    class: "flex flex-row items-center justify-between mb-4"
  }, h("section", {
    class: "relative inline-block text-left mr-2"
  }, h("form", {
    method: "GET",
    action: `/contacts?addressBookId=${selectedAddressBookId.value}`,
    class: "m-0 p-0"
  }, h("input", {
    class: "input-field w-60",
    type: "search",
    name: "search",
    value: search,
    placeholder: "Search contacts..."
  }))), h("section", {
    class: "flex items-center"
  }, h("section", {
    class: "relative inline-block text-left ml-2"
  }, h("div", null, h("button", {
    type: "button",
    class: "inline-flex w-full justify-center gap-x-1.5 rounded-md bg-slate-700 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-slate-600 truncate",
    id: "select-address-book-button",
    "aria-expanded": "true",
    "aria-haspopup": "true",
    onClick: () => toggleAddressBooksDropdown()
  }, selectedAddressBookName.value, h("svg", {
    class: "-mr-1 h-5 w-5 text-slate-400",
    viewBox: "0 0 20 20",
    fill: "currentColor",
    "aria-hidden": "true"
  }, h("path", {
    "fill-rule": "evenodd",
    d: "M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z",
    "clip-rule": "evenodd"
  })))), h("div", {
    class: `absolute right-0 z-10 mt-2 w-44 origin-top-right divide-y divide-slate-600 rounded-md bg-slate-700 shadow-lg ring-1 ring-black ring-opacity-15 focus:outline-none ${!isAddressBooksDropdownOpen.value ? 'hidden' : ''}`,
    role: "menu",
    "aria-orientation": "vertical",
    "aria-labelledby": "select-address-book-button",
    tabindex: -1
  }, addressBooks.value.length > 1 ? h("div", {
    class: "py-1"
  }, addressBooks.value.filter(addressBook => addressBook.uid !== selectedAddressBookId.value).map(addressBook => h("button", {
    type: "button",
    class: `text-white block px-4 py-2 text-sm w-full text-left hover:bg-slate-600 truncate`,
    onClick: () => onClickSelectAddressBook(addressBook.uid)
  }, addressBook.displayName))) : null, h("div", {
    class: "py-1"
  }, h("button", {
    type: "button",
    class: `text-white block px-4 py-2 text-sm w-full text-left hover:bg-slate-600`,
    onClick: () => onClickAddAddressBook()
  }, "New Address Book"), h("button", {
    type: "button",
    class: `text-white block px-4 py-2 text-sm w-full text-left hover:bg-red-600`,
    onClick: () => onClickDeleteAddressBook(selectedAddressBookId.value)
  }, "Delete \"", selectedAddressBookName.value, "\"")))), h("section", {
    class: "relative inline-block text-left ml-2"
  }, h("div", null, h("button", {
    type: "button",
    class: "inline-flex w-full justify-center gap-x-1.5 rounded-md bg-slate-700 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-slate-600",
    id: "import-export-button",
    "aria-expanded": "true",
    "aria-haspopup": "true",
    onClick: () => toggleOptionsDropdown()
  }, "VCF", h("svg", {
    class: "-mr-1 h-5 w-5 text-slate-400",
    viewBox: "0 0 20 20",
    fill: "currentColor",
    "aria-hidden": "true"
  }, h("path", {
    "fill-rule": "evenodd",
    d: "M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z",
    "clip-rule": "evenodd"
  })))), h("div", {
    class: `absolute right-0 z-10 mt-2 w-44 origin-top-right rounded-md bg-slate-700 shadow-lg ring-1 ring-black ring-opacity-15 focus:outline-none ${!isOptionsDropdownOpen.value ? 'hidden' : ''}`,
    role: "menu",
    "aria-orientation": "vertical",
    "aria-labelledby": "import-export-button",
    tabindex: -1
  }, h("div", {
    class: "py-1"
  }, h("button", {
    type: "button",
    class: `text-white block px-4 py-2 text-sm w-full text-left hover:bg-slate-600`,
    onClick: () => onClickImportVCard()
  }, "Import vCard"), h("button", {
    type: "button",
    class: `text-white block px-4 py-2 text-sm w-full text-left hover:bg-slate-600`,
    onClick: () => onClickExportVCard()
  }, "Export vCard")))), h("button", {
    class: "inline-block justify-center gap-x-1.5 rounded-md bg-[#51A4FB] px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-sky-400 ml-2",
    type: "button",
    title: "Add new contact",
    onClick: () => onClickAddContact()
  }, h("img", {
    src: "/public/images/add.svg",
    alt: "Add new contact",
    class: `white ${isAdding.value ? 'animate-spin' : ''}`,
    width: 20,
    height: 20
  })))), h("section", {
    class: "mx-auto max-w-7xl my-8"
  }, h("table", {
    class: "w-full border-collapse bg-gray-900 text-left text-sm text-slate-500 shadow-sm rounded-md"
  }, h("thead", null, h("tr", {
    class: "border-b border-slate-600"
  }, h("th", {
    scope: "col",
    class: "px-6 py-4 font-medium text-white"
  }, "First Name"), h("th", {
    scope: "col",
    class: "px-6 py-4 font-medium text-white"
  }, "Last Name"), h("th", {
    scope: "col",
    class: "px-6 py-4 font-medium text-white w-20"
  }))), h("tbody", {
    class: "divide-y divide-slate-600 border-t border-slate-600"
  }, contacts.value.map(contact => h("tr", {
    class: "bg-slate-700 hover:bg-slate-600 group"
  }, h("td", {
    class: "flex gap-3 px-6 py-4 font-normal text-white"
  }, h("a", {
    href: `/contacts/${contact.uid}?addressBookId=${selectedAddressBookId.value}`
  }, contact.firstName)), h("td", {
    class: "px-6 py-4 text-slate-200"
  }, contact.lastName), h("td", {
    class: "px-6 py-4"
  }, h("span", {
    class: "invisible cursor-pointer group-hover:visible opacity-50 hover:opacity-100",
    onClick: () => onClickDeleteContact(contact.uid)
  }, h("img", {
    src: "/public/images/delete.svg",
    class: "red drop-shadow-md",
    width: 24,
    height: 24,
    alt: "Delete contact",
    title: "Delete contact"
  }))))), contacts.value.length === 0 ? h("tr", null, h("td", {
    class: "flex gap-3 px-6 py-4 font-normal",
    colspan: 3
  }, h("div", {
    class: "text-md"
  }, h("div", {
    class: "font-medium text-slate-400"
  }, "No contacts to show")))) : null)), h("span", {
    class: `flex justify-end items-center text-sm mt-1 mx-2 text-slate-100`
  }, isDeleting.value ? h(Fragment, null, h("img", {
    src: "/public/images/loading.svg",
    class: "white mr-2",
    width: 18,
    height: 18
  }), "Deleting...") : null, isExporting.value ? h(Fragment, null, h("img", {
    src: "/public/images/loading.svg",
    class: "white mr-2",
    width: 18,
    height: 18
  }), "Exporting...") : null, isImporting.value ? h(Fragment, null, h("img", {
    src: "/public/images/loading.svg",
    class: "white mr-2",
    width: 18,
    height: 18
  }), "Importing...") : null, !isDeleting.value && !isExporting.value && !isImporting.value ? h(Fragment, null, "\xA0") : null)), pagesCount > 0 ? h("section", {
    class: "flex justify-end"
  }, h("nav", {
    class: "isolate inline-flex -space-x-px rounded-md shadow-sm",
    "aria-label": "Pagination"
  }, h("a", {
    href: page > 1 ? `/contacts?search=${search}&page=${page - 1}&addressBookId=${selectedAddressBookId.value}` : 'javascript:void(0)',
    class: "relative inline-flex items-center rounded-l-md px-2 py-2 text-white hover:bg-slate-600 bg-slate-700",
    title: "Previous"
  }, h("svg", {
    class: "h-5 w-5",
    viewBox: "0 0 20 20",
    fill: "currentColor",
    "aria-hidden": "true"
  }, h("path", {
    "fill-rule": "evenodd",
    d: "M12.79 5.23a.75.75 0 01-.02 1.06L8.832 10l3.938 3.71a.75.75 0 11-1.04 1.08l-4.5-4.25a.75.75 0 010-1.08l4.5-4.25a.75.75 0 011.06.02z",
    "clip-rule": "evenodd"
  }))), pages.map(pageNumber => {
    const isCurrent = pageNumber === page;
    return h("a", {
      href: `/contacts?search=${search}&page=${pageNumber}&addressBookId=${selectedAddressBookId.value}`,
      "aria-current": "page",
      class: `relative inline-flex items-center ${isCurrent ? 'bg-[#51A4FB] hover:bg-sky-400' : 'bg-slate-700 hover:bg-slate-600'} px-4 py-2 text-sm font-semibold text-white`
    }, pageNumber);
  }), h("a", {
    href: page < pagesCount ? `/contacts?search=${search}&page=${page + 1}&addressBookId=${selectedAddressBookId.value}` : 'javascript:void(0)',
    class: "relative inline-flex items-center rounded-r-md px-2 py-2 text-white hover:bg-slate-600 bg-slate-700",
    title: "Next"
  }, h("svg", {
    class: "h-5 w-5",
    viewBox: "0 0 20 20",
    fill: "currentColor",
    "aria-hidden": "true"
  }, h("path", {
    "fill-rule": "evenodd",
    d: "M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z",
    "clip-rule": "evenodd"
  }))))) : null, h("section", {
    class: "flex flex-row items-center justify-start my-12"
  }, h("span", {
    class: "font-semibold"
  }, "CardDAV URL:"), ' ', h("code", {
    class: "bg-slate-600 mx-2 px-2 py-1 rounded-md"
  }, baseUrl, "/carddav")));
}