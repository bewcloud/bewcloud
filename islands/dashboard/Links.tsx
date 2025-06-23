import { useSignal } from '@preact/signals';
import { useEffect } from 'preact/hooks';

import { DashboardLink } from '/lib/types.ts';
import { validateUrl } from '/lib/utils/misc.ts';
import { RequestBody, ResponseBody } from '/routes/api/dashboard/save-links.tsx';

interface LinksProps {
  initialLinks: DashboardLink[];
}

export default function Links({ initialLinks }: LinksProps) {
  const hasSavedTimeout = useSignal<ReturnType<typeof setTimeout>>(0);
  const isSaving = useSignal<boolean>(false);
  const hasSaved = useSignal<boolean>(false);
  const links = useSignal<DashboardLink[]>(initialLinks);

  async function saveLinks(newLinks: DashboardLink[]) {
    if (isSaving.value) {
      return;
    }

    hasSaved.value = false;
    isSaving.value = true;

    const oldLinks = [...links.value];

    links.value = newLinks;

    try {
      const requestBody: RequestBody = { links: newLinks };
      const response = await fetch(`/api/dashboard/save-links`, {
        method: 'POST',
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        throw new Error(`Failed to save link. ${response.statusText} ${await response.text()}`);
      }

      const result = await response.json() as ResponseBody;

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

    const newLinks = [...links.value, { name, url }];

    saveLinks(newLinks);
  }

  function onClickDeleteLink(indexToDelete: number) {
    if (confirm('Are you sure you want to delete this link?')) {
      const newLinks = [...links.value];

      newLinks.splice(indexToDelete, 1);

      saveLinks(newLinks);
    }
  }

  function onClickMoveLeftLink(indexToMoveLeft: number) {
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

  return (
    <>
      <section class='flex flex-row items-center justify-end mb-4'>
        <section class='flex items-center'>
          <button
            class='inline-block justify-center gap-x-1.5 rounded-md bg-[#51A4FB] px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-sky-400 ml-2'
            type='button'
            title='Add new link'
            onClick={() => onClickAddLink()}
          >
            <img
              src='/images/add.svg'
              alt='Add new link'
              class={`white`}
              width={20}
              height={20}
            />
          </button>
        </section>
      </section>

      <section class='mx-auto max-w-7xl px-6 lg:px-8 my-8'>
        <section class='group grid grid-cols-1 gap-x-8 gap-y-16 text-center lg:grid-cols-3'>
          {links.value.map((link, index) => (
            <div class='group mx-auto flex max-w-xs flex-col gap-y-4 rounded shadow-md bg-slate-700 relative hover:bg-slate-600'>
              <article class='order-first text-3xl font-semibold tracking-tight sm:text-2xl'>
                <a href={link.url} class='text-white py-4 px-8 block' target='_blank' rel='noreferrer noopener'>
                  {link.name}
                </a>
              </article>
              <span
                class='invisible group-hover:visible absolute top-0 right-0 -mr-3 -mt-3 cursor-pointer'
                onClick={() => onClickDeleteLink(index)}
              >
                <img
                  src='/images/delete.svg'
                  class='red drop-shadow-md'
                  width={24}
                  height={24}
                  alt='Delete link'
                  title='Delete link'
                />
              </span>
              {index > 0
                ? (
                  <span
                    class='invisible group-hover:visible absolute top-0 left-0 -ml-3 -mt-3 cursor-pointer'
                    onClick={() => onClickMoveLeftLink(index)}
                  >
                    <img
                      src='/images/left-circle.svg'
                      class='gray'
                      width={24}
                      height={24}
                      alt='Move link left'
                      title='Move link left'
                    />
                  </span>
                )
                : null}
            </div>
          ))}
        </section>

        <span
          class={`flex justify-end items-center text-sm mt-1 mx-2 ${
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
    </>
  );
}
