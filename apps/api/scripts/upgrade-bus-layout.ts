/**
 * One-time upgrade: replace launch bus seats with dual-deck layout.
 * Run: npx tsx scripts/upgrade-bus-layout.ts
 */
import { PrismaClient } from '@prisma/client';
import {
  buildShivaSaktiDualDeckLayout,
} from '../src/fleet/fleet.service';

const prisma = new PrismaClient();

async function main() {
  const reg = 'OD-05-SS-0001';
  const bus = await prisma.bus.findUnique({
    where: { registrationNumber: reg },
    include: { seats: true, busType: true },
  });
  if (!bus) {
    console.log('Bus not found — run seed first.');
    return;
  }

  let busType = await prisma.busType.findFirst({
    where: { name: 'Shiva Sakti Dual Deck AC' },
  });
  const { layoutConfig, seats: drafts } = buildShivaSaktiDualDeckLayout();
  if (!busType) {
    busType = await prisma.busType.create({
      data: {
        name: 'Shiva Sakti Dual Deck AC',
        layoutKind: 'SEATER_SLEEPER_MIX',
        totalSeats: drafts.length,
        layoutConfig,
      },
    });
  } else {
    await prisma.busType.update({
      where: { id: busType.id },
      data: { layoutConfig, totalSeats: drafts.length },
    });
  }

  await prisma.bus.update({
    where: { id: bus.id },
    data: { busTypeId: busType.id },
  });

  const hasBookings = await prisma.bookingSeat.count({
    where: { busSeatId: { in: bus.seats.map((s) => s.id) } },
  });
  if (hasBookings > 0) {
    console.error('Cannot replace seats — existing bookings on this bus.');
    process.exit(1);
  }

  await prisma.busSeat.deleteMany({ where: { busId: bus.id } });
  await prisma.busSeat.createMany({
    data: drafts.map((s) => ({
      busId: bus.id,
      seatLabel: s.seatLabel,
      deck: s.deck,
      rowIndex: s.rowIndex,
      colIndex: s.colIndex,
      seatType: s.seatType,
    })),
  });

  console.log(`Upgraded ${reg} to dual-deck layout (${drafts.length} seats).`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
