/** Normalize decoded QR text into the ticket verify token (64-char hex from PDF). */
export function extractQrToken(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return trimmed;

  try {
    const url = new URL(trimmed);
    for (const key of ['token', 'qr', 'qrToken', 't']) {
      const value = url.searchParams.get(key);
      if (value?.trim()) return value.trim();
    }
    const segment = url.pathname.split('/').filter(Boolean).pop();
    if (segment && /^[a-f0-9]{32,128}$/i.test(segment)) return segment;
  } catch {
    // Not a URL — use raw payload (PDF encodes the hex token directly).
  }

  return trimmed;
}
