const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1';

function authHeaders(token: string) {
  return { Authorization: `Bearer ${token}` };
}

export async function fetchLoyaltyBalance(token: string) {
  const res = await fetch(`${API_BASE}/loyalty/balance`, {
    headers: authHeaders(token),
    cache: 'no-store',
  });
  if (!res.ok) return { pointsBalance: 0 };
  return res.json() as Promise<{ pointsBalance: number }>;
}

export async function previewCoupon(code: string, subtotal: number) {
  const res = await fetch(
    `${API_BASE}/public/coupons/preview?code=${encodeURIComponent(code)}&subtotal=${subtotal}`,
    { cache: 'no-store' },
  );
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(typeof data.message === 'string' ? data.message : 'Invalid coupon');
  }
  return data as { code: string; discountAmount: number; description: string | null };
}

export async function submitRating(
  token: string,
  bookingReference: string,
  rating: number,
  comment?: string,
) {
  const res = await fetch(`${API_BASE}/ratings`, {
    method: 'POST',
    headers: { ...authHeaders(token), 'Content-Type': 'application/json' },
    body: JSON.stringify({ bookingReference, rating, comment }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(typeof data.message === 'string' ? data.message : 'Could not submit rating');
  }
  return data;
}

export async function fetchSavedPassengers(token: string) {
  const res = await fetch(`${API_BASE}/saved-passengers`, {
    headers: authHeaders(token),
    cache: 'no-store',
  });
  if (!res.ok) return [];
  return res.json() as Promise<
    { id: string; fullName: string; age: number | null; gender: string | null; phone: string | null }[]
  >;
}

export async function verifyTicketQr(token: string, qrToken: string, markBoarded = true) {
  const res = await fetch(`${API_BASE}/tickets/verify`, {
    method: 'POST',
    headers: { ...authHeaders(token), 'Content-Type': 'application/json' },
    body: JSON.stringify({ qrToken, markBoarded }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(typeof data.message === 'string' ? data.message : 'Scan failed');
  }
  return data as Record<string, unknown>;
}

export async function lookupTicketReference(token: string, bookingReference: string) {
  const res = await fetch(`${API_BASE}/tickets/lookup`, {
    method: 'POST',
    headers: { ...authHeaders(token), 'Content-Type': 'application/json' },
    body: JSON.stringify({ bookingReference: bookingReference.trim() }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(typeof data.message === 'string' ? data.message : 'Booking not found');
  }
  return data as Record<string, unknown>;
}

export async function boardTicketReference(token: string, bookingReference: string) {
  const res = await fetch(`${API_BASE}/tickets/board`, {
    method: 'POST',
    headers: { ...authHeaders(token), 'Content-Type': 'application/json' },
    body: JSON.stringify({ bookingReference: bookingReference.trim() }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(typeof data.message === 'string' ? data.message : 'Could not mark boarded');
  }
  return data as Record<string, unknown>;
}

export async function markTicketNoShow(token: string, bookingReference: string) {
  const res = await fetch(`${API_BASE}/tickets/no-show`, {
    method: 'POST',
    headers: { ...authHeaders(token), 'Content-Type': 'application/json' },
    body: JSON.stringify({ bookingReference: bookingReference.trim() }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(typeof data.message === 'string' ? data.message : 'Could not mark no-show');
  }
  return data as Record<string, unknown>;
}

export function invoicePdfUrl(reference: string) {
  return `${API_BASE}/invoices/by-reference/${encodeURIComponent(reference)}/pdf`;
}
