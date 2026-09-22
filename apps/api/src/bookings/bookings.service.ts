import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BookingSource, BookingStatus, PartnerChannelCode, Prisma, RefundStatus, UserRole } from '@prisma/client';
import { randomBytes } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { TicketsService } from '../tickets/tickets.service';
import { LoyaltyService } from '../loyalty/loyalty.service';
import { CouponsService } from '../coupons/coupons.service';
import { InvoicesService } from '../invoices/invoices.service';
import { PricingService } from '../pricing/pricing.service';
import { PartnerWebhooksService } from '../partner/partner-webhooks.service';
import { AuthUser } from '../auth/types/auth-user.type';
import { CreateBookingDraftDto, LockSeatsDto } from './dto/booking.dto';
import { PartnerConfirmBookingDto } from '../partner/dto/partner.dto';
import { AuthenticatedPartnerChannel } from '../partner/types/partner-channel.type';

@Injectable()
export class BookingsService {
  private readonly logger = new Logger(BookingsService.name);

  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
    private tickets: TicketsService,
    private notifications: NotificationsService,
    private loyalty: LoyaltyService,
    private coupons: CouponsService,
    private invoices: InvoicesService,
    private pricing: PricingService,
    private partnerWebhooks: PartnerWebhooksService,
  ) {}

  async lockSeats(user: AuthUser, dto: LockSeatsDto) {
    return this.lockSeatsForUser(user.id, dto);
  }

  async lockSeatsForUser(userId: string, dto: LockSeatsDto) {
    const trip = await this.prisma.trip.findUnique({
      where: { id: dto.tripId },
      include: { bus: true },
    });
    if (!trip || trip.status !== 'SCHEDULED') {
      throw new NotFoundException('Trip not available');
    }

    const ttlSec =
      (await this.prisma.companySettings.findFirst())?.seatLockTtlSeconds ??
      this.config.get<number>('SEAT_LOCK_TTL_SECONDS', 600);
    const expiresAt = new Date(Date.now() + ttlSec * 1000);
    const lockToken = randomBytes(24).toString('hex');

    const seatIds = [...dto.seatIds].sort();
    await this.prisma.$transaction(async (tx) => {
      for (const busSeatId of seatIds) {
        const occupied = await tx.bookingSeat.findFirst({
          where: { tripId: dto.tripId, busSeatId, occupancyStatus: 'OCCUPIED' },
        });
        if (occupied) {
          throw new ConflictException(`Seat already booked`);
        }
        const activeLock = await tx.seatLock.findFirst({
          where: {
            tripId: dto.tripId,
            busSeatId,
            status: 'ACTIVE',
            expiresAt: { gt: new Date() },
          },
        });
        if (activeLock && activeLock.lockedByUserId !== userId) {
          throw new ConflictException(`Seat temporarily unavailable`);
        }
      }

      for (const busSeatId of seatIds) {
        await tx.seatLock.updateMany({
          where: {
            tripId: dto.tripId,
            busSeatId,
            lockedByUserId: userId,
            status: 'ACTIVE',
          },
          data: { status: 'RELEASED', releasedAt: new Date() },
        });
        await tx.seatLock.create({
          data: {
            tripId: dto.tripId,
            busSeatId,
            lockedByUserId: userId,
            lockToken,
            status: 'ACTIVE',
            expiresAt,
          },
        });
      }
    });

    return { lockToken, expiresAt: expiresAt.toISOString(), seatIds };
  }

  async validateLock(user: AuthUser, lockToken: string, tripId: string) {
    const locks = await this.prisma.seatLock.findMany({
      where: {
        lockToken,
        lockedByUserId: user.id,
        status: 'ACTIVE',
        expiresAt: { gt: new Date() },
      },
      select: { tripId: true, busSeatId: true, expiresAt: true },
    });

    if (!locks.length) {
      return { valid: false as const, reason: 'expired' as const };
    }
    if (locks.some((lock) => lock.tripId !== tripId)) {
      return { valid: false as const, reason: 'trip_mismatch' as const };
    }

    return {
      valid: true as const,
      expiresAt: locks[0].expiresAt.toISOString(),
      seatIds: locks.map((lock) => lock.busSeatId),
    };
  }

  async createDraft(user: AuthUser, dto: CreateBookingDraftDto) {
    const locks = await this.prisma.seatLock.findMany({
      where: {
        lockToken: dto.lockToken,
        lockedByUserId: user.id,
        status: 'ACTIVE',
        expiresAt: { gt: new Date() },
      },
    });
    if (!locks.length) {
      throw new BadRequestException(
        'Seat lock expired or invalid — go back and select your seats again',
      );
    }

    if (locks.some((lock) => lock.tripId !== dto.tripId)) {
      throw new BadRequestException('Seat lock does not match this trip');
    }

    const trip = await this.prisma.trip.findUniqueOrThrow({
      where: { id: dto.tripId },
    });

    const fareRule = await this.prisma.fareRule.findFirst({
      where: {
        routeId: trip.routeId,
        fromSequence: dto.boardingSequence,
        toSequence: dto.droppingSequence,
        isActive: true,
      },
    });
    if (!fareRule) throw new BadRequestException('Fare not configured for this segment');

    const seatIds = locks.map((lock) => lock.busSeatId);
    const seatFareMap = await this.pricing.resolveSeatFaresForTrip(
      dto.tripId,
      seatIds,
      dto.boardingSequence,
      dto.droppingSequence,
    );
    const perSeatFares = seatIds.map((id) => seatFareMap.get(id)?.amount ?? Number(fareRule.amount));
    const subtotalAmount = perSeatFares.reduce((sum, amount) => sum + amount, 0);
    const company = await this.prisma.companySettings.findFirst();
    let discountAmount = 0;

    if (dto.seniorCitizen) {
      if (!company?.seniorDiscountEnabled) {
        throw new BadRequestException('Senior citizen discount is not available right now');
      }
      const pct = Number(company.seniorDiscountPercent ?? 10) / 100;
      discountAmount += subtotalAmount * pct;
    }

    const childMaxAge = company?.childMaxAge ?? 11;
    const hasChildPassenger =
      company?.childDiscountEnabled &&
      dto.passengers.some((p) => p.age != null && p.age <= childMaxAge);
    if (hasChildPassenger) {
      const pct = Number(company?.childDiscountPercent ?? 25) / 100;
      discountAmount += subtotalAmount * pct;
    }
    discountAmount = Math.round(discountAmount * 100) / 100;
    let afterDemographic = Math.max(0, subtotalAmount - discountAmount);

    const boarding = await this.prisma.routeStop.findFirst({
      where: { routeId: trip.routeId, sequence: dto.boardingSequence },
    });
    const dropping = await this.prisma.routeStop.findFirst({
      where: { routeId: trip.routeId, sequence: dto.droppingSequence },
    });
    if (!boarding || !dropping || boarding.sequence >= dropping.sequence) {
      throw new BadRequestException('Invalid boarding/dropping stops');
    }

    const reference = this.generateReference();

    const isAgentBooking = user.role === UserRole.AGENT;
    const customerUserId = isAgentBooking
      ? (dto.customerUserId ?? null)
      : (dto.customerUserId ?? user.id);

    let couponCode: string | undefined;
    let loyaltyPointsRedeemed = 0;

    if (dto.couponCode?.trim()) {
      const couponPreview = await this.coupons.preview(dto.couponCode, afterDemographic);
      discountAmount += couponPreview.discountAmount;
      afterDemographic = Math.max(0, afterDemographic - couponPreview.discountAmount);
      couponCode = couponPreview.code;
    }

    if (dto.redeemLoyaltyPoints && customerUserId) {
      const redemption = await this.loyalty.validateRedemption(
        customerUserId,
        dto.redeemLoyaltyPoints,
        afterDemographic,
      );
      discountAmount += redemption.discount;
      loyaltyPointsRedeemed = redemption.pointsToRedeem;
      afterDemographic = Math.max(0, afterDemographic - redemption.discount);
    }

    discountAmount = Math.round(discountAmount * 100) / 100;
    const totalAmount = Math.max(0, Math.round(afterDemographic * 100) / 100);

    const booking = await this.prisma.$transaction(async (tx) => {
      const created = await tx.booking.create({
        data: {
          bookingReference: reference,
          tripId: dto.tripId,
          customerUserId,
          agentId: isAgentBooking ? await this.agentIdForUser(user.id, tx) : null,
          bookingSource: this.resolveBookingSource(user.role, dto.agentCash),
          status:
            dto.agentCash || this.resolveBookingSource(user.role, dto.agentCash) === BookingSource.ADMIN
              ? BookingStatus.CONFIRMED
              : BookingStatus.PENDING_PAYMENT,
          boardingRouteStopId: boarding.id,
          droppingRouteStopId: dropping.id,
          contactName: dto.contactName,
          contactPhone: dto.contactPhone,
          contactEmail: isAgentBooking
            ? dto.contactEmail || null
            : dto.contactEmail || user.email,
          subtotalAmount,
          discountAmount,
          couponCode,
          loyaltyPointsRedeemed,
          totalAmount,
          paymentMethod: dto.agentCash ? 'CASH' : undefined,
          passengers: {
            create: dto.passengers.map((p, idx) => ({
              fullName: p.fullName,
              age: p.age,
              gender: p.gender,
              phone: p.phone,
              isPrimary: idx === 0,
            })),
          },
        },
      });

      for (const lock of locks) {
        const seat = await tx.busSeat.findUniqueOrThrow({ where: { id: lock.busSeatId } });
        const seatFare = seatFareMap.get(lock.busSeatId)?.amount ?? Number(fareRule.amount);
        await tx.bookingSeat.create({
          data: {
            bookingId: created.id,
            tripId: dto.tripId,
            busSeatId: lock.busSeatId,
            seatLabel: seat.seatLabel,
            fareAmount: seatFare,
            occupancyStatus:
              created.status === BookingStatus.CONFIRMED ? 'OCCUPIED' : 'HELD',
          },
        });
        await tx.seatLock.update({
          where: { id: lock.id },
          data: { status: 'CONVERTED', bookingId: created.id },
        });
      }

      if (couponCode) {
        await this.coupons.applyToBooking(couponCode, subtotalAmount, created.id, customerUserId, tx);
      }
      if (loyaltyPointsRedeemed > 0 && customerUserId) {
        await this.loyalty.redeemForBooking(customerUserId, created.id, loyaltyPointsRedeemed, tx);
      }

      return created;
    });

    if (booking.status === BookingStatus.CONFIRMED) {
      await this.accrueAgentCommission(booking.id);
      await this.issueTicketAndNotifySafely(booking.id);
      await this.finalizeConfirmedBooking(booking.id);
      this.partnerWebhooks.notifySeatsBooked(booking.id);
    }

    return {
      bookingId: booking.id,
      bookingReference: booking.bookingReference,
      status: booking.status,
      totalAmount: Number(booking.totalAmount),
      paymentRequired: booking.status === BookingStatus.PENDING_PAYMENT,
    };
  }

  async confirmAfterPayment(bookingId: string) {
    const existing = await this.prisma.booking.findUniqueOrThrow({ where: { id: bookingId } });
    if (existing.status === BookingStatus.CONFIRMED) {
      await this.issueTicketAndNotifySafely(bookingId);
      return {
        bookingId,
        status: BookingStatus.CONFIRMED,
        bookingReference: existing.bookingReference,
        alreadyConfirmed: true,
      };
    }

    const result = await this.prisma.$transaction(async (tx) => {
      const booking = await tx.booking.findUniqueOrThrow({ where: { id: bookingId } });
      if (booking.status !== BookingStatus.PENDING_PAYMENT) {
        throw new BadRequestException('Booking is not awaiting payment');
      }
      await tx.booking.update({
        where: { id: bookingId },
        data: { status: BookingStatus.CONFIRMED, paymentMethod: 'CASHFREE' },
      });
      await tx.bookingSeat.updateMany({
        where: { bookingId },
        data: { occupancyStatus: 'OCCUPIED' },
      });
      return { bookingId, status: BookingStatus.CONFIRMED, bookingReference: booking.bookingReference };
    });

    await this.issueTicketAndNotifySafely(bookingId);
    await this.accrueAgentCommission(bookingId);
    await this.finalizeConfirmedBooking(bookingId);
    this.partnerWebhooks.notifySeatsBooked(bookingId);
    return result;
  }

  async rescheduleBooking(
    user: AuthUser,
    reference: string,
    dto: {
      tripId: string;
      lockToken: string;
      boardingSequence?: number;
      droppingSequence?: number;
    },
  ) {
    const existing = await this.prisma.booking.findFirst({
      where: {
        bookingReference: reference,
        OR: [{ customerUserId: user.id }, { agent: { userId: user.id } }],
      },
      include: {
        passengers: true,
        seats: true,
        boardingStop: true,
        droppingStop: true,
      },
    });
    if (!existing) throw new NotFoundException('Booking not found');
    if (existing.status !== BookingStatus.CONFIRMED) {
      throw new BadRequestException('Only confirmed bookings can be rescheduled');
    }
    if (existing.rescheduleUsed) {
      throw new BadRequestException('This booking has already been rescheduled once');
    }

    const trip = await this.prisma.trip.findUnique({ where: { id: existing.tripId } });
    if (!trip || trip.departureAt.getTime() <= Date.now()) {
      throw new BadRequestException('Original trip has departed');
    }

    const locks = await this.prisma.seatLock.findMany({
      where: {
        lockToken: dto.lockToken,
        lockedByUserId: user.id,
        status: 'ACTIVE',
        expiresAt: { gt: new Date() },
        tripId: dto.tripId,
      },
    });
    if (!locks.length) {
      throw new BadRequestException('Seat lock expired or invalid');
    }
    if (locks.length !== existing.seats.length) {
      throw new BadRequestException(
        `Select exactly ${existing.seats.length} seat${existing.seats.length === 1 ? '' : 's'} for reschedule`,
      );
    }

    const boardingSequence = existing.boardingStop.sequence;
    const droppingSequence = existing.droppingStop.sequence;
    if (
      (dto.boardingSequence != null && dto.boardingSequence !== boardingSequence) ||
      (dto.droppingSequence != null && dto.droppingSequence !== droppingSequence)
    ) {
      throw new BadRequestException('Reschedule must keep the same boarding and dropping stops');
    }

    const oldPaidAmount = Number(existing.totalAmount);
    const wasCash = existing.paymentMethod === 'CASH';
    const wasOnlinePaid = existing.paymentMethod === 'CASHFREE';

    await this.prisma.$transaction(async (tx) => {
      await tx.booking.update({
        where: { id: existing.id },
        data: {
          status: BookingStatus.CANCELLED,
          cancelledAt: new Date(),
          cancellationReason: 'Rescheduled to new trip',
          rescheduleUsed: true,
          refundStatus: RefundStatus.NOT_APPLICABLE,
        },
      });
      await tx.bookingSeat.updateMany({
        where: { bookingId: existing.id },
        data: { occupancyStatus: 'RELEASED' },
      });
    });
    this.partnerWebhooks.notifySeatsReleased(existing.id);

    const primary = existing.passengers.find((p) => p.isPrimary) ?? existing.passengers[0];
    const draft = await this.createDraft(user, {
      tripId: dto.tripId,
      lockToken: dto.lockToken,
      boardingSequence,
      droppingSequence,
      contactName: existing.contactName ?? primary?.fullName ?? 'Passenger',
      contactPhone: existing.contactPhone ?? primary?.phone ?? '',
      contactEmail: existing.contactEmail ?? undefined,
      passengers: existing.passengers.map((p) => ({
        fullName: p.fullName,
        age: p.age ?? undefined,
        gender: p.gender ?? undefined,
        phone: p.phone ?? undefined,
      })),
      agentCash: wasCash,
    });

    const newTotal = Number(draft.totalAmount);
    if (wasOnlinePaid && newTotal <= oldPaidAmount && draft.status === BookingStatus.PENDING_PAYMENT) {
      await this.prisma.$transaction(async (tx) => {
        await tx.booking.update({
          where: { id: draft.bookingId },
          data: { status: BookingStatus.CONFIRMED, paymentMethod: 'CASHFREE' },
        });
        await tx.bookingSeat.updateMany({
          where: { bookingId: draft.bookingId },
          data: { occupancyStatus: 'OCCUPIED' },
        });
      });
      await this.issueTicketAndNotifySafely(draft.bookingId);
      await this.accrueAgentCommission(draft.bookingId);
      this.partnerWebhooks.notifySeatsBooked(draft.bookingId);
      return {
        ...draft,
        status: BookingStatus.CONFIRMED,
        paymentRequired: false,
        rescheduledFree: true,
      };
    }

    return {
      ...draft,
      paymentRequired: draft.status === BookingStatus.PENDING_PAYMENT,
      fareDifference: Math.max(0, newTotal - oldPaidAmount),
    };
  }

  async confirmPartnerBooking(channel: AuthenticatedPartnerChannel, dto: PartnerConfirmBookingDto) {
    const partnerReference = dto.partnerReference.trim();
    const existing = await this.prisma.booking.findFirst({
      where: { partnerChannelId: channel.id, partnerReference },
      include: { seats: true, passengers: true, ticket: true },
    });
    if (existing) {
      return this.mapPartnerBookingResponse(existing, true);
    }

    const locks = await this.prisma.seatLock.findMany({
      where: {
        lockToken: dto.lockToken,
        lockedByUserId: channel.systemUserId,
        status: 'ACTIVE',
        expiresAt: { gt: new Date() },
      },
    });
    if (!locks.length) {
      throw new BadRequestException('Seat lock expired or invalid — lock seats again');
    }
    if (locks.some((lock) => lock.tripId !== dto.tripId)) {
      throw new BadRequestException('Seat lock does not match this trip');
    }

    const trip = await this.prisma.trip.findUniqueOrThrow({ where: { id: dto.tripId } });
    if (trip.status !== 'SCHEDULED') {
      throw new BadRequestException('Trip is not available for booking');
    }

    const fareRule = await this.prisma.fareRule.findFirst({
      where: {
        routeId: trip.routeId,
        fromSequence: dto.boardingSequence,
        toSequence: dto.droppingSequence,
        isActive: true,
      },
    });
    if (!fareRule) throw new BadRequestException('Fare not configured for this segment');

    const boarding = await this.prisma.routeStop.findFirst({
      where: { routeId: trip.routeId, sequence: dto.boardingSequence },
    });
    const dropping = await this.prisma.routeStop.findFirst({
      where: { routeId: trip.routeId, sequence: dto.droppingSequence },
    });
    if (!boarding || !dropping || boarding.sequence >= dropping.sequence) {
      throw new BadRequestException('Invalid boarding/dropping stops');
    }

    const seatIds = locks.map((lock) => lock.busSeatId);
    const seatFareMap = await this.pricing.resolveSeatFaresForTrip(
      dto.tripId,
      seatIds,
      dto.boardingSequence,
      dto.droppingSequence,
    );
    const perSeatFares = seatIds.map((id) => seatFareMap.get(id)?.amount ?? Number(fareRule.amount));
    const subtotalAmount = perSeatFares.reduce((sum, amount) => sum + amount, 0);
    const totalAmount = Math.round(subtotalAmount * 100) / 100;
    const reference = this.generateReference();
    const bookingSource = this.partnerBookingSource(channel.code);

    const booking = await this.prisma.$transaction(async (tx) => {
      const created = await tx.booking.create({
        data: {
          bookingReference: reference,
          tripId: dto.tripId,
          bookingSource,
          status: BookingStatus.CONFIRMED,
          boardingRouteStopId: boarding.id,
          droppingRouteStopId: dropping.id,
          contactName: dto.contactName,
          contactPhone: dto.contactPhone,
          contactEmail: dto.contactEmail ?? null,
          subtotalAmount,
          discountAmount: 0,
          totalAmount,
          paymentMethod: 'OTHER',
          partnerChannelId: channel.id,
          partnerReference,
          passengers: {
            create: dto.passengers.map((p, idx) => ({
              fullName: p.fullName,
              age: p.age,
              gender: p.gender,
              phone: p.phone,
              isPrimary: idx === 0,
            })),
          },
        },
      });

      for (const lock of locks) {
        const seat = await tx.busSeat.findUniqueOrThrow({ where: { id: lock.busSeatId } });
        const seatFare = seatFareMap.get(lock.busSeatId)?.amount ?? Number(fareRule.amount);
        await tx.bookingSeat.create({
          data: {
            bookingId: created.id,
            tripId: dto.tripId,
            busSeatId: lock.busSeatId,
            seatLabel: seat.seatLabel,
            fareAmount: seatFare,
            occupancyStatus: 'OCCUPIED',
          },
        });
        await tx.seatLock.update({
          where: { id: lock.id },
          data: { status: 'CONVERTED', bookingId: created.id },
        });
      }

      return created;
    });

    await this.issueTicketAndNotifySafely(booking.id);
    await this.finalizeConfirmedBooking(booking.id);
    this.partnerWebhooks.notifySeatsBooked(booking.id, channel.id);

    const full = await this.prisma.booking.findUniqueOrThrow({
      where: { id: booking.id },
      include: { seats: true, passengers: true, ticket: true },
    });

    return this.mapPartnerBookingResponse(full, false, dto.totalAmountPaid);
  }

  async getPartnerBooking(partnerChannelId: string, partnerReference: string) {
    const booking = await this.prisma.booking.findFirst({
      where: { partnerChannelId, partnerReference: partnerReference.trim() },
      include: { seats: true, passengers: true, ticket: true, trip: { include: { route: true } } },
    });
    if (!booking) throw new NotFoundException('Partner booking not found');
    return this.mapPartnerBookingResponse(booking, true);
  }

  private mapPartnerBookingResponse(
    booking: {
      id: string;
      bookingReference: string;
      partnerReference: string | null;
      status: BookingStatus;
      totalAmount: unknown;
      subtotalAmount: unknown;
      contactName: string | null;
      contactPhone: string | null;
      contactEmail: string | null;
      createdAt: Date;
      seats: { seatLabel: string; fareAmount: unknown }[];
      passengers: { fullName: string; age: number | null; gender: string | null }[];
      ticket?: { qrToken: string } | null;
      trip?: { departureAt: Date; route: { code: string; name: string } };
    },
    idempotent: boolean,
    partnerAmountPaid?: number,
  ) {
    return {
      idempotent,
      bookingId: booking.id,
      bookingReference: booking.bookingReference,
      partnerReference: booking.partnerReference,
      status: booking.status,
      totalAmount: Number(booking.totalAmount),
      subtotalAmount: Number(booking.subtotalAmount),
      partnerAmountPaid: partnerAmountPaid ?? null,
      contactName: booking.contactName,
      contactPhone: booking.contactPhone,
      contactEmail: booking.contactEmail,
      seats: booking.seats.map((seat) => ({
        label: seat.seatLabel,
        fare: Number(seat.fareAmount),
      })),
      passengers: booking.passengers.map((p) => ({
        fullName: p.fullName,
        age: p.age,
        gender: p.gender,
      })),
      ticketQrToken: booking.ticket?.qrToken ?? null,
      route: booking.trip
        ? { code: booking.trip.route.code, name: booking.trip.route.name }
        : null,
      departureAt: booking.trip?.departureAt.toISOString() ?? null,
      createdAt: booking.createdAt.toISOString(),
    };
  }

  private partnerBookingSource(code: PartnerChannelCode): BookingSource {
    return code === PartnerChannelCode.REDBUS
      ? BookingSource.PARTNER_REDBUS
      : BookingSource.PARTNER_ABHIBUS;
  }

  private async accrueAgentCommission(bookingId: string) {
    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
      include: { agent: true },
    });
    if (!booking?.agentId || !booking.agent) return;

    const existing = await this.prisma.agentCommission.findUnique({ where: { bookingId } });
    if (existing) return;

    const company = await this.prisma.companySettings.findFirst();
    const cap = Number(company?.defaultCommissionCapPercent ?? 4);
    const rate = Math.min(Number(booking.agent.commissionRatePercent), cap);
    const commissionAmount = Math.round(Number(booking.totalAmount) * rate) / 100;

    await this.prisma.agentCommission.create({
      data: {
        agentId: booking.agentId,
        bookingId,
        commissionRatePercent: rate,
        bookingFareBasis: booking.totalAmount,
        commissionAmount,
      },
    });
  }

  private async finalizeConfirmedBooking(bookingId: string) {
    const booking = await this.prisma.booking.findUniqueOrThrow({ where: { id: bookingId } });
    try {
      await this.invoices.issueForBooking(bookingId);
    } catch (err) {
      this.logger.error(`Invoice failed for ${bookingId}`, err);
    }
    try {
      await this.loyalty.earnForBooking(
        booking.customerUserId,
        bookingId,
        Number(booking.totalAmount),
      );
    } catch (err) {
      this.logger.error(`Loyalty earn failed for ${bookingId}`, err);
    }
  }

  private async issueTicketAndNotifySafely(bookingId: string) {
    try {
      await this.tickets.issueForBooking(bookingId);
    } catch (err) {
      this.logger.error(`Ticket issue failed for ${bookingId}`, err);
    }
    try {
      await this.notifications.queueBookingConfirmed(bookingId);
    } catch (err) {
      this.logger.error(`Notification failed for ${bookingId}`, err);
    }
  }

  private resolveBookingSource(role: UserRole, agentCash?: boolean): BookingSource {
    if (role === UserRole.ADMIN) return BookingSource.ADMIN;
    if (role === UserRole.AGENT) return agentCash ? BookingSource.AGENT_CASH : BookingSource.AGENT_ONLINE;
    return BookingSource.CUSTOMER_ONLINE;
  }

  private async agentIdForUser(userId: string, tx: Prisma.TransactionClient) {
    const agent = await tx.agent.findUnique({ where: { userId } });
    if (!agent) throw new BadRequestException('Agent profile missing');
    return agent.id;
  }

  private generateReference() {
    return `SS${Date.now().toString(36).toUpperCase()}${randomBytes(2).toString('hex').toUpperCase()}`;
  }
}
