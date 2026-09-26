import { Controller, Get, Inject, Logger, ServiceUnavailableException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { APP_INFO, type AppInfo } from '../../core/app-info.token.js';
import { IdService } from '../../core/id.service.js';

// Bẫy thực tế: khi TCP connect fail, Node ném AggregateError (thử ::1 rồi
// 127.0.0.1) và AggregateError.message là '' — trả thẳng ra client sẽ thành
// message [""] vô nghĩa. Phải đào lỗi gốc lấy message có nghĩa.
export function describeError(err: unknown): string {
  if (!(err instanceof Error)) return 'database unreachable';
  if (err.message.trim()) return err.message;
  if (err instanceof AggregateError && err.errors[0] instanceof Error) {
    return err.errors[0].message;
  }
  return err.name || 'database unreachable';
}

@Controller('health')
export class HealthController {
  // Logger của @nestjs/common (KHÔNG phải nestjs-pino — class đó cần
  // (PinoLogger, {renameContext})). main.ts đã app.useLogger(app.get(Logger))
  // với Logger pino nên mọi new Logger() đều ghi qua pino.
  private readonly logger = new Logger(HealthController.name);
  // APP_INFO + IdService đến từ CoreModule (@Global) nên KHÔNG cần
  // import CoreModule vào HealthModule để demo @Global hoạt động đúng.
  // (= Spring: bean shared được @ComponentScan toàn app)
  //
  // DataSource cũng inject được KHÔNG cần forFeature, vì TypeOrmCoreModule
  // (nơi đăng ký provider DataSource) cũng là @Global (xem typeorm-core.module.js).
  //
  // BẪY Ở ĐÂY: phải import { DataSource } (value), KHÔNG phải import type.
  // Với `import type`, TS loại bỏ reference runtime nên emitDecoratorMetadata
  // ghi design:paramtypes = Object -> Nest inject token Object -> UnknownDependencies.
  constructor(
    @Inject(APP_INFO) private readonly appInfo: AppInfo,
    private readonly ids: IdService,
    private readonly dataSource: DataSource,
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

  // Health check DB kiểu readiness probe (= Spring HealthIndicator/Actuator).
  // Chạy sau khi migration xong mới "up" được — dùng cho deploy/pipeline quyết
  // định app đã sẵn sàng nhận traffic chưa.
  @Get('db')
  async db() {
    const startedAt = Date.now();
    try {
      //ping thay vì `SELECT 1` cứng: vẫn round-trip tới DB, không đụng bảng nào
      // nên chạy được cả khi chưa migrate.
      await this.dataSource.query('SELECT 1');
      return {
        status: 'up',
        database: this.dataSource.options.database,
        latencyMs: Date.now() - startedAt,
      };
    } catch (err) {
      this.logger.warn({ err: describeError(err) }, 'db health check failed');
      // Không nuốt exception: 503 + envelope từ HttpExceptionFilter (M2).
      throw new ServiceUnavailableException({
        status: 'down',
        message: describeError(err),
      });
    }
  }
}
