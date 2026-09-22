import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class CancelBookingDto {
  @ApiPropertyOptional({ example: 'Change of plans' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}
