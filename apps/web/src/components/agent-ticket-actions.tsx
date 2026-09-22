'use client';

import Link from 'next/link';
import { useState } from 'react';
import { getAccessToken } from '@/lib/api-client';
import {
  agentTicketPrintUrl,
  downloadTicketPdf,
  printTicketPdf,
  shareTicketWhatsApp,
  type TicketShareDetails,
} from '@/lib/ticket-actions';

type AgentTicketActionsProps = TicketShareDetails & {
  status: string;
  layout?: 'stacked' | 'inline' | 'compact';
  className?: string;
};

export function AgentTicketActions({
  reference,
  status,
  contactName,
  contactPhone,
  routeLabel,
  totalAmount,
  departureAt,
  seats,
  layout = 'inline',
  className = '',
}: AgentTicketActionsProps) {
  const [busy, setBusy] = useState<'download' | 'print' | null>(null);
  const [error, setError] = useState<string | null>(null);

  const confirmed = status === 'CONFIRMED' || status === 'COMPLETED';
  const shareDetails: TicketShareDetails = {
    reference,
    contactName,
    contactPhone,
    routeLabel,
    totalAmount,
    departureAt,
    seats,
  };

  async function onDownload() {
    const token = getAccessToken();
    if (!token) {
      setError('Please sign in again');
      return;
    }
    setBusy('download');
    setError(null);
    try {
      await downloadTicketPdf(reference, token);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Download failed');
    } finally {
      setBusy(null);
    }
  }

  async function onPrintPdf() {
    const token = getAccessToken();
    if (!token) {
      setError('Please sign in again');
      return;
    }
    setBusy('print');
    setError(null);
    try {
      await printTicketPdf(reference, token);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Print failed');
    } finally {
      setBusy(null);
    }
  }

  function onWhatsApp() {
    setError(null);
    shareTicketWhatsApp(shareDetails);
  }

  if (!confirmed) {
    return (
      <span className={`text-xs text-gray-400 ${className}`}>
        {status === 'PENDING_PAYMENT' ? 'Awaiting payment' : '—'}
      </span>
    );
  }

  const btnBase =
    layout === 'compact'
      ? 'rounded px-2 py-1 text-xs font-medium'
      : 'rounded-lg px-3 py-1.5 text-xs font-medium sm:text-sm';

  const containerClass =
    layout === 'stacked'
      ? 'flex flex-col gap-2'
      : layout === 'compact'
        ? 'flex flex-wrap gap-1'
        : 'flex flex-wrap gap-2';

  return (
    <div className={className}>
      <div className={containerClass}>
        <button
          type="button"
          className={`${btnBase} bg-brand text-white hover:bg-brand-deep disabled:opacity-60`}
          onClick={onDownload}
          disabled={busy !== null}
        >
          {busy === 'download' ? '…' : layout === 'compact' ? 'PDF' : 'Download PDF'}
        </button>
        <button
          type="button"
          className={`${btnBase} border border-gray-200 bg-white text-charcoal hover:border-brand hover:text-brand disabled:opacity-60`}
          onClick={onPrintPdf}
          disabled={busy !== null}
        >
          {busy === 'print' ? '…' : 'Print PDF'}
        </button>
        <Link
          href={agentTicketPrintUrl(reference, true)}
          target="_blank"
          rel="noopener noreferrer"
          className={`${btnBase} border border-gray-200 bg-white text-charcoal hover:border-brand hover:text-brand`}
        >
          {layout === 'compact' ? 'Receipt' : 'Print receipt'}
        </Link>
        <button
          type="button"
          className={`${btnBase} border border-green-600 bg-green-50 text-green-800 hover:bg-green-100`}
          onClick={onWhatsApp}
        >
          {layout === 'compact' ? 'WhatsApp' : 'Share on WhatsApp'}
        </button>
      </div>
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}
