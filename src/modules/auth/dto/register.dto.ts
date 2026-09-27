import { IsEmail, IsString, MaxLength, MinLength } from 'class-validator';

// Đăng ký công khai — KHÔNG có field role: mọi tài khoản tự đăng ký đều là
// customer. Muốn admin phải nhờ admin có sẵn tạo qua POST /users (M5 đóng
// lỗ tự phong admin của M4: gửi {"role":"admin"} ở đây -> 400 vì
// forbidNonWhitelisted, không phải bị ignore thầm).
export class RegisterDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(8)
  @MaxLength(128)
  password!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(120)
  fullName!: string;
}
