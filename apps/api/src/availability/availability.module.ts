import { Module } from '@nestjs/common';

import { AvailabilityController } from './availability.controller';

import { AvailabilityService } from './availability.service';

import { PricingModule } from '../pricing/pricing.module';



@Module({

  imports: [PricingModule],

  controllers: [AvailabilityController],

  providers: [AvailabilityService],

  exports: [AvailabilityService],

})

export class AvailabilityModule {}


