import { useSignal } from '@preact/signals';

interface CreateShareModalProps {
  isOpen: boolean;
  filePath: string;
  password?: string;
  onClickSave: (filePath: string, password?: string) => Promise<void>;
  onClose: () => void;
}

export default function CreateShareModal(
  { isOpen, filePath, password, onClickSave, onClose }: CreateShareModalProps,
) {
  const newPassword = useSignal<string>(password || '');

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
        <h1 class='text-2xl font-semibold my-5'>Create New Public Share Link</h1>
        <section class='py-5 my-2 border-y border-slate-500'>
          <fieldset class='block mb-2'>
            <label class='text-slate-300 block pb-1' for='create-share-password'>Password</label>
            <input
              class='input-field'
              type='password'
              name='password'
              id='create-share-password'
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
              onClickSave(filePath, newPassword.peek());
              newPassword.value = '';
            }}
            type='button'
          >
            Create
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
