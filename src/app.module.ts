import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { CoreModule } from './core/core.module.js';
import { DiDemoModule } from './modules/di-demo/di-demo.module.js';
import { HealthModule } from './modules/health/health.module.js';

@Module({
  imports: [
    // Tương đương application.yml + @Value trong Spring Boot.
    // isGlobal: true để không phải import lại ở từng module con.
    ConfigModule.forRoot({ isGlobal: true, envFilePath: ['.env'] }),
    // @Global module: export APP_INFO + IdService cho toàn app.
    CoreModule,
    HealthModule,
    // M1: playground DI (tokens, scopes, lifecycle, forwardRef).
    // Khi sang M4+ module domain thật sẽ thay vị trí học tập này.
    DiDemoModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
