'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { SiteHeader } from '@/components/site-header';
import { getAccessToken } from '@/lib/api-client';
import { fetchAgentCommissions, type AgentCommissionRow } from '@/lib/agent-api';

export default function AgentCommissionsPage() {
  const [rows, setRows] = useState<AgentCommissionRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const total = rows.reduce((sum, row) => sum + row.commissionAmount, 0);

  useEffect(() => {
    const token = getAccessToken();
    if (!token) return;
    fetchAgentCommissions(token)
      .then(setRows)
      .catch((err) => setError(err instanceof Error ? err.message : 'Could not load commissions'));
  }, []);

  return (
    <div className="min-h-screen bg-white">
      <SiteHeader />
      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
        <Link href="/agent" className="text-sm text-brand hover:underline">
          ← Agent dashboard
        </Link>
        <h1 className="mt-4 text-2xl font-bold text-charcoal">Commission history</h1>
        <p className="mt-1 text-sm text-gray-600">
          Total earned: <strong className="text-brand">₹{total.toFixed(0)}</strong>
        </p>
        {error && <p className="mt-4 text-sm text-red-600">{error}</p>}
        <div className="mt-6 card overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="text-xs uppercase text-gray-500">
              <tr>
                <th className="pb-2 pr-3">Date</th>
                <th className="pb-2 pr-3">Reference</th>
                <th className="pb-2 pr-3">Customer</th>
                <th className="pb-2 pr-3">Booking</th>
                <th className="pb-2 pr-3">Rate</th>
                <th className="pb-2">Commission</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={`${row.bookingReference}-${row.accruedAt}`} className="border-t border-gray-100">
                  <td className="py-2 pr-3">
                    {new Date(row.accruedAt).toLocaleDateString('en-IN')}
                  </td>
                  <td className="py-2 pr-3 font-medium">{row.bookingReference}</td>
                  <td className="py-2 pr-3">{row.contactName ?? '—'}</td>
                  <td className="py-2 pr-3">₹{row.bookingAmount}</td>
                  <td className="py-2 pr-3">{row.commissionRatePercent}%</td>
                  <td className="py-2 font-medium text-brand">₹{row.commissionAmount}</td>
                </tr>
              ))}
              {!rows.length && !error && (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-gray-500">
                    No commissions yet — confirm a booking to start earning.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
