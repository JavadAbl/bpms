import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '#common/guards/jwt-auth.guard.js';
import { RolesGuard } from '#common/guards/roles.guard.js';
import type { AuthedRequest } from '#common/types/auth.types.js';
import { DashboardService } from '../services/dashboard.service.js';
import { DashboardReplyDto } from '../dto/response/dashboard.dto.js';

@ApiTags('dashboard')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get()
  @ApiOperation({
    summary: 'Aggregated KPIs for the landing dashboard',
    description:
      'ADMIN sees global numbers; USER sees own-scope numbers — tasks/instances ' +
      'as in /tasks/mine and /process-instances/mine, and only ACTIVE processes ' +
      'they are allowed to start (starter restriction honored).',
  })
  @ApiOkResponse({ description: 'Aggregated dashboard data', type: DashboardReplyDto })
  dashboardGet(@Req() req: AuthedRequest): Promise<DashboardReplyDto> {
    return this.dashboardService.dashboardGet(req.user.id, req.user.role);
  }
}
