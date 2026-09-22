import { PrismaClient, TripStatus } from '@prisma/client';
import {
  citiesMatch,
  LAUNCH_BUS_REGISTRATION,
  LAUNCH_ROUTE_CODE,
  LAUNCH_ROUTE_DEPARTURE_TIME,
  LAUNCH_SERVICE_DATE,
  parseIsoDateOnly,
} from '@shiva-sakti/shared';
import { FleetService } from '../fleet/fleet.service';
import { PrismaService } from '../prisma/prisma.service';
import { RouteStopInput, RoutesService } from '../routes/routes.service';
import { SchedulesService } from '../schedules/schedules.service';

const ROUTE_CODE = LAUNCH_ROUTE_CODE;
const LAUNCH_BASE_FARE = 1400;

const LAUNCH_ROUTE_STOPS: RouteStopInput[] = [
  {
    stopName: 'Jharsuguda Junction',
    city: 'Jharsuguda',
    state: 'Odisha',
    sequence: 1,
    arrivalOffsetMin: 0,
    departureOffsetMin: 0,
    distanceFromOriginKm: 0,
    latitude: 21.855,
    longitude: 84.006,
  },
  {
    stopName: 'Bangalore Kalasipalyam',
    city: 'Bangalore',
    state: 'Karnataka',
    sequence: 2,
    arrivalOffsetMin: 960,
    departureOffsetMin: 960,
    distanceFromOriginKm: 1520,
    latitude: 12.953,
    longitude: 77.574,
  },
];

async function repairLaunchRouteIfNeeded(
  prisma: PrismaClient,
  routes: RoutesService,
  routeId: string,
) {
  const route = await prisma.route.findUnique({
    where: { id: routeId },
    include: {
      routeStops: { include: { stop: true }, orderBy: { sequence: 'asc' } },
      fareRules: { where: { isActive: true } },
    },
  });
  if (!route) return;

  const launchFare = route.fareRules.find((f) => f.fromSequence === 1 && f.toSequence === 2);
  const stopsValid =
    route.routeStops.length === 2 &&
    citiesMatch(route.routeStops[0].stop.city ?? '', 'Jharsuguda') &&
    citiesMatch(route.routeStops[1].stop.city ?? '', 'Bangalore') &&
    route.routeStops[0].sequence === 1 &&
    route.routeStops[1].sequence === 2;
  const fareValid = Number(launchFare?.amount ?? 0) === LAUNCH_BASE_FARE;

  if (stopsValid && fareValid) return;

  const bookingCount = await prisma.booking.count({
    where: {
      trip: { routeId },
      status: {
        in: ['CONFIRMED', 'PENDING_PAYMENT', 'SEATS_LOCKED', 'COMPLETED'],
      },
    },
  });

  if (bookingCount > 0) {
    const lastStop = route.routeStops[route.routeStops.length - 1];
    if (!citiesMatch(lastStop.stop.city ?? '', 'Bangalore')) {
      await prisma.stop.update({
        where: { id: lastStop.stopId },
        data: { city: 'Bangalore' },
      });
      console.log('Launch route city name fixed (existing bookings)');
    }
    return;
  }

  console.log('Repairing launch route stops and fares for', ROUTE_CODE);
  await routes.updateRouteAdmin(routeId, {
    name: 'Jharsuguda – Bangalore',
    isActive: true,
    baseFare: LAUNCH_BASE_FARE,
    segmentFares: { '1-2': LAUNCH_BASE_FARE },
    stops: LAUNCH_ROUTE_STOPS,
  });
}

async function ensureSingleLaunchSchedule(
  prisma: PrismaClient,
  schedules: SchedulesService,
  routeId: string,
  launchBusId: string,
) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const activeSchedules = await prisma.schedule.findMany({
    where: { routeId, isActive: true },
    include: { bus: true },
  });

  for (const schedule of activeSchedules) {
    if (schedule.busId === launchBusId) continue;

    await schedules.deactivateSchedule(schedule.id);
    await prisma.trip.updateMany({
      where: {
        scheduleId: schedule.id,
        serviceDate: { gte: today },
        status: TripStatus.SCHEDULED,
      },
      data: { status: TripStatus.CANCELLED },
    });
    console.log(
      `Removed extra schedule on ${ROUTE_CODE} for bus ${schedule.bus.registrationNumber}`,
    );
  }

  let launchSchedule = await prisma.schedule.findFirst({
    where: { routeId, busId: launchBusId, isActive: true },
  });
  if (!launchSchedule) {
    const prior = await prisma.schedule.findFirst({
      where: { routeId, busId: launchBusId },
      orderBy: { createdAt: 'desc' },
    });
    if (prior) {
      await schedules.activateSchedule(prior.id);
      launchSchedule = prior;
      console.log(`Reactivated launch schedule for bus on ${ROUTE_CODE}`);
    }
  }
  const serviceStart = parseIsoDateOnly(LAUNCH_SERVICE_DATE);

  if (launchSchedule) {
    const [hours, minutes] = LAUNCH_ROUTE_DEPARTURE_TIME.split(':').map(Number);
    await prisma.schedule.update({
      where: { id: launchSchedule.id },
      data: {
        baseFare: LAUNCH_BASE_FARE,
        effectiveFrom: serviceStart,
        departureTime: new Date(Date.UTC(1970, 0, 1, hours, minutes, 0)),
        isActive: true,
      },
    });
  }

  await prisma.trip.updateMany({
    where: {
      routeId,
      serviceDate: { lt: serviceStart },
      status: TripStatus.SCHEDULED,
    },
    data: { status: TripStatus.CANCELLED },
  });
}

/**
 * Launch service: Jharsuguda → Bangalore, first bookable departure from LAUNCH_SERVICE_DATE.
 */
export async function seedFirstBus(prisma: PrismaClient) {
  const prismaService = prisma as unknown as PrismaService;
  const fleet = new FleetService(prismaService);
  const routes = new RoutesService(prismaService);
  const schedules = new SchedulesService(
    prismaService,
    {} as import('../cancellations/cancellations.service').CancellationsService,
    {} as import('../partner/partner-webhooks.service').PartnerWebhooksService,
  );

  let bus = await prisma.bus.findFirst({
    where: { registrationNumber: LAUNCH_BUS_REGISTRATION },
  });
  if (!bus) {
    let busType = await prisma.busType.findFirst({
      where: { name: 'Shiv Shakti Dual Deck AC' },
    });
    if (!busType) {
      busType = await fleet.createBusTypeDualDeck('Shiv Shakti Dual Deck AC', {
        ac: true,
        charging: true,
        readingLight: true,
      });
    }
    bus = await fleet.createBus({
      registrationNumber: LAUNCH_BUS_REGISTRATION,
      name: 'shivshakti F1',
      busTypeId: busType.id,
    });
    console.log('Launch bus created:', LAUNCH_BUS_REGISTRATION);
  } else if (bus.status !== 'ACTIVE') {
    await prisma.bus.update({
      where: { id: bus.id },
      data: { status: 'ACTIVE' },
    });
  }

  let route = await prisma.route.findUnique({ where: { code: ROUTE_CODE } });
  if (!route) {
    route = await routes.createRouteWithStops({
      code: ROUTE_CODE,
      name: 'Jharsuguda – Bangalore',
      baseFare: LAUNCH_BASE_FARE,
      segmentFares: {
        '1-2': LAUNCH_BASE_FARE,
      },
      stops: LAUNCH_ROUTE_STOPS,
    });
    console.log('Launch route seeded:', route.name);
  } else {
    await repairLaunchRouteIfNeeded(prisma, routes, route.id);
    await prisma.route.update({
      where: { id: route.id },
      data: { isActive: true, name: 'Jharsuguda – Bangalore' },
    });
    console.log('Launch route already seeded:', ROUTE_CODE);
  }

  let existingSchedule = await prisma.schedule.findFirst({
    where: { routeId: route.id, busId: bus.id },
    orderBy: { createdAt: 'desc' },
  });

  await ensureSingleLaunchSchedule(prisma, schedules, route.id, bus.id);

  existingSchedule = await prisma.schedule.findFirst({
    where: { routeId: route.id, busId: bus.id, isActive: true },
  });

  if (!existingSchedule) {
    existingSchedule = await schedules.createSchedule({
      routeId: route.id,
      busId: bus.id,
      departureTime: LAUNCH_ROUTE_DEPARTURE_TIME,
      baseFare: LAUNCH_BASE_FARE,
      daysAhead: 90,
      effectiveFrom: LAUNCH_SERVICE_DATE,
    });
    console.log('Launch schedule created for', LAUNCH_BUS_REGISTRATION);
  } else {
    await schedules.generateTrips(existingSchedule.id, 90);
    await prisma.trip.updateMany({
      where: {
        scheduleId: existingSchedule.id,
        serviceDate: { gte: parseIsoDateOnly(LAUNCH_SERVICE_DATE) },
        status: TripStatus.CANCELLED,
      },
      data: { status: TripStatus.SCHEDULED },
    });
    console.log('Launch schedule trips refreshed for', LAUNCH_BUS_REGISTRATION);
  }

  return route;
}
