'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { SiteHeader } from '@/components/site-header';
import { CustomerShell, PayNowLink } from '@/components/customer-shell';
import { getAccessToken } from '@/lib/api-client';
import { fetchMyBookings, type MyBooking } from '@/lib/bookings-api';
import { CustomerTicketActions } from '@/components/customer-ticket-actions';
import { fetchLoyaltyBalance, submitRating } from '@/lib/features-api';

function statusBadge(status: string) {
  if (status === 'CONFIRMED') return 'bg-green-50 text-green-800 border-green-200';
  if (status === 'CANCELLED') return 'bg-gray-100 text-gray-600 border-gray-200';
  if (status === 'PENDING_PAYMENT') return 'bg-amber-50 text-amber-900 border-amber-200';
  return 'bg-gray-50 text-gray-700 border-gray-200';
}

function segmentLabel(booking: MyBooking) {
  const from = booking.boardingStop?.stop.city ?? booking.boardingStop?.stop.name;
  const to = booking.droppingStop?.stop.city ?? booking.droppingStop?.stop.name;
  if (from && to) return `${from} → ${to}`;
  return null;
}

export default function MyBookingsPage() {
  const router = useRouter();
  const [bookings, setBookings] = useState<MyBooking[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loyaltyPoints, setLoyaltyPoints] = useState(0);

  useEffect(() => {
    const token = getAccessToken();
    if (!token) {
      router.replace('/login?next=/bookings');
      return;
    }

    fetchMyBookings(token)
      .then(setBookings)
      .catch((err) => setError(err instanceof Error ? err.message : 'Could not load bookings'))
      .finally(() => setLoading(false));

    fetchLoyaltyBalance(token)
      .then((b) => setLoyaltyPoints(b.pointsBalance))
      .catch(() => undefined);
  }, [router]);

  async function rateBooking(reference: string) {
    const token = getAccessToken();
    if (!token) return;
    const rating = window.prompt('Rate your trip (1–5 stars):', '5');
    if (!rating) return;
    const stars = parseInt(rating, 10);
    if (!Number.isFinite(stars) || stars < 1 || stars > 5) return;
    try {
      await submitRating(token, reference, stars);
      alert('Thank you for your feedback!');
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Could not submit rating');
    }
  }

  async function downloadInvoice(reference: string) {
    const token = getAccessToken();
    if (!token) return;
    const base = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1';
    const res = await fetch(`${base}/invoices/by-reference/${encodeURIComponent(reference)}/pdf`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
      alert('Invoice not available yet');
      return;
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `invoice-${reference}.pdf`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <CustomerShell>
      <SiteHeader />
      <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
        <h1 className="text-2xl font-bold text-charcoal">My bookings</h1>
        <p className="mt-1 text-sm text-gray-600">View and manage your Shiv Shakti tickets</p>

        {!loading && !error && bookings.length > 0 && (
          <div className="mt-6 rounded-xl border border-brand/20 bg-brand-light/20 px-4 py-3 text-sm text-charcoal">
            Loyalty points: <strong className="text-brand">{loyaltyPoints}</strong> · Earn 1 point per ₹100 on
            confirmed trips
          </div>
        )}

        {loading && <p className="mt-8 text-sm text-gray-500">Loading…</p>}
        {error && <p className="mt-6 text-sm text-red-600">{error}</p>}

        {!loading && !error && bookings.length === 0 && (
          <div className="mt-8 card text-center text-sm text-gray-600">
            <p>No bookings yet.</p>
            <Link href="/search" className="mt-4 inline-block text-brand hover:underline">
              Search buses
            </Link>
          </div>
        )}

        <ul className="mt-6 space-y-4">
          {bookings.map((booking) => {
            const departure = new Date(booking.trip.departureAt);
            const canCancel =
              ['CONFIRMED', 'PENDING_PAYMENT'].includes(booking.status) &&
              departure.getTime() > Date.now();
            const canReschedule =
              booking.status === 'CONFIRMED' &&
              !booking.rescheduleUsed &&
              departure.getTime() > Date.now();
            const seats = booking.seats.map((s) => s.seatLabel).join(', ');
            const segment = segmentLabel(booking);

            return (
              <li key={booking.id} className="card">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-charcoal">{booking.trip.route.name}</p>
                    {segment && <p className="text-sm text-gray-600">{segment}</p>}
                    <p className="text-sm text-gray-600">
                      {departure.toLocaleDateString('en-IN')} ·{' '}
                      {departure.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                    </p>
                    <p className="mt-1 text-sm text-gray-600">
                      Ref <strong>{booking.bookingReference}</strong> · Seats {seats || '—'}
                    </p>
                    <p className="mt-1 text-sm">₹{Number(booking.totalAmount).toFixed(2)}</p>
                  </div>
                  <span
                    className={`rounded-full border px-2.5 py-0.5 text-xs font-medium ${statusBadge(booking.status)}`}
                  >
                    {booking.status.replace('_', ' ')}
                  </span>
                </div>

                <div className="mt-4 flex flex-wrap gap-3 text-sm">
                  {booking.status === 'CONFIRMED' && (
                    <>
                      <Link
                        href={`/book/confirmation?ref=${encodeURIComponent(booking.bookingReference)}&paid=1`}
                        className="text-brand hover:underline"
                      >
                        Ticket & PDF
                      </Link>
                      <button
                        type="button"
                        className="text-brand hover:underline"
                        onClick={() => downloadInvoice(booking.bookingReference)}
                      >
                        GST invoice
                      </button>
                      <button
                        type="button"
                        className="text-brand hover:underline"
                        onClick={() => rateBooking(booking.bookingReference)}
                      >
                        Rate trip
                      </button>
                      <details className="w-full sm:w-auto">
                        <summary className="cursor-pointer text-brand hover:underline">
                          Share / send to phone
                        </summary>
                        <div className="mt-3 rounded-lg border border-gray-100 bg-gray-50 p-3">
                          <CustomerTicketActions
                            reference={booking.bookingReference}
                            contactName={booking.contactName}
                            contactPhone={booking.contactPhone}
                            routeLabel={booking.trip.route.name}
                            totalAmount={Number(booking.totalAmount)}
                            departureAt={booking.trip.departureAt}
                            seats={booking.seats.map((s) => s.seatLabel)}
                            layout="inline"
                            showDownload={false}
                          />
                        </div>
                      </details>
                    </>
                  )}
                  {canReschedule && (
                    <Link
                      href={`/bookings/${encodeURIComponent(booking.bookingReference)}/reschedule`}
                      className="text-brand hover:underline"
                    >
                      Reschedule once
                    </Link>
                  )}
                  {canCancel && (
                    <Link
                      href={`/bookings/${encodeURIComponent(booking.bookingReference)}/cancel`}
                      className="text-red-600 hover:underline"
                    >
                      Cancel booking
                    </Link>
                  )}
                  {booking.status === 'PENDING_PAYMENT' && (
                    <PayNowLink bookingId={booking.id} className="btn-primary text-sm" />
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </CustomerShell>
  );
}
