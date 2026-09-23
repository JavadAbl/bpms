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
import { CategoryService } from '../services/category.service.js';
import { CategoryDto } from '../dto/response/category.dto.js';
import { CategoryCreateDto } from '../dto/request/category-create.dto.js';
import { CategoryUpdateDto } from '../dto/request/category-update.dto.js';

@ApiTags('categories')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('categories')
export class CategoryController {
  constructor(private readonly categoryService: CategoryService) {}

  @Get()
  @ApiOperation({ summary: 'List all categories with items + form usage (any authenticated user)' })
  @ApiExtraModels(CategoryDto)
  @ApiGetManyResponse(CategoryDto)
  categoryGetMany(@Query() query: GetManyQuery): Promise<GetManyReply<CategoryDto>> {
    return this.categoryService.categoryGetMany(query as GetManyQueryType<'Category'>);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get one category with its items' })
  @ApiOkResponse({ description: 'Successfully retrieved category', type: CategoryDto })
  categoryGetById(@Param('id', ParseUUIDPipe) id: string): Promise<CategoryDto> {
    return this.categoryService.categoryGetById(id);
  }

  @Post()
  @Roles('ADMIN')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a category with items (admin only)' })
  @ApiCreatedResponse({ description: 'Category successfully created', type: String })
  categoryCreate(@Body() payload: CategoryCreateDto): Promise<string> {
    return this.categoryService.categoryCreate(payload);
  }

  @Patch(':id')
  @Roles('ADMIN')
  @ApiOperation({
    summary: 'Update a category — items array replaces the whole list (admin only)',
  })
  @ApiOkResponse({ description: 'Category successfully updated' })
  categoryUpdate(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() payload: CategoryUpdateDto,
  ): Promise<void> {
    return this.categoryService.categoryUpdate(id, payload);
  }

  @Delete(':id')
  @Roles('ADMIN')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a category and its items (admin only)' })
  @ApiNoContentResponse({ description: 'Category successfully deleted' })
  categoryDelete(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.categoryService.categoryDelete(id);
  }
}
