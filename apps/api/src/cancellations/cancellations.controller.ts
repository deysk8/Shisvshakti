import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Public } from '../common/decorators/public.decorator';
import { AuthUser } from '../auth/types/auth-user.type';
import { CancellationsService } from './cancellations.service';
import { CancelBookingDto } from './dto/cancel-booking.dto';

@ApiTags('cancellations')
@ApiBearerAuth()
@Controller('cancellations')
export class CancellationsController {
  constructor(private cancellations: CancellationsService) {}

  @Public()
  @Get('policies')
  listPolicies() {
    return this.cancellations.listPolicies();
  }

  @Get('preview/:reference')
  preview(@CurrentUser() user: AuthUser, @Param('reference') reference: string) {
    return this.cancellations.previewCancellation(reference, user);
  }

  @Post(':reference')
  cancel(
    @CurrentUser() user: AuthUser,
    @Param('reference') reference: string,
    @Body() dto: CancelBookingDto,
  ) {
    return this.cancellations.cancelBooking(reference, user, dto.reason);
  }
}
