import { useEffect, useRef } from 'preact/hooks';

interface FilterDropdownProps<T extends string> {
  label: string;
  selected: T;
  options: { id: T; title: string }[];
  onSelect: (id: T) => void;
  isFeedPicker?: boolean;
}

export default function FilterDropdown<T extends string>(
  { label, selected, options, onSelect, isFeedPicker }: FilterDropdownProps<T>,
) {
  const dropdown = useRef<HTMLDetailsElement>(null);
  const trigger = useRef<HTMLElement>(null);

  useEffect(() => {
    const closeOnOutsideClick = (event: PointerEvent) => {
      if (dropdown.current?.open && !dropdown.current.contains(event.target as Node)) {
        dropdown.current.open = false;
      }
    };
    document.addEventListener('pointerdown', closeOnOutsideClick);
    return () => document.removeEventListener('pointerdown', closeOnOutsideClick);
  }, []);

  function closeDropdown() {
    dropdown.current!.open = false;
    trigger.current!.focus();
  }

  return (
    <details
      ref={dropdown}
      name='news-filters'
      class={`relative ${isFeedPicker ? 'min-w-0 max-w-32 sm:max-w-53' : 'shrink-0'}`}
      onFocusOut={(event) => {
        // Safari can clear focus on mousedown before an option receives its click.
        if (event.relatedTarget instanceof Node && !event.currentTarget.contains(event.relatedTarget)) {
          event.currentTarget.open = false;
        }
      }}
      onKeyDown={(event) => {
        const menu = event.currentTarget;
        if (event.key === 'Escape' && menu.open) {
          event.preventDefault();
          closeDropdown();
        } else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
          event.preventDefault();
          menu.open = true;
          const buttons = Array.from(menu.querySelectorAll('button'));
          const index = buttons.indexOf(document.activeElement as HTMLButtonElement);
          const next = event.key === 'ArrowDown' ? index + 1 : (index <= 0 ? buttons.length : index) - 1;
          buttons[next % buttons.length].focus();
        } else if (
          menu.open && event.key.length === 1 && event.key.trim() && !event.metaKey && !event.ctrlKey && !event.altKey
        ) {
          const buttons = Array.from(menu.querySelectorAll('button'));
          const start = buttons.indexOf(document.activeElement as HTMLButtonElement) + 1;
          const match = [...buttons.slice(start), ...buttons.slice(0, start)]
            .find((button) => button.textContent.toLowerCase().startsWith(event.key.toLowerCase()));
          match?.focus();
        }
      }}
    >
      <summary
        ref={trigger}
        class='flex items-center justify-center gap-x-1.5 rounded-md bg-slate-700 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-slate-600 cursor-pointer'
        aria-label={isFeedPicker ? `Filter by feed: ${label}` : undefined}
        title={isFeedPicker ? `Filter by feed: ${label}` : label}
      >
        <span class='truncate'>{label}</span>
        <svg class='-mr-1 h-5 w-5 shrink-0 text-slate-400' viewBox='0 0 20 20' fill='currentColor' aria-hidden='true'>
          <path
            fill-rule='evenodd'
            d='M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z'
            clip-rule='evenodd'
          />
        </svg>
      </summary>
      <section
        class={`absolute left-0 sm:left-auto sm:right-0 z-10 mt-2 max-h-64 overflow-y-auto rounded-md bg-slate-700 py-1 shadow-lg ring-1 ring-black/15 ${
          isFeedPicker ? 'w-37' : 'w-44'
        }`}
      >
        {options.map((option) => (
          <button
            key={option.id}
            class={`block w-full text-left px-4 py-2 text-sm text-white wrap-anywhere hover:bg-slate-600 focus-visible:bg-slate-600 ${
              selected === option.id ? 'font-semibold' : ''
            }`}
            type='button'
            aria-pressed={selected === option.id}
            onClick={() => {
              closeDropdown();
              onSelect(option.id);
            }}
          >
            {option.title}
          </button>
        ))}
      </section>
    </details>
  );
}
