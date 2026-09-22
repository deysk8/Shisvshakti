import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export type MapStopDto = {
  sequence: number;
  name: string;
  city: string | null;
  latitude: number;
  longitude: number;
  arrivalOffsetMin: number;
};

@Injectable()
export class MapsService {
  constructor(private prisma: PrismaService) {}

  async getRouteMap(code: string) {
    const route = await this.prisma.route.findUnique({
      where: { code },
      include: {
        routeStops: { include: { stop: true }, orderBy: { sequence: 'asc' } },
      },
    });
    if (!route) throw new NotFoundException('Route not found');

    const stops: MapStopDto[] = route.routeStops
      .filter((rs) => rs.stop.latitude != null && rs.stop.longitude != null)
      .map((rs) => ({
        sequence: rs.sequence,
        name: rs.stop.name,
        city: rs.stop.city,
        latitude: Number(rs.stop.latitude),
        longitude: Number(rs.stop.longitude),
        arrivalOffsetMin: rs.arrivalOffsetMin,
      }));

    if (stops.length < 2) {
      throw new NotFoundException('Route stops missing map coordinates');
    }

    const lats = stops.map((s) => s.latitude);
    const lngs = stops.map((s) => s.longitude);

    return {
      routeCode: route.code,
      routeName: route.name,
      totalDistanceKm: route.totalDistanceKm != null ? Number(route.totalDistanceKm) : null,
      estimatedDurationMinutes: route.estimatedDurationMinutes,
      stops,
      polyline: stops.map((s) => [s.latitude, s.longitude] as [number, number]),
      bounds: {
        south: Math.min(...lats),
        north: Math.max(...lats),
        west: Math.min(...lngs),
        east: Math.max(...lngs),
      },
    };
  }
}
