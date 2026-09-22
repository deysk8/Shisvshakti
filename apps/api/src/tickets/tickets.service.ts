import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { BookingStatus, UserRole } from '@prisma/client';
import { randomBytes } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { PdfService } from './pdf.service';

@Injectable()
export class TicketsService {
  constructor(
    private prisma: PrismaService,
    private pdf: PdfService,
  ) {}

  async issueForBooking(bookingId: string) {
    const existing = await this.prisma.ticket.findUnique({ where: { bookingId } });
    if (existing?.pdfStorageKey) return existing;

    const booking = await this.prisma.booking.findUniqueOrThrow({ where: { id: bookingId } });
    const ticketNumber = `TKT-${booking.bookingReference}`;
    const qrToken = randomBytes(32).toString('hex');

    const ticket = existing
      ? existing
      : await this.prisma.ticket.create({
          data: {
            bookingId,
            ticketNumber,
            qrToken,
          },
        });

    await this.pdf.generateForBooking(bookingId, ticket.qrToken, ticket.ticketNumber);
    return this.prisma.ticket.findUniqueOrThrow({ where: { bookingId } });
  }

  async verifyScan(qrToken: string, scannedByUserId: string, markBoarded = true) {
    const ticket = await this.prisma.ticket.findUnique({
      where: { qrToken },
      include: {
        booking: {
          include: {
            trip: { include: { route: true } },
            seats: true,
            passengers: true,
          },
        },
      },
    });
    if (!ticket) {
      return { valid: false as const, result: 'NOT_FOUND' as const };
    }

    const payload = this.mapScanPayload(ticket.booking);

    if (ticket.booking.status === BookingStatus.NO_SHOW) {
      await this.prisma.ticketScanLog.create({
        data: { ticketId: ticket.id, scannedByUserId, result: 'NO_SHOW' },
      });
      return { valid: false as const, result: 'NO_SHOW' as const, ...payload };
    }

    if (ticket.booking.status === BookingStatus.COMPLETED) {
      await this.prisma.ticketScanLog.create({
        data: { ticketId: ticket.id, scannedByUserId, result: 'ALREADY_BOARDED' },
      });
      return {
        ...payload,
        valid: true as const,
        result: 'ALREADY_BOARDED' as const,
        boarded: true,
      };
    }

    if (ticket.booking.status !== BookingStatus.CONFIRMED) {
      await this.prisma.ticketScanLog.create({
        data: { ticketId: ticket.id, scannedByUserId, result: 'INVALID_STATUS' },
      });
      return {
        ...payload,
        valid: false as const,
        result: 'INVALID_STATUS' as const,
      };
    }

    if (markBoarded) {
      await this.markBookingBoarded(ticket.booking.id, ticket.id, scannedByUserId);
      const refreshed = await this.prisma.booking.findUniqueOrThrow({
        where: { id: ticket.booking.id },
      });
      return {
        ...payload,
        valid: true as const,
        result: 'BOARDED' as const,
        boarded: true,
        boardedAt: refreshed.boardedAt?.toISOString() ?? new Date().toISOString(),
      };
    }

    await this.prisma.$transaction([
      this.prisma.ticket.update({
        where: { id: ticket.id },
        data: { verifiedCount: { increment: 1 } },
      }),
      this.prisma.ticketScanLog.create({
        data: { ticketId: ticket.id, scannedByUserId, result: 'VALID' },
      }),
    ]);

    return {
      ...payload,
      valid: true as const,
      result: 'VALID' as const,
      boarded: false,
    };
  }

  async lookupByReference(reference: string, userId: string, role: UserRole) {
    const booking = await this.findStaffBooking(reference, userId, role);
    if (!booking) {
      throw new NotFoundException('Booking not found');
    }
    return this.mapLookup(booking);
  }

  async markBoardedByReference(reference: string, userId: string, role: UserRole) {
    const booking = await this.findStaffBooking(reference, userId, role);
    if (!booking) {
      throw new NotFoundException('Booking not found');
    }
    if (booking.status === BookingStatus.COMPLETED) {
      return {
        ok: true,
        message: 'Passenger already boarded',
        ...this.mapLookup(booking),
      };
    }
    if (booking.status === BookingStatus.NO_SHOW) {
      throw new BadRequestException('Booking is marked as no-show');
    }
    if (booking.status !== BookingStatus.CONFIRMED) {
      throw new BadRequestException(`Cannot board booking with status ${booking.status}`);
    }

    const ticket = booking.ticket ?? (await this.issueForBooking(booking.id));
    await this.markBookingBoarded(booking.id, ticket.id, userId);
    const updated = await this.prisma.booking.findUniqueOrThrow({
      where: { id: booking.id },
      include: this.lookupInclude(),
    });

    return {
      ok: true,
      message: 'Passenger marked as boarded',
      ...this.mapLookup(updated),
    };
  }

  async markNoShowByReference(reference: string, userId: string, role: UserRole) {
    const booking = await this.findStaffBooking(reference, userId, role);
    if (!booking) {
      throw new NotFoundException('Booking not found');
    }
    if (booking.status === BookingStatus.COMPLETED) {
      throw new BadRequestException('Passenger already boarded — cannot mark no-show');
    }
    if (booking.status === BookingStatus.NO_SHOW) {
      return {
        ok: true,
        message: 'Already marked as no-show',
        ...this.mapLookup(booking),
      };
    }
    if (booking.status !== BookingStatus.CONFIRMED) {
      throw new BadRequestException(`Cannot mark no-show for status ${booking.status}`);
    }

    const updated = await this.prisma.booking.update({
      where: { id: booking.id },
      data: { status: BookingStatus.NO_SHOW },
      include: this.lookupInclude(),
    });

    if (booking.ticket) {
      await this.prisma.ticketScanLog.create({
        data: {
          ticketId: booking.ticket.id,
          scannedByUserId: userId,
          result: 'MARKED_NO_SHOW',
        },
      });
    }

    return {
      ok: true,
      message: 'Marked as no-show',
      ...this.mapLookup(updated),
    };
  }

  private async markBookingBoarded(bookingId: string, ticketId: string, scannedByUserId: string) {
    await this.prisma.$transaction([
      this.prisma.booking.update({
        where: { id: bookingId },
        data: {
          status: BookingStatus.COMPLETED,
          boardedAt: new Date(),
        },
      }),
      this.prisma.ticket.update({
        where: { id: ticketId },
        data: { verifiedCount: { increment: 1 } },
      }),
      this.prisma.ticketScanLog.create({
        data: { ticketId, scannedByUserId, result: 'BOARDED' },
      }),
    ]);
  }

  private lookupInclude() {
    return {
      trip: { include: { route: true } },
      seats: true,
      ticket: true,
      agent: { include: { user: { select: { fullName: true } } } },
    } as const;
  }

  private async findStaffBooking(reference: string, userId: string, role: UserRole) {
    const where =
      role === UserRole.ADMIN
        ? { bookingReference: reference }
        : {
            bookingReference: reference,
            agent: { userId },
          };

    return this.prisma.booking.findFirst({
      where,
      include: this.lookupInclude(),
    });
  }

  private mapScanPayload(booking: {
    bookingReference: string;
    status: BookingStatus;
    contactName: string | null;
    trip: { route: { name: string } };
    seats: { seatLabel: string }[];
    boardedAt: Date | null;
  }) {
    return {
      bookingReference: booking.bookingReference,
      contactName: booking.contactName,
      routeName: booking.trip.route.name,
      seats: booking.seats.map((seat) => seat.seatLabel),
      status: booking.status,
      boardedAt: booking.boardedAt?.toISOString() ?? null,
    };
  }

  private mapLookup(booking: {
    bookingReference: string;
    status: BookingStatus;
    bookingSource: string;
    contactName: string | null;
    contactPhone: string | null;
    totalAmount: unknown;
    boardedAt: Date | null;
    trip: { route: { code: string; name: string }; departureAt: Date };
    seats: { seatLabel: string }[];
    ticket: { ticketNumber: string; qrToken: string } | null;
    agent: { user: { fullName: string } } | null;
  }) {
    return {
      bookingReference: booking.bookingReference,
      status: booking.status,
      bookingSource: booking.bookingSource,
      contactName: booking.contactName,
      contactPhone: booking.contactPhone,
      totalAmount: Number(booking.totalAmount),
      routeCode: booking.trip.route.code,
      routeName: booking.trip.route.name,
      departureAt: booking.trip.departureAt.toISOString(),
      seats: booking.seats.map((seat) => seat.seatLabel),
      boardedAt: booking.boardedAt?.toISOString() ?? null,
      agentName: booking.agent?.user.fullName ?? null,
      ticketNumber: booking.ticket?.ticketNumber ?? null,
      qrToken: booking.ticket?.qrToken ?? null,
    };
  }
}
