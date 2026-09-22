'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useParams, useSearchParams } from 'next/navigation';
import { useEffect, useState, Suspense } from 'react';
import { getAccessToken } from '@/lib/api-client';
import { AgentTicketActions } from '@/components/agent-ticket-actions';

type BookingDetail = {
  bookingReference: string;
  status: string;
  contactName: string | null;
  contactPhone: string | null;
  totalAmount: number | string;
  paymentMethod: string | null;
  trip: {
    departureAt: string;
    route: { name: string; code: string };
    bus: { name: string | null; registrationNumber: string };
  };
  seats: { seatLabel: string }[];
  passengers: { fullName: string; phone: string | null }[];
  ticket: { ticketNumber: string } | null;
};

function AgentTicketPrintContent() {
  const { reference } = useParams<{ reference: string }>();
  const searchParams = useSearchParams();
  const autoPrint = searchParams.get('print') === '1';
  const [booking, setBooking] = useState<BookingDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const token = getAccessToken();
    if (!token) {
      setError('Please sign in as an agent');
      return;
    }
    const base = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1';
    fetch(`${base}/bookings/${encodeURIComponent(reference)}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(typeof data.message === 'string' ? data.message : 'Booking not found');
        setBooking(data);
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Could not load ticket'));
  }, [reference]);

  useEffect(() => {
    if (!autoPrint || !booking || booking.status !== 'CONFIRMED') return;
    const timer = setTimeout(() => window.print(), 400);
    return () => clearTimeout(timer);
  }, [autoPrint, booking]);

  if (error) {
    return (
      <div className="mx-auto max-w-md p-8 text-center text-sm text-red-600">
        {error}
        <Link href="/agent" className="mt-4 block text-brand hover:underline">
          ← Agent portal
        </Link>
      </div>
    );
  }

  if (!booking) {
    return <p className="p-8 text-center text-sm text-gray-500">Loading ticket…</p>;
  }

  const departure = new Date(booking.trip.departureAt);
  const seats = booking.seats.map((s) => s.seatLabel).join(', ');
  const passenger = booking.passengers[0]?.fullName ?? booking.contactName ?? 'Passenger';

  return (
    <>
      <div className="no-print mx-auto flex max-w-lg flex-wrap items-center justify-between gap-3 border-b border-gray-200 bg-gray-50 px-4 py-3">
        <Link href="/agent" className="text-sm text-brand hover:underline">
          ← Agent portal
        </Link>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="rounded-lg bg-brand px-3 py-1.5 text-sm font-medium text-white"
            onClick={() => window.print()}
          >
            Print
          </button>
          <AgentTicketActions
            reference={booking.bookingReference}
            status={booking.status}
            contactName={booking.contactName}
            contactPhone={booking.contactPhone}
            routeLabel={booking.trip.route.name}
            totalAmount={Number(booking.totalAmount)}
            departureAt={booking.trip.departureAt}
            seats={booking.seats.map((s) => s.seatLabel)}
            layout="compact"
          />
        </div>
      </div>

      <article className="ticket-receipt mx-auto max-w-lg bg-white p-6 text-charcoal print:max-w-none print:p-4">
        <header className="flex items-start justify-between gap-4 border-b-2 border-brand pb-4">
          <div>
            <Image
              src="/shiva-sakti-logo.png"
              alt="Shiv Shakti"
              width={120}
              height={36}
              className="h-9 w-auto object-contain print:h-8"
            />
            <p className="mt-2 text-xs uppercase tracking-wide text-gray-500">Agent counter receipt</p>
          </div>
          <div className="text-right text-sm">
            <p className="font-bold text-brand">{booking.bookingReference}</p>
            {booking.ticket && <p className="text-xs text-gray-600">Ticket #{booking.ticket.ticketNumber}</p>}
          </div>
        </header>

        <section className="mt-4 space-y-2 text-sm">
          <Row label="Passenger" value={passenger} />
          <Row label="Phone" value={booking.contactPhone ?? '—'} />
          <Row label="Route" value={booking.trip.route.name} />
          <Row
            label="Bus"
            value={`${booking.trip.bus.registrationNumber}${booking.trip.bus.name ? ` · ${booking.trip.bus.name}` : ''}`}
          />
          <Row
            label="Departure"
            value={departure.toLocaleString('en-IN', {
              weekday: 'short',
              day: 'numeric',
              month: 'short',
              year: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            })}
          />
          <Row label="Seats" value={seats || '—'} />
          <Row label="Amount" value={`₹${Number(booking.totalAmount).toFixed(2)}`} strong />
          <Row label="Payment" value={booking.paymentMethod ?? '—'} />
          <Row label="Status" value={booking.status.replace('_', ' ')} />
        </section>

        <footer className="mt-6 border-t border-dashed border-gray-300 pt-4 text-center text-xs text-gray-500">
          <p>Show this receipt or PDF at boarding · Shiv Shakti</p>
          <p className="mt-1">Printed {new Date().toLocaleString('en-IN')}</p>
        </footer>
      </article>

      <style jsx global>{`
        @media print {
          .no-print {
            display: none !important;
          }
          body {
            background: white;
          }
          .ticket-receipt {
            box-shadow: none;
          }
        }
      `}</style>
    </>
  );
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex justify-between gap-4 border-b border-gray-100 py-1.5">
      <span className="text-gray-500">{label}</span>
      <span className={strong ? 'font-bold text-brand' : 'text-right font-medium'}>{value}</span>
    </div>
  );
}

export default function AgentTicketPrintPage() {
  return (
    <Suspense fallback={<p className="p-8 text-center text-sm text-gray-500">Loading…</p>}>
      <AgentTicketPrintContent />
    </Suspense>
  );
}
