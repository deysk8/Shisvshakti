import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthUser } from '../auth/types/auth-user.type';
import { LoyaltyService } from './loyalty.service';

@ApiTags('loyalty')
@ApiBearerAuth()
@Controller('loyalty')
export class LoyaltyController {
  constructor(private loyalty: LoyaltyService) {}

  @Get('balance')
  balance(@CurrentUser() user: AuthUser) {
    return this.loyalty.getBalance(user.id);
  }

  @Get('history')
  history(@CurrentUser() user: AuthUser) {
    return this.loyalty.getHistory(user.id);
  }
}
