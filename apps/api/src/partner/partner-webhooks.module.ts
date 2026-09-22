import { Module } from '@nestjs/common';
import { PartnerWebhooksService } from './partner-webhooks.service';

@Module({
  providers: [PartnerWebhooksService],
  exports: [PartnerWebhooksService],
})
export class PartnerWebhooksModule {}
