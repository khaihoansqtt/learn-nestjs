import { Injectable, Scope } from '@nestjs/common';

// TRANSIENT = mỗi ĐIỂM INJECT là 1 instance mới.
// (= Spring @Scope("prototype"), nhưng khác chi tiết: Spring prototype là mỗi lần getBean,
// Nest transient là mỗi consumer/injection-point).
// Dùng cho state ngắn hạn theo consumer (counter, builder...), KHÔNG dùng cho service có DB connection.
@Injectable({ scope: Scope.TRANSIENT })
export class TransientCounterService {
  readonly instanceId = `transient-${Math.random().toString(36).slice(2, 8)}`;
  private count = 0;

  bump(): number {
    this.count += 1;
    return this.count;
  }
}
