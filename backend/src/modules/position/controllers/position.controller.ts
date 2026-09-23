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
import { PositionService } from '../services/position.service.js';
import { PositionDto } from '../dto/response/position.dto.js';
import { PositionCreateDto } from '../dto/request/position-create.dto.js';
import { PositionUpdateDto } from '../dto/request/position-update.dto.js';
import { PositionAssignUsersDto } from '../dto/request/position-assign-users.dto.js';

@ApiTags('positions')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('positions')
export class PositionController {
  constructor(private readonly positionService: PositionService) {}

  @Get()
  @ApiOperation({ summary: 'Retrieve a paginated list of positions across all departments' })
  @ApiExtraModels(PositionDto)
  @ApiGetManyResponse(PositionDto)
  positionGetMany(@Query() query: GetManyQuery): Promise<GetManyReply<PositionDto>> {
    return this.positionService.positionGetMany(query as GetManyQueryType<'Position'>);
  }

  @Get('by-department/:departmentId')
  @ApiOperation({ summary: 'List positions in a specific department' })
  @ApiOkResponse({ description: 'Positions of the department', type: [PositionDto] })
  positionGetByDepartment(
    @Param('departmentId', ParseUUIDPipe) departmentId: string,
  ): Promise<PositionDto[]> {
    return this.positionService.positionGetByDepartment(departmentId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a position by id (includes department + holders)' })
  @ApiOkResponse({ description: 'Successfully retrieved position', type: PositionDto })
  positionGetById(@Param('id', ParseUUIDPipe) id: string): Promise<PositionDto> {
    return this.positionService.positionGetById(id);
  }

  @Post('by-department/:departmentId')
  @Roles('ADMIN')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a position within a department (admin only)' })
  @ApiCreatedResponse({ description: 'Position successfully created', type: String })
  positionCreate(
    @Param('departmentId', ParseUUIDPipe) departmentId: string,
    @Body() payload: PositionCreateDto,
  ): Promise<string> {
    return this.positionService.positionCreate(departmentId, payload);
  }

  @Patch(':id')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Update a position (admin only)' })
  @ApiOkResponse({ description: 'Position successfully updated' })
  positionUpdate(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() payload: PositionUpdateDto,
  ): Promise<void> {
    return this.positionService.positionUpdate(id, payload);
  }

  @Delete(':id')
  @Roles('ADMIN')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a position (admin only)' })
  @ApiNoContentResponse({ description: 'Position successfully deleted' })
  positionDelete(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.positionService.positionDelete(id);
  }

  @Post(':id/users')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Assign users to a position (admin only)' })
  @ApiOkResponse({ description: 'Updated position with all holders', type: PositionDto })
  positionAssignUsers(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() payload: PositionAssignUsersDto,
  ): Promise<PositionDto> {
    return this.positionService.positionAssignUsers(id, payload);
  }

  @Delete(':id/users/:userId')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Remove a user from a position (admin only)' })
  @ApiOkResponse({ description: 'Updated position with all holders', type: PositionDto })
  positionRemoveUser(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('userId', ParseUUIDPipe) userId: string,
  ): Promise<PositionDto> {
    return this.positionService.positionRemoveUser(id, userId);
  }
}
