import { Body, Controller, Delete, Get, Param, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthUser } from '../auth/types/auth-user.type';
import { SavedPassengersService } from './saved-passengers.service';
import { CreateSavedPassengerDto } from './dto/create-saved-passenger.dto';

@ApiTags('saved-passengers')
@ApiBearerAuth()
@Controller('saved-passengers')
export class SavedPassengersController {
  constructor(private saved: SavedPassengersService) {}

  @Get()
  list(@CurrentUser() user: AuthUser) {
    return this.saved.list(user.id);
  }

  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateSavedPassengerDto) {
    return this.saved.create(user.id, dto);
  }

  @Delete(':id')
  remove(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.saved.remove(user.id, id);
  }
}
