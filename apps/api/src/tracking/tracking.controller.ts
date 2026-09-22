import { Body, Controller, Get, Headers, Param, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { Public } from '../common/decorators/public.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { TrackingService } from './tracking.service';
import { IngestPositionDto } from './dto/ingest-position.dto';

@ApiTags('tracking')
@Controller('tracking')
export class TrackingController {
  constructor(private tracking: TrackingService) {}

  @Public()
  @Get('trips/:tripId/position')
  getPosition(@Param('tripId') tripId: string) {
    return this.tracking.getTripPosition(tripId);
  }

  @Post('ingest')
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  ingestAdmin(@Body() dto: IngestPositionDto) {
    return this.tracking.ingestPosition(dto);
  }

  @Public()
  @Post('ingest/device')
  ingestDevice(
    @Body() dto: IngestPositionDto,
    @Headers('x-gps-secret') secret?: string,
  ) {
    return this.tracking.ingestPosition(dto, secret);
  }
}
