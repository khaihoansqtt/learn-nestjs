// Slug hóa tên sản phẩm/danh mục cho URL thân thiện:
// 'Cà Phê Sữa Đá 500g!' -> 'ca-phe-sua-da-500g'
// Dùng cho cột slug UNIQUE — URL ổn định, SEO, không lộ id.
// normalize('NFD') tách dấu tiếng Việt thành base + combining mark rồi
// strip mark (đ + Đ xử lý riêng vì không tách được).
export function slugify(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/đ/g, 'd')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 140);
}
