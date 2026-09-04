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
  @ApiOperation({ summary: 'List all process instances (with tasks + startedBy)' })
  findAll() {
    return this.instances.findAll();
  }

  @Get('mine')
  @ApiOperation({ summary: 'List instances visible to the current user (started by me or has a task for me)' })
  findMine(@Req() req: any) {
    return this.instances.findByUser(req.user.id);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a process instance by id with its tasks' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.instances.findOne(id);
  }

  @Post()
  @ApiOperation({ summary: 'Start a new process instance from a process definition' })
  start(@Body() dto: StartInstanceDto, @Req() req: any) {
    return this.instances.start(dto, req.user.id);
  }

  @Post(':id/terminate')
  @ApiOperation({ summary: 'Terminate a running process instance' })
  terminate(@Param('id', ParseUUIDPipe) id: string) {
    return this.instances.terminate(id);
  }
}
