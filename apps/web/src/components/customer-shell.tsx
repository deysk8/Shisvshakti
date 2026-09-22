import Link from 'next/link';
import { SiteFooter } from '@/components/site-footer';

export function CustomerShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-white">
      <div className="flex-1">{children}</div>
      <SiteFooter />
    </div>
  );
}

export function PayNowLink({
  bookingId,
  className = 'btn-primary inline-block',
}: {
  bookingId: string;
  className?: string;
}) {
  return (
    <Link href={`/book/payment?bookingId=${encodeURIComponent(bookingId)}`} className={className}>
      Complete payment
    </Link>
  );
}
