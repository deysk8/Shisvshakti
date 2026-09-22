import { Injectable, Logger } from '@nestjs/common';
import { formatInServiceTimezone } from '@shiva-sakti/shared';
import * as fs from 'fs';
import * as path from 'path';
import type PDFDocumentType from 'pdfkit';
import { PrismaService } from '../prisma/prisma.service';
import type { Invoice } from '@prisma/client';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const PDFDocument = require('pdfkit') as typeof PDFDocumentType;

@Injectable()
export class InvoicePdfService {
  private readonly logger = new Logger(InvoicePdfService.name);
  private readonly storageDir: string;

  constructor(private prisma: PrismaService) {
    this.storageDir = path.join(process.cwd(), 'storage', 'invoices');
    fs.mkdirSync(this.storageDir, { recursive: true });
  }

  pdfPathForBooking(bookingId: string) {
    return path.join(this.storageDir, `${bookingId}.pdf`);
  }

  async generateForBooking(bookingId: string, invoice: Invoice) {
    const booking = await this.prisma.booking.findUniqueOrThrow({
      where: { id: bookingId },
      include: {
        trip: { include: { route: true } },
        passengers: true,
      },
    });
    const settings = await this.prisma.companySettings.findFirst();
    const filePath = this.pdfPathForBooking(bookingId);

    await new Promise<void>((resolve, reject) => {
      const doc = new PDFDocument({ size: 'A4', margin: 48 });
      const stream = fs.createWriteStream(filePath);
      doc.on('error', reject);
      stream.on('error', reject);
      stream.on('finish', () => resolve());
      doc.pipe(stream);

      doc.fontSize(20).fillColor('#E8740C').text('Tax Invoice', { align: 'center' });
      doc.moveDown(0.5);
      doc.fontSize(11).fillColor('#333');
      doc.text(settings?.legalName ?? 'Shiv Shakti Bus Services Pvt Ltd');
      if (settings?.registeredAddress) doc.text(settings.registeredAddress);
      if (settings?.gstin) doc.text(`GSTIN: ${settings.gstin}`);
      if (settings?.pan) doc.text(`PAN: ${settings.pan}`);
      doc.moveDown();

      doc.text(`Invoice No: ${invoice.invoiceNumber}`);
      doc.text(`Date: ${formatInServiceTimezone(invoice.issuedAt, { dateStyle: 'medium' })}`);
      doc.text(`Booking Ref: ${booking.bookingReference}`);
      doc.text(`Route: ${booking.trip.route.name}`);
      doc.text(`Passenger: ${booking.contactName ?? booking.passengers[0]?.fullName ?? '—'}`);
      doc.moveDown();

      doc.text(`Taxable amount: INR ${Number(invoice.taxableAmount).toFixed(2)}`);
      doc.text(`CGST: INR ${Number(invoice.cgstAmount).toFixed(2)}`);
      doc.text(`SGST: INR ${Number(invoice.sgstAmount).toFixed(2)}`);
      doc.text(`Total: INR ${Number(invoice.totalAmount).toFixed(2)}`, { underline: true });
      doc.moveDown();
      doc.fontSize(9).fillColor('#666').text('This is a computer-generated GST invoice.');

      doc.end();
    });

    return filePath;
  }

  async ensurePdf(bookingId: string, invoiceNumber: string) {
    const filePath = this.pdfPathForBooking(bookingId);
    if (!fs.existsSync(filePath)) {
      const invoice = await this.prisma.invoice.findUniqueOrThrow({ where: { bookingId } });
      await this.generateForBooking(bookingId, invoice);
    }
    if (!fs.existsSync(filePath)) {
      this.logger.error(`Invoice PDF missing for ${invoiceNumber}`);
    }
    return filePath;
  }
}
