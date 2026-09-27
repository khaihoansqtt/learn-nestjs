import type { UserRole } from '../users/user.entity.js';

// Payload ký trong JWT. type phân biệt access/refresh để refresh token
// không bao giờ gọi được API (guard check type, xem jwt-auth.guard).
export interface AccessPayload {
  sub: string; // user id
  email: string;
  role: UserRole;
  type: 'access';
}

export interface RefreshPayload {
  sub: string;
  type: 'refresh';
  jti: string; // id duy nhất của refresh token, trace rotation
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresIn: number; // TTL access (giây) để client hẹn giờ refresh
}

// Hình dạng req.user sau khi JwtAuthGuard chạy — controller đọc qua
// @CurrentUser(), KHÔNG tự parse header.
export interface AuthUser {
  id: string;
  email: string;
  role: UserRole;
}
