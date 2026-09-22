import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsEnum, IsInt, IsNumber, IsOptional, IsString, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class SearchTripsDto {
  @ApiProperty({ example: 'Jharsuguda' })
  @IsString()
  fromCity!: string;

  @ApiProperty({ example: 'Bangalore' })
  @IsString()
  toCity!: string;

  @ApiProperty({ example: '2026-09-22' })
  @IsDateString()
  date!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  maxPrice?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  minSeats?: number;

  @ApiPropertyOptional({ enum: ['departure', 'price', 'duration', 'availability'] })
  @IsOptional()
  @IsEnum(['departure', 'price', 'duration', 'availability'])
  sort?: 'departure' | 'price' | 'duration' | 'availability';

  @ApiPropertyOptional({ description: 'Segment boarding time from, HH:mm (24h)' })
  @IsOptional()
  @IsString()
  departAfter?: string;

  @ApiPropertyOptional({ description: 'Segment boarding time until, HH:mm (24h)' })
  @IsOptional()
  @IsString()
  departBefore?: string;
}
