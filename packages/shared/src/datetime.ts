import { DEFAULT_TIMEZONE } from './index';

/** IST is UTC+5:30 — fixed offset (India has no DST) */
const IST_OFFSET_MS = (5 * 60 + 30) * 60 * 1000;

/** Parse YYYY-MM-DD as a UTC calendar date (service day) */
export function parseIsoDateOnly(iso: string): Date {
  const [year, month, day] = iso.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

/** Today's calendar date in Asia/Kolkata as UTC midnight date */
export function startOfTodayInServiceTimezone(now = new Date()): Date {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: DEFAULT_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);
  const year = Number(parts.find((p) => p.type === 'year')?.value);
  const month = Number(parts.find((p) => p.type === 'month')?.value);
  const day = Number(parts.find((p) => p.type === 'day')?.value);
  return new Date(Date.UTC(year, month - 1, day));
}

/** Normalize any Date to UTC calendar date (strip time) */
export function toUtcDateOnly(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

/**
 * Admin schedule time stores HH:mm in UTC hour/minute fields of epoch date.
 * Combine with service calendar date to produce the correct UTC instant for IST wall clock.
 */
export function tripDepartureAt(serviceDate: Date, scheduleDepartureTime: Date): Date {
  const hours = scheduleDepartureTime.getUTCHours();
  const minutes = scheduleDepartureTime.getUTCMinutes();
  const y = serviceDate.getUTCFullYear();
  const mo = serviceDate.getUTCMonth();
  const d = serviceDate.getUTCDate();
  return new Date(Date.UTC(y, mo, d, hours, minutes, 0, 0) - IST_OFFSET_MS);
}

export function tripArrivalAt(departureAt: Date, durationMinutes: number): Date {
  return new Date(departureAt.getTime() + durationMinutes * 60_000);
}

export function segmentTimeAt(tripDepartureAt: Date, offsetMinutes: number): Date {
  return new Date(tripDepartureAt.getTime() + offsetMinutes * 60_000);
}

export function formatInServiceTimezone(
  date: Date,
  options: Intl.DateTimeFormatOptions = { dateStyle: 'medium', timeStyle: 'short' },
): string {
  return date.toLocaleString('en-IN', { ...options, timeZone: DEFAULT_TIMEZONE });
}

export function clockMinutesInServiceTimezone(date: Date): number {
  const parts = new Intl.DateTimeFormat('en-IN', {
    timeZone: DEFAULT_TIMEZONE,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(date);
  const hour = Number(parts.find((p) => p.type === 'hour')?.value ?? 0);
  const minute = Number(parts.find((p) => p.type === 'minute')?.value ?? 0);
  return hour * 60 + minute;
}
