'use client';

import Image from 'next/image';
import { Suspense } from 'react';
import {
  COMPANY_LEGAL_NAME,
  DEFAULT_FROM_CITY,
  DEFAULT_TO_CITY,
  LAUNCH_SERVICE_DATE,
} from '@shiva-sakti/shared';
import { HeroMotion } from '@/components/motion';
import { SearchForm } from '@/components/search-form';

export function HomeHero() {
  return (
    <section className="relative overflow-hidden bg-gradient-to-b from-brand-light/80 to-white px-4 pb-10 pt-12 sm:px-6 sm:pt-16">
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
        <div className="absolute -left-16 top-10 h-64 w-64 rounded-full bg-brand/10" />
        <div className="absolute -right-20 top-32 h-72 w-72 rounded-full bg-brand-deep/10" />
      </div>

      <div className="relative mx-auto max-w-6xl">
        <div className="flex flex-col gap-8 lg:flex-row lg:items-center lg:justify-between lg:gap-12">
          <div className="min-w-0 flex-1 lg:max-w-xl">
            <HeroMotion delay={50}>
              <p className="mb-3 text-sm font-medium uppercase tracking-wider text-brand-deep">
                Quick book — {COMPANY_LEGAL_NAME}
              </p>
            </HeroMotion>
            <HeroMotion delay={120}>
              <h1 className="text-4xl font-bold leading-tight text-charcoal sm:text-5xl">
                Reasonable tickets.{' '}
                <span className="bg-gradient-to-r from-brand to-brand-deep bg-clip-text text-transparent">
                  Comfortable journeys.
                </span>
              </h1>
            </HeroMotion>
            <HeroMotion delay={190}>
              <p className="mt-4 text-lg text-gray-600">
                Search buses, pick your seat, pay online or at an agent counter — {DEFAULT_FROM_CITY} to{' '}
                {DEFAULT_TO_CITY}, starting {LAUNCH_SERVICE_DATE}.
              </p>
            </HeroMotion>
          </div>

          <HeroMotion delay={160} className="flex shrink-0 justify-center lg:justify-end">
            <Image
              src="/shiva-sakti-logo.png"
              alt="Shiv Shakti"
              width={560}
              height={168}
              className="h-28 w-auto object-contain drop-shadow-sm sm:h-32 md:h-36 lg:h-40"
              priority
            />
          </HeroMotion>
        </div>

        <HeroMotion delay={260} className="mt-8 lg:mt-10">
          <Suspense fallback={<p className="text-sm text-gray-500">Loading search…</p>}>
            <SearchForm />
          </Suspense>
        </HeroMotion>
      </div>
    </section>
  );
}
