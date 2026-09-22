import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsDateString, IsOptional, IsString, MaxLength } from 'class-validator';

export class CancelRouteDateDto {
  @ApiProperty({ example: '2026-09-02' })
  @IsDateString()
  serviceDate!: string;

  @ApiPropertyOptional({ example: 'Bus breakdown — route not running today' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  refundPassengers?: boolean;
}
