import { IsEmail, IsString } from 'class-validator';

// Login KHÔNG validate độ dài password: user cũ có password hợp lệ lúc tạo,
// login phải chấp nhận đúng password đó dù policy sau này đổi. Validate
// minLength ở login chỉ giúp attacker biết policy, không giúp gì.
// Message lỗi login luôn CHUNG ("email hoặc mật khẩu không đúng") để chống
// user-enumeration (xem auth.service).
export class LoginDto {
  @IsEmail()
  email!: string;

  @IsString()
  password!: string;
}
