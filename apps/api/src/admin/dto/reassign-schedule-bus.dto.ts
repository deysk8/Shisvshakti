import { ApiProperty } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';

export class ReassignScheduleBusDto {
  @ApiProperty()
  @IsUUID()
  busId!: string;
}
