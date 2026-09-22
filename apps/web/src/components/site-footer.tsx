import Link from 'next/link';
import { COMPANY_LEGAL_NAME } from '@shiva-sakti/shared';

export function SiteFooter() {
  return (
    <footer className="border-t border-gray-200 bg-charcoal text-gray-300">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-12 sm:grid-cols-2 lg:grid-cols-4 sm:px-6">
        <div>
          <p className="font-semibold text-white">{COMPANY_LEGAL_NAME}</p>
          <p className="mt-2 text-sm">Premium intercity bus travel in Odisha.</p>
        </div>
        <div>
          <p className="font-medium text-white">Book</p>
          <ul className="mt-2 space-y-1 text-sm">
            <li>
              <Link href="/search" className="hover:text-brand">
                Search buses
              </Link>
            </li>
            <li>
              <Link href="/bookings" className="hover:text-brand">
                My bookings
              </Link>
            </li>
            <li>
              <Link href="/login?next=/agent" className="hover:text-brand">
                Agent login
              </Link>
            </li>
            <li>
              <Link href="/login?next=/admin" className="hover:text-brand">
                Admin login
              </Link>
            </li>
          </ul>
        </div>
        <div>
          <p className="font-medium text-white">Company</p>
          <ul className="mt-2 space-y-1 text-sm">
            <li>
              <Link href="/hire" className="hover:text-brand">
                Bus hire
              </Link>
            </li>
            <li>
              <Link href="/about" className="hover:text-brand">
                About us
              </Link>
            </li>
          </ul>
        </div>
        <div>
          <p className="font-medium text-white">Policies</p>
          <ul className="mt-2 space-y-1 text-sm">
            <li>
              <Link href="/policies" className="hover:text-brand">
                Cancellation & refunds
              </Link>
            </li>
            <li>Secure Cashfree payments</li>
          </ul>
        </div>
      </div>
      <p className="border-t border-gray-700 py-4 text-center text-xs">
        © {new Date().getFullYear()} {COMPANY_LEGAL_NAME}. All rights reserved.
      </p>
    </footer>
  );
}
