import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { BookingStatus } from '@prisma/client';
import { DEFAULT_FROM_CITY, DEFAULT_TO_CITY } from '@shiva-sakti/shared';
import * as fs from 'fs';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { RatingsService } from '../ratings/ratings.service';
import { PdfService } from '../tickets/pdf.service';
import { TicketsService } from '../tickets/tickets.service';

@Injectable()
export class PublicService {
  private readonly logger = new Logger(PublicService.name);

  constructor(
    private prisma: PrismaService,
    private notifications: NotificationsService,
    private ratings: RatingsService,
    private tickets: TicketsService,
    private pdf: PdfService,
  ) {}

  async getCompanyInfo() {
    const company = await this.prisma.companySettings.findFirst();
    const [busCount, routeCount, confirmedBookings] = await Promise.all([
      this.prisma.bus.count({ where: { status: 'ACTIVE' } }),
      this.prisma.route.count({ where: { isActive: true } }),
      this.prisma.booking.count({ where: { status: BookingStatus.CONFIRMED } }),
    ]);

    return {
      legalName: company?.legalName ?? 'Shiv Shakti',
      displayName: company?.displayName ?? company?.legalName ?? 'Shiv Shakti',
      supportEmail: company?.supportEmail ?? 'support@shivasakti.in',
      supportPhone: company?.supportPhone ?? '+91 98765 43210',
      stats: {
        buses: busCount,
        routes: routeCount,
        happyBookings: confirmedBookings,
      },
    };
  }

  async getBookingPolicies() {
    const company = await this.prisma.companySettings.findFirst();
    return {
      seniorDiscountEnabled: company?.seniorDiscountEnabled ?? true,
      seniorDiscountPercent: Number(company?.seniorDiscountPercent ?? 10),
      childDiscountEnabled: company?.childDiscountEnabled ?? true,
      childDiscountPercent: Number(company?.childDiscountPercent ?? 25),
      childMaxAge: company?.childMaxAge ?? 11,
    };
  }

  async getTestimonials() {
    const fromDb = await this.ratings.listPublic(6);
    if (fromDb.length >= 2) {
      return fromDb.map((r) => ({
        name: r.author,
        city: r.routeName.split('→')[0]?.trim() ?? DEFAULT_FROM_CITY,
        quote: r.comment ?? 'Great trip with Shiv Shakti!',
        rating: r.rating,
      }));
    }
    return [
      {
        name: 'Priya Mohanty',
        city: 'Jharsuguda',
        quote:
          'Booking was smooth and the bus was on time. Shiv Shakti is now my go-to for Bangalore trips.',
      },
      {
        name: 'Rakesh Patnaik',
        city: 'Bangalore',
        quote:
          'Clean seats, helpful staff at the counter, and the digital ticket made boarding easy.',
      },
      {
        name: 'Sunita Das',
        city: 'Jharsuguda',
        quote:
          'I cancelled once and got my refund quickly. Very professional service.',
      },
    ];
  }

  getPopularRoutes() {
    return [
      {
        fromCity: DEFAULT_FROM_CITY,
        toCity: DEFAULT_TO_CITY,
        label: `${DEFAULT_FROM_CITY} → ${DEFAULT_TO_CITY}`,
      },
    ];
  }

  async submitEnquiry(input: {
    name: string;
    email?: string;
    mobile: string;
    enquiryType: string;
    fromCity?: string;
    toCity?: string;
    seats?: number;
    busType?: string;
    message?: string;
  }) {
    const company = await this.prisma.companySettings.findFirst();
    const recipient = company?.supportEmail ?? 'support@shivasakti.in';
    const subject = `Bus hire enquiry — ${input.name}`;
    const html = `
      <h2>New enquiry from Shiv Shakti website</h2>
      <ul>
        <li><strong>Name:</strong> ${input.name}</li>
        <li><strong>Mobile:</strong> ${input.mobile}</li>
        <li><strong>Email:</strong> ${input.email ?? '—'}</li>
        <li><strong>Type:</strong> ${input.enquiryType}</li>
        <li><strong>From:</strong> ${input.fromCity ?? '—'}</li>
        <li><strong>To:</strong> ${input.toCity ?? '—'}</li>
        <li><strong>Seats:</strong> ${input.seats ?? '—'}</li>
        <li><strong>Bus type:</strong> ${input.busType ?? '—'}</li>
      </ul>
      <p>${input.message ?? ''}</p>
    `;

    await this.notifications.sendSimpleEmail(recipient, subject, html);
    this.logger.log(`Enquiry received from ${input.name} (${input.mobile})`);
    return { ok: true, message: 'Enquiry submitted — we will contact you shortly.' };
  }

  async downloadTicketPdf(reference: string, token: string) {
    const booking = await this.prisma.booking.findFirst({
      where: {
        bookingReference: reference,
        status: BookingStatus.CONFIRMED,
        ticket: { qrToken: token },
      },
      include: { ticket: true },
    });
    if (!booking) {
      throw new NotFoundException('Ticket not found');
    }

    if (!booking.ticket) {
      await this.tickets.issueForBooking(booking.id);
    }

    const filePath = await this.pdf.ensurePdf(booking.id);
    if (!fs.existsSync(filePath)) {
      throw new NotFoundException('Ticket PDF not available');
    }

    return {
      filePath,
      filename: `shiva-sakti-${reference}.pdf`,
    };
  }
}
