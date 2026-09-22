import type { CancellationPolicy } from '@/lib/bookings-api';
import { DEFAULT_TIMEZONE } from '@shiva-sakti/shared';

export type TripSearchResult = {
  tripId: string;
  departureAt: string;
  arrivalAt: string | null;
  fare: number;
  fareFrom?: number;
  hasSeatDiscounts?: boolean;
  availableSeats: number;
  totalSeats?: number;
  bus: {
    name: string | null;
    registrationNumber: string;
    driver1Name?: string | null;
    driver2Name?: string | null;
    conductorName?: string | null;
  };
  route: { name: string; code?: string };
  durationMinutes: number | null;
  busType?: string;
  amenities?: string[];
  ac?: boolean;
  boardingStop?: {
    city: string;
    name: string;
    sequence: number;
    departureOffsetMin?: number;
  };
  droppingStop?: {
    city: string;
    name: string;
    sequence: number;
    arrivalOffsetMin?: number;
  };
  segmentDepartureAt?: string;
  segmentArrivalAt?: string;
  segmentDurationMinutes?: number;
};

export type SearchFilters = {
  sort?: 'departure' | 'price' | 'duration' | 'availability';
  maxPrice?: number;
  minSeats?: number;
  departAfter?: string;
  departBefore?: string;
  timeSlot?: 'any' | 'morning' | 'afternoon' | 'evening';
};

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1';

export const TIME_SLOTS: Record<
  Exclude<SearchFilters['timeSlot'], undefined>,
  { label: string; departAfter?: string; departBefore?: string }
> = {
  any: { label: 'Any time' },
  morning: { label: 'Morning (5am–12pm)', departAfter: '05:00', departBefore: '11:59' },
  afternoon: { label: 'Afternoon (12–5pm)', departAfter: '12:00', departBefore: '16:59' },
  evening: { label: 'Evening (5–11pm)', departAfter: '17:00', departBefore: '23:59' },
};

export function filtersFromSearchParams(params: URLSearchParams): SearchFilters {
  const timeSlot = (params.get('timeSlot') as SearchFilters['timeSlot']) ?? 'any';
  const slot = TIME_SLOTS[timeSlot] ?? TIME_SLOTS.any;
  return {
    sort: (params.get('sort') as SearchFilters['sort']) ?? undefined,
    maxPrice: params.get('maxPrice') ? Number(params.get('maxPrice')) : undefined,
    minSeats: params.get('minSeats') ? Number(params.get('minSeats')) : undefined,
    timeSlot,
    departAfter: params.get('departAfter') ?? slot.departAfter,
    departBefore: params.get('departBefore') ?? slot.departBefore,
  };
}

export function buildSearchQuery(
  fromCity: string,
  toCity: string,
  date: string,
  filters: SearchFilters,
  agentMode?: boolean,
): URLSearchParams {
  const q = new URLSearchParams({ fromCity, toCity, date });
  if (agentMode) q.set('agent', '1');
  if (filters.sort) q.set('sort', filters.sort);
  if (filters.maxPrice != null && filters.maxPrice > 0) q.set('maxPrice', String(filters.maxPrice));
  if (filters.minSeats != null && filters.minSeats > 0) q.set('minSeats', String(filters.minSeats));
  if (filters.timeSlot && filters.timeSlot !== 'any') q.set('timeSlot', filters.timeSlot);
  if (filters.departAfter) q.set('departAfter', filters.departAfter);
  if (filters.departBefore) q.set('departBefore', filters.departBefore);
  return q;
}

export async function searchTrips(
  fromCity: string,
  toCity: string,
  date: string,
  filters: SearchFilters = {},
): Promise<TripSearchResult[]> {
  const q = buildSearchQuery(fromCity, toCity, date, filters);
  const res = await fetch(`${API_BASE}/search/trips?${q.toString()}`, { cache: 'no-store' });
  if (!res.ok) throw new Error('Search failed');
  return res.json();
}

export function formatTripTime(iso: string) {
  return new Date(iso).toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: DEFAULT_TIMEZONE,
  });
}

export function formatTripDateTime(iso: string) {
  return new Date(iso).toLocaleString('en-IN', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: DEFAULT_TIMEZONE,
  });
}

export function formatDurationMinutes(minutes: number) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h <= 0) return `${m}m`;
  return `${h}h ${m.toString().padStart(2, '0')}m`;
}

export function formatPolicySnippet(policies: CancellationPolicy[]): string {
  if (!policies.length) {
    return 'Cancellation refunds vary by time before departure.';
  }
  return [...policies]
    .sort((a, b) => b.refundPercent - a.refundPercent)
    .slice(0, 3)
    .map((p) => {
      const window =
        p.maxHoursBeforeDeparture != null
          ? `${p.minHoursBeforeDeparture}–${p.maxHoursBeforeDeparture}h before`
          : `${p.minHoursBeforeDeparture}h+ before`;
      return `${p.refundPercent}% refund ${window}`;
    })
    .join(' · ');
}
