'use client';

/**
 * Placeholder until Phase 8 (search). UI only — no fake API results.
 */
export function SearchFormPlaceholder() {
  return (
    <div className="card max-w-4xl">
      <form
        className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 lg:items-end"
        onSubmit={(e) => e.preventDefault()}
      >
        <label className="block text-sm font-medium text-gray-700">
          From
          <input
            type="text"
            placeholder="City or stop"
            className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2.5 text-charcoal outline-none ring-brand focus:ring-2"
            disabled
            aria-disabled
            title="Available after routes are seeded (Phase 8 search)"
          />
        </label>
        <label className="block text-sm font-medium text-gray-700">
          To
          <input
            type="text"
            placeholder="Destination"
            className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2.5 text-charcoal outline-none ring-brand focus:ring-2"
            disabled
            aria-disabled
          />
        </label>
        <label className="block text-sm font-medium text-gray-700">
          Date
          <input
            type="date"
            className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2.5 text-charcoal outline-none ring-brand focus:ring-2"
            disabled
            aria-disabled
          />
        </label>
        <button type="submit" className="btn-primary w-full opacity-60" disabled>
          Search Buses
        </button>
      </form>
      <p className="mt-3 text-xs text-gray-500">
        Search connects to the API after you run migrate + seed (Jharsuguda → Bangalore).
      </p>
    </div>
  );
}
