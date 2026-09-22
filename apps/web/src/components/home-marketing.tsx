import Link from 'next/link';
import type { ReactNode } from 'react';
import { FadeInUp, StaggerGrid, StaggerItem } from '@/components/motion';
import { fetchPublicCompany, fetchTestimonials, type PublicCompany, type Testimonial } from '@/lib/public-api';
import {
  IconAc,
  IconAffordable,
  IconBadge,
  IconBadgeSoft,
  IconBusBooking,
  IconCharging,
  IconChild,
  IconClean,
  IconDestinations,
  IconLight,
  IconLiveTrack,
  IconLoyalty,
  IconOnTime,
  IconReschedule,
  IconSecurePay,
  IconSenior,
  IconSupport,
  IconTrust,
} from '@/components/marketing-icons';

const FEATURES: { title: string; body: string; icon: ReactNode; accent: string }[] = [
  {
    title: 'Online bus booking',
    body: 'Search, select seats, and pay securely in minutes.',
    icon: <IconBusBooking className="h-6 w-6" />,
    accent: 'from-orange-50 to-white',
  },
  {
    title: 'Secure payments',
    body: 'Cashfree online pay or cash at agent counters.',
    icon: <IconSecurePay className="h-6 w-6" />,
    accent: 'from-amber-50 to-white',
  },
  {
    title: 'Live bus tracking',
    body: 'Track your bus along the route before departure.',
    icon: <IconLiveTrack className="h-6 w-6" />,
    accent: 'from-orange-50/80 to-white',
  },
  {
    title: 'Customer support',
    body: 'Call or email us for booking help and cancellations.',
    icon: <IconSupport className="h-6 w-6" />,
    accent: 'from-stone-50 to-white',
  },
];

const WHY_ITEMS: { title: string; body: string; icon: ReactNode }[] = [
  {
    title: 'Affordable prices',
    body: 'Fair fares on Jharsuguda–Bangalore — our launch route.',
    icon: <IconAffordable className="h-7 w-7" />,
  },
  {
    title: 'Best destinations',
    body: 'Daily service from Jharsuguda to Bangalore from 22 Sep 2026.',
    icon: <IconDestinations className="h-7 w-7" />,
  },
  {
    title: 'Trust & safety',
    body: 'Experienced drivers, verified tickets, and agent support.',
    icon: <IconTrust className="h-7 w-7" />,
  },
];

const AMENITIES: { label: string; icon: ReactNode }[] = [
  { label: 'AC Seater', icon: <IconAc className="h-5 w-5" /> },
  { label: 'Mobile charging', icon: <IconCharging className="h-5 w-5" /> },
  { label: 'Reading light', icon: <IconLight className="h-5 w-5" /> },
  { label: 'On-time service', icon: <IconOnTime className="h-5 w-5" /> },
  { label: 'Live tracking', icon: <IconLiveTrack className="h-5 w-5" /> },
  { label: 'Clean coaches', icon: <IconClean className="h-5 w-5" /> },
];

const SPECIAL_FEATURES: { title: string; body: string; icon: ReactNode }[] = [
  {
    title: 'One-time reschedule',
    body: 'Move your trip once before departure (same passenger details).',
    icon: <IconReschedule className="h-6 w-6" />,
  },
  {
    title: 'Senior citizen discount',
    body: '10% off when booking as a senior citizen.',
    icon: <IconSenior className="h-6 w-6" />,
  },
  {
    title: 'Child discount',
    body: '25% off when a passenger is 11 years or younger.',
    icon: <IconChild className="h-6 w-6" />,
  },
  {
    title: 'Loyalty points',
    body: 'Earn 1 point for every ₹100 spent on confirmed bookings.',
    icon: <IconLoyalty className="h-6 w-6" />,
  },
];

export async function HomeMarketingSections() {
  const [company, testimonials] = await Promise.all([fetchPublicCompany(), fetchTestimonials()]);
  const stats = company?.stats ?? { buses: 1, routes: 1, happyBookings: 0 };

  return (
    <>
      <section className="border-y border-gray-100 bg-white py-12">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <FadeInUp>
            <p className="text-center text-sm font-medium uppercase tracking-wider text-brand-deep">
              How it works
            </p>
          </FadeInUp>
          <StaggerGrid className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {FEATURES.map((item) => (
              <StaggerItem key={item.title}>
                <div
                  className={`group relative h-full overflow-hidden rounded-2xl border border-gray-100 bg-gradient-to-br ${item.accent} p-5 transition-[border-color,box-shadow] duration-300 hover:border-brand/30 hover:shadow-md`}
                >
                  <div className="absolute -right-3 -top-3 h-20 w-20 rounded-full bg-brand/5" />
                  <IconBadge className="relative">{item.icon}</IconBadge>
                  <h3 className="relative mt-4 font-semibold text-charcoal">{item.title}</h3>
                  <p className="relative mt-2 text-sm leading-relaxed text-gray-600">{item.body}</p>
                </div>
              </StaggerItem>
            ))}
          </StaggerGrid>
        </div>
      </section>

      <StatsSection company={company} stats={stats} />

      <section className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
        <FadeInUp>
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-sm font-medium uppercase tracking-wider text-brand-deep">Our promise</p>
              <h2 className="mt-1 text-2xl font-bold text-charcoal">Why Shiv Shakti?</h2>
            </div>
            <div className="hidden h-1 w-24 rounded-full bg-gradient-to-r from-brand to-brand-deep sm:block" />
          </div>
        </FadeInUp>
        <StaggerGrid className="mt-8 grid gap-5 sm:grid-cols-3">
          {WHY_ITEMS.map((item, index) => (
            <StaggerItem key={item.title}>
              <div className="card relative h-full overflow-hidden border-brand/10 p-6 hover:border-brand/25">
                <span className="absolute right-4 top-4 text-5xl font-bold text-brand/10">{index + 1}</span>
                <IconBadgeSoft>{item.icon}</IconBadgeSoft>
                <h3 className="mt-4 font-semibold text-charcoal">{item.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-gray-600">{item.body}</p>
              </div>
            </StaggerItem>
          ))}
        </StaggerGrid>
      </section>

      <section className="bg-brand-light/20 py-14">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <FadeInUp>
            <div className="flex flex-wrap items-center gap-4">
              <IconBadgeSoft className="h-14 w-14">
                <IconAc className="h-7 w-7" />
              </IconBadgeSoft>
              <div>
                <h2 className="text-2xl font-bold text-charcoal">Amenities</h2>
                <p className="mt-1 text-sm text-gray-600">Comfort built into every coach on the route</p>
              </div>
            </div>
          </FadeInUp>
          <StaggerGrid className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {AMENITIES.map((item) => (
              <StaggerItem key={item.label}>
                <div className="flex items-center gap-3 rounded-xl border border-gray-100 bg-gradient-to-br from-orange-50 to-white px-4 py-3 shadow-sm transition-[border-color,box-shadow] duration-300 hover:border-brand/25 hover:shadow-md">
                  <IconBadgeSoft className="h-10 w-10">{item.icon}</IconBadgeSoft>
                  <span className="text-sm font-medium text-charcoal">{item.label}</span>
                </div>
              </StaggerItem>
            ))}
          </StaggerGrid>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
        <FadeInUp>
          <div className="rounded-2xl border border-brand/15 bg-gradient-to-br from-brand-light/40 via-white to-white p-6 sm:p-8">
            <p className="text-sm font-medium uppercase tracking-wider text-brand-deep">Passenger perks</p>
            <h2 className="mt-1 text-2xl font-bold text-charcoal">Our special features</h2>
            <StaggerGrid className="mt-8 grid gap-4 sm:grid-cols-2">
              {SPECIAL_FEATURES.map((item) => (
                <StaggerItem key={item.title}>
                  <div className="flex h-full gap-4 rounded-xl border border-gray-100 bg-white p-5 shadow-sm transition-[border-color,box-shadow] duration-300 hover:border-brand/25 hover:shadow-md">
                    <IconBadge className="h-11 w-11 rounded-xl">{item.icon}</IconBadge>
                    <div>
                      <h3 className="font-semibold text-charcoal">{item.title}</h3>
                      <p className="mt-1.5 text-sm leading-relaxed text-gray-600">{item.body}</p>
                    </div>
                  </div>
                </StaggerItem>
              ))}
            </StaggerGrid>
          </div>
        </FadeInUp>
      </section>

      <TestimonialsSection testimonials={testimonials} />

      <GallerySection />

      <AboutSection company={company} />

      <SupportSection company={company} />
    </>
  );
}

function StatsSection({
  company,
  stats,
}: {
  company: PublicCompany | null;
  stats: { buses: number; routes: number; happyBookings: number };
}) {
  return (
    <section className="bg-charcoal py-12 text-white">
      <div className="mx-auto grid max-w-6xl gap-6 px-4 sm:grid-cols-3 sm:px-6">
        {[
          { value: stats.buses, label: 'Buses', hint: 'Comfortable AC fleet' },
          { value: stats.routes, label: 'Routes', hint: 'Jharsuguda–Bangalore service' },
          { value: Math.max(stats.happyBookings, 0), label: 'Bookings', hint: 'Confirmed tickets' },
        ].map((item) => (
          <div key={item.label} className="text-center">
            <p className="text-3xl font-bold text-brand">{item.value}+</p>
            <p className="mt-1 font-medium">{item.label}</p>
            <p className="text-sm text-gray-300">{item.hint}</p>
          </div>
        ))}
      </div>
      {company && (
        <p className="mt-6 text-center text-sm text-gray-400">{company.displayName} — safe & on-time travel</p>
      )}
    </section>
  );
}

function TestimonialsSection({ testimonials }: { testimonials: Testimonial[] }) {
  return (
    <section className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
      <FadeInUp>
        <h2 className="text-2xl font-bold text-charcoal">What passengers say</h2>
      </FadeInUp>
      <StaggerGrid className="mt-6 grid gap-4 md:grid-cols-3">
        {testimonials.map((item) => (
          <StaggerItem key={item.name}>
            <blockquote className="card h-full">
              <p className="text-sm text-gray-700">&ldquo;{item.quote}&rdquo;</p>
              <footer className="mt-4 text-sm font-medium text-charcoal">
                {item.name} · {item.city}
              </footer>
            </blockquote>
          </StaggerItem>
        ))}
      </StaggerGrid>
    </section>
  );
}

function GallerySection() {
  const slides = ['Premium AC coach', 'Comfortable 2+2 seating', 'Clean interiors', 'On-board charging'];
  return (
    <section className="bg-gray-50 py-14">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <FadeInUp>
          <h2 className="text-2xl font-bold text-charcoal">Our fleet</h2>
          <p className="mt-1 text-sm text-gray-600">Modern buses built for long-distance travel</p>
        </FadeInUp>
        <StaggerGrid className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {slides.map((title) => (
            <StaggerItem key={title}>
              <div className="flex h-36 items-end overflow-hidden rounded-xl bg-gradient-to-br from-brand/80 to-brand-deep p-4 text-white transition-[box-shadow] duration-300 hover:shadow-lg">
                <span className="text-sm font-medium">{title}</span>
              </div>
            </StaggerItem>
          ))}
        </StaggerGrid>
      </div>
    </section>
  );
}

function AboutSection({ company }: { company: PublicCompany | null }) {
  return (
    <section id="about" className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
      <h2 className="text-2xl font-bold text-charcoal">About {company?.displayName ?? 'Shiv Shakti'}</h2>
      <p className="mt-4 max-w-3xl text-gray-700">
        Shiv Shakti is building a modern bus travel experience — online booking, digital tickets,
        agent counters, and live tracking on our routes. Passenger comfort,
        punctuality, and safety come first on every trip.
      </p>
      <ul className="mt-4 list-inside list-disc text-sm text-gray-600">
        <li>Punctual, courteous service</li>
        <li>Transparent fares and cancellation policy</li>
        <li>Agent network for walk-in bookings</li>
      </ul>
    </section>
  );
}

function SupportSection({ company }: { company: PublicCompany | null }) {
  return (
    <section className="border-t border-gray-100 bg-brand-light/30 py-10">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-4 sm:px-6">
        <div>
          <h2 className="text-lg font-semibold text-charcoal">Need help booking?</h2>
          <p className="mt-1 text-sm text-gray-600">Our team is ready to assist customers and agents.</p>
        </div>
        <div className="text-sm text-gray-700">
          <p>
            <strong>Phone:</strong>{' '}
            <a href={`tel:${company?.supportPhone ?? ''}`} className="text-brand">
              {company?.supportPhone ?? '+91 94370 12345'}
            </a>
          </p>
          <p className="mt-1">
            <strong>Email:</strong>{' '}
            <a href={`mailto:${company?.supportEmail ?? ''}`} className="text-brand">
              {company?.supportEmail ?? 'support@shivasakti.in'}
            </a>
          </p>
          <Link href="/hire" className="mt-3 inline-block text-brand hover:underline">
            Bus hire / charter enquiry →
          </Link>
        </div>
      </div>
    </section>
  );
}
