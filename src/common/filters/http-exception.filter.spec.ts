import type { ArgumentsHost } from '@nestjs/common';
import { HttpException, HttpStatus } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { HttpExceptionFilter } from './http-exception.filter.js';

function mockHost(url = '/api/di-demo/echo', headers: Record<string, string> = {}) {
  const json = vi.fn();
  const status = vi.fn().mockReturnValue({ json });
  const res = { status };
  const host = {
    switchToHttp: () => ({
      getRequest: () => ({ url, headers, id: 'pino-req-id' }),
      getResponse: () => res,
    }),
  } as unknown as ArgumentsHost;
  return { host, res, json, status };
}

describe('HttpExceptionFilter', () => {
  it('chuẩn hóa HttpException 404 về error envelope', () => {
    const { host, json, status } = mockHost('/api/nope', {
      'x-request-id': 'demo-1',
    });
    new HttpExceptionFilter().catch(
      new HttpException('Not found', HttpStatus.NOT_FOUND),
      host,
    );

    expect(status).toHaveBeenCalledWith(404);
    expect(json).toHaveBeenCalledOnce();
    const body = json.mock.calls[0][0];
    expect(body).toMatchObject({
      statusCode: 404,
      message: ['Not found'],
      path: '/api/nope',
      requestId: 'demo-1',
    });
    expect(typeof body.timestamp).toBe('string');
  });

  it('che lỗi lập trình thành 500, không lộ stack', () => {
    const { host, json, status } = mockHost();
    new HttpExceptionFilter().catch(new TypeError('db exploded'), host);

    expect(status).toHaveBeenCalledWith(500);
    const body = json.mock.calls[0][0];
    expect(body.statusCode).toBe(500);
    expect(body.error).toBe('Internal Server Error');
    expect(JSON.stringify(body)).not.toContain('db exploded');
  });

  it('giữ mảng message của ValidationPipe (400)', () => {
    const { host, json } = mockHost();
    const bad = new HttpException(
      {
        statusCode: 400,
        message: ['limit must not be greater than 100', 'page must be an integer'],
        error: 'Bad Request',
      },
      400,
    );
    new HttpExceptionFilter().catch(bad, host);

    expect(json.mock.calls[0][0].message).toEqual([
      'limit must not be greater than 100',
      'page must be an integer',
    ]);
  });
});
