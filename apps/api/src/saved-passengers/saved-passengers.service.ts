import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class SavedPassengersService {
  constructor(private prisma: PrismaService) {}

  list(userId: string) {
    return this.prisma.savedPassenger.findMany({
      where: { userId },
      orderBy: [{ isDefault: 'desc' }, { updatedAt: 'desc' }],
    });
  }

  create(
    userId: string,
    input: { fullName: string; age?: number; gender?: string; phone?: string; isDefault?: boolean },
  ) {
    return this.prisma.$transaction(async (tx) => {
      if (input.isDefault) {
        await tx.savedPassenger.updateMany({ where: { userId }, data: { isDefault: false } });
      }
      return tx.savedPassenger.create({
        data: {
          userId,
          fullName: input.fullName.trim(),
          age: input.age,
          gender: input.gender,
          phone: input.phone,
          isDefault: input.isDefault ?? false,
        },
      });
    });
  }

  async remove(userId: string, id: string) {
    const row = await this.prisma.savedPassenger.findFirst({ where: { id, userId } });
    if (!row) return { ok: false };
    await this.prisma.savedPassenger.delete({ where: { id } });
    return { ok: true };
  }
}
