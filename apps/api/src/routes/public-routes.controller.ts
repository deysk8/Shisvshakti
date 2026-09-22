import { Controller, Get, Param } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Public } from '../common/decorators/public.decorator';
import { RoutesService } from './routes.service';

@ApiTags('routes')
@Controller('routes')
export class PublicRoutesController {
  constructor(private routesService: RoutesService) {}

  @Public()
  @Get()
  list() {
    return this.routesService.listRoutes();
  }

  @Public()
  @Get('code/:code')
  byCode(@Param('code') code: string) {
    return this.routesService.getRouteByCode(code);
  }

  @Public()
  @Get(':id')
  byId(@Param('id') id: string) {
    return this.routesService.getRouteById(id);
  }
}
