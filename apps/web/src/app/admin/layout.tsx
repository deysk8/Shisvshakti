'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { clearAccessToken, fetchAuthProfile, getAccessToken } from '@/lib/api-client';
import { API_UNREACHABLE, apiUnreachableMessage } from '@/lib/fetch-errors';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);
  const [wrongRole, setWrongRole] = useState<{ role: string; email: string } | null>(null);

  useEffect(() => {
    const token = getAccessToken();
    if (!token) {
      router.replace('/login?next=/admin');
      return;
    }

    fetchAuthProfile(token)
      .then((profile) => {
        if (profile.role !== 'ADMIN') {
          setWrongRole({ role: profile.role, email: profile.email });
          return;
        }
        setApiError(null);
        setReady(true);
      })
      .catch((err: Error) => {
        if (err.message === API_UNREACHABLE) {
          setApiError(apiUnreachableMessage());
          return;
        }
        clearAccessToken();
        router.replace('/login?next=/admin');
      });
  }, [router]);

  if (wrongRole) {
    return (
      <div className="mx-auto max-w-md px-4 py-16 text-center">
        <h1 className="text-xl font-bold text-charcoal">Admin access required</h1>
        <p className="mt-3 text-sm text-gray-600">
          You are signed in as{' '}
          <span className="font-medium text-charcoal">{wrongRole.role.toLowerCase()}</span> (
          {wrongRole.email}). The admin dashboard needs an admin account.
        </p>
        <button
          type="button"
          className="btn-primary mt-6"
          onClick={() => {
            clearAccessToken();
            router.push('/login?next=/admin');
          }}
        >
          Sign in as admin
        </button>
        {wrongRole.role === 'AGENT' && (
          <Link href="/agent" className="mt-3 inline-block text-sm font-medium text-brand hover:text-brand-deep">
            Back to agent portal
          </Link>
        )}
      </div>
    );
  }

  if (apiError) {
    return (
      <div className="mx-auto max-w-md px-4 py-16 text-center">
        <p className="text-sm text-red-600">{apiError}</p>
        <button type="button" className="btn-primary mt-4" onClick={() => window.location.reload()}>
          Retry
        </button>
      </div>
    );
  }

  if (!ready) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-sm text-gray-500">
        Loading admin dashboard…
      </div>
    );
  }

  return children;
}
