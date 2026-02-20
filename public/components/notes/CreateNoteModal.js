import { useSignal } from '@preact/signals';
export default function CreateNoteModal({
  isOpen,
  onClickSave,
  onClose
}) {
  const newNoteName = useSignal('');
  return h(Fragment, null, h("section", {
    class: `fixed ${isOpen ? 'block' : 'hidden'} z-40 w-screen h-screen inset-0 bg-gray-900/60`
  }), h("section", {
    class: `fixed ${isOpen ? 'block' : 'hidden'} z-50 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 bg-slate-600 text-white rounded-md px-8 py-6 drop-shadow-lg overflow-y-scroll max-h-[80%]`
  }, h("h1", {
    class: "text-2xl font-semibold my-5"
  }, "Create New Note"), h("section", {
    class: "py-5 my-2 border-y border-slate-500"
  }, h("fieldset", {
    class: "block mb-2"
  }, h("label", {
    class: "text-slate-300 block pb-1",
    for: "directory_name"
  }, "Name"), h("input", {
    class: "input-field",
    type: "text",
    name: "directory_name",
    id: "directory_name",
    value: newNoteName.value,
    onInput: event => {
      newNoteName.value = event.currentTarget.value;
    },
    placeholder: "Amazing"
  }))), h("footer", {
    class: "flex justify-between"
  }, h("button", {
    class: "px-5 py-2 bg-slate-600 hover:bg-slate-500 text-white cursor-pointer rounded-md",
    onClick: () => onClickSave(newNoteName.value),
    type: "button"
  }, "Create"), h("button", {
    class: "px-5 py-2 bg-slate-600 hover:bg-slate-500 text-white cursor-pointer rounded-md",
    onClick: () => onClose(),
    type: "button"
  }, "Close"))));
}