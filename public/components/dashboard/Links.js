import { useSignal } from '@preact/signals';
import { useEffect } from 'preact/hooks';
import { validateUrl } from '/public/ts/utils/misc.ts';
export default function Links({
  initialLinks
}) {
  const hasSavedTimeout = useSignal(0);
  const isSaving = useSignal(false);
  const hasSaved = useSignal(false);
  const links = useSignal(initialLinks);
  async function saveLinks(newLinks) {
    if (isSaving.value) {
      return;
    }
    hasSaved.value = false;
    isSaving.value = true;
    const oldLinks = [...links.value];
    links.value = newLinks;
    try {
      const requestBody = {
        links: newLinks
      };
      const response = await fetch(`/api/dashboard/save-links`, {
        method: 'POST',
        body: JSON.stringify(requestBody)
      });
      if (!response.ok) {
        throw new Error(`Failed to save link. ${response.statusText} ${await response.text()}`);
      }
      const result = await response.json();
      if (!result.success) {
        throw new Error('Failed to save link!');
      }
    } catch (error) {
      console.error(error);
      links.value = [...oldLinks];
    }
    isSaving.value = false;
    hasSaved.value = true;
    if (hasSavedTimeout.value) {
      clearTimeout(hasSavedTimeout.value);
    }
    hasSavedTimeout.value = setTimeout(() => {
      hasSaved.value = false;
    }, 3000);
  }
  useEffect(() => {
    return () => {
      if (hasSavedTimeout.value) {
        clearTimeout(hasSavedTimeout.value);
      }
    };
  });
  function onClickAddLink() {
    const name = (prompt(`What's the **name** for the new link?`) || '').trim();
    const url = (prompt(`What's the **URL** for the new link?`) || '').trim();
    if (!name || !url) {
      alert('A name and URL are required for a new link!');
      return;
    }
    if (!validateUrl(url)) {
      alert('Invalid URL!');
      return;
    }
    const newLinks = [...links.value, {
      name,
      url
    }];
    saveLinks(newLinks);
  }
  function onClickDeleteLink(indexToDelete) {
    if (confirm('Are you sure you want to delete this link?')) {
      const newLinks = [...links.value];
      newLinks.splice(indexToDelete, 1);
      saveLinks(newLinks);
    }
  }
  function onClickMoveLeftLink(indexToMoveLeft) {
    if (indexToMoveLeft <= 0) {
      return;
    }
    if (confirm('Are you sure you want to move this link left?')) {
      const newLinks = [...links.value];
      const linkToMove = newLinks.splice(indexToMoveLeft, 1);
      newLinks.splice(indexToMoveLeft - 1, 0, linkToMove[0]);
      saveLinks(newLinks);
    }
  }
  return h(Fragment, null, h("section", {
    class: "flex flex-row items-center justify-end mb-4"
  }, h("section", {
    class: "flex items-center"
  }, h("button", {
    class: "inline-block justify-center gap-x-1.5 rounded-md bg-[#51A4FB] px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-sky-400 ml-2 cursor-pointer",
    type: "button",
    title: "Add new link",
    onClick: () => onClickAddLink()
  }, h("img", {
    src: "/public/images/add.svg",
    alt: "Add new link",
    class: `white`,
    width: 20,
    height: 20
  })))), h("section", {
    class: "mx-auto max-w-7xl px-6 lg:px-8 my-8"
  }, h("section", {
    class: "group grid grid-cols-1 gap-x-8 gap-y-16 text-center lg:grid-cols-3"
  }, links.value.map((link, index) => h("div", {
    class: "group mx-auto flex max-w-xs flex-col gap-y-4 rounded shadow-md bg-slate-700 relative hover:bg-slate-600"
  }, h("article", {
    class: "order-first text-3xl font-semibold tracking-tight sm:text-2xl"
  }, h("a", {
    href: link.url,
    class: "text-white py-4 px-8 block",
    target: "_blank",
    rel: "noreferrer noopener"
  }, link.name)), h("span", {
    class: "invisible group-hover:visible absolute top-0 right-0 -mr-3 -mt-3 cursor-pointer",
    onClick: () => onClickDeleteLink(index)
  }, h("img", {
    src: "/public/images/delete.svg",
    class: "red drop-shadow-md",
    width: 24,
    height: 24,
    alt: "Delete link",
    title: "Delete link"
  })), index > 0 ? h("span", {
    class: "invisible group-hover:visible absolute top-0 left-0 -ml-3 -mt-3 cursor-pointer",
    onClick: () => onClickMoveLeftLink(index)
  }, h("img", {
    src: "/public/images/left-circle.svg",
    class: "gray",
    width: 24,
    height: 24,
    alt: "Move link left",
    title: "Move link left"
  })) : null))), h("span", {
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
  }), "Saved!") : null, !isSaving.value && !hasSaved.value ? h(Fragment, null, "\xA0") : null)));
}