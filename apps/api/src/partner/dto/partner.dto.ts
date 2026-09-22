import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsEmail,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  ValidateNested,
} from 'class-validator';
import { SearchTripsDto } from '../../search/dto/search-trips.dto';

export class PartnerSearchTripsDto extends SearchTripsDto {}

export class PartnerSeatMapQueryDto {
  @ApiProperty({ example: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  fromSequence!: number;

  @ApiProperty({ example: 5 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  toSequence!: number;
}

export class PartnerLockSeatsDto {
  @ApiProperty()
  @IsUUID()
  tripId!: string;

  @ApiProperty({ type: [String], description: 'Bus seat IDs from the seat map' })
  @IsArray()
  @ArrayMinSize(1)
  @IsUUID('4', { each: true })
  seatIds!: string[];
}

export class PartnerPassengerDto {
  @ApiProperty()
  @IsString()
  fullName!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
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

export class PartnerConfirmBookingDto {
  @ApiProperty()
  @IsUUID()
  tripId!: string;

  @ApiProperty()
  @IsString()
  lockToken!: string;

  @ApiProperty({ description: 'Unique booking ID on the partner platform' })
  @IsString()
  partnerReference!: string;

  @ApiProperty({ example: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  boardingSequence!: number;

  @ApiProperty({ example: 5 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
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

  @ApiProperty({ type: [PartnerPassengerDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => PartnerPassengerDto)
  passengers!: PartnerPassengerDto[];

  @ApiPropertyOptional({ description: 'Amount collected by partner (for reconciliation)' })
  @IsOptional()
  @Type(() => Number)
  @Min(0)
  totalAmountPaid?: number;
}

export class PartnerCancelBookingDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  reason?: string;
}

export class UpdatePartnerChannelDto {
  @ApiPropertyOptional()
  @IsOptional()
  isActive?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  commissionPercent?: number | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  webhookUrl?: string | null;
}
