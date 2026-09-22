'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { FormEvent, useEffect, useState } from 'react';
import { SiteHeader } from '@/components/site-header';
import { CustomerShell } from '@/components/customer-shell';
import { getAccessToken } from '@/lib/api-client';
import { fetchMyBookings, type MyBooking } from '@/lib/bookings-api';

type TripResult = {
  tripId: string;
  departureAt: string;
  fare: number;
  availableSeats: number;
  bus: { name: string | null; registrationNumber: string };
  route: { name: string };
};

import { DEFAULT_FROM, DEFAULT_TO } from '@/lib/agent-booking';

function segmentCities(booking: MyBooking) {
  const fromCity = booking.boardingStop?.stop.city ?? booking.boardingStop?.stop.name ?? DEFAULT_FROM;
  const toCity = booking.droppingStop?.stop.city ?? booking.droppingStop?.stop.name ?? DEFAULT_TO;
  return { fromCity, toCity };
}

export default function RescheduleBookingPage() {
  const { reference } = useParams<{ reference: string }>();
  const router = useRouter();
  const [booking, setBooking] = useState<MyBooking | null>(null);
  const [date, setDate] = useState('');
  const [trips, setTrips] = useState<TripResult[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const token = getAccessToken();
    if (!token) {
      router.replace(`/login?next=/bookings/${encodeURIComponent(reference)}/reschedule`);
      return;
    }
    fetchMyBookings(token)
      .then((rows) => {
        const match = rows.find((b) => b.bookingReference === reference);
        if (!match) throw new Error('Booking not found');
        if (match.status !== 'CONFIRMED') throw new Error('Only confirmed bookings can be rescheduled');
        if (match.rescheduleUsed) throw new Error('This booking was already rescheduled once');
        setBooking(match);
        setDate(match.trip.serviceDate.slice(0, 10));
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Could not load booking'));
  }, [reference, router]);

  async function searchTrips(e: FormEvent) {
    e.preventDefault();
    if (!date || !booking) return;
    setLoading(true);
    setError(null);
    setTrips([]);
    const { fromCity, toCity } = segmentCities(booking);
    const base = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1';
    const q = new URLSearchParams({ fromCity, toCity, date });
    try {
      const res = await fetch(`${base}/search/trips?${q}`);
      if (!res.ok) throw new Error('Search failed');
      setTrips(await res.json());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Search failed');
    } finally {
      setLoading(false);
    }
  }

  function seatHref(trip: TripResult) {
    if (!booking) return '#';
    const { fromCity, toCity } = segmentCities(booking);
    const q = new URLSearchParams({
      fromCity,
      toCity,
      fare: String(trip.fare),
      reschedule: reference,
      date,
      seatCount: String(booking.seats.length),
    });
    return `/trips/${trip.tripId}/seats?${q.toString()}`;
  }

  const segment = booking ? segmentCities(booking) : null;

  return (
    <CustomerShell>
      <SiteHeader />
      <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
        <Link href="/bookings" className="text-sm text-brand hover:underline">
          ← My bookings
        </Link>
        <h1 className="mt-4 text-2xl font-bold text-charcoal">Reschedule booking</h1>
        <p className="mt-1 text-sm text-gray-600">
          One free reschedule before departure — same route segment and passenger details carry over.
        </p>

        {booking && (
          <div className="mt-6 card text-sm">
            <p className="font-medium text-charcoal">{booking.trip.route.name}</p>
            {segment && (
              <p className="mt-1 text-gray-600">
                Segment: <strong>{segment.fromCity}</strong> → <strong>{segment.toCity}</strong>
              </p>
            )}
            <p className="mt-1 text-gray-600">
              Reference <strong>{booking.bookingReference}</strong> · {booking.seats.length} seat
              {booking.seats.length === 1 ? '' : 's'} ({booking.seats.map((s) => s.seatLabel).join(', ') || '—'})
            </p>
            <p className="mt-1 text-gray-600">
              Paid amount: ₹{Number(booking.totalAmount).toFixed(2)} · Same or lower fare on the new trip is free
            </p>
          </div>
        )}

        {error && !booking && <p className="mt-6 text-sm text-red-600">{error}</p>}

        {booking && (
          <form className="mt-6 card space-y-4" onSubmit={searchTrips}>
            <label className="block text-sm font-medium">
              New travel date
              <input
                type="date"
                required
                min={new Date().toISOString().slice(0, 10)}
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2"
              />
            </label>
            <button type="submit" className="btn-primary" disabled={loading}>
              {loading ? 'Searching…' : 'Find buses'}
            </button>
          </form>
        )}

        {error && booking && <p className="mt-4 text-sm text-red-600">{error}</p>}

        <div className="mt-6 space-y-3">
          {trips.map((trip) => (
            <div key={trip.tripId} className="card flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="font-medium">{trip.bus.name ?? trip.bus.registrationNumber}</p>
                <p className="text-sm text-gray-600">
                  {new Date(trip.departureAt).toLocaleString('en-IN')} · {trip.availableSeats} seats
                </p>
              </div>
              <div className="flex items-center gap-3">
                <div className="text-right">
                  <span className="font-bold text-brand">₹{trip.fare}</span>
                  <p className="text-xs text-gray-500">per seat</p>
                </div>
                <Link href={seatHref(trip)} className="btn-primary">
                  Select seats
                </Link>
              </div>
            </div>
          ))}
        </div>
      </div>
    </CustomerShell>
  );
}
