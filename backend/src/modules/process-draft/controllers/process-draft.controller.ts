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
import type { AuthedRequest } from '#common/types/auth.types.js';
import type { ProcessInstanceDto } from '#modules/process-instance/dto/response/process-instance.dto.js';
import { ProcessDraftService } from '../services/process-draft.service.js';
import { ProcessDraftDto } from '../dto/response/process-draft.dto.js';
import { ProcessDraftCreateDto } from '../dto/request/process-draft-create.dto.js';
import { ProcessDraftUpdateDto } from '../dto/request/process-draft-update.dto.js';
import { ProcessDraftSubmitDto } from '../dto/request/process-draft-submit.dto.js';

@ApiTags('process-drafts')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('process-drafts')
export class ProcessDraftController {
  constructor(private readonly processDraftService: ProcessDraftService) {}

  @Get()
  @ApiOperation({ summary: 'List process drafts of the current user (ADMIN sees all)' })
  @ApiExtraModels(ProcessDraftDto)
  @ApiGetManyResponse(ProcessDraftDto)
  processDraftGetMany(
    @Query() query: GetManyQuery,
    @Req() req: AuthedRequest,
  ): Promise<GetManyReply<ProcessDraftDto>> {
    return this.processDraftService.processDraftGetMany(
      req.user,
      query as GetManyQueryType<'ProcessDraft'>,
    );
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a draft by id (owner or ADMIN)' })
  @ApiOkResponse({ description: 'Draft detail with form fields', type: ProcessDraftDto })
  processDraftGetById(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: AuthedRequest,
  ): Promise<ProcessDraftDto> {
    return this.processDraftService.processDraftGetById(id, req.user);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary:
      'Create a draft for a process (does NOT start the BPMN engine). ' +
      'Same starter ACL as POST /process-instances.',
  })
  @ApiCreatedResponse({ description: 'Draft created', type: ProcessDraftDto })
  processDraftCreate(
    @Body() dto: ProcessDraftCreateDto,
    @Req() req: AuthedRequest,
  ): Promise<ProcessDraftDto> {
    return this.processDraftService.processDraftCreate(dto, req.user);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Save form field values on a draft' })
  @ApiOkResponse({ description: 'Draft updated', type: ProcessDraftDto })
  processDraftUpdate(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ProcessDraftUpdateDto,
    @Req() req: AuthedRequest,
  ): Promise<ProcessDraftDto> {
    return this.processDraftService.processDraftUpdate(id, dto, req.user);
  }

  @Post(':id/submit')
  @ApiOperation({
    summary:
      'Start the process instance from this draft, complete the first user task ' +
      'with the form data, and delete the draft',
  })
  @ApiOkResponse({ description: 'Started process instance' })
  processDraftSubmit(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ProcessDraftSubmitDto,
    @Req() req: AuthedRequest,
  ): Promise<ProcessInstanceDto> {
    return this.processDraftService.processDraftSubmit(id, dto, req.user);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Discard a draft (owner or ADMIN)' })
  @ApiNoContentResponse({ description: 'Draft deleted' })
  processDraftDelete(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: AuthedRequest,
  ): Promise<void> {
    return this.processDraftService.processDraftDelete(id, req.user);
  }
}
