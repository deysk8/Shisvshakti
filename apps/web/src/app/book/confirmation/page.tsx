'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
import { SiteHeader } from '@/components/site-header';
import { AgentTicketActions } from '@/components/agent-ticket-actions';
import { CustomerTicketActions } from '@/components/customer-ticket-actions';
import { getAccessToken } from '@/lib/api-client';
import { sendMobileTicket } from '@/lib/bookings-api';

type BookingSummary = {
  id?: string;
  bookingReference: string;
  status: string;
  contactName: string | null;
  contactPhone: string | null;
  totalAmount: number | string;
  trip: { departureAt: string; route: { name: string } };
  seats: { seatLabel: string }[];
};

function ConfirmationContent() {
  const params = useSearchParams();
  const ref = params.get('ref');
  const bookingIdParam = params.get('bookingId');
  const paid = params.get('paid') === '1';
  const agentMode = params.get('agent') === '1';
  const base = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1';
  const token = typeof window !== 'undefined' ? getAccessToken() : null;
  const [booking, setBooking] = useState<BookingSummary | null>(null);
  const [emailStatus, setEmailStatus] = useState<string | null>(null);
  const [resending, setResending] = useState(false);
  const [sendingPhone, setSendingPhone] = useState(false);

  useEffect(() => {
    if (!ref || !token) return;
    fetch(`${base}/bookings/${encodeURIComponent(ref)}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(async (res) => (res.ok ? res.json() : null))
      .then((data: BookingSummary | null) => setBooking(data))
      .catch(() => undefined);
  }, [base, ref, token]);

  async function resendEmail() {
    if (!ref || !token) return;
    setResending(true);
    setEmailStatus(null);
    try {
      const res = await fetch(`${base}/bookings/${encodeURIComponent(ref)}/resend-email`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setEmailStatus(typeof data.message === 'string' ? data.message : 'Could not send email');
        return;
      }
      setEmailStatus(
        agentMode
          ? 'Confirmation email queued for the customer.'
          : 'Confirmation saved. In dev, check apps/api/storage/emails/ (real email needs Resend API key).',
      );
    } catch {
      setEmailStatus('Cannot reach the API. Is dev:api running?');
    } finally {
      setResending(false);
    }
  }

  async function sendToCustomerPhone() {
    if (!ref || !token) return;
    setSendingPhone(true);
    setEmailStatus(null);
    try {
      const result = await sendMobileTicket(token, ref);
      setEmailStatus(
        result.message ??
          (result.skipped
            ? 'Could not send to phone.'
            : 'SMS/WhatsApp queued (dev: apps/api/storage/sms/ and storage/whatsapp/).'),
      );
    } catch (err) {
      setEmailStatus(err instanceof Error ? err.message : 'Could not send ticket to phone');
    } finally {
      setSendingPhone(false);
    }
  }

  const ticketDetails = booking ?? (ref ? { bookingReference: ref, status: paid ? 'CONFIRMED' : 'PENDING_PAYMENT' } : null);

  return (
    <div className="min-h-screen bg-white">
      {agentMode && <SiteHeader />}
      <div className={`mx-auto max-w-md px-4 text-center ${agentMode ? 'py-10' : 'py-16'}`}>
        <h1 className="text-2xl font-bold text-charcoal">
          {paid ? (agentMode ? 'Agent booking confirmed' : 'Booking confirmed') : 'Booking created'}
        </h1>
        {ref && (
          <p className="mt-2 text-gray-600">
            Reference: <strong>{ref}</strong>
          </p>
        )}

        {paid && agentMode && (
          <p className="mt-3 text-sm text-gray-600">
            Give the customer their ticket — download PDF, print receipt, or share on WhatsApp.
          </p>
        )}

        {paid && !agentMode && (
          <div className="mt-4 space-y-2 text-sm text-gray-600">
            <p>Your e-ticket is ready to download below.</p>
            {booking?.contactPhone && (
              <p className="rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-left text-green-900">
                Confirmation and ticket link were sent automatically to{' '}
                <strong>{booking.contactPhone}</strong> on SMS and WhatsApp.
              </p>
            )}
            <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-left text-amber-900">
              <strong>Email (dev):</strong> Real emails need a Resend API key in{' '}
              <code className="text-xs">apps/api/.env</code>. Until then, a copy is saved under{' '}
              <code className="text-xs">apps/api/storage/emails/</code> and logged in the API terminal.
            </p>
            {!booking?.contactPhone && (
              <p className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-left">
                Add a phone number on your next booking to receive automatic WhatsApp and SMS ticket
                confirmation.
              </p>
            )}
          </div>
        )}

        {paid && agentMode && booking?.contactPhone && (
          <p className="mt-3 rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-900">
            Ticket confirmation sent automatically to customer phone{' '}
            <strong>{booking.contactPhone}</strong> (SMS + WhatsApp).
          </p>
        )}

        {!paid && (
          <div className="mt-4 space-y-3">
            <p className="text-sm text-gray-500">Complete payment to confirm this booking.</p>
            {(bookingIdParam || booking?.id) && (
              <Link
                href={`/book/payment?bookingId=${encodeURIComponent(bookingIdParam ?? booking?.id ?? '')}`}
                className="btn-primary inline-block"
              >
                Pay now
              </Link>
            )}
          </div>
        )}

        {paid && token && ticketDetails && agentMode && (
          <div className="mt-8 text-left">
            <AgentTicketActions
              reference={ticketDetails.bookingReference}
              status={ticketDetails.status}
              contactName={'contactName' in ticketDetails ? ticketDetails.contactName : null}
              contactPhone={'contactPhone' in ticketDetails ? ticketDetails.contactPhone : null}
              routeLabel={booking?.trip.route.name}
              totalAmount={booking ? Number(booking.totalAmount) : undefined}
              departureAt={booking?.trip.departureAt}
              seats={booking?.seats.map((s) => s.seatLabel)}
              layout="stacked"
            />
            <button
              type="button"
              className="mt-4 w-full rounded-lg border border-gray-200 px-4 py-2 text-sm text-gray-700 hover:border-brand hover:text-brand"
              onClick={resendEmail}
              disabled={resending}
            >
              {resending ? 'Sending…' : 'Email ticket to customer'}
            </button>
            {booking?.contactPhone && (
              <button
                type="button"
                className="mt-2 w-full rounded-lg border border-gray-200 px-4 py-2 text-sm text-gray-700 hover:border-brand hover:text-brand"
                onClick={sendToCustomerPhone}
                disabled={sendingPhone}
              >
                {sendingPhone ? 'Sending…' : 'Send ticket to customer phone'}
              </button>
            )}
          </div>
        )}

        {paid && token && !agentMode && ref && booking && (
          <div className="mt-8 text-left">
            <CustomerTicketActions
              reference={booking.bookingReference}
              contactName={booking.contactName}
              contactPhone={booking.contactPhone}
              routeLabel={booking.trip.route.name}
              totalAmount={Number(booking.totalAmount)}
              departureAt={booking.trip.departureAt}
              seats={booking.seats.map((s) => s.seatLabel)}
            />
            <button
              type="button"
              className="mt-4 w-full rounded-lg border border-gray-200 px-4 py-2 text-sm text-gray-700 hover:border-brand hover:text-brand"
              onClick={resendEmail}
              disabled={resending}
            >
              {resending ? 'Sending…' : 'Resend confirmation email'}
            </button>
          </div>
        )}

        {paid && token && !agentMode && ref && !booking && (
          <p className="mt-8 text-sm text-gray-500">Loading ticket actions…</p>
        )}

        {paid && !token && (
          <p className="mt-6 text-sm text-red-600">Sign in to download your PDF ticket.</p>
        )}

        {emailStatus && (
          <p className="mt-4 rounded-lg border border-brand/20 bg-brand-light/30 px-3 py-2 text-sm text-charcoal">
            {emailStatus}
          </p>
        )}

        {paid && ref && !agentMode && (
          <Link
            href={`/bookings/${encodeURIComponent(ref)}/cancel`}
            className="mt-4 block text-sm text-gray-600 hover:text-red-600"
          >
            Need to cancel? Manage booking
          </Link>
        )}

        <Link
          href={agentMode ? '/agent' : '/bookings'}
          className="mt-6 block text-sm text-brand hover:underline"
        >
          {agentMode ? '← Back to agent portal' : 'View all my bookings'}
        </Link>
        {!agentMode && (
          <Link href="/" className="mt-4 block text-sm text-brand hover:underline">
            Back home
          </Link>
        )}
      </div>
    </div>
  );
}

export default function ConfirmationPage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-md px-4 py-16 text-center text-sm text-gray-500">
          Loading…
        </div>
      }
    >
      <ConfirmationContent />
    </Suspense>
  );
}
