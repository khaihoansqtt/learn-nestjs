import {
  ClassSerializerInterceptor,
  Module,
} from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_FILTER, APP_INTERCEPTOR } from '@nestjs/core';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LoggerModule } from 'nestjs-pino';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { HttpExceptionFilter } from './common/filters/http-exception.filter.js';
import { TransformInterceptor } from './common/interceptors/transform.interceptor.js';
import { appConfig } from './config/app.config.js';
import { authConfig } from './config/auth.config.js';
import { dbConfig } from './config/db.config.js';
import { validateEnv } from './config/env.validation.js';
import { createTypeOrmOptions } from './config/typeorm.config.js';
import { CoreModule } from './core/core.module.js';
import { DiDemoModule } from './modules/di-demo/di-demo.module.js';
import { HealthModule } from './modules/health/health.module.js';
import { AuthModule } from './modules/auth/auth.module.js';
import { UsersModule } from './modules/users/users.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env', '.env.example'],
      load: [appConfig, dbConfig, authConfig],
      validate: validateEnv,
    }),
    // Pino logger: JSON structured khi production, pretty khi dev, silent khi test.
    // customProps gắn requestId vào MỌI log của request đó để trace.
    LoggerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const nodeEnv = config.get<string>('app.nodeEnv', 'development');
        const isTest = nodeEnv === 'test' || process.env.VITEST === 'true';
        return {
          pinoHttp: {
            level: isTest ? 'silent' : nodeEnv === 'production' ? 'info' : 'debug',
            transport:
              !isTest && nodeEnv !== 'production'
                ? { target: 'pino-pretty', options: { singleLine: true } }
                : undefined,
            customProps: (req) => {
              const header = req.headers['x-request-id'];
              return {
                requestId: Array.isArray(header) ? header[0] : (header ?? req.id),
              };
            },
          },
        };
      },
    }),
    // async providers: inject dbConfig.KEY đã được Joi validate từ M2,
    // trả về TypeOrmModuleOptions (xem createTypeOrmOptions). TypeOrmCoreModule
    // là @Global nên DataSource inject được ở mọi module không cần forFeature.
    TypeOrmModule.forRootAsync({
      inject: [dbConfig.KEY],
      useFactory: createTypeOrmOptions,
    }),
    CoreModule,
    HealthModule,
    DiDemoModule,
    UsersModule,
    AuthModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    // Đăng ký global bằng token APP_* (thay vì app.useGlobalX trong main.ts)
    // để e2e test với TestingModule cũng có filter/interceptor y hệt production.
    { provide: APP_FILTER, useClass: HttpExceptionFilter },
    // Thứ tự interceptor: đăng ký trước = NGOÀI CÙNG (xem InterceptorsConsumer:
    // interceptors[0].intercept chạy đầu, map() của nó chạy CUỐI).
    // Response đi: handler -> Transform bọc {data} -> ClassSerializer serialize
    // CUỐI, đệ quy vào trong data nên @Exclude vẫn dính dù entity nằm sâu.
    // (= Spring MappingJackson2HttpMessageConverter + @JsonIgnore)
    { provide: APP_INTERCEPTOR, useClass: ClassSerializerInterceptor },
    { provide: APP_INTERCEPTOR, useClass: TransformInterceptor },
  ],
})
export class AppModule {}
