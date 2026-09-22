'use client';

import dynamic from 'next/dynamic';
import type { MapStop, LiveBusMarker } from './route-map';

const RouteMap = dynamic(() => import('./route-map').then((m) => m.RouteMap), {
  ssr: false,
  loading: () => (
    <div className="flex h-80 w-full items-center justify-center rounded-xl bg-gray-50 text-sm text-gray-500">
      Loading map…
    </div>
  ),
});

export function RouteMapLazy(props: {
  stops: MapStop[];
  liveBus?: LiveBusMarker | null;
  className?: string;
}) {
  return <RouteMap {...props} />;
}
