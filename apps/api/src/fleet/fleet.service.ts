import { Injectable } from '@nestjs/common';
import { LayoutKind, Prisma, SeatType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

type SeatDraft = {
  seatLabel: string;
  deck: string;
  rowIndex: number;
  colIndex: number;
  seatType: SeatType;
};

/** Lower: 6 sleepers + 12×2 seaters. Upper: 6 sleepers + 7×2 sleepers (client layout). */
export function buildShivaSaktiDualDeckLayout(): {
  layoutConfig: Prisma.InputJsonValue;
  seats: SeatDraft[];
} {
  const seats: SeatDraft[] = [];

  for (let r = 1; r <= 6; r++) {
    seats.push({
      seatLabel: `L${r}S`,
      deck: 'lower',
      rowIndex: r,
      colIndex: 1,
      seatType: SeatType.SLEEPER,
    });
  }
  for (let r = 1; r <= 12; r++) {
    seats.push({
      seatLabel: `L${r}A`,
      deck: 'lower',
      rowIndex: r,
      colIndex: 2,
      seatType: SeatType.SEATER,
    });
    seats.push({
      seatLabel: `L${r}B`,
      deck: 'lower',
      rowIndex: r,
      colIndex: 3,
      seatType: SeatType.SEATER,
    });
  }
  for (let r = 1; r <= 6; r++) {
    seats.push({
      seatLabel: `U${r}S`,
      deck: 'upper',
      rowIndex: r,
      colIndex: 1,
      seatType: SeatType.SLEEPER,
    });
  }
  for (let r = 1; r <= 7; r++) {
    seats.push({
      seatLabel: `U${r}A`,
      deck: 'upper',
      rowIndex: r,
      colIndex: 2,
      seatType: SeatType.SLEEPER,
    });
    seats.push({
      seatLabel: `U${r}B`,
      deck: 'upper',
      rowIndex: r,
      colIndex: 3,
      seatType: SeatType.SLEEPER,
    });
  }

  return {
    layoutConfig: {
      template: 'SHIVA_SAKTI_DUAL_DECK',
      aisleAfterCol: 1,
      lowerSeaterRows: 12,
      upperSleeperRows: 7,
      decks: ['lower', 'upper'],
    },
    seats,
  };
}

function seatsFromBusType(busType: { totalSeats: number; layoutConfig: unknown }): SeatDraft[] {
  const cfg = busType.layoutConfig as { template?: string; seatDrafts?: SeatDraft[] };
  if (cfg?.template === 'SHIVA_SAKTI_DUAL_DECK') {
    return buildShivaSaktiDualDeckLayout().seats;
  }
  if (cfg?.seatDrafts?.length) {
    return cfg.seatDrafts;
  }
  const rowCount = Math.ceil(busType.totalSeats / 4) || 10;
  return buildLayout2x2(rowCount).seats;
}
export function buildLayout2x2(rowCount: number): {
  layoutConfig: Prisma.InputJsonValue;
  seats: SeatDraft[];
} {
  const rows: Prisma.InputJsonValue[] = [];
  const seats: SeatDraft[] = [];
  const rowLabels = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

  for (let r = 0; r < rowCount; r++) {
    const rowLabel = rowLabels[r] ?? `R${r + 1}`;
    const rowSeats = [
      { label: `${rowLabel}1`, col: 1 },
      { label: `${rowLabel}2`, col: 2 },
      { label: `${rowLabel}3`, col: 3 },
      { label: `${rowLabel}4`, col: 4 },
    ];
    rows.push({
      row: r + 1,
      seats: rowSeats.map((s) => ({ label: s.label, type: 'SEATER', col: s.col })),
    });
    for (const s of rowSeats) {
      seats.push({
        seatLabel: s.label,
        deck: 'lower',
        rowIndex: r + 1,
        colIndex: s.col,
        seatType: SeatType.SEATER,
      });
    }
  }

  return {
    layoutConfig: {
      decks: [{ name: 'lower', rows }],
      aisleAfterCol: 2,
    },
    seats,
  };
}

@Injectable()
export class FleetService {
  constructor(private prisma: PrismaService) {}

  async createBusTypeDualDeck(name: string, amenities?: Prisma.InputJsonValue) {
    const { layoutConfig, seats } = buildShivaSaktiDualDeckLayout();
    return this.prisma.busType.create({
      data: {
        name,
        layoutKind: LayoutKind.SEATER_SLEEPER_MIX,
        totalSeats: seats.length,
        layoutConfig,
        amenities: amenities ?? { ac: true, charging: true, readingLight: true },
      },
    });
  }

  async createBusType(input: {
    name: string;
    layoutKind: LayoutKind;
    rowCount: number;
    amenities?: Prisma.InputJsonValue;
  }) {
    const { layoutConfig, seats } = buildLayout2x2(input.rowCount);
    return this.prisma.busType.create({
      data: {
        name: input.name,
        layoutKind: input.layoutKind,
        totalSeats: seats.length,
        layoutConfig,
        amenities: input.amenities ?? { ac: true, charging: true },
      },
    });
  }

  async createBus(input: {
    registrationNumber: string;
    name: string;
    busTypeId: string;
  }) {
    const busType = await this.prisma.busType.findUniqueOrThrow({
      where: { id: input.busTypeId },
    });
    const seats = seatsFromBusType(busType);

    return this.prisma.bus.create({
      data: {
        registrationNumber: input.registrationNumber,
        name: input.name,
        busTypeId: input.busTypeId,
        seats: { create: seats },
      },
      include: { seats: true, busType: true },
    });
  }

  listBuses() {
    return this.prisma.bus.findMany({
      include: { busType: true, _count: { select: { seats: true } } },
      orderBy: { registrationNumber: 'asc' },
    });
  }

  async listBusCrewBoard() {
    const buses = await this.prisma.bus.findMany({
      include: {
        busType: { select: { name: true } },
        schedules: {
          where: { isActive: true },
          include: {
            route: {
              select: { id: true, code: true, name: true, isActive: true },
            },
          },
          orderBy: { updatedAt: 'desc' },
          take: 1,
        },
      },
      orderBy: { registrationNumber: 'asc' },
    });

    return buses.map((bus) => {
      const schedule = bus.schedules[0];
      const assignment =
        schedule != null
          ? {
              routeId: schedule.route.id,
              routeCode: schedule.route.code,
              routeName: schedule.route.name,
              routeIsActive: schedule.route.isActive,
              departureTime: schedule.departureTime,
            }
          : null;

      return {
        id: bus.id,
        registrationNumber: bus.registrationNumber,
        name: bus.name,
        status: bus.status,
        busType: bus.busType,
        driver1Name: bus.driver1Name,
        driver2Name: bus.driver2Name,
        conductorName: bus.conductorName,
        activeAssignment: assignment,
      };
    });
  }

  async updateBusCrew(
    id: string,
    input: {
      driver1Name?: string | null;
      driver2Name?: string | null;
      conductorName?: string | null;
    },
  ) {
    await this.prisma.bus.findUniqueOrThrow({ where: { id } });

    const normalize = (value: string | null | undefined) => {
      if (value == null) return null;
      const trimmed = value.trim();
      return trimmed.length ? trimmed : null;
    };

    return this.prisma.bus.update({
      where: { id },
      data: {
        ...(input.driver1Name !== undefined ? { driver1Name: normalize(input.driver1Name) } : {}),
        ...(input.driver2Name !== undefined ? { driver2Name: normalize(input.driver2Name) } : {}),
        ...(input.conductorName !== undefined
          ? { conductorName: normalize(input.conductorName) }
          : {}),
      },
      include: { busType: { select: { name: true } } },
    });
  }

  listBusTypes() {
    return this.prisma.busType.findMany({
      orderBy: { name: 'asc' },
      select: { id: true, name: true, totalSeats: true, layoutKind: true },
    });
  }

  async findOrCreateDefaultBusType() {
    const existing = await this.prisma.busType.findFirst({
      where: { name: 'Shiv Shakti Dual Deck AC' },
    });
    if (existing) return existing;
    return this.createBusTypeDualDeck('Shiv Shakti Dual Deck AC', {
      ac: true,
      charging: true,
      readingLight: true,
    });
  }

  async findOrCreateBus(input: {
    registrationNumber: string;
    name?: string;
    busTypeId?: string;
  }) {
    const registrationNumber = input.registrationNumber.trim().toUpperCase();
    const existing = await this.prisma.bus.findUnique({ where: { registrationNumber } });
    if (existing) {
      if (existing.status !== 'ACTIVE') {
        return this.prisma.bus.update({
          where: { id: existing.id },
          data: { status: 'ACTIVE', ...(input.name ? { name: input.name.trim() } : {}) },
          include: { busType: true },
        });
      }
      return existing;
    }

    const busType = input.busTypeId
      ? await this.prisma.busType.findUniqueOrThrow({ where: { id: input.busTypeId } })
      : await this.findOrCreateDefaultBusType();

    return this.createBus({
      registrationNumber,
      name: input.name?.trim() || registrationNumber,
      busTypeId: busType.id,
    });
  }

  updateBusStatus(id: string, status: 'ACTIVE' | 'MAINTENANCE' | 'RETIRED') {
    return this.prisma.bus.update({ where: { id }, data: { status } });
  }
}
