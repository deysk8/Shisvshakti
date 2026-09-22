import { Controller, Get, Param, Query } from '@nestjs/common';

import { ApiTags } from '@nestjs/swagger';

import { Public } from '../common/decorators/public.decorator';

import { AvailabilityService } from './availability.service';



@ApiTags('availability')

@Controller('trips')

export class AvailabilityController {

  constructor(private availabilityService: AvailabilityService) {}



  @Public()

  @Get(':tripId/seats')

  getSeatMap(

    @Param('tripId') tripId: string,

    @Query('baseFare') baseFare?: string,

    @Query('fromSequence') fromSequence?: string,

    @Query('toSequence') toSequence?: string,

  ) {

    const fare = baseFare ? Number(baseFare) : undefined;

    const from = fromSequence ? parseInt(fromSequence, 10) : undefined;

    const to = toSequence ? parseInt(toSequence, 10) : undefined;

    return this.availabilityService.getTripSeatMap(tripId, {

      baseFare: fare,

      fromSequence: from,

      toSequence: to,

    });

  }

}


