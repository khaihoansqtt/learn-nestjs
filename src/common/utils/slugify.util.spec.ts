import { describe, expect, it } from 'vitest';
import { slugify } from './slugify.util.js';

describe('slugify', () => {
  it.each([
    ['Cà Phê Sữa Đá', 'ca-phe-sua-da'],
    ['  Áo Thun   Nam 500g! ', 'ao-thun-nam-500g'],
    ['Đường & Muối', 'duong-muoi'],
    ['iPhone 17 Pro Max', 'iphone-17-pro-max'],
    ['---rác___rác---', 'rac-rac'],
  ])('%s -> %s', (raw, expected) => {
    expect(slugify(raw)).toBe(expected);
  });

  it('chuỗi toàn ký tự đặc biệt -> rỗng (service phải reject, không lưu slug rỗng)', () => {
    expect(slugify('!!!')).toBe('');
  });
});
