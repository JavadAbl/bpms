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
import { UserService } from '../services/user.service.js';
import { UserDto } from '../dto/response/user.dto.js';
import { UserCreateDto } from '../dto/request/user-create.dto.js';
import { UserUpdateDto } from '../dto/request/user-update.dto.js';

@ApiTags('users')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('users')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Get()
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Retrieve a paginated list of users (admin only)' })
  @ApiExtraModels(UserDto)
  @ApiGetManyResponse(UserDto)
  userGetMany(@Query() query: GetManyQuery): Promise<GetManyReply<UserDto>> {
    return this.userService.userGetMany(query as GetManyQueryType<'User'>);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a user by id (admin or self)' })
  @ApiOkResponse({ description: 'Successfully retrieved user', type: UserDto })
  userGetById(@Param('id', ParseUUIDPipe) id: string): Promise<UserDto> {
    return this.userService.userGetById(id);
  }

  @Post()
  @Roles('ADMIN')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a user (admin only)' })
  @ApiCreatedResponse({ description: 'User successfully created', type: String })
  userCreate(@Body() payload: UserCreateDto): Promise<string> {
    return this.userService.userCreate(payload);
  }

  @Patch(':id')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Update a user (admin only)' })
  @ApiOkResponse({ description: 'User successfully updated' })
  userUpdate(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() payload: UserUpdateDto,
  ): Promise<void> {
    return this.userService.userUpdate(id, payload);
  }

  @Delete(':id')
  @Roles('ADMIN')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a user (admin only)' })
  @ApiNoContentResponse({ description: 'User successfully deleted' })
  userDelete(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.userService.userDelete(id);
  }
}
