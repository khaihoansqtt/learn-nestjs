import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { beforeEach, describe, expect, it } from 'vitest';
import { DEV_ACCESS_SECRET } from '../../../config/auth.config.js';
import { UserRole } from '../../users/user.entity.js';
import { JwtAuthGuard } from './jwt-auth.guard.js';
import { RolesGuard } from './roles.guard.js';

// Mock ExecutionContext tối thiểu — guard chỉ đọc handler/class (reflector)
// và request (switchToHttp). Không cần cả Nest app.
function mockContext(opts: {
  handlerMeta?: Record<string, unknown>;
  classMeta?: Record<string, unknown>;
  headers?: Record<string, string>;
}) {
  const req = { headers: opts.headers ?? {}, user: undefined as unknown };
  return {
    req,
    context: {
      getHandler: () => ({}) ,
      getClass: () => ({}),
      switchToHttp: () => ({ getRequest: () => req }),
    } as never,
    reflector: {
      getAllAndOverride: (key: string) =>
        opts.handlerMeta?.[key] ?? opts.classMeta?.[key],
    } as never,
  };
}

const CFG = {
  accessSecret: DEV_ACCESS_SECRET,
  refreshSecret: 'x',
  accessTtlSec: 900,
  refreshTtlSec: 604800,
} as never;

describe('JwtAuthGuard', () => {
  let guard: JwtAuthGuard;
  let jwt: JwtService;

  beforeEach(() => {
    jwt = new JwtService({});
    guard = new JwtAuthGuard(new Reflector(), jwt, CFG);
  });

  it('@Public -> qua luôn, không cần token', async () => {
    const { context, reflector } = mockContext({
      handlerMeta: { 'auth.is-public': true },
    });
    guard = new JwtAuthGuard(reflector as never, jwt, CFG);
    await expect(guard.canActivate(context)).resolves.toBe(true);
  });

  it('thiếu header Authorization -> 401', async () => {
    const { context, reflector } = mockContext({});
    guard = new JwtAuthGuard(reflector as never, jwt, CFG);
    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('Bearer access hợp lệ -> gắn req.user', async () => {
    const token = await jwt.signAsync(
      { sub: 'u1', email: 'a@b.c', role: 'customer', type: 'access' },
      { secret: DEV_ACCESS_SECRET, expiresIn: 900 },
    );
    const { context, reflector, req } = mockContext({
      headers: { authorization: `Bearer ${token}` },
    });
    guard = new JwtAuthGuard(reflector as never, jwt, CFG);
    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(req.user).toMatchObject({ id: 'u1', role: 'customer' });
  });

  it('token hết hạn -> 401 message hết hạn (để client refresh)', async () => {
    const token = await jwt.signAsync(
      { sub: 'u1', type: 'access' },
      { secret: DEV_ACCESS_SECRET, expiresIn: -10 },
    );
    const { context, reflector } = mockContext({
      headers: { authorization: `Bearer ${token}` },
    });
    guard = new JwtAuthGuard(reflector as never, jwt, CFG);
    const err = await guard
      .canActivate(context)
      .catch((e: unknown) => e as Error);
    expect(err).toBeInstanceOf(UnauthorizedException);
    expect(err.message).toContain('hết hạn');
  });

  it('chữ ký sai -> 401', async () => {
    const { context, reflector } = mockContext({
      headers: { authorization: 'Bearer a.b.c' },
    });
    guard = new JwtAuthGuard(reflector as never, jwt, CFG);
    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });
});

describe('RolesGuard', () => {
  it('không có @Roles -> qua (chỉ cần đăng nhập)', () => {
    const { context, reflector, req } = mockContext({});
    req.user = { id: 'u1', email: 'a@b.c', role: UserRole.CUSTOMER };
    const guard = new RolesGuard(reflector as never);
    expect(guard.canActivate(context)).toBe(true);
  });

  it('role khớp -> qua', () => {
    const { context, reflector, req } = mockContext({
      handlerMeta: { 'auth.roles': [UserRole.ADMIN] },
    });
    req.user = { id: 'u1', email: 'a@b.c', role: UserRole.ADMIN };
    const guard = new RolesGuard(reflector as never);
    expect(guard.canActivate(context)).toBe(true);
  });

  it('role không khớp -> 403 kèm role yêu cầu', () => {
    const { context, reflector, req } = mockContext({
      handlerMeta: { 'auth.roles': [UserRole.ADMIN] },
    });
    req.user = { id: 'u1', email: 'a@b.c', role: UserRole.CUSTOMER };
    const guard = new RolesGuard(reflector as never);
    const err = (() => {
      try {
        guard.canActivate(context);
        return null;
      } catch (e) {
        return e as Error;
      }
    })();
    expect(err).toBeInstanceOf(ForbiddenException);
    expect(err!.message).toContain('admin');
  });
});
