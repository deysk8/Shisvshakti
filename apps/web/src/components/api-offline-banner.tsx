'use client';

import { useEffect, useState } from 'react';
import { apiUnreachableMessage } from '@/lib/fetch-errors';

export function ApiOfflineBanner() {
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    const base = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1';
    let cancelled = false;

    async function ping() {
      try {
        const res = await fetch(`${base}/health`, { cache: 'no-store' });
        if (!cancelled) setOffline(!res.ok);
      } catch {
        if (!cancelled) setOffline(true);
      }
    }

    ping();
    const id = window.setInterval(ping, 30_000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, []);

  if (!offline) return null;

  return (
    <div className="border-b border-amber-200 bg-amber-50 px-4 py-2 text-center text-sm text-amber-900">
      {apiUnreachableMessage()}
    </div>
  );
}
