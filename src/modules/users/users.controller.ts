import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import type { AuthUser } from '../auth/auth.types.js';
import { CreateUserDto } from './dto/create-user.dto.js';
import { ListUsersDto } from './dto/list-users.dto.js';
import { UpdateUserDto } from './dto/update-user.dto.js';
import { UserRole } from './user.entity.js';
import { UsersService } from './users.service.js';

// Phân quyền M5 (JwtAuthGuard + RolesGuard là APP_GUARD nên mọi route ở đây
// mặc định CẦN đăng nhập):
//   GET                 -> user bất kỳ (xem danh bạ)
//   POST                -> ADMIN (tạo user với role tùy ý, kể cả admin mới)
//   PATCH               -> ADMIN full quyền; CUSTOMER chỉ sửa CHÍNH MÌNH và
//                          không được đụng role/isActive (ownership + RBAC)
//   DELETE / restore    -> ADMIN
@Controller('users')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get()
  list(@Query() query: ListUsersDto) {
    return this.users.findAll(query);
  }

  @Post()
  @Roles(UserRole.ADMIN)
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
    @CurrentUser() me: AuthUser,
  ) {
    // Ownership: customer sửa người khác -> 403. Admin thì qua luôn.
    // Kể cả sửa chính mình, role/isActive cũng cấm đụng — 2 field đó chỉ
    // admin được đổi (chống tự phong admin / tự mở khóa).
    if (me.role !== UserRole.ADMIN) {
      if (me.id !== id) {
        throw new ForbiddenException('Chỉ được sửa tài khoản của chính mình');
      }
      if (dto.role !== undefined || dto.isActive !== undefined) {
        throw new ForbiddenException('role/isActive chỉ admin được đổi');
      }
    }
    return this.users.update(id, dto);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN)
  @HttpCode(200) // mặc định DELETE là 204, nhưng envelope M2 cần body -> 200
  async remove(@Param('id', ParseUUIDPipe) id: string) {
    await this.users.remove(id);
    return { id, deleted: true, soft: true };
  }

  @Post(':id/restore')
  @Roles(UserRole.ADMIN)
  restore(@Param('id', ParseUUIDPipe) id: string) {
    return this.users.restore(id);
  }
}
