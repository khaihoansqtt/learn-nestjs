import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { UserRole } from '../../users/user.entity.js';
import type { AuthUser } from '../auth.types.js';
import { ROLES_KEY } from '../decorators/roles.decorator.js';

// Guard phân quyền: chạy SAU JwtAuthGuard (đăng ký APP_GUARD sau nó).
// Không có @Roles = chỉ cần đăng nhập. Có @Roles = role phải nằm trong list.
// (= Spring @PreAuthorize + MethodSecurity)
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<UserRole[]>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!required || required.length === 0) return true;

    const req = context
      .switchToHttp()
      .getRequest<{ user?: AuthUser }>();
    // JwtAuthGuard luôn chạy trước nên user phải có — không có là lỗi wiring,
    // báo 401 thay vì 403 để không lộ thông tin phân quyền.
    if (!req.user) {
      throw new UnauthorizedException('Chưa xác thực');
    }
    if (!required.includes(req.user.role)) {
      throw new ForbiddenException(
        `Cần quyền: ${required.join(' | ')} — tài khoản hiện tại: ${req.user.role}`,
      );
    }
    return true;
  }
}
