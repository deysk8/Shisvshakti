export type CancellationPolicy = {
  id: string;
  name: string;
  minHoursBeforeDeparture: number;
  maxHoursBeforeDeparture: number | null;
  refundPercent: number;
  priority: number;
};

export type MyBooking = {
  id: string;
  bookingReference: string;
  status: string;
  totalAmount: number | string;
  refundStatus: string;
  cancelledAt: string | null;
  contactName: string | null;
  contactPhone?: string | null;
  rescheduleUsed: boolean;
  trip: {
    departureAt: string;
    serviceDate: string;
    route: { name: string; code: string };
    bus: { name: string };
  };
  seats: { seatLabel: string }[];
  boardingStop?: {
    sequence: number;
    stop: { city: string | null; name: string };
  };
  droppingStop?: {
    sequence: number;
    stop: { city: string | null; name: string };
  };
};

export type CancellationPreview = {
  bookingReference: string;
  status: string;
  departureAt: string;
  hoursBeforeDeparture: number;
  canCancel: boolean;
  policy: { id: string; name: string; refundPercent: number } | null;
  totalAmount: number;
  refundAmount: number;
  paymentMethod: string | null;
};

export type CancelResult = {
  bookingReference: string;
  status: string;
  refundAmount: number;
  refundPercent: number;
  refundStatus: string;
  policyName: string | null;
};

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1';

function authHeaders(token: string) {
  return {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  };
}

export async function fetchCancellationPolicies(): Promise<CancellationPolicy[]> {
  const res = await fetch(`${API_BASE}/cancellations/policies`, { cache: 'no-store' });
  if (!res.ok) return [];
  return res.json();
}

export async function fetchMyBookings(token: string): Promise<MyBooking[]> {
  const res = await fetch(`${API_BASE}/bookings/my`, {
    headers: authHeaders(token),
    cache: 'no-store',
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(typeof data.message === 'string' ? data.message : 'Could not load bookings');
  }
  return res.json();
}

export async function fetchCancellationPreview(
  token: string,
  reference: string,
): Promise<CancellationPreview> {
  const res = await fetch(`${API_BASE}/cancellations/preview/${encodeURIComponent(reference)}`, {
    headers: authHeaders(token),
    cache: 'no-store',
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(typeof data.message === 'string' ? data.message : 'Could not load preview');
  }
  return data;
}

export async function cancelBooking(
  token: string,
  reference: string,
  reason?: string,
): Promise<CancelResult> {
  const res = await fetch(`${API_BASE}/cancellations/${encodeURIComponent(reference)}`, {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify({ reason }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(typeof data.message === 'string' ? data.message : 'Cancellation failed');
  }
  return data;
}

export function computeLoyaltyPoints(bookings: MyBooking[]): number {
  return bookings
    .filter((b) => b.status === 'CONFIRMED')
    .reduce((sum, b) => sum + Math.floor(Number(b.totalAmount) / 100), 0);
}

export type SendMobileTicketResult = {
  ok: boolean;
  message?: string;
  skipped?: boolean;
  reason?: string;
  delivered?: Array<{ channel: string; status: string; devFile?: string }>;
};

export async function sendMobileTicket(
  token: string,
  reference: string,
): Promise<SendMobileTicketResult> {
  const res = await fetch(
    `${API_BASE}/bookings/${encodeURIComponent(reference)}/send-mobile-ticket`,
    {
      method: 'POST',
      headers: authHeaders(token),
    },
  );
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(typeof data.message === 'string' ? data.message : 'Could not send ticket to phone');
  }
  return data;
}
