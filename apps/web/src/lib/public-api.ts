import { DEFAULT_FROM_CITY, DEFAULT_TO_CITY } from '@shiva-sakti/shared';
import { apiBaseUrl, safeFetchJson } from '@/lib/safe-fetch';

const API_BASE = apiBaseUrl();

export type Testimonial = {
  name: string;
  city: string;
  quote: string;
  rating?: number;
};

export type PopularRoute = {
  fromCity: string;
  toCity: string;
  label: string;
};

export type PublicCompany = {
  legalName: string;
  displayName: string;
  supportEmail: string;
  supportPhone: string;
  stats: { buses: number; routes: number; happyBookings: number };
};

export type BookingPolicies = {
  seniorDiscountEnabled: boolean;
  seniorDiscountPercent: number;
  childDiscountEnabled: boolean;
  childDiscountPercent: number;
  childMaxAge: number;
};

const DEFAULT_TESTIMONIALS: Testimonial[] = [
  {
    name: 'Priya S.',
    city: 'Jharsuguda',
    quote: 'Booking was smooth and the bus was on time. Shiv Shakti is now my go-to for Bangalore trips.',
    rating: 5,
  },
  {
    name: 'Rahul M.',
    city: 'Bangalore',
    quote: 'Comfortable AC bus and fair price for the long journey from Jharsuguda.',
    rating: 5,
  },
  {
    name: 'Anita K.',
    city: 'Jharsuguda',
    quote: 'Easy online booking and helpful support when I rescheduled.',
    rating: 4,
  },
];

const DEFAULT_POPULAR_ROUTES: PopularRoute[] = [
  {
    fromCity: DEFAULT_FROM_CITY,
    toCity: DEFAULT_TO_CITY,
    label: `${DEFAULT_FROM_CITY} → ${DEFAULT_TO_CITY}`,
  },
];

const DEFAULT_COMPANY: PublicCompany = {
  legalName: 'Shiv Shakti',
  displayName: 'Shiv Shakti',
  supportEmail: 'support@shivasakti.in',
  supportPhone: '+91 94370 12345',
  stats: { buses: 1, routes: 1, happyBookings: 0 },
};

const DEFAULT_POLICIES: BookingPolicies = {
  seniorDiscountEnabled: true,
  seniorDiscountPercent: 10,
  childDiscountEnabled: true,
  childDiscountPercent: 25,
  childMaxAge: 11,
};

export async function fetchPublicCompany(): Promise<PublicCompany> {
  return safeFetchJson(`${API_BASE}/public/company`, DEFAULT_COMPANY, {
    next: { revalidate: 300 },
  });
}

export async function fetchTestimonials(): Promise<Testimonial[]> {
  return safeFetchJson(`${API_BASE}/public/testimonials`, DEFAULT_TESTIMONIALS, {
    next: { revalidate: 600 },
  });
}

export async function fetchPopularRoutes(): Promise<PopularRoute[]> {
  return safeFetchJson(`${API_BASE}/public/popular-routes`, DEFAULT_POPULAR_ROUTES, {
    next: { revalidate: 600 },
  });
}

export async function fetchBookingPolicies(): Promise<BookingPolicies> {
  return safeFetchJson(`${API_BASE}/public/booking-policies`, DEFAULT_POLICIES);
}

export async function submitEnquiry(input: {
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
  const res = await fetch(`${API_BASE}/public/enquiries`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error((data as { message?: string }).message ?? 'Could not submit enquiry');
  }
  return data as { ok: boolean; message: string };
}
