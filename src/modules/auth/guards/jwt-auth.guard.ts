import {
  CanActivate,
  ExecutionContext,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { authConfig } from '../../../config/auth.config.js';
import type { AccessPayload, AuthUser } from '../auth.types.js';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator.js';

// Guard xác thực: route có @Public() thì qua, còn lại phải có Bearer access token.
// Đăng ký APP_GUARD nên áp TOÀN app (kể cả controller thêm sau này — secure by default).
// (= Spring OncePerRequestFilter check JWT trước khi vào controller)
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwt: JwtService,
    @Inject(authConfig.KEY)
    private readonly cfg: ConfigType<typeof authConfig>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // getAllAndOverride: metadata method thắng class (VD: controller public
    // nhưng 1 route muốn private — gắn gì đè đó, không có cách "bỏ public").
    // Muốn route private trong controller @Public: đừng @Public cả class.
    const isPublic = this.reflector.getAllAndOverride<boolean>(
      IS_PUBLIC_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (isPublic) return true;

    const req = context
      .switchToHttp()
      .getRequest<{ headers: Record<string, unknown>; user?: AuthUser }>();
    const token = extractBearer(req.headers.authorization);
    if (!token) {
      throw new UnauthorizedException(
        'Thiếu Bearer token — đăng nhập để lấy access token',
      );
    }

    let payload: AccessPayload;
    try {
      payload = await this.jwt.verifyAsync<AccessPayload>(token, {
        secret: this.cfg.accessSecret,
      });
    } catch (err) {
      // Hết hạn và chữ ký sai là 2 UX khác nhau: hết hạn -> client refresh thầm,
      // sai -> bắt login lại. Phân biệt bằng name của jsonwebtoken.
      if (err instanceof Error && err.name === 'TokenExpiredError') {
        throw new UnauthorizedException('Access token đã hết hạn — refresh để tiếp tục');
      }
      throw new UnauthorizedException('Token không hợp lệ — đăng nhập lại');
    }

    // Refresh token KHÔNG gọi được API dù chữ ký đúng (khác secret đã chặn
    // phần lớn, check type chặn nốt trường hợp 2 secret bị set trùng nhau).
    if (payload.type !== 'access') {
      throw new UnauthorizedException('Token không hợp lệ — đăng nhập lại');
    }

    // Stateless: tin chữ ký, KHÔNG query DB mỗi request (đổi role/revoke gấp
    // thì chờ access hết hạn ≤15 phút — tradeoff đã chốt ở M5).
    req.user = { id: payload.sub, email: payload.email, role: payload.role };
    return true;
  }
}

function extractBearer(header: unknown): string | null {
  if (typeof header !== 'string') return null;
  const [scheme, token] = header.split(' ');
  if (!scheme || scheme.toLowerCase() !== 'bearer' || !token) return null;
  return token;
}
