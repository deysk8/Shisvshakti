import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiHeader, ApiTags } from '@nestjs/swagger';
import { Public } from '../common/decorators/public.decorator';
import { PartnerChannelCtx } from './decorators/partner-channel.decorator';
import {
  PartnerCancelBookingDto,
  PartnerConfirmBookingDto,
  PartnerLockSeatsDto,
  PartnerSearchTripsDto,
  PartnerSeatMapQueryDto,
} from './dto/partner.dto';
import { PartnerAuthGuard } from './guards/partner-auth.guard';
import { PartnerService } from './partner.service';
import { AuthenticatedPartnerChannel } from './types/partner-channel.type';

@ApiTags('partner')
@ApiHeader({ name: 'X-Partner-Key', description: 'Partner API key (or Authorization: Bearer)' })
@Public()
@UseGuards(PartnerAuthGuard)
@Controller('partner/v1')
export class PartnerController {
  constructor(private partner: PartnerService) {}

  @Get('whoami')
  whoami(@PartnerChannelCtx() channel: AuthenticatedPartnerChannel) {
    return this.partner.channelMeta(channel);
  }

  @Get('trips/search')
  searchTrips(@Query() query: PartnerSearchTripsDto) {
    return this.partner.searchTrips(query);
  }

  @Get('trips/:tripId/seats')
  seatMap(@Param('tripId') tripId: string, @Query() query: PartnerSeatMapQueryDto) {
    return this.partner.getSeatMap(tripId, query);
  }

  @Post('locks')
  lockSeats(
    @PartnerChannelCtx() channel: AuthenticatedPartnerChannel,
    @Body() dto: PartnerLockSeatsDto,
  ) {
    return this.partner.lockSeats(channel, dto);
  }

  @Post('bookings/confirm')
  confirmBooking(
    @PartnerChannelCtx() channel: AuthenticatedPartnerChannel,
    @Body() dto: PartnerConfirmBookingDto,
  ) {
    return this.partner.confirmBooking(channel, dto);
  }

  @Get('bookings/:partnerReference')
  getBooking(
    @PartnerChannelCtx() channel: AuthenticatedPartnerChannel,
    @Param('partnerReference') partnerReference: string,
  ) {
    return this.partner.getBooking(channel, partnerReference);
  }

  @Post('bookings/:partnerReference/cancel')
  cancelBooking(
    @PartnerChannelCtx() channel: AuthenticatedPartnerChannel,
    @Param('partnerReference') partnerReference: string,
    @Body() dto: PartnerCancelBookingDto,
  ) {
    return this.partner.cancelBooking(channel, partnerReference, dto);
  }
}
