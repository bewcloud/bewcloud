import { useSignal, useSignalEffect } from '@preact/signals';
import { useEffect } from 'preact/hooks';

import { RequestBody, ResponseBody } from '/routes/api/dashboard/save-notes.tsx';

interface NotesProps {
  initialNotes: string;
}

export default function Notes({ initialNotes }: NotesProps) {
  const saveTimeout = useSignal<ReturnType<typeof setTimeout>>(0);
  const hasSavedTimeout = useSignal<ReturnType<typeof setTimeout>>(0);
  const isSaving = useSignal<boolean>(false);
  const hasSaved = useSignal<boolean>(false);

  function saveNotes(newNotes: string) {
    if (saveTimeout.value) {
      clearTimeout(saveTimeout.value);
    }

    saveTimeout.value = setTimeout(async () => {
      hasSaved.value = false;
      isSaving.value = true;

      try {
        const requestBody: RequestBody = { notes: newNotes };
        const response = await fetch(`/api/dashboard/save-notes`, {
          method: 'POST',
          body: JSON.stringify(requestBody),
        });

        if (!response.ok) {
          throw new Error(`Failed to save notes. ${response.statusText} ${await response.text()}`);
        }

        const result = await response.json() as ResponseBody;

        if (!result.success) {
          throw new Error('Failed to save notes!');
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
      <textarea
        class='my-2 input-field text-sm font-mono'
        onInput={(event) => saveNotes(event.currentTarget.value)}
        rows={10}
      >
        {initialNotes}
      </textarea>

      <span
        class={`flex justify-end items-center text-sm mt-1 mx-2 ${
          hasSaved.value ? 'text-emerald-600' : 'text-slate-100'
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
