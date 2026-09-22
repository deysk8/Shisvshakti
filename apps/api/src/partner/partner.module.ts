import { Module } from '@nestjs/common';
import { AvailabilityModule } from '../availability/availability.module';
import { BookingsModule } from '../bookings/bookings.module';
import { CancellationsModule } from '../cancellations/cancellations.module';
import { SearchModule } from '../search/search.module';
import { PartnerWebhooksModule } from './partner-webhooks.module';
import { PartnerAuthGuard } from './guards/partner-auth.guard';
import { PartnerChannelsService } from './partner-channels.service';
import { PartnerController } from './partner.controller';
import { PartnerService } from './partner.service';

@Module({
  imports: [PartnerWebhooksModule, SearchModule, AvailabilityModule, BookingsModule, CancellationsModule],
  controllers: [PartnerController],
  providers: [PartnerService, PartnerChannelsService, PartnerAuthGuard],
  exports: [PartnerChannelsService, PartnerWebhooksModule],
})
export class PartnerModule {}
