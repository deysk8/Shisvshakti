'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { AdminAnalyticsDashboard } from '@/components/admin-analytics-dashboard';
import { SiteHeader } from '@/components/site-header';
import { getAccessToken } from '@/lib/api-client';
import {
  fetchAgentPerformance,
  fetchAnalyticsOverview,
  fetchRecentBookings,
  fetchUpcomingTripsAnalytics,
  type AgentPerformanceResponse,
  type AnalyticsOverview,
  type RecentBookingsResponse,
  type UpcomingTripsAnalytics,
} from '@/lib/admin-api';
import { formatMinutes } from '@/lib/routes-api';

type RouteRow = {
  id: string;
  name: string;
  code: string;
  routeStops: { sequence: number; stop: { name: string; city: string } }[];
  estimatedDurationMinutes: number | null;
};

const EMPTY_AGENTS: AgentPerformanceResponse = { periodDays: 30, agents: [] };
const EMPTY_UPCOMING: UpcomingTripsAnalytics = { periodDays: 14, trips: [] };

export default function AdminDashboardPage() {
  const [routes, setRoutes] = useState<RouteRow[]>([]);
  const [analytics, setAnalytics] = useState<AnalyticsOverview | null>(null);
  const [agents, setAgents] = useState<AgentPerformanceResponse>(EMPTY_AGENTS);
  const [upcomingTrips, setUpcomingTrips] = useState<UpcomingTripsAnalytics>(EMPTY_UPCOMING);
  const [recent, setRecent] = useState<RecentBookingsResponse>({
    customerBookings: [],
    agentBookings: [],
    partnerBookings: [],
  });
  const [periodDays, setPeriodDays] = useState(14);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadDashboard = useCallback(async (days: number) => {
    const token = getAccessToken();
    const base = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1';
    if (!token) {
      setLoading(false);
      setError('Please sign in as admin to view analytics.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const [routeRows, overview, agentRows, tripRows, recentRows] = await Promise.all([
        fetch(`${base}/admin/routes`, {
          headers: { Authorization: `Bearer ${token}` },
        }).then(async (res) => {
          if (!res.ok) throw new Error('Could not load routes (login as admin?)');
          return res.json() as Promise<RouteRow[]>;
        }),
        fetchAnalyticsOverview(token, days),
        fetchAgentPerformance(token, days),
        fetchUpcomingTripsAnalytics(token, Math.min(days, 14)),
        fetchRecentBookings(token),
      ]);

      setRoutes(routeRows);
      setAnalytics(overview);
      setAgents(agentRows);
      setUpcomingTrips(tripRows);
      setRecent(recentRows);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load dashboard');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDashboard(periodDays);
  }, [loadDashboard, periodDays]);

  return (
    <div className="min-h-screen bg-gray-50">
      <SiteHeader />
      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
        <h1 className="text-2xl font-bold text-charcoal">Admin dashboard</h1>
        <p className="mt-2 text-gray-600">
          Sales, bookings, routes, agents, and trip occupancy — Shiv Shakti
        </p>
        <Link
          href="/admin/operations"
          className="mt-3 inline-block text-sm font-medium text-brand hover:underline"
        >
          Operations — routes, buses, crew, fares →
        </Link>
        <Link
          href="/admin/partners"
          className="mt-2 block text-sm font-medium text-brand hover:underline"
        >
          OTA partners — RedBus / AbhiBus API keys →
        </Link>

        {error && <p className="mt-4 text-sm text-red-600">{error}</p>}

        {analytics && (
          <AdminAnalyticsDashboard
            analytics={analytics}
            agents={agents}
            upcomingTrips={upcomingTrips}
            recent={recent}
            periodDays={periodDays}
            onPeriodChange={setPeriodDays}
            loading={loading}
          />
        )}

        {!analytics && loading && !error && (
          <p className="mt-8 text-sm text-gray-500">Loading analytics…</p>
        )}

        <div className="mt-10">
          <h2 className="text-lg font-semibold text-charcoal">Routes overview</h2>
          <div className="mt-4 space-y-4">
            {routes.map((route) => (
              <div key={route.id} className="card">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="font-semibold text-charcoal">{route.name}</h3>
                  <span className="rounded-full bg-brand-light px-3 py-1 text-xs font-medium text-brand-deep">
                    {route.code}
                  </span>
                </div>
                {route.estimatedDurationMinutes != null && (
                  <p className="mt-1 text-sm text-gray-500">
                    Duration ~{formatMinutes(route.estimatedDurationMinutes)}
                  </p>
                )}
                <p className="mt-3 text-sm text-gray-700">
                  {route.routeStops
                    .sort((a, b) => a.sequence - b.sequence)
                    .map((rs) => rs.stop.city)
                    .join(' → ')}
                </p>
              </div>
            ))}
            {!error && routes.length === 0 && !loading && (
              <p className="text-sm text-gray-500">No routes yet. Run database seed after migrate.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
