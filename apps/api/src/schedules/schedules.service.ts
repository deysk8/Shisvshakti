import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { BookingStatus, DayOfWeek, TripStatus } from '@prisma/client';
import {
  startOfTodayInServiceTimezone,
  toUtcDateOnly,
  tripArrivalAt,
  tripDepartureAt,
} from '@shiva-sakti/shared';
import { CancellationsService } from '../cancellations/cancellations.service';
import { PartnerWebhooksService } from '../partner/partner-webhooks.service';
import { PrismaService } from '../prisma/prisma.service';

const ALL_DAYS: DayOfWeek[] = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'];

@Injectable()
export class SchedulesService {
  constructor(
    private prisma: PrismaService,
    private cancellations: CancellationsService,
    private partnerWebhooks: PartnerWebhooksService,
  ) {}

  async createSchedule(input: {
    routeId: string;
    busId: string;
    departureTime: string;
    baseFare: number;
    operatingDays?: DayOfWeek[];
    daysAhead?: number;
    effectiveFrom?: string | Date;
  }) {
    const [hours, minutes] = input.departureTime.split(':').map(Number);
    const departureTime = new Date(Date.UTC(1970, 0, 1, hours, minutes, 0));

    const route = await this.prisma.route.findUniqueOrThrow({ where: { id: input.routeId } });

    const existingActive = await this.prisma.schedule.findFirst({
      where: { routeId: input.routeId, isActive: true },
      include: { bus: true },
    });
    if (existingActive && existingActive.busId !== input.busId) {
      throw new BadRequestException(
        `Route ${route.code} already has bus ${existingActive.bus.registrationNumber} scheduled. Use Assign bus on the route page to switch buses instead of adding another schedule.`,
      );
    }

    const effectiveFrom = toUtcDateOnly(
      typeof input.effectiveFrom === 'string'
        ? new Date(input.effectiveFrom)
        : (input.effectiveFrom ?? new Date()),
    );

    const schedule = await this.prisma.schedule.create({
      data: {
        routeId: input.routeId,
        busId: input.busId,
        departureTime,
        baseFare: input.baseFare,
        effectiveFrom,
        operatingDays: {
          create: (input.operatingDays ?? ALL_DAYS).map((dayOfWeek) => ({ dayOfWeek })),
        },
      },
      include: { operatingDays: true, bus: true, route: true },
    });

    await this.generateTrips(schedule.id, input.daysAhead ?? 45);

    return schedule;
  }

  async generateTrips(scheduleId: string, daysAhead: number) {
    const schedule = await this.prisma.schedule.findUniqueOrThrow({
      where: { id: scheduleId },
      include: { operatingDays: true, route: true, bus: true },
    });

    const operating = new Set(schedule.operatingDays.map((d) => d.dayOfWeek));
    const dayMap: DayOfWeek[] = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
    const today = startOfTodayInServiceTimezone();
    const effectiveFrom = toUtcDateOnly(schedule.effectiveFrom);
    const serviceStart = effectiveFrom > today ? effectiveFrom : today;

    const seatCount = await this.prisma.busSeat.count({
      where: { busId: schedule.busId, isActive: true },
    });

    for (let i = 0; i <= daysAhead; i++) {
      const serviceDate = new Date(serviceStart);
      serviceDate.setUTCDate(serviceStart.getUTCDate() + i);
      const dow = dayMap[serviceDate.getUTCDay()];
      if (!operating.has(dow)) continue;

      const dep = tripDepartureAt(serviceDate, schedule.departureTime);
      const arr = tripArrivalAt(dep, schedule.route.estimatedDurationMinutes ?? 0);

      await this.prisma.trip.upsert({
        where: {
          scheduleId_serviceDate: {
            scheduleId: schedule.id,
            serviceDate,
          },
        },
        create: {
          scheduleId: schedule.id,
          serviceDate,
          busId: schedule.busId,
          routeId: schedule.routeId,
          departureAt: dep,
          arrivalAt: arr,
          status: TripStatus.SCHEDULED,
          availableSeatsCache: seatCount,
        },
        update: {
          departureAt: dep,
          arrivalAt: arr,
          availableSeatsCache: seatCount,
        },
      });
    }
  }

  listSchedules() {
    return this.prisma.schedule.findMany({
      where: { isActive: true },
      include: {
        route: { include: { originStop: true, destinationStop: true } },
        bus: true,
        operatingDays: true,
      },
    });
  }

  deactivateSchedule(id: string) {
    return this.prisma.schedule.update({ where: { id }, data: { isActive: false } });
  }

  activateSchedule(id: string) {
    return this.prisma.schedule.update({
      where: { id },
      data: { isActive: true },
      include: { bus: true, route: true, operatingDays: true },
    });
  }

  async assignBusToRoute(input: {
    routeId: string;
    busId: string;
    departureTime: string;
    baseFare: number;
    daysAhead?: number;
  }) {
    const route = await this.prisma.route.findUniqueOrThrow({ where: { id: input.routeId } });
    const bus = await this.prisma.bus.findUniqueOrThrow({ where: { id: input.busId } });
    if (bus.status !== 'ACTIVE') {
      throw new BadRequestException('Selected bus is not active — change fleet status first');
    }

    const conflict = await this.prisma.schedule.findFirst({
      where: {
        busId: input.busId,
        isActive: true,
        routeId: { not: input.routeId },
      },
      include: { route: { select: { code: true, name: true } } },
    });
    if (conflict) {
      throw new BadRequestException(
        `Bus ${bus.registrationNumber} is already assigned to active route ${conflict.route.code}`,
      );
    }

    const activeSchedule = await this.prisma.schedule.findFirst({
      where: { routeId: input.routeId, isActive: true },
    });

    if (activeSchedule) {
      if (activeSchedule.busId === input.busId) {
        return this.reactivateSchedule(activeSchedule.id, input);
      }
      return this.reassignScheduleBus(activeSchedule.id, input.busId);
    }

    const priorSchedule = await this.prisma.schedule.findFirst({
      where: { routeId: input.routeId, busId: input.busId },
      orderBy: { createdAt: 'desc' },
    });
    if (priorSchedule) {
      if (!route.isActive) {
        await this.prisma.route.update({
          where: { id: input.routeId },
          data: { isActive: true },
        });
      }
      return this.reactivateSchedule(priorSchedule.id, input);
    }

    if (!route.isActive) {
      await this.prisma.route.update({
        where: { id: input.routeId },
        data: { isActive: true },
      });
    }

    return this.createSchedule({
      routeId: input.routeId,
      busId: input.busId,
      departureTime: input.departureTime,
      baseFare: input.baseFare,
      daysAhead: input.daysAhead,
    });
  }

  private async reactivateSchedule(
    scheduleId: string,
    input: { departureTime: string; baseFare: number; daysAhead?: number; busId?: string },
  ) {
    const [hours, minutes] = input.departureTime.split(':').map(Number);
    const departureTime = new Date(Date.UTC(1970, 0, 1, hours, minutes, 0));

    const existing = await this.prisma.schedule.findUniqueOrThrow({
      where: { id: scheduleId },
      include: { bus: true, route: true, operatingDays: true },
    });

    const updated = await this.prisma.schedule.update({
      where: { id: scheduleId },
      data: {
        isActive: true,
        departureTime,
        baseFare: input.baseFare,
      },
      include: { bus: true, route: true, operatingDays: true },
    });

    await this.restoreFutureTrips(scheduleId, existing.busId);
    await this.generateTrips(scheduleId, input.daysAhead ?? 45);
    return updated;
  }

  private async restoreFutureTrips(scheduleId: string, busId: string) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const seatCount = await this.prisma.busSeat.count({
      where: { busId, isActive: true },
    });

    await this.prisma.trip.updateMany({
      where: {
        scheduleId,
        serviceDate: { gte: today },
        status: TripStatus.CANCELLED,
        bookings: {
          none: {
            status: { in: ['CONFIRMED', 'PENDING_PAYMENT', 'SEATS_LOCKED'] },
          },
        },
      },
      data: {
        status: TripStatus.SCHEDULED,
        busId,
        availableSeatsCache: seatCount,
      },
    });
  }

  async reassignScheduleBus(scheduleId: string, busId: string) {
    const schedule = await this.prisma.schedule.findUniqueOrThrow({
      where: { id: scheduleId },
      include: { route: true },
    });
    const bus = await this.prisma.bus.findUniqueOrThrow({ where: { id: busId } });
    if (bus.status !== 'ACTIVE') {
      throw new BadRequestException('Selected bus is not active — change fleet status first');
    }

    const conflict = await this.prisma.schedule.findFirst({
      where: {
        id: { not: scheduleId },
        busId,
        isActive: true,
        routeId: { not: schedule.routeId },
      },
    });
    if (conflict) {
      throw new BadRequestException(
        `Bus ${bus.registrationNumber} is already assigned to another active route`,
      );
    }

    const seatCount = await this.prisma.busSeat.count({
      where: { busId, isActive: true },
    });

    const updated = await this.prisma.schedule.update({
      where: { id: scheduleId },
      data: { busId, isActive: true },
      include: { bus: true, route: true, operatingDays: true },
    });

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    await this.prisma.trip.updateMany({
      where: {
        scheduleId,
        serviceDate: { gte: today },
        status: TripStatus.SCHEDULED,
        bookings: {
          none: {
            status: { in: ['CONFIRMED', 'PENDING_PAYMENT', 'SEATS_LOCKED'] },
          },
        },
      },
      data: {
        busId,
        availableSeatsCache: seatCount,
      },
    });

    await this.restoreFutureTrips(scheduleId, busId);
    await this.generateTrips(scheduleId, 45);
    return updated;
  }

  async updateRouteSchedule(input: {
    routeId: string;
    departureTime?: string;
    baseFare?: number;
    busId?: string;
    daysAhead?: number;
  }) {
    const schedule = await this.prisma.schedule.findFirst({
      where: { routeId: input.routeId, isActive: true },
    });

    if (!schedule) {
      if (!input.busId || !input.departureTime) {
        return null;
      }
      const baseFare =
        input.baseFare ?? (await this.resolveDefaultBaseFareViaPrisma(input.routeId));
      return this.assignBusToRoute({
        routeId: input.routeId,
        busId: input.busId,
        departureTime: input.departureTime,
        baseFare,
        daysAhead: input.daysAhead,
      });
    }

    const data: { departureTime?: Date; baseFare?: number; busId?: string } = {};
    if (input.departureTime) {
      const [hours, minutes] = input.departureTime.split(':').map(Number);
      data.departureTime = new Date(Date.UTC(1970, 0, 1, hours, minutes, 0));
    }
    if (input.baseFare != null) {
      data.baseFare = input.baseFare;
    }

    let updated = schedule;
    if (input.busId && input.busId !== schedule.busId) {
      updated = await this.reassignScheduleBus(schedule.id, input.busId);
    } else if (Object.keys(data).length) {
      updated = await this.prisma.schedule.update({
        where: { id: schedule.id },
        data,
      });
    }

    if (input.departureTime || input.baseFare != null) {
      await this.refreshScheduleTrips(schedule.id);
    }

    return updated;
  }

  private async resolveDefaultBaseFareViaPrisma(routeId: string) {
    const route = await this.prisma.route.findUniqueOrThrow({
      where: { id: routeId },
      include: { routeStops: { orderBy: { sequence: 'asc' } } },
    });
    const first = route.routeStops[0]?.sequence;
    const last = route.routeStops[route.routeStops.length - 1]?.sequence;
    const fare = await this.prisma.fareRule.findFirst({
      where: { routeId, fromSequence: first, toSequence: last, isActive: true },
    });
    if (!fare) {
      throw new BadRequestException('Set a full-route fare before assigning a bus');
    }
    return Number(fare.amount);
  }

  private async refreshScheduleTrips(scheduleId: string) {
    const schedule = await this.prisma.schedule.findUniqueOrThrow({
      where: { id: scheduleId },
      include: { route: true },
    });
    const today = startOfTodayInServiceTimezone();
    const trips = await this.prisma.trip.findMany({
      where: {
        scheduleId,
        serviceDate: { gte: today },
        status: TripStatus.SCHEDULED,
      },
    });

    for (const trip of trips) {
      const serviceDate = toUtcDateOnly(trip.serviceDate);
      const dep = tripDepartureAt(serviceDate, schedule.departureTime);
      const arr = tripArrivalAt(dep, schedule.route.estimatedDurationMinutes ?? 0);
      await this.prisma.trip.update({
        where: { id: trip.id },
        data: {
          departureAt: dep,
          arrivalAt: arr,
        },
      });
    }

    await this.generateTrips(scheduleId, 45);
  }

  listUpcomingTrips(days = 14) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const end = new Date(today);
    end.setDate(end.getDate() + days);

    return this.prisma.trip.findMany({
      where: {
        serviceDate: { gte: today, lte: end },
        status: { in: [TripStatus.SCHEDULED, TripStatus.BOARDING, TripStatus.CANCELLED] },
      },
      orderBy: [{ serviceDate: 'asc' }, { departureAt: 'asc' }],
      include: {
        route: { select: { id: true, name: true, code: true } },
        bus: { select: { name: true, registrationNumber: true } },
        schedule: { select: { baseFare: true } },
        _count: {
          select: {
            bookings: {
              where: {
                status: {
                  in: [
                    BookingStatus.CONFIRMED,
                    BookingStatus.PENDING_PAYMENT,
                    BookingStatus.SEATS_LOCKED,
                  ],
                },
              },
            },
          },
        },
      },
      take: 150,
    });
  }

  async cancelTrip(tripId: string, reason?: string, refundPassengers = true) {
    return this.cancelTripInternal(tripId, reason, refundPassengers);
  }

  async cancelRouteForDate(
    routeId: string,
    serviceDateInput: string,
    reason?: string,
    refundPassengers = true,
  ) {
    await this.prisma.route.findUniqueOrThrow({ where: { id: routeId } });
    const serviceDate = this.parseServiceDate(serviceDateInput);

    const trips = await this.prisma.trip.findMany({
      where: {
        routeId,
        serviceDate,
        status: { in: [TripStatus.SCHEDULED, TripStatus.BOARDING] },
      },
      orderBy: { departureAt: 'asc' },
    });

    if (!trips.length) {
      throw new NotFoundException('No scheduled trips found for this route on that date');
    }

    const cancelled = [];
    for (const trip of trips) {
      cancelled.push(await this.cancelTripInternal(trip.id, reason, refundPassengers));
    }

    return {
      routeId,
      serviceDate: serviceDate.toISOString().slice(0, 10),
      cancelledCount: cancelled.length,
      trips: cancelled,
    };
  }

  private parseServiceDate(dateInput: string) {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateInput.trim());
    if (!match) {
      throw new BadRequestException('serviceDate must be YYYY-MM-DD');
    }
    const year = Number(match[1]);
    const month = Number(match[2]) - 1;
    const day = Number(match[3]);
    const parsed = new Date(year, month, day);
    if (
      parsed.getFullYear() !== year ||
      parsed.getMonth() !== month ||
      parsed.getDate() !== day
    ) {
      throw new BadRequestException('Invalid serviceDate');
    }
    parsed.setHours(0, 0, 0, 0);
    return parsed;
  }

  private async cancelTripInternal(tripId: string, reason?: string, refundPassengers = true) {
    const trip = await this.prisma.trip.findUnique({
      where: { id: tripId },
      include: {
        route: { select: { code: true, name: true } },
        bus: { select: { registrationNumber: true, name: true } },
        bookings: {
          where: {
            status: {
              in: [
                BookingStatus.CONFIRMED,
                BookingStatus.PENDING_PAYMENT,
                BookingStatus.SEATS_LOCKED,
              ],
            },
          },
          select: { id: true, bookingReference: true, status: true },
        },
      },
    });

    if (!trip) {
      throw new NotFoundException('Trip not found');
    }
    if (trip.status === TripStatus.CANCELLED) {
      return {
        tripId: trip.id,
        alreadyCancelled: true,
        routeCode: trip.route.code,
        serviceDate: trip.serviceDate.toISOString().slice(0, 10),
        activeBookings: trip.bookings.length,
        refundedBookings: 0,
      };
    }
    if (trip.status === TripStatus.COMPLETED || trip.status === TripStatus.IN_TRANSIT) {
      throw new BadRequestException(`Cannot cancel trip with status ${trip.status}`);
    }

    const cancelReason =
      reason?.trim() ||
      `Service cancelled for ${trip.route.code} on ${trip.serviceDate.toISOString().slice(0, 10)}`;

    const bookingResults = [];
    if (refundPassengers) {
      for (const booking of trip.bookings) {
        bookingResults.push(await this.cancellations.operatorCancelBooking(booking.id, cancelReason));
      }
    } else if (trip.bookings.length > 0) {
      throw new BadRequestException(
        `Trip has ${trip.bookings.length} active booking(s). Enable passenger refund/cancel or handle bookings first.`,
      );
    }

    await this.prisma.trip.update({
      where: { id: trip.id },
      data: { status: TripStatus.CANCELLED },
    });

    this.partnerWebhooks.notifyTripCancelled(trip.id, cancelReason);

    return {
      tripId: trip.id,
      alreadyCancelled: false,
      routeCode: trip.route.code,
      routeName: trip.route.name,
      busNumber: trip.bus.registrationNumber,
      serviceDate: trip.serviceDate.toISOString().slice(0, 10),
      departureAt: trip.departureAt.toISOString(),
      activeBookings: trip.bookings.length,
      refundedBookings: bookingResults.filter((row) => !row.skipped).length,
      reason: cancelReason,
    };
  }

  async restoreTrip(tripId: string) {
    return this.restoreTripInternal(tripId);
  }

  async restoreRouteForDate(routeId: string, serviceDateInput: string) {
    await this.prisma.route.findUniqueOrThrow({ where: { id: routeId } });
    const serviceDate = this.parseServiceDate(serviceDateInput);

    const trips = await this.prisma.trip.findMany({
      where: {
        routeId,
        serviceDate,
        status: TripStatus.CANCELLED,
      },
      orderBy: { departureAt: 'asc' },
    });

    if (!trips.length) {
      throw new NotFoundException('No cancelled trips found for this route on that date');
    }

    const restored = [];
    for (const trip of trips) {
      restored.push(await this.restoreTripInternal(trip.id));
    }

    return {
      routeId,
      serviceDate: serviceDate.toISOString().slice(0, 10),
      restoredCount: restored.length,
      trips: restored,
    };
  }

  private async restoreTripInternal(tripId: string) {
    const trip = await this.prisma.trip.findUnique({
      where: { id: tripId },
      include: {
        route: { select: { code: true, name: true, isActive: true } },
        bus: { select: { registrationNumber: true, name: true, status: true } },
        schedule: { select: { isActive: true } },
      },
    });

    if (!trip) {
      throw new NotFoundException('Trip not found');
    }
    if (trip.status !== TripStatus.CANCELLED) {
      throw new BadRequestException('Only cancelled trips can be restored');
    }
    if (trip.departureAt.getTime() <= Date.now()) {
      throw new BadRequestException('Cannot restore a trip that has already departed');
    }
    if (!trip.schedule.isActive) {
      throw new BadRequestException('Schedule is inactive — reactivate the route schedule first');
    }
    if (!trip.route.isActive) {
      throw new BadRequestException('Route is stopped — start the route first');
    }
    if (trip.bus.status !== 'ACTIVE') {
      throw new BadRequestException('Bus is not active in fleet');
    }

    const availableSeats = await this.countAvailableSeats(trip.id, trip.busId);

    await this.prisma.trip.update({
      where: { id: trip.id },
      data: {
        status: TripStatus.SCHEDULED,
        availableSeatsCache: availableSeats,
      },
    });

    return {
      tripId: trip.id,
      routeCode: trip.route.code,
      routeName: trip.route.name,
      busNumber: trip.bus.registrationNumber,
      serviceDate: trip.serviceDate.toISOString().slice(0, 10),
      departureAt: trip.departureAt.toISOString(),
      availableSeats,
      note:
        'Trip is bookable again. Previously cancelled passenger bookings are not restored automatically.',
    };
  }

  private async countAvailableSeats(tripId: string, busId: string) {
    const totalSeats = await this.prisma.busSeat.count({
      where: { busId, isActive: true },
    });
    const occupied = await this.prisma.bookingSeat.count({
      where: {
        tripId,
        occupancyStatus: 'OCCUPIED',
        booking: {
          status: {
            in: [
              BookingStatus.CONFIRMED,
              BookingStatus.PENDING_PAYMENT,
              BookingStatus.SEATS_LOCKED,
            ],
          },
        },
      },
    });
    return Math.max(0, totalSeats - occupied);
  }
}
