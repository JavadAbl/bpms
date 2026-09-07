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
import { ProcessInstancesService } from './process-instances.service';
import { StartInstanceDto } from './dto/instance.dto';

@ApiTags('process-instances')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
@Controller('process-instances')
export class ProcessInstancesController {
  constructor(private instances: ProcessInstancesService) {}

  @Get()
  @Roles('ADMIN')
  @ApiOperation({ summary: '[ADMIN] Report of all started process instances (with tasks + startedBy)' })
  findAll() {
    return this.instances.findAll();
  }

  @Get('mine')
  @ApiOperation({ summary: 'List instances visible to the current user (started by me or has a task for me)' })
  findMine(@Req() req: any) {
    return this.instances.findByUser(req.user.id);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Get an instance by id — only if the caller participates in it (or ADMIN)',
  })
  findOne(@Param('id', ParseUUIDPipe) id: string, @Req() req: any) {
    return this.instances.findOne(id, req.user);
  }

  @Post()
  @ApiOperation({
    summary:
      'Start a new process instance. If the process has a starter restriction ' +
      '(START event assignment), only its members (and admins) may start — 403 otherwise.',
  })
  start(@Body() dto: StartInstanceDto, @Req() req: any) {
    return this.instances.start(dto, req.user);
  }

  @Post(':id/terminate')
  @ApiOperation({
    summary: 'Terminate a running instance — only its starter or an ADMIN',
  })
  terminate(@Param('id', ParseUUIDPipe) id: string, @Req() req: any) {
    return this.instances.terminate(id, req.user);
  }
}
