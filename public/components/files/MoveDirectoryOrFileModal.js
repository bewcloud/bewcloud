import { useSignal } from '@preact/signals';
import { useEffect } from 'preact/hooks';
export default function MoveDirectoryOrFileModal({
  isOpen,
  initialPath,
  isDirectory,
  name,
  onClickSave,
  onClose
}) {
  const newPath = useSignal(initialPath);
  const isLoading = useSignal(false);
  const directories = useSignal([]);
  useEffect(() => {
    newPath.value = initialPath;
    fetchDirectories();
  }, [initialPath]);
  async function fetchDirectories() {
    if (!initialPath) {
      return;
    }
    isLoading.value = true;
    try {
      const requestBody = {
        parentPath: newPath.value,
        directoryPathToExclude: isDirectory ? `${initialPath}${name}` : ''
      };
      const response = await fetch(`/api/files/get-directories`, {
        method: 'POST',
        body: JSON.stringify(requestBody)
      });
      if (!response.ok) {
        throw new Error(`Failed to get directories. ${response.statusText} ${await response.text()}`);
      }
      const result = await response.json();
      if (!result.success) {
        throw new Error('Failed to get directories!');
      }
      directories.value = [...result.directories];
      isLoading.value = false;
    } catch (error) {
      console.error(error);
    }
  }
  async function onChooseNewDirectory(chosenPath) {
    newPath.value = chosenPath;
    await fetchDirectories();
  }
  const parentPath = newPath.value === '/' ? null : `/${newPath.peek().split('/').filter(Boolean).slice(0, -1).join('/')}`;
  if (!name) {
    return null;
  }
  return h(Fragment, null, h("section", {
    class: `fixed ${isOpen ? 'block' : 'hidden'} z-40 w-screen h-screen inset-0 bg-gray-900/60`
  }), h("section", {
    class: `fixed ${isOpen ? 'block' : 'hidden'} z-50 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 bg-slate-600 text-white rounded-md px-8 py-6 drop-shadow-lg overflow-y-scroll max-h-[80%]`
  }, h("h1", {
    class: "text-2xl font-semibold my-5"
  }, "Move \"", name, "\" into \"", newPath.value, "\""), h("section", {
    class: "py-5 my-2 border-y border-slate-500"
  }, h("ol", {
    class: "mt-2"
  }, parentPath ? h("li", {
    class: "mb-1"
  }, h("span", {
    class: `block px-2 py-2 hover:no-underline hover:opacity-60 bg-slate-700 cursor-pointer rounded-md`,
    onClick: () => onChooseNewDirectory(parentPath === '/' ? parentPath : `${parentPath}/`)
  }, h("p", {
    class: "flex-auto truncate font-medium text-white"
  }, ".."))) : null, directories.value.map(directory => h("li", {
    class: "mb-1"
  }, h("span", {
    class: `block px-2 py-2 hover:no-underline hover:opacity-60 bg-slate-700 cursor-pointer rounded-md`,
    onClick: () => onChooseNewDirectory(`${directory.parent_path}${directory.directory_name}/`)
  }, h("p", {
    class: "flex-auto truncate font-medium text-white"
  }, directory.directory_name))))), h("span", {
    class: `flex justify-end items-center text-sm mt-1 mx-2 text-slate-100`
  }, isLoading.value ? h(Fragment, null, h("img", {
    src: "/public/images/loading.svg",
    class: "white mr-2",
    width: 18,
    height: 18
  }), "Loading...") : null, !isLoading.value ? h(Fragment, null, "\xA0") : null)), h("footer", {
    class: "flex justify-between"
  }, h("button", {
    class: "px-5 py-2 bg-slate-600 hover:bg-slate-500 text-white cursor-pointer rounded-md",
    onClick: () => onClickSave(newPath.value),
    type: "button"
  }, "Move ", isDirectory ? 'directory' : 'file', " here"), h("button", {
    class: "px-5 py-2 bg-slate-600 hover:bg-slate-500 text-white cursor-pointer rounded-md",
    onClick: () => onClose(),
    type: "button"
  }, "Close"))));
}