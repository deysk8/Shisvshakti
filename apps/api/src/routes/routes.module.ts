import { Module } from '@nestjs/common';
import { RoutesService } from './routes.service';
import { PublicRoutesController } from './public-routes.controller';

@Module({
  controllers: [PublicRoutesController],
  providers: [RoutesService],
  exports: [RoutesService],
})
export class RoutesModule {}
