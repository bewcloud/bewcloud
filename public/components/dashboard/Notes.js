import { useSignal, useSignalEffect } from '@preact/signals';
import { useEffect } from 'preact/hooks';
export default function Notes({
  initialNotes
}) {
  const saveTimeout = useSignal(0);
  const hasSavedTimeout = useSignal(0);
  const isSaving = useSignal(false);
  const hasSaved = useSignal(false);
  function saveNotes(newNotes) {
    if (saveTimeout.value) {
      clearTimeout(saveTimeout.value);
    }
    saveTimeout.value = setTimeout(async () => {
      hasSaved.value = false;
      isSaving.value = true;
      try {
        const requestBody = {
          notes: newNotes
        };
        const response = await fetch(`/api/dashboard/save-notes`, {
          method: 'POST',
          body: JSON.stringify(requestBody)
        });
        if (!response.ok) {
          throw new Error(`Failed to save notes. ${response.statusText} ${await response.text()}`);
        }
        const result = await response.json();
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
  return h("section", {
    class: "flex flex-col"
  }, h("textarea", {
    class: "my-2 input-field text-sm font-mono",
    onInput: event => saveNotes(event.currentTarget.value),
    rows: 10
  }, initialNotes), h("span", {
    class: `flex justify-end items-center text-sm mt-1 mx-2 ${hasSaved.value ? 'text-green-600' : 'text-slate-100'}`
  }, isSaving.value ? h(Fragment, null, h("img", {
    src: "/public/images/loading.svg",
    class: "white mr-2",
    width: 18,
    height: 18
  }), "Saving...") : null, hasSaved.value ? h(Fragment, null, h("img", {
    src: "/public/images/check.svg",
    class: "green mr-2",
    width: 18,
    height: 18
  }), "Saved!") : null, !isSaving.value && !hasSaved.value ? h(Fragment, null, "\xA0") : null));
}