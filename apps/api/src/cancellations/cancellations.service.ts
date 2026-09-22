import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  BookingStatus,
  CancellationPolicy,
  PaymentMethod,
  PaymentStatus,
  RefundStatus,
  UserRole,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuthUser } from '../auth/types/auth-user.type';
import { PaymentsService } from '../payments/payments.service';
import { NotificationsService } from '../notifications/notifications.service';
import { PartnerWebhooksService } from '../partner/partner-webhooks.service';

@Injectable()
export class CancellationsService {
  constructor(
    private prisma: PrismaService,
    private payments: PaymentsService,
    private notifications: NotificationsService,
    private partnerWebhooks: PartnerWebhooksService,
  ) {}

  async listPolicies() {
    const policies = await this.prisma.cancellationPolicy.findMany({
      where: { isActive: true },
      orderBy: { priority: 'desc' },
    });
    return policies.map((policy) => ({
      id: policy.id,
      name: policy.name,
      minHoursBeforeDeparture: policy.minHoursBeforeDeparture,
      maxHoursBeforeDeparture: policy.maxHoursBeforeDeparture,
      refundPercent: Number(policy.refundPercent),
      priority: policy.priority,
    }));
  }

  async previewCancellation(reference: string, user: AuthUser) {
    const booking = await this.loadCancellableBooking(reference, user);
    const hoursBefore = this.hoursBeforeDeparture(booking.trip.departureAt);
    const policy = await this.resolvePolicy(hoursBefore);
    const refundPercent = policy ? Number(policy.refundPercent) : 0;
    const refundAmount = this.roundMoney((Number(booking.totalAmount) * refundPercent) / 100);

    return {
      bookingReference: booking.bookingReference,
      status: booking.status,
      departureAt: booking.trip.departureAt.toISOString(),
      hoursBeforeDeparture: Math.max(0, Math.round(hoursBefore * 10) / 10),
      canCancel: this.canCancelBooking(booking),
      policy: policy
        ? {
            id: policy.id,
            name: policy.name,
            refundPercent,
          }
        : null,
      totalAmount: Number(booking.totalAmount),
      refundAmount,
      paymentMethod: booking.paymentMethod,
    };
  }

  async cancelBooking(reference: string, user: AuthUser, reason?: string) {
    const booking = await this.loadCancellableBooking(reference, user);
    if (!this.canCancelBooking(booking)) {
      throw new BadRequestException('This booking cannot be cancelled');
    }

    const hoursBefore = this.hoursBeforeDeparture(booking.trip.departureAt);
    const policy = await this.resolvePolicy(hoursBefore);
    const refundPercent = policy ? Number(policy.refundPercent) : 0;
    const refundAmount = this.roundMoney((Number(booking.totalAmount) * refundPercent) / 100);

    const result = await this.prisma.$transaction(async (tx) => {
      await tx.booking.update({
        where: { id: booking.id },
        data: {
          status: BookingStatus.CANCELLED,
          cancelledAt: new Date(),
          cancellationReason: reason?.trim() || null,
          refundStatus:
            refundAmount > 0 && booking.payment?.status === PaymentStatus.CAPTURED
              ? RefundStatus.PROCESSING
              : refundAmount > 0
                ? RefundStatus.PENDING
                : RefundStatus.NOT_APPLICABLE,
        },
      });

      await tx.bookingSeat.updateMany({
        where: { bookingId: booking.id },
        data: { occupancyStatus: 'RELEASED' },
      });

      let refundRecord = null;
      if (refundAmount > 0 || policy) {
        refundRecord = await tx.refund.create({
          data: {
            bookingId: booking.id,
            paymentId: booking.payment?.id ?? null,
            cancellationPolicyId: policy?.id ?? null,
            requestedAmount: refundAmount,
            approvedAmount: refundAmount,
            status:
              refundAmount > 0 && booking.payment?.status === PaymentStatus.CAPTURED
                ? RefundStatus.PROCESSING
                : refundAmount > 0
                  ? RefundStatus.PENDING
                  : RefundStatus.COMPLETED,
          },
        });
      }

      return { refundRecord, refundAmount };
    });

    let refundStatus: RefundStatus = RefundStatus.NOT_APPLICABLE;
    let gatewayRefundId: string | null = null;

    if (result.refundAmount > 0 && booking.payment?.status === PaymentStatus.CAPTURED) {
      const processed = await this.payments.processRefund({
        bookingId: booking.id,
        paymentId: booking.payment.id,
        amount: result.refundAmount,
        refundId: result.refundRecord?.id,
      });
      refundStatus = processed.status;
      gatewayRefundId = processed.gatewayRefundId;
    } else if (result.refundAmount > 0) {
      refundStatus = RefundStatus.PENDING;
    }

    if (result.refundRecord) {
      await this.prisma.refund.update({
        where: { id: result.refundRecord.id },
        data: {
          status: refundStatus,
          gatewayRefundId,
          processedAt:
            refundStatus === RefundStatus.COMPLETED || refundStatus === RefundStatus.PROCESSING
              ? new Date()
              : null,
        },
      });
    }

    await this.prisma.booking.update({
      where: { id: booking.id },
      data: { refundStatus },
    });

    await this.notifications.queueBookingCancelled(booking.id, {
      refundAmount: result.refundAmount,
      refundPercent,
      policyName: policy?.name ?? 'No refund',
    });

    this.partnerWebhooks.notifySeatsReleased(booking.id);

    return {
      bookingReference: booking.bookingReference,
      status: BookingStatus.CANCELLED,
      refundAmount: result.refundAmount,
      refundPercent,
      refundStatus,
      policyName: policy?.name ?? null,
    };
  }

  /** Full refund when operator cancels a trip (admin action). */
  async operatorCancelBooking(bookingId: string, reason: string) {
    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
      include: { trip: true, payment: true },
    });
    if (!booking) {
      return { bookingReference: null as string | null, skipped: true as const, reason: 'not_found' };
    }
    if (booking.status === BookingStatus.CANCELLED) {
      return { bookingReference: booking.bookingReference, skipped: true as const, reason: 'already_cancelled' };
    }
    if (
      booking.status !== BookingStatus.CONFIRMED &&
      booking.status !== BookingStatus.PENDING_PAYMENT &&
      booking.status !== BookingStatus.SEATS_LOCKED
    ) {
      return { bookingReference: booking.bookingReference, skipped: true as const, reason: 'status' };
    }

    const refundAmount = this.roundMoney(Number(booking.totalAmount));
    const cancelReason = reason.trim() || 'Trip cancelled by operator';

    const result = await this.prisma.$transaction(async (tx) => {
      await tx.booking.update({
        where: { id: booking.id },
        data: {
          status: BookingStatus.CANCELLED,
          cancelledAt: new Date(),
          cancellationReason: cancelReason,
          refundStatus:
            refundAmount > 0 && booking.payment?.status === PaymentStatus.CAPTURED
              ? RefundStatus.PROCESSING
              : refundAmount > 0
                ? RefundStatus.PENDING
                : RefundStatus.NOT_APPLICABLE,
        },
      });

      await tx.bookingSeat.updateMany({
        where: { bookingId: booking.id },
        data: { occupancyStatus: 'RELEASED' },
      });

      let refundRecord = null;
      if (refundAmount > 0) {
        refundRecord = await tx.refund.create({
          data: {
            bookingId: booking.id,
            paymentId: booking.payment?.id ?? null,
            cancellationPolicyId: null,
            requestedAmount: refundAmount,
            approvedAmount: refundAmount,
            status:
              booking.payment?.status === PaymentStatus.CAPTURED
                ? RefundStatus.PROCESSING
                : RefundStatus.PENDING,
          },
        });
      }

      return { refundRecord, refundAmount };
    });

    let refundStatus: RefundStatus = RefundStatus.NOT_APPLICABLE;
    let gatewayRefundId: string | null = null;

    if (result.refundAmount > 0 && booking.payment?.status === PaymentStatus.CAPTURED) {
      const processed = await this.payments.processRefund({
        bookingId: booking.id,
        paymentId: booking.payment.id,
        amount: result.refundAmount,
        refundId: result.refundRecord?.id,
      });
      refundStatus = processed.status;
      gatewayRefundId = processed.gatewayRefundId;
    } else if (result.refundAmount > 0) {
      refundStatus = RefundStatus.PENDING;
    }

    if (result.refundRecord) {
      await this.prisma.refund.update({
        where: { id: result.refundRecord.id },
        data: {
          status: refundStatus,
          gatewayRefundId,
          processedAt:
            refundStatus === RefundStatus.COMPLETED || refundStatus === RefundStatus.PROCESSING
              ? new Date()
              : null,
        },
      });
    }

    await this.prisma.booking.update({
      where: { id: booking.id },
      data: { refundStatus },
    });

    await this.notifications.queueBookingCancelled(booking.id, {
      refundAmount: result.refundAmount,
      refundPercent: 100,
      policyName: 'Trip cancelled by operator',
    });

    this.partnerWebhooks.notifySeatsReleased(booking.id);

    return {
      bookingReference: booking.bookingReference,
      skipped: false as const,
      refundAmount: result.refundAmount,
      refundStatus,
    };
  }

  /** Partner-initiated cancel — seats released; refund handled offline with OTA. */
  async partnerCancelBooking(partnerChannelId: string, partnerReference: string, reason?: string) {
    const booking = await this.prisma.booking.findFirst({
      where: { partnerChannelId, partnerReference: partnerReference.trim() },
      include: { trip: true },
    });
    if (!booking) throw new NotFoundException('Partner booking not found');

    if (booking.status === BookingStatus.CANCELLED) {
      return {
        partnerReference: booking.partnerReference,
        bookingReference: booking.bookingReference,
        status: BookingStatus.CANCELLED,
        alreadyCancelled: true,
        refundAmount: 0,
        refundPercent: 0,
      };
    }

    if (!this.canCancelBooking(booking)) {
      throw new BadRequestException('This booking cannot be cancelled');
    }

    const hoursBefore = this.hoursBeforeDeparture(booking.trip.departureAt);
    const policy = await this.resolvePolicy(hoursBefore);
    const refundPercent = policy ? Number(policy.refundPercent) : 0;
    const refundAmount = this.roundMoney((Number(booking.totalAmount) * refundPercent) / 100);
    const cancelReason = reason?.trim() || 'Cancelled by partner';

    await this.prisma.$transaction(async (tx) => {
      await tx.booking.update({
        where: { id: booking.id },
        data: {
          status: BookingStatus.CANCELLED,
          cancelledAt: new Date(),
          cancellationReason: cancelReason,
          refundStatus: RefundStatus.NOT_APPLICABLE,
        },
      });
      await tx.bookingSeat.updateMany({
        where: { bookingId: booking.id },
        data: { occupancyStatus: 'RELEASED' },
      });
    });

    await this.notifications.queueBookingCancelled(booking.id, {
      refundAmount,
      refundPercent,
      policyName: policy?.name ?? 'Partner cancellation',
    });

    this.partnerWebhooks.notifySeatsReleased(booking.id, partnerChannelId);

    return {
      partnerReference: booking.partnerReference,
      bookingReference: booking.bookingReference,
      status: BookingStatus.CANCELLED,
      alreadyCancelled: false,
      refundAmount,
      refundPercent,
      policyName: policy?.name ?? null,
      note: 'Refund settlement is between operator and partner (OTA).',
    };
  }

  private async loadCancellableBooking(reference: string, user: AuthUser) {
    const booking = await this.prisma.booking.findFirst({
      where: { bookingReference: reference },
      include: {
        trip: true,
        payment: true,
        agent: true,
      },
    });
    if (!booking) throw new NotFoundException('Booking not found');
    if (!this.userCanAccess(booking, user)) {
      throw new ForbiddenException('Not allowed to manage this booking');
    }
    return booking;
  }

  private userCanAccess(
    booking: { customerUserId: string | null; agent: { userId: string } | null },
    user: AuthUser,
  ) {
    if (user.role === UserRole.ADMIN) return true;
    if (booking.customerUserId === user.id) return true;
    if (booking.agent?.userId === user.id) return true;
    return false;
  }

  private canCancelBooking(booking: {
    status: BookingStatus;
    trip: { departureAt: Date; status: string };
  }) {
    if (booking.status === BookingStatus.CANCELLED) return false;
    if (
      booking.status !== BookingStatus.CONFIRMED &&
      booking.status !== BookingStatus.PENDING_PAYMENT
    ) {
      return false;
    }
    if (['COMPLETED', 'CANCELLED'].includes(booking.trip.status)) return false;
    return booking.trip.departureAt.getTime() > Date.now();
  }

  private hoursBeforeDeparture(departureAt: Date) {
    return (departureAt.getTime() - Date.now()) / (1000 * 60 * 60);
  }

  private async resolvePolicy(hoursBeforeDeparture: number): Promise<CancellationPolicy | null> {
    const policies = await this.prisma.cancellationPolicy.findMany({
      where: { isActive: true },
      orderBy: { priority: 'desc' },
    });

    for (const policy of policies) {
      if (hoursBeforeDeparture < policy.minHoursBeforeDeparture) continue;
      if (
        policy.maxHoursBeforeDeparture != null &&
        hoursBeforeDeparture >= policy.maxHoursBeforeDeparture
      ) {
        continue;
      }
      return policy;
    }

    return null;
  }

  private roundMoney(value: number) {
    return Math.round(value * 100) / 100;
  }
}
