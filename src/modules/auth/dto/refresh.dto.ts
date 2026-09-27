import { IsJWT, IsString } from 'class-validator';

// Refresh token là JWT ký bằng REFRESH secret (khác access secret) nên
// @IsJWT bắt đúng định dạng xxx.yyy.zzz trước khi service verify chữ ký.
export class RefreshDto {
  @IsString()
  @IsJWT()
  refreshToken!: string;
}
