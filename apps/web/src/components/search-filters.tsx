'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { FormEvent, useEffect, useState } from 'react';
import { TIME_SLOTS, type SearchFilters } from '@/lib/search-api';

export function SearchFiltersBar() {
  const router = useRouter();
  const params = useSearchParams();
  const fromCity = params.get('fromCity') ?? '';
  const toCity = params.get('toCity') ?? '';
  const date = params.get('date') ?? '';
  const agentMode = params.get('agent') === '1';

  const [sort, setSort] = useState(params.get('sort') ?? 'departure');
  const [timeSlot, setTimeSlot] = useState<SearchFilters['timeSlot']>(
    (params.get('timeSlot') as SearchFilters['timeSlot']) ?? 'any',
  );
  const [maxPrice, setMaxPrice] = useState(params.get('maxPrice') ?? '');
  const [minSeats, setMinSeats] = useState(params.get('minSeats') ?? '');

  useEffect(() => {
    setSort(params.get('sort') ?? 'departure');
    setTimeSlot((params.get('timeSlot') as SearchFilters['timeSlot']) ?? 'any');
    setMaxPrice(params.get('maxPrice') ?? '');
    setMinSeats(params.get('minSeats') ?? '');
  }, [params]);

  function applyFilters(e?: FormEvent) {
    e?.preventDefault();
    if (!fromCity || !toCity || !date) return;

    const q = new URLSearchParams({ fromCity, toCity, date });
    if (agentMode) q.set('agent', '1');
    if (sort && sort !== 'departure') q.set('sort', sort);
    if (maxPrice) q.set('maxPrice', maxPrice);
    if (minSeats) q.set('minSeats', minSeats);
    if (timeSlot && timeSlot !== 'any') {
      q.set('timeSlot', timeSlot);
      const slot = TIME_SLOTS[timeSlot];
      if (slot.departAfter) q.set('departAfter', slot.departAfter);
      if (slot.departBefore) q.set('departBefore', slot.departBefore);
    }
    router.replace(`/search?${q.toString()}`);
  }

  function clearFilters() {
    const q = new URLSearchParams({ fromCity, toCity, date });
    if (agentMode) q.set('agent', '1');
    router.replace(`/search?${q.toString()}`);
  }

  if (!fromCity || !toCity || !date) return null;

  return (
    <form
      className="mt-6 rounded-xl border border-gray-100 bg-gray-50 p-4"
      onSubmit={applyFilters}
    >
      <div className="flex flex-wrap items-end gap-3">
        <label className="block text-xs font-medium text-gray-600">
          Sort by
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value)}
            className="mt-1 block rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm"
          >
            <option value="departure">Departure time</option>
            <option value="price">Lowest fare</option>
            <option value="duration">Shortest trip</option>
            <option value="availability">Most seats</option>
          </select>
        </label>

        <label className="block text-xs font-medium text-gray-600">
          Departure window
          <select
            value={timeSlot ?? 'any'}
            onChange={(e) => setTimeSlot(e.target.value as SearchFilters['timeSlot'])}
            className="mt-1 block rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm"
          >
            {Object.entries(TIME_SLOTS).map(([key, slot]) => (
              <option key={key} value={key}>
                {slot.label}
              </option>
            ))}
          </select>
        </label>

        <label className="block text-xs font-medium text-gray-600">
          Max fare (₹)
          <input
            type="number"
            min={1}
            placeholder="Any"
            value={maxPrice}
            onChange={(e) => setMaxPrice(e.target.value)}
            className="mt-1 block w-28 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm"
          />
        </label>

        <label className="block text-xs font-medium text-gray-600">
          Min seats
          <input
            type="number"
            min={1}
            placeholder="1"
            value={minSeats}
            onChange={(e) => setMinSeats(e.target.value)}
            className="mt-1 block w-24 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm"
          />
        </label>

        <button type="submit" className="btn-primary text-sm">
          Apply filters
        </button>
        <button
          type="button"
          className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 hover:border-brand"
          onClick={clearFilters}
        >
          Reset
        </button>
      </div>
    </form>
  );
}
