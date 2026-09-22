import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString, MinLength } from 'class-validator';

export class VerifyTicketDto {
  @ApiProperty()
  @IsString()
  @MinLength(16)
  qrToken!: string;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  markBoarded?: boolean;
}

export class BoardingReferenceDto {
  @ApiProperty({ example: 'SS240801ABC1' })
  @IsString()
  @MinLength(6)
  bookingReference!: string;
}
