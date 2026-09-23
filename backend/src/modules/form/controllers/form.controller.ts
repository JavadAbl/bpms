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
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { GetManyQueryType } from '#common/dto/request/get-many-query.js';
import { ApiGetManyResponse, GetManyReply } from '#common/dto/response/get-many-reply.js';
import { JwtAuthGuard } from '#common/guards/jwt-auth.guard.js';
import { RolesGuard } from '#common/guards/roles.guard.js';
import { Roles } from '#common/decorators/roles.decorator.js';
import { FormService } from '../services/form.service.js';
import { FormDto } from '../dto/response/form.dto.js';
import { FormCreateDto } from '../dto/request/form-create.dto.js';
import { FormUpdateDto } from '../dto/request/form-update.dto.js';
import { FormGetManyQuery } from '../dto/request/form-get-many-query.dto.js';

@ApiTags('forms')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('forms')
export class FormController {
  constructor(private readonly formService: FormService) {}

  @Get()
  @ApiOperation({ summary: 'List forms (paginated, scoped by processId)' })
  @ApiQuery({
    name: 'processId',
    required: true,
    description: 'Process ID — forms are scoped to a process',
  })
  @ApiExtraModels(FormDto)
  @ApiGetManyResponse(FormDto)
  formGetMany(@Query() query: FormGetManyQuery): Promise<GetManyReply<FormDto>> {
    return this.formService.formGetMany(query as GetManyQueryType<'Form'> & { processId: string });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a form by id' })
  @ApiOkResponse({ description: 'Successfully retrieved form', type: FormDto })
  formGetById(@Param('id', ParseUUIDPipe) id: string): Promise<FormDto> {
    return this.formService.formGetById(id);
  }

  @Post()
  @Roles('ADMIN')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a dynamic form (admin only)' })
  @ApiCreatedResponse({ description: 'Form successfully created', type: String })
  formCreate(@Body() payload: FormCreateDto): Promise<string> {
    return this.formService.formCreate(payload);
  }

  @Patch(':id')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Update a dynamic form (admin only)' })
  @ApiOkResponse({ description: 'Form successfully updated' })
  formUpdate(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() payload: FormUpdateDto,
  ): Promise<void> {
    return this.formService.formUpdate(id, payload);
  }

  @Delete(':id')
  @Roles('ADMIN')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a dynamic form (admin only)' })
  @ApiNoContentResponse({ description: 'Form successfully deleted' })
  formDelete(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.formService.formDelete(id);
  }
}
