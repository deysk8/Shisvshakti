'use client';

import { useEffect, useId, useRef, useState } from 'react';

type CityComboboxProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: string[];
  exclude?: string;
  placeholder?: string;
};

export function CityCombobox({
  label,
  value,
  onChange,
  options,
  exclude,
  placeholder = 'Type or select city',
}: CityComboboxProps) {
  const id = useId();
  const listId = `${id}-list`;
  const containerRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState(value);
  const [highlight, setHighlight] = useState(0);

  const filtered = options
    .filter((city) => !exclude || city.toLowerCase() !== exclude.toLowerCase())
    .filter((city) => city.toLowerCase().includes(query.trim().toLowerCase()));

  useEffect(() => {
    setQuery(value);
  }, [value]);

  useEffect(() => {
    function onDocClick(event: MouseEvent) {
      if (!containerRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  function commit(next: string) {
    onChange(next);
    setQuery(next);
    setOpen(false);
  }

  function onInputChange(next: string) {
    setQuery(next);
    onChange(next);
    setOpen(true);
    setHighlight(0);
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (!open && (event.key === 'ArrowDown' || event.key === 'ArrowUp')) {
      setOpen(true);
      return;
    }
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setHighlight((current) => Math.min(current + 1, Math.max(filtered.length - 1, 0)));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setHighlight((current) => Math.max(current - 1, 0));
    } else if (event.key === 'Enter' && open && filtered[highlight]) {
      event.preventDefault();
      commit(filtered[highlight]);
    } else if (event.key === 'Escape') {
      setOpen(false);
      setQuery(value);
    }
  }

  return (
    <label className="block text-sm font-medium text-gray-700">
      {label}
      <div ref={containerRef} className="relative mt-1">
        <input
          type="text"
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          autoComplete="off"
          value={query}
          placeholder={placeholder}
          onChange={(event) => onInputChange(event.target.value)}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-charcoal outline-none ring-brand focus:ring-2"
        />
        {open && filtered.length > 0 && (
          <ul
            id={listId}
            role="listbox"
            className="absolute z-20 mt-1 max-h-48 w-full overflow-auto rounded-lg border border-gray-200 bg-white py-1 shadow-lg"
          >
            {filtered.map((city, index) => (
              <li
                key={city}
                role="option"
                aria-selected={index === highlight}
                className={`cursor-pointer px-3 py-2 text-sm ${
                  index === highlight
                    ? 'bg-brand-light text-brand-deep'
                    : 'text-charcoal hover:bg-gray-50'
                }`}
                onMouseDown={(event) => {
                  event.preventDefault();
                  commit(city);
                }}
                onMouseEnter={() => setHighlight(index)}
              >
                {city}
              </li>
            ))}
          </ul>
        )}
        {open && query.trim() && filtered.length === 0 && (
          <div className="absolute z-20 mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-500 shadow-lg">
            No matching cities — press Search to try &quot;{query.trim()}&quot;
          </div>
        )}
      </div>
    </label>
  );
}
