import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsEmail,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  MinLength,
} from 'class-validator';
import { Type } from 'class-transformer';

export class LockSeatsDto {
  @ApiProperty()
  @IsUUID()
  tripId!: string;

  @ApiProperty({ type: [String] })
  @IsArray()
  @ArrayMinSize(1)
  @IsUUID('4', { each: true })
  seatIds!: string[];
}

export class PassengerDto {
  @ApiProperty()
  @IsString()
  @MinLength(2)
  fullName!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  age?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  gender?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  phone?: string;
}

export class CreateBookingDraftDto {
  @ApiProperty()
  @IsUUID()
  tripId!: string;

  @ApiProperty()
  @IsString()
  lockToken!: string;

  @ApiProperty()
  @Type(() => Number)
  @IsInt()
  boardingSequence!: number;

  @ApiProperty()
  @Type(() => Number)
  @IsInt()
  droppingSequence!: number;

  @ApiProperty()
  @IsString()
  contactName!: string;

  @ApiProperty()
  @IsString()
  contactPhone!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsEmail()
  contactEmail?: string;

  @ApiProperty({ type: [PassengerDto] })
  @IsArray()
  @ArrayMinSize(1)
  passengers!: PassengerDto[];

  @ApiPropertyOptional({ description: 'Agent walk-in cash booking' })
  @IsOptional()
  @IsBoolean()
  agentCash?: boolean;

  @ApiPropertyOptional({ description: '10% senior citizen discount' })
  @IsOptional()
  @IsBoolean()
  seniorCitizen?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  customerUserId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  couponCode?: string;

  @ApiPropertyOptional({ description: 'Loyalty points to redeem (1 point = ₹1)' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  redeemLoyaltyPoints?: number;
}

export class RescheduleBookingDto {
  @ApiProperty()
  @IsUUID()
  tripId!: string;

  @ApiProperty()
  @IsString()
  lockToken!: string;

  @ApiPropertyOptional({ description: 'Ignored — original booking segment is preserved' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  boardingSequence?: number;

  @ApiPropertyOptional({ description: 'Ignored — original booking segment is preserved' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  droppingSequence?: number;
}

export class ConfirmBookingDto {
  @ApiProperty()
  @IsUUID()
  bookingId!: string;
}
