import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsNumber, IsOptional, IsString, IsUUID } from 'class-validator';

export class AssignRouteBusDto {
  @ApiProperty({ description: 'Bus UUID — use registration number from fleet list' })
  @IsUUID()
  busId!: string;

  @ApiProperty({ example: '06:00', description: 'Daily departure time (24h)' })
  @IsString()
  departureTime!: string;

  @ApiPropertyOptional({ description: 'Schedule base fare; defaults to route full-journey fare' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  baseFare?: number;

  @ApiPropertyOptional({ description: 'Days of trips to generate ahead', default: 45 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  daysAhead?: number;
}
