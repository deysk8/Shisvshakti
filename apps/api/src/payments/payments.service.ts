import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, timingSafeEqual } from 'crypto';
import { PaymentMethod, PaymentStatus, RefundStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { BookingsService } from '../bookings/bookings.service';
import { CashfreeClient } from './cashfree.client';

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);
  private cashfree: CashfreeClient | null = null;

  constructor(
    private config: ConfigService,
    private prisma: PrismaService,
    private bookings: BookingsService,
  ) {
    if (this.isConfigured()) {
      this.cashfree = new CashfreeClient(
        this.config.getOrThrow<string>('CASHFREE_APP_ID'),
        this.config.getOrThrow<string>('CASHFREE_SECRET_KEY'),
        this.getEnvironment(),
      );
    }
  }

  isConfigured(): boolean {
    return Boolean(
      this.config.get('CASHFREE_APP_ID')?.trim() &&
        this.config.get('CASHFREE_SECRET_KEY')?.trim(),
    );
  }

  getEnvironment(): 'sandbox' | 'production' {
    return this.config.get('CASHFREE_ENV') === 'production' ? 'production' : 'sandbox';
  }

  getPublicMode(): 'sandbox' | 'production' {
    return this.getEnvironment();
  }

  isDevPaymentMode(): boolean {
    return !this.isConfigured() && this.config.get('NODE_ENV') !== 'production';
  }

  async createOrderForBooking(bookingId: string, userId: string) {
    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
      include: {
        payment: true,
        customer: { select: { id: true, email: true, phone: true } },
      },
    });
    if (!booking) throw new NotFoundException('Booking not found');
    if (!this.canPayForBooking(booking, userId)) {
      throw new BadRequestException('Not your booking');
    }

    const amountInPaise = Math.round(Number(booking.totalAmount) * 100);

    if (booking.status === 'CONFIRMED') {
      return {
        configured: this.isConfigured(),
        devMode: this.isDevPaymentMode(),
        alreadyPaid: true,
        cashfreeMode: this.getPublicMode(),
        paymentSessionId: null,
        orderId: booking.payment?.gatewayOrderId ?? null,
        amountInPaise,
        currency: 'INR',
        bookingReference: booking.bookingReference,
      };
    }

    if (booking.status !== 'PENDING_PAYMENT') {
      throw new BadRequestException('Booking is not awaiting payment');
    }

    if (booking.payment?.gatewayOrderId) {
      const sessionId = this.extractPaymentSessionId(booking.payment.rawGatewayPayload);
      return {
        configured: this.isConfigured(),
        devMode: this.isDevPaymentMode(),
        cashfreeMode: this.getPublicMode(),
        paymentSessionId: sessionId,
        orderId: booking.payment.gatewayOrderId,
        amountInPaise,
        currency: 'INR',
        bookingReference: booking.bookingReference,
      };
    }

    if (this.isDevPaymentMode()) {
      const devOrderId = `order_dev_${booking.bookingReference}`;
      await this.prisma.payment.upsert({
        where: { bookingId },
        create: {
          bookingId,
          amount: booking.totalAmount,
          method: PaymentMethod.CASHFREE,
          status: PaymentStatus.CREATED,
          gatewayOrderId: devOrderId,
        },
        update: {},
      });
      return {
        configured: false,
        devMode: true,
        cashfreeMode: this.getPublicMode(),
        paymentSessionId: null,
        orderId: devOrderId,
        amountInPaise,
        currency: 'INR',
        bookingReference: booking.bookingReference,
      };
    }

    if (!this.cashfree) {
      throw new BadRequestException('Payment gateway not configured');
    }

    const appPublicUrl = this.config.get<string>('APP_PUBLIC_URL') ?? 'http://localhost:3000';
    const apiPublicUrl = this.config.get<string>('API_PUBLIC_URL') ?? 'http://localhost:4000/api/v1';
    const gatewayOrderId = `SS_${booking.bookingReference}`;
    const customerPhone = this.normalizePhone(
      booking.contactPhone ?? booking.customer?.phone,
    );

    let order;
    try {
      order = await this.cashfree.createOrder({
        orderId: gatewayOrderId,
        amount: Number(booking.totalAmount),
        customerId: booking.customer?.id ?? userId,
        customerPhone,
        customerEmail: booking.contactEmail ?? booking.customer?.email,
        returnUrl: `${appPublicUrl}/book/payment?bookingId=${bookingId}&gateway_order_id={order_id}`,
        notifyUrl: `${apiPublicUrl}/payments/webhook`,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Cashfree order failed';
      this.logger.error(`Cashfree create order failed for ${gatewayOrderId}: ${message}`);
      throw new BadRequestException(message);
    }

    await this.prisma.payment.create({
      data: {
        bookingId,
        amount: booking.totalAmount,
        method: PaymentMethod.CASHFREE,
        status: PaymentStatus.CREATED,
        gatewayOrderId: order.order_id,
        rawGatewayPayload: order as object,
      },
    });

    return {
      configured: true,
      devMode: false,
      cashfreeMode: this.getPublicMode(),
      paymentSessionId: order.payment_session_id ?? null,
      orderId: order.order_id,
      amountInPaise,
      currency: 'INR',
      bookingReference: booking.bookingReference,
    };
  }

  async verifyAndCapture(input: {
    bookingId: string;
    userId: string;
    gatewayOrderId: string;
    gatewayPaymentId?: string;
  }) {
    const booking = await this.prisma.booking.findUnique({
      where: { id: input.bookingId },
      include: { payment: true },
    });
    if (!booking?.payment) throw new NotFoundException('Payment not found');
    if (!this.canPayForBooking(booking, input.userId)) {
      throw new BadRequestException('Not your booking');
    }

    if (booking.status === 'CONFIRMED') {
      return this.bookings.confirmAfterPayment(input.bookingId);
    }

    if (booking.status !== 'PENDING_PAYMENT') {
      throw new BadRequestException('Booking is not awaiting payment');
    }

    if (this.isDevPaymentMode()) {
      if (!input.gatewayOrderId.startsWith('order_dev_')) {
        throw new BadRequestException('Invalid dev order');
      }
      await this.prisma.payment.update({
        where: { bookingId: input.bookingId },
        data: {
          status: PaymentStatus.CAPTURED,
          gatewayPaymentId: input.gatewayPaymentId || `pay_dev_${Date.now()}`,
          verifiedAt: new Date(),
        },
      });
      return this.bookings.confirmAfterPayment(input.bookingId);
    }

    if (!this.cashfree) {
      throw new BadRequestException('Payment gateway not configured');
    }

    if (booking.payment.gatewayOrderId !== input.gatewayOrderId) {
      throw new BadRequestException('Order mismatch');
    }

    const order = await this.cashfree.fetchOrder(input.gatewayOrderId);
    if (order.order_status !== 'PAID') {
      await this.prisma.payment.update({
        where: { bookingId: input.bookingId },
        data: {
          status: PaymentStatus.FAILED,
          failureReason: `Order status: ${order.order_status}`,
        },
      });
      throw new BadRequestException('Payment not completed');
    }

    let paymentId = input.gatewayPaymentId ?? booking.payment.gatewayPaymentId;
    if (!paymentId) {
      const payments = await this.cashfree.fetchPayments(input.gatewayOrderId);
      paymentId =
        payments.payments?.find((p) => p.payment_status === 'SUCCESS')?.cf_payment_id ?? null;
    }
    if (!paymentId) {
      throw new BadRequestException('Payment ID not found for order');
    }

    await this.prisma.payment.update({
      where: { bookingId: input.bookingId },
      data: {
        status: PaymentStatus.CAPTURED,
        gatewayPaymentId: paymentId,
        verifiedAt: new Date(),
        rawGatewayPayload: order as object,
      },
    });

    return this.bookings.confirmAfterPayment(input.bookingId);
  }

  verifyWebhookSignature(rawBody: Buffer, timestamp: string, signature: string): boolean {
    const webhookSecret = this.config.get<string>('CASHFREE_WEBHOOK_SECRET');
    if (!webhookSecret || !timestamp || !signature) return false;

    const signedPayload = `${timestamp}${rawBody.toString()}`;
    const expected = createHmac('sha256', webhookSecret).update(signedPayload).digest('base64');
    try {
      return timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
    } catch {
      return false;
    }
  }

  async handleWebhook(rawBody: Buffer, timestamp: string, signature: string) {
    if (!this.verifyWebhookSignature(rawBody, timestamp, signature)) {
      throw new BadRequestException('Invalid webhook signature');
    }

    const parsed = JSON.parse(rawBody.toString()) as {
      type?: string;
      data?: {
        order?: { order_id?: string; order_status?: string };
        payment?: { cf_payment_id?: string; payment_status?: string };
      };
    };

    const eventType = parsed.type ?? 'unknown';
    const orderId = parsed.data?.order?.order_id;
    const eventId = `${eventType}:${orderId ?? ''}:${timestamp}`;

    const existing = await this.prisma.webhookEvent.findUnique({
      where: { eventId },
    });
    if (existing) return { ok: true, duplicate: true };

    await this.prisma.webhookEvent.create({
      data: {
        provider: 'cashfree',
        eventId,
        eventType,
        payload: parsed,
        processedAt: new Date(),
      },
    });

    const paymentSuccess =
      eventType === 'PAYMENT_SUCCESS_WEBHOOK' ||
      parsed.data?.order?.order_status === 'PAID' ||
      parsed.data?.payment?.payment_status === 'SUCCESS';

    if (paymentSuccess && orderId) {
      const payment = await this.prisma.payment.findUnique({
        where: { gatewayOrderId: orderId },
      });
      if (payment && payment.status !== PaymentStatus.CAPTURED) {
        await this.prisma.payment.update({
          where: { id: payment.id },
          data: {
            status: PaymentStatus.CAPTURED,
            gatewayPaymentId: parsed.data?.payment?.cf_payment_id ?? payment.gatewayPaymentId,
            verifiedAt: new Date(),
          },
        });
        await this.bookings.confirmAfterPayment(payment.bookingId);
      }
    }

    return { ok: true };
  }

  private normalizePhone(phone: string | null | undefined): string {
    const digits = (phone ?? '').replace(/\D/g, '');
    if (digits.length >= 10) {
      return digits.slice(-10);
    }
    throw new BadRequestException('A valid 10-digit contact phone is required for online payment');
  }

  private extractPaymentSessionId(payload: unknown): string | null {
    if (!payload || typeof payload !== 'object') return null;
    const sessionId = (payload as { payment_session_id?: unknown }).payment_session_id;
    return typeof sessionId === 'string' ? sessionId : null;
  }

  private canPayForBooking(
    booking: { customerUserId: string | null; status: string },
    userId: string,
  ) {
    return booking.customerUserId === userId;
  }

  async processRefund(input: {
    bookingId: string;
    paymentId: string;
    amount: number;
    refundId?: string;
  }): Promise<{ status: RefundStatus; gatewayRefundId: string | null }> {
    const payment = await this.prisma.payment.findUnique({
      where: { id: input.paymentId },
    });
    if (!payment || payment.bookingId !== input.bookingId) {
      throw new BadRequestException('Payment not found for booking');
    }
    if (payment.status !== PaymentStatus.CAPTURED) {
      throw new BadRequestException('Payment is not captured');
    }

    if (input.amount <= 0) {
      return { status: RefundStatus.COMPLETED, gatewayRefundId: null };
    }

    if (
      this.isDevPaymentMode() ||
      !this.cashfree ||
      payment.gatewayPaymentId?.startsWith('pay_dev_')
    ) {
      const gatewayRefundId = `rfnd_dev_${input.refundId ?? Date.now()}`;
      const isFullRefund = input.amount >= Number(payment.amount);
      await this.prisma.payment.update({
        where: { id: payment.id },
        data: {
          status: isFullRefund ? PaymentStatus.REFUNDED : PaymentStatus.PARTIALLY_REFUNDED,
        },
      });
      return { status: RefundStatus.COMPLETED, gatewayRefundId };
    }

    if (!payment.gatewayOrderId) {
      return { status: RefundStatus.PENDING, gatewayRefundId: null };
    }

    const refundRecordId = input.refundId ?? `rfnd_${Date.now()}`;
    const refund = await this.cashfree.createRefund(
      payment.gatewayOrderId,
      refundRecordId,
      input.amount,
    );

    const isFullRefund = input.amount >= Number(payment.amount);
    await this.prisma.payment.update({
      where: { id: payment.id },
      data: {
        status: isFullRefund ? PaymentStatus.REFUNDED : PaymentStatus.PARTIALLY_REFUNDED,
      },
    });

    return {
      status: RefundStatus.COMPLETED,
      gatewayRefundId: refund.cf_refund_id ?? null,
    };
  }
}
