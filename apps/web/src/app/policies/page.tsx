import Link from 'next/link';
import { SiteHeader } from '@/components/site-header';
import { CustomerShell } from '@/components/customer-shell';

const POLICIES = [
  {
    title: 'Cancellation refunds',
    body:
      'Refund amount depends on how far before departure you cancel: 80% if more than 24 hours before, 50% between 12–24 hours, and no refund within 12 hours of departure.',
  },
  {
    title: 'Online payments',
    body:
      'Payments are processed securely via Cashfree. Approved refunds are returned to the original payment method within 5–7 business days.',
  },
  {
    title: 'One-time reschedule',
    body:
      'Confirmed bookings can be rescheduled once before departure on the same route segment. If the new fare is the same or lower, no extra payment is required.',
  },
  {
    title: 'Seat locks',
    body:
      'Selected seats are held for a limited time during checkout. Complete payment before the hold expires to confirm your booking.',
  },
];

export default function PoliciesPage() {
  return (
    <CustomerShell>
      <SiteHeader />
      <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
        <Link href="/" className="text-sm text-brand hover:underline">
          ← Home
        </Link>
        <h1 className="mt-4 text-3xl font-bold text-charcoal">Policies</h1>
        <p className="mt-2 text-sm text-gray-600">
          Shiv Shakti booking, payment, and cancellation terms for passengers and agents.
        </p>

        <div className="mt-8 space-y-4">
          {POLICIES.map((policy) => (
            <div key={policy.title} className="card">
              <h2 className="font-semibold text-charcoal">{policy.title}</h2>
              <p className="mt-2 text-sm text-gray-700">{policy.body}</p>
            </div>
          ))}
        </div>

        <p className="mt-8 text-sm text-gray-600">
          Questions? Visit our{' '}
          <Link href="/about" className="font-medium text-brand hover:underline">
            About & contact
          </Link>{' '}
          page or email support@shivasakti.in.
        </p>
      </div>
    </CustomerShell>
  );
}
