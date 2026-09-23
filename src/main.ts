import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app.module.js';
import { setupApp } from './setup-app.js';

async function bootstrap() {
  // bufferLogs: gom log lúc khởi động, flush sau khi pino logger sẵn sàng
  // để không mất log và format đồng nhất JSON/pretty.
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  setupApp(app);

  // Dùng pino làm Nest Logger toàn app (thay console mặc định).
  app.useLogger(app.get(Logger));
  app.enableShutdownHooks();

  const config = app.get(ConfigService);
  const port = config.get<number>('app.port', 3000);
  await app.listen(port);
}
await bootstrap();
