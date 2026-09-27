import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { AuthUser } from '../auth.types.js';

// Đọc req.user do JwtAuthGuard gắn — controller KHÔNG tự parse header.
// Dùng: @CurrentUser() user: AuthUser, hoặc @CurrentUser('id') id: string.
export const CurrentUser = createParamDecorator(
  (data: keyof AuthUser | undefined, ctx: ExecutionContext) => {
    const req = ctx.switchToHttp().getRequest<{ user?: AuthUser }>();
    if (!req.user) return undefined;
    return data ? req.user[data] : req.user;
  },
);
