import { useSignal } from '@preact/signals';
import SearchFiles from "./SearchFiles.js";
import ListFiles from "./ListFiles.js";
import FilesBreadcrumb from "./FilesBreadcrumb.js";
import CreateDirectoryModal from "./CreateDirectoryModal.js";
import RenameDirectoryOrFileModal from "./RenameDirectoryOrFileModal.js";
import MoveDirectoryOrFileModal from "./MoveDirectoryOrFileModal.js";
import CreateShareModal from "./CreateShareModal.js";
import ManageShareModal from "./ManageShareModal.js";
export default function MainFiles({
  initialDirectories,
  initialFiles,
  initialPath,
  baseUrl,
  isFileSharingAllowed,
  areDirectoryDownloadsAllowed,
  fileShareId
}) {
  const isAdding = useSignal(false);
  const isUploading = useSignal(false);
  const isDeleting = useSignal(false);
  const isUpdating = useSignal(false);
  const directories = useSignal(initialDirectories);
  const files = useSignal(initialFiles);
  const path = useSignal(initialPath);
  const chosenDirectories = useSignal([]);
  const chosenFiles = useSignal([]);
  const isAnyItemChosen = chosenDirectories.value.length > 0 || chosenFiles.value.length > 0;
  const bulkItemsCount = chosenDirectories.value.length + chosenFiles.value.length;
  const areNewOptionsOpen = useSignal(false);
  const areBulkOptionsOpen = useSignal(false);
  const isNewDirectoryModalOpen = useSignal(false);
  const renameDirectoryOrFileModal = useSignal(null);
  const moveDirectoryOrFileModal = useSignal(null);
  const createShareModal = useSignal(null);
  const manageShareModal = useSignal(null);
  function onClickUploadFile(uploadDirectory = false) {
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.multiple = true;
    if (uploadDirectory) {
      fileInput.webkitdirectory = true;
      fileInput.mozdirectory = true;
      fileInput.directory = true;
    }
    fileInput.click();
    fileInput.onchange = async event => {
      const chosenFilesList = event.target?.files;
      const chosenFiles = Array.from(chosenFilesList);
      isUploading.value = true;
      for (const chosenFile of chosenFiles) {
        if (!chosenFile) {
          continue;
        }
        areNewOptionsOpen.value = false;
        const requestBody = new FormData();
        requestBody.set('path_in_view', path.value);
        requestBody.set('parent_path', path.value);
        requestBody.set('name', chosenFile.name);
        requestBody.set('contents', chosenFile);
        if (chosenFile.webkitRelativePath) {
          const directoryPath = chosenFile.webkitRelativePath.replace(chosenFile.name, '');
          requestBody.set('parent_path', `${path.value}${directoryPath}`);
        }
        try {
          const response = await fetch(`/api/files/upload`, {
            method: 'POST',
            body: requestBody
          });
          if (!response.ok) {
            throw new Error(`Failed to upload file. ${response.statusText} ${await response.text()}`);
          }
          const result = await response.json();
          if (!result.success) {
            throw new Error('Failed to upload file!');
          }
          files.value = [...result.newFiles];
          directories.value = [...result.newDirectories];
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
    areNewOptionsOpen.value = false;
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
    areNewOptionsOpen.value = !areNewOptionsOpen.value;
  }
  function toggleBulkOptionsDropdown() {
    areBulkOptionsOpen.value = !areBulkOptionsOpen.value;
  }
  function onClickOpenRenameDirectory(parentPath, name) {
    renameDirectoryOrFileModal.value = {
      isOpen: true,
      isDirectory: true,
      parentPath,
      name
    };
  }
  function onClickOpenRenameFile(parentPath, name) {
    renameDirectoryOrFileModal.value = {
      isOpen: true,
      isDirectory: false,
      parentPath,
      name
    };
  }
  function onClickCloseRename() {
    renameDirectoryOrFileModal.value = null;
  }
  async function onClickSaveRenameDirectory(newName) {
    if (isUpdating.value || !renameDirectoryOrFileModal.value?.isOpen || !renameDirectoryOrFileModal.value?.isDirectory) {
      return;
    }
    isUpdating.value = true;
    try {
      const requestBody = {
        parentPath: renameDirectoryOrFileModal.value.parentPath,
        oldName: renameDirectoryOrFileModal.value.name,
        newName
      };
      const response = await fetch(`/api/files/rename-directory`, {
        method: 'POST',
        body: JSON.stringify(requestBody)
      });
      if (!response.ok) {
        throw new Error(`Failed to rename directory. ${response.statusText} ${await response.text()}`);
      }
      const result = await response.json();
      if (!result.success) {
        throw new Error('Failed to rename directory!');
      }
      directories.value = [...result.newDirectories];
    } catch (error) {
      console.error(error);
    }
    isUpdating.value = false;
    renameDirectoryOrFileModal.value = null;
  }
  async function onClickSaveRenameFile(newName) {
    if (isUpdating.value || !renameDirectoryOrFileModal.value?.isOpen || renameDirectoryOrFileModal.value?.isDirectory) {
      return;
    }
    isUpdating.value = true;
    try {
      const requestBody = {
        parentPath: renameDirectoryOrFileModal.value.parentPath,
        oldName: renameDirectoryOrFileModal.value.name,
        newName
      };
      const response = await fetch(`/api/files/rename`, {
        method: 'POST',
        body: JSON.stringify(requestBody)
      });
      if (!response.ok) {
        throw new Error(`Failed to rename file. ${response.statusText} ${await response.text()}`);
      }
      const result = await response.json();
      if (!result.success) {
        throw new Error('Failed to rename file!');
      }
      files.value = [...result.newFiles];
    } catch (error) {
      console.error(error);
    }
    isUpdating.value = false;
    renameDirectoryOrFileModal.value = null;
  }
  function onClickOpenMoveDirectory(parentPath, name) {
    moveDirectoryOrFileModal.value = {
      isOpen: true,
      isDirectory: true,
      path: parentPath,
      name
    };
  }
  function onClickOpenMoveFile(parentPath, name) {
    moveDirectoryOrFileModal.value = {
      isOpen: true,
      isDirectory: false,
      path: parentPath,
      name
    };
  }
  function onClickCloseMove() {
    moveDirectoryOrFileModal.value = null;
  }
  async function onClickSaveMoveDirectory(newPath) {
    if (isUpdating.value || !moveDirectoryOrFileModal.value?.isOpen || !moveDirectoryOrFileModal.value?.isDirectory) {
      return;
    }
    isUpdating.value = true;
    try {
      const requestBody = {
        oldParentPath: moveDirectoryOrFileModal.value.path,
        newParentPath: newPath,
        name: moveDirectoryOrFileModal.value.name
      };
      const response = await fetch(`/api/files/move-directory`, {
        method: 'POST',
        body: JSON.stringify(requestBody)
      });
      if (!response.ok) {
        throw new Error(`Failed to move directory. ${response.statusText} ${await response.text()}`);
      }
      const result = await response.json();
      if (!result.success) {
        throw new Error('Failed to move directory!');
      }
      directories.value = [...result.newDirectories];
    } catch (error) {
      console.error(error);
    }
    isUpdating.value = false;
    moveDirectoryOrFileModal.value = null;
  }
  async function onClickSaveMoveFile(newPath) {
    if (isUpdating.value || !moveDirectoryOrFileModal.value?.isOpen || moveDirectoryOrFileModal.value?.isDirectory) {
      return;
    }
    isUpdating.value = true;
    try {
      const requestBody = {
        oldParentPath: moveDirectoryOrFileModal.value.path,
        newParentPath: newPath,
        name: moveDirectoryOrFileModal.value.name
      };
      const response = await fetch(`/api/files/move`, {
        method: 'POST',
        body: JSON.stringify(requestBody)
      });
      if (!response.ok) {
        throw new Error(`Failed to move file. ${response.statusText} ${await response.text()}`);
      }
      const result = await response.json();
      if (!result.success) {
        throw new Error('Failed to move file!');
      }
      files.value = [...result.newFiles];
    } catch (error) {
      console.error(error);
    }
    isUpdating.value = false;
    moveDirectoryOrFileModal.value = null;
  }
  function onClickDownloadDirectory(parentPath, name) {
    const downloadUrl = `/api/files/download-directory?parentPath=${encodeURIComponent(parentPath)}&name=${encodeURIComponent(name)}`;
    const link = document.createElement('a');
    link.href = downloadUrl;
    link.download = `${name}.zip`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
  async function onClickDeleteDirectory(parentPath, name, isBulkDeleting = false) {
    if (isBulkDeleting || confirm('Are you sure you want to delete this directory?')) {
      if (!isBulkDeleting && isDeleting.value) {
        return;
      }
      isDeleting.value = true;
      try {
        const requestBody = {
          parentPath,
          name
        };
        const response = await fetch(`/api/files/delete-directory`, {
          method: 'POST',
          body: JSON.stringify(requestBody)
        });
        if (!response.ok) {
          throw new Error(`Failed to delete directory. ${response.statusText} ${await response.text()}`);
        }
        const result = await response.json();
        if (!result.success) {
          throw new Error('Failed to delete directory!');
        }
        directories.value = [...result.newDirectories];
      } catch (error) {
        console.error(error);
      }
      isDeleting.value = false;
    }
  }
  async function onClickDeleteFile(parentPath, name, isBulkDeleting = false) {
    if (isBulkDeleting || confirm('Are you sure you want to delete this file?')) {
      if (!isBulkDeleting && isDeleting.value) {
        return;
      }
      isDeleting.value = true;
      try {
        const requestBody = {
          parentPath,
          name
        };
        const response = await fetch(`/api/files/delete`, {
          method: 'POST',
          body: JSON.stringify(requestBody)
        });
        if (!response.ok) {
          throw new Error(`Failed to delete file. ${response.statusText} ${await response.text()}`);
        }
        const result = await response.json();
        if (!result.success) {
          throw new Error('Failed to delete file!');
        }
        files.value = [...result.newFiles];
      } catch (error) {
        console.error(error);
      }
      isDeleting.value = false;
    }
  }
  function onClickChooseDirectory(parentPath, name) {
    if (parentPath === '/' && name === '.Trash') {
      return;
    }
    const chosenDirectoryIndex = chosenDirectories.value.findIndex(directory => directory.parent_path === parentPath && directory.directory_name === name);
    if (chosenDirectoryIndex === -1) {
      chosenDirectories.value = [...chosenDirectories.value, {
        parent_path: parentPath,
        directory_name: name
      }];
    } else {
      const newChosenDirectories = chosenDirectories.peek();
      newChosenDirectories.splice(chosenDirectoryIndex, 1);
      chosenDirectories.value = [...newChosenDirectories];
    }
  }
  function onClickChooseFile(parentPath, name) {
    const chosenFileIndex = chosenFiles.value.findIndex(file => file.parent_path === parentPath && file.file_name === name);
    if (chosenFileIndex === -1) {
      chosenFiles.value = [...chosenFiles.value, {
        parent_path: parentPath,
        file_name: name
      }];
    } else {
      const newChosenFiles = chosenFiles.peek();
      newChosenFiles.splice(chosenFileIndex, 1);
      chosenFiles.value = [...newChosenFiles];
    }
  }
  async function onClickBulkDelete() {
    if (confirm(`Are you sure you want to delete ${bulkItemsCount === 1 ? 'this' : 'these'} ${bulkItemsCount} item${bulkItemsCount === 1 ? '' : 's'}?`)) {
      if (isDeleting.value) {
        return;
      }
      isDeleting.value = true;
      try {
        for (const directory of chosenDirectories.value) {
          await onClickDeleteDirectory(directory.parent_path, directory.directory_name, true);
        }
        for (const file of chosenFiles.value) {
          await onClickDeleteDirectory(file.parent_path, file.file_name, true);
        }
        chosenDirectories.value = [];
        chosenFiles.value = [];
      } catch (error) {
        console.error(error);
      }
      isDeleting.value = false;
    }
  }
  function onClickCreateShare(filePath) {
    if (createShareModal.value?.isOpen) {
      createShareModal.value = null;
      return;
    }
    createShareModal.value = {
      isOpen: true,
      filePath
    };
  }
  async function onClickSaveFileShare(filePath, password) {
    if (isAdding.value) {
      return;
    }
    if (!filePath) {
      return;
    }
    isAdding.value = true;
    try {
      const requestBody = {
        pathInView: path.value,
        filePath,
        password
      };
      const response = await fetch(`/api/files/create-share`, {
        method: 'POST',
        body: JSON.stringify(requestBody)
      });
      if (!response.ok) {
        throw new Error(`Failed to create share. ${response.statusText} ${await response.text()}`);
      }
      const result = await response.json();
      if (!result.success) {
        throw new Error('Failed to create share!');
      }
      directories.value = [...result.newDirectories];
      files.value = [...result.newFiles];
      createShareModal.value = null;
      onClickOpenManageShare(result.createdFileShareId);
    } catch (error) {
      console.error(error);
    }
    isAdding.value = false;
  }
  function onClickCloseFileShare() {
    createShareModal.value = null;
  }
  function onClickOpenManageShare(fileShareId) {
    manageShareModal.value = {
      isOpen: true,
      fileShareId
    };
  }
  async function onClickUpdateFileShare(fileShareId, password) {
    if (isUpdating.value) {
      return;
    }
    if (!fileShareId) {
      return;
    }
    isUpdating.value = true;
    try {
      const requestBody = {
        pathInView: path.value,
        fileShareId,
        password
      };
      const response = await fetch(`/api/files/update-share`, {
        method: 'POST',
        body: JSON.stringify(requestBody)
      });
      if (!response.ok) {
        throw new Error(`Failed to update share. ${response.statusText} ${await response.text()}`);
      }
      const result = await response.json();
      if (!result.success) {
        throw new Error('Failed to update share!');
      }
      directories.value = [...result.newDirectories];
      files.value = [...result.newFiles];
      manageShareModal.value = null;
    } catch (error) {
      console.error(error);
    }
    isUpdating.value = false;
  }
  function onClickCloseManageShare() {
    manageShareModal.value = null;
  }
  async function onClickDeleteFileShare(fileShareId) {
    if (!fileShareId || isDeleting.value || !confirm('Are you sure you want to delete this public share link?')) {
      return;
    }
    isDeleting.value = true;
    try {
      const requestBody = {
        pathInView: path.value,
        fileShareId
      };
      const response = await fetch(`/api/files/delete-share`, {
        method: 'POST',
        body: JSON.stringify(requestBody)
      });
      if (!response.ok) {
        throw new Error(`Failed to delete file share. ${response.statusText} ${await response.text()}`);
      }
      const result = await response.json();
      if (!result.success) {
        throw new Error('Failed to delete file share!');
      }
      directories.value = [...result.newDirectories];
      files.value = [...result.newFiles];
      manageShareModal.value = null;
    } catch (error) {
      console.error(error);
    }
    isDeleting.value = false;
  }
  return h(Fragment, null, h("section", {
    class: "flex flex-row items-center justify-between mb-4"
  }, h("section", {
    class: "relative inline-block text-left mr-2"
  }, h("section", {
    class: "flex flex-row items-center justify-start"
  }, !fileShareId ? h(SearchFiles, null) : null, isAnyItemChosen ? h("section", {
    class: "relative inline-block text-left ml-2"
  }, h("div", null, h("button", {
    class: "inline-block justify-center gap-x-1.5 rounded-md bg-[#51A4FB] px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-sky-400 ml-2 w-11 h-9",
    type: "button",
    title: "Bulk actions",
    id: "bulk-button",
    "aria-expanded": "true",
    "aria-haspopup": "true",
    onClick: () => toggleBulkOptionsDropdown()
  }, h("img", {
    src: `/public/images/${areBulkOptionsOpen.value ? 'hide-options' : 'show-options'}.svg`,
    alt: "Bulk actions",
    class: `white w-5 max-w-5`,
    width: 20,
    height: 20
  }))), h("div", {
    class: `absolute left-0 z-10 mt-2 w-44 origin-top-left rounded-md bg-slate-700 shadow-lg ring-1 ring-black/15 focus:outline-none ${!areBulkOptionsOpen.value ? 'hidden' : ''}`,
    role: "menu",
    "aria-orientation": "vertical",
    "aria-labelledby": "bulk-button",
    tabindex: -1
  }, h("div", {
    class: "py-1"
  }, h("button", {
    class: `text-white block px-4 py-2 text-sm w-full text-left hover:bg-slate-600`,
    onClick: () => onClickBulkDelete(),
    type: "button"
  }, "Delete ", bulkItemsCount, " item", bulkItemsCount === 1 ? '' : 's')))) : null)), h("section", {
    class: "flex items-center justify-end"
  }, h(FilesBreadcrumb, {
    path: path.value,
    fileShareId: fileShareId
  }), !fileShareId ? h("section", {
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
    class: `absolute right-0 z-10 mt-2 w-44 origin-top-right rounded-md bg-slate-700 shadow-lg ring-1 ring-black/15 focus:outline-none ${!areNewOptionsOpen.value ? 'hidden' : ''}`,
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
  }, "Upload Files"), h("button", {
    class: `text-white block px-4 py-2 text-sm w-full text-left hover:bg-slate-600`,
    onClick: () => onClickUploadFile(true),
    type: "button"
  }, "Upload Directory"), h("button", {
    class: `text-white block px-4 py-2 text-sm w-full text-left hover:bg-slate-600`,
    onClick: () => onClickCreateDirectory(),
    type: "button"
  }, "New Directory")))) : null)), h("section", {
    class: "mx-auto max-w-7xl my-8"
  }, h(ListFiles, {
    directories: directories.value,
    files: files.value,
    chosenDirectories: chosenDirectories.value,
    chosenFiles: chosenFiles.value,
    onClickChooseDirectory: onClickChooseDirectory,
    onClickChooseFile: onClickChooseFile,
    onClickOpenRenameDirectory: onClickOpenRenameDirectory,
    onClickOpenRenameFile: onClickOpenRenameFile,
    onClickOpenMoveDirectory: onClickOpenMoveDirectory,
    onClickOpenMoveFile: onClickOpenMoveFile,
    onClickDeleteDirectory: onClickDeleteDirectory,
    onClickDeleteFile: onClickDeleteFile,
    onClickCreateShare: isFileSharingAllowed ? onClickCreateShare : undefined,
    onClickOpenManageShare: isFileSharingAllowed ? onClickOpenManageShare : undefined,
    onClickDownloadDirectory: areDirectoryDownloadsAllowed ? onClickDownloadDirectory : undefined,
    fileShareId: fileShareId
  }), h("span", {
    class: `flex justify-end items-center text-sm mt-1 mx-2 text-slate-100`
  }, isDeleting.value ? h(Fragment, null, h("img", {
    src: "/public/images/loading.svg",
    class: "white mr-2",
    width: 18,
    height: 18
  }), "Deleting...") : null, isAdding.value ? h(Fragment, null, h("img", {
    src: "/public/images/loading.svg",
    class: "white mr-2",
    width: 18,
    height: 18
  }), "Creating...") : null, isUploading.value ? h(Fragment, null, h("img", {
    src: "/public/images/loading.svg",
    class: "white mr-2",
    width: 18,
    height: 18
  }), "Uploading...") : null, isUpdating.value ? h(Fragment, null, h("img", {
    src: "/public/images/loading.svg",
    class: "white mr-2",
    width: 18,
    height: 18
  }), "Updating...") : null, !isDeleting.value && !isAdding.value && !isUploading.value && !isUpdating.value ? h(Fragment, null, "\xA0") : null)), !fileShareId ? h("section", {
    class: "flex flex-row items-center justify-start my-12"
  }, h("span", {
    class: "font-semibold"
  }, "WebDav URL:"), ' ', h("code", {
    class: "bg-slate-600 mx-2 px-2 py-1 rounded-md"
  }, baseUrl, "/dav")) : null, !fileShareId ? h(CreateDirectoryModal, {
    isOpen: isNewDirectoryModalOpen.value,
    onClickSave: onClickSaveDirectory,
    onClose: onCloseCreateDirectory
  }) : null, !fileShareId ? h(RenameDirectoryOrFileModal, {
    isOpen: renameDirectoryOrFileModal.value?.isOpen || false,
    isDirectory: renameDirectoryOrFileModal.value?.isDirectory || false,
    initialName: renameDirectoryOrFileModal.value?.name || '',
    onClickSave: renameDirectoryOrFileModal.value?.isDirectory ? onClickSaveRenameDirectory : onClickSaveRenameFile,
    onClose: onClickCloseRename
  }) : null, !fileShareId ? h(MoveDirectoryOrFileModal, {
    isOpen: moveDirectoryOrFileModal.value?.isOpen || false,
    isDirectory: moveDirectoryOrFileModal.value?.isDirectory || false,
    initialPath: moveDirectoryOrFileModal.value?.path || '',
    name: moveDirectoryOrFileModal.value?.name || '',
    onClickSave: moveDirectoryOrFileModal.value?.isDirectory ? onClickSaveMoveDirectory : onClickSaveMoveFile,
    onClose: onClickCloseMove
  }) : null, !fileShareId && isFileSharingAllowed ? h(CreateShareModal, {
    isOpen: createShareModal.value?.isOpen || false,
    filePath: createShareModal.value?.filePath || '',
    password: createShareModal.value?.password || '',
    onClickSave: onClickSaveFileShare,
    onClose: onClickCloseFileShare
  }) : null, !fileShareId && isFileSharingAllowed ? h(ManageShareModal, {
    baseUrl: baseUrl,
    isOpen: manageShareModal.value?.isOpen || false,
    fileShareId: manageShareModal.value?.fileShareId || '',
    onClickSave: onClickUpdateFileShare,
    onClickDelete: onClickDeleteFileShare,
    onClose: onClickCloseManageShare
  }) : null);
}