import { Module } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import { appConfig } from '../../config/app.config.js';
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
      // GREETING phụ thuộc typed appConfig + APP_INFO (global).
      provide: GREETING,
      inject: [appConfig.KEY, APP_INFO],
      useFactory: (
        cfg: ConfigType<typeof appConfig>,
        appInfo: AppInfo,
      ): string => `hello from ${cfg.greetingOwner} [${appInfo.nodeEnv}]`,
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
