import { describe, expect, it } from 'vitest';
import { instanceToPlain } from 'class-transformer';
import { User, UserRole } from './user.entity.js';

// Chứng minh tầng phòng thủ #2 (@Exclude + ClassSerializerInterceptor):
// KỂ CẢ khi passwordHash đã load vào entity (ví dụ M5 addSelect để verify
// login), serialize ra JSON vẫn loại nó. e2e không chứng minh được điều này
// vì select:false khiến hash chưa bao giờ rời DB.
function userWithHashLoaded(): User {
  const u = new User();
  u.id = 'id-1';
  u.email = 'a@b.c';
  u.passwordHash = 'scrypt$saltsalt$hashhash';
  u.fullName = 'Test';
  u.role = UserRole.CUSTOMER;
  u.isActive = true;
  u.deletedAt = null;
  return u;
}

describe('User serialization (@Exclude)', () => {
  it('entity đơn -> mất passwordHash', () => {
    const plain = instanceToPlain(userWithHashLoaded());
    expect(plain).not.toHaveProperty('passwordHash');
    expect(plain).toMatchObject({ id: 'id-1', email: 'a@b.c' });
  });

  it('entity lồng trong envelope { data } (đúng thứ tự Transform -> Serializer) -> mất passwordHash', () => {
    const plain = instanceToPlain({ data: userWithHashLoaded() }) as {
      data: Record<string, unknown>;
    };
    expect(plain.data).not.toHaveProperty('passwordHash');
  });

  it('mảng items trong Page -> mất passwordHash ở mọi phần tử', () => {
    const plain = instanceToPlain({
      data: { items: [userWithHashLoaded()], total: 1 },
    }) as { data: { items: Array<Record<string, unknown>> } };
    expect(plain.data.items).toHaveLength(1);
    expect(plain.data.items[0]).not.toHaveProperty('passwordHash');
  });
});
