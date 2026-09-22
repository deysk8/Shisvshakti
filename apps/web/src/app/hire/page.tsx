'use client';

import { FormEvent, useState } from 'react';
import { SiteHeader } from '@/components/site-header';
import { SiteFooter } from '@/components/site-footer';
import { submitEnquiry } from '@/lib/public-api';

export default function HirePage() {
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setStatus(null);
    const form = new FormData(e.currentTarget);
    try {
      const result = await submitEnquiry({
        name: String(form.get('name')),
        email: String(form.get('email') || ''),
        mobile: String(form.get('mobile')),
        enquiryType: String(form.get('enquiryType')),
        fromCity: String(form.get('fromCity') || ''),
        toCity: String(form.get('toCity') || ''),
        seats: form.get('seats') ? Number(form.get('seats')) : undefined,
        busType: String(form.get('busType') || ''),
        message: String(form.get('message') || ''),
      });
      setStatus(result.message);
      e.currentTarget.reset();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not submit enquiry');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-white">
      <SiteHeader />
      <main className="mx-auto max-w-lg flex-1 px-4 py-10 sm:px-6">
        <h1 className="text-2xl font-bold text-charcoal">Bus hire & packages</h1>
        <p className="mt-2 text-sm text-gray-600">
          Charter a bus for weddings, tours, or corporate travel. We will call you back.
        </p>

        <form className="mt-8 space-y-4" onSubmit={onSubmit}>
          <label className="block text-sm font-medium">
            Name *
            <input name="name" required className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2" />
          </label>
          <label className="block text-sm font-medium">
            Mobile *
            <input name="mobile" required className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2" />
          </label>
          <label className="block text-sm font-medium">
            Email
            <input name="email" type="email" className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2" />
          </label>
          <label className="block text-sm font-medium">
            Type *
            <select name="enquiryType" required className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2">
              <option value="Bus Hire">Bus hire</option>
              <option value="Car Hire">Car hire</option>
              <option value="Tour Package">Tour package</option>
            </select>
          </label>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block text-sm font-medium">
              From
              <input name="fromCity" className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2" />
            </label>
            <label className="block text-sm font-medium">
              To
              <input name="toCity" className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2" />
            </label>
          </div>
          <label className="block text-sm font-medium">
            No. of seats
            <input name="seats" type="number" min={1} className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2" />
          </label>
          <label className="block text-sm font-medium">
            Bus type
            <select name="busType" className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2">
              <option value="AC">AC</option>
              <option value="Non-AC">Non-AC</option>
              <option value="AC and Non-AC">AC and Non-AC</option>
            </select>
          </label>
          <label className="block text-sm font-medium">
            Message
            <textarea name="message" rows={4} className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2" />
          </label>
          <button type="submit" className="btn-primary w-full" disabled={loading}>
            {loading ? 'Sending…' : 'Submit enquiry'}
          </button>
        </form>

        {status && <p className="mt-4 text-sm text-green-700">{status}</p>}
        {error && <p className="mt-4 text-sm text-red-600">{error}</p>}
      </main>
      <SiteFooter />
    </div>
  );
}
