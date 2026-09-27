import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DEV_ACCESS_SECRET, DEV_REFRESH_SECRET } from '../../config/auth.config.js';
import { UserRole } from '../users/user.entity.js';
import { hashPassword } from '../users/password.util.js';
import { AuthService, hashToken } from './auth.service.js';

// JwtService THẬT với secret test (ký/verify thật, nhanh, không mock sai
// hành vi crypto). Repository mock thuần — không cần DB.
const TEST_CFG = {
  accessSecret: DEV_ACCESS_SECRET,
  refreshSecret: DEV_REFRESH_SECRET,
  accessTtlSec: 900,
  refreshTtlSec: 604800,
} as const;

function makeUser(overrides: Record<string, unknown> = {}) {
  return {
    id: 'user-1',
    email: 'a@b.c',
    fullName: 'Ab',
    role: UserRole.CUSTOMER,
    isActive: true,
    deletedAt: null,
    passwordHash: hashPassword('MatKhau@123'),
    ...overrides,
  };
}

describe('AuthService', () => {
  let users: {
    findOne: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    save: ReturnType<typeof vi.fn>;
    createQueryBuilder: ReturnType<typeof vi.fn>;
  };
  let tokens: {
    findOne: ReturnType<typeof vi.fn>;
    insert: ReturnType<typeof vi.fn>;
    save: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
  };
  let service: AuthService;
  const jwt = new JwtService({});

  beforeEach(() => {
    users = {
      findOne: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockImplementation((x: object) => x),
      save: vi.fn().mockImplementation(async (x: object) => ({
        id: 'user-1',
        ...x,
      })),
      createQueryBuilder: vi.fn(),
    };
    tokens = {
      findOne: vi.fn().mockResolvedValue(null),
      insert: vi.fn().mockResolvedValue({ identifiers: [] }),
      save: vi.fn().mockImplementation(async (x: object) => x),
      update: vi.fn().mockResolvedValue({ affected: 1 }),
      delete: vi.fn().mockResolvedValue({ affected: 1 }),
    };
    service = new AuthService(
      users as never,
      tokens as never,
      jwt,
      TEST_CFG as never,
    );
  });

  // Helper dựng QB mock trả về user cho trước (login dùng QB + addSelect).
  function mockLoginUser(user: Record<string, unknown> | null) {
    const qb = {
      where: vi.fn().mockReturnThis(),
      addSelect: vi.fn().mockReturnThis(),
      getOne: vi.fn().mockResolvedValue(user),
    };
    users.createQueryBuilder.mockReturnValue(qb);
    return qb;
  }

  describe('register', () => {
    it('luôn tạo CUSTOMER, kể cả DTO có role (DTO không nhận role nên TS cũng chặn)', async () => {
      const res = await service.register({
        email: '  NEW@Shop.Dev ',
        password: 'MatKhau@123',
        fullName: ' New ',
      });
      expect(users.create).toHaveBeenCalledWith(
        expect.objectContaining({ email: 'new@shop.dev', role: 'customer' }),
      );
      expect(res.accessToken).toBeTruthy();
      expect(res.refreshToken).toBeTruthy();
      expect(tokens.insert).toHaveBeenCalledTimes(1);
    });

    it('email trùng -> 409, không ký token', async () => {
      users.findOne.mockResolvedValue(makeUser());
      await expect(
        service.register({
          email: 'a@b.c',
          password: 'MatKhau@123',
          fullName: 'Ab',
        }),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(tokens.insert).not.toHaveBeenCalled();
    });
  });

  describe('login', () => {
    it('đúng password -> cặp token + user', async () => {
      mockLoginUser(makeUser());
      const res = await service.login({
        email: 'a@b.c',
        password: 'MatKhau@123',
      });
      expect(res.accessToken).toBeTruthy();
      expect(res.user).not.toHaveProperty('password');
    });

    it.each([
      ['không có user', null, 'MatKhau@123'],
      ['sai password', makeUser(), 'Sai@12345'],
      ['bị khóa isActive=false', makeUser({ isActive: false }), 'MatKhau@123'],
    ])('%s -> cùng 1 message 401 (chống enumeration)', async (_c, user, pw) => {
      mockLoginUser(user);
      const err = await service
        .login({ email: 'a@b.c', password: pw })
        .catch((e: unknown) => e);
      expect(err).toBeInstanceOf(UnauthorizedException);
      expect((err as UnauthorizedException).message).toBe(
        'Email hoặc mật khẩu không đúng',
      );
    });
  });

  describe('refresh (rotation)', () => {
    it('token hợp lệ -> revoke cũ + cấp cặp mới', async () => {
      const user = makeUser();
      mockLoginUser(user);
      const { refreshToken: r1 } = await service.login({
        email: 'a@b.c',
        password: 'MatKhau@123',
      });
      const row = {
        id: 'rt-1',
        userId: 'user-1',
        tokenHash: hashToken(r1),
        expiresAt: new Date(Date.now() + 3600_000),
        revokedAt: null,
      };
      tokens.findOne.mockResolvedValue(row);
      users.findOne.mockResolvedValue(user);

      const pair2 = await service.refresh(r1);
      expect(pair2.refreshToken).not.toBe(r1); // token mới khác token cũ
      expect(row.revokedAt).not.toBeNull(); // cũ bị revoke
      expect(tokens.save).toHaveBeenCalled();
      expect(tokens.insert).toHaveBeenCalledTimes(2); // login + refresh
    });

    it('dùng lại token ĐÃ revoke -> revoke TOÀN BỘ + 401 (reuse detection)', async () => {
      mockLoginUser(makeUser());
      const { refreshToken: r1 } = await service.login({
        email: 'a@b.c',
        password: 'MatKhau@123',
      });
      tokens.findOne.mockResolvedValue({
        id: 'rt-1',
        userId: 'user-1',
        tokenHash: hashToken(r1),
        expiresAt: new Date(Date.now() + 3600_000),
        revokedAt: new Date(), // đã revoke từ lần refresh trước
      });

      await expect(service.refresh(r1)).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
      // revokeAll = update mọi row còn hiệu lực của user
      expect(tokens.update).toHaveBeenCalledWith(
        expect.objectContaining({ userId: 'user-1' }),
        expect.objectContaining({ revokedAt: expect.any(Date) }),
      );
    });

    it('chữ ký sai / type=access -> 401', async () => {
      await expect(service.refresh('khong-phai-jwt')).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
      // ký access payload bằng refresh secret rồi đem refresh -> type sai
      const fakeAccess = await jwt.signAsync(
        { sub: 'user-1', type: 'access' },
        { secret: TEST_CFG.refreshSecret },
      );
      await expect(service.refresh(fakeAccess)).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
    });
  });

  describe('logout', () => {
    it('idempotent: token lạ cũng 200, không throw', async () => {
      await expect(
        service.logout('user-1', 'no-such-token'),
      ).resolves.toBeUndefined();
      expect(tokens.update).toHaveBeenCalled();
    });
  });
});
