import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Req,
  UseGuards,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { ProcessesService } from './processes.service';
import {
  BulkTaskAssignmentDto,
  BulkProcessVariablesDto,
  CreateProcessDto,
  UpdateProcessDto,
} from './dto/process.dto';

@ApiTags('processes')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
@Controller('processes')
export class ProcessesController {
  constructor(private processes: ProcessesService) {}

  @Get()
  @ApiOperation({ summary: 'List all process definitions' })
  findAll() {
    return this.processes.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a process definition by id (includes assignments)' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.processes.findOne(id);
  }

  @Get(':id/user-tasks')
  @ApiOperation({ summary: 'List user task definitions extracted from the BPMN XML' })
  getUserTasks(@Param('id', ParseUUIDPipe) id: string) {
    return this.processes.getUserTasks(id);
  }

  @Get(':id/assignments')
  @ApiOperation({ summary: 'List task assignments (binding task name → user/form)' })
  getAssignments(@Param('id', ParseUUIDPipe) id: string) {
    return this.processes.getAssignments(id);
  }

  @Get(':id/variables')
  @ApiOperation({ summary: 'List process-scoped variables' })
  getVariables(@Param('id', ParseUUIDPipe) id: string) {
    return this.processes.getVariables(id);
  }

  @Post()
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Create a new process definition (admin only)' })
  create(@Body() dto: CreateProcessDto, @Req() req: any) {
    return this.processes.create(dto, req.user.id);
  }

  @Put(':id/assignments')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Replace all task assignments for a process (admin only)' })
  setAssignments(@Param('id', ParseUUIDPipe) id: string, @Body() dto: BulkTaskAssignmentDto) {
    return this.processes.setAssignments(id, dto);
  }

  @Put(':id/variables')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Replace all process variables (admin only)' })
  setVariables(@Param('id', ParseUUIDPipe) id: string, @Body() dto: BulkProcessVariablesDto) {
    return this.processes.setVariables(id, dto);
  }

  @Patch(':id')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Update a process definition (admin only)' })
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateProcessDto) {
    return this.processes.update(id, dto);
  }

  @Delete(':id')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Delete a process definition (admin only)' })
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.processes.remove(id);
  }
}
