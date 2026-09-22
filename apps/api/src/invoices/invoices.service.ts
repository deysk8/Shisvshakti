import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { InvoicePdfService } from './invoice-pdf.service';

@Injectable()
export class InvoicesService {
  constructor(
    private prisma: PrismaService,
    private pdf: InvoicePdfService,
  ) {}

  async issueForBooking(bookingId: string) {
    const existing = await this.prisma.invoice.findUnique({ where: { bookingId } });
    if (existing) return existing;

    const booking = await this.prisma.booking.findUniqueOrThrow({
      where: { id: bookingId },
      include: { trip: { include: { route: true } } },
    });
    const settings = await this.prisma.companySettings.findFirst();
    const gstPercent = Number(settings?.defaultGstPercent ?? 5);
    const totalAmount = Number(booking.totalAmount);
    const taxableAmount = Math.round((totalAmount / (1 + gstPercent / 100)) * 100) / 100;
    const taxTotal = Math.round((totalAmount - taxableAmount) * 100) / 100;
    const cgstAmount = Math.round((taxTotal / 2) * 100) / 100;
    const sgstAmount = Math.round((taxTotal - cgstAmount) * 100) / 100;

    const prefix = settings?.invoicePrefix ?? 'SS';
    const count = await this.prisma.invoice.count();
    const invoiceNumber = `${prefix}-${new Date().getFullYear()}-${String(count + 1).padStart(6, '0')}`;

    const invoice = await this.prisma.invoice.create({
      data: {
        bookingId,
        invoiceNumber,
        taxableAmount,
        cgstAmount,
        sgstAmount,
        igstAmount: 0,
        totalAmount,
      },
    });

    await this.pdf.generateForBooking(bookingId, invoice);
    return invoice;
  }

  async getPdfPath(bookingId: string) {
    const invoice = await this.issueForBooking(bookingId);
    return this.pdf.ensurePdf(bookingId, invoice.invoiceNumber);
  }
}
