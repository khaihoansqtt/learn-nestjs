import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

// Sort whitelist như M4 — nối string từ query vào ORDER BY là SQL injection.
export const PRODUCT_SORT_FIELDS = [
  'createdAt',
  'updatedAt',
  'name',
  'price',
] as const;
export type ProductSortField = (typeof PRODUCT_SORT_FIELDS)[number];

const toBool = ({ value }: { value: unknown }): boolean =>
  value === true || value === 'true';

export class ListProductsDto {
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

  @IsOptional()
  @IsString()
  @MaxLength(100)
  q?: string;

  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  minPrice?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  maxPrice?: number;

  @IsOptional()
  @Transform(toBool)
  @IsBoolean()
  isActive?: boolean;

  // inStock=true -> stock > 0 (lọc "còn hàng" cho storefront).
  @IsOptional()
  @Transform(toBool)
  @IsBoolean()
  inStock?: boolean;

  @IsOptional()
  @Transform(toBool)
  @IsBoolean()
  includeDeleted?: boolean;

  @IsOptional()
  @IsIn(PRODUCT_SORT_FIELDS)
  sort?: ProductSortField = 'createdAt';

  @IsOptional()
  @IsIn(['asc', 'desc'])
  order?: 'asc' | 'desc' = 'desc';
}
