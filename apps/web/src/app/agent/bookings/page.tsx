'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { SiteHeader } from '@/components/site-header';
import { getAccessToken } from '@/lib/api-client';
import { fetchAgentBookings, type AgentBookingRow } from '@/lib/agent-api';
import { AgentTicketActions } from '@/components/agent-ticket-actions';

export default function AgentBookingsPage() {
  const router = useRouter();
  const [bookings, setBookings] = useState<AgentBookingRow[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const token = getAccessToken();
    if (!token) {
      router.replace('/login?next=/agent/bookings');
      return;
    }
    fetchAgentBookings(token)
      .then(setBookings)
      .catch((err) => setError(err instanceof Error ? err.message : 'Could not load bookings'));
  }, [router]);

  return (
    <div className="min-h-screen bg-white">
      <SiteHeader />
      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
        <Link href="/agent" className="text-sm text-brand hover:underline">
          ← Agent dashboard
        </Link>
        <div className="mt-2 flex gap-4 text-sm">
          <Link href="/agent/commissions" className="text-brand hover:underline">
            Commissions
          </Link>
        </div>
        <h1 className="mt-4 text-2xl font-bold text-charcoal">All agent bookings</h1>
        {error && <p className="mt-4 text-sm text-red-600">{error}</p>}
        <div className="mt-6 card overflow-x-auto">
          <table className="w-full min-w-[800px] text-left text-sm">
            <thead className="text-xs uppercase text-gray-500">
              <tr>
                <th className="pb-2 pr-3">Reference</th>
                <th className="pb-2 pr-3">Customer</th>
                <th className="pb-2 pr-3">Phone</th>
                <th className="pb-2 pr-3">Route</th>
                <th className="pb-2 pr-3">Seats</th>
                <th className="pb-2 pr-3">Amount</th>
                <th className="pb-2 pr-3">Commission</th>
                <th className="pb-2 pr-3">Status</th>
                <th className="pb-2">Ticket</th>
              </tr>
            </thead>
            <tbody>
              {bookings.map((row) => (
                <tr key={row.bookingReference} className="border-t border-gray-100">
                  <td className="py-2 pr-3 font-medium">{row.bookingReference}</td>
                  <td className="py-2 pr-3">{row.contactName ?? '—'}</td>
                  <td className="py-2 pr-3">{row.contactPhone ?? '—'}</td>
                  <td className="py-2 pr-3">{row.routeCode}</td>
                  <td className="py-2 pr-3">{row.seats.join(', ')}</td>
                  <td className="py-2 pr-3">₹{row.totalAmount}</td>
                  <td className="py-2 pr-3">
                    {row.commissionAmount != null ? `₹${row.commissionAmount}` : '—'}
                  </td>
                  <td className="py-2 pr-3">{row.status.replace('_', ' ')}</td>
                  <td className="py-2">
                    {row.status === 'PENDING_PAYMENT' ? (
                      <Link
                        href={`/book/payment?bookingId=${encodeURIComponent(row.bookingId)}&agent=1`}
                        className="text-xs font-medium text-brand hover:underline"
                      >
                        Complete payment
                      </Link>
                    ) : (
                      <AgentTicketActions
                        reference={row.bookingReference}
                        status={row.status}
                        contactName={row.contactName}
                        contactPhone={row.contactPhone}
                        routeLabel={row.routeName}
                        totalAmount={row.totalAmount}
                        departureAt={row.departureAt}
                        seats={row.seats}
                        layout="compact"
                      />
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
