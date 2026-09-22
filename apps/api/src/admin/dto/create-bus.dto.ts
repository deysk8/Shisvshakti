import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsUUID, MinLength } from 'class-validator';

export class CreateBusDto {
  @ApiProperty()
  @IsString()
  @MinLength(3)
  registrationNumber!: string;

  @ApiProperty()
  @IsString()
  name!: string;

  @ApiProperty()
  @IsUUID()
  busTypeId!: string;
}
