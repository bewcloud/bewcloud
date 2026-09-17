import { useEffect, useRef } from 'preact/hooks';
export default function FileConflictModal({
  isOpen,
  filePath,
  onReplace,
  onSkip,
  onReplaceAll,
  onSkipAll,
  onAbort
}) {
  const skipButtonRef = useRef(null);
  useEffect(() => {
    if (!isOpen) {
      return;
    }
    skipButtonRef.current?.focus();
    function onKeyDown(event) {
      if (event.key === 'Escape') {
        event.preventDefault();
        onSkip();
      }
    }
    globalThis.addEventListener('keydown', onKeyDown);
    return () => globalThis.removeEventListener('keydown', onKeyDown);
  }, [isOpen, onSkip]);
  return h(Fragment, null, h("section", {
    class: `fixed ${isOpen ? 'block' : 'hidden'} z-40 w-screen h-screen inset-0 bg-gray-900/60`
  }), h("section", {
    class: `fixed ${isOpen ? 'block' : 'hidden'} z-50 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[30rem] bg-slate-600 text-white rounded-md px-8 py-6 drop-shadow-lg overflow-y-auto max-h-[80%]`
  }, h("h1", {
    class: "text-2xl font-semibold my-5"
  }, "File Already Exists"), h("section", {
    class: "py-5 my-2 border-y border-slate-500"
  }, h("p", {
    class: "text-slate-300"
  }, "The file ", h("strong", {
    class: "text-white"
  }, filePath), ' ', "already exists in this location. What would you like to do?"), h("p", {
    class: "text-slate-400 text-sm mt-3"
  }, "Replacing overwrites the existing file permanently. It is not moved to Trash.")), h("footer", {
    class: "grid grid-cols-[1fr_1fr_auto] gap-2"
  }, h("button", {
    ref: skipButtonRef,
    class: "px-5 py-2 bg-slate-600 hover:bg-slate-500 text-white cursor-pointer rounded-md",
    onClick: () => onSkip(),
    type: "button"
  }, "Skip"), h("button", {
    class: "px-5 py-2 bg-slate-600 hover:bg-slate-500 text-white cursor-pointer rounded-md",
    onClick: () => onSkipAll(),
    type: "button"
  }, "Skip All"), h("div", null), h("button", {
    class: "px-5 py-2 bg-slate-600 hover:bg-slate-500 text-white cursor-pointer rounded-md",
    onClick: () => onReplace(),
    type: "button"
  }, "Replace"), h("button", {
    class: "px-5 py-2 bg-slate-600 hover:bg-slate-500 text-white cursor-pointer rounded-md",
    onClick: () => onReplaceAll(),
    type: "button"
  }, "Replace All"), h("button", {
    class: "px-5 py-2 bg-red-600 hover:bg-red-500 text-white cursor-pointer rounded-md",
    onClick: () => onAbort(),
    type: "button"
  }, "Abort Upload"))));
}