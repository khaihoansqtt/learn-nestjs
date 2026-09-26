import Joi from 'joi';

// Validate env lúc startup — sai là crash NGAY với message rõ ràng (fail-fast),
// thay vì chạy nửa chừng mới lỗi kết nối DB.
// (= Spring fail-fast khi thiếu property + @Validated @ConfigurationProperties)
//
// LƯU Ý Nest 12: ConfigModule.validationSchema chỉ nhận Standard Schema (Zod...),
// nên Joi được bọc trong hàm `validate` custom — hiệu quả tương đương.
const schema = Joi.object({
  PORT: Joi.number().port().default(3000),
  NODE_ENV: Joi.string()
    .valid('development', 'test', 'production')
    .default('development'),
  GREETING_OWNER: Joi.string().default('shop-mini'),

  DB_HOST: Joi.string().default('localhost'),
  DB_PORT: Joi.number().port().default(5432),
  DB_USER: Joi.string().required(),
  DB_PASS: Joi.string().required(),
  DB_NAME: Joi.string().required(),
  DB_POOL_SIZE: Joi.number().integer().min(1).max(100).default(10),

  // Seed admin (chỉ CLI db:seed đọc, Nest không dùng — vẫn validate để
  // fail-fast nếu ai gõ sai port trong .env).
  // Lưu ý: Joi .email() mặc định bắt TLD thật — 'admin@shop-mini.local' bị reject.
  SEED_ADMIN_EMAIL: Joi.string().email().default('admin@shop-mini.dev'),
  SEED_ADMIN_NAME: Joi.string().default('Administrator'),
  SEED_ADMIN_PASSWORD: Joi.string().min(8).default('Admin@123'),
});

export function validateEnv(
  env: Record<string, unknown>,
): Record<string, unknown> {
  const { error, value } = schema.validate(env, {
    abortEarly: false, // gom hết lỗi 1 lần thay vì báo từng cái
    allowUnknown: true, // process.env luôn có PATH, OS vars...
  });
  if (error) {
    throw new Error(`Config validation error:\n${error.message}`);
  }
  return value as Record<string, unknown>;
}
