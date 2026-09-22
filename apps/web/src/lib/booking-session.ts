import { sumSeatFareMap } from '@/lib/seat-pricing';

export type BookingLockSession = {
  lockToken: string;
  tripId: string;
  seatIds: string[];
  seatLabels: string[];
  expiresAt: string;
  fromCity?: string;
  toCity?: string;
  boardingSequence?: number;
  droppingSequence?: number;
  boardingStopName?: string;
  droppingStopName?: string;
  date?: string;
  fare?: number;
  seatFares?: Record<string, number>;
  routeName?: string;
  routeCode?: string;
  routeId?: string;
  busName?: string;
  departureAt?: string;
  agent?: boolean;
};

export type CheckoutSummary = BookingLockSession & {
  bookingId?: string;
  bookingReference?: string;
  totalAmount?: number;
};

const LOCK_KEY = 'ss_booking_lock';
const SUMMARY_KEY = 'ss_checkout_summary';

export function readBookingLock(): BookingLockSession | null {
  if (typeof window === 'undefined') return null;
  const raw = sessionStorage.getItem(LOCK_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as BookingLockSession;
  } catch {
    sessionStorage.removeItem(LOCK_KEY);
    return null;
  }
}

export function writeBookingLock(session: BookingLockSession) {
  if (typeof window === 'undefined') return;
  sessionStorage.setItem(LOCK_KEY, JSON.stringify(session));
}

export function patchBookingLock(patch: Partial<BookingLockSession>) {
  const current = readBookingLock();
  if (!current) return;
  writeBookingLock({ ...current, ...patch });
}

export function clearBookingLock() {
  if (typeof window === 'undefined') return;
  sessionStorage.removeItem(LOCK_KEY);
}

export function readCheckoutSummary(): CheckoutSummary | null {
  if (typeof window === 'undefined') return null;
  const raw = sessionStorage.getItem(SUMMARY_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as CheckoutSummary;
  } catch {
    sessionStorage.removeItem(SUMMARY_KEY);
    return null;
  }
}

export function writeCheckoutSummary(summary: CheckoutSummary) {
  if (typeof window === 'undefined') return;
  sessionStorage.setItem(SUMMARY_KEY, JSON.stringify(summary));
}

export function clearCheckoutSummary() {
  if (typeof window === 'undefined') return;
  sessionStorage.removeItem(SUMMARY_KEY);
}

export function lockToCheckoutSummary(
  lock: BookingLockSession,
  extra?: Pick<CheckoutSummary, 'bookingId' | 'bookingReference' | 'totalAmount'>,
): CheckoutSummary {
  const seatCount = lock.seatIds.length;
  const fare = lock.fare ?? 0;
  return {
    ...lock,
    ...extra,
    totalAmount: extra?.totalAmount ?? sumSeatFareMap(lock.seatFares, fare, seatCount),
  };
}

export function secondsUntil(iso: string): number {
  return Math.max(0, Math.floor((new Date(iso).getTime() - Date.now()) / 1000));
}

export function formatCountdown(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}
