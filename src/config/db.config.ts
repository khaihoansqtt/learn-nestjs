import { registerAs } from '@nestjs/config';

export interface DbConfig {
  host: string;
  port: number;
  user: string;
  pass: string;
  name: string;
  poolSize: number;
}

// Typed config cho TypeORM (xem typeorm.config.ts) — M2 chỉ validate env,
// M3 nối vào DB thật bằng config này.
export const dbConfig = registerAs(
  'db',
  (): DbConfig => ({
    host: process.env.DB_HOST ?? 'localhost',
    port: parseInt(process.env.DB_PORT ?? '5432', 10),
    user: process.env.DB_USER ?? 'shop',
    pass: process.env.DB_PASS ?? 'shop123',
    name: process.env.DB_NAME ?? 'shop_mini',
    poolSize: parseInt(process.env.DB_POOL_SIZE ?? '10', 10),
  }),
);
