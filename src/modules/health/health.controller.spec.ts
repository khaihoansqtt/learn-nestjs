import { describe, expect, it } from 'vitest';
import { describeError } from './health.controller.js';

describe('describeError', () => {
  // Bắt thật: Node ném AggregateError.message = '' khi TCP connect fail
  // (thử ::1 rồi 127.0.0.1) — nếu trả thẳng thì client nhận message [""].
  it('đào message từ AggregateError khi message rỗng', () => {
    const inner = new Error('connect ECONNREFUSED ::1:5432');
    const agg = new AggregateError([inner], '');
    expect(describeError(agg)).toBe('connect ECONNREFUSED ::1:5432');
  });

  it('giữ nguyên message lỗi thường', () => {
    expect(describeError(new Error('boom'))).toBe('boom');
  });

  it('không phải Error vẫn trả message cố định', () => {
    expect(describeError('oops')).toBe('database unreachable');
    expect(describeError(undefined)).toBe('database unreachable');
  });

  it('AggregateError rỗng hết thì rơi về tên lỗi', () => {
    const agg = new AggregateError([], '');
    expect(describeError(agg)).toBe('AggregateError');
  });
});
