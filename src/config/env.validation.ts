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
