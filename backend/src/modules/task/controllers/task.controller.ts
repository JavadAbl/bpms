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
import { TaskService } from '../services/task.service.js';
import { TaskDto } from '../dto/response/task.dto.js';
import { TaskCompleteDto } from '../dto/request/task-complete.dto.js';

@ApiTags('tasks')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('tasks')
export class TaskController {
  constructor(private readonly taskService: TaskService) {}

  @Get()
  @Roles('ADMIN')
  @ApiOperation({ summary: '[ADMIN] List all waiting (PENDING) tasks across all instances' })
  @ApiExtraModels(TaskDto)
  @ApiGetManyResponse(TaskDto)
  taskGetMany(@Query() query: GetManyQuery): Promise<GetManyReply<TaskDto>> {
    return this.taskService.taskGetMany(query as GetManyQueryType<'Task'>);
  }

  @Get('mine')
  @ApiOperation({
    summary:
      'List the RECEIVED (PENDING) tasks of the current user — completed/passed tasks leave the کارتابل',
  })
  @ApiExtraModels(TaskDto)
  @ApiGetManyResponse(TaskDto)
  taskGetMine(@Query() query: GetManyQuery, @Req() req: AuthedRequest): Promise<GetManyReply<TaskDto>> {
    return this.taskService.taskGetMine(req.user.id, query as GetManyQueryType<'Task'>);
  }

  @Get('participated')
  @ApiOperation({
    summary:
      'List the tasks the current user has PARTICIPATED in (سوابق کارتابل): ' +
      'once-received tasks that left the flow without being completed by the user — ' +
      'CANCELLED when the instance ended/terminated. Completed tasks are visible ' +
      'via the case list (/process-instances/cases).',
  })
  @ApiExtraModels(TaskDto)
  @ApiGetManyResponse(TaskDto)
  taskGetParticipated(
    @Query() query: GetManyQuery,
    @Req() req: AuthedRequest,
  ): Promise<GetManyReply<TaskDto>> {
    return this.taskService.taskGetParticipated(req.user.id, query as GetManyQueryType<'Task'>);
  }

  @Get(':id')
  @ApiOperation({
    summary: "Get a task by id — only if visible in the caller's کارتابل (or ADMIN)",
  })
  @ApiOkResponse({ description: 'Successfully retrieved task', type: TaskDto })
  taskGetById(@Param('id', ParseUUIDPipe) id: string, @Req() req: AuthedRequest): Promise<TaskDto> {
    return this.taskService.taskGetById(id, req.user);
  }

  @Post(':id/complete')
  @ApiOperation({ summary: 'Complete a task by submitting form data and advancing the flow' })
  @ApiOkResponse({ description: 'Completed task with updated state', type: TaskDto })
  taskComplete(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: TaskCompleteDto,
    @Req() req: AuthedRequest,
  ): Promise<TaskDto> {
    return this.taskService.taskComplete(id, dto, req.user.id, req.user.role);
  }

  @Post(':id/claim')
  @ApiOperation({
    summary: 'Claim a position-based task for the current user (self-service)',
    description:
      "After claiming, the task disappears from other holders' queues. " +
      'Required before completing self-service tasks. Only works on position-based tasks.',
  })
  @ApiOkResponse({ description: 'Claimed task', type: TaskDto })
  taskClaim(@Param('id', ParseUUIDPipe) id: string, @Req() req: AuthedRequest): Promise<TaskDto> {
    return this.taskService.taskClaim(id, req.user.id);
  }

  @Post(':id/release')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Release a claimed task back to the position pool',
    description:
      'After release, all position holders can see the task again. ' +
      'Only the user who claimed it can release it.',
  })
  @ApiOkResponse({ description: 'Released task', type: TaskDto })
  taskRelease(@Param('id', ParseUUIDPipe) id: string, @Req() req: AuthedRequest): Promise<TaskDto> {
    return this.taskService.taskRelease(id, req.user.id);
  }
}
