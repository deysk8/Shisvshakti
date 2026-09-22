/** Shared enums and constants — keep in sync with Prisma schema */

export const COMPANY_LEGAL_NAME = 'Shiv Shakti' as const;
export const DEFAULT_COMMISSION_CAP_PERCENT = 4;
export const DEFAULT_TIMEZONE = 'Asia/Kolkata';

export const UserRole = {
  CUSTOMER: 'CUSTOMER',
  AGENT: 'AGENT',
  ADMIN: 'ADMIN',
} as const;
export type UserRole = (typeof UserRole)[keyof typeof UserRole];

export const BookingSource = {
  CUSTOMER_ONLINE: 'CUSTOMER_ONLINE',
  AGENT_ONLINE: 'AGENT_ONLINE',
  AGENT_CASH: 'AGENT_CASH',
  ADMIN: 'ADMIN',
  PARTNER_REDBUS: 'PARTNER_REDBUS',
  PARTNER_ABHIBUS: 'PARTNER_ABHIBUS',
} as const;

export const PartnerChannelCode = {
  REDBUS: 'REDBUS',
  ABHIBUS: 'ABHIBUS',
} as const;
export type PartnerChannelCode = (typeof PartnerChannelCode)[keyof typeof PartnerChannelCode];

/** Sole active service route at launch */
export const LAUNCH_ROUTE_CODE = 'JRG-BLR' as const;
export const LAUNCH_SERVICE_DATE = '2026-09-23' as const;
export const LAUNCH_ROUTE_DEPARTURE_TIME = '07:00' as const;
export const LAUNCH_BUS_REGISTRATION = 'OD 16 Q 4494' as const;
export const DEFAULT_FROM_CITY = 'Jharsuguda' as const;
export const DEFAULT_TO_CITY = 'Bangalore' as const;

/** Cities that should match each other in search and fare lookup */
const CITY_ALIAS_GROUPS = [['bangalore', 'bengaluru']] as const;

export function normalizeCity(city: string): string {
  const lower = city.trim().toLowerCase();
  for (const group of CITY_ALIAS_GROUPS) {
    if (group.some((alias) => alias === lower)) {
      return group[0];
    }
  }
  return lower;
}

export function citiesMatch(a: string, b: string): boolean {
  return normalizeCity(a) === normalizeCity(b);
}

export {
  clockMinutesInServiceTimezone,
  formatInServiceTimezone,
  parseIsoDateOnly,
  segmentTimeAt,
  startOfTodayInServiceTimezone,
  toUtcDateOnly,
  tripArrivalAt,
  tripDepartureAt,
} from './datetime';
export type BookingSource = (typeof BookingSource)[keyof typeof BookingSource];

export const BookingStatus = {
  DRAFT: 'DRAFT',
  SEATS_LOCKED: 'SEATS_LOCKED',
  PENDING_PAYMENT: 'PENDING_PAYMENT',
  CONFIRMED: 'CONFIRMED',
  CANCELLED: 'CANCELLED',
  COMPLETED: 'COMPLETED',
  NO_SHOW: 'NO_SHOW',
} as const;
export type BookingStatus = (typeof BookingStatus)[keyof typeof BookingStatus];

/** Bhagwa brand tokens for UI (Tailwind maps these in apps/web) */
export const brandColors = {
  bhagwa: '#E8740C',
  bhagwaDeep: '#C45A00',
  charcoal: '#1A1A1A',
  surface: '#FFFFFF',
} as const;
