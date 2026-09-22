export type AnalyticsOverview = {
  periodDays: number;
  periodStart: string;
  periodEnd: string;
  summary: {
    confirmedBookings: number;
    cancelledBookings: number;
    pendingPaymentBookings: number;
    todayBookings: number;
    upcomingTrips: number;
    seatsSold: number;
    grossRevenue: number;
    refundsTotal: number;
    netRevenue: number;
    averageBookingValue: number;
    totalDiscountGiven: number;
    cancellationRate: number;
  };
  bookingsByDay: {
    date: string;
    total: number;
    confirmed: number;
    cancelled: number;
    revenue: number;
  }[];
  revenueByDay: {
    date: string;
    gross: number;
    refunds: number;
    net: number;
  }[];
  topRoutes: {
    routeId: string;
    routeCode: string;
    routeName: string;
    bookings: number;
    seatsSold: number;
    revenue: number;
    cancellationRate: number;
  }[];
  bookingSourceBreakdown: {
    source: string;
    label: string;
    bookings: number;
    revenue: number;
    sharePercent: number;
  }[];
  paymentMethodBreakdown: {
    method: string;
    label: string;
    count: number;
    amount: number;
    sharePercent: number;
  }[];
  cancellationReasons: {
    reason: string;
    count: number;
  }[];
};

export type AgentPerformanceResponse = {
  periodDays: number;
  agents: {
    agentId: string;
    employeeCode: string;
    fullName: string;
    email: string;
    isActive: boolean;
    bookings: number;
    confirmedBookings: number;
    cancelledBookings: number;
    revenue: number;
    commissionAccrued: number;
    commissionPaid: number;
    cancellationRate: number;
  }[];
};

export type UpcomingTripsAnalytics = {
  periodDays: number;
  trips: {
    tripId: string;
    routeCode: string;
    routeName: string;
    busNumber: string;
    serviceDate: string;
    departureAt: string;
    status: string;
    totalSeats: number;
    seatsSold: number;
    seatsAvailable: number;
    loadFactor: number;
    revenue: number;
  }[];
};

export type RecentBookingRow = {
  bookingReference: string;
  status: string;
  bookingSource: string;
  partnerReference?: string | null;
  partnerChannel?: string | null;
  paymentMethod: string | null;
  totalAmount: number;
  discountAmount: number;
  routeName: string;
  routeCode: string;
  departureAt: string;
  seats: string[];
  contactName: string | null;
  contactPhone: string | null;
  agentName: string | null;
  createdAt: string;
};

export type RecentBookingsResponse = {
  customerBookings: RecentBookingRow[];
  agentBookings: RecentBookingRow[];
  partnerBookings: RecentBookingRow[];
};

export type PartnerChannelRow = {
  id: string;
  code: string;
  name: string;
  apiKeyPrefix: string;
  isActive: boolean;
  commissionPercent: number | null;
  webhookUrl: string | null;
  createdAt: string;
  updatedAt: string;
  systemUser: { id: string; email: string; fullName: string };
  _count: { bookings: number };
};

import { clearAccessToken, getAccessToken, refreshAccessToken } from './api-client';

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1';

async function authorizedFetch(
  token: string | null | undefined,
  path: string,
  init?: RequestInit,
): Promise<Response> {
  let authToken = token ?? getAccessToken();
  if (!authToken) {
    throw new Error('Please sign in again to continue.');
  }

  const request = (bearer: string) =>
    fetch(`${API_BASE}${path}`, {
      ...init,
      credentials: 'include',
      headers: {
        Authorization: `Bearer ${bearer}`,
        ...(init?.headers ?? {}),
      },
      cache: 'no-store',
    });

  let res = await request(authToken);
  if (res.status === 401) {
    const refreshed = await refreshAccessToken();
    if (refreshed) {
      authToken = refreshed;
      res = await request(authToken);
    }
  }

  return res;
}

function parseAdminError(res: Response, data: unknown): never {
  if (res.status === 401) {
    clearAccessToken();
    throw new Error('Session expired. Please sign in again.');
  }
  const msg = typeof data === 'object' && data && 'message' in data ? (data as { message: unknown }).message : null;
  const text =
    typeof msg === 'string'
      ? msg
      : Array.isArray(msg)
        ? msg.join(', ')
        : 'Admin request failed';
  throw new Error(text);
}

export async function fetchAnalyticsOverview(
  token: string | null | undefined,
  days = 14,
): Promise<AnalyticsOverview> {
  const res = await authorizedFetch(token, `/admin/analytics/overview?days=${days}`);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    parseAdminError(res, data);
  }
  return data as AnalyticsOverview;
}

export async function downloadAnalyticsExport(
  token: string | null | undefined,
  days = 14,
): Promise<void> {
  const res = await authorizedFetch(token, `/admin/analytics/export?days=${days}`);
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    parseAdminError(res, data);
  }
  const blob = await res.blob();
  const stamp = new Date().toISOString().slice(0, 10);
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `shiv-shakti-analytics-${stamp}.csv`;
  anchor.click();
  URL.revokeObjectURL(url);
}

export async function fetchRecentBookings(
  token: string | null | undefined,
): Promise<RecentBookingsResponse> {
  const res = await authorizedFetch(token, '/admin/analytics/recent-bookings');
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    parseAdminError(res, data);
  }
  return data as RecentBookingsResponse;
}

export async function fetchPartnerChannels(
  token: string | null | undefined,
): Promise<PartnerChannelRow[]> {
  const res = await authorizedFetch(token, '/admin/partner-channels');
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    parseAdminError(res, data);
  }
  return data as PartnerChannelRow[];
}

export async function updatePartnerChannel(
  token: string | null | undefined,
  id: string,
  body: { isActive?: boolean; commissionPercent?: number | null; webhookUrl?: string | null },
): Promise<PartnerChannelRow> {
  const res = await authorizedFetch(token, `/admin/partner-channels/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    parseAdminError(res, data);
  }
  return data as PartnerChannelRow;
}

export async function rotatePartnerChannelKey(
  token: string | null | undefined,
  id: string,
): Promise<{ id: string; code: string; apiKey: string; apiKeyPrefix: string }> {
  const res = await authorizedFetch(token, `/admin/partner-channels/${id}/rotate-key`, {
    method: 'POST',
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    parseAdminError(res, data);
  }
  return data as { id: string; code: string; apiKey: string; apiKeyPrefix: string };
}

export async function testPartnerWebhook(
  token: string | null | undefined,
  id: string,
): Promise<{ ok: boolean; status?: number; eventId?: string; error?: string }> {
  const res = await authorizedFetch(token, `/admin/partner-channels/${id}/test-webhook`, {
    method: 'POST',
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    parseAdminError(res, data);
  }
  return data as { ok: boolean; status?: number; eventId?: string; error?: string };
}

export async function fetchAgentPerformance(
  token: string | null | undefined,
  days = 30,
): Promise<AgentPerformanceResponse> {
  const res = await authorizedFetch(token, `/admin/analytics/agents?days=${days}`);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    parseAdminError(res, data);
  }
  return data as AgentPerformanceResponse;
}

export async function fetchUpcomingTripsAnalytics(
  token: string | null | undefined,
  days = 14,
): Promise<UpcomingTripsAnalytics> {
  const res = await authorizedFetch(token, `/admin/analytics/upcoming-trips?days=${days}`);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    parseAdminError(res, data);
  }
  return data as UpcomingTripsAnalytics;
}

export async function adminFetch<T>(
  token: string | null | undefined,
  path: string,
  init?: RequestInit,
): Promise<T> {
  const res = await authorizedFetch(token, path, init);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    parseAdminError(res, data);
  }
  return data as T;
}

export type AdminSettings = {
  seniorDiscountEnabled: boolean;
  seniorDiscountPercent: number;
  childDiscountEnabled: boolean;
  childDiscountPercent: number;
  childMaxAge: number;
};

export type AdminAgent = {
  id: string;
  employeeCode: string;
  isActive: boolean;
  commissionRatePercent: number | string;
  salaryMonthly: number | string;
  user: { id: string; email: string; fullName: string; phone: string | null; isActive: boolean };
};

export type AdminCoupon = {
  id: string;
  code: string;
  description: string | null;
  discountType: string;
  discountValue: number | string;
  isActive: boolean;
  usedCount: number;
};

export type AdminFareRule = {
  id: string;
  fromSequence: number;
  toSequence: number;
  amount: number | string;
  isActive: boolean;
};

export type AdminTrip = {
  id: string;
  departureAt: string;
  serviceDate: string;
  status: string;
  route: { id: string; code: string; name: string };
  bus: { name: string | null; registrationNumber: string };
  schedule: { baseFare: number | string };
  _count?: { bookings: number };
};

export type AdminBus = {
  id: string;
  name: string | null;
  registrationNumber: string;
  status: string;
  driver1Name?: string | null;
  driver2Name?: string | null;
  conductorName?: string | null;
  busType: { name: string };
};

export type AdminBusCrew = {
  id: string;
  registrationNumber: string;
  name: string | null;
  status: string;
  busType: { name: string };
  driver1Name: string | null;
  driver2Name: string | null;
  conductorName: string | null;
  activeAssignment: {
    routeId: string;
    routeCode: string;
    routeName: string;
    routeIsActive: boolean;
    departureTime: string;
  } | null;
};

export type AdminBusType = {
  id: string;
  name: string;
  totalSeats: number;
  layoutKind: string;
};

export type AdminRouteSchedule = {
  id: string;
  isActive: boolean;
  departureTime: string;
  baseFare: number | string;
  bus: {
    id: string;
    name: string | null;
    registrationNumber: string;
    status: string;
  };
};

export type AdminRouteManagement = {
  id: string;
  code: string;
  name: string;
  isActive: boolean;
  estimatedDurationMinutes: number | null;
  originStop: { city: string | null; name: string };
  destinationStop: { city: string | null; name: string };
  routeStops: {
    sequence: number;
    arrivalOffsetMin?: number;
    departureOffsetMin?: number;
    distanceFromOriginKm?: number | string;
    stop: { city: string | null; name: string; state?: string | null };
  }[];
  schedules: AdminRouteSchedule[];
};

export type AdminTripSeatPricingSeat = {
  id: string;
  label: string;
  deck: string;
  seatType: string;
  status: 'available' | 'booked' | 'locked';
  baseFare: number;
  overrideAmount: number | null;
  effectiveFare: number;
  overridden: boolean;
};

export type AdminTripSeatPricing = {
  trip: {
    id: string;
    serviceDate: string;
    departureAt: string;
    status: string;
    route: { id: string; code: string; name: string };
    bus: { id: string; name: string | null; registrationNumber: string };
    availableSeats: number;
    hoursUntilDeparture: number;
  };
  segment: { fromSequence: number; toSequence: number; baseFare: number };
  seats: AdminTripSeatPricingSeat[];
};
