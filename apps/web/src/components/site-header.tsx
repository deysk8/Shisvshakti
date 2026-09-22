'use client';

import Image from 'next/image';
import Link from 'next/link';
import { ApiOfflineBanner } from '@/components/api-offline-banner';
import { LanguageSwitcher } from '@/components/language-switcher';
import { useI18n } from '@/lib/i18n';

export function SiteHeader() {
  const { t } = useI18n();

  return (
    <>
      <ApiOfflineBanner />
      <header className="sticky top-0 z-40 border-b border-gray-100 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3.5 sm:px-6 sm:py-4">
          <Link href="/" className="flex shrink-0 items-center gap-3">
            <Image
              src="/shiva-sakti-logo.png"
              alt="Shiv Shakti"
              width={280}
              height={84}
              className="h-14 w-auto object-contain sm:h-16 md:h-[4.5rem]"
              priority
            />
          </Link>
          <nav className="flex items-center gap-3 text-sm font-medium text-gray-600 sm:gap-5">
            <Link href="/search" className="nav-link">
              {t('search')}
            </Link>
            <Link href="/bookings" className="nav-link">
              {t('myBookings')}
            </Link>
            <Link href="/login?next=/agent" className="nav-link hidden sm:inline">
              {t('agentLogin')}
            </Link>
            <Link href="/login?next=/admin" className="nav-link hidden lg:inline">
              {t('admin')}
            </Link>
            <Link href="/login" className="nav-link">
              {t('login')}
            </Link>
            <Link href="/register" className="nav-link hidden sm:inline">
              {t('register')}
            </Link>
            <LanguageSwitcher />
          </nav>
        </div>
      </header>
    </>
  );
}
