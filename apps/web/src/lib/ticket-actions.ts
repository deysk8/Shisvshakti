const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1';

export type TicketShareDetails = {
  reference: string;
  contactName?: string | null;
  contactPhone?: string | null;
  routeLabel?: string;
  totalAmount?: number;
  departureAt?: string;
  seats?: string[];
};

function authHeaders(token: string) {
  return { Authorization: `Bearer ${token}` };
}

export async function fetchTicketPdfBlob(reference: string, token: string): Promise<Blob> {
  const res = await fetch(`${API_BASE}/tickets/by-reference/${encodeURIComponent(reference)}/pdf`, {
    headers: authHeaders(token),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(typeof data.message === 'string' ? data.message : 'Could not load ticket PDF');
  }
  const blob = await res.blob();
  if (!blob.size) throw new Error('Downloaded ticket was empty');
  return blob;
}

export async function downloadTicketPdf(reference: string, token: string) {
  const blob = await fetchTicketPdfBlob(reference, token);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `shiv-shakti-${reference}.pdf`;
  a.click();
  URL.revokeObjectURL(url);
}

export async function printTicketPdf(reference: string, token: string) {
  const blob = await fetchTicketPdfBlob(reference, token);
  const url = URL.createObjectURL(blob);
  const printWindow = window.open(url, '_blank', 'noopener,noreferrer');
  if (!printWindow) {
    URL.revokeObjectURL(url);
    throw new Error('Pop-up blocked — allow pop-ups to print the ticket PDF');
  }
  printWindow.addEventListener('load', () => {
    printWindow.focus();
    printWindow.print();
  });
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

export function normalizeIndianPhone(phone: string): string | null {
  const digits = phone.replace(/\D/g, '');
  if (digits.length < 10) return null;
  const local = digits.length === 10 ? digits : digits.slice(-10);
  return `91${local}`;
}

export function buildTicketShareMessage(details: TicketShareDetails): string {
  const lines = [
    'Shiv Shakti — Booking confirmed',
    `Reference: ${details.reference}`,
    details.contactName && `Passenger: ${details.contactName}`,
    details.routeLabel && `Route: ${details.routeLabel}`,
    details.departureAt &&
      `Departure: ${new Date(details.departureAt).toLocaleString('en-IN', {
        dateStyle: 'medium',
        timeStyle: 'short',
      })}`,
    details.seats?.length && `Seats: ${details.seats.join(', ')}`,
    details.totalAmount != null && `Amount: ₹${details.totalAmount}`,
    '',
    'Please show this reference at boarding. For PDF ticket, contact your agent counter.',
  ];
  return lines.filter(Boolean).join('\n');
}

export function shareTicketWhatsApp(details: TicketShareDetails) {
  const phone = details.contactPhone ? normalizeIndianPhone(details.contactPhone) : null;
  const text = encodeURIComponent(buildTicketShareMessage(details));
  const url = phone
    ? `https://wa.me/${phone}?text=${text}`
    : `https://wa.me/?text=${text}`;
  window.open(url, '_blank', 'noopener,noreferrer');
}

export function agentTicketPrintUrl(reference: string, autoPrint = false) {
  const q = autoPrint ? '?print=1' : '';
  return `/agent/ticket/${encodeURIComponent(reference)}${q}`;
}
