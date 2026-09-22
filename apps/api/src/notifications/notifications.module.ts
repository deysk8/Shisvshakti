import { Module } from '@nestjs/common';
import { TicketsModule } from '../tickets/tickets.module';
import { MobileMessagingService } from './mobile-messaging.service';
import { NotificationsService } from './notifications.service';

@Module({
  imports: [TicketsModule],
  providers: [NotificationsService, MobileMessagingService],
  exports: [NotificationsService],
})
export class NotificationsModule {}
