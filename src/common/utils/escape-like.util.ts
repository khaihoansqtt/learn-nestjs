// Escape ký tự đặc biệt của LIKE (%, _, \) trong từ khóa tìm kiếm.
// Query đã parameterized nên không SQLi, nhưng không escape thì user gõ '%'
// sẽ match TẤT CẢ dòng (LIKE-pattern injection). Postgres LIKE mặc định
// lấy backslash làm ký tự escape nên không cần thêm ESCAPE clause.
export function escapeLike(raw: string): string {
  return raw.replace(/[\\%_]/g, (m) => `\\${m}`);
}
