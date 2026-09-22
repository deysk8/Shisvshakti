import { ApiProperty } from '@nestjs/swagger';
import { IsDateString } from 'class-validator';

export class RestoreRouteDateDto {
  @ApiProperty({ example: '2026-09-02' })
  @IsDateString()
  serviceDate!: string;
}
