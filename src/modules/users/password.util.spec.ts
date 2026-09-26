import { describe, expect, it } from 'vitest';
import { hashPassword, verifyPassword } from './password.util.js';

describe('password.util', () => {
  // M5 (auth) sẽ build login/refresh hoàn toàn trên 2 hàm này —
  // test sớm để chắc format hash không hỏng giữa chừng.
  it('hash rồi verify đúng mật khẩu', () => {
    const stored = hashPassword('Admin@123');
    expect(stored).toMatch(/^scrypt\$[0-9a-f]{32}\$[0-9a-f]{128}$/);
    expect(verifyPassword('Admin@123', stored)).toBe(true);
  });

  it('sai mật khẩu thì false', () => {
    const stored = hashPassword('Admin@123');
    expect(verifyPassword('Admin@124', stored)).toBe(false);
  });

  it('cùng mật khẩu vẫn ra hash khác nhau (salt ngẫu nhiên)', () => {
    expect(hashPassword('Admin@123')).not.toBe(hashPassword('Admin@123'));
  });

  it('format lưu bị hỏng thì false, không throw', () => {
    expect(verifyPassword('x', '')).toBe(false);
    expect(verifyPassword('x', 'bcrypt$salt$hash')).toBe(false);
    expect(verifyPassword('x', 'scrypt$onlysalt')).toBe(false);
    expect(verifyPassword('x', 'scrypt$abc$zzzz')).toBe(false);
  });
});
