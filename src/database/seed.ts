import type { DataSource } from 'typeorm';
import { User, UserRole } from '../modules/users/user.entity.js';
import { hashPassword } from '../modules/users/password.util.js';

// Seed = chèn dữ liệu nền (admin đầu tiên) vào DB TRƯỚC khi app chạy.
// (= insert-data.sql / CommandLineRunner của Spring).
//
// IDEMPOTENT: chạy 10 lần vẫn chỉ có 1 admin — chèn kiểu INSERT ... ON CONFLICT
// hoặc check trước. Script seed PHẢI idempotent vì sẽ chạy lại mỗi lần deploy dev.
export async function seedAdmin(dataSource: DataSource): Promise<void> {
  const email = process.env.SEED_ADMIN_EMAIL ?? 'admin@shop-mini.dev';
  const name = process.env.SEED_ADMIN_NAME ?? 'Administrator';
  const password = process.env.SEED_ADMIN_PASSWORD ?? 'Admin@123';

  const repo = dataSource.getRepository(User);
  const exists = await repo.findOne({ where: { email } });
  if (exists) {
    console.log(`[seed] admin đã tồn tại: ${email} — bỏ qua`);
    return;
  }

  if (password === 'Admin@123') {
    console.warn('[seed] ĐANG DÙNG MẬT KHẨU MẶC ĐỊNH! Đổi SEED_ADMIN_PASSWORD ở .env trước khi deploy.');
  }

  await repo.insert({
    email,
    fullName: name,
    passwordHash: hashPassword(password),
    role: UserRole.ADMIN,
    isActive: true,
  });
  console.log(`[seed] đã tạo admin: ${email}`);
}
