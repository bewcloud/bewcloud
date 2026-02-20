import { useSignal, useSignalEffect } from '@preact/signals';
import { useEffect } from 'preact/hooks';
import FilesBreadcrumb from "/public/components/files/FilesBreadcrumb.js";
export default function Note({
  fileName,
  currentPath,
  contents
}) {
  const saveTimeout = useSignal(0);
  const hasSavedTimeout = useSignal(0);
  const isSaving = useSignal(false);
  const hasSaved = useSignal(false);
  function saveNote(newNotes) {
    if (saveTimeout.value) {
      clearTimeout(saveTimeout.value);
    }
    saveTimeout.value = setTimeout(async () => {
      hasSaved.value = false;
      isSaving.value = true;
      try {
        const requestBody = {
          fileName,
          currentPath,
          contents: newNotes
        };
        const response = await fetch(`/api/notes/save`, {
          method: 'POST',
          body: JSON.stringify(requestBody)
        });
        if (!response.ok) {
          throw new Error(`Failed to save note. ${response.statusText} ${await response.text()}`);
        }
        const result = await response.json();
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
  return h("section", {
    class: "flex flex-col"
  }, h("section", {
    class: "mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8 w-full flex flex-row items-center justify-start"
  }, h(FilesBreadcrumb, {
    path: currentPath,
    isShowingNotes: true
  }), h("h3", {
    class: "text-base text-white font-semibold"
  }, h("span", {
    class: "mr-2 text-xs"
  }, "/"), decodeURIComponent(fileName))), h("textarea", {
    class: "my-2 input-field text-sm font-mono mx-auto max-w-7xl",
    onInput: event => saveNote(event.currentTarget.value),
    rows: 20
  }, contents), h("span", {
    class: `flex justify-end items-center text-sm mt-1 mx-auto max-w-7xl ${hasSaved.value ? 'text-green-600' : 'text-slate-100'}`
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