import { Controller, Get } from '@nestjs/common';
import { DiDemoService } from './di-demo.service.js';
import { LifecycleService } from './lifecycle.service.js';
import { RequestIdService } from './request-id.service.js';

// CHÚ Ý: controller này inject RequestIdService (Scope.REQUEST)
// nên TOÀN BỘ controller bị lan truyền thành request-scoped:
// mỗi request tạo 1 controller mới. Đúng cho demo, nhưng trong code thật
// hãy cân nhắc: chỉ route nào cần request-context mới tách controller riêng.
@Controller('di-demo')
export class DiDemoController {
  readonly controllerInstanceId = `di-demo-ctrl-${Math.random().toString(36).slice(2, 8)}`;

  constructor(
    private readonly demo: DiDemoService,
    private readonly requestIds: RequestIdService,
    private readonly lifecycle: LifecycleService,
  ) {}

  @Get('singleton')
  singleton() {
    return this.demo.describeSingletons();
  }

  @Get('scopes')
  async scopes() {
    return {
      controllerInstanceId: this.controllerInstanceId,
      requestId: this.requestIds.requestId,
      transients: await this.demo.describeTransients(),
      note: 'Gọi 2 lần: controllerInstanceId + transients KHÁC NHAU mỗi request (vì request-scope lan truyền), singleton GIỮ NGUYÊN.',
    };
  }

  @Get('tokens')
  tokens() {
    return this.demo.describeTokens();
  }

  @Get('circular')
  circular() {
    return { result: this.demo.pingCircular() };
  }

  @Get('lifecycle')
  lifecycleEvents() {
    return { events: this.lifecycle.events };
  }
}
