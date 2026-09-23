import {
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

// DTO cho JSON body — sai là 400 với message mảng string,
// HttpExceptionFilter chuẩn hóa tiếp thành error envelope.
export class EchoBodyDto {
  @IsString()
  @MinLength(2)
  @MaxLength(50)
  name!: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(150)
  age?: number;
}
