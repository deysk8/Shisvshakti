import { Module } from '@nestjs/common';
import { CancellationsModule } from '../cancellations/cancellations.module';
import { PartnerWebhooksModule } from '../partner/partner-webhooks.module';
import { SchedulesService } from './schedules.service';

@Module({
  imports: [CancellationsModule, PartnerWebhooksModule],
  providers: [SchedulesService],
  exports: [SchedulesService],
})
export class SchedulesModule {}
