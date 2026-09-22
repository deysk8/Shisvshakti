import { Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TrackingSource } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { MapsService } from '../maps/maps.service';
import { IngestPositionDto } from './dto/ingest-position.dto';

export type BusPositionDto = {
  tripId: string;
  busId: string;
  busName: string | null;
  routeName: string;
  routeCode: string;
  latitude: number;
  longitude: number;
  source: 'demo' | 'gps';
  recordedAt: string;
  tripStatus: string;
  progressPercent: number;
  nextStopName: string | null;
  stopEtas?: StopEtaDto[];
};

export type StopEtaDto = {
  sequence: number;
  name: string;
  city: string | null;
  etaMinutes: number | null;
  passed: boolean;
};

@Injectable()
export class TrackingService {
  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
    private maps: MapsService,
  ) {}

  async ingestPosition(dto: IngestPositionDto, secret?: string) {
    const expected = this.config.get<string>('GPS_INGEST_SECRET');
    const isProduction = this.config.get('NODE_ENV') === 'production';
    if (isProduction && !expected?.trim()) {
      throw new UnauthorizedException('GPS ingest is disabled — set GPS_INGEST_SECRET');
    }
    if (expected && secret !== expected) {
      throw new UnauthorizedException('Invalid GPS ingest secret');
    }

    await this.prisma.bus.findUniqueOrThrow({ where: { id: dto.busId } });
    const recordedAt = new Date();

    await this.prisma.$transaction(async (tx) => {
      await tx.trackingPoint.create({
        data: {
          busId: dto.busId,
          tripId: dto.tripId,
          latitude: dto.latitude,
          longitude: dto.longitude,
          speedKmh: dto.speedKmh,
          heading: dto.heading,
          recordedAt,
          source: TrackingSource.GPS_DEVICE,
        },
      });
      await tx.busTrackingState.upsert({
        where: { busId: dto.busId },
        create: {
          busId: dto.busId,
          tripId: dto.tripId,
          latitude: dto.latitude,
          longitude: dto.longitude,
          lastRecordedAt: recordedAt,
          source: TrackingSource.GPS_DEVICE,
        },
        update: {
          tripId: dto.tripId,
          latitude: dto.latitude,
          longitude: dto.longitude,
          lastRecordedAt: recordedAt,
          source: TrackingSource.GPS_DEVICE,
        },
      });
    });

    return { ok: true, recordedAt: recordedAt.toISOString() };
  }

  async getTripPosition(tripId: string): Promise<BusPositionDto> {
    const trip = await this.prisma.trip.findUnique({
      where: { id: tripId },
      include: {
        route: true,
        bus: { include: { trackingState: true } },
      },
    });
    if (!trip) throw new NotFoundException('Trip not found');

    const mode = this.config.get<string>('TRACKING_MODE', 'demo');
    const useGps =
      mode !== 'demo' &&
      trip.bus.trackingState &&
      (!trip.bus.trackingState.tripId || trip.bus.trackingState.tripId === tripId);

    if (useGps && trip.bus.trackingState) {
      const state = trip.bus.trackingState;
      const stopEtas = await this.computeStopEtas(trip, Number(state.latitude), Number(state.longitude));
      const next = stopEtas.find((s) => !s.passed && s.etaMinutes != null);
      const progress = this.progressFromEtas(stopEtas);

      return {
        tripId: trip.id,
        busId: trip.busId,
        busName: trip.bus.name,
        routeName: trip.route.name,
        routeCode: trip.route.code,
        latitude: Number(state.latitude),
        longitude: Number(state.longitude),
        source: 'gps',
        recordedAt: state.lastRecordedAt.toISOString(),
        tripStatus: trip.status,
        progressPercent: progress,
        nextStopName: next?.name ?? null,
        stopEtas,
      };
    }

    const demo = await this.demoPosition(trip);
    const stopEtas = await this.computeStopEtas(
      trip,
      demo.latitude,
      demo.longitude,
      demo.progressPercent / 100,
    );
    return { ...demo, stopEtas };
  }

  private progressFromEtas(stops: StopEtaDto[]) {
    const total = stops.length;
    if (total <= 1) return 0;
    const passed = stops.filter((s) => s.passed).length;
    return Math.round((passed / (total - 1)) * 100);
  }

  private async computeStopEtas(
    trip: { id: string; departureAt: Date; routeId: string; route: { code: string } },
    lat: number,
    lng: number,
    progressOverride?: number,
  ): Promise<StopEtaDto[]> {
    const routeStops = await this.prisma.routeStop.findMany({
      where: { routeId: trip.routeId },
      include: { stop: true },
      orderBy: { sequence: 'asc' },
    });
    if (!routeStops.length) return [];

    const map = await this.maps.getRouteMap(trip.route.code);
    const now = Date.now();
    const avgSpeedKmh = 45;

    return routeStops.map((rs) => {
      const stopPoint = map.stops.find((s) => s.sequence === rs.sequence);
      const stopLat = stopPoint?.latitude ?? Number(rs.stop.latitude ?? 0);
      const stopLng = stopPoint?.longitude ?? Number(rs.stop.longitude ?? 0);
      const segmentDeparture = new Date(
        trip.departureAt.getTime() + rs.departureOffsetMin * 60_000,
      );
      const scheduledMs = segmentDeparture.getTime();

      let passed = progressOverride != null
        ? progressOverride >= (rs.sequence - 1) / Math.max(routeStops.length - 1, 1)
        : scheduledMs < now - 5 * 60_000;

      const distKm = this.haversineKm(lat, lng, stopLat, stopLng);
      if (distKm < 2) passed = true;

      let etaMinutes: number | null = passed ? 0 : null;
      if (!passed && distKm > 0) {
        etaMinutes = Math.max(1, Math.round((distKm / avgSpeedKmh) * 60));
      } else if (!passed) {
        etaMinutes = Math.max(0, Math.round((scheduledMs - now) / 60_000));
      }

      return {
        sequence: rs.sequence,
        name: rs.stop.name,
        city: rs.stop.city,
        etaMinutes,
        passed,
      };
    });
  }

  private haversineKm(lat1: number, lon1: number, lat2: number, lon2: number) {
    const R = 6371;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLon / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  private async demoPosition(trip: {
    id: string;
    busId: string;
    status: string;
    departureAt: Date;
    route: { code: string; name: string; estimatedDurationMinutes: number | null };
    bus: { name: string | null };
  }): Promise<BusPositionDto> {
    const map = await this.maps.getRouteMap(trip.route.code);
    const stops = map.stops;
    const durationMs =
      (trip.route.estimatedDurationMinutes ?? map.estimatedDurationMinutes ?? 480) * 60 * 1000;

    const startMs = trip.departureAt.getTime();
    const nowMs = Date.now();
    let progress = (nowMs - startMs) / durationMs;
    progress = Math.max(0, Math.min(1, progress));

    const pos = this.interpolate(stops, progress);
    const nextStop = stops.find((s) => {
      const stopProgress = (s.sequence - 1) / (stops.length - 1);
      return stopProgress > progress;
    });

    return {
      tripId: trip.id,
      busId: trip.busId,
      busName: trip.bus.name,
      routeName: trip.route.name,
      routeCode: trip.route.code,
      latitude: pos.latitude,
      longitude: pos.longitude,
      source: 'demo',
      recordedAt: new Date().toISOString(),
      tripStatus: trip.status,
      progressPercent: Math.round(progress * 100),
      nextStopName: nextStop?.name ?? null,
    };
  }

  private interpolate(
    stops: { latitude: number; longitude: number; sequence: number }[],
    progress: number,
  ) {
    if (progress <= 0) {
      return { latitude: stops[0].latitude, longitude: stops[0].longitude };
    }
    if (progress >= 1) {
      const last = stops[stops.length - 1];
      return { latitude: last.latitude, longitude: last.longitude };
    }

    const scaled = progress * (stops.length - 1);
    const idx = Math.floor(scaled);
    const frac = scaled - idx;
    const a = stops[idx];
    const b = stops[Math.min(idx + 1, stops.length - 1)];

    return {
      latitude: a.latitude + (b.latitude - a.latitude) * frac,
      longitude: a.longitude + (b.longitude - a.longitude) * frac,
    };
  }
}
