'use client';

import { useState } from 'react';
import { getAccessToken } from '@/lib/api-client';
import { sendMobileTicket } from '@/lib/bookings-api';
import {
  downloadTicketPdf,
  shareTicketWhatsApp,
  type TicketShareDetails,
} from '@/lib/ticket-actions';

type CustomerTicketActionsProps = TicketShareDetails & {
  layout?: 'stacked' | 'inline';
  className?: string;
  showDownload?: boolean;
};

export function CustomerTicketActions({
  reference,
  contactName,
  contactPhone,
  routeLabel,
  totalAmount,
  departureAt,
  seats,
  layout = 'stacked',
  className = '',
  showDownload = true,
}: CustomerTicketActionsProps) {
  const [busy, setBusy] = useState<'download' | 'phone' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [phoneStatus, setPhoneStatus] = useState<string | null>(null);

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
      setError('Please sign in again to download your ticket.');
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

  function onWhatsApp() {
    setError(null);
    shareTicketWhatsApp(shareDetails);
  }

  async function onSendToPhone() {
    const token = getAccessToken();
    if (!token) {
      setError('Please sign in again.');
      return;
    }
    if (!contactPhone) {
      setError('No phone number on this booking.');
      return;
    }
    setBusy('phone');
    setError(null);
    setPhoneStatus(null);
    try {
      const result = await sendMobileTicket(token, reference);
      if (result.skipped) {
        setPhoneStatus(result.message ?? 'Could not send ticket to phone.');
        return;
      }
      setPhoneStatus(
        result.message ??
          'Ticket sent to your phone. In dev, check apps/api/storage/sms/ and storage/whatsapp/.',
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Send failed');
    } finally {
      setBusy(null);
    }
  }

  const containerClass = layout === 'inline' ? 'flex flex-wrap gap-2' : 'flex flex-col gap-3';

  return (
    <div className={className}>
      <div className={containerClass}>
        {showDownload && (
          <button
            type="button"
            className="btn-primary inline-flex disabled:opacity-60"
            onClick={onDownload}
            disabled={busy !== null}
          >
            {busy === 'download' ? 'Preparing PDF…' : 'Download PDF ticket'}
          </button>
        )}
        <button
          type="button"
          className="rounded-lg border border-green-600 bg-green-50 px-4 py-2 text-sm text-green-800 hover:bg-green-100 disabled:opacity-60"
          onClick={onWhatsApp}
          disabled={busy !== null}
        >
          Share on WhatsApp
        </button>
        {contactPhone && (
          <button
            type="button"
            className="rounded-lg border border-gray-200 px-4 py-2 text-sm text-gray-700 hover:border-brand hover:text-brand disabled:opacity-60"
            onClick={onSendToPhone}
            disabled={busy !== null}
          >
            {busy === 'phone' ? 'Sending…' : 'Send ticket to phone'}
          </button>
        )}
      </div>
      {phoneStatus && (
        <p className="mt-3 rounded-lg border border-brand/20 bg-brand-light/30 px-3 py-2 text-sm text-charcoal">
          {phoneStatus}
        </p>
      )}
      {error && (
        <p className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      )}
    </div>
  );
}
