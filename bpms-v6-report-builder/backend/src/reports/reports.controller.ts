import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Req,
  UseGuards,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { ReportsService } from './reports.service';
import {
  CreateReportDto,
  PreviewReportDto,
  UpdateReportDto,
} from './dto/report.dto';

/**
 * Report builder — admin-defined tabular reports over the instances of ONE
 * process. A report is pure declarative configuration (columns + filters),
 * executed live on demand; nothing is materialized.
 *
 * Reads (list/detail/field-catalog/execute) are available to every
 * authenticated user — same visibility as the global instance report.
 * Writes (create/update/delete) and preview are ADMIN-only.
 */
@ApiTags('reports')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
@Controller('reports')
export class ReportsController {
  constructor(private reports: ReportsService) {}

  @Get()
  @ApiOperation({ summary: 'List all saved report definitions' })
  findAll() {
    return this.reports.findAll();
  }

  @Get('field-catalog/:processId')
  @ApiOperation({
    summary:
      'Selectable fields for a process: fixed instance fields + process variables ' +
      '(declared ∪ form-derived, with select options in Persian labels)',
  })
  getFieldCatalog(@Param('processId', ParseUUIDPipe) processId: string) {
    return this.reports.getFieldCatalog(processId);
  }

  @Post('preview')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Execute an UNSAVED report config (the builder preview) — admin only' })
  preview(@Body() dto: PreviewReportDto) {
    return this.reports.preview(dto);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get one saved report definition (columns/filters parsed)' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.reports.findOne(id);
  }

  @Post(':id/execute')
  @ApiOperation({ summary: 'Execute a saved report — live rows over the process instances' })
  execute(@Param('id', ParseUUIDPipe) id: string) {
    return this.reports.execute(id);
  }

  @Post()
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Create a report definition (admin only)' })
  create(@Body() dto: CreateReportDto, @Req() req: any) {
    return this.reports.create(dto, req.user.id);
  }

  @Patch(':id')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Update a report definition (admin only)' })
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateReportDto) {
    return this.reports.update(id, dto);
  }

  @Delete(':id')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Delete a report definition (admin only)' })
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.reports.remove(id);
  }
}
