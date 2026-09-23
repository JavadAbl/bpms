import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiExtraModels,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { GetManyQuery, GetManyQueryType } from '#common/dto/request/get-many-query.js';
import { ApiGetManyResponse, GetManyReply } from '#common/dto/response/get-many-reply.js';
import { JwtAuthGuard } from '#common/guards/jwt-auth.guard.js';
import { RolesGuard } from '#common/guards/roles.guard.js';
import { Roles } from '#common/decorators/roles.decorator.js';
import type { AuthedRequest } from '#common/types/auth.types.js';
import { ReportService } from '../services/report.service.js';
import { ReportDto } from '../dto/response/report.dto.js';
import { ReportCreateDto } from '../dto/request/report-create.dto.js';
import { ReportUpdateDto } from '../dto/request/report-update.dto.js';
import { ReportPreviewDto } from '../dto/request/report-preview.dto.js';

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
@Controller('reports')
export class ReportController {
  constructor(private readonly reportService: ReportService) {}

  @Get()
  @ApiOperation({ summary: 'List all saved report definitions' })
  @ApiExtraModels(ReportDto)
  @ApiGetManyResponse(ReportDto)
  reportGetMany(@Query() query: GetManyQuery): Promise<GetManyReply<ReportDto>> {
    return this.reportService.reportGetMany(query as GetManyQueryType<'ReportDefinition'>);
  }

  @Get('field-catalog/:processId')
  @ApiOperation({
    summary:
      'Selectable fields for a process: fixed instance fields + process variables ' +
      '(declared ∪ form-derived, with select options in Persian labels)',
  })
  reportGetFieldCatalog(@Param('processId', ParseUUIDPipe) processId: string) {
    return this.reportService.reportGetFieldCatalog(processId);
  }

  @Post('preview')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Execute an UNSAVED report config (the builder preview) — admin only' })
  reportPreview(@Body() dto: ReportPreviewDto) {
    return this.reportService.reportPreview(dto);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get one saved report definition (columns/filters parsed)' })
  @ApiOkResponse({ description: 'Successfully retrieved report', type: ReportDto })
  reportGetById(@Param('id', ParseUUIDPipe) id: string): Promise<ReportDto> {
    return this.reportService.reportGetById(id);
  }

  @Post(':id/execute')
  @ApiOperation({ summary: 'Execute a saved report — live rows over the process instances' })
  reportExecute(@Param('id', ParseUUIDPipe) id: string) {
    return this.reportService.reportExecute(id);
  }

  @Post()
  @Roles('ADMIN')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a report definition (admin only)' })
  @ApiCreatedResponse({ description: 'Report successfully created', type: ReportDto })
  reportCreate(@Body() dto: ReportCreateDto, @Req() req: AuthedRequest): Promise<ReportDto> {
    return this.reportService.reportCreate(dto, req.user.id);
  }

  @Patch(':id')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Update a report definition (admin only)' })
  @ApiOkResponse({ description: 'Report successfully updated', type: ReportDto })
  reportUpdate(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReportUpdateDto,
  ): Promise<ReportDto> {
    return this.reportService.reportUpdate(id, dto);
  }

  @Delete(':id')
  @Roles('ADMIN')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a report definition (admin only)' })
  @ApiNoContentResponse({ description: 'Report successfully deleted' })
  reportDelete(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.reportService.reportDelete(id);
  }
}
