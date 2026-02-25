import { useSignal } from '@preact/signals';
import { useEffect } from 'preact/hooks';
export default function SearchFiles() {
  const isSearching = useSignal(false);
  const areResultsVisible = useSignal(false);
  const matchingDirectories = useSignal([]);
  const matchingFiles = useSignal([]);
  const searchTimeout = useSignal(0);
  const closeTimeout = useSignal(0);
  const dateFormatOptions = {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  };
  const dateFormat = new Intl.DateTimeFormat('en-GB', dateFormatOptions);
  function searchFiles(searchTerm) {
    if (searchTimeout.value) {
      clearTimeout(searchTimeout.value);
    }
    if (searchTerm.trim().length < 2) {
      return;
    }
    areResultsVisible.value = false;
    searchTimeout.value = setTimeout(async () => {
      isSearching.value = true;
      try {
        const requestBody = {
          searchTerm
        };
        const response = await fetch(`/api/files/search`, {
          method: 'POST',
          body: JSON.stringify(requestBody)
        });
        if (!response.ok) {
          throw new Error(`Failed to search files. ${response.statusText} ${await response.text()}`);
        }
        const result = await response.json();
        if (!result.success) {
          throw new Error('Failed to search files!');
        }
        matchingDirectories.value = [...result.directories];
        matchingFiles.value = [...result.files];
        if (matchingDirectories.value.length > 0 || matchingFiles.value.length > 0) {
          areResultsVisible.value = true;
        }
      } catch (error) {
        console.error(error);
      }
      isSearching.value = false;
    }, 500);
  }
  function onFocus() {
    if (matchingDirectories.value.length > 0 || matchingFiles.value.length > 0) {
      areResultsVisible.value = true;
    }
  }
  function onBlur() {
    if (closeTimeout.value) {
      clearTimeout(closeTimeout.value);
    }
    closeTimeout.value = setTimeout(() => {
      areResultsVisible.value = false;
    }, 300);
  }
  useEffect(() => {
    return () => {
      if (searchTimeout.value) {
        clearTimeout(searchTimeout.value);
      }
      if (closeTimeout.value) {
        clearTimeout(closeTimeout.value);
      }
    };
  }, []);
  return h(Fragment, null, h("input", {
    class: "input-field w-72 mr-2",
    type: "search",
    name: "search",
    placeholder: "Search files...",
    onInput: event => searchFiles(event.currentTarget.value),
    onFocus: () => onFocus(),
    onBlur: () => onBlur()
  }), isSearching.value ? h("img", {
    src: "/public/images/loading.svg",
    class: "white mr-2",
    width: 18,
    height: 18
  }) : null, areResultsVisible.value ? h("section", {
    class: "relative inline-block text-left ml-2 text-sm"
  }, h("section", {
    class: `absolute right-0 z-10 mt-2 w-80 origin-top-right rounded-md bg-slate-600 shadow-lg ring-1 ring-black/15 focus:outline-none overflow-y-scroll max-h-[80%] min-h-56`,
    role: "menu",
    "aria-orientation": "vertical",
    "aria-labelledby": "view-button",
    tabindex: -1
  }, h("section", {
    class: "py-1"
  }, h("ol", {
    class: "mt-2"
  }, matchingDirectories.value.map(directory => h("li", {
    class: "mb-1"
  }, h("a", {
    href: `/files?path=${encodeURIComponent(directory.parent_path)}${encodeURIComponent(directory.directory_name)}`,
    class: `block px-2 py-2 hover:no-underline hover:opacity-60 bg-slate-700 cursor-pointer font-normal`,
    target: "_blank",
    rel: "noopener noreferrer"
  }, h("time", {
    datetime: new Date(directory.updated_at).toISOString(),
    class: "mr-2 flex-none text-slate-100 block text-xs"
  }, dateFormat.format(new Date(directory.updated_at))), h("p", {
    class: "flex-auto truncate font-medium text-white"
  }, directory.directory_name)))), matchingFiles.value.map(file => h("li", {
    class: "mb-1"
  }, h("a", {
    href: `/files/open/${encodeURIComponent(file.file_name)}?path=${encodeURIComponent(file.parent_path)}`,
    class: `block px-2 py-2 hover:no-underline hover:opacity-60 bg-slate-700 cursor-pointer font-normal`,
    target: "_blank",
    rel: "noopener noreferrer"
  }, h("time", {
    datetime: new Date(file.updated_at).toISOString(),
    class: "mr-2 flex-none text-slate-100 block text-xs"
  }, dateFormat.format(new Date(file.updated_at))), h("p", {
    class: "flex-auto truncate font-medium text-white"
  }, file.file_name)))))))) : null);
}