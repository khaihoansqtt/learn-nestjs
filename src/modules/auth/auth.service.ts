import {
  ConflictException,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { JwtService } from '@nestjs/jwt';
import { createHash, randomUUID } from 'node:crypto';
import { IsNull, Repository } from 'typeorm';
import { authConfig } from '../../config/auth.config.js';
import {
  normalizeEmail,
} from '../users/users.service.js';
import { User, UserRole } from '../users/user.entity.js';
import { hashPassword, verifyPassword } from '../users/password.util.js';
import { LoginDto } from './dto/login.dto.js';
import { RegisterDto } from './dto/register.dto.js';
import { RefreshToken } from './refresh-token.entity.js';
import type {
  AccessPayload,
  RefreshPayload,
  TokenPair,
} from './auth.types.js';

// SHA-256 one-way của refresh token để lưu DB: DB lộ cũng không dựng lại
// được token gốc. Khác password ở chỗ KHÔNG cần salt/chậm (scrypt) vì token
// đã là 128+ bit ngẫu nhiên — brute-force không khả thi, SHA nhanh là đủ.
export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

// Message login SAI luôn chung 1 câu cho cả 3 trường hợp (không có user,
// sai password, bị khóa/xóa) — chống user-enumeration: attacker không phân
// biệt được "email này có tồn tại không" qua response.
// (= Spring: BadCredentialsException chung, không tiết lộ user có tồn tại)
const INVALID_CREDENTIALS = 'Email hoặc mật khẩu không đúng';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User)
    private readonly users: Repository<User>,
    @InjectRepository(RefreshToken)
    private readonly tokens: Repository<RefreshToken>,
    private readonly jwt: JwtService,
    @Inject(authConfig.KEY)
    private readonly cfg: ConfigType<typeof authConfig>,
  ) {}

  // Đăng ký công khai — role LUÔN CUSTOMER (xem RegisterDto: không nhận role).
  // Trả luôn cặp token (auto-login) để client không phải gọi login tiếp.
  async register(dto: RegisterDto): Promise<{ user: User } & TokenPair> {
    const email = normalizeEmail(dto.email);
    const exists = await this.users.findOne({ where: { email } });
    // 409 ở register LỘ user tồn tại — chấp nhận (UX chuẩn: báo "email đã dùng"),
    // vì enumeration qua register không tránh được mà vẫn cho đăng ký được.
    if (exists) throw new ConflictException(`email ${email} đã tồn tại`);

    const user = await this.users.save(
      this.users.create({
        email,
        fullName: dto.fullName.trim(),
        role: UserRole.CUSTOMER,
        passwordHash: hashPassword(dto.password),
      }),
    );
    return { user, ...(await this.issuePair(user)) };
  }

  async login(dto: LoginDto): Promise<{ user: User } & TokenPair> {
    // passwordHash có select:false nên phải addSelect tường minh.
    // Object user này CHỨA hash trong memory — nhưng @Exclude (M4) đảm bảo
    // serialize ra JSON vẫn mất hash (có test user.serialization.spec).
    const user = await this.users
      .createQueryBuilder('user')
      .where('user.email = :email', { email: normalizeEmail(dto.email) })
      .addSelect('user.passwordHash')
      .getOne();

    if (!user || !verifyPassword(dto.password, user.passwordHash)) {
      throw new UnauthorizedException(INVALID_CREDENTIALS);
    }
    // Tài khoản bị khóa (isActive=false) hoặc đã xóa mềm: cùng 1 message chung.
    // findOne/QB tự lọc deletedAt nên user xóa mềm rơi vào nhánh !user ở trên.
    if (!user.isActive) {
      throw new UnauthorizedException(INVALID_CREDENTIALS);
    }
    return { user, ...(await this.issuePair(user)) };
  }

  // Rotation: mỗi refresh thành công REVOKE token cũ + cấp cặp mới.
  // Token cũ dùng lại lần nữa = dấu hiệu đánh cắp -> revoke TOÀN BỘ token
  // của user (reuse detection) + 401. (= Spring: refresh rotation + reuse detect)
  //
  // RACE ĐÃ BIẾT (chưa fix ở M5): 2 request refresh cùng token song song đều
  // qua check trước khi revoke -> sinh 2 cặp hợp lệ. Fix đúng = transaction
  // SELECT FOR UPDATE (học ở M8). Hậu quả nhẹ (thêm 1 session), chấp nhận.
  async refresh(refreshToken: string): Promise<TokenPair> {
    let payload: RefreshPayload;
    try {
      payload = await this.jwt.verifyAsync<RefreshPayload>(refreshToken, {
        secret: this.cfg.refreshSecret,
      });
    } catch {
      throw new UnauthorizedException('Refresh token không hợp lệ hoặc đã hết hạn');
    }
    if (payload.type !== 'refresh') {
      throw new UnauthorizedException('Refresh token không hợp lệ');
    }

    const row = await this.tokens.findOne({
      where: { tokenHash: hashToken(refreshToken) },
    });
    if (!row) {
      throw new UnauthorizedException('Refresh token không hợp lệ');
    }
    if (row.revokedAt) {
      // Token đã rotate mà còn dùng lại -> nghi bị đánh cắp: đá hết session.
      await this.revokeAll(row.userId);
      throw new UnauthorizedException(
        'Phát hiện dùng lại token cũ — đã đăng xuất mọi thiết bị để bảo vệ tài khoản',
      );
    }
    if (row.expiresAt.getTime() <= Date.now()) {
      await this.tokens.delete({ id: row.id }); // dọn dòng hết hạn
      throw new UnauthorizedException('Refresh token không hợp lệ hoặc đã hết hạn');
    }

    const user = await this.users.findOne({ where: { id: row.userId } });
    if (!user || !user.isActive) {
      await this.revokeAll(row.userId);
      throw new UnauthorizedException('Refresh token không hợp lệ');
    }

    row.revokedAt = new Date();
    await this.tokens.save(row);
    return this.issuePair(user);
  }

  // Logout: revoke đúng token đang cầm. Idempotent — token lạ/cũ cũng 200
  // (client cứ xóa local là xong, không cần biết server có row không).
  async logout(userId: string, refreshToken: string): Promise<void> {
    await this.tokens.update(
      { tokenHash: hashToken(refreshToken), userId, revokedAt: IsNull() },
      { revokedAt: new Date() },
    );
  }

  private async revokeAll(userId: string): Promise<void> {
    await this.tokens.update(
      { userId, revokedAt: IsNull() },
      { revokedAt: new Date() },
    );
  }

  // Cấp cặp token mới + lưu refresh row. jti ngẫu nhiên mỗi lần để trace
  // vòng đời token trong log khi cần điều tra.
  private async issuePair(user: User): Promise<TokenPair> {
    const access: AccessPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      type: 'access',
    };
    const refresh: RefreshPayload = {
      sub: user.id,
      type: 'refresh',
      jti: randomUUID(),
    };
    const accessToken = await this.jwt.signAsync(access, {
      secret: this.cfg.accessSecret,
      expiresIn: this.cfg.accessTtlSec,
    });
    const refreshToken = await this.jwt.signAsync(refresh, {
      secret: this.cfg.refreshSecret,
      expiresIn: this.cfg.refreshTtlSec,
    });
    await this.tokens.insert({
      userId: user.id,
      tokenHash: hashToken(refreshToken),
      expiresAt: new Date(Date.now() + this.cfg.refreshTtlSec * 1000),
      revokedAt: null,
    });
    return { accessToken, refreshToken, expiresIn: this.cfg.accessTtlSec };
  }
}
