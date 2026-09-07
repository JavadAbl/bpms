import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { PositionsService } from './positions.service';
import { CreatePositionDto, UpdatePositionDto, AssignUsersDto } from './dto/position.dto';

@ApiTags('positions')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
@Controller('positions')
export class PositionsController {
  constructor(private positions: PositionsService) {}

  @Get()
  @ApiOperation({ summary: 'List all positions across all departments' })
  findAll() {
    return this.positions.findAll();
  }

  @Get('by-department/:departmentId')
  @ApiOperation({ summary: 'List positions in a specific department' })
  findByDepartment(@Param('departmentId', ParseUUIDPipe) departmentId: string) {
    return this.positions.findByDepartment(departmentId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a position by id (includes department + holders)' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.positions.findOne(id);
  }

  @Post('by-department/:departmentId')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Create a position within a department (admin only)' })
  create(
    @Param('departmentId', ParseUUIDPipe) departmentId: string,
    @Body() dto: CreatePositionDto,
  ) {
    return this.positions.create(departmentId, dto);
  }

  @Patch(':id')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Update a position (admin only)' })
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdatePositionDto) {
    return this.positions.update(id, dto);
  }

  @Delete(':id')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Delete a position (admin only)' })
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.positions.remove(id);
  }

  @Post(':id/users')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Assign users to a position (admin only)' })
  assignUsers(@Param('id', ParseUUIDPipe) id: string, @Body() dto: AssignUsersDto) {
    return this.positions.assignUsers(id, dto);
  }

  @Delete(':id/users/:userId')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Remove a user from a position (admin only)' })
  removeUser(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('userId', ParseUUIDPipe) userId: string,
  ) {
    return this.positions.removeUser(id, userId);
  }
}
