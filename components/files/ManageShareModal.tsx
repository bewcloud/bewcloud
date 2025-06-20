import { useSignal } from '@preact/signals';
import { useEffect } from 'preact/hooks';

import { RequestBody, ResponseBody } from '/routes/api/files/get-share.tsx';
import { FileShare } from '/lib/types.ts';

interface ManageShareModalProps {
  baseUrl: string;
  isOpen: boolean;
  fileShareId: string;
  onClickSave: (fileShareId: string, password?: string) => Promise<void>;
  onClickDelete: (fileShareId: string) => Promise<void>;
  onClose: () => void;
}

export default function ManageShareModal(
  { baseUrl, isOpen, fileShareId, onClickSave, onClickDelete, onClose }: ManageShareModalProps,
) {
  const newPassword = useSignal<string>('');

  const isLoading = useSignal<boolean>(false);
  const fileShare = useSignal<FileShare | null>(null);

  useEffect(() => {
    fetchFileShare();
  }, [fileShareId]);

  async function fetchFileShare() {
    if (!fileShareId || isLoading.value) {
      return;
    }

    isLoading.value = true;

    try {
      const requestBody: RequestBody = {
        fileShareId,
      };
      const response = await fetch(`/api/files/get-share`, {
        method: 'POST',
        body: JSON.stringify(requestBody),
      });
      const result = await response.json() as ResponseBody;

      if (!result.success) {
        throw new Error('Failed to get file share!');
      }

      fileShare.value = result.fileShare;

      isLoading.value = false;
    } catch (error) {
      console.error(error);
    }
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
        <h1 class='text-2xl font-semibold my-5'>Manage Public Share Link</h1>
        <section class='py-5 my-2 border-y border-slate-500'>
          <section class='block mb-2'>
            <span class='font-semibold my-2 block'>Public Share URL:</span>{' '}
            <code class='bg-slate-700 my-2 px-2 py-1 rounded-md'>{baseUrl}/file-share/{fileShareId}</code>
          </section>
          <fieldset class='block mb-2'>
            <label class='text-slate-300 block pb-1' for='password'>
              {fileShare.value?.extra.hashed_password ? 'New Password' : 'Set Password'}
            </label>
            <input
              class='input-field'
              type='password'
              name='password'
              id='password'
              value={newPassword.value}
              onInput={(event) => {
                newPassword.value = event.currentTarget.value;
              }}
              autocomplete='off'
            />
          </fieldset>
        </section>
        <footer class='flex justify-between'>
          <button
            class='px-5 py-2 bg-slate-600 hover:bg-slate-500 text-white cursor-pointer rounded-md'
            onClick={() => {
              onClickSave(fileShareId, newPassword.peek());
              newPassword.value = '';
            }}
            type='button'
          >
            Update
          </button>
          <button
            class='px-5 py-2 bg-red-600 hover:bg-red-500 text-white cursor-pointer rounded-md'
            onClick={() => onClickDelete(fileShareId)}
            type='button'
          >
            Delete
          </button>
          <button
            class='px-5 py-2 bg-slate-600 hover:bg-slate-500 text-white cursor-pointer rounded-md'
            onClick={() => onClose()}
            type='button'
          >
            Close
          </button>
        </footer>
      </section>
    </>
  );
}
