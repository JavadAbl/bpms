import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { DashboardService } from './dashboard.service';

@ApiTags('dashboard')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('dashboard')
export class DashboardController {
  constructor(private dashboard: DashboardService) {}

  @Get()
  @ApiOperation({
    summary: 'Aggregated KPIs for the landing dashboard',
    description:
      'ADMIN sees global numbers; USER sees own-scope numbers — tasks/instances ' +
      'as in /tasks/mine and /process-instances/mine, and only ACTIVE processes ' +
      'they are allowed to start (starter restriction honored).',
  })
  get(@Req() req: any) {
    return this.dashboard.getFor(req.user.id, req.user.role);
  }
}
