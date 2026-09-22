import { fetchRouteMap } from '@/lib/maps-api';
import { RouteMapLazy } from './route-map-lazy';

import { LAUNCH_ROUTE_CODE } from '@shiva-sakti/shared';

const LAUNCH_ROUTE_CODE_LOCAL = LAUNCH_ROUTE_CODE;
export async function LaunchRouteMap() {
  const map = await fetchRouteMap(LAUNCH_ROUTE_CODE);
  if (!map) return null;

  return (
    <div className="mt-6 overflow-hidden rounded-xl border border-gray-100 shadow-card">
      <RouteMapLazy stops={map.stops} />
      <p className="border-t border-gray-100 bg-gray-50 px-4 py-2 text-xs text-gray-500">
        Route map — OpenStreetMap (free, no API key)
      </p>
    </div>
  );
}
