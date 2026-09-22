import { Body, Controller, ForbiddenException, Get, Header, NotFoundException, Param, Post, StreamableFile } from '@nestjs/common';

import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

import { UserRole } from '@prisma/client';

import * as fs from 'fs';

import { CurrentUser } from '../common/decorators/current-user.decorator';

import { AuthUser } from '../auth/types/auth-user.type';

import { PrismaService } from '../prisma/prisma.service';

import { PdfService } from './pdf.service';

import { TicketsService } from './tickets.service';

import { BoardingReferenceDto, VerifyTicketDto } from './dto/verify-ticket.dto';



const REPRINT_STATUSES = ['CONFIRMED', 'COMPLETED'] as const;



@ApiTags('tickets')

@ApiBearerAuth()

@Controller('tickets')

export class TicketsController {

  constructor(

    private prisma: PrismaService,

    private pdf: PdfService,

    private tickets: TicketsService,

  ) {}



  private ensureStaff(user: AuthUser) {

    if (user.role === UserRole.CUSTOMER) {

      throw new ForbiddenException('Agents and staff only');

    }

  }



  private async findOwnedBooking(reference: string, user: AuthUser) {

    const where =

      user.role === UserRole.ADMIN

        ? { bookingReference: reference }

        : {

            bookingReference: reference,

            OR: [{ customerUserId: user.id }, { agent: { userId: user.id } }],

          };

    return this.prisma.booking.findFirst({ where, include: { ticket: true } });

  }



  @Get('by-reference/:reference/pdf')

  @Header('Content-Type', 'application/pdf')

  async downloadByReference(

    @CurrentUser() user: AuthUser,

    @Param('reference') reference: string,

  ) {

    const booking = await this.findOwnedBooking(reference, user);

    if (!booking || !REPRINT_STATUSES.includes(booking.status as (typeof REPRINT_STATUSES)[number])) {

      throw new NotFoundException('Ticket not available');

    }



    if (!booking.ticket) {

      await this.tickets.issueForBooking(booking.id);

    }



    const filePath = await this.pdf.ensurePdf(booking.id);

    if (!fs.existsSync(filePath)) {

      throw new NotFoundException('PDF could not be generated');

    }



    const stream = fs.createReadStream(filePath);

    return new StreamableFile(stream, {

      type: 'application/pdf',

      disposition: `attachment; filename="shiv-shakti-${reference}.pdf"`,

    });

  }



  @Post('verify')

  verify(@CurrentUser() user: AuthUser, @Body() dto: VerifyTicketDto) {

    this.ensureStaff(user);

    return this.tickets.verifyScan(dto.qrToken, user.id, dto.markBoarded ?? true);

  }



  @Post('lookup')

  lookup(@CurrentUser() user: AuthUser, @Body() dto: BoardingReferenceDto) {

    this.ensureStaff(user);

    return this.tickets.lookupByReference(dto.bookingReference, user.id, user.role);

  }



  @Post('board')

  board(@CurrentUser() user: AuthUser, @Body() dto: BoardingReferenceDto) {

    this.ensureStaff(user);

    return this.tickets.markBoardedByReference(dto.bookingReference, user.id, user.role);

  }



  @Post('no-show')

  markNoShow(@CurrentUser() user: AuthUser, @Body() dto: BoardingReferenceDto) {

    this.ensureStaff(user);

    return this.tickets.markNoShowByReference(dto.bookingReference, user.id, user.role);

  }

}


