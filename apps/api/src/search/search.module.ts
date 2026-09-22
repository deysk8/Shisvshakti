import { Module } from '@nestjs/common';

import { SearchController } from './search.controller';

import { SearchService } from './search.service';

import { PricingModule } from '../pricing/pricing.module';



@Module({

  imports: [PricingModule],

  controllers: [SearchController],

  providers: [SearchService],

  exports: [SearchService],

})

export class SearchModule {}


