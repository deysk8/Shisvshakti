import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import configuration from './config/configuration';
import { PrismaModule } from './prisma/prisma.module';
import { HealthModule } from './health/health.module';
import { AuthModule } from './auth/auth.module';
import { AdminModule } from './admin/admin.module';
import { RoutesModule } from './routes/routes.module';
import { BookingsModule } from './bookings/bookings.module';
import { SearchModule } from './search/search.module';
import { AvailabilityModule } from './availability/availability.module';
import { PaymentsModule } from './payments/payments.module';
import { NotificationsModule } from './notifications/notifications.module';
import { TicketsModule } from './tickets/tickets.module';
import { MapsModule } from './maps/maps.module';
import { TrackingModule } from './tracking/tracking.module';
import { CancellationsModule } from './cancellations/cancellations.module';
import { SecurityModule } from './security/security.module';
import { AgentModule } from './agent/agent.module';
import { PublicModule } from './public/public.module';
import { LoyaltyModule } from './loyalty/loyalty.module';
import { CouponsModule } from './coupons/coupons.module';
import { SavedPassengersModule } from './saved-passengers/saved-passengers.module';
import { RatingsModule } from './ratings/ratings.module';
import { InvoicesModule } from './invoices/invoices.module';
import { PartnerModule } from './partner/partner.module';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { RolesGuard } from './common/guards/roles.guard';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      envFilePath: ['.env'],
    }),
    ThrottlerModule.forRoot({
      throttlers: [{ ttl: 60_000, limit: 120 }],
    }),
    SecurityModule,
    PrismaModule,
    HealthModule,
    AuthModule,
    AdminModule,
    RoutesModule,
    SearchModule,
    AvailabilityModule,
    BookingsModule,
    PaymentsModule,
    NotificationsModule,
    TicketsModule,
    MapsModule,
    TrackingModule,
    CancellationsModule,
    AgentModule,
    PublicModule,
    LoyaltyModule,
    CouponsModule,
    SavedPassengersModule,
    RatingsModule,
    InvoicesModule,
    PartnerModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule {}
