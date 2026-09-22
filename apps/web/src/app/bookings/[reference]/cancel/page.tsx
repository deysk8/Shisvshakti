'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { SiteHeader } from '@/components/site-header';
import { getAccessToken } from '@/lib/api-client';
import {
  cancelBooking,
  fetchCancellationPolicies,
  fetchCancellationPreview,
  type CancellationPolicy,
  type CancellationPreview,
} from '@/lib/bookings-api';

export default function CancelBookingPage() {
  const { reference } = useParams<{ reference: string }>();
  const router = useRouter();
  const [preview, setPreview] = useState<CancellationPreview | null>(null);
  const [policies, setPolicies] = useState<CancellationPolicy[]>([]);
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState<{ refundAmount: number; refundStatus: string } | null>(null);

  useEffect(() => {
    if (!reference) return;

    const token = getAccessToken();
    if (!token) {
      router.replace(`/login?next=/bookings/${encodeURIComponent(reference)}/cancel`);
      return;
    }

    Promise.all([
      fetchCancellationPreview(token, reference),
      fetchCancellationPolicies(),
    ])
      .then(([previewData, policyList]) => {
        setPreview(previewData);
        setPolicies(policyList);
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Could not load booking'))
      .finally(() => setLoading(false));
  }, [reference, router]);

  async function handleCancel() {
    const token = getAccessToken();
    if (!token || !preview?.canCancel || !reference) return;

    if (!window.confirm('Cancel this booking? This cannot be undone.')) return;

    setSubmitting(true);
    setError(null);
    try {
      const result = await cancelBooking(token, reference, reason.trim() || undefined);
      setDone({ refundAmount: result.refundAmount, refundStatus: result.refundStatus });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Cancellation failed');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-white">
      <SiteHeader />
      <div className="mx-auto max-w-lg px-4 py-8 sm:px-6">
        <Link href="/bookings" className="text-sm text-brand hover:text-brand-deep">
          ← My bookings
        </Link>
        <h1 className="mt-4 text-2xl font-bold text-charcoal">Cancel booking</h1>
        <p className="mt-1 text-sm text-gray-600">Reference: {reference}</p>

        {loading && <p className="mt-8 text-sm text-gray-500">Loading…</p>}
        {error && <p className="mt-6 text-sm text-red-600">{error}</p>}

        {done && (
          <div className="mt-6 card space-y-3 text-sm text-gray-700">
            <p className="font-medium text-charcoal">Booking cancelled</p>
            {done.refundAmount > 0 ? (
              <p>
                Refund of <strong>₹{done.refundAmount.toFixed(2)}</strong> ({done.refundStatus})
              </p>
            ) : (
              <p>No refund applies for this cancellation.</p>
            )}
            <Link href="/bookings" className="btn-primary inline-flex">
              Back to my bookings
            </Link>
          </div>
        )}

        {!loading && preview && !done && (
          <div className="mt-6 space-y-6">
            <div className="card space-y-2 text-sm text-gray-700">
              <p>
                <span className="font-medium text-charcoal">Status:</span> {preview.status}
              </p>
              <p>
                <span className="font-medium text-charcoal">Departure:</span>{' '}
                {new Date(preview.departureAt).toLocaleString('en-IN')}
              </p>
              <p>
                <span className="font-medium text-charcoal">Time until departure:</span>{' '}
                {preview.hoursBeforeDeparture.toFixed(1)} hours
              </p>
              <p>
                <span className="font-medium text-charcoal">Paid amount:</span> ₹
                {preview.totalAmount.toFixed(2)}
              </p>
              {preview.policy ? (
                <p className="rounded-lg border border-brand/20 bg-brand-light/20 px-3 py-2">
                  <strong>{preview.policy.name}</strong> — {preview.policy.refundPercent}% refund →{' '}
                  <strong>₹{preview.refundAmount.toFixed(2)}</strong>
                </p>
              ) : (
                <p className="text-amber-800">No refund policy applies.</p>
              )}
            </div>

            {policies.length > 0 && (
              <div className="rounded-xl border border-gray-100 bg-gray-50 px-4 py-3 text-xs text-gray-600">
                <p className="mb-2 font-medium text-charcoal">Cancellation policy</p>
                <ul className="space-y-1">
                  {policies.map((policy) => (
                    <li key={policy.id}>
                      {policy.name}: {policy.refundPercent}% refund (
                      {policy.maxHoursBeforeDeparture == null
                        ? `${policy.minHoursBeforeDeparture}+ hours before`
                        : `${policy.minHoursBeforeDeparture}–${policy.maxHoursBeforeDeparture} hours before`}
                      )
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {!preview.canCancel && (
              <p className="text-sm text-red-600">
                This booking cannot be cancelled (already departed or not eligible).
              </p>
            )}

            {preview.canCancel && (
              <>
                <label className="block text-sm">
                  <span className="font-medium text-charcoal">Reason (optional)</span>
                  <textarea
                    className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                    rows={3}
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder="Change of plans"
                  />
                </label>
                <button
                  type="button"
                  className="w-full rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-100 disabled:opacity-50"
                  onClick={handleCancel}
                  disabled={submitting}
                >
                  {submitting ? 'Cancelling…' : 'Confirm cancellation'}
                </button>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
