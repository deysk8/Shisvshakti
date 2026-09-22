import { apiBaseUrl, safeFetchJson } from '@/lib/safe-fetch';

export type PublicRouteStop = {
  sequence: number;
  name: string;
  city: string;
  arrivalOffsetMin: number;
  departureOffsetMin: number;
};

export type PublicRouteFareRule = {
  fromSequence: number;
  toSequence: number;
  amount: number;
};

export type PublicRoute = {
  id: string;
  code: string;
  name: string;
  totalDistanceKm: string | null;
  estimatedDurationMinutes: number | null;
  stops: PublicRouteStop[];
};

export type PublicRouteDetail = PublicRoute & {
  fareRules: PublicRouteFareRule[];
};

export async function fetchPublicRoutes(): Promise<PublicRoute[]> {
  const data = await safeFetchJson<Array<Record<string, unknown>>>(`${apiBaseUrl()}/routes`, [], {
    next: { revalidate: 60 },
  });
  return data.map(mapRoute);
}

export async function fetchRouteByCode(code: string): Promise<PublicRouteDetail | null> {
  const raw = await safeFetchJson<Record<string, unknown> | null>(
    `${apiBaseUrl()}/routes/code/${encodeURIComponent(code)}`,
    null,
    { next: { revalidate: 60 } },
  );
  return raw ? mapRouteDetail(raw) : null;
}

export async function fetchRouteById(id: string): Promise<PublicRouteDetail | null> {
  const raw = await safeFetchJson<Record<string, unknown> | null>(
    `${apiBaseUrl()}/routes/${encodeURIComponent(id)}`,
    null,
    { cache: 'no-store' },
  );
  return raw ? mapRouteDetail(raw) : null;
}

export function uniqueCitiesFromRoutes(routes: PublicRoute[]): string[] {
  const cities = new Set<string>();
  for (const route of routes) {
    for (const stop of route.stops) {
      if (stop.city) cities.add(stop.city);
    }
  }
  return [...cities].sort((a, b) => a.localeCompare(b));
}

export function fareForSegment(
  route: PublicRouteDetail,
  fromSequence: number,
  toSequence: number,
): number | null {
  const rule = route.fareRules.find(
    (r) => r.fromSequence === fromSequence && r.toSequence === toSequence,
  );
  return rule ? rule.amount : null;
}

function mapRoute(raw: Record<string, unknown>): PublicRoute {
  const routeStops = (raw.routeStops as Array<Record<string, unknown>>) ?? [];
  return {
    id: String(raw.id),
    code: String(raw.code),
    name: String(raw.name),
    totalDistanceKm: raw.totalDistanceKm != null ? String(raw.totalDistanceKm) : null,
    estimatedDurationMinutes:
      raw.estimatedDurationMinutes != null ? Number(raw.estimatedDurationMinutes) : null,
    stops: mapRouteStops(routeStops),
  };
}

function mapRouteDetail(raw: Record<string, unknown>): PublicRouteDetail {
  const base = mapRoute(raw);
  const fareRules = (raw.fareRules as Array<Record<string, unknown>>) ?? [];
  return {
    ...base,
    fareRules: fareRules.map((rule) => ({
      fromSequence: Number(rule.fromSequence),
      toSequence: Number(rule.toSequence),
      amount: Number(rule.amount),
    })),
  };
}

function mapRouteStops(routeStops: Array<Record<string, unknown>>): PublicRouteStop[] {
  return routeStops.map((rs) => ({
    sequence: Number(rs.sequence),
    name: String((rs.stop as { name: string }).name),
    city: String((rs.stop as { city: string }).city ?? ''),
    arrivalOffsetMin: Number(rs.arrivalOffsetMin),
    departureOffsetMin: Number(rs.departureOffsetMin),
  }));
}

function formatMinutes(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${h}h ${m.toString().padStart(2, '0')}m`;
}

export { formatMinutes };
