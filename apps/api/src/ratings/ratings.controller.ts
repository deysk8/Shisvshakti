import { Body, Controller, Get, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Public } from '../common/decorators/public.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthUser } from '../auth/types/auth-user.type';
import { RatingsService } from './ratings.service';
import { SubmitRatingDto } from './dto/submit-rating.dto';

@ApiTags('ratings')
@Controller('ratings')
export class RatingsController {
  constructor(private ratings: RatingsService) {}

  @Public()
  @Get('testimonials')
  testimonials() {
    return this.ratings.listPublic();
  }

  @Post()
  @ApiBearerAuth()
  submit(@CurrentUser() user: AuthUser, @Body() dto: SubmitRatingDto) {
    return this.ratings.submit(user.id, dto.bookingReference, dto.rating, dto.comment);
  }
}
