import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PricingService } from '../pricing/pricing.service';

export type SeatMapSeat = {
  id: string;
  label: string;
  deck: string;
  seatType: string;
  rowIndex: number | null;
  colIndex: number | null;
  status: 'available' | 'booked' | 'locked';
  fare?: number;
  baseFare?: number;
  discounted?: boolean;
};

@Injectable()
export class AvailabilityService {
  constructor(
    private prisma: PrismaService,
    private pricing: PricingService,
  ) {}

  async getTripSeatMap(
    tripId: string,
    options?: { baseFare?: number; fromSequence?: number; toSequence?: number },
  ) {
    const trip = await this.prisma.trip.findUnique({
      where: { id: tripId },
      include: {
        bus: {
          include: {
            seats: { where: { isActive: true }, orderBy: [{ rowIndex: 'asc' }, { colIndex: 'asc' }] },
            busType: true,
          },
        },
        route: true,
      },
    });
    if (!trip) throw new NotFoundException('Trip not found');

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

    const segmentPricing =
      options?.fromSequence != null && options?.toSequence != null
        ? await this.pricing.resolveSeatFaresForTrip(
            tripId,
            trip.bus.seats.map((s) => s.id),
            options.fromSequence,
            options.toSequence,
          )
        : null;

    const segmentBase =
      segmentPricing?.values().next().value?.baseAmount ?? options?.baseFare ?? null;

    const seats: SeatMapSeat[] = trip.bus.seats.map((seat) => {
      const resolved = segmentPricing?.get(seat.id);
      return {
        id: seat.id,
        label: seat.seatLabel,
        deck: seat.deck ?? 'lower',
        seatType: seat.seatType,
        rowIndex: seat.rowIndex,
        colIndex: seat.colIndex,
        status: occupied.has(seat.id) ? 'booked' : locked.has(seat.id) ? 'locked' : 'available',
        fare: resolved?.amount,
        baseFare: resolved?.baseAmount,
        discounted: resolved?.overridden && resolved.amount < resolved.baseAmount,
      };
    });

    const fareValues = seats
      .filter((s) => s.status === 'available' && s.fare != null)
      .map((s) => s.fare!);
    const fareFrom = fareValues.length ? Math.min(...fareValues) : segmentBase;
    const fareTo = fareValues.length ? Math.max(...fareValues) : segmentBase;

    return {
      tripId: trip.id,
      serviceDate: trip.serviceDate.toISOString().slice(0, 10),
      departureAt: trip.departureAt.toISOString(),
      bus: { id: trip.bus.id, name: trip.bus.name, registrationNumber: trip.bus.registrationNumber },
      route: { id: trip.route.id, name: trip.route.name, code: trip.route.code },
      layoutKind: trip.bus.busType.layoutKind,
      layoutTemplate: (trip.bus.busType.layoutConfig as { template?: string })?.template ?? null,
      baseFare: segmentBase,
      fareFrom,
      fareTo,
      seats,
    };
  }
}
