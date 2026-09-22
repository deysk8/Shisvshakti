import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';

export class CreateRouteStopDto {
  @ApiProperty({ example: 'Jharsuguda Junction' })
  @IsString()
  @MinLength(2)
  stopName!: string;

  @ApiProperty({ example: 'Jharsuguda' })
  @IsString()
  @MinLength(2)
  city!: string;

  @ApiPropertyOptional({ example: 'Odisha' })
  @IsOptional()
  @IsString()
  state?: string;

  @ApiProperty({ example: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  sequence!: number;

  @ApiProperty({ description: 'Minutes from route origin when bus arrives', example: 0 })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  arrivalOffsetMin!: number;

  @ApiProperty({ description: 'Minutes from route origin when bus departs', example: 0 })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  departureOffsetMin!: number;

  @ApiProperty({ example: 0 })
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  distanceFromOriginKm!: number;
}

export class CreateRouteSegmentFareDto {
  @ApiProperty()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  fromSequence!: number;

  @ApiProperty()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  toSequence!: number;

  @ApiProperty()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  amount!: number;
}

export class CreateRouteBusAssignmentDto {
  @ApiPropertyOptional({ description: 'Existing bus UUID' })
  @IsOptional()
  @IsUUID()
  busId?: string;

  @ApiPropertyOptional({ description: 'Register a new bus with this number' })
  @IsOptional()
  @IsString()
  @MinLength(3)
  registrationNumber?: string;

  @ApiPropertyOptional({ example: 'Shiv Shakti Express 2' })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ description: 'Required when registering a new bus' })
  @IsOptional()
  @IsUUID()
  busTypeId?: string;
}

export class CreateRouteDto {
  @ApiProperty({ example: 'JRG-BLR' })
  @IsString()
  @MinLength(3)
  code!: string;

  @ApiProperty({ example: 'Jharsuguda – Bangalore' })
  @IsString()
  @MinLength(3)
  name!: string;

  @ApiProperty({ description: 'Full-route fare (origin to destination)', example: 1200 })
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  baseFare!: number;

  @ApiProperty({ type: [CreateRouteStopDto] })
  @IsArray()
  @ArrayMinSize(2)
  @ValidateNested({ each: true })
  @Type(() => CreateRouteStopDto)
  stops!: CreateRouteStopDto[];

  @ApiPropertyOptional({ type: [CreateRouteSegmentFareDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateRouteSegmentFareDto)
  segmentFares?: CreateRouteSegmentFareDto[];

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @ValidateNested()
  @Type(() => CreateRouteBusAssignmentDto)
  bus?: CreateRouteBusAssignmentDto;

  @ApiPropertyOptional({ example: '20:30', description: 'Required when assigning a bus' })
  @IsOptional()
  @IsString()
  departureTime?: string;

  @ApiPropertyOptional({ default: 45 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(7)
  daysAhead?: number;
}
