import { useEffect, useRef, useState } from 'react';
import { useCombobox } from 'downshift';

/**
 * Stable issue-description autocomplete (Downshift useCombobox).
 * Avoids menu blink: no loading chrome, keep previous items until new results arrive.
 */
export default function IssueDescriptionCombobox({
  value = '',
  onChange,
  required = false,
  placeholder = 'What is the problem?',
  className = '',
  inputClassName = 'w-full dark-input',
}) {
  const [items, setItems] = useState([]);
  const lastQuery = useRef('');
  const seqRef = useRef(0);

  const {
    isOpen,
    getMenuProps,
    getInputProps,
    getItemProps,
    highlightedIndex,
    getLabelProps,
    openMenu,
  } = useCombobox({
    items,
    inputValue: value,
    // Keep menu open while typing so it does not flash closed/open each keystroke
    stateReducer(state, { type, changes }) {
      switch (type) {
        case useCombobox.stateChangeTypes.InputChange:
          return {
            ...changes,
            isOpen: true,
            highlightedIndex: state.highlightedIndex,
          };
        case useCombobox.stateChangeTypes.InputBlur:
          return { ...changes, isOpen: false };
        case useCombobox.stateChangeTypes.ControlledPropUpdatedSelectedItem:
          return { ...changes, isOpen: state.isOpen };
        default:
          return changes;
      }
    },
    onInputValueChange: ({ inputValue, type }) => {
      if (type === useCombobox.stateChangeTypes.InputChange) {
        onChange?.(inputValue ?? '');
      }
    },
    onSelectedItemChange: ({ selectedItem }) => {
      if (selectedItem != null) onChange?.(String(selectedItem));
    },
    itemToString: (item) => (item == null ? '' : String(item)),
  });

  useEffect(() => {
    const q = String(value || '').trim();
    // Skip duplicate fetches for the same query
    if (q === lastQuery.current && items.length > 0) return;

    const controller = new AbortController();
    const seq = ++seqRef.current;
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/issue-descriptions?q=${encodeURIComponent(q)}&limit=12`,
          {
            credentials: 'include',
            signal: controller.signal,
            headers: { Accept: 'application/json' },
          }
        );
        if (!res.ok) return;
        const data = await res.json();
        if (seq !== seqRef.current) return;
        const list = Array.isArray(data?.items)
          ? data.items
          : Array.isArray(data)
            ? data
            : [];
        lastQuery.current = q;
        // Only update when list content actually changes — prevents list blink
        const next = list.map(String);
        setItems((prev) => {
          if (prev.length === next.length && prev.every((v, i) => v === next[i])) return prev;
          return next;
        });
      } catch (err) {
        if (err?.name === 'AbortError') return;
        // Keep previous items on error (no flash to empty)
      }
    }, 280);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  // Menu only when open and we have something to show — never an empty/loading flash
  const showMenu = isOpen && items.length > 0;

  return (
    <div className={`relative ${className}`}>
      <label {...getLabelProps()} className="block text-gray-400 font-bold uppercase tracking-wider mb-1">
        Issue Description
      </label>
      <input
        {...getInputProps({
          required,
          placeholder,
          className: inputClassName,
          onFocus: () => {
            if (items.length > 0) openMenu();
          },
        })}
      />
      <ul
        {...getMenuProps()}
        className={
          showMenu
            ? 'absolute z-[120] left-0 right-0 mt-1 max-h-60 overflow-y-auto custom-scroll rounded-lg border border-[#374151] bg-[#111827] shadow-lg py-1'
            : 'sr-only'
        }
      >
        {showMenu ? (
          <>
            <li className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-500 pointer-events-none">
              Recent Issues
            </li>
            {items.map((item, index) => (
              <li
                key={item}
                {...getItemProps({ item, index })}
                className={`px-3 py-2 text-sm cursor-pointer ${
                  highlightedIndex === index
                    ? 'bg-indigo-600/30 text-white'
                    : 'text-slate-300 hover:bg-[#1F2937]'
                }`}
              >
                <span className="line-clamp-2">{item}</span>
              </li>
            ))}
          </>
        ) : null}
      </ul>
    </div>
  );
}
