import { Body, Controller, Get, Headers, Inject, Post, Query } from '@nestjs/common';
import { ApiCreatedResponse, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { randomUUID } from 'node:crypto';
import { PaginationQueryDto } from '../common/dto/pagination.dto';
import { CreateUserDto } from './dto/create-user.dto';
import { UsersService } from './users.service';

@ApiTags('users')
@Controller('users')
export class UsersController {
  constructor(@Inject(UsersService) private readonly users: UsersService) {}

  @Get()
  @ApiOperation({ summary: 'List platform users' })
  @ApiOkResponse({ description: 'Paginated user list.' })
  list(@Query() query: PaginationQueryDto) {
    return this.users.list(query);
  }

  @Post()
  @ApiOperation({ summary: 'Create a platform user' })
  @ApiCreatedResponse({ description: 'Created user.' })
  create(@Body() dto: CreateUserDto, @Headers('x-actor-id') actorId: string | undefined, @Headers('x-correlation-id') correlationId: string | undefined) {
    return this.users.create(dto, { actorId, correlationId: correlationId ?? randomUUID() });
  }
}