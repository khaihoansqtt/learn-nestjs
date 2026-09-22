import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Prefix chung cho mọi API: GET /api/health thay vì /health
  app.setGlobalPrefix('api');

  // Tương đương Bean Validation + @Valid trong Spring
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // tự strip field thừa (an toàn khi đi làm)
      forbidNonWhitelisted: true, // báo lỗi nếu client gửi field lạ
      transform: true, // auto transform query string -> number/boolean/DTO class
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  app.enableShutdownHooks();
  await app.listen(process.env.PORT ?? 3000);
}
await bootstrap();
