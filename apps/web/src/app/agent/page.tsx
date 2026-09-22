'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { SiteHeader } from '@/components/site-header';
import { getAccessToken } from '@/lib/api-client';
import { fetchAgentBookings, fetchAgentDashboard, type AgentDashboard } from '@/lib/agent-api';
import { setAgentCashMode } from '@/lib/agent-api';
import { AgentTicketActions } from '@/components/agent-ticket-actions';
import { AgentBookingLookup } from '@/components/agent-booking-lookup';
import { agentSearchUrl, setAgentFlowActive } from '@/lib/agent-booking';

export default function AgentDashboardPage() {
  const router = useRouter();
  const [dashboard, setDashboard] = useState<AgentDashboard | null>(null);
  const [bookingsCount, setBookingsCount] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [cashMode, setCashMode] = useState(true);

  useEffect(() => {
    const token = getAccessToken();
    if (!token) {
      router.replace('/login?next=/agent');
      return;
    }

    Promise.all([fetchAgentDashboard(token), fetchAgentBookings(token)])
      .then(([dash, bookings]) => {
        setDashboard(dash);
        setBookingsCount(bookings.length);
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Could not load agent portal'));
  }, [router]);

  function startBooking(cash: boolean) {
    setAgentCashMode(cash);
    setAgentFlowActive(true);
    setCashMode(cash);
    router.push(agentSearchUrl(cash));
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <SiteHeader />
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-charcoal">Agent portal</h1>
            <p className="mt-1 text-sm text-gray-600">
              {dashboard?.agent.fullName ?? 'Loading…'} · Code {dashboard?.agent.employeeCode ?? '—'}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" className="btn-primary" onClick={() => startBooking(true)}>
              New cash booking
            </button>
            <button
              type="button"
              className="rounded-lg border border-brand px-4 py-2 text-sm font-medium text-brand hover:bg-brand-light/30"
              onClick={() => startBooking(false)}
            >
              New online booking
            </button>
            <Link
              href="/agent/scan"
              className="rounded-lg border border-green-600 bg-green-50 px-4 py-2 text-sm font-medium text-green-800 hover:bg-green-100"
            >
              Scan ticket QR
            </Link>
            <Link
              href="/agent/bookings"
              className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-charcoal hover:border-brand hover:text-brand"
            >
              All bookings
            </Link>
          </div>
        </div>

        {error && <p className="mt-4 text-sm text-red-600">{error}</p>}

        {dashboard && (
          <>
            <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div className="card">
                <p className="text-xs uppercase text-gray-500">Today</p>
                <p className="mt-2 text-2xl font-bold">{dashboard.summary.todayBookings}</p>
                <p className="text-xs text-gray-500">bookings</p>
              </div>
              <div className="card border-l-4 border-l-emerald-500">
                <p className="text-xs uppercase text-gray-500">Today — cash</p>
                <p className="mt-2 text-2xl font-bold">
                  ₹{dashboard.summary.todaySales.cashRevenue.toFixed(0)}
                </p>
                <p className="text-xs text-gray-500">
                  {dashboard.summary.todaySales.cashBookings} booking
                  {dashboard.summary.todaySales.cashBookings === 1 ? '' : 's'}
                </p>
              </div>
              <div className="card border-l-4 border-l-blue-500">
                <p className="text-xs uppercase text-gray-500">Today — online</p>
                <p className="mt-2 text-2xl font-bold">
                  ₹{dashboard.summary.todaySales.onlineRevenue.toFixed(0)}
                </p>
                <p className="text-xs text-gray-500">
                  {dashboard.summary.todaySales.onlineBookings} booking
                  {dashboard.summary.todaySales.onlineBookings === 1 ? '' : 's'}
                </p>
              </div>
              <div className="card">
                <p className="text-xs uppercase text-gray-500">Today total</p>
                <p className="mt-2 text-2xl font-bold text-brand">
                  ₹{dashboard.summary.todaySales.totalRevenue.toFixed(0)}
                </p>
                <p className="text-xs text-gray-500">
                  {dashboard.summary.todaySales.boardedToday} boarded ·{' '}
                  {dashboard.summary.todaySales.noShowToday} no-show
                </p>
              </div>
            </div>

            <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div className="card">
                <p className="text-xs uppercase text-gray-500">Confirmed</p>
                <p className="mt-2 text-2xl font-bold">{dashboard.summary.confirmedBookings}</p>
                <p className="text-xs text-gray-500">all time</p>
              </div>
              <div className="card">
                <p className="text-xs uppercase text-gray-500">Pending payment</p>
                <p className="mt-2 text-2xl font-bold">{dashboard.summary.pendingPayment}</p>
              </div>
              <div className="card sm:col-span-2">
                <p className="text-xs uppercase text-gray-500">Commission earned</p>
                <p className="mt-2 text-2xl font-bold text-brand">
                  ₹{dashboard.summary.totalCommission.toFixed(0)}
                </p>
                <p className="text-xs text-gray-500">
                  Rate {dashboard.agent.commissionRatePercent}% (max 4%)
                </p>
              </div>
            </div>

            <div className="mt-8">
              <AgentBookingLookup title="Quick reprint — enter booking reference" showReprint />
            </div>

            <div className="mt-8 card">
              <div className="flex items-center justify-between gap-3">
                <h2 className="font-semibold text-charcoal">Recent agent bookings</h2>
              <div className="flex items-center gap-4">
                <Link href="/agent/bookings" className="text-sm text-brand hover:underline">
                  All bookings ({bookingsCount})
                </Link>
                <Link href="/agent/commissions" className="text-sm text-brand hover:underline">
                  Commissions
                </Link>
                <Link href="/agent/scan" className="text-sm text-brand hover:underline">
                  Scan QR
                </Link>
              </div>
              </div>
              <div className="mt-4 overflow-x-auto">
                <table className="w-full min-w-[720px] text-left text-sm">
                  <thead className="text-xs uppercase text-gray-500">
                    <tr>
                      <th className="pb-2 pr-3">Reference</th>
                      <th className="pb-2 pr-3">Customer</th>
                      <th className="pb-2 pr-3">Phone</th>
                      <th className="pb-2 pr-3">Type</th>
                      <th className="pb-2 pr-3">Amount</th>
                      <th className="pb-2 pr-3">Status</th>
                      <th className="pb-2">Ticket</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dashboard.recentBookings.map((row) => (
                      <tr key={row.bookingReference} className="border-t border-gray-100">
                        <td className="py-2 pr-3 font-medium">{row.bookingReference}</td>
                        <td className="py-2 pr-3">{row.contactName ?? '—'}</td>
                        <td className="py-2 pr-3">{row.contactPhone ?? '—'}</td>
                        <td className="py-2 pr-3">{row.bookingSource.replace('_', ' ')}</td>
                        <td className="py-2 pr-3">₹{row.totalAmount}</td>
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
                              routeLabel={row.routeCode}
                              totalAmount={row.totalAmount}
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

            <p className="mt-4 text-xs text-gray-500">
              Booking mode: {cashMode ? 'Cash (instant confirm)' : 'Online (customer pays via Cashfree)'} — change
              using the buttons above before starting a new booking.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
