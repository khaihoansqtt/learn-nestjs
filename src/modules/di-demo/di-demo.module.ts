import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { APP_INFO, type AppInfo } from '../../core/app-info.token.js';
import { DiDemoController } from './di-demo.controller.js';
import { DiDemoService } from './di-demo.service.js';
import { LifecycleService } from './lifecycle.service.js';
import { NodeAService } from './node-a.service.js';
import { NodeBService } from './node-b.service.js';
import { RequestIdService } from './request-id.service.js';
import { FEATURE_FLAGS, GREETING } from './tokens.js';
import { TransientCounterService } from './transient-counter.service.js';

@Module({
  controllers: [DiDemoController],
  providers: [
    DiDemoService,
    LifecycleService,
    RequestIdService,
    TransientCounterService,
    NodeAService,
    NodeBService,
    {
      // useFactory + inject: tạo giá trị động từ provider khác.
      // Ở đây GREETING phụ thuộc APP_INFO (global) — chứng minh factory
      // có thể dùng token từ module khác mà không cần import module đó
      // (nhờ CoreModule là @Global).
      provide: GREETING,
      inject: [ConfigService, APP_INFO],
      useFactory: (config: ConfigService, appInfo: AppInfo): string => {
        const owner = config.get<string>('GREETING_OWNER', 'shop-mini');
        return `hello from ${owner} [${appInfo.nodeEnv}]`;
      },
    },
    {
      // useValue: hằng số/static object, không có logic tạo.
      // (= Spring @Bean trả về Map.of(...) hoặc @ConfigurationProperties mock)
      provide: FEATURE_FLAGS,
      useValue: { newCheckout: false },
    },
  ],
  exports: [DiDemoService],
})
export class DiDemoModule {}
