import {
  DEFAULT_FROM_CITY,
  DEFAULT_TO_CITY,
  LAUNCH_ROUTE_CODE,
  LAUNCH_ROUTE_DEPARTURE_TIME,
  LAUNCH_SERVICE_DATE,
} from '@shiva-sakti/shared';
import { fetchRouteByCode, formatMinutes } from '@/lib/routes-api';
import { LaunchRouteMap } from '@/components/launch-route-map';
import { FadeInUp, StaggerGrid, StaggerItem } from '@/components/motion';

const LAUNCH_ROUTE_CODE_LOCAL = LAUNCH_ROUTE_CODE;
export async function LaunchRouteSection() {
  const route = await fetchRouteByCode(LAUNCH_ROUTE_CODE_LOCAL);

  if (!route) {
    return (
      <section className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
        <div className="card border-dashed">
          <h2 className="text-lg font-semibold text-charcoal">Our service</h2>
          <p className="mt-2 text-sm text-gray-600">
            Jharsuguda → Bangalore will appear here once the API and database are running (
            <code className="text-xs">npm run prisma:seed</code>). Service starts {LAUNCH_SERVICE_DATE}.
          </p>        </div>
      </section>
    );
  }

  return (
    <section className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
      <FadeInUp>
        <h2 className="text-2xl font-bold text-charcoal">Jharsuguda → Bangalore</h2>
        <p className="mt-1 text-gray-600">
          {route.name} · daily from {LAUNCH_SERVICE_DATE}
        </p>      </FadeInUp>

      <FadeInUp delay={0.1} className="mt-6">
        <div className="card">
          <div className="flex flex-wrap gap-4 text-sm text-gray-600">
            {route.totalDistanceKm && <span>{route.totalDistanceKm} km</span>}
            {route.estimatedDurationMinutes != null && (
              <span>~{formatMinutes(route.estimatedDurationMinutes)}</span>
            )}
            <span className="font-medium text-brand">
              Daily departure {LAUNCH_ROUTE_DEPARTURE_TIME} from Jharsuguda
            </span>          </div>

          <StaggerGrid className="mt-6 space-y-4 border-l-2 border-brand/30 pl-6">
            {route.stops.map((stop, idx) => (
              <StaggerItem key={stop.sequence}>
                <div className="relative">
                  <span className="absolute -left-[1.65rem] flex h-6 w-6 items-center justify-center rounded-full bg-brand text-xs font-bold text-white shadow-sm">
                    {idx + 1}
                  </span>
                  <p className="font-semibold text-charcoal">{stop.name}</p>
                  <p className="text-sm text-gray-500">{stop.city}</p>
                  {idx > 0 && (
                    <p className="text-xs text-gray-400">
                      Arrival ~{formatMinutes(stop.arrivalOffsetMin)} from Jharsuguda                    </p>
                  )}
                </div>
              </StaggerItem>
            ))}
          </StaggerGrid>

          <LaunchRouteMap />
        </div>
      </FadeInUp>
    </section>
  );
}
