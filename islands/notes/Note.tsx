import { useSignal, useSignalEffect } from '@preact/signals';
import { useEffect } from 'preact/hooks';

import { RequestBody, ResponseBody } from '/routes/api/notes/save.tsx';
import FilesBreadcrumb from '/components/files/FilesBreadcrumb.tsx';

interface NoteProps {
  fileName: string;
  currentPath: string;
  contents: string;
}

export default function Note({ fileName, currentPath, contents }: NoteProps) {
  const saveTimeout = useSignal<ReturnType<typeof setTimeout>>(0);
  const hasSavedTimeout = useSignal<ReturnType<typeof setTimeout>>(0);
  const isSaving = useSignal<boolean>(false);
  const hasSaved = useSignal<boolean>(false);

  function saveNote(newNotes: string) {
    if (saveTimeout.value) {
      clearTimeout(saveTimeout.value);
    }

    saveTimeout.value = setTimeout(async () => {
      hasSaved.value = false;
      isSaving.value = true;

      try {
        const requestBody: RequestBody = { fileName, currentPath, contents: newNotes };
        const response = await fetch(`/api/notes/save`, {
          method: 'POST',
          body: JSON.stringify(requestBody),
        });
        const result = await response.json() as ResponseBody;

        if (!result.success) {
          throw new Error('Failed to save note!');
        }
      } catch (error) {
        console.error(error);
      }

      isSaving.value = false;
      hasSaved.value = true;
    }, 1000);
  }

  useSignalEffect(() => {
    if (hasSaved.value && !hasSavedTimeout.value) {
      hasSavedTimeout.value = setTimeout(() => {
        hasSaved.value = false;
      }, 3000);
    }
  });

  useEffect(() => {
    return () => {
      if (saveTimeout.value) {
        clearTimeout(saveTimeout.value);
      }

      if (hasSavedTimeout.value) {
        clearTimeout(hasSavedTimeout.value);
      }
    };
  }, []);

  return (
    <section class='flex flex-col'>
      <section class='mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8 w-full flex flex-row items-center justify-start'>
        <FilesBreadcrumb path={currentPath} isShowingNotes />
        <h3 class='text-base text-white font-semibold'>
          <span class='mr-2 text-xs'>/</span>
          {decodeURIComponent(fileName)}
        </h3>
      </section>

      <textarea
        class='my-2 input-field text-sm font-mono mx-auto max-w-7xl'
        onInput={(event) => saveNote(event.currentTarget.value)}
        rows={20}
      >
        {contents}
      </textarea>

      <span
        class={`flex justify-end items-center text-sm mt-1 mx-auto max-w-7xl ${
          hasSaved.value ? 'text-green-600' : 'text-slate-100'
        }`}
      >
        {isSaving.value
          ? (
            <>
              <img src='/images/loading.svg' class='white mr-2' width={18} height={18} />Saving...
            </>
          )
          : null}
        {hasSaved.value
          ? (
            <>
              <img src='/images/check.svg' class='green mr-2' width={18} height={18} />Saved!
            </>
          )
          : null}
        {!isSaving.value && !hasSaved.value ? <>&nbsp;</> : null}
      </span>
    </section>
  );
}
