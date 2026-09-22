import { Module } from '@nestjs/common';
import { NotificationsModule } from '../notifications/notifications.module';
import { RatingsModule } from '../ratings/ratings.module';
import { CouponsModule } from '../coupons/coupons.module';
import { TicketsModule } from '../tickets/tickets.module';
import { PublicController } from './public.controller';
import { PublicService } from './public.service';

@Module({
  imports: [NotificationsModule, RatingsModule, CouponsModule, TicketsModule],
  controllers: [PublicController],
  providers: [PublicService],
})
export class PublicModule {}
