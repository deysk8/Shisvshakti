import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { CouponDiscountType, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export type CouponPreview = {
  code: string;
  description: string | null;
  discountType: CouponDiscountType;
  discountValue: number;
  discountAmount: number;
};

@Injectable()
export class CouponsService {
  constructor(private prisma: PrismaService) {}

  async preview(code: string, subtotalAmount: number): Promise<CouponPreview> {
    const coupon = await this.findValidCoupon(code);
    const discountAmount = this.computeDiscount(coupon, subtotalAmount);
    return {
      code: coupon.code,
      description: coupon.description,
      discountType: coupon.discountType,
      discountValue: Number(coupon.discountValue),
      discountAmount,
    };
  }

  computeDiscount(
    coupon: { discountType: CouponDiscountType; discountValue: unknown; minOrderAmount: unknown },
    subtotalAmount: number,
  ) {
    const minOrder = Number(coupon.minOrderAmount);
    if (subtotalAmount < minOrder) {
      throw new BadRequestException(`Minimum order amount is ₹${minOrder}`);
    }
    let discount =
      coupon.discountType === CouponDiscountType.PERCENT
        ? subtotalAmount * (Number(coupon.discountValue) / 100)
        : Number(coupon.discountValue);
    discount = Math.min(discount, subtotalAmount);
    return Math.round(discount * 100) / 100;
  }

  private async findValidCoupon(code: string) {
    const coupon = await this.prisma.coupon.findFirst({
      where: { code: code.toUpperCase().trim(), isActive: true },
    });
    if (!coupon) throw new NotFoundException('Invalid coupon code');
    const now = new Date();
    if (coupon.validFrom && coupon.validFrom > now) {
      throw new BadRequestException('Coupon is not active yet');
    }
    if (coupon.validTo && coupon.validTo < now) {
      throw new BadRequestException('Coupon has expired');
    }
    if (coupon.maxUses != null && coupon.usedCount >= coupon.maxUses) {
      throw new BadRequestException('Coupon usage limit reached');
    }
    return coupon;
  }

  async applyToBooking(
    code: string,
    subtotalAmount: number,
    bookingId: string,
    userId: string | null,
    tx: Prisma.TransactionClient,
  ) {
    const coupon = await this.findValidCoupon(code);
    const discountAmount = this.computeDiscount(coupon, subtotalAmount);
    await tx.couponRedemption.create({
      data: { couponId: coupon.id, bookingId, userId: userId ?? undefined },
    });
    await tx.coupon.update({
      where: { id: coupon.id },
      data: { usedCount: { increment: 1 } },
    });
    return { couponCode: coupon.code, discountAmount };
  }

  listActive() {
    return this.prisma.coupon.findMany({
      where: { isActive: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  listAll() {
    return this.prisma.coupon.findMany({
      orderBy: { createdAt: 'desc' },
    });
  }

  async remove(id: string) {
    const coupon = await this.prisma.coupon.findUniqueOrThrow({ where: { id } });
    const redemptions = await this.prisma.couponRedemption.count({ where: { couponId: id } });
    if (redemptions > 0) {
      return this.prisma.coupon.update({
        where: { id },
        data: { isActive: false },
      });
    }
    return this.prisma.coupon.delete({ where: { id } });
  }

  create(input: {
    code: string;
    description?: string;
    discountType: CouponDiscountType;
    discountValue: number;
    minOrderAmount?: number;
    maxUses?: number;
    validFrom?: Date;
    validTo?: Date;
  }) {
    return this.prisma.coupon.create({
      data: {
        code: input.code.toUpperCase().trim(),
        description: input.description,
        discountType: input.discountType,
        discountValue: input.discountValue,
        minOrderAmount: input.minOrderAmount ?? 0,
        maxUses: input.maxUses,
        validFrom: input.validFrom,
        validTo: input.validTo,
      },
    });
  }

  update(id: string, data: { isActive?: boolean; description?: string; validTo?: Date | null }) {
    return this.prisma.coupon.update({ where: { id }, data });
  }
}
