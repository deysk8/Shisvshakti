'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { FormEvent, useEffect, useState } from 'react';
import {
  DEFAULT_FROM_CITY,
  DEFAULT_TO_CITY,
} from '@shiva-sakti/shared';
import { fetchPublicRoutes, uniqueCitiesFromRoutes } from '@/lib/routes-api';
import { earliestBookableDate, todayIsoDate } from '@/lib/agent-booking';
import { CityCombobox } from '@/components/city-combobox';

const FALLBACK_CITIES = [DEFAULT_FROM_CITY, DEFAULT_TO_CITY];

export function SearchForm() {
  const router = useRouter();
  const urlParams = useSearchParams();
  const agentMode = urlParams.get('agent') === '1';
  const [fromCity, setFromCity] = useState(DEFAULT_FROM_CITY);
  const [toCity, setToCity] = useState(DEFAULT_TO_CITY);
  const [date, setDate] = useState('');
  const [cities, setCities] = useState<string[]>(FALLBACK_CITIES);

  const minDate = earliestBookableDate();

  useEffect(() => {
    fetchPublicRoutes()
      .then((routes) => {
        const list = uniqueCitiesFromRoutes(routes);
        if (list.length >= 2) setCities(list);
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    const from = urlParams.get('fromCity');
    const to = urlParams.get('toCity');
    const d = urlParams.get('date');
    if (from) setFromCity(from);
    if (to) setToCity(to);
    if (d) setDate(d);
    else if (agentMode) setDate(minDate);
  }, [urlParams, agentMode, minDate]);

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    const params = new URLSearchParams({ fromCity, toCity, date });
    if (agentMode) params.set('agent', '1');
    router.push(`/search?${params.toString()}`);
  }

  function swapCities() {
    setFromCity(toCity);
    setToCity(fromCity);
  }

  function pickDate(offsetDays: number) {
    const d = new Date();
    d.setDate(d.getDate() + offsetDays);
    setDate(d.toISOString().slice(0, 10));
  }


  return (
    <div className="max-w-4xl">
      {agentMode && (
        <p className="mb-3 rounded-lg border border-brand/30 bg-brand-light/40 px-4 py-2 text-sm text-charcoal">
          Agent booking — search a trip, then complete cash or online payment on the passenger step.
        </p>
      )}
      <form className="card" onSubmit={onSubmit}>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5 lg:items-end">
          <CityCombobox
            label="From"
            value={fromCity}
            onChange={setFromCity}
            options={cities}
            placeholder="City or stop"
          />
          <div className="flex items-end gap-2">
            <button
              type="button"
              onClick={swapCities}
              className="mb-1 rounded-lg border border-gray-200 px-3 py-2 text-sm transition-all duration-300 hover:border-brand hover:bg-brand-light/30 active:rotate-180"
              aria-label="Swap cities"
            >
              ⇄
            </button>
            <div className="flex-1">
              <CityCombobox
                label="To"
                value={toCity}
                onChange={setToCity}
                options={cities}
                exclude={fromCity}
                placeholder="Destination"
              />
            </div>
          </div>
          <label className="block text-sm font-medium text-gray-700 lg:col-span-1">
            Date
            <input
              type="date"
              required
              min={minDate}
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2.5 text-charcoal outline-none ring-brand focus:ring-2"
            />
          </label>
          <button type="submit" className="btn-primary w-full lg:col-span-1">
            Search buses
          </button>
        </div>
        <div className="mt-3 flex flex-wrap gap-2 text-xs">
          <button type="button" className="rounded-full bg-gray-100 px-3 py-1" onClick={() => pickDate(0)}>
            Today
          </button>
          <button type="button" className="rounded-full bg-gray-100 px-3 py-1" onClick={() => pickDate(1)}>
            Tomorrow
          </button>
          {agentMode && (
            <Link href="/agent" className="rounded-full border border-brand/30 px-3 py-1 text-brand hover:bg-brand-light/30">
              ← Agent portal
            </Link>
          )}
        </div>
      </form>
    </div>
  );
}
