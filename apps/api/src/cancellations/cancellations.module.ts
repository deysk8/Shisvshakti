import { Module } from '@nestjs/common';
import { PaymentsModule } from '../payments/payments.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { PartnerWebhooksModule } from '../partner/partner-webhooks.module';
import { CancellationsController } from './cancellations.controller';
import { CancellationsService } from './cancellations.service';

@Module({
  imports: [PaymentsModule, NotificationsModule, PartnerWebhooksModule],
  controllers: [CancellationsController],
  providers: [CancellationsService],
  exports: [CancellationsService],
})
export class CancellationsModule {}
