import { useSignal } from '@preact/signals';
import { useEffect } from 'preact/hooks';

import { RequestBody, ResponseBody } from '/routes/api/files/get-directories.tsx';
import { Directory } from '/lib/types.ts';

interface MoveDirectoryOrFileModalProps {
  isOpen: boolean;
  initialPath: string;
  isDirectory: boolean;
  name: string;
  onClickSave: (newPath: string) => Promise<void>;
  onClose: () => void;
}

export default function MoveDirectoryOrFileModal(
  { isOpen, initialPath, isDirectory, name, onClickSave, onClose }: MoveDirectoryOrFileModalProps,
) {
  const newPath = useSignal<string>(initialPath);
  const isLoading = useSignal<boolean>(false);
  const directories = useSignal<Directory[]>([]);

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
      const requestBody: RequestBody = {
        parentPath: newPath.value,
        directoryPathToExclude: isDirectory ? `${initialPath}${name}` : '',
      };
      const response = await fetch(`/api/files/get-directories`, {
        method: 'POST',
        body: JSON.stringify(requestBody),
      });
      const result = await response.json() as ResponseBody;

      if (!result.success) {
        throw new Error('Failed to get directories!');
      }

      directories.value = [...result.directories];

      isLoading.value = false;
    } catch (error) {
      console.error(error);
    }
  }

  async function onChooseNewDirectory(chosenPath: string) {
    newPath.value = chosenPath;

    await fetchDirectories();
  }

  const parentPath = newPath.value === '/'
    ? null
    : `/${newPath.peek().split('/').filter(Boolean).slice(0, -1).join('/')}`;

  if (!name) {
    return null;
  }

  return (
    <>
      <section
        class={`fixed ${isOpen ? 'block' : 'hidden'} z-40 w-screen h-screen inset-0 bg-gray-900 bg-opacity-60`}
      >
      </section>

      <section
        class={`fixed ${
          isOpen ? 'block' : 'hidden'
        } z-50 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 bg-slate-600 text-white rounded-md px-8 py-6 drop-shadow-lg overflow-y-scroll max-h-[80%]`}
      >
        <h1 class='text-2xl font-semibold my-5'>Move "{name}" into "{newPath.value}"</h1>
        <section class='py-5 my-2 border-y border-slate-500'>
          <ol class='mt-2'>
            {parentPath
              ? (
                <li class='mb-1'>
                  <span
                    class={`block px-2 py-2 hover:no-underline hover:opacity-60 bg-slate-700 cursor-pointer rounded-md`}
                    onClick={() => onChooseNewDirectory(parentPath === '/' ? parentPath : `${parentPath}/`)}
                  >
                    <p class='flex-auto truncate font-medium text-white'>
                      ..
                    </p>
                  </span>
                </li>
              )
              : null}
            {directories.value.map((directory) => (
              <li class='mb-1'>
                <span
                  class={`block px-2 py-2 hover:no-underline hover:opacity-60 bg-slate-700 cursor-pointer rounded-md`}
                  onClick={() => onChooseNewDirectory(`${directory.parent_path}${directory.directory_name}/`)}
                >
                  <p class='flex-auto truncate font-medium text-white'>
                    {directory.directory_name}
                  </p>
                </span>
              </li>
            ))}
          </ol>
          <span
            class={`flex justify-end items-center text-sm mt-1 mx-2 text-slate-100`}
          >
            {isLoading.value
              ? (
                <>
                  <img src='/images/loading.svg' class='white mr-2' width={18} height={18} />Loading...
                </>
              )
              : null}
            {!isLoading.value ? <>&nbsp;</> : null}
          </span>
        </section>
        <footer class='flex justify-between'>
          <button
            class='px-5 py-2 bg-slate-600 hover:bg-slate-500 text-white cursor-pointer rounded-md'
            onClick={() => onClickSave(newPath.value)}
          >
            Move {isDirectory ? 'directory' : 'file'} here
          </button>
          <button
            class='px-5 py-2 bg-slate-600 hover:bg-slate-500 text-white cursor-pointer rounded-md'
            onClick={() => onClose()}
          >
            Close
          </button>
        </footer>
      </section>
    </>
  );
}
