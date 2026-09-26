import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { loadEnv } from './load-env.js';
import { ENTITIES } from './entities.js';
import { MIGRATIONS } from './migrations/index.js';

// Tải .env NGAY khi import module này — CLI (migration/seed) chạy ngoài
// Nest container nên không có ConfigModule/Joi validate. Nhánh dev/CI:
// nếu env sai, DataSource.initialize() vẫn ném lỗi rõ ràng từ driver.
loadEnv();

// DataSource độc lập cho CLI = "bản copy" của options mà Nest đang dùng.
// KHÁC với Connection trong Hibernate, ta không new Connection trong app —
// Nest tạo qua TypeOrmModule.forRootAsync (xem src/config/typeorm.config.ts).
//
// Nguyên tắc: 2 nơi cùng đọc ENTITIES/MIGRATIONS nên không thể lệch nhau.
export const AppDataSource = new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST ?? 'localhost',
  port: parseInt(process.env.DB_PORT ?? '5432', 10),
  username: process.env.DB_USER ?? 'shop',
  password: process.env.DB_PASS ?? 'shop123',
  database: process.env.DB_NAME ?? 'shop_mini',

  entities: ENTITIES,
  migrations: MIGRATIONS,
  migrationsTableName: 'migrations',

  // TUYỆT ĐỐI false: schema chỉ đổi qua migration (xem learn/M3).
  synchronize: false,
  logging: process.env.NODE_ENV === 'production' ? ['error'] : ['error', 'warn'],
});
