import {
  Column,
  DeleteDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  ValueTransformer,
} from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity.js';
import { Category } from '../categories/category.entity.js';

// BẪY driver pg: cột numeric Postgres trả về STRING ("129000.00"), không phải
// number — JSON sẽ thành "price":"129000.00" sai kiểu. Transformer này ép về
// number ở tầng entity (1 chỗ, mọi query đều đúng). Giá NULL không xảy ra
// (NOT NULL) nhưng guard vẫn giữ cho chắc.
// (Cách khác: lưu giá integer theo đơn vị nhỏ nhất — VND không có subunit nên
// integer cũng hợp lệ; project này giữ numeric để học transformer.)
export const NumericTransformer: ValueTransformer = {
  to: (value: number | null): number | null => value,
  from: (value: string | null): number | null =>
    value === null ? null : parseFloat(value),
};

@Entity('products')
@Index('UQ_products_slug', ['slug'], { unique: true })
@Index('IX_products_category', ['categoryId'])
export class Product extends BaseEntity {
  @Column({ type: 'varchar', length: 200 })
  name!: string;

  @Column({ type: 'varchar', length: 220 })
  slug!: string;

  @Column({ type: 'text', nullable: true })
  description!: string | null;

  @Column({ type: 'numeric', precision: 12, scale: 2, transformer: NumericTransformer })
  price!: number;

  @Column({ type: 'int', default: 0 })
  stock!: number;

  @Column({ type: 'boolean', default: true })
  isActive!: boolean;

  @Column({ type: 'uuid' })
  categoryId!: string;

  // N-1 về Category. onDelete RESTRICT: còn product thì Category không xóa
  // được (DB là chốt chặn cuối sau check của service).
  // Relation để LAZY (không eager) — đọc kèm category bằng leftJoinAndSelect
  // tường minh trong service (xem products.service.findAll).
  @ManyToOne(() => Category, { onDelete: 'RESTRICT', nullable: false })
  @JoinColumn({ name: 'categoryId' })
  category!: Category;

  // Soft-delete giống users (M4): ẩn khỏi storefront nhưng giữ lịch sử đơn hàng (M8).
  @DeleteDateColumn({ type: 'timestamptz', nullable: true })
  deletedAt!: Date | null;
}
