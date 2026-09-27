import { PartialType } from '@nestjs/mapped-types';
import { CreateProductDto } from './create-product.dto.js';

// Giống Category: rename không tự đổi slug (URL sản phẩm ổn định),
// muốn đổi slug thì gửi tường minh.
export class UpdateProductDto extends PartialType(CreateProductDto) {}
