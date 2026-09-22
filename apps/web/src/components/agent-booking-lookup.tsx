'use client';

import { FormEvent, useState } from 'react';
import { getAccessToken } from '@/lib/api-client';
import {
  boardTicketReference,
  lookupTicketReference,
  markTicketNoShow,
} from '@/lib/features-api';
import { AgentTicketActions } from '@/components/agent-ticket-actions';

type LookupResult = {
  bookingReference: string;
  status: string;
  bookingSource?: string;
  contactName?: string | null;
  contactPhone?: string | null;
  totalAmount?: number;
  routeCode?: string;
  routeName?: string;
  departureAt?: string;
  seats?: string[];
  boardedAt?: string | null;
  message?: string;
};

type AgentBookingLookupProps = {
  title?: string;
  showBoardingActions?: boolean;
  showReprint?: boolean;
  initialReference?: string;
};

export function AgentBookingLookup({
  title = 'Lookup by reference',
  showBoardingActions = false,
  showReprint = true,
  initialReference = '',
}: AgentBookingLookupProps) {
  const [reference, setReference] = useState(initialReference);
  const [result, setResult] = useState<LookupResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<'lookup' | 'board' | 'no-show' | null>(null);

  async function runLookup(ref: string) {
    const token = getAccessToken();
    if (!token) {
      setError('Please sign in again');
      return;
    }
    setBusy('lookup');
    setError(null);
    try {
      const data = (await lookupTicketReference(token, ref)) as LookupResult;
      setResult(data);
    } catch (err) {
      setResult(null);
      setError(err instanceof Error ? err.message : 'Lookup failed');
    } finally {
      setBusy(null);
    }
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const ref = reference.trim();
    if (!ref) return;
    await runLookup(ref);
  }

  async function onBoard() {
    const token = getAccessToken();
    if (!token || !result) return;
    setBusy('board');
    setError(null);
    try {
      const data = (await boardTicketReference(token, result.bookingReference)) as LookupResult;
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not mark boarded');
    } finally {
      setBusy(null);
    }
  }

  async function onNoShow() {
    const token = getAccessToken();
    if (!token || !result) return;
    if (!window.confirm(`Mark ${result.bookingReference} as no-show?`)) return;
    setBusy('no-show');
    setError(null);
    try {
      const data = (await markTicketNoShow(token, result.bookingReference)) as LookupResult;
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not mark no-show');
    } finally {
      setBusy(null);
    }
  }

  const statusTone =
    result?.status === 'COMPLETED'
      ? 'border-green-200 bg-green-50 text-green-900'
      : result?.status === 'NO_SHOW'
        ? 'border-amber-200 bg-amber-50 text-amber-900'
        : result?.status === 'CONFIRMED'
          ? 'border-blue-200 bg-blue-50 text-blue-900'
          : 'border-gray-200 bg-white text-charcoal';

  return (
    <div className="card">
      <h2 className="font-semibold text-charcoal">{title}</h2>
      <form className="mt-4 flex flex-wrap gap-2" onSubmit={onSubmit}>
        <input
          type="text"
          value={reference}
          onChange={(e) => setReference(e.target.value.toUpperCase())}
          placeholder="Booking reference (e.g. SS-ABC123)"
          className="min-w-[220px] flex-1 rounded-lg border border-gray-200 px-3 py-2 font-mono text-sm uppercase"
        />
        <button type="submit" className="btn-primary" disabled={busy !== null}>
          {busy === 'lookup' ? 'Looking up…' : 'Lookup'}
        </button>
      </form>

      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

      {result && (
        <div className={`mt-4 rounded-lg border px-4 py-3 text-sm ${statusTone}`}>
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <p className="font-semibold">{result.bookingReference}</p>
              <p className="mt-1 capitalize">{result.status.replace(/_/g, ' ').toLowerCase()}</p>
              {result.message && <p className="mt-1 text-xs opacity-80">{result.message}</p>}
            </div>
            {result.boardedAt && (
              <p className="text-xs">
                Boarded{' '}
                {new Date(result.boardedAt).toLocaleString('en-IN', {
                  dateStyle: 'short',
                  timeStyle: 'short',
                })}
              </p>
            )}
          </div>
          <div className="mt-3 grid gap-1 text-xs sm:grid-cols-2">
            {result.contactName && <p>Passenger: {result.contactName}</p>}
            {result.contactPhone && <p>Phone: {result.contactPhone}</p>}
            {result.routeName && <p>Route: {result.routeName}</p>}
            {result.departureAt && (
              <p>
                Departure:{' '}
                {new Date(result.departureAt).toLocaleString('en-IN', {
                  dateStyle: 'medium',
                  timeStyle: 'short',
                })}
              </p>
            )}
            {result.seats?.length ? <p>Seats: {result.seats.join(', ')}</p> : null}
            {result.totalAmount != null && <p>Amount: ₹{result.totalAmount}</p>}
            {result.bookingSource && (
              <p>Type: {result.bookingSource.replace(/_/g, ' ').toLowerCase()}</p>
            )}
          </div>

          {showBoardingActions && result.status === 'CONFIRMED' && (
            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                className="rounded-lg bg-green-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-green-800 disabled:opacity-60"
                onClick={onBoard}
                disabled={busy !== null}
              >
                {busy === 'board' ? 'Marking…' : 'Mark boarded'}
              </button>
              <button
                type="button"
                className="rounded-lg border border-amber-600 bg-amber-50 px-3 py-1.5 text-xs font-medium text-amber-900 hover:bg-amber-100 disabled:opacity-60"
                onClick={onNoShow}
                disabled={busy !== null}
              >
                {busy === 'no-show' ? 'Updating…' : 'Mark no-show'}
              </button>
            </div>
          )}

          {showReprint && (result.status === 'CONFIRMED' || result.status === 'COMPLETED') && (
            <div className="mt-4 border-t border-black/10 pt-3">
              <p className="text-xs font-medium uppercase tracking-wide opacity-70">Reprint ticket</p>
              <AgentTicketActions
                reference={result.bookingReference}
                status={result.status}
                contactName={result.contactName}
                contactPhone={result.contactPhone}
                routeLabel={result.routeCode ?? result.routeName}
                totalAmount={result.totalAmount}
                departureAt={result.departureAt}
                seats={result.seats}
                layout="inline"
                className="mt-2"
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
