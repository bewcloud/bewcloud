import { useEffect, useRef } from 'preact/hooks';

interface FileConflictModalProps {
  isOpen: boolean;
  filePath: string;
  onReplace: () => void;
  onSkip: () => void;
  onReplaceAll: () => void;
  onSkipAll: () => void;
  onAbort: () => void;
}

// Shown by useDragAndDropUpload when an uploaded file's name already exists at the target path.
export default function FileConflictModal(
  { isOpen, filePath, onReplace, onSkip, onReplaceAll, onSkipAll, onAbort }: FileConflictModalProps,
) {
  const skipButtonRef = useRef<HTMLButtonElement>(null);

  // Focus the non-destructive Skip, and let Escape skip too.
  useEffect(() => {
    if (!isOpen) {
      return;
    }

    skipButtonRef.current?.focus();

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault();
        onSkip();
      }
    }

    globalThis.addEventListener('keydown', onKeyDown);

    return () => globalThis.removeEventListener('keydown', onKeyDown);
  }, [isOpen, onSkip]);

  return (
    <>
      <section
        class={`fixed ${isOpen ? 'block' : 'hidden'} z-40 w-screen h-screen inset-0 bg-gray-900/60`}
      >
      </section>

      <section
        class={`fixed ${
          isOpen ? 'block' : 'hidden'
        } z-50 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[30rem] bg-slate-600 text-white rounded-md px-8 py-6 drop-shadow-lg overflow-y-auto max-h-[80%]`}
      >
        <h1 class='text-2xl font-semibold my-5'>File Already Exists</h1>
        <section class='py-5 my-2 border-y border-slate-500'>
          <p class='text-slate-300'>
            The file <strong class='text-white'>{filePath}</strong>{' '}
            already exists in this location. What would you like to do?
          </p>
          <p class='text-slate-400 text-sm mt-3'>
            Replacing overwrites the existing file permanently. It is not moved to Trash.
          </p>
        </section>
        {/* Skip first, so it's first in tab order. The empty cell keeps Abort Upload on row 2 only. */}
        <footer class='grid grid-cols-[1fr_1fr_auto] gap-2'>
          <button
            ref={skipButtonRef}
            class='px-5 py-2 bg-slate-600 hover:bg-slate-500 text-white cursor-pointer rounded-md'
            onClick={() => onSkip()}
            type='button'
          >
            Skip
          </button>
          <button
            class='px-5 py-2 bg-slate-600 hover:bg-slate-500 text-white cursor-pointer rounded-md'
            onClick={() => onSkipAll()}
            type='button'
          >
            Skip All
          </button>
          <div />
          <button
            class='px-5 py-2 bg-slate-600 hover:bg-slate-500 text-white cursor-pointer rounded-md'
            onClick={() => onReplace()}
            type='button'
          >
            Replace
          </button>
          <button
            class='px-5 py-2 bg-slate-600 hover:bg-slate-500 text-white cursor-pointer rounded-md'
            onClick={() => onReplaceAll()}
            type='button'
          >
            Replace All
          </button>
          <button
            class='px-5 py-2 bg-red-600 hover:bg-red-500 text-white cursor-pointer rounded-md'
            onClick={() => onAbort()}
            type='button'
          >
            Abort Upload
          </button>
        </footer>
      </section>
    </>
  );
}
