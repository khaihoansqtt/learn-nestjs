import { forwardRef, Inject, Injectable } from '@nestjs/common';
import { NodeAService } from './node-a.service.js';

// Xem giải thích ESM trong node-a.service.ts: param typed `any` để tránh
// emitDecoratorMetadata tham chiếu class vòng tròn lúc load file.
@Injectable()
export class NodeBService {
  constructor(
    @Inject(forwardRef(() => NodeAService))
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    private readonly nodeA: any,
  ) {}

  pong(): string {
    return 'node-b-pong';
  }

  whoDependsOnMe(): string {
    const a = this.nodeA as InstanceType<typeof NodeAService> | undefined;
    return a ? 'node-a' : 'nobody';
  }
}
