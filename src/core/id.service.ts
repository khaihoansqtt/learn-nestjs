import { Injectable } from '@nestjs/common';

// Singleton mặc định (giống Spring singleton bean).
// instanceId chứng minh mọi nơi inject đều nhận CÙNG 1 object.
let globalCounter = 0;

@Injectable()
export class IdService {
  readonly instanceId = `id-service-${Math.random().toString(36).slice(2, 8)}`;

  next(prefix = 'id'): string {
    globalCounter += 1;
    return `${prefix}-${globalCounter}`;
  }
}
