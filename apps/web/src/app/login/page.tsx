'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { FormEvent, useState, Suspense } from 'react';
import { SiteHeader } from '@/components/site-header';
import { login, saveAccessToken } from '@/lib/api-client';

function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const form = new FormData(e.currentTarget);
    try {
      const result = await login({
        email: String(form.get('email')),
        password: String(form.get('password')),
      });
      saveAccessToken(result.accessToken);

      const next = searchParams.get('next');
      if (next && next.startsWith('/') && !next.startsWith('//')) {
        router.push(next);
        return;
      }

      if (result.user.role === 'ADMIN') {
        router.push('/admin');
      } else if (result.user.role === 'AGENT') {
        router.push('/agent');
      } else {
        router.push('/');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-brand-light/30">
      <SiteHeader />
      <div className="flex items-center justify-center px-4 py-10">
      <div className="card w-full max-w-md">
        <h1 className="text-2xl font-bold text-charcoal">Login</h1>
        <p className="mt-1 text-sm text-gray-600">Sign in to your Shiv Shakti account</p>

        <form className="mt-6 space-y-4" onSubmit={onSubmit}>
          <label className="block text-sm font-medium text-gray-700">
            Email
            <input
              name="email"
              type="email"
              required
              autoComplete="email"
              className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2.5 outline-none ring-brand focus:ring-2"
            />
          </label>
          <label className="block text-sm font-medium text-gray-700">
            Password
            <input
              name="password"
              type="password"
              required
              minLength={8}
              autoComplete="current-password"
              className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2.5 outline-none ring-brand focus:ring-2"
            />
          </label>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button type="submit" className="btn-primary w-full" disabled={loading}>
            {loading ? 'Signing in…' : 'Login'}
          </button>
        </form>

        <p className="mt-4 text-center text-sm text-gray-600">
          New customer?{' '}
          <Link href="/register" className="font-medium text-brand hover:text-brand-deep">
            Register
          </Link>
          {' · '}
          <Link href="/login?next=/agent" className="font-medium text-brand hover:text-brand-deep">
            Agent login
          </Link>
        </p>
      </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-white"><SiteHeader /><p className="p-10 text-center text-sm text-gray-500">Loading…</p></div>}>
      <LoginContent />
    </Suspense>
  );
}
