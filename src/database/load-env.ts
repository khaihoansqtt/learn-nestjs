import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

// Tải .env kiểu minimal KHÔNG cần dependency dotenv.
// Áp đúng thứ tự của ConfigModule trong app: .env thắng .env.example,
// biến đã có trong process.env không bị ghi đè (12-factor: env thực tế luôn thắng file).
// Dùng riêng cho CLI (migration/seed) chạy ngoài Nest container.
export function loadEnv(): void {
  for (const file of ['.env', '.env.example']) {
    const path = resolve(process.cwd(), file);
    if (!existsSync(path)) continue;
    for (const line of readFileSync(path, 'utf8').split(/\r?\n/)) {
      if (!line || line.trimStart().startsWith('#')) continue;
      const eq = line.indexOf('=');
      if (eq === -1) continue;
      const key = line.slice(0, eq).trim();
      const value = line.slice(eq + 1).trim().replace(/^["']|["']$/g, '');
      if (process.env[key] === undefined) process.env[key] = value;
    }
  }
}
