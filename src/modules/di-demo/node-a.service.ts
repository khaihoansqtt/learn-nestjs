import { forwardRef, Inject, Injectable } from '@nestjs/common';
import { NodeBService } from './node-b.service.js';

// Demo circular dependency A <-> B.
// Spring gỡ bằng proxy/3-level cache; Nest yêu cầu forwardRef() EXPLICIT ở cả 2 phía
// để container biết trì hoãn resolve.
// Thực tế dự án: circular là mùi thiết kế — nên tách service thứ 3 hoặc đảo chiều dependency.
// Ở đây giữ lại để bạn thấy cách Nest xử lý khi bắt buộc phải circular.
//
// LƯU Ý ESM: param được typed là `any` (thay vì NodeBService) để TypeScript KHÔNG emit
// `design:paramtypes` tham chiếu trực tiếp class vòng tròn — với ESM ("type": "module")
// việc đó gây `ReferenceError: Cannot access before initialization` ngay lúc load file.
// forwardRef closure vẫn giữ runtime reference nhưng chỉ được gọi LAZY sau khi cả 2 file
// đã load xong, nên an toàn. Muốn type-safe thì cast qua `InstanceType<typeof NodeBService>`
// tại chỗ dùng (xem ping()).
@Injectable()
export class NodeAService {
  constructor(
    @Inject(forwardRef(() => NodeBService))
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    private readonly nodeB: any,
  ) {}

  ping(): string {
    const b = this.nodeB as InstanceType<typeof NodeBService>;
    return `node-a -> ${b.pong()}`;
  }
}
