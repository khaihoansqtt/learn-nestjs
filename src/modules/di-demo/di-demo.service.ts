import { Inject, Injectable } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { IdService } from '../../core/id.service.js';
import { APP_INFO, type AppInfo } from '../../core/app-info.token.js';
import { NodeAService } from './node-a.service.js';
import { FEATURE_FLAGS, GREETING, type FeatureFlags } from './tokens.js';
import { TransientCounterService } from './transient-counter.service.js';

// Service SINGLETON (mặc định). Nó inject:
// - APP_INFO (global value/factory từ CoreModule, không cần import CoreModule)
// - GREETING + FEATURE_FLAGS (custom providers khai báo trong DiDemoModule)
// - NodeAService (demo circular đã gỡ bằng forwardRef)
// - ModuleRef để resolve TRANSIENT đúng cách (xem describeTransients)
//
// LƯU Ý TRANSIENT: Nest tạo 1 instance transient RIÊNG CHO MỖI CONSUMER,
// không phải mỗi injection-point. Inject 2 lần vào cùng 1 constructor vẫn
// nhận CHUNG 1 instance của consumer đó. Muốn 2 instance độc lập phải
// gọi moduleRef.resolve() 2 lần (mỗi lần resolve = 1 instance mới).
@Injectable()
export class DiDemoService {
  readonly singletonId = `di-demo-service-${Math.random().toString(36).slice(2, 8)}`;

  constructor(
    private readonly idService: IdService,
    private readonly moduleRef: ModuleRef,
    @Inject(APP_INFO) private readonly appInfo: AppInfo,
    @Inject(GREETING) private readonly greeting: string,
    @Inject(FEATURE_FLAGS) private readonly flags: FeatureFlags,
    private readonly nodeA: NodeAService,
  ) {}

  describeSingletons() {
    return {
      serviceInstanceId: this.singletonId,
      idServiceInstanceId: this.idService.instanceId,
      idServiceSample: this.idService.next('demo'),
      appInfo: this.appInfo,
    };
  }

  async describeTransients() {
    // Mỗi lần resolve() = 1 instance transient mới, độc lập hoàn toàn.
    const a = await this.moduleRef.resolve(TransientCounterService);
    const b = await this.moduleRef.resolve(TransientCounterService);
    return {
      a: { instanceId: a.instanceId, bump: a.bump() },
      b: { instanceId: b.instanceId, bump: b.bump() },
      sameInstance: a === (b as unknown),
    };
  }

  describeTokens() {
    return { greeting: this.greeting, flags: this.flags };
  }

  pingCircular() {
    return this.nodeA.ping();
  }
}
