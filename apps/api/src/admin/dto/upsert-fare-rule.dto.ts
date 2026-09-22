import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsNumber } from 'class-validator';

export class UpsertFareRuleDto {
  @ApiProperty()
  @Type(() => Number)
  @IsInt()
  fromSequence!: number;

  @ApiProperty()
  @Type(() => Number)
  @IsInt()
  toSequence!: number;

  @ApiProperty()
  @Type(() => Number)
  @IsNumber()
  amount!: number;
}
