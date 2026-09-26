import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';

// Hash password bằng scrypt của Node (built-in, không thêm dependency).
// Format lưu DB: scrypt$<salt hex>$<hash hex>
// Sang M5 (auth) sẽ cân nhắc chuyển sang argon2id/bcrypt — lúc đó chỉ đổi
// 2 hàm này, mọi nơi gọi không đổi (Strategy pattern tự nhiên).
export function hashPassword(plain: string): string {
  const salt = randomBytes(16).toString('hex');
  const hash = scryptSync(plain, salt, 64).toString('hex');
  return `scrypt$${salt}$${hash}`;
}

export function verifyPassword(plain: string, stored: string): boolean {
  const [scheme, salt, hash] = stored.split('$');
  if (scheme !== 'scrypt' || !salt || !hash) return false;
  const candidate = scryptSync(plain, salt, 64);
  const expected = Buffer.from(hash, 'hex');
  // So sánh bằng timingSafeEqual để không rò rỉ thời gian qua side-channel.
  return candidate.length === expected.length && timingSafeEqual(candidate, expected);
}
