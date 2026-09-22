import { Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { formatInServiceTimezone, segmentTimeAt } from '@shiva-sakti/shared';
import * as fs from 'fs';
import * as path from 'path';
import type PDFDocumentType from 'pdfkit';
import { toDataURL } from 'qrcode';
import { PrismaService } from '../prisma/prisma.service';

// pdfkit is CommonJS — default import breaks at runtime in Nest compiled output
// eslint-disable-next-line @typescript-eslint/no-require-imports
const PDFDocument = require('pdfkit') as typeof PDFDocumentType;

@Injectable()
export class PdfService {
  private readonly logger = new Logger(PdfService.name);
  private readonly storageDir: string;

  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
  ) {
    this.storageDir = path.join(process.cwd(), 'storage', 'tickets');
    fs.mkdirSync(this.storageDir, { recursive: true });
  }

  private logoPath(): string | null {
    const candidates = [
      path.join(process.cwd(), 'assets', 'shiva-sakti-logo.png'),
      path.join(process.cwd(), '..', 'web', 'public', 'shiva-sakti-logo.png'),
    ];
    return candidates.find((p) => fs.existsSync(p)) ?? null;
  }

  pdfPathForBooking(bookingId: string) {
    return path.join(this.storageDir, `${bookingId}.pdf`);
  }

  async generateForBooking(bookingId: string, qrToken: string, ticketNumber: string) {
    const booking = await this.prisma.booking.findUniqueOrThrow({
      where: { id: bookingId },
      include: {
        trip: { include: { route: true, bus: true } },
        boardingStop: { include: { stop: true } },
        droppingStop: { include: { stop: true } },
        seats: true,
        passengers: true,
      },
    });

    const filePath = this.pdfPathForBooking(bookingId);
    let qrBase64: string | null = null;
    try {
      const qrDataUrl = await toDataURL(qrToken, { margin: 1, width: 180 });
      qrBase64 = qrDataUrl.split(',')[1] ?? null;
    } catch (err) {
      this.logger.warn(`QR code skipped for ${booking.bookingReference}: ${err}`);
    }

    await new Promise<void>((resolve, reject) => {
      const doc = new PDFDocument({ size: 'A4', margin: 48 });
      const stream = fs.createWriteStream(filePath);

      doc.on('error', reject);
      stream.on('error', reject);
      stream.on('finish', () => resolve());

      doc.pipe(stream);

      try {
        const logo = this.logoPath();
        if (logo) {
          doc.image(logo, 48, 40, { width: 72 });
        }
      } catch (err) {
        this.logger.warn(`Logo skipped for ${booking.bookingReference}: ${err}`);
      }

      doc
        .fontSize(22)
        .fillColor('#E8740C')
        .text('Shiv Shakti', 48, 48);
      doc.fontSize(10).fillColor('#444444').text('Bus Travel - e-Ticket', 48, 76);

      doc.moveDown(2);
      doc.fontSize(14).fillColor('#111111').text(`Ticket: ${ticketNumber}`);
      doc.fontSize(11).fillColor('#333333');
      doc.text(`Booking ref: ${booking.bookingReference}`);
      doc.text(`Route: ${booking.trip.route.name}`);
      doc.text(
        `Bus: ${booking.trip.bus.registrationNumber} - ${booking.trip.bus.name ?? 'Shiv Shakti Express'}`,
      );
      const boardingDeparture = booking.boardingStop
        ? segmentTimeAt(booking.trip.departureAt, booking.boardingStop.departureOffsetMin)
        : booking.trip.departureAt;
      doc.text(`Departure: ${formatInServiceTimezone(boardingDeparture)}`);
      if (booking.droppingStop) {
        const droppingArrival = segmentTimeAt(
          booking.trip.departureAt,
          booking.droppingStop.arrivalOffsetMin,
        );
        doc.text(`Arrival: ${formatInServiceTimezone(droppingArrival)}`);
      }
      doc.text(`Boarding: ${booking.boardingStop?.stop?.name ?? '-'}`);
      doc.text(`Dropping: ${booking.droppingStop?.stop?.name ?? '-'}`);
      doc.text(`Seats: ${booking.seats.map((s) => s.seatLabel).join(', ')}`);
      doc.text(`Passengers: ${booking.passengers.map((p) => p.fullName).join(', ')}`);
      doc.text(`Amount paid: INR ${Number(booking.totalAmount).toFixed(2)}`);

      doc.moveDown();
      doc.fontSize(10).fillColor('#666666').text('Scan QR at boarding. Keep this ticket handy.');

      if (qrBase64) {
        const qrY = Math.max(doc.y + 8, 520);
        doc.image(Buffer.from(qrBase64, 'base64'), doc.page.width - 200, qrY, { width: 120 });
      } else {
        doc.fontSize(9).fillColor('#666666').text(`Verify code: ${qrToken.slice(0, 16)}...`);
      }

      doc.end();
    });

    await this.prisma.ticket.update({
      where: { bookingId },
      data: { pdfStorageKey: filePath },
    });

    this.logger.log(`PDF generated for ${booking.bookingReference} at ${filePath}`);
    return filePath;
  }

  async ensurePdf(bookingId: string) {
    const ticket = await this.prisma.ticket.findUnique({ where: { bookingId } });
    if (!ticket) {
      throw new InternalServerErrorException('Ticket record missing for this booking');
    }

    try {
      return await this.generateForBooking(bookingId, ticket.qrToken, ticket.ticketNumber);
    } catch (err) {
      this.logger.error(`PDF generation failed for ${bookingId}`, err);
      throw new InternalServerErrorException('Could not generate PDF ticket');
    }
  }
}
