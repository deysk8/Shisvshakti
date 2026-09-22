/**
 * Sandbox smoke test: login → lock seat → book → create Cashfree order.
 * Usage: node scripts/test-cashfree-flow.mjs
 */
const API = process.env.API_URL ?? 'http://localhost:4000/api/v1';
const EMAIL = process.env.TEST_EMAIL ?? 'customer.test@shivasakti.in';
const PASSWORD = process.env.TEST_PASSWORD ?? 'TestCustomer@2026';

async function req(path, options = {}) {
  const res = await fetch(`${API}${path}`, options);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(`${options.method ?? 'GET'} ${path} → ${res.status}: ${JSON.stringify(data)}`);
  }
  return data;
}

async function main() {
  console.log('1. Login…');
  let token;
  try {
    const login = await req('/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
    });
    token = login.accessToken;
  } catch {
    console.log('   Registering test customer…');
    const reg = await req('/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: EMAIL,
        password: PASSWORD,
        fullName: 'Test Customer',
        phone: '9876543210',
      }),
    });
    token = reg.accessToken;
  }

  const auth = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

  console.log('2. Search trip…');
  const trips = await req('/search/trips?fromCity=Jharsuguda&toCity=Bangalore&date=2026-09-23');
  if (!trips.length) throw new Error('No trips found');
  const tripId = trips[0].tripId;
  console.log(`   tripId=${tripId}`);

  console.log('3. Get available seat…');
  const seats = await req(`/trips/${tripId}/seats`);
  const seat = seats.seats?.find((s) => s.status === 'available');
  if (!seat) throw new Error('No available seats');
  console.log(`   seat=${seat.label}`);

  console.log('4. Lock seat…');
  const lock = await req('/bookings/locks', {
    method: 'POST',
    headers: auth,
    body: JSON.stringify({ tripId, seatIds: [seat.id] }),
  });

  console.log('5. Create booking…');
  const booking = await req('/bookings', {
    method: 'POST',
    headers: auth,
    body: JSON.stringify({
      tripId,
      lockToken: lock.lockToken,
      boardingSequence: trips[0].boardingStop.sequence,
      droppingSequence: trips[0].droppingStop.sequence,
      contactName: 'Test Customer',
      contactPhone: '9876543210',
      contactEmail: EMAIL,
      passengers: [{ fullName: 'Test Customer', phone: '9876543210' }],
    }),
  });
  console.log(`   bookingRef=${booking.bookingReference} amount=${booking.totalAmount}`);

  if (!booking.paymentRequired) {
    console.log('OK — cash/agent booking (no payment step)');
    return;
  }

  console.log('6. Create Cashfree order…');
  const order = await req('/payments/orders', {
    method: 'POST',
    headers: auth,
    body: JSON.stringify({ bookingId: booking.bookingId }),
  });

  if (order.devMode) {
    throw new Error('Cashfree not configured — got devMode instead of live sandbox order');
  }
  if (!order.paymentSessionId) {
    throw new Error('Missing paymentSessionId from Cashfree');
  }

  console.log('OK — Cashfree sandbox ready');
  console.log(`   orderId=${order.orderId}`);
  console.log(`   paymentSessionId=${order.paymentSessionId.slice(0, 40)}…`);
  console.log(`   Pay in browser: http://localhost:3000/book/payment?bookingId=${booking.bookingId}`);
}

main().catch((err) => {
  console.error('FAIL:', err.message);
  process.exit(1);
});
