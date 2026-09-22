import { Module } from '@nestjs/common';
import { BookingsController } from './bookings.controller';
import { BookingsService } from './bookings.service';
import { NotificationsModule } from '../notifications/notifications.module';
import { TicketsModule } from '../tickets/tickets.module';
import { LoyaltyModule } from '../loyalty/loyalty.module';
import { CouponsModule } from '../coupons/coupons.module';
import { InvoicesModule } from '../invoices/invoices.module';
import { PricingModule } from '../pricing/pricing.module';
import { PartnerWebhooksModule } from '../partner/partner-webhooks.module';

@Module({
  imports: [TicketsModule, NotificationsModule, LoyaltyModule, CouponsModule, InvoicesModule, PricingModule, PartnerWebhooksModule],
  controllers: [BookingsController],
  providers: [BookingsService],
  exports: [BookingsService],
})
export class BookingsModule {}
