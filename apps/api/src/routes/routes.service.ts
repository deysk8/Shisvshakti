import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { TripStatus } from '@prisma/client';
import {
  startOfTodayInServiceTimezone,
  toUtcDateOnly,
  tripArrivalAt,
  tripDepartureAt,
} from '@shiva-sakti/shared';
import { PrismaService } from '../prisma/prisma.service';
export type RouteStopInput = {
  stopName: string;
  city: string;
  state?: string;
  sequence: number;
  arrivalOffsetMin: number;
  departureOffsetMin: number;
  distanceFromOriginKm: number;
  latitude?: number;
  longitude?: number;
};
@Injectable()
export class RoutesService {
  constructor(private prisma: PrismaService) {}

  async upsertStop(data: {
    name: string;
    city: string;
    state?: string;
    latitude?: number;
    longitude?: number;
  }) {
    const existing = await this.prisma.stop.findFirst({
      where: { name: data.name, city: data.city },
    });
    if (existing) {
      return this.prisma.stop.update({
        where: { id: existing.id },
        data: {
          latitude: data.latitude,
          longitude: data.longitude,
          state: data.state ?? 'Odisha',
        },
      });
    }
    return this.prisma.stop.create({
      data: {
        name: data.name,
        city: data.city,
        state: data.state ?? 'Odisha',
        latitude: data.latitude,
        longitude: data.longitude,
      },
    });
  }

  async createRouteWithStops(input: {
    code: string;
    name: string;
    stops: RouteStopInput[];
    segmentFares?: Record<string, number>;
    baseFare: number;
  }) {
    if (input.stops.length < 2) {
      throw new Error('Route needs at least two stops');
    }

    const sorted = [...input.stops].sort((a, b) => a.sequence - b.sequence);
    const stopRecords = await Promise.all(
      sorted.map((s) =>
        this.upsertStop({
          name: s.stopName,
          city: s.city,
          state: s.state,
          latitude: s.latitude,
          longitude: s.longitude,
        }),
      ),
    );

    const origin = stopRecords[0];
    const destination = stopRecords[stopRecords.length - 1];
    const totalDistance = sorted[sorted.length - 1].distanceFromOriginKm;
    const durationMin = sorted[sorted.length - 1].arrivalOffsetMin;

    const route = await this.prisma.route.upsert({
      where: { code: input.code },
      create: {
        code: input.code,
        name: input.name,
        originStopId: origin.id,
        destinationStopId: destination.id,
        totalDistanceKm: totalDistance,
        estimatedDurationMinutes: durationMin,
        routeStops: {
          create: sorted.map((s, idx) => ({
            stopId: stopRecords[idx].id,
            sequence: s.sequence,
            arrivalOffsetMin: s.arrivalOffsetMin,
            departureOffsetMin: s.departureOffsetMin,
            distanceFromOriginKm: s.distanceFromOriginKm,
          })),
        },
      },
      update: {
        name: input.name,
        totalDistanceKm: totalDistance,
        estimatedDurationMinutes: durationMin,
      },
      include: {
        routeStops: { include: { stop: true }, orderBy: { sequence: 'asc' } },
      },
    });

    await this.syncFareRules(route.id, sorted, input.segmentFares, input.baseFare);

    return this.getRouteById(route.id);
  }

  async createRouteAdmin(input: {
    code: string;
    name: string;
    stops: RouteStopInput[];
    segmentFares?: Record<string, number>;
    baseFare: number;
    isActive?: boolean;
  }) {
    const code = input.code.trim().toUpperCase();
    const existing = await this.prisma.route.findUnique({ where: { code } });
    if (existing) {
      throw new ConflictException(`Route code ${code} already exists`);
    }
    if (input.stops.length < 2) {
      throw new BadRequestException('Route needs at least two stops');
    }

    const sorted = [...input.stops].sort((a, b) => a.sequence - b.sequence);
    const sequences = sorted.map((s) => s.sequence);
    if (new Set(sequences).size !== sequences.length) {
      throw new BadRequestException('Each stop must have a unique sequence number');
    }

    const stopRecords = await Promise.all(
      sorted.map((s) =>
        this.upsertStop({
          name: s.stopName,
          city: s.city,
          state: s.state,
          latitude: s.latitude,
          longitude: s.longitude,
        }),
      ),
    );

    const origin = stopRecords[0];
    const destination = stopRecords[stopRecords.length - 1];
    const totalDistance = sorted[sorted.length - 1].distanceFromOriginKm;
    const durationMin = sorted[sorted.length - 1].arrivalOffsetMin;

    const route = await this.prisma.route.create({
      data: {
        code,
        name: input.name.trim(),
        originStopId: origin.id,
        destinationStopId: destination.id,
        totalDistanceKm: totalDistance,
        estimatedDurationMinutes: durationMin,
        isActive: input.isActive ?? true,
        routeStops: {
          create: sorted.map((s, idx) => ({
            stopId: stopRecords[idx].id,
            sequence: s.sequence,
            arrivalOffsetMin: s.arrivalOffsetMin,
            departureOffsetMin: s.departureOffsetMin,
            distanceFromOriginKm: s.distanceFromOriginKm,
          })),
        },
      },
    });

    await this.syncFareRules(route.id, sorted, input.segmentFares, input.baseFare);

    return this.getRouteById(route.id);
  }

  async updateRouteAdmin(
    routeId: string,
    input: {
      name?: string;
      isActive?: boolean;
      baseFare?: number;
      stops?: RouteStopInput[];
      segmentFares?: Record<string, number>;
    },
  ) {
    const route = await this.prisma.route.findUnique({
      where: { id: routeId },
      include: { routeStops: { orderBy: { sequence: 'asc' } } },
    });
    if (!route) {
      throw new NotFoundException('Route not found');
    }

    if (input.name != null) {
      await this.prisma.route.update({
        where: { id: routeId },
        data: { name: input.name.trim() },
      });
    }

    if (input.isActive != null && input.isActive !== route.isActive) {
      await this.setRouteActive(routeId, input.isActive);
    }

    if (input.stops?.length) {
      await this.applyRouteStops(routeId, input.stops);
    }

    if (input.baseFare != null || input.segmentFares) {
      const routeWithStops = await this.prisma.route.findUniqueOrThrow({
        where: { id: routeId },
        include: {
          routeStops: { include: { stop: true }, orderBy: { sequence: 'asc' } },
        },
      });
      const stopInputs: RouteStopInput[] = routeWithStops.routeStops.map((rs) => ({
        stopName: rs.stop.name,
        city: rs.stop.city ?? '',
        state: rs.stop.state ?? undefined,
        sequence: rs.sequence,
        arrivalOffsetMin: rs.arrivalOffsetMin,
        departureOffsetMin: rs.departureOffsetMin,
        distanceFromOriginKm: Number(rs.distanceFromOriginKm ?? 0),
      }));
      const fareBase = input.baseFare ?? (await this.resolveDefaultBaseFare(routeId));
      await this.prisma.fareRule.updateMany({
        where: { routeId },
        data: { isActive: false },
      });
      await this.syncFareRules(routeId, stopInputs, input.segmentFares, fareBase);
    }

    await this.refreshRouteTripTimes(routeId);

    return this.getRouteManagementRow(routeId);
  }

  private async applyRouteStops(routeId: string, stops: RouteStopInput[]) {
    if (stops.length < 2) {
      throw new BadRequestException('Route needs at least two stops');
    }

    const sorted = [...stops].sort((a, b) => a.sequence - b.sequence);
    const sequences = sorted.map((s) => s.sequence);
    if (new Set(sequences).size !== sequences.length) {
      throw new BadRequestException('Each stop must have a unique sequence number');
    }

    const route = await this.prisma.route.findUniqueOrThrow({
      where: { id: routeId },
      include: { routeStops: { orderBy: { sequence: 'asc' } } },
    });

    const existingStops = route.routeStops;
    const existingSequences = existingStops.map((rs) => rs.sequence);
    const structuralChange =
      sorted.length !== existingStops.length ||
      sorted.some((s, idx) => s.sequence !== existingSequences[idx]);

    const isAppendOnly =
      sorted.length > existingStops.length &&
      existingStops.every((rs, idx) => sorted[idx]?.sequence === rs.sequence);

    const isRemovalOrReorder = structuralChange && !isAppendOnly;

    if (isRemovalOrReorder) {
      const bookingCount = await this.prisma.booking.count({
        where: {
          trip: { routeId },
          status: {
            in: ['CONFIRMED', 'PENDING_PAYMENT', 'SEATS_LOCKED', 'COMPLETED'],
          },
        },
      });
      if (bookingCount > 0) {
        throw new BadRequestException(
          'This route has bookings. You can add new stops at the end, or edit names, times, distances and fares — but cannot remove or reorder existing stops.',
        );
      }

      await this.prisma.routeStop.deleteMany({ where: { routeId } });
      const stopRecords = await Promise.all(
        sorted.map((s) =>
          this.upsertStop({
            name: s.stopName,
            city: s.city,
            state: s.state,
            latitude: s.latitude,
            longitude: s.longitude,
          }),
        ),
      );

      await this.prisma.routeStop.createMany({
        data: sorted.map((s, idx) => ({
          routeId,
          stopId: stopRecords[idx].id,
          sequence: s.sequence,
          arrivalOffsetMin: s.arrivalOffsetMin,
          departureOffsetMin: s.departureOffsetMin,
          distanceFromOriginKm: s.distanceFromOriginKm,
        })),
      });
    } else if (isAppendOnly) {
      for (let i = 0; i < existingStops.length; i++) {
        const s = sorted[i];
        const existing = existingStops[i];
        const stopRecord = await this.upsertStop({
          name: s.stopName,
          city: s.city,
          state: s.state,
          latitude: s.latitude,
          longitude: s.longitude,
        });
        await this.prisma.routeStop.update({
          where: { id: existing.id },
          data: {
            stopId: stopRecord.id,
            arrivalOffsetMin: s.arrivalOffsetMin,
            departureOffsetMin: s.departureOffsetMin,
            distanceFromOriginKm: s.distanceFromOriginKm,
          },
        });
      }

      for (let i = existingStops.length; i < sorted.length; i++) {
        const s = sorted[i];
        const stopRecord = await this.upsertStop({
          name: s.stopName,
          city: s.city,
          state: s.state,
          latitude: s.latitude,
          longitude: s.longitude,
        });
        await this.prisma.routeStop.create({
          data: {
            routeId,
            stopId: stopRecord.id,
            sequence: s.sequence,
            arrivalOffsetMin: s.arrivalOffsetMin,
            departureOffsetMin: s.departureOffsetMin,
            distanceFromOriginKm: s.distanceFromOriginKm,
          },
        });
      }
    } else {
      for (let i = 0; i < sorted.length; i++) {
        const s = sorted[i];
        const existing = existingStops[i];
        const stopRecord = await this.upsertStop({
          name: s.stopName,
          city: s.city,
          state: s.state,
          latitude: s.latitude,
          longitude: s.longitude,
        });
        await this.prisma.routeStop.update({
          where: { id: existing.id },
          data: {
            stopId: stopRecord.id,
            arrivalOffsetMin: s.arrivalOffsetMin,
            departureOffsetMin: s.departureOffsetMin,
            distanceFromOriginKm: s.distanceFromOriginKm,
          },
        });
      }
    }

    const routeStops = await this.prisma.routeStop.findMany({
      where: { routeId },
      orderBy: { sequence: 'asc' },
    });
    const first = routeStops[0];
    const last = routeStops[routeStops.length - 1];
    await this.prisma.route.update({
      where: { id: routeId },
      data: {
        originStopId: first.stopId,
        destinationStopId: last.stopId,
        totalDistanceKm: last.distanceFromOriginKm,
        estimatedDurationMinutes: last.arrivalOffsetMin,
      },
    });
  }

  private async refreshRouteTripTimes(routeId: string) {
    const route = await this.prisma.route.findUniqueOrThrow({ where: { id: routeId } });
    const schedules = await this.prisma.schedule.findMany({
      where: { routeId, isActive: true },
    });
    const today = startOfTodayInServiceTimezone();

    for (const schedule of schedules) {
      const trips = await this.prisma.trip.findMany({
        where: {
          scheduleId: schedule.id,
          serviceDate: { gte: today },
          status: TripStatus.SCHEDULED,
        },
      });

      for (const trip of trips) {
        const serviceDate = toUtcDateOnly(trip.serviceDate);
        const dep = tripDepartureAt(serviceDate, schedule.departureTime);
        const arr = tripArrivalAt(dep, route.estimatedDurationMinutes ?? 0);
        await this.prisma.trip.update({
          where: { id: trip.id },
          data: { departureAt: dep, arrivalAt: arr },
        });
      }
    }
  }

  private async syncFareRules(
    routeId: string,
    stops: RouteStopInput[],
    segmentFares: Record<string, number> | undefined,
    baseFare: number,
  ) {
    const pairs: { from: number; to: number; amount: number }[] = [];
    for (let i = 0; i < stops.length; i++) {
      for (let j = i + 1; j < stops.length; j++) {
        const from = stops[i].sequence;
        const to = stops[j].sequence;
        const key = `${from}-${to}`;
        const amount =
          segmentFares?.[key] ??
          Math.round(baseFare * ((stops[j].distanceFromOriginKm - stops[i].distanceFromOriginKm) / stops[stops.length - 1].distanceFromOriginKm));
        pairs.push({ from, to, amount });
      }
    }

    for (const p of pairs) {
      await this.prisma.fareRule.upsert({
        where: {
          routeId_fromSequence_toSequence: {
            routeId,
            fromSequence: p.from,
            toSequence: p.to,
          },
        },
        create: {
          routeId,
          fromSequence: p.from,
          toSequence: p.to,
          amount: p.amount,
        },
        update: { amount: p.amount, isActive: true },
      });
    }
  }

  listRoutes() {
    return this.prisma.route.findMany({
      where: { isActive: true },
      include: {
        originStop: true,
        destinationStop: true,
        routeStops: { include: { stop: true }, orderBy: { sequence: 'asc' } },
      },
      orderBy: { name: 'asc' },
    });
  }

  listRoutesForAdmin() {
    return this.prisma.route.findMany({
      include: {
        originStop: true,
        destinationStop: true,
        routeStops: { include: { stop: true }, orderBy: { sequence: 'asc' } },
        schedules: {
          orderBy: { createdAt: 'desc' },
          include: {
            bus: { select: { id: true, name: true, registrationNumber: true, status: true } },
            operatingDays: true,
          },
        },
      },
      orderBy: [{ isActive: 'desc' }, { name: 'asc' }],
    });
  }

  async setRouteActive(routeId: string, isActive: boolean) {
    await this.prisma.route.findUniqueOrThrow({ where: { id: routeId } });

    await this.prisma.route.update({
      where: { id: routeId },
      data: { isActive },
    });

    if (!isActive) {
      await this.prisma.schedule.updateMany({
        where: { routeId, isActive: true },
        data: { isActive: false },
      });
      await this.cancelFutureUnbookedTrips(routeId);
    }

    return this.getRouteManagementRow(routeId);
  }

  private async cancelFutureUnbookedTrips(routeId: string) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    await this.prisma.trip.updateMany({
      where: {
        routeId,
        serviceDate: { gte: today },
        status: TripStatus.SCHEDULED,
        bookings: {
          none: {
            status: { in: ['CONFIRMED', 'PENDING_PAYMENT', 'SEATS_LOCKED'] },
          },
        },
      },
      data: { status: TripStatus.CANCELLED },
    });
  }

  async getRouteManagementRow(routeId: string) {
    const route = await this.prisma.route.findUnique({
      where: { id: routeId },
      include: {
        originStop: true,
        destinationStop: true,
        routeStops: { include: { stop: true }, orderBy: { sequence: 'asc' } },
        schedules: {
          orderBy: { createdAt: 'desc' },
          include: {
            bus: { select: { id: true, name: true, registrationNumber: true, status: true } },
            operatingDays: true,
          },
        },
      },
    });
    if (!route) {
      throw new NotFoundException('Route not found');
    }
    return route;
  }

  async resolveDefaultBaseFare(routeId: string) {
    const route = await this.prisma.route.findUniqueOrThrow({
      where: { id: routeId },
      include: { routeStops: { orderBy: { sequence: 'asc' } } },
    });
    const first = route.routeStops[0]?.sequence;
    const last = route.routeStops[route.routeStops.length - 1]?.sequence;
    if (first == null || last == null) {
      throw new BadRequestException('Route has no stops configured');
    }
    const fare = await this.prisma.fareRule.findFirst({
      where: { routeId, fromSequence: first, toSequence: last, isActive: true },
    });
    if (!fare) {
      throw new BadRequestException('Set a full-route fare before assigning a bus');
    }
    return Number(fare.amount);
  }
  listFareRules(routeId: string) {
    return this.prisma.fareRule.findMany({
      where: { routeId, isActive: true },
      orderBy: [{ fromSequence: 'asc' }, { toSequence: 'asc' }],
    });
  }

  upsertFareRule(routeId: string, input: { fromSequence: number; toSequence: number; amount: number }) {
    return this.prisma.fareRule.upsert({
      where: {
        routeId_fromSequence_toSequence: {
          routeId,
          fromSequence: input.fromSequence,
          toSequence: input.toSequence,
        },
      },
      create: {
        routeId,
        fromSequence: input.fromSequence,
        toSequence: input.toSequence,
        amount: input.amount,
      },
      update: { amount: input.amount, isActive: true },
    });
  }

  deleteFareRule(routeId: string, fromSequence: number, toSequence: number) {
    return this.prisma.fareRule.updateMany({
      where: { routeId, fromSequence, toSequence },
      data: { isActive: false },
    });
  }

  async getRouteById(id: string) {
    const route = await this.prisma.route.findUnique({
      where: { id },
      include: {
        originStop: true,
        destinationStop: true,
        routeStops: { include: { stop: true }, orderBy: { sequence: 'asc' } },
        fareRules: { where: { isActive: true } },
      },
    });
    if (!route) {
      throw new NotFoundException('Route not found');
    }
    return route;
  }

  async getRouteByCode(code: string) {
    const route = await this.prisma.route.findUnique({
      where: { code },
      include: {
        originStop: true,
        destinationStop: true,
        routeStops: { include: { stop: true }, orderBy: { sequence: 'asc' } },
        fareRules: { where: { isActive: true } },
      },
    });
    if (!route) {
      throw new NotFoundException('Route not found');
    }
    return route;
  }
}
