'use client';

import { useState } from 'react';
import { getAccessToken } from '@/lib/api-client';
import { downloadAnalyticsExport } from '@/lib/admin-api';
import type {
  AgentPerformanceResponse,
  AnalyticsOverview,
  RecentBookingRow,
  RecentBookingsResponse,
  UpcomingTripsAnalytics,
} from '@/lib/admin-api';

function formatCurrency(value: number) {
  return `₹${value.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
}

function formatPercent(value: number) {
  return `${value.toFixed(1)}%`;
}

function formatPhone(phone: string | null) {
  if (!phone) return '—';
  return phone;
}

function StatCard({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="card">
      <p className="text-xs font-medium uppercase tracking-wide text-gray-500">{label}</p>
      <p className="mt-2 text-2xl font-bold text-charcoal">{value}</p>
      {hint && <p className="mt-1 text-xs text-gray-500">{hint}</p>}
    </div>
  );
}

function BreakdownBar({
  label,
  value,
  amount,
  sharePercent,
  maxShare,
}: {
  label: string;
  value: string;
  amount: string;
  sharePercent: number;
  maxShare: number;
}) {
  const width = maxShare > 0 ? Math.max(4, (sharePercent / maxShare) * 100) : 0;
  return (
    <div>
      <div className="flex items-center justify-between gap-3 text-sm">
        <span className="font-medium text-charcoal">{label}</span>
        <span className="text-gray-600">
          {value} · {amount} ({formatPercent(sharePercent)})
        </span>
      </div>
      <div className="mt-1 h-2 overflow-hidden rounded-full bg-gray-100">
        <div className="h-full rounded-full bg-brand" style={{ width: `${width}%` }} />
      </div>
    </div>
  );
}

function BookingsTable({
  rows,
  showAgent = false,
  showPartnerRef = false,
}: {
  rows: RecentBookingRow[];
  showAgent?: boolean;
  showPartnerRef?: boolean;
}) {
  if (rows.length === 0) {
    return <p className="mt-4 text-sm text-gray-500">No bookings in this section yet.</p>;
  }

  return (
    <div className="mt-4 overflow-x-auto">
      <table className="w-full min-w-[860px] text-left text-sm">
        <thead className="text-xs uppercase text-gray-500">
          <tr>
            <th className="pb-2 pr-4">Reference</th>
            {showPartnerRef && <th className="pb-2 pr-4">Partner ref</th>}
            <th className="pb-2 pr-4">Customer</th>
            <th className="pb-2 pr-4">Phone</th>
            {showAgent && <th className="pb-2 pr-4">Agent</th>}
            <th className="pb-2 pr-4">Route</th>
            <th className="pb-2 pr-4">Source</th>
            <th className="pb-2 pr-4">Status</th>
            <th className="pb-2 pr-4">Amount</th>
            <th className="pb-2">Created</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.bookingReference} className="border-t border-gray-100">
              <td className="py-2 pr-4 font-medium">{row.bookingReference}</td>
              {showPartnerRef && (
                <td className="py-2 pr-4 text-xs text-gray-600">
                  {row.partnerReference ?? '—'}
                  {row.partnerChannel && (
                    <span className="block text-gray-500">{row.partnerChannel}</span>
                  )}
                </td>
              )}
              <td className="py-2 pr-4">{row.contactName ?? '—'}</td>
              <td className="py-2 pr-4">{formatPhone(row.contactPhone)}</td>
              {showAgent && <td className="py-2 pr-4">{row.agentName ?? '—'}</td>}
              <td className="py-2 pr-4">{row.routeCode}</td>
              <td className="py-2 pr-4 text-xs text-gray-600">
                {row.bookingSource.replace(/_/g, ' ').toLowerCase()}
              </td>
              <td className="py-2 pr-4">{row.status.replace(/_/g, ' ')}</td>
              <td className="py-2 pr-4">{formatCurrency(row.totalAmount)}</td>
              <td className="py-2">
                {new Date(row.createdAt).toLocaleString('en-IN', {
                  dateStyle: 'short',
                  timeStyle: 'short',
                })}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

type AdminAnalyticsDashboardProps = {
  analytics: AnalyticsOverview;
  agents: AgentPerformanceResponse;
  upcomingTrips: UpcomingTripsAnalytics;
  recent: RecentBookingsResponse;
  periodDays: number;
  onPeriodChange: (days: number) => void;
  loading?: boolean;
};

const PERIOD_OPTIONS = [7, 14, 30, 90];

export function AdminAnalyticsDashboard({
  analytics,
  agents,
  upcomingTrips,
  recent,
  periodDays,
  onPeriodChange,
  loading = false,
}: AdminAnalyticsDashboardProps) {
  const [exportBusy, setExportBusy] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const { summary } = analytics;
  const maxBookingTotal = Math.max(...analytics.bookingsByDay.map((d) => d.total), 1);
  const maxRevenueNet = Math.max(...analytics.revenueByDay.map((d) => d.net), 1);
  const maxSourceShare = Math.max(
    ...analytics.bookingSourceBreakdown.map((row) => row.sharePercent),
    1,
  );
  const maxMethodShare = Math.max(
    ...analytics.paymentMethodBreakdown.map((row) => row.sharePercent),
    1,
  );

  return (
    <>
      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-gray-600">
          Showing data for{' '}
          <strong>
            {analytics.periodStart} → {analytics.periodEnd}
          </strong>
          {loading && <span className="ml-2 text-brand">Updating…</span>}
        </p>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={exportBusy}
            onClick={async () => {
              setExportBusy(true);
              setExportError(null);
              try {
                await downloadAnalyticsExport(getAccessToken(), periodDays);
              } catch (err) {
                setExportError(err instanceof Error ? err.message : 'Export failed');
              } finally {
                setExportBusy(false);
              }
            }}
            className="rounded-full bg-white px-3 py-1.5 text-sm font-medium text-brand ring-1 ring-brand/30 hover:bg-brand-light/30 disabled:opacity-60"
          >
            {exportBusy ? 'Exporting…' : 'Export CSV'}
          </button>
          {PERIOD_OPTIONS.map((days) => (
            <button
              key={days}
              type="button"
              onClick={() => onPeriodChange(days)}
              className={`rounded-full px-3 py-1.5 text-sm font-medium ${
                periodDays === days
                  ? 'bg-brand text-white'
                  : 'bg-white text-gray-700 ring-1 ring-gray-200 hover:ring-brand/40'
              }`}
            >
              {days} days
            </button>
          ))}
        </div>
      </div>
      {exportError && <p className="mt-2 text-sm text-red-600">{exportError}</p>}

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Net revenue"
          value={formatCurrency(summary.netRevenue)}
          hint={`Gross ${formatCurrency(summary.grossRevenue)}`}
        />
        <StatCard
          label="Confirmed bookings"
          value={String(summary.confirmedBookings)}
          hint={`${summary.todayBookings} created today`}
        />
        <StatCard
          label="Seats sold"
          value={String(summary.seatsSold)}
          hint={`Avg ticket ${formatCurrency(summary.averageBookingValue)}`}
        />
        <StatCard
          label="Cancellation rate"
          value={formatPercent(summary.cancellationRate)}
          hint={`${summary.cancelledBookings} cancelled · refunds ${formatCurrency(summary.refundsTotal)}`}
        />
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Gross revenue" value={formatCurrency(summary.grossRevenue)} />
        <StatCard label="Discounts given" value={formatCurrency(summary.totalDiscountGiven)} />
        <StatCard
          label="Pending payment"
          value={String(summary.pendingPaymentBookings)}
          hint="Awaiting payment completion"
        />
        <StatCard
          label="Upcoming trips"
          value={String(summary.upcomingTrips)}
          hint="Scheduled or boarding"
        />
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <div className="card">
          <h2 className="font-semibold text-charcoal">Bookings trend</h2>
          <p className="mt-1 text-xs text-gray-500">Confirmed vs cancelled per day</p>
          <div className="mt-4 flex h-44 items-end gap-1">
            {analytics.bookingsByDay.map((day) => (
              <div key={day.date} className="flex flex-1 flex-col items-center gap-1">
                <div className="flex h-36 w-full items-end justify-center gap-0.5">
                  <div
                    className="w-1/3 rounded-t bg-green-500/80"
                    style={{
                      height: `${Math.max(4, (day.confirmed / maxBookingTotal) * 100)}%`,
                    }}
                    title={`${day.date}: ${day.confirmed} confirmed`}
                  />
                  <div
                    className="w-1/3 rounded-t bg-red-400/80"
                    style={{
                      height: `${Math.max(4, (day.cancelled / maxBookingTotal) * 100)}%`,
                    }}
                    title={`${day.date}: ${day.cancelled} cancelled`}
                  />
                </div>
                <span className="text-[10px] text-gray-400">{day.date.slice(5)}</span>
              </div>
            ))}
          </div>
          <div className="mt-3 flex gap-4 text-xs text-gray-500">
            <span className="flex items-center gap-1">
              <span className="inline-block h-2 w-2 rounded-full bg-green-500" /> Confirmed
            </span>
            <span className="flex items-center gap-1">
              <span className="inline-block h-2 w-2 rounded-full bg-red-400" /> Cancelled
            </span>
          </div>
        </div>

        <div className="card">
          <h2 className="font-semibold text-charcoal">Revenue trend</h2>
          <p className="mt-1 text-xs text-gray-500">Net revenue per day</p>
          <div className="mt-4 flex h-44 items-end gap-1">
            {analytics.revenueByDay.map((day) => (
              <div key={day.date} className="flex flex-1 flex-col items-center gap-1">
                <div
                  className="w-full rounded-t bg-brand/80"
                  style={{ height: `${Math.max(6, (day.net / maxRevenueNet) * 100)}%` }}
                  title={`${day.date}: net ${formatCurrency(day.net)}`}
                />
                <span className="text-[10px] text-gray-400">{day.date.slice(5)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <div className="card">
          <h2 className="font-semibold text-charcoal">Top routes</h2>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[520px] text-left text-sm">
              <thead className="text-xs uppercase text-gray-500">
                <tr>
                  <th className="pb-2 pr-3">Route</th>
                  <th className="pb-2 pr-3">Bookings</th>
                  <th className="pb-2 pr-3">Seats</th>
                  <th className="pb-2 pr-3">Revenue</th>
                  <th className="pb-2">Cancel %</th>
                </tr>
              </thead>
              <tbody>
                {analytics.topRoutes.length === 0 && (
                  <tr>
                    <td colSpan={5} className="py-4 text-gray-500">
                      No confirmed bookings in this period.
                    </td>
                  </tr>
                )}
                {analytics.topRoutes.map((route) => (
                  <tr key={route.routeId} className="border-t border-gray-100">
                    <td className="py-2 pr-3">
                      <p className="font-medium text-charcoal">{route.routeName}</p>
                      <p className="text-xs text-gray-500">{route.routeCode}</p>
                    </td>
                    <td className="py-2 pr-3">{route.bookings}</td>
                    <td className="py-2 pr-3">{route.seatsSold}</td>
                    <td className="py-2 pr-3">{formatCurrency(route.revenue)}</td>
                    <td className="py-2">{formatPercent(route.cancellationRate)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="card space-y-6">
          <div>
            <h2 className="font-semibold text-charcoal">Booking channels</h2>
            <div className="mt-4 space-y-3">
              {analytics.bookingSourceBreakdown.length === 0 && (
                <p className="text-sm text-gray-500">No confirmed bookings yet.</p>
              )}
              {analytics.bookingSourceBreakdown.map((row) => (
                <BreakdownBar
                  key={row.source}
                  label={row.label}
                  value={`${row.bookings} bookings`}
                  amount={formatCurrency(row.revenue)}
                  sharePercent={row.sharePercent}
                  maxShare={maxSourceShare}
                />
              ))}
            </div>
          </div>

          <div>
            <h2 className="font-semibold text-charcoal">Payment methods</h2>
            <div className="mt-4 space-y-3">
              {analytics.paymentMethodBreakdown.length === 0 && (
                <p className="text-sm text-gray-500">No captured payments yet.</p>
              )}
              {analytics.paymentMethodBreakdown.map((row) => (
                <BreakdownBar
                  key={row.method}
                  label={row.label}
                  value={`${row.count} payments`}
                  amount={formatCurrency(row.amount)}
                  sharePercent={row.sharePercent}
                  maxShare={maxMethodShare}
                />
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <div className="card">
          <h2 className="font-semibold text-charcoal">Agent performance</h2>
          <p className="mt-1 text-xs text-gray-500">Last {agents.periodDays} days</p>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="text-xs uppercase text-gray-500">
                <tr>
                  <th className="pb-2 pr-3">Agent</th>
                  <th className="pb-2 pr-3">Bookings</th>
                  <th className="pb-2 pr-3">Revenue</th>
                  <th className="pb-2 pr-3">Commission</th>
                  <th className="pb-2">Cancel %</th>
                </tr>
              </thead>
              <tbody>
                {agents.agents.length === 0 && (
                  <tr>
                    <td colSpan={5} className="py-4 text-gray-500">
                      No agent activity in this period.
                    </td>
                  </tr>
                )}
                {agents.agents.map((agent) => (
                  <tr key={agent.agentId} className="border-t border-gray-100">
                    <td className="py-2 pr-3">
                      <p className="font-medium text-charcoal">
                        {agent.fullName}
                        {!agent.isActive && (
                          <span className="ml-1 text-xs text-gray-400">(inactive)</span>
                        )}
                      </p>
                      <p className="text-xs text-gray-500">{agent.employeeCode}</p>
                    </td>
                    <td className="py-2 pr-3">
                      {agent.confirmedBookings}
                      {agent.cancelledBookings > 0 && (
                        <span className="text-xs text-gray-500">
                          {' '}
                          (+{agent.cancelledBookings} cancelled)
                        </span>
                      )}
                    </td>
                    <td className="py-2 pr-3">{formatCurrency(agent.revenue)}</td>
                    <td className="py-2 pr-3">
                      {formatCurrency(agent.commissionAccrued)}
                      {agent.commissionPaid > 0 && (
                        <span className="block text-xs text-gray-500">
                          Paid {formatCurrency(agent.commissionPaid)}
                        </span>
                      )}
                    </td>
                    <td className="py-2">{formatPercent(agent.cancellationRate)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="card">
          <h2 className="font-semibold text-charcoal">Upcoming trip occupancy</h2>
          <p className="mt-1 text-xs text-gray-500">Next {upcomingTrips.periodDays} days</p>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[620px] text-left text-sm">
              <thead className="text-xs uppercase text-gray-500">
                <tr>
                  <th className="pb-2 pr-3">Date / route</th>
                  <th className="pb-2 pr-3">Bus</th>
                  <th className="pb-2 pr-3">Seats</th>
                  <th className="pb-2 pr-3">Load</th>
                  <th className="pb-2">Revenue</th>
                </tr>
              </thead>
              <tbody>
                {upcomingTrips.trips.length === 0 && (
                  <tr>
                    <td colSpan={5} className="py-4 text-gray-500">
                      No upcoming trips in this window.
                    </td>
                  </tr>
                )}
                {upcomingTrips.trips.map((trip) => (
                  <tr key={trip.tripId} className="border-t border-gray-100">
                    <td className="py-2 pr-3">
                      <p className="font-medium text-charcoal">{trip.routeCode}</p>
                      <p className="text-xs text-gray-500">
                        {trip.serviceDate} ·{' '}
                        {new Date(trip.departureAt).toLocaleTimeString('en-IN', {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </p>
                    </td>
                    <td className="py-2 pr-3">{trip.busNumber}</td>
                    <td className="py-2 pr-3">
                      {trip.seatsSold}/{trip.totalSeats}
                      <span className="block text-xs text-gray-500">
                        {trip.seatsAvailable} available
                      </span>
                    </td>
                    <td className="py-2 pr-3">{formatPercent(trip.loadFactor)}</td>
                    <td className="py-2">{formatCurrency(trip.revenue)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {analytics.cancellationReasons.length > 0 && (
        <div className="mt-8 card">
          <h2 className="font-semibold text-charcoal">Cancellation reasons</h2>
          <ul className="mt-4 space-y-2 text-sm">
            {analytics.cancellationReasons.map((row) => (
              <li key={row.reason} className="flex items-center justify-between gap-3">
                <span className="text-gray-700">{row.reason}</span>
                <span className="font-medium text-charcoal">{row.count}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-8 space-y-6">
        <div className="card overflow-x-auto">
          <h2 className="font-semibold text-charcoal">Recent customer bookings</h2>
          <p className="mt-1 text-xs text-gray-500">Direct online bookings from customers</p>
          <BookingsTable rows={recent.customerBookings} />
        </div>

        <div className="card overflow-x-auto">
          <h2 className="font-semibold text-charcoal">Recent agent bookings</h2>
          <p className="mt-1 text-xs text-gray-500">
            Bookings made by agents or admin on behalf of passengers
          </p>
          <BookingsTable rows={recent.agentBookings} showAgent />
        </div>

        <div className="card overflow-x-auto">
          <h2 className="font-semibold text-charcoal">Recent OTA partner bookings</h2>
          <p className="mt-1 text-xs text-gray-500">RedBus, AbhiBus, and other integrated channels</p>
          <BookingsTable rows={recent.partnerBookings ?? []} showPartnerRef />
        </div>
      </div>
    </>
  );
}
