import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Public } from '../common/decorators/public.decorator';
import { SearchTripsDto } from './dto/search-trips.dto';
import { SearchService } from './search.service';

@ApiTags('search')
@Controller('search')
export class SearchController {
  constructor(private searchService: SearchService) {}

  @Public()
  @Get('trips')
  searchTrips(@Query() query: SearchTripsDto) {
    return this.searchService.searchTrips(query);
  }
}
