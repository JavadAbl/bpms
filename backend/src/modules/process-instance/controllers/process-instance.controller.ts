import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiExtraModels,
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
import { ProcessInstanceService } from '../services/process-instance.service.js';
import { ProcessInstanceDto } from '../dto/response/process-instance.dto.js';
import { ProcessInstanceStartDto } from '../dto/request/process-instance-start.dto.js';

@ApiTags('process-instances')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('process-instances')
export class ProcessInstanceController {
  constructor(private readonly processInstanceService: ProcessInstanceService) {}

  @Get()
  @Roles('ADMIN')
  @ApiOperation({ summary: '[ADMIN] Report of all started process instances (with tasks + startedBy)' })
  @ApiExtraModels(ProcessInstanceDto)
  @ApiGetManyResponse(ProcessInstanceDto)
  processInstanceGetMany(
    @Query() query: GetManyQuery,
  ): Promise<GetManyReply<ProcessInstanceDto>> {
    return this.processInstanceService.processInstanceGetMany(
      query as GetManyQueryType<'ProcessInstance'>,
    );
  }

  @Get('cases')
  @ApiOperation({
    summary:
      'The case list (موارد): every process instance the current user participates in — ' +
      'started by them, assigned/claimed to them, or holding an UNCLAIMED position-pool task. ' +
      'After another holder claims a self-service task, peers no longer see that case. ADMIN sees ALL cases.',
  })
  @ApiExtraModels(ProcessInstanceDto)
  @ApiGetManyResponse(ProcessInstanceDto)
  caseGetMany(@Query() query: GetManyQuery, @Req() req: AuthedRequest): Promise<GetManyReply<ProcessInstanceDto>> {
    return this.processInstanceService.caseGetMany(req.user, query as GetManyQueryType<'ProcessInstance'>);
  }

  @Get('mine')
  @ApiOperation({
    summary: 'List instances visible to the current user (started by me or has a task for me)',
  })
  @ApiExtraModels(ProcessInstanceDto)
  @ApiGetManyResponse(ProcessInstanceDto)
  processInstanceGetMine(
    @Query() query: GetManyQuery,
    @Req() req: AuthedRequest,
  ): Promise<GetManyReply<ProcessInstanceDto>> {
    return this.processInstanceService.processInstanceGetMine(
      req.user.id,
      query as GetManyQueryType<'ProcessInstance'>,
    );
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Get an instance by id — only if the caller participates in it (or ADMIN)',
  })
  @ApiOkResponse({ description: 'Successfully retrieved instance', type: ProcessInstanceDto })
  processInstanceGetById(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: AuthedRequest,
  ): Promise<ProcessInstanceDto> {
    return this.processInstanceService.processInstanceGetById(id, req.user);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary:
      'Start a new process instance. If the process has a starter restriction ' +
      '(START event assignment), only its members (and admins) may start — 403 otherwise.',
  })
  @ApiCreatedResponse({ description: 'Started instance', type: ProcessInstanceDto })
  processInstanceStart(
    @Body() dto: ProcessInstanceStartDto,
    @Req() req: AuthedRequest,
  ): Promise<ProcessInstanceDto> {
    return this.processInstanceService.processInstanceStart(dto, req.user);
  }

  @Post(':id/terminate')
  @ApiOperation({ summary: 'Terminate a running instance — only its starter or an ADMIN' })
  @ApiOkResponse({ description: 'Terminated instance', type: ProcessInstanceDto })
  processInstanceTerminate(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: AuthedRequest,
  ): Promise<ProcessInstanceDto> {
    return this.processInstanceService.processInstanceTerminate(id, req.user);
  }
}
