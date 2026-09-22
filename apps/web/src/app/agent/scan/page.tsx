'use client';

import Link from 'next/link';
import { FormEvent, useCallback, useRef, useState } from 'react';
import { AgentBookingLookup } from '@/components/agent-booking-lookup';
import { QrCameraScanner } from '@/components/qr-camera-scanner';
import { SiteHeader } from '@/components/site-header';
import { getAccessToken } from '@/lib/api-client';
import { verifyTicketQr } from '@/lib/features-api';
import { extractQrToken } from '@/lib/qr-token';

type ScanResult = Record<string, unknown> & {
  valid?: boolean;
  result?: string;
  bookingReference?: string;
  routeName?: string;
  seats?: string[];
  contactName?: string;
  status?: string;
  boarded?: boolean;
  boardedAt?: string | null;
};

function resultLabel(result: ScanResult) {
  switch (result.result) {
    case 'BOARDED':
      return 'Passenger boarded';
    case 'ALREADY_BOARDED':
      return 'Already boarded';
    case 'VALID':
      return 'Valid ticket (verify only)';
    case 'NO_SHOW':
      return 'No-show booking';
    case 'INVALID_STATUS':
      return 'Invalid booking status';
    case 'NOT_FOUND':
      return 'Ticket not found';
    default:
      return result.valid ? 'Valid ticket' : 'Invalid ticket';
  }
}

function resultTone(result: ScanResult) {
  if (result.result === 'NO_SHOW' || result.result === 'NOT_FOUND' || result.valid === false) {
    return 'border-red-200 bg-red-50 text-red-800';
  }
  if (result.result === 'ALREADY_BOARDED' || result.result === 'BOARDED' || result.boarded) {
    return 'border-green-200 bg-green-50 text-green-900';
  }
  return 'border-blue-200 bg-blue-50 text-blue-900';
}

function ScanResultCard({ result }: { result: ScanResult }) {
  return (
    <div className={`rounded-lg border px-4 py-3 text-sm ${resultTone(result)}`}>
      <p className="font-semibold">{resultLabel(result)}</p>
      {typeof result.bookingReference === 'string' && (
        <p className="mt-1 font-mono">Ref: {result.bookingReference}</p>
      )}
      {typeof result.routeName === 'string' && <p>Route: {result.routeName}</p>}
      {Array.isArray(result.seats) && <p>Seats: {(result.seats as string[]).join(', ')}</p>}
      {typeof result.contactName === 'string' && <p>Passenger: {result.contactName}</p>}
      {typeof result.status === 'string' && (
        <p className="capitalize">Status: {result.status.replace(/_/g, ' ').toLowerCase()}</p>
      )}
      {result.boardedAt && (
        <p className="mt-1 text-xs">
          Boarded at{' '}
          {new Date(String(result.boardedAt)).toLocaleString('en-IN', {
            dateStyle: 'short',
            timeStyle: 'short',
          })}
        </p>
      )}
    </div>
  );
}

export default function AgentScanPage() {
  const [qrToken, setQrToken] = useState('');
  const [result, setResult] = useState<ScanResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [verifyOnly, setVerifyOnly] = useState(false);
  const [cameraPaused, setCameraPaused] = useState(false);
  const [showManual, setShowManual] = useState(false);
  const processingRef = useRef(false);
  const lastTokenRef = useRef('');

  const verifyToken = useCallback(
    async (rawToken: string, pauseCamera = true) => {
      const token = getAccessToken();
      if (!token) {
        setError('Please sign in as agent or admin');
        return;
      }

      const normalized = extractQrToken(rawToken);
      if (!normalized) return;

      setBusy(true);
      setError(null);
      setResult(null);
      if (pauseCamera) setCameraPaused(true);

      try {
        const data = (await verifyTicketQr(token, normalized, !verifyOnly)) as ScanResult;
        setResult(data);
        setQrToken(normalized);
        lastTokenRef.current = normalized;
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Scan failed');
        if (pauseCamera) setCameraPaused(false);
      } finally {
        setBusy(false);
      }
    },
    [verifyOnly],
  );

  const handleCameraScan = useCallback(
    (rawText: string) => {
      if (processingRef.current || busy || cameraPaused) return;

      const normalized = extractQrToken(rawText);
      if (!normalized || normalized === lastTokenRef.current) return;

      processingRef.current = true;
      void verifyToken(normalized, true).finally(() => {
        processingRef.current = false;
      });
    },
    [busy, cameraPaused, verifyToken],
  );

  async function onManualSubmit(e: FormEvent) {
    e.preventDefault();
    lastTokenRef.current = '';
    await verifyToken(qrToken, true);
  }

  function scanNextPassenger() {
    lastTokenRef.current = '';
    setResult(null);
    setError(null);
    setCameraPaused(false);
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <SiteHeader />
      <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
        <Link href="/agent" className="text-sm text-brand hover:underline">
          ← Agent portal
        </Link>
        <h1 className="mt-4 text-2xl font-bold text-charcoal">Scan &amp; board passengers</h1>
        <p className="mt-2 text-sm text-gray-600">
          Use your phone camera to scan the QR on the ticket PDF. Passengers are marked boarded automatically
          unless verify-only mode is on.
        </p>

        <div className="mt-8 card">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="font-semibold text-charcoal">Camera scan</h2>
            <label className="flex items-center gap-2 text-sm text-gray-600">
              <input
                type="checkbox"
                checked={verifyOnly}
                onChange={(e) => setVerifyOnly(e.target.checked)}
              />
              Verify only
            </label>
          </div>

          <div className="mt-4">
            <QrCameraScanner onScan={handleCameraScan} paused={cameraPaused || busy} />
          </div>

          {busy && (
            <p className="mt-3 text-center text-sm font-medium text-brand">Verifying ticket…</p>
          )}

          {error && <p className="mt-4 text-sm text-red-600">{error}</p>}

          {result && (
            <div className="mt-4 space-y-3">
              <ScanResultCard result={result} />
              <button type="button" className="btn-primary w-full sm:w-auto" onClick={scanNextPassenger}>
                Scan next passenger
              </button>
            </div>
          )}
        </div>

        <div className="mt-6 card">
          <button
            type="button"
            className="flex w-full items-center justify-between text-left font-semibold text-charcoal"
            onClick={() => setShowManual((open) => !open)}
          >
            Manual QR entry
            <span className="text-sm font-normal text-gray-500">{showManual ? 'Hide' : 'Show'}</span>
          </button>

          {showManual && (
            <form className="mt-4 space-y-3" onSubmit={onManualSubmit}>
              <textarea
                required
                rows={3}
                value={qrToken}
                onChange={(e) => setQrToken(e.target.value)}
                placeholder="Paste QR token if camera is unavailable"
                className="w-full rounded-lg border border-gray-200 px-3 py-2 font-mono text-sm"
              />
              <button type="submit" className="btn-primary w-full sm:w-auto" disabled={busy}>
                {busy ? 'Processing…' : verifyOnly ? 'Verify ticket' : 'Verify & mark boarded'}
              </button>
            </form>
          )}
        </div>

        <div className="mt-8">
          <AgentBookingLookup
            title="Lookup by booking reference"
            showBoardingActions
            showReprint={false}
          />
        </div>
      </div>
    </div>
  );
}
