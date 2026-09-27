import { Transform } from 'class-transformer';
import { IsBoolean, IsOptional } from 'class-validator';
import { PartialType } from '@nestjs/mapped-types';
import { CreateUserDto } from './create-user.dto.js';

// PartialType = "mọi field của Create đều optional" — không phải copy-paste
// thủ công rồi lệch rule khi thêm field.
// (= Spring: dùng chung entity/DTO với @PatchMapping + JSON merge patch)
export class UpdateUserDto extends PartialType(CreateUserDto) {
  // isActive KHÔNG có trong Create (user mới luôn active) nhưng update CẦN:
  // khóa tài khoản mà không xóa là nghiệp vụ thật (ban/suspend).
  // BẪY query-string "false"->true (M4) cũng áp ở body JSON? Không — JSON body
  // giữ đúng kiểu boolean, nhưng client gửi "false" string vẫn lọt IsBoolean
  // fail -> 400 rõ ràng. @Transform ở đây để nhận cả 2 dạng cho chắc.
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    value === true || value === 'true' ? true : value === false || value === 'false' ? false : value,
  )
  @IsBoolean()
  isActive?: boolean;
}
