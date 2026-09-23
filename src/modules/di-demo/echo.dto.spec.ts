import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { describe, expect, it } from 'vitest';
import { EchoBodyDto } from './echo-body.dto.js';
import { EchoQueryDto } from './echo-query.dto.js';

// Test DTO độc lập với HTTP — kiểm tra decorator viết đúng trước khi
// ValidationPipe áp dụng chúng ở runtime.
describe('Echo DTOs (validation)', () => {
  it('query hợp lệ: default page/limit, "2" -> 2 sau transform', async () => {
    const dto = plainToInstance(EchoQueryDto, { search: 'phone' });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
    expect(dto.page).toBe(1);
    expect(dto.limit).toBe(10);
  });

  it('query sai: limit=999 báo lỗi Max', async () => {
    const dto = plainToInstance(EchoQueryDto, { limit: 999 });
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].property).toBe('limit');
    expect(errors[0].constraints).toHaveProperty('max');
  });

  it('body sai: name 1 ký tự báo lỗi MinLength', async () => {
    const dto = plainToInstance(EchoBodyDto, { name: 'a' });
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].constraints).toHaveProperty('minLength');
  });

  it('body đúng: age optional, qua được khi thiếu', async () => {
    const dto = plainToInstance(EchoBodyDto, { name: 'Khai Hoan' });
    expect(await validate(dto)).toHaveLength(0);
  });
});
