import { useSignal } from '@preact/signals';

import { Directory, DirectoryFile } from '/lib/types.ts';
import { ResponseBody as UploadResponseBody } from '/pages/api/files/upload.ts';
import { RequestBody as DeleteRequestBody, ResponseBody as DeleteResponseBody } from '/pages/api/files/delete.ts';
import {
  RequestBody as CreateDirectoryRequestBody,
  ResponseBody as CreateDirectoryResponseBody,
} from '/pages/api/files/create-directory.ts';
import {
  RequestBody as DeleteDirectoryRequestBody,
  ResponseBody as DeleteDirectoryResponseBody,
} from '/pages/api/files/delete-directory.ts';
import ListFiles from '/components/files/ListFiles.tsx';
import FilesBreadcrumb from '/components/files/FilesBreadcrumb.tsx';
import CreateDirectoryModal from '/components/files/CreateDirectoryModal.tsx';
import CreateNoteModal from './CreateNoteModal.tsx';

interface MainNotesProps {
  initialDirectories: Directory[];
  initialFiles: DirectoryFile[];
  initialPath: string;
}

export default function MainNotes({ initialDirectories, initialFiles, initialPath }: MainNotesProps) {
  const isAdding = useSignal<boolean>(false);
  const isDeleting = useSignal<boolean>(false);
  const directories = useSignal<Directory[]>(initialDirectories);
  const files = useSignal<DirectoryFile[]>(initialFiles);
  const path = useSignal<string>(initialPath);
  const areNewOptionsOption = useSignal<boolean>(false);
  const isNewNoteModalOpen = useSignal<boolean>(false);
  const isNewDirectoryModalOpen = useSignal<boolean>(false);

  function onClickCreateNote() {
    if (isNewNoteModalOpen.value) {
      isNewNoteModalOpen.value = false;
      return;
    }

    isNewNoteModalOpen.value = true;
  }

  async function onClickSaveNote(newNoteName: string) {
    if (isAdding.value) {
      return;
    }

    if (!newNoteName) {
      return;
    }

    areNewOptionsOption.value = false;
    isAdding.value = true;

    const requestBody = new FormData();
    requestBody.set('parent_path', path.value);
    requestBody.set('path_in_view', path.value);
    requestBody.set('name', `${newNoteName}.md`);
    requestBody.set('contents', `# ${newNoteName}\n\nStart your new note!\n`);

    try {
      const response = await fetch(`/api/files/upload`, {
        method: 'POST',
        body: requestBody,
      });

      if (!response.ok) {
        throw new Error(`Failed to create note. ${response.statusText} ${await response.text()}`);
      }

      const result = await response.json() as UploadResponseBody;

      if (!result.success) {
        throw new Error('Failed to create note!');
      }

      files.value = [...result.newFiles];

      isNewNoteModalOpen.value = false;
    } catch (error) {
      console.error(error);
    }

    isAdding.value = false;
  }

  function onCloseCreateNote() {
    isNewNoteModalOpen.value = false;
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

        if (!response.ok) {
          throw new Error(`Failed to delete directory. ${response.statusText} ${await response.text()}`);
        }

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
    if (confirm('Are you sure you want to delete this note?')) {
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

        if (!response.ok) {
          throw new Error(`Failed to delete note. ${response.statusText} ${await response.text()}`);
        }

        const result = await response.json() as DeleteResponseBody;

        if (!result.success) {
          throw new Error('Failed to delete note!');
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
        <section class='flex items-center justify-end w-full'>
          <FilesBreadcrumb path={path.value} isShowingNotes />

          <section class='relative inline-block text-left ml-2'>
            <div>
              <button
                class='inline-block justify-center gap-x-1.5 rounded-md bg-[#51A4FB] px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-sky-400 ml-2'
                type='button'
                title='Add new note or directory'
                id='new-button'
                aria-expanded='true'
                aria-haspopup='true'
                onClick={() => toggleNewOptionsDropdown()}
              >
                <img
                  src='/public/images/add.svg'
                  alt='Add new note or directory'
                  class={`white ${isAdding.value ? 'animate-spin' : ''}`}
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
                  onClick={() => onClickCreateNote()}
                  type='button'
                >
                  New Note
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
          files={files.value}
          onClickDeleteDirectory={onClickDeleteDirectory}
          onClickDeleteFile={onClickDeleteFile}
          isShowingNotes
        />

        <span
          class={`flex justify-end items-center text-sm mt-1 mx-2 text-slate-100`}
        >
          {isDeleting.value
            ? (
              <>
                <img src='/public/images/loading.svg' class='white mr-2' width={18} height={18} />Deleting...
              </>
            )
            : null}
          {isAdding.value
            ? (
              <>
                <img src='/public/images/loading.svg' class='white mr-2' width={18} height={18} />Creating...
              </>
            )
            : null}
          {!isDeleting.value && !isAdding.value ? <>&nbsp;</> : null}
        </span>
      </section>

      <CreateDirectoryModal
        isOpen={isNewDirectoryModalOpen.value}
        onClickSave={onClickSaveDirectory}
        onClose={onCloseCreateDirectory}
      />

      <CreateNoteModal
        isOpen={isNewNoteModalOpen.value}
        onClickSave={onClickSaveNote}
        onClose={onCloseCreateNote}
      />
    </>
  );
}
