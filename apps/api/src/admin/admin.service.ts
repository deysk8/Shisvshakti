import { BadRequestException, ConflictException, Injectable } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { FleetService } from '../fleet/fleet.service';
import { seedFirstBus } from '../operations/launch-route.seed';
import { PrismaService } from '../prisma/prisma.service';
import { RoutesService } from '../routes/routes.service';
import { SchedulesService } from '../schedules/schedules.service';
import { CreateAgentDto } from './dto/create-agent.dto';
import { CreateRouteDto } from './dto/create-route.dto';
import { UpdateRouteFullDto } from './dto/update-route-full.dto';

@Injectable()
export class AdminService {
  constructor(
    private prisma: PrismaService,
    private routesService: RoutesService,
    private schedulesService: SchedulesService,
    private fleetService: FleetService,
  ) {}
  async createAgent(dto: CreateAgentDto) {
    const email = dto.email.toLowerCase();
    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing) {
      throw new ConflictException('Email already in use');
    }
    const codeTaken = await this.prisma.agent.findUnique({
      where: { employeeCode: dto.employeeCode },
    });
    if (codeTaken) {
      throw new ConflictException('Employee code already in use');
    }

    const passwordHash = await bcrypt.hash(dto.password, 12);
    const user = await this.prisma.user.create({
      data: {
        email,
        fullName: dto.fullName.trim(),
        phone: dto.phone,
        passwordHash,
        role: UserRole.AGENT,
        agent: {
          create: {
            employeeCode: dto.employeeCode,
            salaryMonthly: dto.salaryMonthly,
            commissionRatePercent: dto.commissionRatePercent,
            joinedAt: new Date(),
            isActive: true,
          },
        },
      },
      include: { agent: true },
    });

    return {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      role: user.role,
      agent: user.agent,
    };
  }

  async seedLaunchRoute() {
    return seedFirstBus(this.prisma);
  }

  async createRoute(dto: CreateRouteDto) {
    const segmentFares = dto.segmentFares?.reduce<Record<string, number>>((acc, fare) => {
      acc[`${fare.fromSequence}-${fare.toSequence}`] = fare.amount;
      return acc;
    }, {});

    const route = await this.routesService.createRouteAdmin({
      code: dto.code,
      name: dto.name,
      stops: dto.stops.map((stop) => ({
        stopName: stop.stopName.trim(),
        city: stop.city.trim(),
        state: stop.state?.trim(),
        sequence: stop.sequence,
        arrivalOffsetMin: stop.arrivalOffsetMin,
        departureOffsetMin: stop.departureOffsetMin,
        distanceFromOriginKm: stop.distanceFromOriginKm,
      })),
      baseFare: dto.baseFare,
      segmentFares,
      isActive: dto.isActive ?? true,
    });

    const hasBusInput = dto.bus?.busId || dto.bus?.registrationNumber;
    if (hasBusInput && !dto.departureTime) {
      throw new BadRequestException('Departure time is required when assigning a bus');
    }

    if (hasBusInput && dto.departureTime) {
      let busId = dto.bus?.busId;
      if (!busId && dto.bus?.registrationNumber) {
        const bus = await this.fleetService.findOrCreateBus({
          registrationNumber: dto.bus.registrationNumber,
          name: dto.bus.name,
          busTypeId: dto.bus.busTypeId,
        });
        busId = bus.id;
      }
      if (!busId) {
        throw new BadRequestException('Select an existing bus or enter a bus registration number');
      }

      await this.schedulesService.assignBusToRoute({
        routeId: route.id,
        busId,
        departureTime: dto.departureTime,
        baseFare: dto.baseFare,
        daysAhead: dto.daysAhead ?? 45,
      });
    }

    return this.routesService.getRouteManagementRow(route.id);
  }

  async updateRoute(routeId: string, dto: UpdateRouteFullDto) {
    const segmentFares = dto.segmentFares?.reduce<Record<string, number>>((acc, fare) => {
      acc[`${fare.fromSequence}-${fare.toSequence}`] = fare.amount;
      return acc;
    }, {});

    await this.routesService.updateRouteAdmin(routeId, {
      name: dto.name,
      isActive: dto.isActive,
      baseFare: dto.baseFare,
      stops: dto.stops?.map((stop) => ({
        stopName: stop.stopName.trim(),
        city: stop.city.trim(),
        state: stop.state?.trim(),
        sequence: stop.sequence,
        arrivalOffsetMin: stop.arrivalOffsetMin,
        departureOffsetMin: stop.departureOffsetMin,
        distanceFromOriginKm: stop.distanceFromOriginKm,
      })),
      segmentFares,
    });

    const hasBusInput = dto.bus?.busId || dto.bus?.registrationNumber;
    if (hasBusInput && !dto.departureTime) {
      throw new BadRequestException('Departure time is required when assigning a bus');
    }

    if ((hasBusInput || dto.departureTime || dto.baseFare != null) && dto.isActive !== false) {
      let busId = dto.bus?.busId;
      if (!busId && dto.bus?.registrationNumber) {
        const bus = await this.fleetService.findOrCreateBus({
          registrationNumber: dto.bus.registrationNumber,
          name: dto.bus.name,
          busTypeId: dto.bus.busTypeId,
        });
        busId = bus.id;
      }

      await this.schedulesService.updateRouteSchedule({
        routeId,
        departureTime: dto.departureTime,
        baseFare: dto.baseFare,
        busId,
        daysAhead: dto.daysAhead,
      });
    }

    return this.routesService.getRouteManagementRow(routeId);
  }

  listAgents() {
    return this.prisma.agent.findMany({
      include: {
        user: { select: { id: true, email: true, fullName: true, phone: true, isActive: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async updateAgent(id: string, dto: { salaryMonthly?: number; commissionRatePercent?: number; isActive?: boolean }) {
    const agent = await this.prisma.agent.findUniqueOrThrow({ where: { id } });
    const updated = await this.prisma.agent.update({
      where: { id },
      data: {
        ...(dto.salaryMonthly != null ? { salaryMonthly: dto.salaryMonthly } : {}),
        ...(dto.commissionRatePercent != null
          ? { commissionRatePercent: dto.commissionRatePercent }
          : {}),
        ...(dto.isActive != null ? { isActive: dto.isActive } : {}),
      },
      include: { user: { select: { email: true, fullName: true } } },
    });
    if (dto.isActive != null) {
      await this.prisma.user.update({
        where: { id: agent.userId },
        data: { isActive: dto.isActive },
      });
    }
    return updated;
  }

  async getCompanySettings() {
    const row = await this.prisma.companySettings.findFirst();
    if (!row) throw new Error('Company settings not configured');
    return {
      seniorDiscountEnabled: row.seniorDiscountEnabled,
      seniorDiscountPercent: Number(row.seniorDiscountPercent),
      childDiscountEnabled: row.childDiscountEnabled,
      childDiscountPercent: Number(row.childDiscountPercent),
      childMaxAge: row.childMaxAge,
    };
  }

  async updateCompanySettings(dto: {
    seniorDiscountEnabled?: boolean;
    seniorDiscountPercent?: number;
    childDiscountEnabled?: boolean;
    childDiscountPercent?: number;
    childMaxAge?: number;
  }) {
    const row = await this.prisma.companySettings.findFirstOrThrow();
    return this.prisma.companySettings.update({
      where: { id: row.id },
      data: {
        ...(dto.seniorDiscountEnabled != null
          ? { seniorDiscountEnabled: dto.seniorDiscountEnabled }
          : {}),
        ...(dto.seniorDiscountPercent != null
          ? { seniorDiscountPercent: dto.seniorDiscountPercent }
          : {}),
        ...(dto.childDiscountEnabled != null ? { childDiscountEnabled: dto.childDiscountEnabled } : {}),
        ...(dto.childDiscountPercent != null ? { childDiscountPercent: dto.childDiscountPercent } : {}),
        ...(dto.childMaxAge != null ? { childMaxAge: dto.childMaxAge } : {}),
      },
    });
  }

  async deactivateAgent(id: string) {
    const agent = await this.prisma.agent.findUniqueOrThrow({ where: { id } });
    await this.prisma.$transaction([
      this.prisma.agent.update({ where: { id }, data: { isActive: false } }),
      this.prisma.user.update({ where: { id: agent.userId }, data: { isActive: false } }),
    ]);
    return { ok: true, id, status: 'deactivated' as const };
  }
}
