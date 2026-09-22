import { Module } from '@nestjs/common';
import { MapsModule } from '../maps/maps.module';
import { TrackingController } from './tracking.controller';
import { TrackingService } from './tracking.service';

@Module({
  imports: [MapsModule],
  controllers: [TrackingController],
  providers: [TrackingService],
})
export class TrackingModule {}
