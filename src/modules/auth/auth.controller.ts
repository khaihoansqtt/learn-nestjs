import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import { AuthService } from './auth.service.js';
import { CurrentUser } from './decorators/current-user.decorator.js';
import { Public } from './decorators/public.decorator.js';
import type { AuthUser } from './auth.types.js';
import { LoginDto } from './dto/login.dto.js';
import { RefreshDto } from './dto/refresh.dto.js';
import { RegisterDto } from './dto/register.dto.js';

// Mọi route ở đây đều @Public() RIÊNG TỪNG METHOD (không public cả class):
// sau này thêm route cần auth (VD: đổi mật khẩu) sẽ không bị hở theo.
// (= Spring: permitAll từng antMatcher, không /** cả controller)
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Public()
  @Post('register')
  register(@Body() dto: RegisterDto) {
    return this.auth.register(dto);
  }

  @Public()
  @Post('login')
  @HttpCode(200) // login thành công là 200, không phải 201 (không tạo resource)
  login(@Body() dto: LoginDto) {
    return this.auth.login(dto);
  }

  @Public()
  @Post('refresh')
  @HttpCode(200)
  refresh(@Body() dto: RefreshDto) {
    return this.auth.refresh(dto.refreshToken);
  }

  // Logout CẦN access token: biết chắc ai đang logout để revoke đúng chủ.
  // Body vẫn cần refreshToken vì access không suy ra được refresh đang cầm.
  @Post('logout')
  @HttpCode(200)
  async logout(
    @CurrentUser() user: AuthUser,
    @Body() dto: RefreshDto,
  ) {
    await this.auth.logout(user.id, dto.refreshToken);
    return { revoked: true };
  }
}
