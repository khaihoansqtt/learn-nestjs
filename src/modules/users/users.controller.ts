import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { CreateUserDto } from './dto/create-user.dto.js';
import { ListUsersDto } from './dto/list-users.dto.js';
import { UpdateUserDto } from './dto/update-user.dto.js';
import { UsersService } from './users.service.js';

// REST resource chuẩn — mapping y hệt Spring @RestController:
//   GET    /users        -> Page<User>   (Pageable)
//   POST   /users        -> 201 + User
//   GET    /users/:id    -> User         (404 nếu không có)
//   PATCH  /users/:id    -> User
//   DELETE /users/:id    -> 200          (soft-delete)
//   POST   /users/:id/restore -> User
//
// CHƯA CÓ GUARD: mọi endpoint đều công khai — đúng cho M4 (chưa học auth).
// M5 sẽ thêm JwtAuthGuard + RolesGuard, lúc đó chỉ khai 1 dòng @UseGuards.
@Controller('users')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get()
  list(@Query() query: ListUsersDto) {
    return this.users.findAll(query);
  }

  @Post()
  create(@Body() dto: CreateUserDto) {
    return this.users.create(dto);
  }

  // ParseUUIDPipe: id không phải UUID -> 400 ngay, không chạm service/DB.
  // (= Spring @PathVariable UUID — Spring cũng 400 ở binder.)
  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.users.findOne(id);
  }

  @Patch(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateUserDto,
  ) {
    return this.users.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(200) // mặc định DELETE là 204, nhưng envelope M2 cần body -> 200
  async remove(@Param('id', ParseUUIDPipe) id: string) {
    await this.users.remove(id);
    return { id, deleted: true, soft: true };
  }

  @Post(':id/restore')
  restore(@Param('id', ParseUUIDPipe) id: string) {
    return this.users.restore(id);
  }
}
