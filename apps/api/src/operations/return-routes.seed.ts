import { PrismaClient } from '@prisma/client';
import { LAUNCH_ROUTE_CODE } from '@shiva-sakti/shared';

/** Deactivate every route except the launch route — only JRG-BLR stays bookable. */
export async function deactivateLegacyRoutes(prisma: PrismaClient) {
  const legacy = await prisma.route.findMany({
    where: {
      code: { not: LAUNCH_ROUTE_CODE },
      isActive: true,
    },
    select: { id: true, code: true },
  });

  if (!legacy.length) {
    return { deactivated: 0 };
  }

  await prisma.$transaction(async (tx) => {
    for (const route of legacy) {
      await tx.route.update({
        where: { id: route.id },
        data: { isActive: false },
      });
      await tx.schedule.updateMany({
        where: { routeId: route.id },
        data: { isActive: false },
      });
      await tx.trip.updateMany({
        where: { routeId: route.id, status: 'SCHEDULED' },
        data: { status: 'CANCELLED' },
      });
    }
  });

  console.log(
    'Legacy routes deactivated:',
    legacy.map((r) => r.code).join(', '),
    `(active route: ${LAUNCH_ROUTE_CODE})`,
  );
  return { deactivated: legacy.length, codes: legacy.map((r) => r.code) };
}

/** @deprecated Use deactivateLegacyRoutes — return routes are no longer seeded. */
export async function seedReturnRoutes(prisma: PrismaClient) {
  return deactivateLegacyRoutes(prisma);
}
