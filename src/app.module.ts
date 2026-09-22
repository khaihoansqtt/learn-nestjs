import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { HealthModule } from './modules/health/health.module.js';

@Module({
  imports: [
    // Tương đương application.yml + @Value trong Spring Boot.
    // isGlobal: true để không phải import lại ở từng module con.
    ConfigModule.forRoot({ isGlobal: true, envFilePath: ['.env'] }),
    HealthModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
