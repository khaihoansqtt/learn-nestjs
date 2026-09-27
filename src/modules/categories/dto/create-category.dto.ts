import { IsOptional, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';

// parentId: UUID danh mục cha, hoặc bỏ trống = danh mục gốc.
// Service check: cha phải tồn tại + không tự làm cha chính mình (update).
export class CreateCategoryDto {
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name!: string;

  // Cho phép admin đặt slug tay (SEO); bỏ trống -> slugify(name).
  // Slug rỗng sau normalize (VD name='!!!') -> service 400.
  @IsOptional()
  @IsString()
  @MaxLength(140)
  slug?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @IsOptional()
  @IsUUID()
  parentId?: string;
}
