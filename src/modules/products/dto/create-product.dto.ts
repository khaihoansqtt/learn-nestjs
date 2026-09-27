import {
  IsBoolean,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

// price: @IsNumber (không phải IsInt) + tối đa 2 thập phân, khớp numeric(12,2).
// stock: số nguyên >= 0. categoryId: UUID bắt buộc — product mồ côi danh mục
// là dữ liệu rác (service check tồn tại, FK RESTRICT chốt chặn).
export class CreateProductDto {
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(220)
  slug?: string;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  description?: string;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(9999999999.99)
  price!: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  stock?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsUUID()
  categoryId!: string;
}
