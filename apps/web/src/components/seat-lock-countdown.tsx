'use client';

import Link from 'next/link';

type Props = {
  countdownLabel: string;
  secondsLeft: number;
  expired: boolean;
  backHref?: string;
  className?: string;
};

export function SeatLockCountdown({ countdownLabel, secondsLeft, expired, backHref, className = '' }: Props) {
  if (expired) {
    return (
      <div className={`rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 ${className}`}>
        <p>Your seat hold has expired.</p>
        {backHref && (
          <Link href={backHref} className="mt-2 inline-block font-medium text-brand hover:underline">
            Select seats again
          </Link>
        )}
      </div>
    );
  }

  const urgent = secondsLeft <= 120;

  return (
    <div
      className={`rounded-lg border px-4 py-3 text-sm ${
        urgent
          ? 'border-amber-300 bg-amber-50 text-amber-900'
          : 'border-brand/20 bg-brand-light/30 text-charcoal'
      } ${className}`}
    >
      Seats held for <strong>{countdownLabel}</strong>
      {urgent && ' — complete checkout soon'}
    </div>
  );
}
