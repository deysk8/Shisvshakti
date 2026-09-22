import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { AuthUser } from '../auth/types/auth-user.type';
import { AgentService } from './agent.service';

@ApiTags('agent')
@ApiBearerAuth()
@Roles(UserRole.AGENT)
@Controller('agent')
export class AgentController {
  constructor(private agentService: AgentService) {}

  @Get('me')
  profile(@CurrentUser() user: AuthUser) {
    return this.agentService.getProfile(user);
  }

  @Get('dashboard')
  dashboard(@CurrentUser() user: AuthUser) {
    return this.agentService.getDashboard(user);
  }

  @Get('bookings')
  bookings(@CurrentUser() user: AuthUser) {
    return this.agentService.listBookings(user);
  }

  @Get('commissions')
  commissions(@CurrentUser() user: AuthUser) {
    return this.agentService.listCommissions(user);
  }
}
