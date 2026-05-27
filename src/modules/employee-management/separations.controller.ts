import { Body, Controller, Param, Patch, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { CurrentUser } from '../../core/decorators/current-user.decorator';
import { Roles } from '../../core/decorators/roles.decorator';
import { JwtAuthGuard } from '../../core/guards/jwt-auth.guard';
import { RolesGuard } from '../../core/guards/roles.guard';
import type { AuthenticatedUser } from '../../core/types/authenticated-user';
import { UpdateSeparationDto } from './dto/update-separation.dto';
import { SeparationService } from './separation.service';

@ApiTags('Separations')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller({ path: 'separations', version: '1' })
export class SeparationsController {
  constructor(private separations: SeparationService) {}

  @Patch(':id')
  @Roles(UserRole.HR_MANAGER)
  update(
    @Param('id') id: string,
    @Body() dto: UpdateSeparationDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.separations.update(id, dto, user.companyId, user.id);
  }
}
