'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { FormEvent, useEffect, useMemo, useState, Suspense } from 'react';
import { BookingSummaryStrip } from '@/components/booking-summary-strip';
import { CustomerShell } from '@/components/customer-shell';
import {
  emptyPassengerRows,
  PassengerFormList,
  type PassengerRow,
} from '@/components/passenger-form-list';
import { SeatLockCountdown } from '@/components/seat-lock-countdown';
import { SiteHeader } from '@/components/site-header';
import { StopPicker } from '@/components/stop-picker';
import { getAccessToken } from '@/lib/api-client';
import { buildSeatsUrl, DEFAULT_FROM, DEFAULT_TO } from '@/lib/agent-booking';
import { getAgentCashMode, setAgentCashMode } from '@/lib/agent-api';
import {
  clearBookingLock,
  lockToCheckoutSummary,
  patchBookingLock,
  readBookingLock,
  writeCheckoutSummary,
  type BookingLockSession,
} from '@/lib/booking-session';
import { useBookingLock } from '@/hooks/use-booking-lock';
import { formatInr, sumSeatFareMap } from '@/lib/seat-pricing';
import { fetchRouteByCode } from '@/lib/routes-api';
import { fetchLoyaltyBalance, fetchSavedPassengers, previewCoupon } from '@/lib/features-api';
import { fetchBookingPolicies, type BookingPolicies } from '@/lib/public-api';

function PassengerContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tripId = searchParams.get('tripId');
  const agentMode = searchParams.get('agent') === '1';
  const { lock, valid, countdownLabel, secondsLeft, expired } = useBookingLock(tripId);

  const [error, setError] = useState<string | null>(null);
  const [contactName, setContactName] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [isAgent, setIsAgent] = useState(false);
  const [agentCash, setAgentCash] = useState(false);
  const [seniorCitizen, setSeniorCitizen] = useState(false);
  const [couponCode, setCouponCode] = useState('');
  const [couponDiscount, setCouponDiscount] = useState(0);
  const [redeemPoints, setRedeemPoints] = useState(0);
  const [loyaltyBalance, setLoyaltyBalance] = useState(0);
  const [policies, setPolicies] = useState<BookingPolicies | null>(null);
  const [savedPassengers, setSavedPassengers] = useState<
    { id: string; fullName: string; age: number | null; gender: string | null; phone: string | null }[]
  >([]);
  const [passengerRows, setPassengerRows] = useState<PassengerRow[]>([]);
  const [segment, setSegment] = useState({
    boardingSequence: 1,
    droppingSequence: 2,
    fromCity: DEFAULT_FROM,
    toCity: DEFAULT_TO,
    fare: 1400,
  });
  const [routeId, setRouteId] = useState<string | null>(null);

  useEffect(() => {
    const token = getAccessToken();
    if (!token || !tripId) {
      const next =
        typeof window !== 'undefined' ? window.location.pathname + window.location.search : '/book/passengers';
      router.push(`/login?next=${encodeURIComponent(next)}`);
      return;
    }

    const base = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1';
    fetch(`${base}/auth/me`, { headers: { Authorization: `Bearer ${token}` } })
      .then(async (res) => (res.ok ? res.json() : null))
      .then((user: { email?: string; phone?: string; fullName?: string; role?: string } | null) => {
        if (user?.role === 'AGENT') {
          setIsAgent(true);
          setAgentCash(getAgentCashMode());
        } else {
          if (user?.email) setContactEmail(user.email);
          if (user?.phone) setContactPhone(user.phone);
          if (user?.fullName) setContactName(user.fullName);
        }
        if (user?.role !== 'AGENT') {
          fetchLoyaltyBalance(token)
            .then((b) => setLoyaltyBalance(b.pointsBalance))
            .catch(() => undefined);
          fetchSavedPassengers(token)
            .then(setSavedPassengers)
            .catch(() => undefined);
        }
      })
      .catch(() => undefined);

    const stored = readBookingLock();
    if (!stored || stored.tripId !== tripId) {
      setError('No seat lock found — please select seats again.');
      return;
    }

    setPassengerRows(emptyPassengerRows(stored.seatLabels.length || stored.seatIds.length));
    setSegment({
      boardingSequence: stored.boardingSequence ?? 1,
      droppingSequence: stored.droppingSequence ?? 4,
      fromCity: stored.fromCity ?? DEFAULT_FROM,
      toCity: stored.toCity ?? DEFAULT_TO,
      fare: stored.fare ?? 1400,
    });
    setRouteId(stored.routeId ?? null);
    if (!stored.routeId && stored.routeCode) {
      fetchRouteByCode(stored.routeCode)
        .then((route) => {
          if (route) {
            setRouteId(route.id);
            patchBookingLock({ routeId: route.id });
          }
        })
        .catch(() => undefined);
    }

    fetchBookingPolicies().then(setPolicies).catch(() => undefined);
  }, [router, tripId]);

  useEffect(() => {
    if (lock?.seatLabels?.length && passengerRows.length !== lock.seatLabels.length) {
      setPassengerRows(emptyPassengerRows(lock.seatLabels.length));
    }
  }, [lock?.seatLabels, passengerRows.length]);

  function onAgentCashChange(checked: boolean) {
    setAgentCash(checked);
    setAgentCashMode(checked);
  }

  const seatLabels = lock?.seatLabels ?? [];
  const seatSubtotal = useMemo(
    () => sumSeatFareMap(lock?.seatFares, segment.fare, seatLabels.length),
    [lock?.seatFares, segment.fare, seatLabels.length],
  );
  const estimatedTotal = useMemo(() => {
    let total = seatSubtotal;
    if (policies?.seniorDiscountEnabled && seniorCitizen) {
      total *= 1 - (policies.seniorDiscountPercent / 100);
    }
    const childApplies =
      policies?.childDiscountEnabled &&
      passengerRows.some((p) => p.age && Number(p.age) <= (policies.childMaxAge ?? 11));
    if (childApplies) {
      total *= 1 - (policies!.childDiscountPercent / 100);
    }
    total -= couponDiscount;
    total -= Math.min(redeemPoints, total);
    return Math.max(0, Math.round(total));
  }, [
    seatSubtotal,
    seatLabels.length,
    seniorCitizen,
    couponDiscount,
    redeemPoints,
    policies,
    passengerRows,
  ]);

  async function applyCoupon() {
    if (!couponCode.trim()) return;
    try {
      const preview = await previewCoupon(couponCode, seatSubtotal);
      setCouponCode(preview.code);
      setCouponDiscount(preview.discountAmount);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Invalid coupon');
    }
  }

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!valid || expired || !tripId) return;

    const token = getAccessToken();
    const stored = readBookingLock();
    if (!token || !stored) {
      setError('Seat lock expired — select seats again');
      return;
    }

    if (passengerRows.some((row) => !row.fullName.trim())) {
      setError('Enter a name for each passenger.');
      return;
    }

    const phoneDigits = contactPhone.replace(/\D/g, '');
    if (!/^[0-9]{10,15}$/.test(phoneDigits)) {
      setError('Enter a valid 10-digit mobile number for Cashfree payment.');
      return;
    }

    const base = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1';
    const res = await fetch(`${base}/bookings`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        tripId,
        lockToken: stored.lockToken,
        boardingSequence: segment.boardingSequence,
        droppingSequence: segment.droppingSequence,
        contactName,
        contactPhone: phoneDigits,
        contactEmail: contactEmail || undefined,
        passengers: passengerRows.map((row) => ({
          fullName: row.fullName.trim(),
          phone: row.phone || contactPhone || undefined,
          age: row.age ? Number(row.age) : undefined,
          gender: row.gender || undefined,
        })),
        ...(isAgent ? { agentCash } : {}),
        ...(policies?.seniorDiscountEnabled && seniorCitizen ? { seniorCitizen: true } : {}),
        ...(couponCode ? { couponCode } : {}),
        ...(redeemPoints > 0 ? { redeemLoyaltyPoints: redeemPoints } : {}),
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(typeof data.message === 'string' ? data.message : 'Booking failed');
      return;
    }

    const checkoutSummary = lockToCheckoutSummary(stored as BookingLockSession, {
      bookingId: data.bookingId,
      bookingReference: data.bookingReference,
      totalAmount: data.totalAmount ?? estimatedTotal,
    });
    writeCheckoutSummary(checkoutSummary);
    clearBookingLock();

    if (data.paymentRequired && data.bookingId) {
      router.push(`/book/payment?bookingId=${data.bookingId}${isAgent ? '&agent=1' : ''}`);
      return;
    }
    router.push(`/book/confirmation?ref=${data.bookingReference}&paid=1${isAgent ? '&agent=1' : ''}`);
  }

  const seatsHref = tripId
    ? buildSeatsUrl(tripId, {
        fromCity: lock?.fromCity,
        toCity: lock?.toCity,
        date: lock?.date,
        fare: lock?.fare != null ? String(lock.fare) : undefined,
        agent: agentMode || isAgent,
      })
    : agentMode
      ? '/search?agent=1'
      : '/search';

  const showAgentChrome = agentMode || isAgent;
  const lockInvalid = valid === false || expired;

  return (
    <CustomerShell>
      {showAgentChrome && <SiteHeader />}
      <BookingSummaryStrip summary={lock} />
      <div className="mx-auto max-w-lg px-4 py-8">
        <h1 className="text-2xl font-bold text-charcoal">
          {isAgent ? 'Customer details (agent booking)' : 'Passenger details'}
        </h1>

        {isAgent && (
          <p className="mt-2 text-sm text-gray-600">
            Enter the walk-in customer&apos;s details below — not your agent account info.
          </p>
        )}

        {lock && !lockInvalid && (
          <SeatLockCountdown
            countdownLabel={countdownLabel}
            secondsLeft={secondsLeft}
            expired={expired}
            backHref={seatsHref}
            className="mt-4"
          />
        )}

        {lockInvalid && (
          <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
            <p>{error ?? 'Seat lock expired — please select your seats again.'}</p>
            <Link href={seatsHref} className="mt-3 inline-block font-medium text-brand hover:underline">
              ← Back to seat selection
            </Link>
          </div>
        )}

        {lock && !lockInvalid && routeId && (
          <div className="mt-4">
            <StopPicker
              routeId={routeId}
              initialBoardingSequence={segment.boardingSequence}
              initialDroppingSequence={segment.droppingSequence}
              onChange={(value) => setSegment(value)}
            />
          </div>
        )}

        {lock && !lockInvalid && (
          <form className="mt-6 space-y-6" onSubmit={onSubmit}>
            <div className="space-y-4 rounded-lg border border-gray-100 p-4">
              <p className="text-sm font-medium text-charcoal">Primary contact</p>
              <label className="block text-sm">
                Full name
                <input
                  required
                  value={contactName}
                  onChange={(e) => setContactName(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2"
                />
              </label>
              <label className="block text-sm">
                Phone (10 digits — required for payment)
                <input
                  required
                  inputMode="numeric"
                  pattern="[0-9]{10,15}"
                  value={contactPhone}
                  onChange={(e) => setContactPhone(e.target.value.replace(/\D/g, '').slice(0, 15))}
                  className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2"
                />
              </label>
              <label className="block text-sm">
                Email (optional — for ticket)
                <input
                  type="email"
                  value={contactEmail}
                  onChange={(e) => setContactEmail(e.target.value)}
                  placeholder={isAgent ? 'customer@example.com' : undefined}
                  className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2"
                />
              </label>
            </div>

            <PassengerFormList
              seatLabels={seatLabels}
              rows={passengerRows}
              onChange={setPassengerRows}
              contactName={contactName}
              onContactNameChange={setContactName}
            />

            {!isAgent && savedPassengers.length > 0 && (
              <div className="rounded-lg border border-gray-100 p-4 text-sm">
                <p className="font-medium text-charcoal">Saved travellers</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {savedPassengers.map((sp) => (
                    <button
                      key={sp.id}
                      type="button"
                      className="rounded-full border border-brand/30 px-3 py-1 text-xs text-brand hover:bg-brand-light/20"
                      onClick={() => {
                        setContactName(sp.fullName);
                        setContactPhone(sp.phone ?? contactPhone);
                        setPassengerRows((rows) =>
                          rows.map((row, i) =>
                            i === 0
                              ? {
                                  ...row,
                                  fullName: sp.fullName,
                                  age: sp.age?.toString() ?? '',
                                  gender: sp.gender ?? '',
                                  phone: sp.phone ?? '',
                                }
                              : row,
                          ),
                        );
                      }}
                    >
                      {sp.fullName}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {!isAgent && (
              <div className="space-y-2 rounded-lg border border-gray-100 p-4 text-sm">
                <label className="block">
                  Coupon code
                  <div className="mt-1 flex gap-2">
                    <input
                      value={couponCode}
                      onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                      className="flex-1 rounded-lg border border-gray-200 px-3 py-2"
                      placeholder="WELCOME10"
                    />
                    <button type="button" className="rounded-lg border px-3 py-2" onClick={applyCoupon}>
                      Apply
                    </button>
                  </div>
                </label>
                {couponDiscount > 0 && (
                  <p className="text-green-700">Coupon discount: ₹{couponDiscount}</p>
                )}
                {loyaltyBalance > 0 && (
                  <label className="block">
                    Redeem loyalty points (max {loyaltyBalance})
                    <input
                      type="number"
                      min={0}
                      max={loyaltyBalance}
                      value={redeemPoints || ''}
                      onChange={(e) =>
                        setRedeemPoints(Math.min(loyaltyBalance, Number(e.target.value) || 0))
                      }
                      className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2"
                    />
                  </label>
                )}
              </div>
            )}

            {policies?.seniorDiscountEnabled && (
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={seniorCitizen}
                  onChange={(e) => setSeniorCitizen(e.target.checked)}
                />
                Senior citizen ({policies.seniorDiscountPercent}% off entire booking — ID required at boarding)
              </label>
            )}
            {policies?.childDiscountEnabled && (
              <p className="text-xs text-gray-500">
                Child discount ({policies.childDiscountPercent}%) applies if any passenger age is{' '}
                {policies.childMaxAge} or under.
              </p>
            )}

            {isAgent && (
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={agentCash}
                  onChange={(e) => onAgentCashChange(e.target.checked)}
                />
                Cash booking (confirm immediately — no Cashfree)
              </label>
            )}

            <div className="rounded-lg border border-brand/20 bg-brand-light/20 px-4 py-3 text-sm">
              Estimated total: <strong className="text-brand">{formatInr(estimatedTotal)}</strong>
              {seniorCitizen && ' (before senior discount)'}
            </div>

            {error && !lockInvalid && <p className="text-sm text-red-600">{error}</p>}

            <button type="submit" className="btn-primary w-full" disabled={valid !== true || expired}>
              {valid === null
                ? 'Checking seats…'
                : isAgent && agentCash
                  ? 'Confirm cash booking'
                  : isAgent
                    ? 'Continue to online payment'
                    : 'Continue to payment'}
            </button>
          </form>
        )}

        {lock && !lockInvalid && (
          <p className="mt-3 text-xs text-gray-500">
            {isAgent && agentCash
              ? 'Cash booking confirms immediately — print or WhatsApp ticket on the next screen.'
              : isAgent
                ? 'Customer pays via Cashfree on the next step.'
                : 'You will pay securely via Cashfree on the next step.'}
          </p>
        )}

        {isAgent && (
          <Link href="/agent" className="mt-6 block text-center text-sm text-brand hover:underline">
            ← Cancel and return to agent portal
          </Link>
        )}
      </div>
    </CustomerShell>
  );
}

export default function PassengerPage() {
  return (
    <Suspense fallback={<div className="mx-auto max-w-md px-4 py-10 text-sm text-gray-500">Loading…</div>}>
      <PassengerContent />
    </Suspense>
  );
}
