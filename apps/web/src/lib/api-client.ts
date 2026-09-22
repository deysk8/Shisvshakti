import { API_UNREACHABLE, apiUnreachableMessage, safeClientFetch } from './fetch-errors';

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1';

export type AuthUser = {
  id: string;
  email: string;
  fullName: string;
  role: string;
  phone: string | null;
};

export type AuthResult = {
  accessToken: string;
  user: AuthUser;
};

async function parseJson<T>(res: Response): Promise<T> {
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const message =
      typeof data === 'object' && data && 'message' in data
        ? String((data as { message: string | string[] }).message)
        : res.statusText;
    throw new Error(Array.isArray(message) ? message.join(', ') : message);
  }
  return data as T;
}

export async function registerCustomer(body: {
  email: string;
  fullName: string;
  password: string;
  phone?: string;
}): Promise<AuthResult> {
  const res = await safeClientFetch(`${API_BASE}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(body),
  });
  return parseJson<AuthResult>(res);
}

export async function login(body: { email: string; password: string }): Promise<AuthResult> {
  try {
    const res = await safeClientFetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(body),
    });
    return parseJson<AuthResult>(res);
  } catch (err) {
    if (err instanceof Error && err.message === API_UNREACHABLE) {
      throw new Error(apiUnreachableMessage());
    }
    throw err;
  }
}

export function saveAccessToken(token: string) {
  if (typeof window !== 'undefined') {
    localStorage.setItem('ss_access_token', token);
  }
}

export function getAccessToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('ss_access_token');
}

export function clearAccessToken() {
  if (typeof window !== 'undefined') {
    localStorage.removeItem('ss_access_token');
  }
}

let refreshInFlight: Promise<string | null> | null = null;

/** Uses the httpOnly refresh cookie to obtain a new access token. */
export async function refreshAccessToken(): Promise<string | null> {
  if (refreshInFlight) {
    return refreshInFlight;
  }

  refreshInFlight = (async () => {
    try {
      const res = await fetch(`${API_BASE}/auth/refresh`, {
        method: 'POST',
        credentials: 'include',
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        clearAccessToken();
        return null;
      }
      const accessToken = (data as AuthResult).accessToken;
      if (!accessToken) {
        clearAccessToken();
        return null;
      }
      saveAccessToken(accessToken);
      return accessToken;
    } catch {
      return null;
    } finally {
      refreshInFlight = null;
    }
  })();

  return refreshInFlight;
}

export async function fetchAuthProfile(token: string): Promise<AuthUser> {
  const res = await safeClientFetch(`${API_BASE}/auth/me`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store',
  });
  return parseJson<AuthUser>(res);
}
