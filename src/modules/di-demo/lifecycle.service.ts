import {
  BeforeApplicationShutdown,
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';

// Demo lifecycle hooks — thứ tự chạy khi app start/stop:
// 1. onModuleInit (sau khi DI resolve xong, trước khi listen)
// 2. onApplicationBootstrap (sau khi mọi module init xong, trước khi listen xong)
// 3. onModuleDestroy / beforeApplicationShutdown (khi SIGTERM/SIGINT — cần enableShutdownHooks, đã bật ở main.ts)
// (= Spring: @PostConstruct -> CommandLineRunner/ApplicationRunner -> @PreDestroy)
@Injectable()
export class LifecycleService
  implements
    OnModuleInit,
    OnApplicationBootstrap,
    OnModuleDestroy,
    BeforeApplicationShutdown
{
  private readonly logger = new Logger(LifecycleService.name);
  readonly events: string[] = [];

  onModuleInit() {
    this.events.push('onModuleInit');
    this.logger.log('DiDemoModule initialized (onModuleInit)');
  }

  onApplicationBootstrap() {
    this.events.push('onApplicationBootstrap');
    this.logger.log('Application bootstrapped (onApplicationBootstrap)');
  }

  onModuleDestroy() {
    this.events.push('onModuleDestroy');
    this.logger.log('DiDemoModule destroyed (onModuleDestroy)');
  }

  beforeApplicationShutdown(signal?: string) {
    this.events.push(`beforeApplicationShutdown:${signal ?? 'unknown'}`);
    this.logger.log(`Shutting down, signal=${signal ?? 'unknown'}`);
  }
}
