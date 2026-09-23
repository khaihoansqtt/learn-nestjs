import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { map, Observable } from 'rxjs';
import { RESPONSE_META_KEY } from '../decorators/response-meta.decorator.js';

export interface ApiResponse<T> {
  data: T;
  meta?: Record<string, unknown>;
}

// Interceptor global — bọc MỌI response thành công về 1 envelope { data, meta? }.
// (= Spring ResponseBodyAdvice). Controller chỉ return data thô, không tự bọc.
// LƯU Ý: interceptor KHÔNG chạy khi handler ném lỗi — lỗi đi qua Filter (§ filters).
@Injectable()
export class TransformInterceptor<T>
  implements NestInterceptor<T, ApiResponse<T>>
{
  constructor(private readonly reflector: Reflector) {}

  intercept(
    context: ExecutionContext,
    next: CallHandler<T>,
  ): Observable<ApiResponse<T>> {
    const handler = context.getHandler();
    const controller = context.getClass();
    const meta = this.reflector.getAllAndOverride<
      Record<string, unknown> | undefined
    >(RESPONSE_META_KEY, [handler, controller]);

    return next
      .handle()
      .pipe(map((data) => ({ data, ...(meta ? { meta } : {}) })));
  }
}
