import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';
import {
  CreateRouteBusAssignmentDto,
  CreateRouteSegmentFareDto,
  CreateRouteStopDto,
} from './create-route.dto';

export class UpdateRouteFullDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  baseFare?: number;

  @ApiPropertyOptional({ type: [CreateRouteStopDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateRouteStopDto)
  stops?: CreateRouteStopDto[];

  @ApiPropertyOptional({ type: [CreateRouteSegmentFareDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateRouteSegmentFareDto)
  segmentFares?: CreateRouteSegmentFareDto[];

  @ApiPropertyOptional()
  @IsOptional()
  @ValidateNested()
  @Type(() => CreateRouteBusAssignmentDto)
  bus?: CreateRouteBusAssignmentDto;

  @ApiPropertyOptional({ example: '20:30' })
  @IsOptional()
  @IsString()
  departureTime?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(7)
  daysAhead?: number;
}
