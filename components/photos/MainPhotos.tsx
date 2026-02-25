import { useSignal } from '@preact/signals';

import { Directory, DirectoryFile } from '/lib/types.ts';
import { ResponseBody as UploadResponseBody } from '/pages/api/files/upload.ts';
import {
  RequestBody as CreateDirectoryRequestBody,
  ResponseBody as CreateDirectoryResponseBody,
} from '/pages/api/files/create-directory.ts';
import CreateDirectoryModal from '/components/files/CreateDirectoryModal.tsx';
import ListFiles from '/components/files/ListFiles.tsx';
import FilesBreadcrumb from '/components/files/FilesBreadcrumb.tsx';
import ListPhotos from '/components/photos/ListPhotos.tsx';

interface MainPhotosProps {
  initialDirectories: Directory[];
  initialFiles: DirectoryFile[];
  initialPath: string;
}

export default function MainPhotos({ initialDirectories, initialFiles, initialPath }: MainPhotosProps) {
  const isAdding = useSignal<boolean>(false);
  const isUploading = useSignal<boolean>(false);
  const directories = useSignal<Directory[]>(initialDirectories);
  const files = useSignal<DirectoryFile[]>(initialFiles);
  const path = useSignal<string>(initialPath);
  const areNewOptionsOption = useSignal<boolean>(false);
  const isNewDirectoryModalOpen = useSignal<boolean>(false);

  function onClickUploadFile() {
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.multiple = true;
    fileInput.accept = 'image/*,video/*';
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
        requestBody.set('path_in_view', path.value);
        requestBody.set('name', chosenFile.name);
        requestBody.set('contents', chosenFile);

        try {
          const response = await fetch(`/api/files/upload`, {
            method: 'POST',
            body: requestBody,
          });

          if (!response.ok) {
            throw new Error(`Failed to upload photo. ${response.statusText} ${await response.text()}`);
          }

          const result = await response.json() as UploadResponseBody;

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

      if (!response.ok) {
        throw new Error(`Failed to create directory. ${response.statusText} ${await response.text()}`);
      }

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

  return (
    <>
      <section class='flex flex-row items-center justify-between mb-4'>
        <section class='flex items-center justify-end w-full'>
          <FilesBreadcrumb path={path.value} isShowingPhotos />

          <section class='relative inline-block text-left ml-2'>
            <div>
              <button
                class='inline-block justify-center gap-x-1.5 rounded-md bg-[#51A4FB] px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-sky-400 ml-2'
                type='button'
                title='Add new file or directory'
                id='new-button'
                aria-expanded='true'
                aria-haspopup='true'
                onClick={() => toggleNewOptionsDropdown()}
              >
                <img
                  src='/public/images/add.svg'
                  alt='Add new file or directory'
                  class={`white ${isAdding.value || isUploading.value ? 'animate-spin' : ''}`}
                  width={20}
                  height={20}
                />
              </button>
            </div>

            <div
              class={`absolute right-0 z-10 mt-2 w-44 origin-top-right rounded-md bg-slate-700 shadow-lg ring-1 ring-black/15 focus:outline-none ${
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
                  type='button'
                >
                  Upload Photo
                </button>
                <button
                  class={`text-white block px-4 py-2 text-sm w-full text-left hover:bg-slate-600`}
                  onClick={() => onClickCreateDirectory()}
                  type='button'
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
          files={[]}
          isShowingPhotos
        />

        <ListPhotos
          files={files.value}
        />

        <span
          class={`flex justify-end items-center text-sm mt-1 mx-2 text-slate-100`}
        >
          {isAdding.value
            ? (
              <>
                <img src='/public/images/loading.svg' class='white mr-2' width={18} height={18} />Creating...
              </>
            )
            : null}
          {isUploading.value
            ? (
              <>
                <img src='/public/images/loading.svg' class='white mr-2' width={18} height={18} />Uploading...
              </>
            )
            : null}
          {!isAdding.value && !isUploading.value ? <>&nbsp;</> : null}
        </span>
      </section>

      <CreateDirectoryModal
        isOpen={isNewDirectoryModalOpen.value}
        onClickSave={onClickSaveDirectory}
        onClose={onCloseCreateDirectory}
      />
    </>
  );
}
