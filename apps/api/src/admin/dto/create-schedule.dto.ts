import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsNumber, IsOptional, IsString, IsUUID } from 'class-validator';

export class CreateScheduleDto {
  @ApiProperty()
  @IsUUID()
  routeId!: string;

  @ApiProperty()
  @IsUUID()
  busId!: string;

  @ApiProperty({ example: '20:30' })
  @IsString()
  departureTime!: string;

  @ApiProperty()
  @Type(() => Number)
  @IsNumber()
  baseFare!: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  daysAhead?: number;
}
