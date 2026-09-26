import { InitUsers1790380800000 } from './1790380800000-InitUsers.js';

// Danh sách migration, SẮP XẾP TĂNG DẦN theo timestamp (TypeORM tự sắp
// lại theo tên class, nhưng giữ thứ tự file cho dễ đọc).
// Cũng là single source of truth: app (nếu bật migrationsRun) và CLI đều đọc đây.
export const MIGRATIONS = [InitUsers1790380800000];
