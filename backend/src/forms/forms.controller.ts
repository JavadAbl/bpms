import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { FormsService } from './forms.service';
import { CreateFormDto, UpdateFormDto } from './dto/form.dto';

@ApiTags('forms')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
@Controller('forms')
export class FormsController {
  constructor(private forms: FormsService) {}

  @Get()
  @ApiOperation({ summary: 'List forms (optionally filtered by processId)' })
  @ApiQuery({ name: 'processId', required: true, description: 'Process ID — forms are scoped to a process' })
  findAll(@Query('processId') processId: string) {
    return this.forms.findAll(processId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a form by id' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.forms.findOne(id);
  }

  @Post()
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Create a dynamic form (admin only)' })
  create(@Body() dto: CreateFormDto) {
    return this.forms.create(dto);
  }

  @Patch(':id')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Update a dynamic form (admin only)' })
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateFormDto) {
    return this.forms.update(id, dto);
  }

  @Delete(':id')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Delete a dynamic form (admin only)' })
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.forms.remove(id);
  }
}
