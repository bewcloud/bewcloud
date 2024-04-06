import { useSignal } from '@preact/signals';

import { Directory, DirectoryFile } from '/lib/types.ts';
import { baseUrl } from '/lib/utils/misc.ts';
import { ResponseBody as UploadResponseBody } from '/routes/api/files/upload.tsx';
import { RequestBody as RenameRequestBody, ResponseBody as RenameResponseBody } from '/routes/api/files/rename.tsx';
import { RequestBody as MoveRequestBody, ResponseBody as MoveResponseBody } from '/routes/api/files/move.tsx';
import { RequestBody as DeleteRequestBody, ResponseBody as DeleteResponseBody } from '/routes/api/files/delete.tsx';
import {
  RequestBody as CreateDirectoryRequestBody,
  ResponseBody as CreateDirectoryResponseBody,
} from '/routes/api/files/create-directory.tsx';
import {
  RequestBody as RenameDirectoryRequestBody,
  ResponseBody as RenameDirectoryResponseBody,
} from '/routes/api/files/rename-directory.tsx';
import {
  RequestBody as MoveDirectoryRequestBody,
  ResponseBody as MoveDirectoryResponseBody,
} from '/routes/api/files/move-directory.tsx';
import {
  RequestBody as DeleteDirectoryRequestBody,
  ResponseBody as DeleteDirectoryResponseBody,
} from '/routes/api/files/delete-directory.tsx';
import SearchFiles from './SearchFiles.tsx';
import ListFiles from './ListFiles.tsx';
import FilesBreadcrumb from './FilesBreadcrumb.tsx';
import CreateDirectoryModal from './CreateDirectoryModal.tsx';
import RenameDirectoryOrFileModal from './RenameDirectoryOrFileModal.tsx';
import MoveDirectoryOrFileModal from './MoveDirectoryOrFileModal.tsx';

interface MainFilesProps {
  initialDirectories: Directory[];
  initialFiles: DirectoryFile[];
  initialPath: string;
}

export default function MainFiles({ initialDirectories, initialFiles, initialPath }: MainFilesProps) {
  const isAdding = useSignal<boolean>(false);
  const isUploading = useSignal<boolean>(false);
  const isDeleting = useSignal<boolean>(false);
  const isUpdating = useSignal<boolean>(false);
  const directories = useSignal<Directory[]>(initialDirectories);
  const files = useSignal<DirectoryFile[]>(initialFiles);
  const path = useSignal<string>(initialPath);
  const areNewOptionsOption = useSignal<boolean>(false);
  const isNewDirectoryModalOpen = useSignal<boolean>(false);
  const renameDirectoryOrFileModal = useSignal<
    { isOpen: boolean; isDirectory: boolean; parentPath: string; name: string } | null
  >(null);
  const moveDirectoryOrFileModal = useSignal<
    { isOpen: boolean; isDirectory: boolean; path: string; name: string } | null
  >(null);

  function onClickUploadFile() {
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.multiple = true;
    fileInput.click();

    fileInput.onchange = async (event) => {
      const chosenFilesList = (event.target as HTMLInputElement)?.files!;

      const chosenFiles = Array.from(chosenFilesList);

      isUploading.value = true;

      for (const chosenFile of chosenFiles) {
        if (!chosenFile) {
          continue;
        }

        areNewOptionsOption.value = false;

        const requestBody = new FormData();
        requestBody.set('parent_path', path.value);
        requestBody.set('name', chosenFile.name);
        requestBody.set('contents', chosenFile);

        try {
          const response = await fetch(`/api/files/upload`, {
            method: 'POST',
            body: requestBody,
          });
          const result = await response.json() as UploadResponseBody;

          if (!result.success) {
            throw new Error('Failed to upload file!');
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

  async function onClickSaveDirectory(newDirectoryName: string) {
    if (isAdding.value) {
      return;
    }

    if (!newDirectoryName) {
      return;
    }

    areNewOptionsOption.value = false;
    isAdding.value = true;

    try {
      const requestBody: CreateDirectoryRequestBody = {
        parentPath: path.value,
        name: newDirectoryName,
      };
      const response = await fetch(`/api/files/create-directory`, {
        method: 'POST',
        body: JSON.stringify(requestBody),
      });
      const result = await response.json() as CreateDirectoryResponseBody;

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

  function onClickOpenRenameDirectory(parentPath: string, name: string) {
    renameDirectoryOrFileModal.value = {
      isOpen: true,
      isDirectory: true,
      parentPath,
      name,
    };
  }

  function onClickOpenRenameFile(parentPath: string, name: string) {
    renameDirectoryOrFileModal.value = {
      isOpen: true,
      isDirectory: false,
      parentPath,
      name,
    };
  }

  function onClickCloseRename() {
    renameDirectoryOrFileModal.value = null;
  }

  async function onClickSaveRenameDirectory(newName: string) {
    if (
      isUpdating.value || !renameDirectoryOrFileModal.value?.isOpen || !renameDirectoryOrFileModal.value?.isDirectory
    ) {
      return;
    }

    isUpdating.value = true;

    try {
      const requestBody: RenameDirectoryRequestBody = {
        parentPath: renameDirectoryOrFileModal.value.parentPath,
        oldName: renameDirectoryOrFileModal.value.name,
        newName,
      };
      const response = await fetch(`/api/files/rename-directory`, {
        method: 'POST',
        body: JSON.stringify(requestBody),
      });
      const result = await response.json() as RenameDirectoryResponseBody;

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

  async function onClickSaveRenameFile(newName: string) {
    if (
      isUpdating.value || !renameDirectoryOrFileModal.value?.isOpen || renameDirectoryOrFileModal.value?.isDirectory
    ) {
      return;
    }

    isUpdating.value = true;

    try {
      const requestBody: RenameRequestBody = {
        parentPath: renameDirectoryOrFileModal.value.parentPath,
        oldName: renameDirectoryOrFileModal.value.name,
        newName,
      };
      const response = await fetch(`/api/files/rename`, {
        method: 'POST',
        body: JSON.stringify(requestBody),
      });
      const result = await response.json() as RenameResponseBody;

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

  function onClickOpenMoveDirectory(parentPath: string, name: string) {
    moveDirectoryOrFileModal.value = {
      isOpen: true,
      isDirectory: true,
      path: parentPath,
      name,
    };
  }

  function onClickOpenMoveFile(parentPath: string, name: string) {
    moveDirectoryOrFileModal.value = {
      isOpen: true,
      isDirectory: false,
      path: parentPath,
      name,
    };
  }

  function onClickCloseMove() {
    moveDirectoryOrFileModal.value = null;
  }

  async function onClickSaveMoveDirectory(newPath: string) {
    if (isUpdating.value || !moveDirectoryOrFileModal.value?.isOpen || !moveDirectoryOrFileModal.value?.isDirectory) {
      return;
    }

    isUpdating.value = true;

    try {
      const requestBody: MoveDirectoryRequestBody = {
        oldParentPath: moveDirectoryOrFileModal.value.path,
        newParentPath: newPath,
        name: moveDirectoryOrFileModal.value.name,
      };
      const response = await fetch(`/api/files/move-directory`, {
        method: 'POST',
        body: JSON.stringify(requestBody),
      });
      const result = await response.json() as MoveDirectoryResponseBody;

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

  async function onClickSaveMoveFile(newPath: string) {
    if (isUpdating.value || !moveDirectoryOrFileModal.value?.isOpen || moveDirectoryOrFileModal.value?.isDirectory) {
      return;
    }

    isUpdating.value = true;

    try {
      const requestBody: MoveRequestBody = {
        oldParentPath: moveDirectoryOrFileModal.value.path,
        newParentPath: newPath,
        name: moveDirectoryOrFileModal.value.name,
      };
      const response = await fetch(`/api/files/move`, {
        method: 'POST',
        body: JSON.stringify(requestBody),
      });
      const result = await response.json() as MoveResponseBody;

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

  async function onClickDeleteDirectory(parentPath: string, name: string) {
    if (confirm('Are you sure you want to delete this directory?')) {
      if (isDeleting.value) {
        return;
      }

      isDeleting.value = true;

      try {
        const requestBody: DeleteDirectoryRequestBody = {
          parentPath,
          name,
        };
        const response = await fetch(`/api/files/delete-directory`, {
          method: 'POST',
          body: JSON.stringify(requestBody),
        });
        const result = await response.json() as DeleteDirectoryResponseBody;

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

  async function onClickDeleteFile(parentPath: string, name: string) {
    if (confirm('Are you sure you want to delete this file?')) {
      if (isDeleting.value) {
        return;
      }

      isDeleting.value = true;

      try {
        const requestBody: DeleteRequestBody = {
          parentPath,
          name,
        };
        const response = await fetch(`/api/files/delete`, {
          method: 'POST',
          body: JSON.stringify(requestBody),
        });
        const result = await response.json() as DeleteResponseBody;

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

  return (
    <>
      <section class='flex flex-row items-center justify-between mb-4'>
        <section class='relative inline-block text-left mr-2'>
          <section class='flex flex-row items-center justify-start'>
            <SearchFiles />
          </section>
        </section>

        <section class='flex items-center justify-end'>
          <FilesBreadcrumb path={path.value} />

          <section class='relative inline-block text-left ml-2'>
            <div>
              <button
                class='inline-block justify-center gap-x-1.5 rounded-md bg-[#51A4FB] px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-sky-400 ml-2'
                type='button'
                title='Add new event'
                id='new-button'
                aria-expanded='true'
                aria-haspopup='true'
                onClick={() => toggleNewOptionsDropdown()}
              >
                <img
                  src='/images/add.svg'
                  alt='Add new file or directory'
                  class={`white ${isAdding.value || isUploading.value ? 'animate-spin' : ''}`}
                  width={20}
                  height={20}
                />
              </button>
            </div>

            <div
              class={`absolute right-0 z-10 mt-2 w-44 origin-top-right rounded-md bg-slate-700 shadow-lg ring-1 ring-black ring-opacity-15 focus:outline-none ${
                !areNewOptionsOption.value ? 'hidden' : ''
              }`}
              role='menu'
              aria-orientation='vertical'
              aria-labelledby='new-button'
              tabindex={-1}
            >
              <div class='py-1'>
                <button
                  class={`text-white block px-4 py-2 text-sm w-full text-left hover:bg-slate-600`}
                  onClick={() => onClickUploadFile()}
                >
                  Upload File
                </button>
                <button
                  class={`text-white block px-4 py-2 text-sm w-full text-left hover:bg-slate-600`}
                  onClick={() => onClickCreateDirectory()}
                >
                  New Directory
                </button>
              </div>
            </div>
          </section>
        </section>
      </section>

      <section class='mx-auto max-w-7xl my-8'>
        <ListFiles
          directories={directories.value}
          files={files.value}
          onClickOpenRenameDirectory={onClickOpenRenameDirectory}
          onClickOpenRenameFile={onClickOpenRenameFile}
          onClickOpenMoveDirectory={onClickOpenMoveDirectory}
          onClickOpenMoveFile={onClickOpenMoveFile}
          onClickDeleteDirectory={onClickDeleteDirectory}
          onClickDeleteFile={onClickDeleteFile}
        />

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
          {isAdding.value
            ? (
              <>
                <img src='/images/loading.svg' class='white mr-2' width={18} height={18} />Creating...
              </>
            )
            : null}
          {isUploading.value
            ? (
              <>
                <img src='/images/loading.svg' class='white mr-2' width={18} height={18} />Uploading...
              </>
            )
            : null}
          {isUpdating.value
            ? (
              <>
                <img src='/images/loading.svg' class='white mr-2' width={18} height={18} />Updating...
              </>
            )
            : null}
          {!isDeleting.value && !isAdding.value && !isUploading.value && !isUpdating.value ? <>&nbsp;</> : null}
        </span>
      </section>

      <section class='flex flex-row items-center justify-start my-12'>
        <span class='font-semibold'>WebDav URL:</span>{' '}
        <code class='bg-slate-600 mx-2 px-2 py-1 rounded-md'>{baseUrl}/dav</code>
      </section>

      <CreateDirectoryModal
        isOpen={isNewDirectoryModalOpen.value}
        onClickSave={onClickSaveDirectory}
        onClose={onCloseCreateDirectory}
      />

      <RenameDirectoryOrFileModal
        isOpen={renameDirectoryOrFileModal.value?.isOpen || false}
        isDirectory={renameDirectoryOrFileModal.value?.isDirectory || false}
        initialName={renameDirectoryOrFileModal.value?.name || ''}
        onClickSave={renameDirectoryOrFileModal.value?.isDirectory ? onClickSaveRenameDirectory : onClickSaveRenameFile}
        onClose={onClickCloseRename}
      />

      <MoveDirectoryOrFileModal
        isOpen={moveDirectoryOrFileModal.value?.isOpen || false}
        isDirectory={moveDirectoryOrFileModal.value?.isDirectory || false}
        initialPath={moveDirectoryOrFileModal.value?.path || ''}
        name={moveDirectoryOrFileModal.value?.name || ''}
        onClickSave={moveDirectoryOrFileModal.value?.isDirectory ? onClickSaveMoveDirectory : onClickSaveMoveFile}
        onClose={onClickCloseMove}
      />
    </>
  );
}
