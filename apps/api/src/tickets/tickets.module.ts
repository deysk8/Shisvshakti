import { Module } from '@nestjs/common';
import { PdfService } from './pdf.service';
import { TicketsController } from './tickets.controller';
import { TicketsService } from './tickets.service';

@Module({
  controllers: [TicketsController],
  providers: [TicketsService, PdfService],
  exports: [TicketsService, PdfService],
})
export class TicketsModule {}
