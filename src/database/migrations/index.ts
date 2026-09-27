import { InitUsers1790380800000 } from './1790380800000-InitUsers.js';
import { RefreshTokens1790515683304 } from './1790515683304-RefreshTokens.js';
import { CategoriesProducts1790519937930 } from './1790519937930-CategoriesProducts.js';

// Danh sách migration, SẮP XẾP TĂNG DẦN theo timestamp (TypeORM tự sắp
// lại theo tên class, nhưng giữ thứ tự file cho dễ đọc).
// Cũng là single source of truth: app (nếu bật migrationsRun) và CLI đều đọc đây.
export const MIGRATIONS = [
  InitUsers1790380800000,
  RefreshTokens1790515683304,
  CategoriesProducts1790519937930,
];
