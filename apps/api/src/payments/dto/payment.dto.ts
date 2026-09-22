import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsUUID } from 'class-validator';

export class CreateOrderDto {
  @ApiProperty()
  @IsUUID()
  bookingId!: string;
}

export class VerifyPaymentDto {
  @ApiProperty()
  @IsUUID()
  bookingId!: string;

  @ApiProperty()
  @IsString()
  gatewayOrderId!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  gatewayPaymentId?: string;
}
