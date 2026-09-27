import { SetMetadata } from '@nestjs/common';
import type { UserRole } from '../../users/user.entity.js';

export const ROLES_KEY = 'auth.roles';

// Yêu cầu 1 trong các role liệt kê. KHÔNG gắn @Roles = chỉ cần đăng nhập.
// Guard đọc metadata này là RolesGuard (APP_GUARD, chạy SAU JwtAuthGuard).
// (= Spring @PreAuthorize("hasAnyRole('ADMIN')"))
export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);
