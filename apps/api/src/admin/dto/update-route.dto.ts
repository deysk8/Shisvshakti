import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean } from 'class-validator';

export class UpdateRouteDto {
  @ApiProperty({ description: 'When false, route is hidden from search and schedules are paused' })
  @IsBoolean()
  isActive!: boolean;
}
