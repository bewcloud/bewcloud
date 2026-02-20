import { useSignal } from '@preact/signals';
import { useEffect } from 'preact/hooks';
export default function ManageShareModal({
  baseUrl,
  isOpen,
  fileShareId,
  onClickSave,
  onClickDelete,
  onClose
}) {
  const newPassword = useSignal('');
  const isLoading = useSignal(false);
  const fileShare = useSignal(null);
  useEffect(() => {
    fetchFileShare();
  }, [fileShareId]);
  async function fetchFileShare() {
    if (!fileShareId || isLoading.value) {
      return;
    }
    isLoading.value = true;
    try {
      const requestBody = {
        fileShareId
      };
      const response = await fetch(`/api/files/get-share`, {
        method: 'POST',
        body: JSON.stringify(requestBody)
      });
      if (!response.ok) {
        throw new Error(`Failed to get file share. ${response.statusText} ${await response.text()}`);
      }
      const result = await response.json();
      if (!result.success) {
        throw new Error('Failed to get file share!');
      }
      fileShare.value = result.fileShare;
      isLoading.value = false;
    } catch (error) {
      console.error(error);
    }
  }
  return h(Fragment, null, h("section", {
    class: `fixed ${isOpen ? 'block' : 'hidden'} z-40 w-screen h-screen inset-0 bg-gray-900/60`
  }), h("section", {
    class: `fixed ${isOpen ? 'block' : 'hidden'} z-50 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 bg-slate-600 text-white rounded-md px-8 py-6 drop-shadow-lg overflow-y-scroll max-h-[80%]`
  }, h("h1", {
    class: "text-2xl font-semibold my-5"
  }, "Manage Public Share Link"), h("section", {
    class: "py-5 my-2 border-y border-slate-500"
  }, h("section", {
    class: "block mb-2"
  }, h("span", {
    class: "font-semibold my-2 block"
  }, "Public Share URL:"), ' ', h("code", {
    class: "bg-slate-700 my-2 px-2 py-1 rounded-md"
  }, baseUrl, "/file-share/", fileShareId)), h("fieldset", {
    class: "block mb-2"
  }, h("label", {
    class: "text-slate-300 block pb-1",
    for: "manage-share-password"
  }, fileShare.value?.extra.hashed_password ? 'New Password' : 'Set Password'), h("input", {
    class: "input-field",
    type: "password",
    name: "manage-share-password",
    id: "manage-share-password",
    value: newPassword.value,
    onInput: event => {
      newPassword.value = event.currentTarget.value;
    },
    autocomplete: "off"
  }))), h("footer", {
    class: "flex justify-between"
  }, h("button", {
    class: "px-5 py-2 bg-slate-600 hover:bg-slate-500 text-white cursor-pointer rounded-md",
    onClick: () => {
      onClickSave(fileShareId, newPassword.peek());
      newPassword.value = '';
    },
    type: "button"
  }, "Update"), h("button", {
    class: "px-5 py-2 bg-red-600 hover:bg-red-500 text-white cursor-pointer rounded-md",
    onClick: () => onClickDelete(fileShareId),
    type: "button"
  }, "Delete"), h("button", {
    class: "px-5 py-2 bg-slate-600 hover:bg-slate-500 text-white cursor-pointer rounded-md",
    onClick: () => onClose(),
    type: "button"
  }, "Close"))));
}