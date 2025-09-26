import { useSignal } from '@preact/signals';

interface CreateDirectoryModalProps {
  isOpen: boolean;
  onClickSave: (newDirectoryName: string) => Promise<void>;
  onClose: () => void;
}

export default function CreateDirectoryModal(
  { isOpen, onClickSave, onClose }: CreateDirectoryModalProps,
) {
  const newDirectoryName = useSignal<string>('');

  return (
    <>
      <section
        class={`fixed ${isOpen ? 'block' : 'hidden'} z-40 w-screen h-screen inset-0 bg-gray-900/60`}
      >
      </section>

      <section
        class={`fixed ${
          isOpen ? 'block' : 'hidden'
        } z-50 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 bg-slate-600 text-white rounded-md px-8 py-6 drop-shadow-lg overflow-y-scroll max-h-[80%]`}
      >
        <h1 class='text-2xl font-semibold my-5'>Create New Directory</h1>
        <section class='py-5 my-2 border-y border-slate-500'>
          <fieldset class='block mb-2'>
            <label class='text-slate-300 block pb-1' for='directory_name'>Name</label>
            <input
              class='input-field'
              type='text'
              name='directory_name'
              id='directory_name'
              value={newDirectoryName.value}
              onInput={(event) => {
                newDirectoryName.value = event.currentTarget.value;
              }}
              placeholder='Amazing'
            />
          </fieldset>
        </section>
        <footer class='flex justify-between'>
          <button
            class='px-5 py-2 bg-slate-600 hover:bg-slate-500 text-white cursor-pointer rounded-md'
            onClick={() => onClickSave(newDirectoryName.value)}
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
