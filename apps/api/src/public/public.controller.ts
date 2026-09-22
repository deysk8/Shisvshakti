import { Body, Controller, Get, Header, NotFoundException, Param, Post, Query, StreamableFile } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { createReadStream } from 'fs';
import { Type } from 'class-transformer';
import { IsEmail, IsInt, IsOptional, IsString, MinLength } from 'class-validator';
import { Public } from '../common/decorators/public.decorator';
import { CouponsService } from '../coupons/coupons.service';
import { PublicService } from './public.service';

class EnquiryDto {
  @IsString()
  @MinLength(2)
  name!: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsString()
  @MinLength(10)
  mobile!: string;

  @IsString()
  enquiryType!: string;

  @IsOptional()
  @IsString()
  fromCity?: string;

  @IsOptional()
  @IsString()
  toCity?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  seats?: number;

  @IsOptional()
  @IsString()
  busType?: string;

  @IsOptional()
  @IsString()
  message?: string;
}

@ApiTags('public')
@Controller('public')
export class PublicController {
  constructor(
    private publicService: PublicService,
    private coupons: CouponsService,
  ) {}

  @Public()
  @Get('company')
  company() {
    return this.publicService.getCompanyInfo();
  }

  @Public()
  @Get('booking-policies')
  bookingPolicies() {
    return this.publicService.getBookingPolicies();
  }

  @Public()
  @Get('testimonials')
  testimonials() {
    return this.publicService.getTestimonials();
  }

  @Public()
  @Get('popular-routes')
  popularRoutes() {
    return this.publicService.getPopularRoutes();
  }

  @Public()
  @Get('coupons/preview')
  couponPreview(@Query('code') code: string, @Query('subtotal') subtotal: string) {
    const amount = parseFloat(subtotal);
    return this.coupons.preview(code, Number.isFinite(amount) ? amount : 0);
  }

  @Public()
  @Post('enquiries')
  enquiry(@Body() dto: EnquiryDto) {
    return this.publicService.submitEnquiry(dto);
  }

  @Public()
  @Get('tickets/:reference/pdf')
  @Header('Content-Type', 'application/pdf')
  async ticketPdf(@Param('reference') reference: string, @Query('token') token: string) {
    if (!token?.trim()) {
      throw new NotFoundException('Ticket not found');
    }
    const result = await this.publicService.downloadTicketPdf(reference, token.trim());
    const stream = createReadStream(result.filePath);
    return new StreamableFile(stream, {
      type: 'application/pdf',
      disposition: `attachment; filename="${result.filename}"`,
    });
  }
}
