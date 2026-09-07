import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
  UseGuards,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { TasksService } from './tasks.service';
import { CompleteTaskDto } from './dto/task.dto';

@ApiTags('tasks')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
@Controller('tasks')
export class TasksController {
  constructor(private tasks: TasksService) {}

  @Get()
  @Roles('ADMIN')
  @ApiOperation({ summary: '[ADMIN] List all waiting (PENDING) tasks across all instances' })
  findAll() {
    return this.tasks.findAll();
  }

  @Get('mine')
  @ApiOperation({
    summary:
      'List the RECEIVED (PENDING) tasks of the current user — completed/passed tasks leave the کارتابل',
  })
  findMine(@Req() req: any) {
    return this.tasks.findMine(req.user.id);
  }

  @Get('participated')
  @ApiOperation({
    summary:
      'List the tasks the current user has PARTICIPATED in (سوابق کارتابل): ' +
      'once-received tasks that have since passed — COMPLETED by the user or ' +
      'CANCELLED when the instance ended. Counterpart of /tasks/mine.',
  })
  findParticipated(@Req() req: any) {
    return this.tasks.findParticipated(req.user.id);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Get a task by id — only if visible in the caller\'s کارتابل (or ADMIN)',
  })
  findOne(@Param('id', ParseUUIDPipe) id: string, @Req() req: any) {
    return this.tasks.findOne(id, req.user);
  }

  @Post(':id/complete')
  @ApiOperation({ summary: 'Complete a task by submitting form data and advancing the flow' })
  complete(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CompleteTaskDto,
    @Req() req: any,
  ) {
    return this.tasks.complete(id, dto, req.user.id, req.user.role);
  }

  @Post(':id/claim')
  @ApiOperation({
    summary: 'Claim a position-based task for the current user (self-service)',
    description:
      'After claiming, the task disappears from other holders\' queues. ' +
      'Required before completing self-service tasks. Only works on position-based tasks.',
  })
  claim(@Param('id', ParseUUIDPipe) id: string, @Req() req: any) {
    return this.tasks.claim(id, req.user.id);
  }

  @Post(':id/release')
  @ApiOperation({
    summary: 'Release a claimed task back to the position pool',
    description:
      'After release, all position holders can see the task again. ' +
      'Only the user who claimed it can release it.',
  })
  release(@Param('id', ParseUUIDPipe) id: string, @Req() req: any) {
    return this.tasks.release(id, req.user.id);
  }
}
