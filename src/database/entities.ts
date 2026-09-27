import { RefreshToken } from '../modules/auth/refresh-token.entity.js';
import { Category } from '../modules/categories/category.entity.js';
import { Product } from '../modules/products/product.entity.js';
import { User } from '../modules/users/user.entity.js';

// DANH SÁCH ENTITY DUY NHẤT của app (single source of truth).
// TypeOrmModule (Nest) và DataSource (CLI migration) đều đọc từ đây —
// thêm entity mới mà quên 1 chỗ = migration/CLI không thấy entity đó.
//
// KHÔNG dùng glob pattern ('dist/**/*.entity.js') như nhiều tutorial:
// glob dựa vào filesystem nên chạy trên dist sẽ trỏ sai khi đổi cấu trúc
// build, và không hoạt động ổn với ESM. Import explicit = type-safe, minh bạch.
export const ENTITIES = [User, RefreshToken, Category, Product];
