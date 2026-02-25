import { useSignal } from '@preact/signals';
import CreateDirectoryModal from "/public/components/files/CreateDirectoryModal.js";
import ListFiles from "/public/components/files/ListFiles.js";
import FilesBreadcrumb from "/public/components/files/FilesBreadcrumb.js";
import ListPhotos from "/public/components/photos/ListPhotos.js";
export default function MainPhotos({
  initialDirectories,
  initialFiles,
  initialPath
}) {
  const isAdding = useSignal(false);
  const isUploading = useSignal(false);
  const directories = useSignal(initialDirectories);
  const files = useSignal(initialFiles);
  const path = useSignal(initialPath);
  const areNewOptionsOption = useSignal(false);
  const isNewDirectoryModalOpen = useSignal(false);
  function onClickUploadFile() {
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.multiple = true;
    fileInput.accept = 'image/*,video/*';
    fileInput.click();
    fileInput.onchange = async event => {
      const chosenFilesList = event.target?.files;
      const chosenFiles = Array.from(chosenFilesList);
      isUploading.value = true;
      for (const chosenFile of chosenFiles) {
        if (!chosenFile) {
          continue;
        }
        areNewOptionsOption.value = false;
        const requestBody = new FormData();
        requestBody.set('parent_path', path.value);
        requestBody.set('path_in_view', path.value);
        requestBody.set('name', chosenFile.name);
        requestBody.set('contents', chosenFile);
        try {
          const response = await fetch(`/api/files/upload`, {
            method: 'POST',
            body: requestBody
          });
          if (!response.ok) {
            throw new Error(`Failed to upload photo. ${response.statusText} ${await response.text()}`);
          }
          const result = await response.json();
          if (!result.success) {
            throw new Error('Failed to upload photo!');
          }
          files.value = [...result.newFiles];
        } catch (error) {
          console.error(error);
        }
      }
      isUploading.value = false;
    };
  }
  function onClickCreateDirectory() {
    if (isNewDirectoryModalOpen.value) {
      isNewDirectoryModalOpen.value = false;
      return;
    }
    isNewDirectoryModalOpen.value = true;
  }
  async function onClickSaveDirectory(newDirectoryName) {
    if (isAdding.value) {
      return;
    }
    if (!newDirectoryName) {
      return;
    }
    areNewOptionsOption.value = false;
    isAdding.value = true;
    try {
      const requestBody = {
        parentPath: path.value,
        name: newDirectoryName
      };
      const response = await fetch(`/api/files/create-directory`, {
        method: 'POST',
        body: JSON.stringify(requestBody)
      });
      if (!response.ok) {
        throw new Error(`Failed to create directory. ${response.statusText} ${await response.text()}`);
      }
      const result = await response.json();
      if (!result.success) {
        throw new Error('Failed to create directory!');
      }
      directories.value = [...result.newDirectories];
      isNewDirectoryModalOpen.value = false;
    } catch (error) {
      console.error(error);
    }
    isAdding.value = false;
  }
  function onCloseCreateDirectory() {
    isNewDirectoryModalOpen.value = false;
  }
  function toggleNewOptionsDropdown() {
    areNewOptionsOption.value = !areNewOptionsOption.value;
  }
  return h(Fragment, null, h("section", {
    class: "flex flex-row items-center justify-between mb-4"
  }, h("section", {
    class: "flex items-center justify-end w-full"
  }, h(FilesBreadcrumb, {
    path: path.value,
    isShowingPhotos: true
  }), h("section", {
    class: "relative inline-block text-left ml-2"
  }, h("div", null, h("button", {
    class: "inline-block justify-center gap-x-1.5 rounded-md bg-[#51A4FB] px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-sky-400 ml-2",
    type: "button",
    title: "Add new file or directory",
    id: "new-button",
    "aria-expanded": "true",
    "aria-haspopup": "true",
    onClick: () => toggleNewOptionsDropdown()
  }, h("img", {
    src: "/public/images/add.svg",
    alt: "Add new file or directory",
    class: `white ${isAdding.value || isUploading.value ? 'animate-spin' : ''}`,
    width: 20,
    height: 20
  }))), h("div", {
    class: `absolute right-0 z-10 mt-2 w-44 origin-top-right rounded-md bg-slate-700 shadow-lg ring-1 ring-black/15 focus:outline-none ${!areNewOptionsOption.value ? 'hidden' : ''}`,
    role: "menu",
    "aria-orientation": "vertical",
    "aria-labelledby": "new-button",
    tabindex: -1
  }, h("div", {
    class: "py-1"
  }, h("button", {
    class: `text-white block px-4 py-2 text-sm w-full text-left hover:bg-slate-600`,
    onClick: () => onClickUploadFile(),
    type: "button"
  }, "Upload Photo"), h("button", {
    class: `text-white block px-4 py-2 text-sm w-full text-left hover:bg-slate-600`,
    onClick: () => onClickCreateDirectory(),
    type: "button"
  }, "New Directory")))))), h("section", {
    class: "mx-auto max-w-7xl my-8"
  }, h(ListFiles, {
    directories: directories.value,
    files: [],
    isShowingPhotos: true
  }), h(ListPhotos, {
    files: files.value
  }), h("span", {
    class: `flex justify-end items-center text-sm mt-1 mx-2 text-slate-100`
  }, isAdding.value ? h(Fragment, null, h("img", {
    src: "/public/images/loading.svg",
    class: "white mr-2",
    width: 18,
    height: 18
  }), "Creating...") : null, isUploading.value ? h(Fragment, null, h("img", {
    src: "/public/images/loading.svg",
    class: "white mr-2",
    width: 18,
    height: 18
  }), "Uploading...") : null, !isAdding.value && !isUploading.value ? h(Fragment, null, "\xA0") : null)), h(CreateDirectoryModal, {
    isOpen: isNewDirectoryModalOpen.value,
    onClickSave: onClickSaveDirectory,
    onClose: onCloseCreateDirectory
  }));
}