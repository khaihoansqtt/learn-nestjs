import { Global, Module } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import { appConfig } from '../config/app.config.js';
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
      // useFactory + typed config: ConfigType<typeof appConfig> cho autocomplete
      // và type-check thay vì get<string>('KEY') rời rạc dễ typo.
      provide: APP_INFO,
      inject: [appConfig.KEY],
      useFactory: (cfg: ConfigType<typeof appConfig>): AppInfo => ({
        name: 'shop-mini',
        version: '0.0.1',
        nodeEnv: cfg.nodeEnv,
      }),
    },
  ],
  exports: [IdService, APP_INFO],
})
export class CoreModule {}
