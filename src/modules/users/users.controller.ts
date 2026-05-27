import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { CurrentUser } from '../../core/decorators/current-user.decorator';
import { Roles } from '../../core/decorators/roles.decorator';
import { JwtAuthGuard } from '../../core/guards/jwt-auth.guard';
import { RolesGuard } from '../../core/guards/roles.guard';
import type { AuthenticatedUser } from '../../core/types/authenticated-user';
import { CreateUserDto } from './dto/create-user.dto';
import { UsersService } from './users.service';

@ApiTags('Users')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller({ path: 'users', version: '1' })
export class UsersController {
  constructor(private usersService: UsersService) {}

  @Post()
  @Roles(UserRole.HR_MANAGER)
  create(@Body() dto: CreateUserDto, @CurrentUser() user: AuthenticatedUser) {
    return this.usersService.create(dto, user.companyId, user.id);
  }

  @Get()
  @Roles(UserRole.MANAGER)
  findAll(
    @CurrentUser() user: AuthenticatedUser,
    @Query('page') page = 1,
    @Query('limit') limit = 20,
  ) {
    return this.usersService.findAll(
      user.companyId,
      Number(page),
      Number(limit),
    );
  }

  @Get(':id')
  @Roles(UserRole.MANAGER)
  findOne(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.usersService.findOne(id, user.companyId);
  }
}
