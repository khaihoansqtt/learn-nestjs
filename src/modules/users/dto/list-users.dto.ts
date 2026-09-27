import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { UserRole } from '../user.entity.js';

// Sort whitelist — KHÔNG bao giờ nối string từ query thẳng vào ORDER BY
// (SQL injection kinh điển). Chỉ 4 cột được phép, map sang tên đã chốt.
export const USER_SORT_FIELDS = [
  'createdAt',
  'updatedAt',
  'fullName',
  'email',
] as const;
export type UserSortField = (typeof USER_SORT_FIELDS)[number];

const toBool = ({ value }: { value: unknown }): boolean =>
  value === true || value === 'true';

// Query DTO cho GET /api/users — phân trang + filter + sort kiểu Spring Pageable.
export class ListUsersDto {
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

  // Tìm gần đúng trong email + fullName (ILIKE %q%)
  @IsOptional()
  @IsString()
  @MaxLength(100)
  q?: string;

  @IsOptional()
  @IsEnum(UserRole)
  role?: UserRole;

  // BẪY: enableImplicitConversion của ValidationPipe biến "false" -> true
  // (Boolean("false") === true). Phải transform tường minh.
  @IsOptional()
  @Transform(toBool)
  @IsBoolean()
  isActive?: boolean;

  // true -> hiển thị cả user đã xóa mềm (withDeleted)
  @IsOptional()
  @Transform(toBool)
  @IsBoolean()
  includeDeleted?: boolean;

  @IsOptional()
  @IsIn(USER_SORT_FIELDS)
  sort?: UserSortField = 'createdAt';

  @IsOptional()
  @IsIn(['asc', 'desc'])
  order?: 'asc' | 'desc' = 'desc';
}
