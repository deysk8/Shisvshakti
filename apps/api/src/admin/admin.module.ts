import { Module } from '@nestjs/common';
import { AnalyticsModule } from '../analytics/analytics.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { CouponsModule } from '../coupons/coupons.module';
import { PartnerModule } from '../partner/partner.module';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { FleetModule } from '../fleet/fleet.module';
import { RoutesModule } from '../routes/routes.module';
import { SchedulesModule } from '../schedules/schedules.module';

import { PricingModule } from '../pricing/pricing.module';

@Module({
  imports: [FleetModule, RoutesModule, SchedulesModule, AnalyticsModule, NotificationsModule, CouponsModule, PricingModule, PartnerModule],
  controllers: [AdminController],
  providers: [AdminService],
})
export class AdminModule {}
