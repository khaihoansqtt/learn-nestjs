import { QueryFailedError } from 'typeorm';

// Mã lỗi Postgres hay gặp — bắt bằng CODE, không so message
// (message đổi theo locale/phiên bản, code SQLSTATE thì ổn định).
// 23505 = unique_violation (đăng ký trùng) -> 409
// 23503 = foreign_key_violation (FK trỏ tới dòng không có / xóa cha còn con) -> 404/409
export function isUniqueViolation(err: unknown): boolean {
  return (
    err instanceof QueryFailedError &&
    (err as QueryFailedError & { code?: string }).code === '23505'
  );
}

export function isFkViolation(err: unknown): boolean {
  return (
    err instanceof QueryFailedError &&
    (err as QueryFailedError & { code?: string }).code === '23503'
  );
}
