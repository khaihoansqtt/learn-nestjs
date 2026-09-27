import { registerAs } from '@nestjs/config';

export interface AuthConfig {
  accessSecret: string;
  refreshSecret: string;
  accessTtlSec: number;
  refreshTtlSec: number;
}

// Dev defaults để boot được ngay khi clone repo. NHƯNG nếu NODE_ENV=production
// mà vẫn dùng secret mặc định -> throw NGAY lúc startup (fail-fast), vì JWT
// ký bằng secret lộ sẵn thì coi như không có auth.
// (= Spring: @Validated + @PostConstruct check profile prod)
export const DEV_ACCESS_SECRET = 'dev-access-secret-toi-thieu-32-ky-tu-000';
export const DEV_REFRESH_SECRET = 'dev-refresh-secret-toi-thieu-32-ky-tu-000';

export const authConfig = registerAs(
  'auth',
  (): AuthConfig => ({
    accessSecret: process.env.JWT_ACCESS_SECRET ?? DEV_ACCESS_SECRET,
    refreshSecret: process.env.JWT_REFRESH_SECRET ?? DEV_REFRESH_SECRET,
    accessTtlSec: parseInt(process.env.JWT_ACCESS_TTL_SEC ?? '900', 10), // 15 phút
    refreshTtlSec: parseInt(process.env.JWT_REFRESH_TTL_SEC ?? '604800', 10), // 7 ngày
  }),
);

export function assertAuthConfigProductionSafe(
  cfg: AuthConfig,
  nodeEnv: string,
): void {
  if (
    nodeEnv === 'production' &&
    (cfg.accessSecret === DEV_ACCESS_SECRET ||
      cfg.refreshSecret === DEV_REFRESH_SECRET)
  ) {
    throw new Error(
      'JWT secret mặc định (dev) không được dùng ở production — set JWT_ACCESS_SECRET/JWT_REFRESH_SECRET.',
    );
  }
}
