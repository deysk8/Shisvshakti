export type AgentDashboard = {
  agent: { employeeCode: string; fullName: string; commissionRatePercent: number };
  summary: {
    todayBookings: number;
    confirmedBookings: number;
    pendingPayment: number;
    totalCommission: number;
    todaySales: {
      cashBookings: number;
      cashRevenue: number;
      onlineBookings: number;
      onlineRevenue: number;
      totalRevenue: number;
      boardedToday: number;
      noShowToday: number;
    };
  };
  recentBookings: {
    bookingId: string;
    bookingReference: string;
    status: string;
    bookingSource: string;
    contactName: string | null;
    contactPhone: string | null;
    totalAmount: number;
    routeCode: string;
    seats: string[];
    createdAt: string;
  }[];
};

export type AgentBookingRow = {
  bookingId: string;
  bookingReference: string;
  status: string;
  bookingSource: string;
  contactName: string | null;
  contactPhone: string | null;
  totalAmount: number;
  routeName: string;
  routeCode: string;
  departureAt: string;
  seats: string[];
  commissionAmount: number | null;
  createdAt: string;
};

import { safeClientFetch } from './fetch-errors';

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1';

function authHeaders(token: string) {
  return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
}

export async function fetchAgentDashboard(token: string): Promise<AgentDashboard> {
  const res = await safeClientFetch(`${API_BASE}/agent/dashboard`, {
    headers: authHeaders(token),
    cache: 'no-store',
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(typeof data.message === 'string' ? data.message : 'Agent dashboard failed');
  return data;
}

export async function fetchAgentBookings(token: string): Promise<AgentBookingRow[]> {
  const res = await safeClientFetch(`${API_BASE}/agent/bookings`, {
    headers: authHeaders(token),
    cache: 'no-store',
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(typeof data.message === 'string' ? data.message : 'Could not load bookings');
  return data;
}

export function setAgentCashMode(cash: boolean) {
  if (typeof window !== 'undefined') {
    sessionStorage.setItem('ss_agent_cash', cash ? '1' : '0');
  }
}

export function getAgentCashMode() {
  if (typeof window === 'undefined') return false;
  return sessionStorage.getItem('ss_agent_cash') === '1';
}

export type AgentCommissionRow = {
  bookingReference: string;
  contactName: string | null;
  bookingAmount: number;
  commissionRatePercent: number;
  commissionAmount: number;
  status: string;
  accruedAt: string;
};

export type AgentProfile = {
  id: string;
  email: string;
  fullName: string;
  phone: string | null;
  employeeCode: string;
  commissionRatePercent: number;
};

export async function fetchAgentProfile(token: string): Promise<AgentProfile> {
  const res = await safeClientFetch(`${API_BASE}/agent/me`, {
    headers: authHeaders(token),
    cache: 'no-store',
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(typeof data.message === 'string' ? data.message : 'Agent access denied');
  return data;
}

export async function fetchAgentCommissions(token: string): Promise<AgentCommissionRow[]> {
  const res = await safeClientFetch(`${API_BASE}/agent/commissions`, {
    headers: authHeaders(token),
    cache: 'no-store',
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(typeof data.message === 'string' ? data.message : 'Could not load commissions');
  return data;
}
