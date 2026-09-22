import { apiBaseUrl, safeFetchJson } from '@/lib/safe-fetch';

export type RouteMapData = {
  routeCode: string;
  routeName: string;
  totalDistanceKm: number | null;
  estimatedDurationMinutes: number | null;
  stops: {
    sequence: number;
    name: string;
    city: string | null;
    latitude: number;
    longitude: number;
    arrivalOffsetMin: number;
  }[];
  polyline: [number, number][];
  bounds: { south: number; north: number; west: number; east: number };
};

export async function fetchRouteMap(code: string): Promise<RouteMapData | null> {
  return safeFetchJson<RouteMapData | null>(
    `${apiBaseUrl()}/maps/routes/${encodeURIComponent(code)}`,
    null,
    { next: { revalidate: 300 } },
  );
}

export type TripPosition = {
  tripId: string;
  busName: string | null;
  routeName: string;
  routeCode?: string;
  latitude: number;
  longitude: number;
  source: 'demo' | 'gps';
  recordedAt: string;
  tripStatus: string;
  progressPercent: number;
  nextStopName: string | null;
  stopEtas?: {
    sequence: number;
    name: string;
    city: string | null;
    etaMinutes: number | null;
    passed: boolean;
  }[];
};

export async function fetchTripPosition(tripId: string): Promise<TripPosition | null> {
  return safeFetchJson<TripPosition | null>(
    `${apiBaseUrl()}/tracking/trips/${encodeURIComponent(tripId)}/position`,
    null,
    { cache: 'no-store' },
  );
}
