import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { APP_INFO, type AppInfo } from './app-info.token.js';
import { IdService } from './id.service.js';

// @Global() = module dùng khắp nơi mà KHÔNG cần import lại
// (giống 1 @Configuration shared được @ComponentScan toàn app).
// Chỉ dùng cho hạ tầng thật sự chung (config, logger, id, ...).
// Lạm dụng @Global sẽ che mất module graph — khó trace dependency.
@Global()
@Module({
  providers: [
    IdService,
    {
      // Custom provider dạng useFactory: giá trị được TẠO ĐỘNG lúc runtime,
      // có thể inject provider khác (ở đây là ConfigService).
      // (= Spring @Bean public AppInfo appInfo(ConfigService cfg) {...})
      provide: APP_INFO,
      inject: [ConfigService],
      useFactory: (config: ConfigService): AppInfo => ({
        name: 'shop-mini',
        version: '0.0.1',
        nodeEnv: config.get<string>('NODE_ENV', 'development'),
      }),
    },
  ],
  exports: [IdService, APP_INFO],
})
export class CoreModule {}
