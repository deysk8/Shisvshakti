'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { LAUNCH_ROUTE_CODE } from '@shiva-sakti/shared';
import { SiteHeader } from '@/components/site-header';
import { RouteMapLazy } from '@/components/route-map-lazy';
import { fetchRouteMap, fetchTripPosition, type TripPosition } from '@/lib/maps-api';

export default function TrackTripPage() {
  const { tripId } = useParams<{ tripId: string }>();
  const [position, setPosition] = useState<TripPosition | null>(null);
  const [stops, setStops] = useState<
    { sequence: number; name: string; city: string | null; latitude: number; longitude: number }[]
  >([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!tripId) return;

    const load = () => {
      fetchTripPosition(tripId)
        .then((pos) => {
          if (!pos) return;
          setPosition(pos);
          const code = pos.routeCode ?? LAUNCH_ROUTE_CODE;
          fetchRouteMap(code)
            .then((map) => {
              if (map) setStops(map.stops);
            })
            .catch(() => undefined);
        })
        .catch(() => setError('Could not load trip position'));
    };

    load();
    const timer = setInterval(load, 30_000);
    return () => clearInterval(timer);
  }, [tripId]);

  return (
    <div className="min-h-screen bg-white">
      <SiteHeader />
      <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
        <Link href="/search" className="text-sm text-brand hover:text-brand-deep">
          ← Back to search
        </Link>
        <h1 className="mt-4 text-2xl font-bold text-charcoal">Live bus tracking</h1>
        <p className="mt-1 text-sm text-gray-600">
          {position?.routeName ?? 'Shiv Shakti Express'} · Trip {tripId?.slice(0, 8)}…
        </p>

        {position?.source === 'demo' && (
          <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            Demo mode — bus position is simulated along the route based on departure time (
            {position.progressPercent}% complete).
          </p>
        )}

        {position?.source === 'gps' && (
          <p className="mt-3 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-900">
            Live GPS — ETAs below are estimated from current bus location.
          </p>
        )}

        {error && <p className="mt-4 text-sm text-red-600">{error}</p>}

        {stops.length >= 2 && (
          <div className="mt-6">
            <RouteMapLazy
              stops={stops}
              liveBus={
                position
                  ? {
                      latitude: position.latitude,
                      longitude: position.longitude,
                      label: position.busName ?? 'Shiv Shakti Bus',
                    }
                  : null
              }
              className="h-96 w-full rounded-xl border border-gray-100"
            />
          </div>
        )}

        {position && (
          <div className="mt-6 card grid gap-2 text-sm text-gray-700 sm:grid-cols-2">
            <p>
              <span className="font-medium text-charcoal">Status:</span> {position.tripStatus}
            </p>
            <p>
              <span className="font-medium text-charcoal">Progress:</span> {position.progressPercent}%
            </p>
            {position.nextStopName && (
              <p className="sm:col-span-2">
                <span className="font-medium text-charcoal">Next stop:</span> {position.nextStopName}
              </p>
            )}
            <p className="sm:col-span-2 text-xs text-gray-400">
              Updated {new Date(position.recordedAt).toLocaleString('en-IN')}
            </p>
          </div>
        )}

        {position?.stopEtas && position.stopEtas.length > 0 && (
          <div className="mt-6 card">
            <h2 className="font-semibold text-charcoal">Stop ETAs</h2>
            <ul className="mt-3 space-y-2 text-sm">
              {position.stopEtas.map((stop) => (
                <li key={stop.sequence} className="flex justify-between gap-2 border-b border-gray-50 pb-2">
                  <span className={stop.passed ? 'text-gray-400 line-through' : ''}>
                    {stop.city ?? stop.name}
                  </span>
                  <span className="text-gray-500">
                    {stop.passed
                      ? 'Passed'
                      : stop.etaMinutes != null
                        ? `~${stop.etaMinutes} min`
                        : '—'}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
