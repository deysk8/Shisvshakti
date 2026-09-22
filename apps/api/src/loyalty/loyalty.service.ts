import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class LoyaltyService {
  constructor(private prisma: PrismaService) {}

  async getOrCreateAccount(userId: string) {
    return this.prisma.loyaltyAccount.upsert({
      where: { userId },
      create: { userId, pointsBalance: 0 },
      update: {},
    });
  }

  async getBalance(userId: string) {
    const account = await this.getOrCreateAccount(userId);
    return { pointsBalance: account.pointsBalance };
  }

  async getHistory(userId: string, take = 20) {
    const account = await this.getOrCreateAccount(userId);
    const transactions = await this.prisma.loyaltyTransaction.findMany({
      where: { accountId: account.id },
      orderBy: { createdAt: 'desc' },
      take,
      include: { booking: { select: { bookingReference: true } } },
    });
    return {
      pointsBalance: account.pointsBalance,
      transactions: transactions.map((t) => ({
        delta: t.delta,
        reason: t.reason,
        bookingReference: t.booking?.bookingReference ?? null,
        createdAt: t.createdAt.toISOString(),
      })),
    };
  }

  /** 1 point earned per ₹100 on confirmed booking total */
  computeEarnPoints(totalAmount: number) {
    return Math.floor(totalAmount / 100);
  }

  /** 1 point = ₹1 discount at checkout */
  computeRedeemDiscount(points: number) {
    return Math.max(0, Math.floor(points));
  }

  async validateRedemption(userId: string, pointsToRedeem: number, subtotalAfterOtherDiscounts: number) {
    if (pointsToRedeem <= 0) return { discount: 0, pointsToRedeem: 0 };
    const account = await this.getOrCreateAccount(userId);
    if (pointsToRedeem > account.pointsBalance) {
      throw new BadRequestException('Not enough loyalty points');
    }
    const discount = Math.min(
      this.computeRedeemDiscount(pointsToRedeem),
      Math.floor(subtotalAfterOtherDiscounts),
    );
    return { discount, pointsToRedeem: discount };
  }

  async redeemForBooking(
    userId: string,
    bookingId: string,
    points: number,
    tx?: Prisma.TransactionClient,
  ) {
    if (points <= 0) return;
    const db = tx ?? this.prisma;
    const account = await db.loyaltyAccount.findUniqueOrThrow({ where: { userId } });
    await db.loyaltyAccount.update({
      where: { id: account.id },
      data: { pointsBalance: { decrement: points } },
    });
    await db.loyaltyTransaction.create({
      data: {
        accountId: account.id,
        bookingId,
        delta: -points,
        reason: 'REDEEMED',
      },
    });
  }

  async earnForBooking(userId: string | null | undefined, bookingId: string, totalAmount: number) {
    if (!userId) return 0;
    const points = this.computeEarnPoints(totalAmount);
    if (points <= 0) return 0;

    const account = await this.getOrCreateAccount(userId);
    await this.prisma.loyaltyAccount.update({
      where: { id: account.id },
      data: { pointsBalance: { increment: points } },
    });
    await this.prisma.loyaltyTransaction.create({
      data: {
        accountId: account.id,
        bookingId,
        delta: points,
        reason: 'EARNED',
      },
    });
    return points;
  }
}
