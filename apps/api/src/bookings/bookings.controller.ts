import { Body, Controller, Get, NotFoundException, Param, Post, Query, BadRequestException } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { AuthUser } from '../auth/types/auth-user.type';
import { BookingsService } from './bookings.service';
import { CreateBookingDraftDto, LockSeatsDto, RescheduleBookingDto } from './dto/booking.dto';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { TicketsService } from '../tickets/tickets.service';

@ApiTags('bookings')
@ApiBearerAuth()
@Controller('bookings')
export class BookingsController {
  constructor(
    private bookingsService: BookingsService,
    private prisma: PrismaService,
    private notifications: NotificationsService,
    private tickets: TicketsService,
  ) {}

  @Post('locks')
  lockSeats(@CurrentUser() user: AuthUser, @Body() dto: LockSeatsDto) {
    return this.bookingsService.lockSeats(user, dto);
  }

  @Get('locks/validate')
  validateLock(
    @CurrentUser() user: AuthUser,
    @Query('lockToken') lockToken: string,
    @Query('tripId') tripId: string,
  ) {
    return this.bookingsService.validateLock(user, lockToken, tripId);
  }

  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateBookingDraftDto) {
    return this.bookingsService.createDraft(user, dto);
  }

  @Get('my')
  myBookings(@CurrentUser() user: AuthUser) {
    return this.prisma.booking.findMany({
      where: {
        OR: [{ customerUserId: user.id }, { agent: { userId: user.id } }],
      },
      orderBy: { createdAt: 'desc' },
      include: {
        trip: { include: { route: true, bus: true } },
        seats: true,
        passengers: true,
        boardingStop: { include: { stop: true } },
        droppingStop: { include: { stop: true } },
      },
      take: 50,
    });
  }

  @Post(':reference/resend-email')
  async resendEmail(@CurrentUser() user: AuthUser, @Param('reference') reference: string) {
    const where =
      user.role === UserRole.ADMIN
        ? { bookingReference: reference }
        : {
            bookingReference: reference,
            OR: [{ customerUserId: user.id }, { agent: { userId: user.id } }],
          };
    const booking = await this.prisma.booking.findFirst({ where, include: { ticket: true } });
    if (!booking || booking.status !== 'CONFIRMED') {
      throw new NotFoundException('Booking not found');
    }
    if (!booking.ticket) {
      await this.tickets.issueForBooking(booking.id);
    }
    await this.notifications.queueBookingConfirmed(booking.id);
    return { ok: true, message: 'Confirmation email queued' };
  }

  @Post(':reference/send-mobile-ticket')
  async sendMobileTicket(@CurrentUser() user: AuthUser, @Param('reference') reference: string) {
    const where =
      user.role === UserRole.ADMIN
        ? { bookingReference: reference }
        : {
            bookingReference: reference,
            OR: [{ customerUserId: user.id }, { agent: { userId: user.id } }],
          };
    const booking = await this.prisma.booking.findFirst({ where });
    if (!booking || booking.status !== 'CONFIRMED') {
      throw new NotFoundException('Booking not found');
    }
    if (!booking.contactPhone) {
      throw new BadRequestException('No phone number on this booking');
    }

    const result = await this.notifications.sendMobileTicketForBooking(booking.id);
    if (result.skipped) {
      const reason =
        result.reason === 'no_phone'
          ? 'No phone number on this booking'
          : result.reason === 'recently_sent'
            ? 'Ticket was sent to this phone recently — try again in a few minutes'
            : 'Could not send mobile ticket';
      return { ok: false, skipped: true, reason: result.reason, message: reason };
    }

    return {
      ok: true,
      message: 'Ticket sent via SMS and WhatsApp (or saved under storage/sms and storage/whatsapp in dev)',
      delivered: result.delivered,
      failed: result.failed,
    };
  }

  @Post(':reference/reschedule')
  reschedule(
    @CurrentUser() user: AuthUser,
    @Param('reference') reference: string,
    @Body() dto: RescheduleBookingDto,
  ) {
    return this.bookingsService.rescheduleBooking(user, reference, dto);
  }

  @Get(':reference')
  async byReference(@CurrentUser() user: AuthUser, @Param('reference') reference: string) {
    const where =
      user.role === UserRole.ADMIN
        ? { bookingReference: reference }
        : {
            bookingReference: reference,
            OR: [{ customerUserId: user.id }, { agent: { userId: user.id } }],
          };
    return this.prisma.booking.findFirst({
      where,
      include: {
        trip: { include: { route: true, bus: true } },
        seats: true,
        passengers: true,
        ticket: true,
      },
    });
  }
}
