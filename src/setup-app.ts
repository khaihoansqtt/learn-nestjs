import { INestApplication, ValidationPipe } from '@nestjs/common';

// Setup dùng chung cho main.ts (chạy thật) và e2e test.
// Filter/Interceptor đăng ký bằng APP_* trong AppModule nên tự có ở cả 2 nơi,
// chỉ prefix + pipe (thuộc về bootstrap, không thuộc module graph) cần hàm chung này.
export function setupApp(app: INestApplication): void {
  app.setGlobalPrefix('api');

  // Tương đương Bean Validation + @Valid: DTO sai -> 400 BadRequestException
  // với message là mảng string, HttpExceptionFilter sẽ chuẩn hóa tiếp.
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // strip field thừa
      forbidNonWhitelisted: true, // field lạ -> 400 (chống mass-assignment)
      transform: true, // query string "2" -> number 2, plain object -> DTO instance
      transformOptions: { enableImplicitConversion: true },
    }),
  );
}
