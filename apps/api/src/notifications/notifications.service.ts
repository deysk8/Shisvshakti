import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NotificationChannel, NotificationStatus } from '@prisma/client';
import { formatInServiceTimezone, segmentTimeAt } from '@shiva-sakti/shared';
import * as fs from 'fs';
import * as path from 'path';
import { PrismaService } from '../prisma/prisma.service';
import { PdfService } from '../tickets/pdf.service';
import { MobileMessagingService } from './mobile-messaging.service';

type MobileTemplateKey = 'BOOKING_CONFIRMED' | 'TRIP_REMINDER' | 'BOOKING_CANCELLED';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);
  private readonly devEmailDir: string;

  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
    private pdf: PdfService,
    private mobile: MobileMessagingService,
  ) {
    this.devEmailDir = path.join(process.cwd(), 'storage', 'emails');
    fs.mkdirSync(this.devEmailDir, { recursive: true });
  }

  async queueBookingConfirmed(bookingId: string) {
    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
      include: {
        customer: true,
        trip: { include: { route: true } },
        seats: true,
        ticket: true,
      },
    });
    if (!booking) return;

    const recipient = booking.contactEmail ?? booking.customer?.email;
    if (recipient) {
      const notification = await this.prisma.notification.create({
        data: {
          bookingId,
          userId: booking.customerUserId,
          channel: NotificationChannel.EMAIL,
          templateKey: 'BOOKING_CONFIRMED',
          recipient,
          payload: {
            bookingReference: booking.bookingReference,
            routeName: booking.trip.route.name,
            seats: booking.seats.map((s) => s.seatLabel),
            totalAmount: Number(booking.totalAmount),
          },
          status: NotificationStatus.PENDING,
        },
      });

      await this.deliver(notification.id, bookingId);
    } else {
      this.logger.warn(`No email for booking ${booking.bookingReference} — email skipped`);
    }

    await this.queueMobileTicket(bookingId, 'BOOKING_CONFIRMED');
  }

  async queueBookingCancelled(
    bookingId: string,
    details: { refundAmount: number; refundPercent: number; policyName: string },
  ) {
    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
      include: {
        customer: true,
        trip: { include: { route: true } },
        seats: true,
      },
    });
    if (!booking) return;

    const recipient = booking.contactEmail ?? booking.customer?.email;
    if (recipient) {
      const notification = await this.prisma.notification.create({
        data: {
          bookingId,
          userId: booking.customerUserId,
          channel: NotificationChannel.EMAIL,
          templateKey: 'BOOKING_CANCELLED',
          recipient,
          payload: {
            bookingReference: booking.bookingReference,
            routeName: booking.trip.route.name,
            seats: booking.seats.map((s) => s.seatLabel),
            totalAmount: Number(booking.totalAmount),
            refundAmount: details.refundAmount,
            refundPercent: details.refundPercent,
            policyName: details.policyName,
          },
          status: NotificationStatus.PENDING,
        },
      });

      await this.deliverCancellation(notification.id);
    } else {
      this.logger.warn(`No email for cancelled booking ${booking.bookingReference}`);
    }

    await this.queueMobileTicket(bookingId, 'BOOKING_CANCELLED');
  }

  async sendMobileTicketForBooking(bookingId: string) {
    return this.queueMobileTicket(bookingId, 'BOOKING_CONFIRMED', { force: true });
  }

  async dispatchTripReminders(hoursBeforeDeparture = 24) {
    const now = new Date();
    const windowEnd = new Date(now.getTime() + hoursBeforeDeparture * 60 * 60 * 1000);

    const bookings = await this.prisma.booking.findMany({
      where: {
        status: 'CONFIRMED',
        contactPhone: { not: null },
        trip: {
          departureAt: { gt: now, lte: windowEnd },
          status: 'SCHEDULED',
        },
      },
      include: {
        notifications: {
          where: { templateKey: 'TRIP_REMINDER', status: NotificationStatus.SENT },
          take: 1,
        },
      },
      take: 100,
    });

    const targets = bookings.filter((b) => b.notifications.length === 0);
    const results = [];

    for (const booking of targets) {
      try {
        const result = await this.queueMobileTicket(booking.id, 'TRIP_REMINDER');
        results.push({ bookingReference: booking.bookingReference, ...result });
      } catch (err) {
        results.push({
          bookingReference: booking.bookingReference,
          skipped: true,
          reason: err instanceof Error ? err.message : 'failed',
        });
      }
    }

    return {
      scanned: bookings.length,
      dispatched: results.filter((r) => !r.skipped).length,
      results,
    };
  }

  private async queueMobileTicket(
    bookingId: string,
    templateKey: MobileTemplateKey,
    opts?: { force?: boolean },
  ) {
    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
      include: {
        trip: { include: { route: true } },
        seats: true,
        boardingStop: { include: { stop: true } },
        ticket: true,
      },
    });
    if (!booking?.contactPhone) {
      return { skipped: true, reason: 'no_phone' as const };
    }

    const phone = booking.contactPhone;
    const ticketPdfUrl = this.buildPublicTicketPdfUrl(booking.bookingReference, booking.ticket?.qrToken);
    const message = this.buildMobileMessage(booking, templateKey, ticketPdfUrl);
    const whatsAppContentSid =
      templateKey === 'BOOKING_CONFIRMED'
        ? this.config.get<string>('TWILIO_WHATSAPP_CONTENT_SID')
        : undefined;
    const whatsAppContentVariables =
      whatsAppContentSid && templateKey === 'BOOKING_CONFIRMED'
        ? this.buildWhatsAppContentVariables(booking, ticketPdfUrl)
        : undefined;
    const channels: NotificationChannel[] = [NotificationChannel.SMS, NotificationChannel.WHATSAPP];
    const delivered: Array<{ channel: NotificationChannel; status: NotificationStatus; devFile?: string }> = [];
    const failed: Array<{ channel: NotificationChannel; error: string }> = [];

    for (const channel of channels) {
      if (!opts?.force) {
        const recent = await this.prisma.notification.findFirst({
          where: {
            bookingId,
            channel,
            templateKey,
            status: NotificationStatus.SENT,
            createdAt: { gt: new Date(Date.now() - 5 * 60 * 1000) },
          },
        });
        if (recent) continue;
      }

      const notification = await this.prisma.notification.create({
        data: {
          bookingId,
          userId: booking.customerUserId,
          channel,
          templateKey,
          recipient: phone,
          payload: {
            bookingReference: booking.bookingReference,
            messagePreview: message.slice(0, 160),
          },
          status: NotificationStatus.PENDING,
        },
      });

      try {
        const result =
          channel === NotificationChannel.SMS
            ? await this.mobile.sendSms(phone, message)
            : await this.mobile.sendWhatsApp(phone, message, {
                mediaUrl: ticketPdfUrl,
                contentSid: whatsAppContentSid,
                contentVariables: whatsAppContentVariables,
              });

        await this.prisma.notification.update({
          where: { id: notification.id },
          data: {
            status: NotificationStatus.SENT,
            sentAt: new Date(),
            payload: {
              bookingReference: booking.bookingReference,
              provider: result.provider,
              ...(ticketPdfUrl ? { ticketPdfUrl } : {}),
              ...(result.devFile ? { devFile: result.devFile } : {}),
              ...(result.waMeLink ? { waMeLink: result.waMeLink } : {}),
            },
          },
        });
        delivered.push({
          channel,
          status: NotificationStatus.SENT,
          devFile: result.devFile,
        });
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Send failed';
        this.logger.error(
          `${channel} failed for booking ${booking.bookingReference} → ${phone}: ${errorMessage}`,
        );
        await this.prisma.notification.update({
          where: { id: notification.id },
          data: { status: NotificationStatus.FAILED, errorMessage },
        });
        delivered.push({ channel, status: NotificationStatus.FAILED });
        failed.push({ channel, error: errorMessage });
      }
    }

    if (!delivered.length && !failed.length) {
      return { skipped: true, reason: 'recently_sent' as const };
    }

    return { skipped: false, delivered, failed: failed.length ? failed : undefined };
  }

  private buildPublicTicketPdfUrl(reference: string, qrToken?: string | null) {
    if (!qrToken) return null;
    const apiUrl = this.config.get<string>('API_PUBLIC_URL', 'http://localhost:4000/api/v1');
    return `${apiUrl.replace(/\/$/, '')}/public/tickets/${encodeURIComponent(reference)}/pdf?token=${encodeURIComponent(qrToken)}`;
  }

  /** Map booking fields to Twilio Content template variables ({{1}} … {{7}}). Adjust to match your template in Twilio Console. */
  private buildWhatsAppContentVariables(
    booking: {
      bookingReference: string;
      contactName: string | null;
      totalAmount: unknown;
      trip: { departureAt: Date; route: { name: string }; id: string };
      seats: { seatLabel: string }[];
      boardingStop?: { departureOffsetMin: number; stop: { city: string | null; name: string } };
    },
    ticketPdfUrl?: string | null,
  ): Record<string, string> {
    const appUrl = this.config.get<string>('APP_PUBLIC_URL', 'http://localhost:3000');
    const segmentDeparture = booking.boardingStop
      ? segmentTimeAt(booking.trip.departureAt, booking.boardingStop.departureOffsetMin)
      : booking.trip.departureAt;
    const departureLabel = formatInServiceTimezone(segmentDeparture);
    const seats = booking.seats.map((s) => s.seatLabel).join(', ');

    return {
      '1': booking.contactName ?? 'Passenger',
      '2': booking.bookingReference,
      '3': booking.trip.route.name,
      '4': departureLabel,
      '5': seats,
      '6': `Rs ${Number(booking.totalAmount).toFixed(0)}`,
      '7': ticketPdfUrl ?? `${appUrl}/bookings`,
    };
  }

  private buildMobileMessage(
    booking: {
      bookingReference: string;
      contactName: string | null;
      totalAmount: unknown;
      trip: { departureAt: Date; route: { name: string }; id: string };
      seats: { seatLabel: string }[];
      boardingStop?: { departureOffsetMin: number; stop: { city: string | null; name: string } };
    },
    templateKey: MobileTemplateKey,
    ticketPdfUrl?: string | null,
  ) {
    const appUrl = this.config.get<string>('APP_PUBLIC_URL', 'http://localhost:3000');
    const segmentDeparture = booking.boardingStop
      ? segmentTimeAt(booking.trip.departureAt, booking.boardingStop.departureOffsetMin)
      : booking.trip.departureAt;
    const departureLabel = formatInServiceTimezone(segmentDeparture);
    const seats = booking.seats.map((s) => s.seatLabel).join(', ');
    const trackUrl = `${appUrl}/track/${booking.trip.id}`;
    const bookingsUrl = `${appUrl}/bookings`;

    if (templateKey === 'TRIP_REMINDER') {
      return [
        'Shiv Shakti trip reminder',
        `Hi ${booking.contactName ?? 'passenger'}, your bus is tomorrow.`,
        `Ref: ${booking.bookingReference}`,
        `Route: ${booking.trip.route.name}`,
        `Departure: ${departureLabel}`,
        seats && `Seats: ${seats}`,
        `Track bus: ${trackUrl}`,
        'Reach the boarding point 15 minutes early.',
      ]
        .filter(Boolean)
        .join('\n');
    }

    if (templateKey === 'BOOKING_CANCELLED') {
      return [
        'Shiv Shakti — booking cancelled',
        `Ref: ${booking.bookingReference}`,
        `Route: ${booking.trip.route.name}`,
        seats && `Seats released: ${seats}`,
        `Manage bookings: ${bookingsUrl}`,
      ]
        .filter(Boolean)
        .join('\n');
    }

    return [
      'Shiv Shakti — booking confirmed',
      `Ref: ${booking.bookingReference}`,
      booking.contactName && `Passenger: ${booking.contactName}`,
      `Route: ${booking.trip.route.name}`,
      `Departure: ${departureLabel}`,
      seats && `Seats: ${seats}`,
      `Amount: Rs ${Number(booking.totalAmount).toFixed(0)}`,
      ticketPdfUrl && `Download ticket PDF: ${ticketPdfUrl}`,
      `Track bus: ${trackUrl}`,
      `My bookings: ${bookingsUrl}`,
      'Show the QR on your ticket at boarding. Safe journey!',
    ]
      .filter(Boolean)
      .join('\n');
  }

  private async deliverCancellation(notificationId: string) {
    const notification = await this.prisma.notification.findUniqueOrThrow({
      where: { id: notificationId },
    });
    if (notification.status === NotificationStatus.SENT) return;

    const payload = notification.payload as {
      bookingReference?: string;
      routeName?: string;
      seats?: string[];
      totalAmount?: number;
      refundAmount?: number;
      refundPercent?: number;
      policyName?: string;
    };

    const subject = `Booking cancelled - ${payload.bookingReference ?? 'Shiv Shakti'}`;
    const html = this.renderBookingCancelled({
      reference: payload.bookingReference ?? '',
      routeName: payload.routeName ?? '',
      seats: payload.seats ?? [],
      totalAmount: payload.totalAmount ?? 0,
      refundAmount: payload.refundAmount ?? 0,
      refundPercent: payload.refundPercent ?? 0,
      policyName: payload.policyName ?? '',
    });

    try {
      const sent = await this.sendEmail(notification.recipient, subject, html, null);
      let devEmailFile: string | undefined;
      if (!sent) {
        const devFile = this.saveDevEmail(notification.recipient, subject, html, null);
        devEmailFile = this.relativePath(devFile);
        this.logger.log(`[DEV EMAIL] Cancellation saved to ${devFile}`);
      }
      await this.prisma.notification.update({
        where: { id: notificationId },
        data: {
          status: NotificationStatus.SENT,
          sentAt: new Date(),
          payload: {
            ...payload,
            ...(devEmailFile ? { devEmailFile } : {}),
          },
        },
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Send failed';
      await this.prisma.notification.update({
        where: { id: notificationId },
        data: { status: NotificationStatus.FAILED, errorMessage: message },
      });
    }
  }

  private async deliver(notificationId: string, bookingId: string) {
    const notification = await this.prisma.notification.findUniqueOrThrow({
      where: { id: notificationId },
    });
    if (notification.status === NotificationStatus.SENT) return;

    const payload = notification.payload as {
      bookingReference?: string;
      routeName?: string;
      seats?: string[];
      totalAmount?: number;
    };

    const subject = `Booking confirmed - ${payload.bookingReference ?? 'Shiv Shakti'}`;
    const html = this.renderBookingConfirmed({
      reference: payload.bookingReference ?? '',
      routeName: payload.routeName ?? '',
      seats: payload.seats ?? [],
      totalAmount: payload.totalAmount ?? 0,
    });

    let pdfPath: string | null = null;
    try {
      pdfPath = await this.pdf.ensurePdf(bookingId);
    } catch (err) {
      this.logger.warn(`PDF not attached to email for ${bookingId}: ${err}`);
    }

    try {
      const sent = await this.sendEmail(notification.recipient, subject, html, pdfPath);
      let devEmailFile: string | undefined;
      if (!sent) {
        const devFile = this.saveDevEmail(notification.recipient, subject, html, pdfPath);
        devEmailFile = this.relativePath(devFile);
        this.logger.log(
          `[DEV EMAIL] Saved to ${devFile} (Resend not configured — no real email sent)`,
        );
      }
      await this.prisma.notification.update({
        where: { id: notificationId },
        data: {
          status: NotificationStatus.SENT,
          sentAt: new Date(),
          payload: {
            ...payload,
            ...(devEmailFile ? { devEmailFile } : {}),
          },
        },
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Send failed';
      await this.prisma.notification.update({
        where: { id: notificationId },
        data: { status: NotificationStatus.FAILED, errorMessage: message },
      });
      this.logger.error(`Email failed for ${notification.recipient}: ${message}`);
    }
  }

  private saveDevEmailPath(recipient: string, subject: string) {
    const safe = `${Date.now()}-${recipient.replace(/[^a-z0-9]/gi, '_')}-${subject.slice(0, 30).replace(/[^a-z0-9]/gi, '_')}.html`;
    return path.join(this.devEmailDir, safe);
  }

  private saveDevEmail(to: string, subject: string, html: string, pdfPath: string | null) {
    const filePath = this.saveDevEmailPath(to, subject);
    const pdfNote = pdfPath && fs.existsSync(pdfPath)
      ? `<p><strong>PDF ticket saved at:</strong> ${pdfPath}</p>`
      : '<p><em>PDF ticket was not generated yet.</em></p>';
    fs.writeFileSync(
      filePath,
      `<html><head><title>${subject}</title></head><body><p><strong>To:</strong> ${to}</p><p><strong>Subject:</strong> ${subject}</p>${pdfNote}${html}</body></html>`,
      'utf8',
    );
    if (pdfPath && fs.existsSync(pdfPath)) {
      const pdfCopy = filePath.replace(/\.html$/, '.pdf');
      fs.copyFileSync(pdfPath, pdfCopy);
    }
    return filePath;
  }

  private relativePath(absolutePath: string) {
    return path.relative(process.cwd(), absolutePath);
  }

  private renderBookingConfirmed(input: {
    reference: string;
    routeName: string;
    seats: string[];
    totalAmount: number;
  }) {
    return `
      <div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto">
        <h1 style="color:#E8740C">Shiv Shakti - Booking confirmed</h1>
        <p>Your bus ticket is confirmed.</p>
        <ul>
          <li><strong>Reference:</strong> ${input.reference}</li>
          <li><strong>Route:</strong> ${input.routeName}</li>
          <li><strong>Seats:</strong> ${input.seats.join(', ')}</li>
          <li><strong>Amount:</strong> INR ${input.totalAmount.toFixed(2)}</li>
        </ul>
        <p>Your PDF e-ticket is attached when email delivery is enabled.</p>
        <p style="color:#666;font-size:12px">Shiv Shakti Bus Services</p>
      </div>
    `;
  }

  private renderBookingCancelled(input: {
    reference: string;
    routeName: string;
    seats: string[];
    totalAmount: number;
    refundAmount: number;
    refundPercent: number;
    policyName: string;
  }) {
    const refundLine =
      input.refundAmount > 0
        ? `<li><strong>Refund:</strong> INR ${input.refundAmount.toFixed(2)} (${input.refundPercent}% — ${input.policyName})</li>`
        : `<li><strong>Refund:</strong> None (${input.policyName})</li>`;

    return `
      <div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto">
        <h1 style="color:#E8740C">Shiv Shakti - Booking cancelled</h1>
        <p>Your booking has been cancelled as requested.</p>
        <ul>
          <li><strong>Reference:</strong> ${input.reference}</li>
          <li><strong>Route:</strong> ${input.routeName}</li>
          <li><strong>Seats released:</strong> ${input.seats.join(', ')}</li>
          <li><strong>Original amount:</strong> INR ${input.totalAmount.toFixed(2)}</li>
          ${refundLine}
        </ul>
        <p style="color:#666;font-size:12px">Online refunds are processed to the original payment method within 5–7 business days.</p>
        <p style="color:#666;font-size:12px">Shiv Shakti Bus Services</p>
      </div>
    `;
  }

  async sendSimpleEmail(to: string, subject: string, html: string) {
    try {
      const sent = await this.sendEmail(to, subject, html, null);
      if (!sent) {
        const devFile = this.saveDevEmail(to, subject, html, null);
        this.logger.log(`[DEV EMAIL] Saved to ${devFile}`);
      }
    } catch (err) {
      this.logger.error(`Simple email failed for ${to}: ${err}`);
    }
  }

  private async sendEmail(
    to: string,
    subject: string,
    html: string,
    pdfPath: string | null,
  ): Promise<boolean> {
    const resendKey = this.config.get<string>('RESEND_API_KEY');
    const from = this.config.get<string>('EMAIL_FROM', 'bookings@shivasakti.in');

    if (!resendKey) return false;

    const body: Record<string, unknown> = { from, to, subject, html };
    if (pdfPath && fs.existsSync(pdfPath)) {
      body.attachments = [
        {
          filename: path.basename(pdfPath),
          content: fs.readFileSync(pdfPath).toString('base64'),
        },
      ];
    }

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${resendKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Resend error ${res.status}: ${text}`);
    }
    return true;
  }
}
