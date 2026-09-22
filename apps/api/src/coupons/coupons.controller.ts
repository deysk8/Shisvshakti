import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { Public } from '../common/decorators/public.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { CouponsService } from './coupons.service';
import { CreateCouponDto } from './dto/create-coupon.dto';

@ApiTags('coupons')
@Controller('coupons')
export class CouponsController {
  constructor(private coupons: CouponsService) {}

  @Public()
  @Get('preview')
  preview(@Query('code') code: string, @Query('subtotal') subtotal: string) {
    const amount = parseFloat(subtotal);
    return this.coupons.preview(code, Number.isFinite(amount) ? amount : 0);
  }

  @Get()
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  list() {
    return this.coupons.listActive();
  }

  @Post()
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  create(@Body() dto: CreateCouponDto) {
    return this.coupons.create(dto);
  }

  @Post(':id/deactivate')
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  deactivate(@Param('id') id: string) {
    return this.coupons.update(id, { isActive: false });
  }
}
