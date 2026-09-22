/**
 * Pre-launch smoke checks — run with API up: node scripts/go-live-check.mjs
 */
import { PrismaClient } from '@prisma/client';
import {
  DEFAULT_TIMEZONE,
  formatInServiceTimezone,
  LAUNCH_BUS_REGISTRATION,
  segmentTimeAt,
  tripDepartureAt,
} from '@shiva-sakti/shared';

const API = process.env.API_URL ?? 'http://localhost:4000/api/v1';
const prisma = new PrismaClient();

const failures = [];
const passes = [];

function pass(msg) {
  passes.push(msg);
  console.log('OK', msg);
}
function fail(msg) {
  failures.push(msg);
  console.error('FAIL', msg);
}

async function main() {
  // Health
  const health = await fetch(`${API}/health`).then((r) => r.json());
  if (health.status === 'ok' && health.database === 'up') pass('API health + database');
  else fail(`API health: ${JSON.stringify(health)}`);

  // Search tomorrow
  const searchRes = await fetch(
    `${API}/search/trips?fromCity=Jharsuguda&toCity=Bangalore&date=2026-09-23`,
  );
  if (!searchRes.ok) fail(`Search HTTP ${searchRes.status}`);
  else {
    const trips = await searchRes.json();
    if (trips.length === 1) pass('Search returns exactly 1 bus for tomorrow');
    else fail(`Search returned ${trips.length} buses (expected 1)`);

    if (trips[0]?.bus?.registrationNumber === LAUNCH_BUS_REGISTRATION) {
      pass(`Launch bus ${LAUNCH_BUS_REGISTRATION} in search`);
    } else {
      fail(`Wrong bus in search: ${trips[0]?.bus?.registrationNumber}`);
    }

    const depIst = formatInServiceTimezone(new Date(trips[0].segmentDepartureAt), {
      timeStyle: 'short',
    });
    if (depIst.includes('7:00') || depIst.includes('07:00')) {
      pass(`Segment departure shows 7:00 AM IST (${depIst})`);
    } else {
      fail(`Segment departure not 7:00 AM IST: ${depIst}`);
    }
  }

  // DB trip times
  const route = await prisma.route.findUnique({ where: { code: 'JRG-BLR' } });
  const tomorrow = new Date(Date.UTC(2026, 8, 23));
  const trip = await prisma.trip.findFirst({
    where: { routeId: route?.id, serviceDate: tomorrow, status: 'SCHEDULED' },
    include: { schedule: true, bus: true },
  });
  if (trip?.bus.registrationNumber === LAUNCH_BUS_REGISTRATION) {
    pass('DB has scheduled launch bus trip for tomorrow');
    const expected = tripDepartureAt(tomorrow, trip.schedule.departureTime);
    if (Math.abs(trip.departureAt.getTime() - expected.getTime()) < 1000) {
      pass('Trip departureAt matches IST schedule math');
    } else {
      fail(
        `Trip departure mismatch: got ${trip.departureAt.toISOString()} expected ${expected.toISOString()}`,
      );
    }
    const istLabel = formatInServiceTimezone(trip.departureAt, { timeStyle: 'short' });
    pass(`DB departure displays as ${istLabel} (${DEFAULT_TIMEZONE})`);
  } else {
    fail('No launch bus trip in DB for tomorrow');
  }

  // Public routes
  const routes = await fetch(`${API}/routes`).then((r) => r.json());
  if (Array.isArray(routes) && routes.some((r) => r.code === 'JRG-BLR')) pass('Public routes list JRG-BLR');
  else fail('JRG-BLR missing from public routes');

  console.log('\n--- Summary ---');
  console.log(`Passed: ${passes.length}`);
  console.log(`Failed: ${failures.length}`);
  if (failures.length) {
    process.exitCode = 1;
  }

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
