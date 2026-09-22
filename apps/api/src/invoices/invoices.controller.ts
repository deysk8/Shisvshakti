import { Controller, Get, Header, NotFoundException, Param, StreamableFile } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import * as fs from 'fs';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthUser } from '../auth/types/auth-user.type';
import { PrismaService } from '../prisma/prisma.service';
import { InvoicesService } from './invoices.service';

@ApiTags('invoices')
@ApiBearerAuth()
@Controller('invoices')
export class InvoicesController {
  constructor(
    private invoices: InvoicesService,
    private prisma: PrismaService,
  ) {}

  @Get('by-reference/:reference/pdf')
  @Header('Content-Type', 'application/pdf')
  async downloadByReference(
    @CurrentUser() user: AuthUser,
    @Param('reference') reference: string,
  ) {
    const where =
      user.role === UserRole.ADMIN
        ? { bookingReference: reference }
        : {
            bookingReference: reference,
            OR: [{ customerUserId: user.id }, { agent: { userId: user.id } }],
          };
    const booking = await this.prisma.booking.findFirst({ where });
    if (!booking || booking.status !== 'CONFIRMED') {
      throw new NotFoundException('Invoice not available');
    }

    const filePath = await this.invoices.getPdfPath(booking.id);
    if (!fs.existsSync(filePath)) throw new NotFoundException('PDF could not be generated');

    return new StreamableFile(fs.createReadStream(filePath), {
      type: 'application/pdf',
      disposition: `attachment; filename="invoice-${reference}.pdf"`,
    });
  }
}
