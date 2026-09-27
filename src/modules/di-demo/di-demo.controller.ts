import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { ResponseMeta } from '../../common/decorators/response-meta.decorator.js';
import { Public } from '../auth/decorators/public.decorator.js';
import { DiDemoService } from './di-demo.service.js';
import { EchoBodyDto } from './echo-body.dto.js';
import { EchoQueryDto } from './echo-query.dto.js';
import { LifecycleService } from './lifecycle.service.js';
import { RequestIdService } from './request-id.service.js';

// CHÚ Ý: controller này inject RequestIdService (Scope.REQUEST)
// nên TOÀN BỘ controller bị lan truyền thành request-scoped:
// mỗi request tạo 1 controller mới. Đúng cho demo, nhưng trong code thật
// hãy cân nhắc: chỉ route nào cần request-context mới tách controller riêng.
// Di-demo là tài liệu sống để thử tay — public cả controller.
// Code demo không mang lên prod thật (xem review M1-M4).
@Public()
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

  // M2 demo: query DTO được validate + transform bởi ValidationPipe global.
  // Thử: /api/di-demo/echo?limit=999 -> 400; ?hacker=1 -> 400 (forbidNonWhitelisted).
  // @ResponseMeta gắn meta tĩnh, TransformInterceptor bọc thành { data, meta }.
  @Get('echo')
  @ResponseMeta({ demo: 'query-validation' })
  echoQuery(@Query() query: EchoQueryDto) {
    return { query };
  }

  // M2 demo: body DTO. Thử POST {"name":"a"} -> 400 (MinLength 2).
  @Post('echo')
  echoBody(@Body() body: EchoBodyDto) {
    return { body };
  }
}
