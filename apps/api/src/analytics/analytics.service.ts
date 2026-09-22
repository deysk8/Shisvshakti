import { Injectable } from '@nestjs/common';
import {
  BookingSource,
  BookingStatus,
  PaymentMethod,
  PaymentStatus,
  RefundStatus,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

const CAPTURED_PAYMENT_STATUSES: PaymentStatus[] = [
  PaymentStatus.CAPTURED,
  PaymentStatus.PARTIALLY_REFUNDED,
  PaymentStatus.REFUNDED,
];

const SOURCE_LABELS: Record<BookingSource, string> = {
  CUSTOMER_ONLINE: 'Customer online',
  AGENT_ONLINE: 'Agent online',
  AGENT_CASH: 'Agent cash',
  ADMIN: 'Admin counter',
  PARTNER_REDBUS: 'RedBus',
  PARTNER_ABHIBUS: 'AbhiBus',
};

const METHOD_LABELS: Record<PaymentMethod, string> = {
  CASHFREE: 'Cashfree (online)',
  CASH: 'Cash',
  UPI_MANUAL: 'UPI manual',
  OTHER: 'Other',
};

@Injectable()
export class AnalyticsService {
  constructor(private prisma: PrismaService) {}

  async getOverview(days = 14) {
    const windowDays = Math.min(Math.max(days, 7), 90);
    const since = this.daysAgo(windowDays);
    const todayStart = this.startOfDay(new Date());
    const tomorrowStart = this.addDays(todayStart, 1);

    const [
      confirmedPeriodCount,
      cancelledPeriodCount,
      pendingPaymentCount,
      todayBookingsCount,
      periodBookings,
      periodPayments,
      periodRefunds,
      upcomingTripsCount,
      seatsSoldPeriod,
      discountAgg,
      sourceRows,
      methodRows,
      cancelledWithReason,
    ] = await Promise.all([
      this.prisma.booking.count({
        where: { status: BookingStatus.CONFIRMED, createdAt: { gte: since } },
      }),
      this.prisma.booking.count({
        where: { status: BookingStatus.CANCELLED, createdAt: { gte: since } },
      }),
      this.prisma.booking.count({ where: { status: BookingStatus.PENDING_PAYMENT } }),
      this.prisma.booking.count({
        where: { createdAt: { gte: todayStart, lt: tomorrowStart } },
      }),
      this.prisma.booking.findMany({
        where: { createdAt: { gte: since } },
        select: {
          createdAt: true,
          status: true,
          totalAmount: true,
          discountAmount: true,
          trip: {
            select: {
              routeId: true,
              route: { select: { code: true, name: true } },
            },
          },
          seats: {
            where: { occupancyStatus: 'OCCUPIED' },
            select: { id: true },
          },
        },
      }),
      this.prisma.payment.findMany({
        where: {
          status: { in: CAPTURED_PAYMENT_STATUSES },
          createdAt: { gte: since },
        },
        select: { createdAt: true, amount: true, method: true },
      }),
      this.prisma.refund.findMany({
        where: {
          status: RefundStatus.COMPLETED,
          processedAt: { gte: since },
        },
        select: { processedAt: true, approvedAmount: true },
      }),
      this.prisma.trip.count({
        where: {
          departureAt: { gte: new Date() },
          status: { in: ['SCHEDULED', 'BOARDING'] },
        },
      }),
      this.prisma.bookingSeat.count({
        where: {
          occupancyStatus: 'OCCUPIED',
          booking: { status: BookingStatus.CONFIRMED, createdAt: { gte: since } },
        },
      }),
      this.prisma.booking.aggregate({
        where: { status: BookingStatus.CONFIRMED, createdAt: { gte: since } },
        _sum: { discountAmount: true, totalAmount: true },
      }),
      this.prisma.booking.groupBy({
        by: ['bookingSource'],
        where: { status: BookingStatus.CONFIRMED, createdAt: { gte: since } },
        _count: { _all: true },
        _sum: { totalAmount: true },
      }),
      this.prisma.payment.groupBy({
        by: ['method'],
        where: {
          status: { in: CAPTURED_PAYMENT_STATUSES },
          createdAt: { gte: since },
        },
        _count: { _all: true },
        _sum: { amount: true },
      }),
      this.prisma.booking.findMany({
        where: { status: BookingStatus.CANCELLED, createdAt: { gte: since } },
        select: { cancellationReason: true },
      }),
    ]);

    const grossRevenue = periodPayments.reduce((sum, row) => sum + Number(row.amount), 0);
    const refundsTotal = periodRefunds.reduce(
      (sum, row) => sum + Number(row.approvedAmount ?? 0),
      0,
    );
    const netRevenue = this.roundMoney(grossRevenue - refundsTotal);
    const totalDiscountGiven = Number(discountAgg._sum.discountAmount ?? 0);
    const confirmedRevenue = Number(discountAgg._sum.totalAmount ?? 0);
    const averageBookingValue =
      confirmedPeriodCount > 0 ? this.roundMoney(confirmedRevenue / confirmedPeriodCount) : 0;
    const cancellationRate =
      confirmedPeriodCount + cancelledPeriodCount > 0
        ? this.roundPercent(cancelledPeriodCount / (confirmedPeriodCount + cancelledPeriodCount))
        : 0;

    const bookingsByDay = this.groupBookingsByDay(periodBookings, windowDays);
    const revenueByDay = this.groupRevenueByDay(periodPayments, periodRefunds, windowDays);
    const topRoutes = this.buildTopRoutes(periodBookings);
    const bookingSourceBreakdown = this.buildSourceBreakdown(sourceRows, confirmedPeriodCount);
    const paymentMethodBreakdown = this.buildMethodBreakdown(methodRows, grossRevenue);
    const cancellationReasons = this.buildCancellationReasons(cancelledWithReason);

    return {
      periodDays: windowDays,
      periodStart: since.toISOString().slice(0, 10),
      periodEnd: todayStart.toISOString().slice(0, 10),
      summary: {
        confirmedBookings: confirmedPeriodCount,
        cancelledBookings: cancelledPeriodCount,
        pendingPaymentBookings: pendingPaymentCount,
        todayBookings: todayBookingsCount,
        upcomingTrips: upcomingTripsCount,
        seatsSold: seatsSoldPeriod,
        grossRevenue: this.roundMoney(grossRevenue),
        refundsTotal: this.roundMoney(refundsTotal),
        netRevenue,
        averageBookingValue,
        totalDiscountGiven: this.roundMoney(totalDiscountGiven),
        cancellationRate,
      },
      bookingsByDay,
      revenueByDay,
      topRoutes,
      bookingSourceBreakdown,
      paymentMethodBreakdown,
      cancellationReasons,
    };
  }

  async getAgentPerformance(days = 30) {
    const windowDays = Math.min(Math.max(days, 7), 90);
    const since = this.daysAgo(windowDays);

    const agents = await this.prisma.agent.findMany({
      include: {
        user: { select: { fullName: true, email: true } },
        bookings: {
          where: { createdAt: { gte: since } },
          select: { status: true, totalAmount: true },
        },
        commissions: {
          where: { accruedAt: { gte: since } },
          select: { commissionAmount: true, status: true },
        },
      },
      orderBy: { employeeCode: 'asc' },
    });

    const rows = agents
      .map((agent) => {
        const confirmed = agent.bookings.filter((b) => b.status === BookingStatus.CONFIRMED);
        const cancelled = agent.bookings.filter((b) => b.status === BookingStatus.CANCELLED);
        const revenue = confirmed.reduce((sum, b) => sum + Number(b.totalAmount), 0);
        const commissionAccrued = agent.commissions.reduce(
          (sum, c) => sum + Number(c.commissionAmount),
          0,
        );
        const commissionPaid = agent.commissions
          .filter((c) => c.status === 'PAID')
          .reduce((sum, c) => sum + Number(c.commissionAmount), 0);

        return {
          agentId: agent.id,
          employeeCode: agent.employeeCode,
          fullName: agent.user.fullName,
          email: agent.user.email,
          isActive: agent.isActive,
          bookings: agent.bookings.length,
          confirmedBookings: confirmed.length,
          cancelledBookings: cancelled.length,
          revenue: this.roundMoney(revenue),
          commissionAccrued: this.roundMoney(commissionAccrued),
          commissionPaid: this.roundMoney(commissionPaid),
          cancellationRate:
            confirmed.length + cancelled.length > 0
              ? this.roundPercent(cancelled.length / (confirmed.length + cancelled.length))
              : 0,
        };
      })
      .filter((row) => row.bookings > 0 || row.isActive)
      .sort((a, b) => b.revenue - a.revenue);

    return { periodDays: windowDays, agents: rows };
  }

  async getUpcomingTripsAnalytics(days = 14) {
    const windowDays = Math.min(Math.max(days, 1), 30);
    const today = this.startOfDay(new Date());
    const end = this.addDays(today, windowDays);

    const trips = await this.prisma.trip.findMany({
      where: {
        serviceDate: { gte: today, lte: end },
        status: { in: ['SCHEDULED', 'BOARDING'] },
      },
      include: {
        route: { select: { code: true, name: true } },
        bus: {
          select: {
            registrationNumber: true,
            busType: { select: { totalSeats: true } },
          },
        },
        bookings: {
          where: { status: BookingStatus.CONFIRMED },
          select: {
            totalAmount: true,
            seats: { where: { occupancyStatus: 'OCCUPIED' }, select: { id: true } },
          },
        },
      },
      orderBy: [{ serviceDate: 'asc' }, { departureAt: 'asc' }],
      take: 50,
    });

    return {
      periodDays: windowDays,
      trips: trips.map((trip) => {
        const seatsSold = trip.bookings.reduce((sum, b) => sum + b.seats.length, 0);
        const totalSeats = trip.bus.busType.totalSeats;
        const revenue = trip.bookings.reduce((sum, b) => sum + Number(b.totalAmount), 0);
        const available = trip.availableSeatsCache ?? Math.max(totalSeats - seatsSold, 0);

        return {
          tripId: trip.id,
          routeCode: trip.route.code,
          routeName: trip.route.name,
          busNumber: trip.bus.registrationNumber,
          serviceDate: trip.serviceDate.toISOString().slice(0, 10),
          departureAt: trip.departureAt.toISOString(),
          status: trip.status,
          totalSeats,
          seatsSold,
          seatsAvailable: available,
          loadFactor: totalSeats > 0 ? this.roundPercent(seatsSold / totalSeats) : 0,
          revenue: this.roundMoney(revenue),
        };
      }),
    };
  }

  async getRecentBookings(limit = 15) {
    const take = Math.min(Math.max(limit, 5), 30);
    const include = {
      trip: { include: { route: true } },
      seats: true,
      customer: { select: { fullName: true, phone: true } },
      agent: { include: { user: { select: { fullName: true, phone: true } } } },
    } as const;

    const [customerRows, agentRows, partnerRows] = await Promise.all([
      this.prisma.booking.findMany({
        where: { bookingSource: BookingSource.CUSTOMER_ONLINE },
        orderBy: { createdAt: 'desc' },
        take,
        include,
      }),
      this.prisma.booking.findMany({
        where: {
          bookingSource: {
            in: [BookingSource.AGENT_ONLINE, BookingSource.AGENT_CASH, BookingSource.ADMIN],
          },
        },
        orderBy: { createdAt: 'desc' },
        take,
        include,
      }),
      this.prisma.booking.findMany({
        where: {
          bookingSource: {
            in: [BookingSource.PARTNER_REDBUS, BookingSource.PARTNER_ABHIBUS],
          },
        },
        orderBy: { createdAt: 'desc' },
        take,
        include: { ...include, partnerChannel: { select: { code: true, name: true } } },
      }),
    ]);

    return {
      customerBookings: customerRows.map((booking) => this.mapRecentBooking(booking)),
      agentBookings: agentRows.map((booking) => this.mapRecentBooking(booking)),
      partnerBookings: partnerRows.map((booking) => this.mapRecentBooking(booking)),
    };
  }

  private mapRecentBooking(booking: {
    bookingReference: string;
    status: BookingStatus;
    totalAmount: unknown;
    discountAmount: unknown;
    bookingSource: BookingSource;
    paymentMethod: PaymentMethod | null;
    contactName: string | null;
    contactPhone: string | null;
    partnerReference?: string | null;
    createdAt: Date;
    trip: { route: { name: string; code: string }; departureAt: Date };
    seats: { seatLabel: string }[];
    customer: { fullName: string; phone: string | null } | null;
    agent: { user: { fullName: string; phone: string | null } } | null;
    partnerChannel?: { code: string; name: string } | null;
  }) {
    return {
      bookingReference: booking.bookingReference,
      status: booking.status,
      bookingSource: booking.bookingSource,
      partnerReference: booking.partnerReference ?? null,
      partnerChannel: booking.partnerChannel?.name ?? null,
      paymentMethod: booking.paymentMethod,
      totalAmount: Number(booking.totalAmount),
      discountAmount: Number(booking.discountAmount),
      routeName: booking.trip.route.name,
      routeCode: booking.trip.route.code,
      departureAt: booking.trip.departureAt.toISOString(),
      seats: booking.seats.map((seat) => seat.seatLabel),
      contactName: booking.contactName ?? booking.customer?.fullName ?? null,
      contactPhone: booking.contactPhone ?? booking.customer?.phone ?? null,
      agentName: booking.agent?.user.fullName ?? null,
      createdAt: booking.createdAt.toISOString(),
    };
  }

  private buildTopRoutes(
    bookings: {
      status: BookingStatus;
      totalAmount: unknown;
      trip: { routeId: string; route: { code: string; name: string } };
      seats: { id: string }[];
    }[],
  ) {
    const map = new Map<
      string,
      {
        routeId: string;
        routeCode: string;
        routeName: string;
        bookings: number;
        cancelled: number;
        revenue: number;
        seatsSold: number;
      }
    >();

    for (const booking of bookings) {
      const routeId = booking.trip.routeId;
      const existing = map.get(routeId) ?? {
        routeId,
        routeCode: booking.trip.route.code,
        routeName: booking.trip.route.name,
        bookings: 0,
        cancelled: 0,
        revenue: 0,
        seatsSold: 0,
      };

      if (booking.status === BookingStatus.CONFIRMED) {
        existing.bookings += 1;
        existing.revenue += Number(booking.totalAmount);
        existing.seatsSold += booking.seats.length;
      }
      if (booking.status === BookingStatus.CANCELLED) {
        existing.cancelled += 1;
      }

      map.set(routeId, existing);
    }

    return [...map.values()]
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 8)
      .map((row) => ({
        routeId: row.routeId,
        routeCode: row.routeCode,
        routeName: row.routeName,
        bookings: row.bookings,
        seatsSold: row.seatsSold,
        revenue: this.roundMoney(row.revenue),
        cancellationRate:
          row.bookings + row.cancelled > 0
            ? this.roundPercent(row.cancelled / (row.bookings + row.cancelled))
            : 0,
      }));
  }

  private buildSourceBreakdown(
    rows: {
      bookingSource: BookingSource;
      _count: { _all: number };
      _sum: { totalAmount: unknown };
    }[],
    totalConfirmed: number,
  ) {
    return rows
      .map((row) => ({
        source: row.bookingSource,
        label: SOURCE_LABELS[row.bookingSource],
        bookings: row._count._all,
        revenue: this.roundMoney(Number(row._sum.totalAmount ?? 0)),
        sharePercent:
          totalConfirmed > 0
            ? this.roundPercent(row._count._all / totalConfirmed)
            : 0,
      }))
      .sort((a, b) => b.revenue - a.revenue);
  }

  private buildMethodBreakdown(
    rows: {
      method: PaymentMethod;
      _count: { _all: number };
      _sum: { amount: unknown };
    }[],
    grossRevenue: number,
  ) {
    return rows
      .map((row) => ({
        method: row.method,
        label: METHOD_LABELS[row.method],
        count: row._count._all,
        amount: this.roundMoney(Number(row._sum.amount ?? 0)),
        sharePercent:
          grossRevenue > 0 ? this.roundPercent(Number(row._sum.amount ?? 0) / grossRevenue) : 0,
      }))
      .sort((a, b) => b.amount - a.amount);
  }

  private buildCancellationReasons(
    rows: { cancellationReason: string | null }[],
  ): { reason: string; count: number }[] {
    const map = new Map<string, number>();
    for (const row of rows) {
      const reason = row.cancellationReason?.trim() || 'No reason given';
      map.set(reason, (map.get(reason) ?? 0) + 1);
    }
    return [...map.entries()]
      .map(([reason, count]) => ({ reason, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);
  }

  private groupBookingsByDay(
    bookings: { createdAt: Date; status: BookingStatus; totalAmount: unknown }[],
    windowDays: number,
  ) {
    const buckets = this.buildDayBuckets(windowDays, {
      total: 0,
      confirmed: 0,
      cancelled: 0,
      revenue: 0,
    });

    for (const booking of bookings) {
      const key = booking.createdAt.toISOString().slice(0, 10);
      const bucket = buckets.get(key);
      if (!bucket) continue;
      bucket.total += 1;
      if (booking.status === BookingStatus.CONFIRMED) {
        bucket.confirmed += 1;
        bucket.revenue += Number(booking.totalAmount);
      }
      if (booking.status === BookingStatus.CANCELLED) bucket.cancelled += 1;
    }

    return [...buckets.values()].map(({ date, total, confirmed, cancelled, revenue }) => ({
      date,
      total,
      confirmed,
      cancelled,
      revenue: this.roundMoney(revenue),
    }));
  }

  private groupRevenueByDay(
    payments: { createdAt: Date; amount: unknown }[],
    refunds: { processedAt: Date | null; approvedAmount: unknown }[],
    windowDays: number,
  ) {
    const buckets = this.buildDayBuckets(windowDays, { gross: 0, refunds: 0, net: 0 });

    for (const payment of payments) {
      const key = payment.createdAt.toISOString().slice(0, 10);
      const bucket = buckets.get(key);
      if (!bucket) continue;
      bucket.gross += Number(payment.amount);
    }

    for (const refund of refunds) {
      if (!refund.processedAt) continue;
      const key = refund.processedAt.toISOString().slice(0, 10);
      const bucket = buckets.get(key);
      if (!bucket) continue;
      bucket.refunds += Number(refund.approvedAmount ?? 0);
    }

    for (const bucket of buckets.values()) {
      bucket.net = this.roundMoney(bucket.gross - bucket.refunds);
      bucket.gross = this.roundMoney(bucket.gross);
      bucket.refunds = this.roundMoney(bucket.refunds);
    }

    return [...buckets.values()];
  }

  private buildDayBuckets<T extends Record<string, number>>(windowDays: number, seed: T) {
    const buckets = new Map<string, T & { date: string }>();
    for (let i = windowDays - 1; i >= 0; i -= 1) {
      const day = this.startOfDay(this.daysAgo(i));
      const key = day.toISOString().slice(0, 10);
      buckets.set(key, { date: key, ...seed });
    }
    return buckets;
  }

  private daysAgo(days: number) {
    const date = new Date();
    date.setDate(date.getDate() - days);
    date.setHours(0, 0, 0, 0);
    return date;
  }

  private startOfDay(date: Date) {
    const copy = new Date(date);
    copy.setHours(0, 0, 0, 0);
    return copy;
  }

  private addDays(date: Date, days: number) {
    const copy = new Date(date);
    copy.setDate(copy.getDate() + days);
    return copy;
  }

  private roundMoney(value: number) {
    return Math.round(value * 100) / 100;
  }

  private roundPercent(value: number) {
    return Math.round(value * 1000) / 10;
  }

  async buildExportCsv(days = 14) {
    const windowDays = Math.min(Math.max(days, 7), 90);
    const [overview, agents, upcoming] = await Promise.all([
      this.getOverview(windowDays),
      this.getAgentPerformance(windowDays),
      this.getUpcomingTripsAnalytics(Math.min(windowDays, 14)),
    ]);

    const lines: string[] = [];
    const add = (row: (string | number | null | undefined)[]) => {
      lines.push(row.map((cell) => this.csvEscape(cell)).join(','));
    };

    add(['Shiv Shakti analytics export']);
    add([`Period (${windowDays} days)`, `${overview.periodStart} to ${overview.periodEnd}`]);
    add([]);

    add(['Summary']);
    add(['Metric', 'Value']);
    add(['Net revenue', overview.summary.netRevenue]);
    add(['Gross revenue', overview.summary.grossRevenue]);
    add(['Refunds', overview.summary.refundsTotal]);
    add(['Confirmed bookings', overview.summary.confirmedBookings]);
    add(['Cancelled bookings', overview.summary.cancelledBookings]);
    add(['Cancellation rate %', overview.summary.cancellationRate]);
    add(['Seats sold', overview.summary.seatsSold]);
    add(['Average booking value', overview.summary.averageBookingValue]);
    add(['Discounts given', overview.summary.totalDiscountGiven]);
    add(['Pending payment', overview.summary.pendingPaymentBookings]);
    add(['Today bookings', overview.summary.todayBookings]);
    add([]);

    add(['Daily bookings']);
    add(['Date', 'Total', 'Confirmed', 'Cancelled', 'Revenue']);
    for (const day of overview.bookingsByDay) {
      add([day.date, day.total, day.confirmed, day.cancelled, day.revenue]);
    }
    add([]);

    add(['Daily revenue']);
    add(['Date', 'Gross', 'Refunds', 'Net']);
    for (const day of overview.revenueByDay) {
      add([day.date, day.gross, day.refunds, day.net]);
    }
    add([]);

    add(['Top routes']);
    add(['Route code', 'Route name', 'Bookings', 'Seats sold', 'Revenue', 'Cancel %']);
    for (const route of overview.topRoutes) {
      add([
        route.routeCode,
        route.routeName,
        route.bookings,
        route.seatsSold,
        route.revenue,
        route.cancellationRate,
      ]);
    }
    add([]);

    add(['Booking channels']);
    add(['Channel', 'Bookings', 'Revenue', 'Share %']);
    for (const row of overview.bookingSourceBreakdown) {
      add([row.label, row.bookings, row.revenue, row.sharePercent]);
    }
    add([]);

    add(['Payment methods']);
    add(['Method', 'Count', 'Amount', 'Share %']);
    for (const row of overview.paymentMethodBreakdown) {
      add([row.label, row.count, row.amount, row.sharePercent]);
    }
    add([]);

    add(['Agent performance']);
    add([
      'Employee code',
      'Name',
      'Bookings',
      'Confirmed',
      'Cancelled',
      'Revenue',
      'Commission accrued',
      'Commission paid',
      'Cancel %',
    ]);
    for (const agent of agents.agents) {
      add([
        agent.employeeCode,
        agent.fullName,
        agent.bookings,
        agent.confirmedBookings,
        agent.cancelledBookings,
        agent.revenue,
        agent.commissionAccrued,
        agent.commissionPaid,
        agent.cancellationRate,
      ]);
    }
    add([]);

    add(['Upcoming trip occupancy']);
    add(['Date', 'Route', 'Bus', 'Seats sold', 'Total seats', 'Load %', 'Revenue']);
    for (const trip of upcoming.trips) {
      add([
        trip.serviceDate,
        trip.routeCode,
        trip.busNumber,
        trip.seatsSold,
        trip.totalSeats,
        trip.loadFactor,
        trip.revenue,
      ]);
    }

    return lines.join('\r\n');
  }

  private csvEscape(value: string | number | null | undefined) {
    const text = value == null ? '' : String(value);
    if (/[",\r\n]/.test(text)) {
      return `"${text.replace(/"/g, '""')}"`;
    }
    return text;
  }
}
