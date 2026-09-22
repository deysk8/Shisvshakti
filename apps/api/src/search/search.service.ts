import { Injectable } from '@nestjs/common';
import { citiesMatch, clockMinutesInServiceTimezone, segmentTimeAt } from '@shiva-sakti/shared';
import { PrismaService } from '../prisma/prisma.service';
import { PricingService } from '../pricing/pricing.service';
import { SearchTripsDto } from './dto/search-trips.dto';

export type TripSearchResult = {
  tripId: string;
  serviceDate: string;
  departureAt: string;
  arrivalAt: string | null;
  bus: {
    id: string;
    name: string | null;
    registrationNumber: string;
    driver1Name?: string | null;
    driver2Name?: string | null;
    conductorName?: string | null;
  };
  route: { id: string; code: string; name: string };
  boardingStop: {
    id: string;
    name: string;
    city: string;
    sequence: number;
    departureOffsetMin: number;
  };
  droppingStop: {
    id: string;
    name: string;
    city: string;
    sequence: number;
    arrivalOffsetMin: number;
  };
  segmentDepartureAt: string;
  segmentArrivalAt: string;
  segmentDurationMinutes: number;
  fare: number;
  fareFrom?: number;
  hasSeatDiscounts?: boolean;
  availableSeats: number;
  totalSeats: number;
  durationMinutes: number | null;
  busType: string;
  amenities: string[];
  ac: boolean;
};

@Injectable()
export class SearchService {
  constructor(
    private prisma: PrismaService,
    private pricing: PricingService,
  ) {}

  async searchTrips(dto: SearchTripsDto): Promise<TripSearchResult[]> {
    const [year, month, day] = dto.date.split('-').map(Number);
    const serviceDate = new Date(Date.UTC(year, month - 1, day));

    const routes = await this.prisma.route.findMany({
      where: { isActive: true },
      include: {
        routeStops: { include: { stop: true }, orderBy: { sequence: 'asc' } },
      },
    });

    const matchedRoutes = routes.filter((route) => {
      const from = route.routeStops.find((rs) =>
        citiesMatch(rs.stop.city ?? '', dto.fromCity),
      );
      const to = route.routeStops.find((rs) => citiesMatch(rs.stop.city ?? '', dto.toCity));
      return from && to && from.sequence < to.sequence;
    });

    const results: TripSearchResult[] = [];

    for (const route of matchedRoutes) {
      const boarding = route.routeStops.find((rs) =>
        citiesMatch(rs.stop.city ?? '', dto.fromCity),
      )!;
      const dropping = route.routeStops.find((rs) =>
        citiesMatch(rs.stop.city ?? '', dto.toCity),
      )!;

      const fareRule = await this.prisma.fareRule.findFirst({
        where: {
          routeId: route.id,
          fromSequence: boarding.sequence,
          toSequence: dropping.sequence,
          isActive: true,
        },
      });
      if (!fareRule) continue;

      const trips = await this.prisma.trip.findMany({
        where: {
          routeId: route.id,
          serviceDate,
          status: 'SCHEDULED',
          schedule: { isActive: true },
          bus: { status: 'ACTIVE' },
        },
        include: {
          bus: { include: { busType: true } },
          route: true,
        },
      });

      for (const trip of trips) {
        const availability = await this.countAvailableSeats(trip.id, trip.busId);
        const duration =
          trip.arrivalAt && trip.departureAt
            ? Math.round((trip.arrivalAt.getTime() - trip.departureAt.getTime()) / 60000)
            : route.estimatedDurationMinutes;

        const amenities = this.resolveAmenities(trip.bus);
        const segmentDepartureAt = segmentTimeAt(trip.departureAt, boarding.departureOffsetMin);
        const segmentArrivalAt = segmentTimeAt(trip.departureAt, dropping.arrivalOffsetMin);
        const segmentDurationMinutes = Math.max(
          0,
          Math.round((segmentArrivalAt.getTime() - segmentDepartureAt.getTime()) / 60_000),
        );

        const fareRange = await this.pricing.getTripFareRange(
          trip.id,
          trip.busId,
          boarding.sequence,
          dropping.sequence,
        );

        results.push({
          tripId: trip.id,
          serviceDate: trip.serviceDate.toISOString().slice(0, 10),
          departureAt: trip.departureAt.toISOString(),
          arrivalAt: trip.arrivalAt?.toISOString() ?? null,
          bus: {
            id: trip.bus.id,
            name: trip.bus.name,
            registrationNumber: trip.bus.registrationNumber,
            driver1Name: trip.bus.driver1Name,
            driver2Name: trip.bus.driver2Name,
            conductorName: trip.bus.conductorName,
          },
          busType: trip.bus.busType.name,
          amenities,
          ac: amenities.includes('AC'),
          route: { id: route.id, code: route.code, name: route.name },
          boardingStop: {
            id: boarding.id,
            name: boarding.stop.name,
            city: boarding.stop.city ?? '',
            sequence: boarding.sequence,
            departureOffsetMin: boarding.departureOffsetMin,
          },
          droppingStop: {
            id: dropping.id,
            name: dropping.stop.name,
            city: dropping.stop.city ?? '',
            sequence: dropping.sequence,
            arrivalOffsetMin: dropping.arrivalOffsetMin,
          },
          segmentDepartureAt: segmentDepartureAt.toISOString(),
          segmentArrivalAt: segmentArrivalAt.toISOString(),
          segmentDurationMinutes,
          fare: fareRange.base,
          fareFrom: fareRange.hasDiscounts ? fareRange.min : undefined,
          hasSeatDiscounts: fareRange.hasDiscounts,
          availableSeats: availability.available,
          totalSeats: availability.total,
          durationMinutes: duration,
        });
      }
    }

    return this.applySortAndFilter(results, dto);
  }

  private applySortAndFilter(results: TripSearchResult[], dto: SearchTripsDto) {
    let list = [...results];
    if (dto.minSeats != null) {
      list = list.filter((r) => r.availableSeats >= dto.minSeats!);
    }
    if (dto.maxPrice != null) {
      list = list.filter((r) => (r.fareFrom ?? r.fare) <= dto.maxPrice!);
    }
    if (dto.departAfter) {
      const afterMin = this.parseClockMinutes(dto.departAfter);
      if (afterMin != null) {
        list = list.filter((r) => this.clockMinutes(r.segmentDepartureAt) >= afterMin);
      }
    }
    if (dto.departBefore) {
      const beforeMin = this.parseClockMinutes(dto.departBefore);
      if (beforeMin != null) {
        list = list.filter((r) => this.clockMinutes(r.segmentDepartureAt) <= beforeMin);
      }
    }
    const sort = dto.sort ?? 'departure';
    list.sort((a, b) => {
      if (sort === 'price') return a.fare - b.fare;
      if (sort === 'availability') return b.availableSeats - a.availableSeats;
      if (sort === 'duration') {
        return (a.segmentDurationMinutes ?? a.durationMinutes ?? 0) -
          (b.segmentDurationMinutes ?? b.durationMinutes ?? 0);
      }
      return (
        new Date(a.segmentDepartureAt).getTime() - new Date(b.segmentDepartureAt).getTime()
      );
    });
    return list;
  }

  private parseClockMinutes(value: string): number | null {
    const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
    if (!match) return null;
    const hours = Number(match[1]);
    const minutes = Number(match[2]);
    if (hours > 23 || minutes > 59) return null;
    return hours * 60 + minutes;
  }

  private clockMinutes(iso: string): number {
    return clockMinutesInServiceTimezone(new Date(iso));
  }

  async countAvailableSeats(tripId: string, busId: string) {
    const total = await this.prisma.busSeat.count({
      where: { busId, isActive: true },
    });
    const occupied = await this.prisma.bookingSeat.count({
      where: { tripId, occupancyStatus: 'OCCUPIED' },
    });
    const locked = await this.prisma.seatLock.count({
      where: {
        tripId,
        status: 'ACTIVE',
        expiresAt: { gt: new Date() },
      },
    });
    return { total, available: Math.max(0, total - occupied - locked) };
  }

  private resolveAmenities(bus: {
    amenitiesOverride: unknown;
    busType: { amenities: unknown };
  }) {
    const raw = (bus.amenitiesOverride ?? bus.busType.amenities) as Record<string, boolean> | null;
    if (!raw) return ['AC', 'Charging'];
    const labels: Record<string, string> = {
      ac: 'AC',
      charging: 'Charging',
      readingLight: 'Reading light',
      blanket: 'Blanket',
      water: 'Water bottle',
    };
    return Object.entries(raw)
      .filter(([, enabled]) => enabled)
      .map(([key]) => labels[key] ?? key);
  }
}
