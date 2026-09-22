'use client';

import Link from 'next/link';
import { apiUnreachableMessage, isNetworkError } from '@/lib/fetch-errors';
import { fetchCancellationPolicies } from '@/lib/bookings-api';
import {
  filtersFromSearchParams,
  formatDurationMinutes,
  formatPolicySnippet,
  formatTripTime,
  searchTrips,
  type TripSearchResult,
} from '@/lib/search-api';
import { useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { SearchFiltersBar } from '@/components/search-filters';
import { AnimatedList, AnimatedListItem } from '@/components/motion';

export function SearchResultsInner() {
  const params = useSearchParams();
  const fromCity = params.get('fromCity') ?? '';
  const toCity = params.get('toCity') ?? '';
  const date = params.get('date') ?? '';
  const agentMode = params.get('agent') === '1';
  const [results, setResults] = useState<TripSearchResult[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [policySnippet, setPolicySnippet] = useState<string | null>(null);

  useEffect(() => {
    fetchCancellationPolicies()
      .then((policies) => setPolicySnippet(formatPolicySnippet(policies)))
      .catch(() => setPolicySnippet(null));
  }, []);

  useEffect(() => {
    if (!fromCity || !toCity || !date) {
      setLoading(false);
      setResults([]);
      return;
    }
    setLoading(true);
    const filters = filtersFromSearchParams(params);
    searchTrips(fromCity, toCity, date, filters)
      .then(setResults)
      .catch((e) => setError(isNetworkError(e) ? apiUnreachableMessage() : e.message))
      .finally(() => setLoading(false));
  }, [fromCity, toCity, date, params.toString()]);

  const seatHref = (trip: TripSearchResult) => {
    const q = new URLSearchParams({
      fromCity,
      toCity,
      date,
      fare: String(trip.fareFrom ?? trip.fare),
      ...(trip.boardingStop ? { boardingSequence: String(trip.boardingStop.sequence) } : {}),
      ...(trip.droppingStop ? { droppingSequence: String(trip.droppingStop.sequence) } : {}),
      ...(agentMode ? { agent: '1' } : {}),
    });
    return `/trips/${trip.tripId}/seats?${q.toString()}`;
  };

  const segmentDeparture = (trip: TripSearchResult) => trip.segmentDepartureAt ?? trip.departureAt;
  const segmentArrival = (trip: TripSearchResult) => trip.segmentArrivalAt ?? trip.arrivalAt;
  const segmentDuration = (trip: TripSearchResult) =>
    trip.segmentDurationMinutes ?? trip.durationMinutes ?? null;

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <h1 className="text-2xl font-bold text-charcoal">Bus results</h1>
      <p className="mt-1 text-gray-600">
        {fromCity} → {toCity} · {date}
      </p>

      {agentMode && (
        <p className="mt-4 rounded-lg border border-brand/30 bg-brand-light/30 px-4 py-3 text-sm text-charcoal">
          Agent booking mode — cash or online payment is chosen on the passenger details step.
        </p>
      )}

      {!fromCity || !toCity || !date ? (
        <p className="mt-6 text-sm text-gray-500">Choose route and date above, then search.</p>
      ) : (
        <SearchFiltersBar />
      )}

      {policySnippet && fromCity && toCity && date && (
        <p className="mt-4 rounded-lg border border-gray-100 bg-white px-4 py-3 text-xs text-gray-600">
          <strong className="text-charcoal">Cancellation:</strong> {policySnippet}.{' '}
          <Link href="/policies" className="font-medium text-brand hover:underline">
            Full policy
          </Link>
        </p>
      )}

      {loading && (
        <div className="mt-6 space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="card space-y-3 p-6">
              <div className="shimmer-block h-5 w-40" />
              <div className="shimmer-block h-4 w-64" />
              <div className="grid gap-2 sm:grid-cols-2">
                <div className="shimmer-block h-16" />
                <div className="shimmer-block h-16" />
              </div>
            </div>
          ))}
          <p className="animate-pulse-soft text-center text-sm text-gray-500">Searching buses…</p>
        </div>
      )}
      {error && <p className="mt-6 text-sm text-red-600">{error}</p>}

      {!loading && !error && results.length > 0 && (
        <p className="mt-4 text-sm text-gray-600">
          {results.length} bus{results.length === 1 ? '' : 'es'} · times shown for your boarding and dropping stops
        </p>
      )}

      <AnimatedList className="mt-6 space-y-4" key={`${fromCity}-${toCity}-${date}-${results.length}`}>
        {results.map((trip) => {
          const dep = segmentDeparture(trip);
          const arr = segmentArrival(trip);
          const duration = segmentDuration(trip);

          return (
            <AnimatedListItem key={trip.tripId}>
              <div className="card flex flex-col gap-4 sm:flex-row sm:items-stretch sm:justify-between">
              <div className="flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-semibold text-charcoal">{trip.bus.name ?? trip.bus.registrationNumber}</p>
                  {trip.busType && (
                    <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-700">
                      {trip.busType}
                    </span>
                  )}
                  {trip.ac && (
                    <span className="rounded-full bg-brand-light px-2 py-0.5 text-xs text-brand-deep">AC</span>
                  )}
                </div>
                <p className="text-sm text-gray-600">{trip.route.name}</p>
                {(trip.bus.driver1Name || trip.bus.driver2Name || trip.bus.conductorName) && (
                  <p className="mt-1 text-xs text-gray-500">
                    Bus {trip.bus.registrationNumber}
                    {(trip.bus.driver1Name || trip.bus.driver2Name) && (
                      <>
                        {' '}
                        · Drivers:{' '}
                        {[trip.bus.driver1Name, trip.bus.driver2Name].filter(Boolean).join(', ')}
                      </>
                    )}
                    {trip.bus.conductorName && <> · Conductor: {trip.bus.conductorName}</>}
                  </p>
                )}

                <div className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
                  <div className="rounded-lg bg-gray-50 px-3 py-2">
                    <p className="text-xs uppercase tracking-wide text-gray-500">Boarding</p>
                    <p className="font-medium text-charcoal">
                      {formatTripTime(dep)} · {trip.boardingStop?.city ?? fromCity}
                    </p>
                    {trip.boardingStop?.name && (
                      <p className="text-xs text-gray-500">{trip.boardingStop.name}</p>
                    )}
                  </div>
                  <div className="rounded-lg bg-gray-50 px-3 py-2">
                    <p className="text-xs uppercase tracking-wide text-gray-500">Dropping</p>
                    <p className="font-medium text-charcoal">
                      {arr ? `${formatTripTime(arr)} · ` : ''}
                      {trip.droppingStop?.city ?? toCity}
                    </p>
                    {trip.droppingStop?.name && (
                      <p className="text-xs text-gray-500">{trip.droppingStop.name}</p>
                    )}
                  </div>
                </div>

                <p className="mt-2 text-sm text-gray-600">
                  {duration != null && (
                    <span>Trip duration ~{formatDurationMinutes(duration)} · </span>
                  )}
                  <span className={trip.availableSeats <= 5 ? 'font-medium text-amber-700' : ''}>
                    {trip.availableSeats} seats left
                  </span>
                </p>

                {trip.amenities && trip.amenities.length > 0 && (
                  <p className="mt-2 text-xs text-gray-500">{trip.amenities.join(' · ')}</p>
                )}
              </div>

              <div className="flex flex-col items-stretch justify-between gap-3 sm:min-w-[140px] sm:items-end">
                <div className="text-right">
                  {trip.hasSeatDiscounts && trip.fareFrom != null ? (
                    <>
                      <p className="text-xs font-medium uppercase tracking-wide text-emerald-700">From</p>
                      <p className="text-xl font-bold text-brand">₹{trip.fareFrom}</p>
                      <p className="text-xs text-gray-400 line-through">₹{trip.fare}</p>
                    </>
                  ) : (
                    <>
                      <p className="text-xl font-bold text-brand">₹{trip.fare}</p>
                      <p className="text-xs text-gray-500">per seat</p>
                    </>
                  )}
                </div>
                <div className="flex flex-wrap gap-2 sm:justify-end">
                  <Link
                    href={`/track/${trip.tripId}`}
                    className="rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium text-brand hover:border-brand"
                  >
                    Track
                  </Link>
                  <Link href={seatHref(trip)} className="btn-primary text-center">
                    Select seats
                  </Link>
                </div>
              </div>
            </div>
            </AnimatedListItem>
          );
        })}
        {!loading && !error && results.length === 0 && fromCity && toCity && date && (
          <AnimatedListItem>
            <div className="card text-sm text-gray-600">
              <p>No buses match your search and filters.</p>
              <p className="mt-2 text-xs text-gray-500">Try another date, route segment, or reset filters above.</p>
            </div>
          </AnimatedListItem>
        )}
      </AnimatedList>
    </div>
  );
}
