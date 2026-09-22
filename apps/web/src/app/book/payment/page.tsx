'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useState, Suspense } from 'react';
import { BookingSummaryStrip } from '@/components/booking-summary-strip';
import { CustomerShell } from '@/components/customer-shell';
import { SiteHeader } from '@/components/site-header';
import { getAccessToken } from '@/lib/api-client';
import { readCheckoutSummary } from '@/lib/booking-session';

type OrderResponse = {
  configured: boolean;
  devMode: boolean;
  alreadyPaid?: boolean;
  cashfreeMode: 'sandbox' | 'production';
  paymentSessionId: string | null;
  orderId: string | null;
  amountInPaise: number;
  currency: string;
  bookingReference: string;
};

declare global {
  interface Window {
    Cashfree?: (options: { mode: 'sandbox' | 'production' }) => {
      checkout: (options: {
        paymentSessionId: string;
        redirectTarget?: '_self' | '_blank' | '_modal' | '_top';
      }) => Promise<{ error?: { message?: string } }>;
    };
  }
}

function formatFetchError(err: unknown) {
  if (err instanceof TypeError && err.message === 'Failed to fetch') {
    return 'Cannot reach the API. Make sure `npm run dev:api` is running on port 4000, then refresh this page.';
  }
  return err instanceof Error ? err.message : 'Something went wrong';
}

function PaymentContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const bookingId = searchParams.get('bookingId');
  const gatewayOrderIdFromReturn = searchParams.get('gateway_order_id');
  const agentMode = searchParams.get('agent') === '1';
  const [order, setOrder] = useState<OrderResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [paying, setPaying] = useState(false);
  const [summary, setSummary] = useState(readCheckoutSummary());

  const base = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1';
  const cashfreeMode =
    (process.env.NEXT_PUBLIC_CASHFREE_ENV as 'sandbox' | 'production' | undefined) ?? 'sandbox';

  const verifyPayment = useCallback(
    async (payload: { gatewayOrderId: string; gatewayPaymentId?: string }) => {
      const token = getAccessToken();
      if (!token || !bookingId) return;

      const res = await fetch(`${base}/payments/verify`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          bookingId,
          ...payload,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(typeof data.message === 'string' ? data.message : 'Payment verification failed');
      }
      router.push(
        `/book/confirmation?ref=${data.bookingReference ?? order?.bookingReference}&paid=1${agentMode ? '&agent=1' : ''}`,
      );
    },
    [agentMode, base, bookingId, order?.bookingReference, router],
  );

  const loadOrder = useCallback(async () => {
    const token = getAccessToken();
    if (!token || !bookingId) {
      router.push('/login');
      return;
    }

    setError(null);
    try {
      const res = await fetch(`${base}/payments/orders`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ bookingId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(typeof data.message === 'string' ? data.message : 'Could not start payment');
      }

      const orderData = data as OrderResponse;
      if (orderData.alreadyPaid) {
        router.replace(
          `/book/confirmation?ref=${orderData.bookingReference}&paid=1${agentMode ? '&agent=1' : ''}`,
        );
        return;
      }
      setOrder(orderData);
      setSummary((prev) =>
        prev
          ? {
              ...prev,
              bookingReference: orderData.bookingReference,
              totalAmount: orderData.amountInPaise / 100,
            }
          : prev,
      );
      return orderData;
    } catch (err) {
      setError(formatFetchError(err));
      return null;
    }
  }, [agentMode, base, bookingId, router]);

  useEffect(() => {
    loadOrder();
  }, [loadOrder]);

  useEffect(() => {
    if (!gatewayOrderIdFromReturn || !bookingId) return;

    let cancelled = false;
    (async () => {
      setPaying(true);
      setError(null);
      try {
        await verifyPayment({ gatewayOrderId: gatewayOrderIdFromReturn });
      } catch (err) {
        if (!cancelled) setError(formatFetchError(err));
      } finally {
        if (!cancelled) setPaying(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [bookingId, gatewayOrderIdFromReturn, verifyPayment]);

  async function payWithCashfree() {
    if (!order?.paymentSessionId) return;
    setPaying(true);
    setError(null);

    try {
      await new Promise<void>((resolve, reject) => {
        if (window.Cashfree) {
          resolve();
          return;
        }
        const script = document.createElement('script');
        script.src = 'https://sdk.cashfree.com/js/v3/cashfree.js';
        script.onload = () => resolve();
        script.onerror = () => reject(new Error('Could not load Cashfree checkout'));
        document.body.appendChild(script);
      });

      const Cashfree = window.Cashfree;
      if (!Cashfree) {
        setError('Cashfree checkout unavailable');
        return;
      }

      const mode = order.cashfreeMode ?? cashfreeMode;
      const checkout = Cashfree({ mode });
      const result = await checkout.checkout({
        paymentSessionId: order.paymentSessionId,
        redirectTarget: '_self',
      });

      if (result.error) {
        throw new Error(result.error.message ?? 'Payment was not completed');
      }
    } catch (err) {
      setError(formatFetchError(err));
      setPaying(false);
    }
  }

  async function simulateDevPayment() {
    if (!order?.orderId) return;
    setPaying(true);
    setError(null);
    try {
      await verifyPayment({
        gatewayOrderId: order.orderId,
        gatewayPaymentId: `pay_dev_${Date.now()}`,
      });
    } catch (err) {
      setError(formatFetchError(err));
      setPaying(false);
    }
  }

  return (
    <CustomerShell>
      {(agentMode || summary?.agent) && <SiteHeader />}
      <BookingSummaryStrip summary={summary} />
      <div className="mx-auto max-w-md px-4 py-10">
        <h1 className="text-2xl font-bold text-charcoal">Payment</h1>
        {order && (
          <p className="mt-2 text-gray-600">
            Pay <strong>₹{(order.amountInPaise / 100).toFixed(2)}</strong> for booking{' '}
            <strong>{order.bookingReference}</strong>
          </p>
        )}

        {error && (
          <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
            <p>{error}</p>
            <button type="button" className="mt-3 font-medium text-brand hover:underline" onClick={loadOrder}>
              Retry
            </button>
          </div>
        )}

        {!order && !error && !gatewayOrderIdFromReturn && (
          <p className="mt-6 text-sm text-gray-500">Preparing checkout…</p>
        )}

        {gatewayOrderIdFromReturn && paying && (
          <p className="mt-6 text-sm text-gray-500">Confirming your payment…</p>
        )}

        {order?.devMode && (
          <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
            <p>Cashfree keys are not configured. Use dev payment to complete the booking flow locally.</p>
            <button
              type="button"
              className="btn-primary mt-4 w-full"
              disabled={paying}
              onClick={simulateDevPayment}
            >
              {paying ? 'Confirming…' : 'Simulate payment (dev)'}
            </button>
          </div>
        )}

        {order?.configured && order.paymentSessionId && (
          <button
            type="button"
            className="btn-primary mt-6 w-full"
            disabled={paying}
            onClick={payWithCashfree}
          >
            {paying ? 'Processing…' : 'Pay with Cashfree'}
          </button>
        )}

        <Link href="/bookings" className="mt-6 block text-center text-sm text-gray-500 hover:text-brand">
          View my bookings
        </Link>
      </div>
    </CustomerShell>
  );
}

export default function PaymentPage() {
  return (
    <Suspense fallback={<div className="mx-auto max-w-md px-4 py-16 text-center text-sm text-gray-500">Loading…</div>}>
      <PaymentContent />
    </Suspense>
  );
}
