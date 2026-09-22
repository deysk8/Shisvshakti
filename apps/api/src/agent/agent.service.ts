import { ForbiddenException, Injectable } from '@nestjs/common';
import { BookingSource, BookingStatus, PaymentMethod, UserRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuthUser } from '../auth/types/auth-user.type';

@Injectable()
export class AgentService {
  constructor(private prisma: PrismaService) {}

  private async getAgentProfile(user: AuthUser) {
    if (user.role !== UserRole.AGENT) {
      throw new ForbiddenException('Agent access only');
    }
    const agent = await this.prisma.agent.findUnique({
      where: { userId: user.id },
      include: { user: true },
    });
    if (!agent || !agent.isActive) {
      throw new ForbiddenException('Agent profile inactive or missing');
    }
    return agent;
  }

  async getDashboard(user: AuthUser) {
    const agent = await this.getAgentProfile(user);
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const tomorrowStart = new Date(todayStart);
    tomorrowStart.setDate(tomorrowStart.getDate() + 1);

    const [todayBookings, todaySalesRows, confirmedTotal, pendingCash, commissionsAgg, recent] =
      await Promise.all([
      this.prisma.booking.count({
        where: { agentId: agent.id, createdAt: { gte: todayStart, lt: tomorrowStart } },
      }),
      this.prisma.booking.findMany({
        where: {
          agentId: agent.id,
          createdAt: { gte: todayStart, lt: tomorrowStart },
          status: {
            in: [BookingStatus.CONFIRMED, BookingStatus.COMPLETED, BookingStatus.NO_SHOW],
          },
        },
        select: {
          bookingSource: true,
          paymentMethod: true,
          totalAmount: true,
          status: true,
        },
      }),
      this.prisma.booking.count({
        where: { agentId: agent.id, status: BookingStatus.CONFIRMED },
      }),
      this.prisma.booking.count({
        where: { agentId: agent.id, status: BookingStatus.PENDING_PAYMENT },
      }),
      this.prisma.agentCommission.aggregate({
        where: { agentId: agent.id },
        _sum: { commissionAmount: true },
      }),
      this.prisma.booking.findMany({
        where: { agentId: agent.id },
        orderBy: { createdAt: 'desc' },
        take: 8,
        include: {
          trip: { include: { route: true } },
          seats: true,
        },
      }),
    ]);

    let cashBookings = 0;
    let cashRevenue = 0;
    let onlineBookings = 0;
    let onlineRevenue = 0;
    let boardedToday = 0;
    let noShowToday = 0;

    for (const row of todaySalesRows) {
      const amount = Number(row.totalAmount);
      const isCash =
        row.bookingSource === BookingSource.AGENT_CASH ||
        row.paymentMethod === PaymentMethod.CASH;
      if (isCash) {
        cashBookings += 1;
        cashRevenue += amount;
      } else {
        onlineBookings += 1;
        onlineRevenue += amount;
      }
      if (row.status === BookingStatus.COMPLETED) boardedToday += 1;
      if (row.status === BookingStatus.NO_SHOW) noShowToday += 1;
    }

    const accrued = Number(commissionsAgg._sum.commissionAmount ?? 0);

    return {
      agent: {
        employeeCode: agent.employeeCode,
        fullName: agent.user.fullName,
        commissionRatePercent: Number(agent.commissionRatePercent),
      },
      summary: {
        todayBookings,
        confirmedBookings: confirmedTotal,
        pendingPayment: pendingCash,
        totalCommission: accrued,
        todaySales: {
          cashBookings,
          cashRevenue: Math.round(cashRevenue * 100) / 100,
          onlineBookings,
          onlineRevenue: Math.round(onlineRevenue * 100) / 100,
          totalRevenue: Math.round((cashRevenue + onlineRevenue) * 100) / 100,
          boardedToday,
          noShowToday,
        },
      },
      recentBookings: recent.map((b) => ({
        bookingId: b.id,
        bookingReference: b.bookingReference,
        status: b.status,
        bookingSource: b.bookingSource,
        contactName: b.contactName,
        contactPhone: b.contactPhone,
        totalAmount: Number(b.totalAmount),
        routeCode: b.trip.route.code,
        seats: b.seats.map((s) => s.seatLabel),
        createdAt: b.createdAt.toISOString(),
      })),
    };
  }

  async listBookings(user: AuthUser) {
    const agent = await this.getAgentProfile(user);
    const bookings = await this.prisma.booking.findMany({
      where: { agentId: agent.id },
      orderBy: { createdAt: 'desc' },
      take: 50,
      include: {
        trip: { include: { route: true } },
        seats: true,
        agentCommission: true,
      },
    });

    return bookings.map((b) => ({
      bookingId: b.id,
      bookingReference: b.bookingReference,
      status: b.status,
      bookingSource: b.bookingSource,
      contactName: b.contactName,
      contactPhone: b.contactPhone,
      totalAmount: Number(b.totalAmount),
      routeName: b.trip.route.name,
      routeCode: b.trip.route.code,
      departureAt: b.trip.departureAt.toISOString(),
      seats: b.seats.map((s) => s.seatLabel),
      commissionAmount: b.agentCommission ? Number(b.agentCommission.commissionAmount) : null,
      createdAt: b.createdAt.toISOString(),
    }));
  }

  async listCommissions(user: AuthUser) {
    const agent = await this.getAgentProfile(user);
    const rows = await this.prisma.agentCommission.findMany({
      where: { agentId: agent.id },
      orderBy: { accruedAt: 'desc' },
      take: 50,
      include: {
        booking: { select: { bookingReference: true, contactName: true, totalAmount: true } },
      },
    });

    return rows.map((row) => ({
      bookingReference: row.booking.bookingReference,
      contactName: row.booking.contactName,
      bookingAmount: Number(row.booking.totalAmount),
      commissionRatePercent: Number(row.commissionRatePercent),
      commissionAmount: Number(row.commissionAmount),
      status: row.status,
      accruedAt: row.accruedAt.toISOString(),
    }));
  }

  async getProfile(user: AuthUser) {
    const agent = await this.getAgentProfile(user);
    return {
      id: agent.userId,
      email: agent.user.email,
      fullName: agent.user.fullName,
      phone: agent.user.phone,
      employeeCode: agent.employeeCode,
      commissionRatePercent: Number(agent.commissionRatePercent),
    };
  }
}
