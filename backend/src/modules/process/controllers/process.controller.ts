import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
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
import { ProcessService } from '../services/process.service.js';
import {
  ProcessAssignmentBulkDto,
  ProcessAssignmentDto,
} from '../dto/request/process-assignment-bulk.dto.js';
import { ProcessVariableBulkDto } from '../dto/request/process-variable-bulk.dto.js';
import { ProcessCreateDto } from '../dto/request/process-create.dto.js';
import { ProcessRestoreVersionDto } from '../dto/request/process-restore-version.dto.js';
import { ProcessSetStartersDto } from '../dto/request/process-set-starters.dto.js';
import { ProcessUpdateDto } from '../dto/request/process-update.dto.js';
import {
  ProcessDto,
  ProcessStarterDto,
  ProcessVersionDto,
  ProcessVersionXmlDto,
  ProcessVariableReplyDto,
} from '../dto/response/process.dto.js';

@ApiTags('processes')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('processes')
export class ProcessController {
  constructor(private readonly processService: ProcessService) {}

  @Get()
  @ApiOperation({ summary: 'Retrieve a paginated list of process definitions' })
  @ApiExtraModels(ProcessDto)
  @ApiGetManyResponse(ProcessDto)
  processGetMany(@Query() query: GetManyQuery): Promise<GetManyReply<ProcessDto>> {
    return this.processService.processGetMany(query as GetManyQueryType<'Process'>);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a process definition by id (includes assignments)' })
  @ApiOkResponse({ description: 'Successfully retrieved process', type: ProcessDto })
  processGetById(@Param('id', ParseUUIDPipe) id: string): Promise<ProcessDto> {
    return this.processService.processGetById(id);
  }

  @Get(':id/user-tasks')
  @ApiOperation({ summary: 'List user task definitions extracted from the BPMN XML' })
  processGetUserTasks(@Param('id', ParseUUIDPipe) id: string) {
    return this.processService.processGetUserTasks(id);
  }

  @Get(':id/assignments')
  @ApiOperation({ summary: 'List task assignments (binding task name → user/form)' })
  @ApiOkResponse({ description: 'Task assignments', type: [ProcessAssignmentDto] })
  processGetAssignments(@Param('id', ParseUUIDPipe) id: string): Promise<ProcessAssignmentDto[]> {
    return this.processService.processGetAssignments(id);
  }

  @Get(':id/starters')
  @ApiOperation({
    summary: 'List the users allowed to start this process (empty = every user may start)',
  })
  @ApiOkResponse({ description: 'Process starters', type: [ProcessStarterDto] })
  processGetStarters(@Param('id', ParseUUIDPipe) id: string): Promise<ProcessStarterDto[]> {
    return this.processService.processGetStarters(id);
  }

  @Get(':id/variables')
  @ApiOperation({ summary: 'List process-scoped variables' })
  @ApiOkResponse({ description: 'Process variables', type: [ProcessVariableReplyDto] })
  processGetVariables(@Param('id', ParseUUIDPipe) id: string): Promise<ProcessVariableReplyDto[]> {
    return this.processService.processGetVariables(id);
  }

  @Get(':id/versions')
  @ApiOperation({ summary: 'List immutable version history (metadata, newest first)' })
  @ApiOkResponse({ description: 'Version history', type: [ProcessVersionDto] })
  processGetVersions(@Param('id', ParseUUIDPipe) id: string): Promise<ProcessVersionDto[]> {
    return this.processService.processGetVersions(id);
  }

  @Get(':id/versions/:version')
  @ApiOperation({ summary: 'Get the full BPMN XML of a specific version' })
  @ApiOkResponse({ description: 'Version XML', type: ProcessVersionXmlDto })
  processGetVersionXml(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('version', ParseIntPipe) version: number,
  ): Promise<ProcessVersionXmlDto> {
    return this.processService.processGetVersionXml(id, version);
  }

  @Post(':id/versions/:version/restore')
  @Roles('ADMIN')
  @ApiOperation({
    summary:
      'Restore an old version — appends a NEW current version (never rewrites history; admin only)',
  })
  processRestoreVersion(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('version', ParseIntPipe) version: number,
    @Body() dto: ProcessRestoreVersionDto,
    @Req() req: AuthedRequest,
  ) {
    return this.processService.processRestoreVersion(id, version, req.user.id, dto.note);
  }

  @Post()
  @Roles('ADMIN')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new process definition (admin only)' })
  @ApiCreatedResponse({ description: 'Process successfully created', type: ProcessDto })
  processCreate(@Body() dto: ProcessCreateDto, @Req() req: AuthedRequest): Promise<ProcessDto> {
    return this.processService.processCreate(dto, req.user.id);
  }

  @Put(':id/assignments')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Replace all task assignments for a process (admin only)' })
  @ApiOkResponse({ description: 'Replaced assignments', type: [ProcessAssignmentDto] })
  processSetAssignments(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ProcessAssignmentBulkDto,
  ): Promise<ProcessAssignmentDto[]> {
    return this.processService.processSetAssignments(id, dto);
  }

  @Put(':id/starters')
  @Roles('ADMIN')
  @ApiOperation({
    summary:
      'Replace the starter set (the START event assignment). Empty array = every user may start (admin only)',
  })
  @ApiOkResponse({ description: 'Replaced starters', type: [ProcessStarterDto] })
  processSetStarters(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ProcessSetStartersDto,
  ): Promise<ProcessStarterDto[]> {
    return this.processService.processSetStarters(id, dto);
  }

  @Put(':id/variables')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Replace all process variables (admin only)' })
  @ApiOkResponse({ description: 'Replaced variables', type: [ProcessVariableReplyDto] })
  processSetVariables(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ProcessVariableBulkDto,
  ): Promise<ProcessVariableReplyDto[]> {
    return this.processService.processSetVariables(id, dto);
  }

  @Patch(':id')
  @Roles('ADMIN')
  @ApiOperation({
    summary:
      'Update a process definition (admin only). A new version row is appended only when bpmnXml actually changes.',
  })
  @ApiOkResponse({ description: 'Process successfully updated', type: ProcessDto })
  processUpdate(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ProcessUpdateDto,
    @Req() req: AuthedRequest,
  ): Promise<ProcessDto> {
    return this.processService.processUpdate(id, dto, req.user.id);
  }

  @Delete(':id')
  @Roles('ADMIN')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a process definition (admin only)' })
  @ApiNoContentResponse({ description: 'Process successfully deleted' })
  processDelete(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.processService.processDelete(id);
  }
}
