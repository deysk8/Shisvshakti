import { Logger } from '@nestjs/common';

const API_VERSION = '2023-08-01';

export type CashfreeOrder = {
  cf_order_id?: string;
  order_id: string;
  order_amount: number;
  order_currency: string;
  order_status: string;
  payment_session_id?: string;
  customer_details?: {
    customer_id?: string;
    customer_phone?: string;
    customer_email?: string;
  };
};

export type CashfreePayment = {
  cf_payment_id: string;
  payment_status: string;
  payment_amount: number;
};

export type CashfreeRefund = {
  cf_refund_id: string;
  refund_status: string;
};

export class CashfreeClient {
  private readonly logger = new Logger(CashfreeClient.name);

  constructor(
    private readonly appId: string,
    private readonly secretKey: string,
    private readonly environment: 'sandbox' | 'production',
  ) {}

  private baseUrl() {
    return this.environment === 'production'
      ? 'https://api.cashfree.com/pg'
      : 'https://sandbox.cashfree.com/pg';
  }

  private headers() {
    return {
      'Content-Type': 'application/json',
      'x-api-version': API_VERSION,
      'x-client-id': this.appId,
      'x-client-secret': this.secretKey,
    };
  }

  private async request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const res = await fetch(`${this.baseUrl()}${path}`, {
      method,
      headers: this.headers(),
      body: body ? JSON.stringify(body) : undefined,
    });

    const data = (await res.json().catch(() => ({}))) as T & {
      message?: string;
      code?: string;
    };

    if (!res.ok) {
      const message =
        typeof data.message === 'string' ? data.message : `Cashfree API error (${res.status})`;
      this.logger.warn(`Cashfree ${method} ${path} failed: ${message}`);
      throw new Error(message);
    }

    return data;
  }

  createOrder(input: {
    orderId: string;
    amount: number;
    customerId: string;
    customerPhone: string;
    customerEmail?: string | null;
    returnUrl: string;
    notifyUrl: string;
  }) {
    return this.request<CashfreeOrder>('POST', '/orders', {
      order_id: input.orderId,
      order_amount: input.amount,
      order_currency: 'INR',
      customer_details: {
        customer_id: input.customerId,
        customer_phone: input.customerPhone,
        customer_email: input.customerEmail ?? undefined,
      },
      order_meta: {
        return_url: input.returnUrl,
        notify_url: input.notifyUrl,
      },
    });
  }

  fetchOrder(orderId: string) {
    return this.request<CashfreeOrder>('GET', `/orders/${encodeURIComponent(orderId)}`);
  }

  fetchPayments(orderId: string) {
    return this.request<{ payments?: CashfreePayment[] }>(
      'GET',
      `/orders/${encodeURIComponent(orderId)}/payments`,
    );
  }

  createRefund(orderId: string, refundId: string, amount: number) {
    return this.request<CashfreeRefund>('POST', `/orders/${encodeURIComponent(orderId)}/refunds`, {
      refund_id: refundId,
      refund_amount: amount,
      refund_note: 'Booking cancellation refund',
    });
  }
}
