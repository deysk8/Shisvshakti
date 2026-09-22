'use client';

import { formatInr } from '@/lib/seat-pricing';
import type { CheckoutSummary } from '@/lib/booking-session';

type Props = {
  summary: CheckoutSummary | null;
  className?: string;
};

export function BookingSummaryStrip({ summary, className = '' }: Props) {
  if (!summary) return null;

  const from = summary.fromCity ?? summary.boardingStopName ?? '—';
  const to = summary.toCity ?? summary.droppingStopName ?? '—';
  const seatCount = summary.seatIds?.length ?? summary.seatLabels?.length ?? 0;
  const labels =
    summary.seatLabels?.length > 0
      ? summary.seatLabels.join(', ')
      : seatCount
        ? `${seatCount} seat${seatCount === 1 ? '' : 's'}`
        : '—';
  const perSeat = summary.fare ?? 0;
  const total = summary.totalAmount ?? perSeat * seatCount;

  return (
    <div
      className={`border-b border-gray-100 bg-gray-50 px-4 py-3 text-sm text-gray-700 ${className}`}
    >
      <div className="mx-auto flex max-w-4xl flex-wrap items-center gap-x-4 gap-y-1">
        <span className="font-medium text-charcoal">
          {from} → {to}
        </span>
        {summary.date && <span>{summary.date}</span>}
        {summary.departureAt && (
          <span>
            {new Date(summary.departureAt).toLocaleTimeString('en-IN', {
              hour: '2-digit',
              minute: '2-digit',
            })}
          </span>
        )}
        <span>Seats {labels}</span>
        {perSeat > 0 && seatCount > 0 && (
          <span>
            {formatInr(perSeat)} × {seatCount} = <strong className="text-brand">{formatInr(total)}</strong>
          </span>
        )}
        {summary.bookingReference && (
          <span className="text-xs text-gray-500">Ref {summary.bookingReference}</span>
        )}
      </div>
    </div>
  );
}
