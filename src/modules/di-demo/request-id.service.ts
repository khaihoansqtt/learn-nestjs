import { Inject, Injectable, Scope } from '@nestjs/common';
import { REQUEST } from '@nestjs/core';
import type { Request } from 'express';

// REQUEST scope = mỗi HTTP request là 1 instance mới.
// (= Spring @RequestScope — dùng để giữ request-id, user-context, tenant...).
// CẢNH BÁO QUAN TRỌNG: bất kỳ Singleton nào inject Request-scoped provider
// cũng BỊ LAN TRUYỀN thành request-scoped (controller dưới đây là ví dụ).
// Vì vậy đừng inject request-scoped vào service dùng chung toàn app.
@Injectable({ scope: Scope.REQUEST })
export class RequestIdService {
  readonly requestId: string;

  constructor(@Inject(REQUEST) req: Request) {
    const header = req.headers['x-request-id'];
    const fromHeader = Array.isArray(header) ? header[0] : header;
    this.requestId =
      fromHeader && fromHeader.length > 0
        ? fromHeader
        : `req-${Math.random().toString(36).slice(2, 10)}`;
  }
}
