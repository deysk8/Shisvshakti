import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  ValidateNested,
} from 'class-validator';

class TripSeatOverrideItemDto {
  @IsUUID()
  busSeatId!: string;

  @IsNumber()
  @Min(1)
  amount!: number;

  @IsOptional()
  @IsString()
  note?: string;
}

export class UpsertTripSeatPricingDto {
  @IsInt()
  @Min(1)
  fromSequence!: number;

  @IsInt()
  @Min(1)
  toSequence!: number;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => TripSeatOverrideItemDto)
  overrides!: TripSeatOverrideItemDto[];
}
