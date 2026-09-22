import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateBusCrewDto {
  @ApiPropertyOptional({ example: 'Ramesh Kumar' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  driver1Name?: string | null;

  @ApiPropertyOptional({ example: 'Suresh Patnaik' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  driver2Name?: string | null;

  @ApiPropertyOptional({ example: 'Manoj Das' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  conductorName?: string | null;
}
