'use client';

import Link from 'next/link';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState, Suspense } from 'react';
import { DualDeckSeatMap } from '@/components/dual-deck-seat-map';
import { BookingSummaryStrip } from '@/components/booking-summary-strip';
import { CustomerShell } from '@/components/customer-shell';
import { SeatLockCountdown } from '@/components/seat-lock-countdown';
import { SiteHeader } from '@/components/site-header';
import { getAccessToken } from '@/lib/api-client';
import { buildPassengersUrl, DEFAULT_FROM, DEFAULT_TO, todayIsoDate } from '@/lib/agent-booking';
import {
  readBookingLock,
  writeBookingLock,
  type BookingLockSession,
} from '@/lib/booking-session';
import { useBookingLock } from '@/hooks/use-booking-lock';
import { fetchRouteById } from '@/lib/routes-api';
import type { SeatMapItem } from '@/lib/seat-pricing';
import { buildSeatFareMap, sumSelectedSeatFares } from '@/lib/seat-pricing';

type StoredLock = BookingLockSession;

function lockContext(searchParams: URLSearchParams) {
  return {
    fromCity: searchParams.get('fromCity') ?? undefined,
    toCity: searchParams.get('toCity') ?? undefined,
    date: searchParams.get('date') ?? undefined,
    fare: Number(searchParams.get('fare') ?? '650'),
    boardingSequence: Number(searchParams.get('boardingSequence') ?? '0') || undefined,
    droppingSequence: Number(searchParams.get('droppingSequence') ?? '0') || undefined,
    agent: searchParams.get('agent') === '1',
  };
}

function buildLockSession(
  lockData: { lockToken: string; expiresAt: string; seatIds: string[] },
  ctx: ReturnType<typeof lockContext> & { tripId: string },
  seats: SeatMapItem[],
  meta: {
    routeId?: string;
    routeCode?: string;
    routeName?: string;
    busName?: string;
    departureAt?: string;
  },
): BookingLockSession {
  const seatLabels = lockData.seatIds.map(
    (id) => seats.find((s) => s.id === id)?.label ?? id.slice(0, 6),
  );
  return {
    lockToken: lockData.lockToken,
    expiresAt: lockData.expiresAt,
    tripId: ctx.tripId,
    seatIds: lockData.seatIds,
    seatLabels,
    seatFares: buildSeatFareMap(lockData.seatIds, seats, ctx.fare),
    fromCity: ctx.fromCity,
    toCity: ctx.toCity,
    date: ctx.date,
    fare: ctx.fare,
    boardingSequence: ctx.boardingSequence,
    droppingSequence: ctx.droppingSequence,
    routeId: meta.routeId,
    routeCode: meta.routeCode,
    routeName: meta.routeName,
    busName: meta.busName,
    departureAt: meta.departureAt,
    agent: ctx.agent,
  };
}

function persistLock(
  lockData: { lockToken: string; expiresAt: string; seatIds: string[] },
  tripId: string,
  searchParams: URLSearchParams,
  seats: SeatMapItem[],
  meta: {
    routeId?: string;
    routeCode?: string;
    routeName?: string;
    busName?: string;
    departureAt?: string;
  },
) {
  const ctx = { ...lockContext(searchParams), tripId };
  writeBookingLock(buildLockSession(lockData, ctx, seats, meta));
}

function formatFetchError(err: unknown) {
  if (err instanceof TypeError && err.message === 'Failed to fetch') {
    return 'Cannot reach the API. Make sure `npm run dev:api` is running on port 4000.';
  }
  return err instanceof Error ? err.message : 'Something went wrong';
}

function passengerQuery(tripId: string, searchParams: URLSearchParams) {
  const agent = searchParams.get('agent') === '1';
  const reschedule = searchParams.get('reschedule');
  let url = buildPassengersUrl(tripId, agent);
  if (reschedule) url += `&reschedule=${encodeURIComponent(reschedule)}`;
  return url;
}

function SeatSelectionContent() {
  const { tripId } = useParams<{ tripId: string }>();
  const searchParams = useSearchParams();
  const router = useRouter();
  const baseFare = Number(searchParams.get('fare') ?? '1400');
  const agentMode = searchParams.get('agent') === '1';
  const rescheduleRef = searchParams.get('reschedule');
  const requiredSeatCount = Number(searchParams.get('seatCount') ?? '0') || null;
  const [seats, setSeats] = useState<SeatMapItem[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [heldSeatIds, setHeldSeatIds] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [meta, setMeta] = useState<{
    busName?: string;
    routeName?: string;
    routeId?: string;
    routeCode?: string;
    departureAt?: string;
  }>({});
  const { lock, valid, countdownLabel, secondsLeft, expired } = useBookingLock(tripId);
  const hasActiveLock = Boolean(lock?.lockToken && valid && !expired);

  useEffect(() => {
    const pendingRaw = sessionStorage.getItem('ss_pending_seats');
    if (pendingRaw) {
      try {
        const pending = JSON.parse(pendingRaw) as { tripId?: string; seatIds?: string[] };
        if (pending.tripId === tripId && pending.seatIds?.length) {
          setSelected(pending.seatIds);
        }
      } catch {
        sessionStorage.removeItem('ss_pending_seats');
      }
    }

    const lockRaw = readBookingLock();
    if (lockRaw?.tripId === tripId && lockRaw.seatIds?.length) {
      setSelected(lockRaw.seatIds);
      setHeldSeatIds(lockRaw.seatIds);
    }

    const base = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1';
    const boardingSequence = searchParams.get('boardingSequence');
    const droppingSequence = searchParams.get('droppingSequence');
    const q = new URLSearchParams();
    if (baseFare) q.set('baseFare', String(baseFare));
    if (boardingSequence) q.set('fromSequence', boardingSequence);
    if (droppingSequence) q.set('toSequence', droppingSequence);
    const query = q.toString();
    fetch(`${base}/trips/${tripId}/seats${query ? `?${query}` : ''}`)
      .then(async (res) => {
        if (!res.ok) throw new Error('Could not load seats');
        return res.json();
      })
      .then(async (data) => {
        setSeats(data.seats);
        const nextMeta = {
          busName: data.bus?.name,
          routeName: data.route?.name,
          routeId: data.route?.id,
          routeCode: data.route?.code,
          departureAt: data.departureAt,
        };
        setMeta(nextMeta);

        const fromCity = searchParams.get('fromCity');
        const toCity = searchParams.get('toCity');
        if (data.route?.id && fromCity && toCity && !searchParams.get('boardingSequence')) {
          const route = await fetchRouteById(data.route.id);
          if (route) {
            const boarding = route.stops.find(
              (s) => s.city.toLowerCase() === fromCity.toLowerCase(),
            );
            const dropping = route.stops.find((s) => s.city.toLowerCase() === toCity.toLowerCase());
            if (boarding && dropping) {
              const url = new URL(window.location.href);
              url.searchParams.set('boardingSequence', String(boarding.sequence));
              url.searchParams.set('droppingSequence', String(dropping.sequence));
              window.history.replaceState({}, '', url.toString());
            }
          }
        }
      })
      .catch((e) => setError(e.message));
  }, [tripId, baseFare, searchParams]);

  function toggleSeat(id: string, status: SeatMapItem['status']) {
    if (status !== 'available' && !heldSeatIds.includes(id)) return;
    setSelected((prev) => (prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]));
  }

  async function reuseExistingLock(lock: StoredLock, token: string, base: string) {
    const res = await fetch(
      `${base}/bookings/locks/validate?lockToken=${encodeURIComponent(lock.lockToken)}&tripId=${encodeURIComponent(tripId)}`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.valid) return false;

    writeBookingLock(
      buildLockSession(
        {
          lockToken: lock.lockToken,
          expiresAt: data.expiresAt ?? lock.expiresAt,
          seatIds: data.seatIds ?? lock.seatIds,
        },
        { ...lockContext(searchParams), tripId },
        seats,
        meta,
      ),
    );
    if (rescheduleRef) {
      return submitReschedule(lock.lockToken, token, base);
    }
    router.push(passengerQuery(tripId, searchParams));
    return true;
  }

  async function submitReschedule(lockToken: string, token: string, base: string) {
    if (!rescheduleRef) return false;
    const res = await fetch(`${base}/bookings/${encodeURIComponent(rescheduleRef)}/reschedule`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        tripId,
        lockToken,
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(typeof data.message === 'string' ? data.message : 'Reschedule failed');
      return true;
    }
    sessionStorage.removeItem('ss_booking_lock');
    if (data.paymentRequired && data.bookingId) {
      router.push(`/book/payment?bookingId=${data.bookingId}`);
      return true;
    }
    router.push(`/book/confirmation?ref=${data.bookingReference}&paid=1`);
    return true;
  }

  async function continueBooking() {
    setLoading(true);
    setError(null);

    try {
      const returnPath = `/trips/${tripId}/seats${window.location.search}`;
      const token = getAccessToken();
      const base = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1';

      if (!token) {
        sessionStorage.setItem(
          'ss_pending_seats',
          JSON.stringify({
            tripId,
            seatIds: selected,
            ...lockContext(searchParams),
          }),
        );
        router.push(`/login?next=${encodeURIComponent(returnPath)}`);
        return;
      }

      const existingLock = readBookingLock();
      if (existingLock?.tripId === tripId && existingLock.lockToken) {
          const sameSeats =
            !selected.length ||
            (existingLock.seatIds &&
              selected.length === existingLock.seatIds.length &&
              selected.every((id) => existingLock.seatIds!.includes(id)));
          if (sameSeats && (await reuseExistingLock(existingLock, token, base))) {
            return;
          }
        }

      if (rescheduleRef) {
        const existingLock = readBookingLock();
        if (
          existingLock?.tripId === tripId &&
          existingLock.lockToken &&
          selected.length &&
          existingLock.seatIds?.length === selected.length &&
          selected.every((id) => existingLock.seatIds.includes(id))
        ) {
          if (await submitReschedule(existingLock.lockToken, token, base)) return;
        }
      }

      if (!selected.length) {
        setError('Select at least one seat to continue.');
        return;
      }

      if (rescheduleRef && requiredSeatCount && selected.length !== requiredSeatCount) {
        setError(`Select exactly ${requiredSeatCount} seat${requiredSeatCount === 1 ? '' : 's'} for reschedule.`);
        return;
      }

      const lockRes = await fetch(`${base}/bookings/locks`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ tripId, seatIds: selected }),
      });

      const lockData = await lockRes.json().catch(() => ({}));
      if (lockRes.status === 401) {
        sessionStorage.setItem(
          'ss_pending_seats',
          JSON.stringify({
            tripId,
            seatIds: selected,
            ...lockContext(searchParams),
          }),
        );
        router.push(`/login?next=${encodeURIComponent(returnPath)}`);
        return;
      }
      if (!lockRes.ok) {
        const message =
          typeof lockData.message === 'string'
            ? lockData.message
            : 'Could not lock seats — they may have been taken';
        setError(message);
        return;
      }

      sessionStorage.removeItem('ss_pending_seats');
      persistLock(lockData, tripId, searchParams, seats, meta);
      setHeldSeatIds(selected);

      if (rescheduleRef) {
        if (await submitReschedule(lockData.lockToken, token, base)) return;
        return;
      }

      router.push(passengerQuery(tripId, searchParams));
    } catch (err) {
      setError(formatFetchError(err));
    } finally {
      setLoading(false);
    }
  }

  const backSearchHref = agentMode
    ? `/search?agent=1&fromCity=${searchParams.get('fromCity') ?? DEFAULT_FROM}&toCity=${searchParams.get('toCity') ?? DEFAULT_TO}&date=${searchParams.get('date') ?? todayIsoDate()}`
    : '/search';

  const selectedTotal = sumSelectedSeatFares(selected, seats, baseFare);
  const hasVariablePricing = seats.some((s) => s.discounted);
  const summaryLock = lock ?? readBookingLock();

  return (
    <CustomerShell>
      <SiteHeader />
      <BookingSummaryStrip
        summary={
          summaryLock
            ? {
                ...summaryLock,
                seatLabels:
                  summaryLock.seatLabels.length > 0
                    ? summaryLock.seatLabels
                    : selected.map((id) => seats.find((s) => s.id === id)?.label ?? '').filter(Boolean),
                fare: baseFare,
                seatFares: buildSeatFareMap(selected, seats, baseFare),
                totalAmount: selectedTotal,
              }
            : null
        }
      />
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <Link
          href={
            rescheduleRef ? `/bookings/${encodeURIComponent(rescheduleRef)}/reschedule` : backSearchHref
          }
          className="text-sm text-brand hover:text-brand-deep"
        >
          ← {rescheduleRef ? 'Back to reschedule' : agentMode ? 'Back to agent search' : 'Back to results'}
        </Link>
        {agentMode && (
          <p className="mt-4 rounded-lg border border-brand/30 bg-brand-light/30 px-4 py-3 text-sm text-charcoal">
            Agent booking — passenger step will use your cash or online payment setting.
          </p>
        )}
        {rescheduleRef && (
          <p className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            Rescheduling booking <strong>{rescheduleRef}</strong>
            {requiredSeatCount
              ? ` — select exactly ${requiredSeatCount} seat${requiredSeatCount === 1 ? '' : 's'}`
              : ' — select seats on the new trip'}
            , then continue.
          </p>
        )}
        <p className="mt-2 text-sm text-gray-600">
          {meta.busName} · {meta.routeName} ·{' '}
          {hasVariablePricing ? 'Discounted seats available on this trip' : `₹${baseFare} per seat on this segment`}
        </p>

        {hasActiveLock && (
          <SeatLockCountdown
            countdownLabel={countdownLabel}
            secondsLeft={secondsLeft}
            expired={expired}
            className="mt-4"
          />
        )}

        {heldSeatIds.length > 0 && (
          <p className="mt-4 rounded-lg border border-brand/20 bg-brand-light/30 px-4 py-3 text-sm text-charcoal">
            Your previously held seats are restored. Click Continue to proceed, or change your selection.
          </p>
        )}

        {error && (
          <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {seats.length > 0 ? (
          <div className="mt-6">
            <DualDeckSeatMap
              seats={seats}
              selected={selected}
              heldSeatIds={heldSeatIds}
              baseFare={baseFare}
              onToggle={toggleSeat}
            />
          </div>
        ) : (
          !error && <p className="mt-6 text-sm text-gray-500">Loading seat map…</p>
        )}

        <button
          type="button"
          className="btn-primary mt-8 w-full sm:w-auto"
          onClick={continueBooking}
          disabled={loading || (hasActiveLock && expired)}
        >
          {loading
            ? 'Please wait…'
            : selected.length
              ? `Continue (${selected.length} seat${selected.length > 1 ? 's' : ''} · ₹${selectedTotal})`
              : 'Continue'}
        </button>
      </div>
    </CustomerShell>
  );
}

export default function SeatSelectionPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-white"><SiteHeader /><p className="p-10 text-center text-sm text-gray-500">Loading seats…</p></div>}>
      <SeatSelectionContent />
    </Suspense>
  );
}
