import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import type { Request, Response } from 'express';

export interface ErrorEnvelope {
  statusCode: number;
  message: string[];
  error: string;
  path: string;
  timestamp: string;
  requestId: string;
}

// Filter global — MỌI exception văng ra khỏi handler đều qua đây trước khi tới client.
// (= Spring @RestControllerAdvice + @ExceptionHandler).
// Chuẩn hóa 3 nguồn lỗi về 1 envelope:
// 1. HttpException (NotFound, BadRequest từ ValidationPipe...) — giữ status + message gốc
// 2. Lỗi lập trình / DB (TypeError, QueryFailedError...) — che thành 500, không lộ stack
function toMessages(payload: unknown): string[] {
  if (typeof payload === 'string') return [payload];
  if (
    typeof payload === 'object' &&
    payload !== null &&
    'message' in payload &&
    (payload as { message: unknown }).message !== undefined
  ) {
    const m = (payload as { message: unknown }).message;
    return Array.isArray(m) ? m.map(String) : [String(m)];
  }
  return ['Internal server error'];
}

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const req = ctx.getRequest<
      Request & { id?: string | number }
    >();
    const res = ctx.getResponse<Response>();

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;
    const payload =
      exception instanceof HttpException ? exception.getResponse() : undefined;

    const header = req.headers['x-request-id'];
    const requestId =
      (Array.isArray(header) ? header[0] : header) ||
      String(req.id ?? `req-${Date.now().toString(36)}`);

    const body: ErrorEnvelope = {
      statusCode: status,
      message: toMessages(payload),
      error:
        status === HttpStatus.INTERNAL_SERVER_ERROR
          ? 'Internal Server Error'
          : HttpStatus[status] !== undefined
            ? String(HttpStatus[status])
            : 'Error',
      path: req.url,
      timestamp: new Date().toISOString(),
      requestId,
    };

    res.status(status).json(body);
  }
}
