'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { getAccessToken } from '@/lib/api-client';
import { fetchAgentProfile } from '@/lib/agent-api';
import { API_UNREACHABLE, apiUnreachableMessage } from '@/lib/fetch-errors';

export default function AgentLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);

  useEffect(() => {
    const token = getAccessToken();
    if (!token) {
      router.replace('/login?next=/agent');
      return;
    }

    fetchAgentProfile(token)
      .then(() => {
        setApiError(null);
        setReady(true);
      })
      .catch((err: Error) => {
        if (err.message === API_UNREACHABLE) {
          setApiError(apiUnreachableMessage());
          return;
        }
        router.replace('/login?next=/agent');
      });
  }, [router]);

  if (apiError) {
    return (
      <div className="mx-auto max-w-md px-4 py-16 text-center">
        <p className="text-sm text-red-600">{apiError}</p>
        <button
          type="button"
          className="btn-primary mt-4"
          onClick={() => window.location.reload()}
        >
          Retry
        </button>
      </div>
    );
  }

  if (!ready) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-sm text-gray-500">
        Loading agent portal…
      </div>
    );
  }

  return (
    <>
      <nav className="border-b border-gray-100 bg-white">
        <div className="mx-auto flex max-w-6xl flex-wrap gap-4 px-4 py-2 text-sm sm:px-6">
          <Link href="/agent" className="font-medium text-brand">
            Dashboard
          </Link>
          <Link href="/agent/bookings" className="text-gray-600 hover:text-brand">
            Bookings
          </Link>
          <Link href="/agent/scan" className="text-gray-600 hover:text-brand">
            Scan QR
          </Link>
          <Link href="/agent/commissions" className="text-gray-600 hover:text-brand">
            Commissions
          </Link>
        </div>
      </nav>
      {children}
    </>
  );
}
