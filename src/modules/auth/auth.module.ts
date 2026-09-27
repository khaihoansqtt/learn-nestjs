import { Module } from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { TypeOrmModule } from '@nestjs/typeorm';
import { appConfig } from '../../config/app.config.js';
import { assertAuthConfigProductionSafe, authConfig } from '../../config/auth.config.js';
import { User } from '../users/user.entity.js';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { JwtAuthGuard } from './guards/jwt-auth.guard.js';
import { RolesGuard } from './guards/roles.guard.js';
import { RefreshToken } from './refresh-token.entity.js';

@Module({
  imports: [
    // forFeature([User]) TRÙNG với UsersModule vẫn hợp lệ: mỗi module có
    // repository provider riêng cho entity đó (không share, không conflict).
    TypeOrmModule.forFeature([User, RefreshToken]),
    // Secret mặc định + signOptions ở đây; refresh dùng secret riêng nên mỗi
    // lần signAsync truyền tường minh (xem auth.service.issuePair).
    JwtModule.registerAsync({
      inject: [authConfig.KEY, appConfig.KEY],
      useFactory: (
        auth: ConfigType<typeof authConfig>,
        app: ConfigType<typeof appConfig>,
      ) => {
        // Chạy lúc startup: mang secret dev lên prod là crash ngay, không đợi
        // request đầu tiên mới lộ.
        assertAuthConfigProductionSafe(auth, app.nodeEnv);
        return {
          secret: auth.accessSecret,
          signOptions: { expiresIn: auth.accessTtlSec },
        };
      },
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    // APP_GUARD đặt ở AuthModule (thay vì AppModule) để toàn bộ wiring auth
    // nằm 1 chỗ. Thứ tự = thứ tự chạy: JwtAuthGuard (xác thực) TRƯỚC RolesGuard
    // (phân quyền) — đảo lại là RolesGuard đọc req.user chưa có.
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
  exports: [AuthService],
})
export class AuthModule {}
