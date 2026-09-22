import { Controller, Get, Param } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Public } from '../common/decorators/public.decorator';
import { MapsService } from './maps.service';

@ApiTags('maps')
@Controller('maps')
export class MapsController {
  constructor(private maps: MapsService) {}

  @Public()
  @Get('routes/:code')
  getRouteMap(@Param('code') code: string) {
    return this.maps.getRouteMap(code);
  }
}
