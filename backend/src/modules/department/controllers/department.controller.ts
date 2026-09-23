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
import { DepartmentService } from '../services/department.service.js';
import { DepartmentDto } from '../dto/response/department.dto.js';
import { DepartmentCreateDto } from '../dto/request/department-create.dto.js';
import { DepartmentUpdateDto } from '../dto/request/department-update.dto.js';

@ApiTags('departments')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('departments')
export class DepartmentController {
  constructor(private readonly departmentService: DepartmentService) {}

  @Get()
  @ApiOperation({ summary: 'Retrieve a paginated list of departments with their positions' })
  @ApiExtraModels(DepartmentDto)
  @ApiGetManyResponse(DepartmentDto)
  departmentGetMany(
    @Query() query: GetManyQuery,
  ): Promise<GetManyReply<DepartmentDto>> {
    return this.departmentService.departmentGetMany(query as GetManyQueryType<'Department'>);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a department by id (includes positions + holders)' })
  @ApiOkResponse({ description: 'Successfully retrieved department', type: DepartmentDto })
  departmentGetById(@Param('id', ParseUUIDPipe) id: string): Promise<DepartmentDto> {
    return this.departmentService.departmentGetById(id);
  }

  @Post()
  @Roles('ADMIN')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a department (admin only)' })
  @ApiCreatedResponse({ description: 'Department successfully created', type: String })
  departmentCreate(@Body() payload: DepartmentCreateDto): Promise<string> {
    return this.departmentService.departmentCreate(payload);
  }

  @Patch(':id')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Update a department (admin only)' })
  @ApiOkResponse({ description: 'Department successfully updated' })
  departmentUpdate(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() payload: DepartmentUpdateDto,
  ): Promise<void> {
    return this.departmentService.departmentUpdate(id, payload);
  }

  @Delete(':id')
  @Roles('ADMIN')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a department (admin only) — cascades to positions' })
  @ApiNoContentResponse({ description: 'Department successfully deleted' })
  departmentDelete(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.departmentService.departmentDelete(id);
  }
}
