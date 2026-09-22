import { Module } from '@nestjs/common';
import { SavedPassengersController } from './saved-passengers.controller';
import { SavedPassengersService } from './saved-passengers.service';

@Module({
  controllers: [SavedPassengersController],
  providers: [SavedPassengersService],
  exports: [SavedPassengersService],
})
export class SavedPassengersModule {}
