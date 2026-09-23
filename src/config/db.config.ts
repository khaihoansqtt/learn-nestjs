import { registerAs } from '@nestjs/config';

export interface DbConfig {
  host: string;
  port: number;
  user: string;
  pass: string;
  name: string;
}

// Chuẩn bị cho M3 (TypeORM). M2 chỉ validate env, chưa kết nối.
export const dbConfig = registerAs(
  'db',
  (): DbConfig => ({
    host: process.env.DB_HOST ?? 'localhost',
    port: parseInt(process.env.DB_PORT ?? '5432', 10),
    user: process.env.DB_USER ?? 'shop',
    pass: process.env.DB_PASS ?? 'shop123',
    name: process.env.DB_NAME ?? 'shop_mini',
  }),
);
