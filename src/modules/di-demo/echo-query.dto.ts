import { Type } from 'class-transformer';
import {
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

// DTO cho query string — ValidationPipe global (transform: true) tự:
// - biến "2" -> 2 (implicit conversion),
// - strip field thừa (whitelist) và 400 khi có field lạ (forbidNonWhitelisted).
// (= Spring @ModelAttribute + @Min/@Max Bean Validation)
export class EchoQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(50)
  search?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 10;
}
