import { useSignal } from '@preact/signals';

import { Directory, DirectoryFile } from '/lib/types.ts';
import {
  RequestBody as CreateDirectoryRequestBody,
  ResponseBody as CreateDirectoryResponseBody,
} from '/pages/api/files/create-directory.ts';
import { useUploadQueue } from '/components/files/useUploadQueue.ts';
import { useDragAndDropUpload } from '/components/files/useDragAndDropUpload.ts';
import FileConflictModal from '/components/files/FileConflictModal.tsx';
import CreateDirectoryModal from '/components/files/CreateDirectoryModal.tsx';
import ListFiles from '/components/files/ListFiles.tsx';
import FilesBreadcrumb from '/components/files/FilesBreadcrumb.tsx';
import ListPhotos from '/components/photos/ListPhotos.tsx';
import { PHOTO_EXTENSIONS } from '/public/ts/utils/photos.ts';

function isPhotoFile(file: File): boolean {
  if (file.type) {
    return file.type.startsWith('image/') || file.type.startsWith('video/');
  }

  // Plenty of sources hand over a file with an empty MIME type (HEIC/HEIF and camera RAW especially), and dropping those silently loses exactly the photos the user meant to upload. The app lists photos by extension anyway, so fall back to the same list it lists by.
  const lowercaseFileName = file.name.toLocaleLowerCase();
  return PHOTO_EXTENSIONS.some((extension) => lowercaseFileName.endsWith(`.${extension}`));
}

interface MainPhotosProps {
  initialDirectories: Directory[];
  initialFiles: DirectoryFile[];
  initialPath: string;
  uploadSessionTag?: string;
}

export default function MainPhotos(
  { initialDirectories, initialFiles, initialPath, uploadSessionTag }: MainPhotosProps,
) {
  const isAdding = useSignal<boolean>(false);
  const directories = useSignal<Directory[]>(initialDirectories);
  const files = useSignal<DirectoryFile[]>(initialFiles);
  const path = useSignal<string>(initialPath);
  const areNewOptionsOption = useSignal<boolean>(false);
  const isNewDirectoryModalOpen = useSignal<boolean>(false);

  // Uploads run inside a service worker (public/sw.js) so they survive a page refresh; this hook enqueues files and hydrates isUploading/uploadProgress/uploadError from its broadcasts. Existing-file checking is done ourselves above (with a replace/skip/replace-all prompt), so the hook's own blanket skip-if-exists check is disabled here.
  const { isUploading, uploadProgress, uploadError, enqueueUpload } = useUploadQueue({
    isEnabled: true,
    path,
    files,
    directories,
    uploadSessionTag,
    uploadKind: 'photo',
    checkExistingFiles: false,
  });

  const {
    isResolvingConflicts,
    resolveProgress,
    isDraggingOver,
    fileConflictModal,
    uploadFiles,
    handleDragEnter,
    handleDragLeave,
    handleDragOver,
    handleDrop,
  } = useDragAndDropUpload({
    path,
    uploadError,
    enqueueUpload,
    onBeforeUpload: () => {
      areNewOptionsOption.value = false;
    },
    fileFilter: isPhotoFile,
    sessionTag: uploadSessionTag ?? '',
  });

  function onClickUploadFile() {
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.multiple = true;
    fileInput.accept = 'image/*,video/*';
    fileInput.click();

    fileInput.onchange = async (event) => {
      const chosenFilesList = (event.target as HTMLInputElement)?.files!;
      const chosenFiles = Array.from(chosenFilesList).filter(Boolean);

      if (chosenFiles.length === 0) {
        return;
      }

      await uploadFiles(chosenFiles);
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
    <div
      class='relative'
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      {/* Drag and drop overlay */}
      {isDraggingOver.value && (
        <div class='fixed inset-0 z-50 bg-black/50 flex items-center justify-center'>
          <div class='bg-[#51A4FB] text-white p-8 rounded-lg border-2 border-dashed border-white max-w-md text-center'>
            <img
              src='/public/images/add.svg'
              alt='Upload'
              class='white mx-auto mb-4'
              width={48}
              height={48}
            />
            <h3 class='text-xl font-semibold mb-2'>Drop photos here to upload</h3>
            <p class='text-sm opacity-90'>Release to upload images and videos to the current directory</p>
          </div>
        </div>
      )}

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
                  class={`white ${
                    isAdding.value || isUploading.value || isResolvingConflicts.value ? 'animate-spin' : ''
                  }`}
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
          {isResolvingConflicts.value
            ? (
              <>
                <img src='/public/images/loading.svg' class='white mr-2' width={18} height={18} />
                {resolveProgress.value || 'Preparing upload...'}
              </>
            )
            : null}
          {isUploading.value
            ? (
              <>
                <img src='/public/images/loading.svg' class='white mr-2' width={18} height={18} />
                {uploadProgress.value || 'Uploading...'}
              </>
            )
            : null}
          {!isAdding.value && !isResolvingConflicts.value && !isUploading.value ? <>&nbsp;</> : null}
        </span>

        {uploadError.value
          ? (
            <span class='flex justify-end items-center text-sm mt-1 mx-2 text-red-400'>
              Upload failed — {uploadError.value}
            </span>
          )
          : null}
      </section>

      <CreateDirectoryModal
        isOpen={isNewDirectoryModalOpen.value}
        onClickSave={onClickSaveDirectory}
        onClose={onCloseCreateDirectory}
      />

      <FileConflictModal
        isOpen={fileConflictModal.value?.isOpen || false}
        filePath={fileConflictModal.value?.filePath || ''}
        onReplace={fileConflictModal.value?.onReplace || (() => {})}
        onSkip={fileConflictModal.value?.onSkip || (() => {})}
        onReplaceAll={fileConflictModal.value?.onReplaceAll || (() => {})}
        onSkipAll={fileConflictModal.value?.onSkipAll || (() => {})}
        onAbort={fileConflictModal.value?.onAbort || (() => {})}
      />
    </div>
  );
}
