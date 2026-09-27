import { IsEmail, IsEnum, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { UserRole } from '../user.entity.js';

// DTO tạo user — TUYỆT ĐỐI không nhận passwordHash/createdAt từ client
// (whitelist + forbidNonWhitelisted của M2 đã chặn field lạ).
// (= Spring CreateUserRequest + @NotBlank/@Email)
export class CreateUserDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(8, { message: 'password phải ít nhất 8 ký tự' })
  // 128 là trần chống DoS CPU (scrypt tốn CPU theo input), KHÔNG phải giới
  // hạn thuật toán — scrypt nhận input dài tùy ý (khác bcrypt kẹt ở 72 byte).
  @MaxLength(128)
  password!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(120)
  fullName!: string;

  // Không cho client tự phong admin ở đây: M5 (auth/RBAC) sẽ xử lý
  // role nghiêm ngặt hơn — tạm thời chấp nhận để seed/demo.
  @IsOptional()
  @IsEnum(UserRole)
  role?: UserRole;
}
