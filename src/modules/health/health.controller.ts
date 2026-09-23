import { Controller, Get, Inject } from '@nestjs/common';
import { APP_INFO, type AppInfo } from '../../core/app-info.token.js';
import { IdService } from '../../core/id.service.js';

@Controller('health')
export class HealthController {
  // APP_INFO + IdService đến từ CoreModule (@Global) nên KHÔNG cần
  // import CoreModule vào HealthModule — demo @Global hoạt động.
  // (= Spring: bean shared đã @ComponentScan toàn app)
  constructor(
    @Inject(APP_INFO) private readonly appInfo: AppInfo,
    private readonly ids: IdService,
  ) {}

  @Get()
  check() {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    };
  }

  @Get('info')
  info() {
    return {
      app: this.appInfo,
      sampleId: this.ids.next('health'),
      idServiceInstance: this.ids.instanceId,
    };
  }
}
