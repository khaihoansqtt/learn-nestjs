import { PartialType } from '@nestjs/mapped-types';
import { CreateUserDto } from './create-user.dto.js';

// PartialType = "mọi field của Create đều optional" — không phải copy-paste
// thủ công rồi lệch rule khi thêm field.
// (= Spring: dùng chung entity/DTO với @PatchMapping + JSON merge patch)
export class UpdateUserDto extends PartialType(CreateUserDto) {}
