import Link from 'next/link';
import { SiteHeader } from '@/components/site-header';
import { CustomerShell } from '@/components/customer-shell';
import { fetchPublicCompany } from '@/lib/public-api';

export default async function AboutPage() {
  const company = await fetchPublicCompany();

  return (
    <CustomerShell>
      <SiteHeader />
      <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
        <Link href="/" className="text-sm text-brand hover:underline">
          ← Home
        </Link>
        <h1 className="mt-4 text-3xl font-bold text-charcoal">
          About {company?.displayName ?? 'Shiv Shakti'}
        </h1>
        <p className="mt-4 text-gray-700">
          Shiv Shakti is building a modern bus travel experience — online booking, digital
          tickets, agent counters, and live tracking on our routes.
          Passenger comfort, punctuality, and safety come first on every trip.
        </p>

        <div className="mt-8 grid gap-4 sm:grid-cols-3">
          <div className="card text-center">
            <p className="text-2xl font-bold text-brand">{company?.stats.buses ?? '—'}</p>
            <p className="mt-1 text-sm text-gray-600">Buses in fleet</p>
          </div>
          <div className="card text-center">
            <p className="text-2xl font-bold text-brand">{company?.stats.routes ?? '—'}</p>
            <p className="mt-1 text-sm text-gray-600">Active routes</p>
          </div>
          <div className="card text-center">
            <p className="text-2xl font-bold text-brand">{company?.stats.happyBookings ?? '—'}</p>
            <p className="mt-1 text-sm text-gray-600">Happy bookings</p>
          </div>
        </div>

        <h2 className="mt-10 text-xl font-semibold text-charcoal">Why travel with us</h2>
        <ul className="mt-4 space-y-2 text-sm text-gray-700">
          <li>Punctual, courteous service on every departure</li>
          <li>Transparent segment fares and cancellation policy</li>
          <li>Agent network across Odisha for walk-in bookings</li>
          <li>Digital tickets with PDF download and email confirmation</li>
          <li>One free reschedule before departure on confirmed bookings</li>
        </ul>

        <h2 className="mt-10 text-xl font-semibold text-charcoal">Contact</h2>
        <p className="mt-3 text-sm text-gray-700">
          Phone:{' '}
          <a href={`tel:${company?.supportPhone ?? ''}`} className="font-medium text-brand">
            {company?.supportPhone ?? '+91 94370 12345'}
          </a>
          <br />
          Email:{' '}
          <a href={`mailto:${company?.supportEmail ?? ''}`} className="font-medium text-brand">
            {company?.supportEmail ?? 'support@shivasakti.in'}
          </a>
        </p>

        <div className="mt-10 flex flex-wrap gap-3">
          <Link href="/search" className="btn-primary">
            Search buses
          </Link>
          <Link href="/policies" className="rounded-lg border border-gray-200 px-4 py-2 text-sm hover:border-brand">
            Cancellation & refund policy
          </Link>
        </div>
      </div>
    </CustomerShell>
  );
}
