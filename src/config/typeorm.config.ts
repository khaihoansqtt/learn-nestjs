import type { ConfigType } from '@nestjs/config';
import type { TypeOrmModuleOptions } from '@nestjs/typeorm';
import { dbConfig } from './db.config.js';
import { ENTITIES } from '../database/entities.js';
import { MIGRATIONS } from '../database/migrations/index.js';

// Factory options cho TypeOrmModule.forRootAsync — DI thay vì new DataSource()
// rải rác trong code. Mapping Spring:
//   @ConfigurationProperties(prefix="db") + @Bean DataSource
//   -> ConfigType<typeof dbConfig> + useFactory
//
// inject dbConfig.KEY (namespace config đã validate Joi ở M2) =>
// host/port/pass sai thì app CHƯA kịp kết nối DB đã crash fail-fast.
export function createTypeOrmOptions(
  cfg: ConfigType<typeof dbConfig>,
): TypeOrmModuleOptions {
  return {
    type: 'postgres',
    host: cfg.host,
    port: cfg.port,
    username: cfg.user,
    password: cfg.pass,
    database: cfg.name,

    entities: ENTITIES,
    migrations: MIGRATIONS,
    migrationsTableName: 'migrations',

    // KHÔNG auto-run: migration là lệnh tường minh `npm run db:migrate`
    // (deploy pipeline quyết định lúc nào chạy, tránh app start song song
    // 2 instance đua nhau apply schema).
    migrationsRun: false,

    // HẠN chế kết nối trong pool để không dồn ép Postgres (mặc định TypeORM
    // không giới hạn — app 20 instance có thể mở 20*unlimited connection).
    poolSize: cfg.poolSize,

    // Nói KHÔNG với synchronize:true. Dù chỉ dev: đổi entity 1 dòng mà schema
    // prod lệch thì data migrate kiểu gì? (chi tiết learn/M3).
    synchronize: false,
    logging: ['error', 'warn'],
  };
}
