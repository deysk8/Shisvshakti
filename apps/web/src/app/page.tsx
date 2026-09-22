import { Suspense } from 'react';
import { LaunchRouteSection } from '@/components/launch-route-section';
import { HomeMarketingSections } from '@/components/home-marketing';
import { HomeHero } from '@/components/home-hero';
import { SiteHeader } from '@/components/site-header';
import { SiteFooter } from '@/components/site-footer';

export default function HomePage() {
  return (
    <div className="flex min-h-screen flex-col bg-white">
      <SiteHeader />

      <main className="flex-1">
        <HomeHero />
        <LaunchRouteSection />
        <HomeMarketingSections />
      </main>

      <SiteFooter />
    </div>
  );
}
