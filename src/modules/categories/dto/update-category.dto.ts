import { PartialType } from '@nestjs/mapped-types';
import { CreateCategoryDto } from './create-category.dto.js';

// Slug đổi qua update PHẢI tường minh (field slug), rename KHÔNG tự đổi slug
// (URL ổn định — xem category.entity). PartialType giữ nguyên rule đó.
export class UpdateCategoryDto extends PartialType(CreateCategoryDto) {}
