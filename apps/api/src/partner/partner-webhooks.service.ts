import { createHmac, randomUUID } from 'crypto';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BookingSource, PartnerChannelCode, TripStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export type PartnerWebhookEventType = 'seats.booked' | 'seats.released' | 'trip.cancelled';

export type PartnerWebhookPayload = {
  eventId: string;
  event: PartnerWebhookEventType;
  occurredAt: string;
  recipientChannel: PartnerChannelCode;
  trip: {
    tripId: string;
    serviceDate: string;
    departureAt: string;
    routeCode: string;
    routeName: string;
    status: TripStatus;
  };
  seats: { busSeatId: string; label: string }[];
  availableSeats: number;
  totalSeats: number;
  origin?: {
    bookingSource: BookingSource;
    bookingReference: string;
    partnerReference?: string | null;
  };
  reason?: string;
};

@Injectable()
export class PartnerWebhooksService {
  private readonly logger = new Logger(PartnerWebhooksService.name);

  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
  ) {}

  /** Notify partners when seats become occupied (website, agent, or another OTA). */
  notifySeatsBooked(bookingId: string, excludePartnerChannelId?: string) {
    void this.emitForBooking('seats.booked', bookingId, excludePartnerChannelId);
  }

  /** Notify partners when seats are released back to inventory. */
  notifySeatsReleased(bookingId: string, excludePartnerChannelId?: string) {
    void this.emitForBooking('seats.released', bookingId, excludePartnerChannelId);
  }

  /** Notify partners that an entire trip was cancelled by the operator. */
  notifyTripCancelled(tripId: string, reason?: string) {
    void this.emitTripCancelled(tripId, reason);
  }

  async sendTestWebhook(channelId: string) {
    const channel = await this.prisma.partnerChannel.findUnique({ where: { id: channelId } });
    if (!channel?.webhookUrl?.trim()) {
      return { ok: false as const, error: 'Webhook URL not configured' };
    }

    const trip = await this.prisma.trip.findFirst({
      where: { status: TripStatus.SCHEDULED },
      include: {
        route: { select: { code: true, name: true } },
        bus: { include: { busType: true, seats: { where: { isActive: true }, take: 2 } } },
      },
      orderBy: { departureAt: 'asc' },
    });

    const payload: PartnerWebhookPayload = {
      eventId: randomUUID(),
      event: 'seats.booked',
      occurredAt: new Date().toISOString(),
      recipientChannel: channel.code,
      trip: trip
        ? {
            tripId: trip.id,
            serviceDate: trip.serviceDate.toISOString().slice(0, 10),
            departureAt: trip.departureAt.toISOString(),
            routeCode: trip.route.code,
            routeName: trip.route.name,
            status: trip.status,
          }
        : {
            tripId: '00000000-0000-4000-8000-000000000000',
            serviceDate: new Date().toISOString().slice(0, 10),
            departureAt: new Date().toISOString(),
            routeCode: 'TEST',
            routeName: 'Webhook test',
            status: TripStatus.SCHEDULED,
          },
      seats: trip?.bus.seats.map((seat) => ({ busSeatId: seat.id, label: seat.seatLabel })) ?? [],
      availableSeats: trip ? Math.max(trip.bus.busType.totalSeats - 1, 0) : 40,
      totalSeats: trip?.bus.busType.totalSeats ?? 40,
      origin: {
        bookingSource: BookingSource.ADMIN,
        bookingReference: 'SS-TEST-WEBHOOK',
      },
      reason: 'Shiv Shakti webhook connectivity test',
    };

    const result = await this.deliver(channel.id, channel.code, channel.webhookUrl, payload);
    return { ok: result.ok, status: result.status, eventId: payload.eventId, error: result.error };
  }

  private async emitForBooking(
    event: 'seats.booked' | 'seats.released',
    bookingId: string,
    excludePartnerChannelId?: string,
  ) {
    try {
      const booking = await this.prisma.booking.findUnique({
        where: { id: bookingId },
        include: {
          seats: { select: { busSeatId: true, seatLabel: true } },
          trip: {
            include: {
              route: { select: { code: true, name: true } },
              bus: { include: { busType: true } },
            },
          },
        },
      });
      if (!booking || !booking.seats.length) return;

      const availableSeats = await this.countAvailableSeats(
        booking.tripId,
        booking.trip.bus.busType.totalSeats,
      );

      const payloadBase = {
        event,
        occurredAt: new Date().toISOString(),
        trip: {
          tripId: booking.tripId,
          serviceDate: booking.trip.serviceDate.toISOString().slice(0, 10),
          departureAt: booking.trip.departureAt.toISOString(),
          routeCode: booking.trip.route.code,
          routeName: booking.trip.route.name,
          status: booking.trip.status,
        },
        seats: booking.seats.map((seat) => ({
          busSeatId: seat.busSeatId,
          label: seat.seatLabel,
        })),
        availableSeats,
        totalSeats: booking.trip.bus.busType.totalSeats,
        origin: {
          bookingSource: booking.bookingSource,
          bookingReference: booking.bookingReference,
          partnerReference: booking.partnerReference,
        },
      };

      await this.broadcast(payloadBase, excludePartnerChannelId);
    } catch (err) {
      this.logger.error(`Failed to emit ${event} for booking ${bookingId}`, err);
    }
  }

  private async emitTripCancelled(tripId: string, reason?: string) {
    try {
      const trip = await this.prisma.trip.findUnique({
        where: { id: tripId },
        include: {
          route: { select: { code: true, name: true } },
          bus: { include: { busType: true, seats: { where: { isActive: true } } } },
        },
      });
      if (!trip) return;

      const availableSeats = trip.bus.busType.totalSeats;

      await this.broadcast(
        {
          event: 'trip.cancelled',
          occurredAt: new Date().toISOString(),
          trip: {
            tripId: trip.id,
            serviceDate: trip.serviceDate.toISOString().slice(0, 10),
            departureAt: trip.departureAt.toISOString(),
            routeCode: trip.route.code,
            routeName: trip.route.name,
            status: trip.status,
          },
          seats: trip.bus.seats.map((seat) => ({ busSeatId: seat.id, label: seat.seatLabel })),
          availableSeats,
          totalSeats: trip.bus.busType.totalSeats,
          reason: reason?.trim() || 'Trip cancelled by operator',
        },
        undefined,
      );
    } catch (err) {
      this.logger.error(`Failed to emit trip.cancelled for trip ${tripId}`, err);
    }
  }

  private async broadcast(
    payloadBase: Omit<PartnerWebhookPayload, 'eventId' | 'recipientChannel'>,
    excludePartnerChannelId?: string,
  ) {
    const channels = await this.prisma.partnerChannel.findMany({
      where: {
        isActive: true,
        webhookUrl: { not: null },
        ...(excludePartnerChannelId ? { id: { not: excludePartnerChannelId } } : {}),
      },
      select: { id: true, code: true, webhookUrl: true },
    });

    const withUrl = channels.filter((c) => c.webhookUrl?.trim());
    if (!withUrl.length) return;

    await Promise.all(
      withUrl.map((channel) => {
        const payload: PartnerWebhookPayload = {
          ...payloadBase,
          eventId: randomUUID(),
          recipientChannel: channel.code,
        };
        return this.deliver(channel.id, channel.code, channel.webhookUrl!, payload);
      }),
    );
  }

  private async deliver(
    channelId: string,
    channelCode: PartnerChannelCode,
    webhookUrl: string,
    payload: PartnerWebhookPayload,
  ) {
    const body = JSON.stringify(payload);
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'User-Agent': 'ShivaSakti-PartnerWebhook/1.0',
      'X-ShivaSakti-Event': payload.event,
      'X-ShivaSakti-Delivery-Id': payload.eventId,
      'X-ShivaSakti-Channel': channelCode,
      'X-ShivaSakti-Timestamp': timestamp,
    };

    const secret = this.config.get<string>('PARTNER_WEBHOOK_HMAC_SECRET');
    if (secret) {
      const signature = createHmac('sha256', secret)
        .update(`${timestamp}.${body}`)
        .digest('hex');
      headers['X-ShivaSakti-Signature'] = `t=${timestamp},v1=${signature}`;
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10_000);

    try {
      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers,
        body,
        signal: controller.signal,
      });

      if (!response.ok) {
        const text = await response.text().catch(() => '');
        this.logger.warn(
          `Partner webhook ${payload.event} → ${channelCode} failed (${response.status}): ${text.slice(0, 200)}`,
        );
        return { ok: false, status: response.status, error: text.slice(0, 200) };
      }

      this.logger.log(`Partner webhook ${payload.event} delivered to ${channelCode} (${channelId})`);
      return { ok: true, status: response.status };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Webhook delivery failed';
      this.logger.warn(`Partner webhook ${payload.event} → ${channelCode} error: ${message}`);
      return { ok: false, status: 0, error: message };
    } finally {
      clearTimeout(timeout);
    }
  }

  private async countAvailableSeats(tripId: string, totalSeats: number) {
    const occupied = await this.prisma.bookingSeat.count({
      where: { tripId, occupancyStatus: 'OCCUPIED' },
    });
    return Math.max(totalSeats - occupied, 0);
  }
}
