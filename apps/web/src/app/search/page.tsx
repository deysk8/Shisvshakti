'use client';

import { Suspense } from 'react';
import { SiteHeader } from '@/components/site-header';
import { CustomerShell } from '@/components/customer-shell';
import { SearchForm } from '@/components/search-form';
import { SearchResultsInner } from './search-results-inner';

export default function SearchResultsPage() {
  return (
    <CustomerShell>
      <SiteHeader />
      <div className="mx-auto max-w-4xl px-4 pt-8 sm:px-6">
        <Suspense fallback={<p className="text-sm text-gray-500">Loading search…</p>}>
          <SearchForm />
        </Suspense>
      </div>
      <Suspense fallback={<p className="p-10 text-center text-gray-500">Loading results…</p>}>
        <SearchResultsInner />
      </Suspense>
    </CustomerShell>
  );
}
