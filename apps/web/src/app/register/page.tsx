'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FormEvent, useState } from 'react';
import { registerCustomer, saveAccessToken } from '@/lib/api-client';

export default function RegisterPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const form = new FormData(e.currentTarget);
    const phone = String(form.get('phone') || '').trim();
    if (!/^[0-9]{10,15}$/.test(phone.replace(/\D/g, ''))) {
      setError('Enter a valid 10-digit mobile number.');
      setLoading(false);
      return;
    }
    try {
      const result = await registerCustomer({
        email: String(form.get('email')),
        fullName: String(form.get('fullName')),
        password: String(form.get('password')),
        phone: phone.replace(/\D/g, '').slice(-10),
      });
      saveAccessToken(result.accessToken);
      router.push('/');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registration failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-brand-light/30 px-4 py-10">
      <div className="card w-full max-w-md">
        <h1 className="text-2xl font-bold text-charcoal">Create account</h1>
        <p className="mt-1 text-sm text-gray-600">Book buses with Shiv Shakti</p>

        <form className="mt-6 space-y-4" onSubmit={onSubmit}>
          <label className="block text-sm font-medium text-gray-700">
            Full name
            <input
              name="fullName"
              required
              minLength={2}
              className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2.5 outline-none ring-brand focus:ring-2"
            />
          </label>
          <label className="block text-sm font-medium text-gray-700">
            Email
            <input
              name="email"
              type="email"
              required
              className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2.5 outline-none ring-brand focus:ring-2"
            />
          </label>
          <label className="block text-sm font-medium text-gray-700">
            Phone
            <input
              name="phone"
              required
              inputMode="numeric"
              pattern="[0-9]{10,15}"
              title="10-digit mobile number"
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
              autoComplete="new-password"
              className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2.5 outline-none ring-brand focus:ring-2"
            />
          </label>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button type="submit" className="btn-primary w-full" disabled={loading}>
            {loading ? 'Creating…' : 'Register'}
          </button>
        </form>

        <p className="mt-4 text-center text-sm text-gray-600">
          Already have an account?{' '}
          <Link href="/login" className="font-medium text-brand hover:text-brand-deep">
            Login
          </Link>
        </p>
      </div>
    </div>
  );
}
