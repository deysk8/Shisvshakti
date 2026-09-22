/** Server/client fetch helper — returns fallback when API is down or unreachable. */
export async function safeFetchJson<T>(
  url: string,
  fallback: T,
  init?: RequestInit,
): Promise<T> {
  try {
    const res = await fetch(url, init);
    if (!res.ok) return fallback;
    return (await res.json()) as T;
  } catch {
    return fallback;
  }
}

export function apiBaseUrl() {
  return process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1';
}
