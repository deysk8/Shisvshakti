export declare const COMPANY_LEGAL_NAME: "Shiv Shakti";
export declare const DEFAULT_COMMISSION_CAP_PERCENT = 4;
export declare const DEFAULT_TIMEZONE = "Asia/Kolkata";
export declare const UserRole: {
    readonly CUSTOMER: "CUSTOMER";
    readonly AGENT: "AGENT";
    readonly ADMIN: "ADMIN";
};
export type UserRole = (typeof UserRole)[keyof typeof UserRole];
export declare const BookingSource: {
    readonly CUSTOMER_ONLINE: "CUSTOMER_ONLINE";
    readonly AGENT_ONLINE: "AGENT_ONLINE";
    readonly AGENT_CASH: "AGENT_CASH";
    readonly ADMIN: "ADMIN";
    readonly PARTNER_REDBUS: "PARTNER_REDBUS";
    readonly PARTNER_ABHIBUS: "PARTNER_ABHIBUS";
};
export declare const PartnerChannelCode: {
    readonly REDBUS: "REDBUS";
    readonly ABHIBUS: "ABHIBUS";
};
export type PartnerChannelCode = (typeof PartnerChannelCode)[keyof typeof PartnerChannelCode];
export declare const LAUNCH_ROUTE_CODE: "JRG-BLR";
export declare const LAUNCH_SERVICE_DATE: "2026-09-22";
export declare const LAUNCH_ROUTE_DEPARTURE_TIME: "06:00";
export declare const DEFAULT_FROM_CITY: "Jharsuguda";
export declare const DEFAULT_TO_CITY: "Bangalore";
export type BookingSource = (typeof BookingSource)[keyof typeof BookingSource];
export declare const BookingStatus: {
    readonly DRAFT: "DRAFT";
    readonly SEATS_LOCKED: "SEATS_LOCKED";
    readonly PENDING_PAYMENT: "PENDING_PAYMENT";
    readonly CONFIRMED: "CONFIRMED";
    readonly CANCELLED: "CANCELLED";
    readonly COMPLETED: "COMPLETED";
    readonly NO_SHOW: "NO_SHOW";
};
export type BookingStatus = (typeof BookingStatus)[keyof typeof BookingStatus];
export declare const brandColors: {
    readonly bhagwa: "#E8740C";
    readonly bhagwaDeep: "#C45A00";
    readonly charcoal: "#1A1A1A";
    readonly surface: "#FFFFFF";
};
