import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export type ResolvedSeatFare = {
  amount: number;
  baseAmount: number;
  overridden: boolean;
};

export type TripSeatPricingRow = {
  id: string;
  label: string;
  deck: string;
  seatType: string;
  status: 'available' | 'booked' | 'locked';
  baseFare: number;
  overrideAmount: number | null;
  effectiveFare: number;
  overridden: boolean;
};

@Injectable()
export class PricingService {
  constructor(private prisma: PrismaService) {}

  async getSegmentBaseFare(
    routeId: string,
    fromSequence: number,
    toSequence: number,
  ): Promise<number> {
    const fareRule = await this.prisma.fareRule.findFirst({
      where: { routeId, fromSequence, toSequence, isActive: true },
    });
    if (!fareRule) {
      throw new NotFoundException('Fare not configured for this segment');
    }
    return Number(fareRule.amount);
  }

  async resolveSeatFare(
    tripId: string,
    busSeatId: string,
    fromSequence: number,
    toSequence: number,
  ): Promise<ResolvedSeatFare> {
    const trip = await this.prisma.trip.findUniqueOrThrow({ where: { id: tripId } });
    const baseAmount = await this.getSegmentBaseFare(trip.routeId, fromSequence, toSequence);

    const override = await this.prisma.tripSeatPriceOverride.findUnique({
      where: {
        tripId_busSeatId_fromSequence_toSequence: {
          tripId,
          busSeatId,
          fromSequence,
          toSequence,
        },
      },
    });

    if (!override) {
      return { amount: baseAmount, baseAmount, overridden: false };
    }

    return {
      amount: Number(override.amount),
      baseAmount,
      overridden: true,
    };
  }

  async resolveSeatFaresForTrip(
    tripId: string,
    busSeatIds: string[],
    fromSequence: number,
    toSequence: number,
  ): Promise<Map<string, ResolvedSeatFare>> {
    const trip = await this.prisma.trip.findUniqueOrThrow({ where: { id: tripId } });
    const baseAmount = await this.getSegmentBaseFare(trip.routeId, fromSequence, toSequence);

    const overrides = await this.prisma.tripSeatPriceOverride.findMany({
      where: {
        tripId,
        fromSequence,
        toSequence,
        busSeatId: { in: busSeatIds },
      },
    });
    const overrideMap = new Map(overrides.map((o) => [o.busSeatId, Number(o.amount)]));

    const result = new Map<string, ResolvedSeatFare>();
    for (const seatId of busSeatIds) {
      const custom = overrideMap.get(seatId);
      if (custom != null) {
        result.set(seatId, { amount: custom, baseAmount, overridden: true });
      } else {
        result.set(seatId, { amount: baseAmount, baseAmount, overridden: false });
      }
    }
    return result;
  }

  async getTripFareRange(
    tripId: string,
    busId: string,
    fromSequence: number,
    toSequence: number,
  ): Promise<{ base: number; min: number; max: number; hasDiscounts: boolean }> {
    const trip = await this.prisma.trip.findUniqueOrThrow({ where: { id: tripId } });
    const base = await this.getSegmentBaseFare(trip.routeId, fromSequence, toSequence);

    const occupied = new Set(
      (
        await this.prisma.bookingSeat.findMany({
          where: { tripId, occupancyStatus: 'OCCUPIED' },
          select: { busSeatId: true },
        })
      ).map((s) => s.busSeatId),
    );
    const locked = new Set(
      (
        await this.prisma.seatLock.findMany({
          where: { tripId, status: 'ACTIVE', expiresAt: { gt: new Date() } },
          select: { busSeatId: true },
        })
      ).map((s) => s.busSeatId),
    );

    const seats = await this.prisma.busSeat.findMany({
      where: { busId, isActive: true },
      select: { id: true },
    });
    const availableSeatIds = seats
      .filter((s) => !occupied.has(s.id) && !locked.has(s.id))
      .map((s) => s.id);

    if (!availableSeatIds.length) {
      return { base, min: base, max: base, hasDiscounts: false };
    }

    const overrides = await this.prisma.tripSeatPriceOverride.findMany({
      where: {
        tripId,
        fromSequence,
        toSequence,
        busSeatId: { in: availableSeatIds },
      },
    });
    const overrideMap = new Map(overrides.map((o) => [o.busSeatId, Number(o.amount)]));

    const effective = availableSeatIds.map((id) => overrideMap.get(id) ?? base);
    const min = Math.min(...effective);
    const max = Math.max(...effective);
    const hasDiscounts = effective.some((amount) => amount < base);

    return { base, min, max, hasDiscounts };
  }

  async getAdminSeatPricingBoard(
    tripId: string,
    fromSequence: number,
    toSequence: number,
  ) {
    const trip = await this.prisma.trip.findUnique({
      where: { id: tripId },
      include: {
        route: { include: { routeStops: { include: { stop: true }, orderBy: { sequence: 'asc' } } } },
        bus: {
          include: {
            seats: { where: { isActive: true }, orderBy: [{ rowIndex: 'asc' }, { colIndex: 'asc' }] },
          },
        },
      },
    });
    if (!trip) throw new NotFoundException('Trip not found');

    const baseFare = await this.getSegmentBaseFare(trip.routeId, fromSequence, toSequence);

    const occupied = new Set(
      (
        await this.prisma.bookingSeat.findMany({
          where: { tripId, occupancyStatus: 'OCCUPIED' },
          select: { busSeatId: true },
        })
      ).map((s) => s.busSeatId),
    );
    const locked = new Set(
      (
        await this.prisma.seatLock.findMany({
          where: { tripId, status: 'ACTIVE', expiresAt: { gt: new Date() } },
          select: { busSeatId: true },
        })
      ).map((s) => s.busSeatId),
    );

    const overrides = await this.prisma.tripSeatPriceOverride.findMany({
      where: { tripId, fromSequence, toSequence },
    });
    const overrideMap = new Map(overrides.map((o) => [o.busSeatId, Number(o.amount)]));

    const seats: TripSeatPricingRow[] = trip.bus.seats.map((seat) => {
      const status: TripSeatPricingRow['status'] = occupied.has(seat.id)
        ? 'booked'
        : locked.has(seat.id)
          ? 'locked'
          : 'available';
      const overrideAmount = overrideMap.get(seat.id) ?? null;
      const effectiveFare = overrideAmount ?? baseFare;
      return {
        id: seat.id,
        label: seat.seatLabel,
        deck: seat.deck ?? 'lower',
        seatType: seat.seatType,
        status,
        baseFare,
        overrideAmount,
        effectiveFare,
        overridden: overrideAmount != null,
      };
    });

    const hoursUntilDeparture = Math.max(
      0,
      (trip.departureAt.getTime() - Date.now()) / (1000 * 60 * 60),
    );

    return {
      trip: {
        id: trip.id,
        serviceDate: trip.serviceDate.toISOString().slice(0, 10),
        departureAt: trip.departureAt.toISOString(),
        status: trip.status,
        route: { id: trip.route.id, code: trip.route.code, name: trip.route.name },
        bus: { id: trip.bus.id, name: trip.bus.name, registrationNumber: trip.bus.registrationNumber },
        availableSeats: seats.filter((s) => s.status === 'available').length,
        hoursUntilDeparture: Math.round(hoursUntilDeparture * 10) / 10,
      },
      segment: { fromSequence, toSequence, baseFare },
      seats,
    };
  }

  async upsertTripSeatOverrides(
    tripId: string,
    fromSequence: number,
    toSequence: number,
    overrides: { busSeatId: string; amount: number; note?: string }[],
  ) {
    const trip = await this.prisma.trip.findUnique({
      where: { id: tripId },
      include: { bus: { include: { seats: { where: { isActive: true } } } } },
    });
    if (!trip) throw new NotFoundException('Trip not found');
    if (trip.status !== 'SCHEDULED') {
      throw new BadRequestException('Can only set seat prices on scheduled trips');
    }

    const baseFare = await this.getSegmentBaseFare(trip.routeId, fromSequence, toSequence);
    const seatIds = new Set(trip.bus.seats.map((s) => s.id));

    const occupied = new Set(
      (
        await this.prisma.bookingSeat.findMany({
          where: { tripId, occupancyStatus: 'OCCUPIED' },
          select: { busSeatId: true },
        })
      ).map((s) => s.busSeatId),
    );

    for (const item of overrides) {
      if (!seatIds.has(item.busSeatId)) {
        throw new BadRequestException(`Seat ${item.busSeatId} is not on this bus`);
      }
      if (occupied.has(item.busSeatId)) {
        throw new BadRequestException(`Seat is already booked — cannot change price`);
      }
      if (!Number.isFinite(item.amount) || item.amount <= 0) {
        throw new BadRequestException('Price must be greater than zero');
      }
      if (item.amount > baseFare * 2) {
        throw new BadRequestException(`Price cannot exceed 2× the base fare (₹${baseFare})`);
      }
    }

    await this.prisma.$transaction(async (tx) => {
      for (const item of overrides) {
        await tx.tripSeatPriceOverride.upsert({
          where: {
            tripId_busSeatId_fromSequence_toSequence: {
              tripId,
              busSeatId: item.busSeatId,
              fromSequence,
              toSequence,
            },
          },
          create: {
            tripId,
            busSeatId: item.busSeatId,
            fromSequence,
            toSequence,
            amount: item.amount,
            note: item.note,
          },
          update: {
            amount: item.amount,
            note: item.note,
          },
        });
      }
    });

    return this.getAdminSeatPricingBoard(tripId, fromSequence, toSequence);
  }

  async clearTripSeatOverride(
    tripId: string,
    busSeatId: string,
    fromSequence: number,
    toSequence: number,
  ) {
    await this.prisma.tripSeatPriceOverride.deleteMany({
      where: { tripId, busSeatId, fromSequence, toSequence },
    });
    return this.getAdminSeatPricingBoard(tripId, fromSequence, toSequence);
  }
}
