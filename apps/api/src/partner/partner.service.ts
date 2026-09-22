import {
  BadRequestException,
  Injectable,
} from '@nestjs/common';
import { PartnerChannelCode } from '@prisma/client';
import { AvailabilityService } from '../availability/availability.service';
import { BookingsService } from '../bookings/bookings.service';
import { CancellationsService } from '../cancellations/cancellations.service';
import { SearchService } from '../search/search.service';
import { AuthenticatedPartnerChannel } from './types/partner-channel.type';
import {
  PartnerCancelBookingDto,
  PartnerConfirmBookingDto,
  PartnerLockSeatsDto,
  PartnerSearchTripsDto,
  PartnerSeatMapQueryDto,
} from './dto/partner.dto';

@Injectable()
export class PartnerService {
  constructor(
    private search: SearchService,
    private availability: AvailabilityService,
    private bookings: BookingsService,
    private cancellations: CancellationsService,
  ) {}

  searchTrips(dto: PartnerSearchTripsDto) {
    return this.search.searchTrips(dto);
  }

  async getSeatMap(tripId: string, query: PartnerSeatMapQueryDto) {
    const map = await this.availability.getTripSeatMap(tripId, {
      fromSequence: query.fromSequence,
      toSequence: query.toSequence,
    });
    return {
      ...map,
      inventoryNote:
        'Seat status reflects all channels (website, agents, and partners). Poll before confirm or use lock → confirm.',
    };
  }

  lockSeats(channel: AuthenticatedPartnerChannel, dto: PartnerLockSeatsDto) {
    return this.bookings.lockSeatsForUser(channel.systemUserId, {
      tripId: dto.tripId,
      seatIds: dto.seatIds,
    });
  }

  confirmBooking(channel: AuthenticatedPartnerChannel, dto: PartnerConfirmBookingDto) {
    if (!dto.partnerReference.trim()) {
      throw new BadRequestException('partnerReference is required');
    }
    return this.bookings.confirmPartnerBooking(channel, dto);
  }

  getBooking(channel: AuthenticatedPartnerChannel, partnerReference: string) {
    return this.bookings.getPartnerBooking(channel.id, partnerReference);
  }

  cancelBooking(
    channel: AuthenticatedPartnerChannel,
    partnerReference: string,
    dto: PartnerCancelBookingDto,
  ) {
    return this.cancellations.partnerCancelBooking(
      channel.id,
      partnerReference,
      dto.reason,
    );
  }

  channelMeta(channel: AuthenticatedPartnerChannel) {
    return {
      code: channel.code,
      name: channel.name,
      bookingSource: this.bookingSourceForCode(channel.code),
    };
  }

  private bookingSourceForCode(code: PartnerChannelCode) {
    return code === PartnerChannelCode.REDBUS ? 'PARTNER_REDBUS' : 'PARTNER_ABHIBUS';
  }
}
