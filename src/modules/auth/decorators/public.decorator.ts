import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'auth.is-public';

// Đánh dấu route/controller KHÔNG cần JWT (login, register, health...).
// Mọi route khác mặc định PHẢI có Bearer access token vì JwtAuthGuard là APP_GUARD.
// (= Spring: requestMatchers("/api/auth/**").permitAll() — nhưng khai báo
// ngay tại handler thay vì tập trung 1 file SecurityConfig)
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
