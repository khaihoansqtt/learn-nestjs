import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
} from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity.js';

// Danh mục dạng CÂY qua tự tham chiếu parent/children:
//   Điện thoại (parent=NULL)
//     └─ iPhone (parentId=Điện thoại)
// (= Spring @ManyToOne self-join + @OneToMany(mappedBy="parent"))
//
// Xóa category CHỈ khi không còn con/cháu và không còn product (service chặn,
// FK RESTRICT phía DB chặn nốt) — tránh mồ côi hàng loạt.
@Entity('categories')
@Index('UQ_categories_slug', ['slug'], { unique: true })
@Index('UQ_categories_name', ['name'], { unique: true })
export class Category extends BaseEntity {
  @Column({ type: 'varchar', length: 120 })
  name!: string;

  // Slug ổn định cho URL (/c/dien-thoai). Sinh từ name lúc tạo, KHÔNG đổi
  // theo rename (URL cũ phải sống) trừ khi admin sửa tường minh.
  @Column({ type: 'varchar', length: 140 })
  slug!: string;

  @Column({ type: 'text', nullable: true })
  description!: string | null;

  @Column({ type: 'uuid', nullable: true })
  parentId!: string | null;

  // LAZY hay EAGER? Mặc định LAZY (không load) — service join tường minh
  // từng case (M6 chống N+1). EAGER (@ManyToOne({eager:true})) tiện nhưng
  // mọi query đều JOIN theo, không kiểm soát được — cấm ở project này.
  @ManyToOne(() => Category, (c) => c.children, {
    onDelete: 'SET NULL',
    nullable: true,
  })
  @JoinColumn({ name: 'parentId' })
  parent!: Category | null;

  @OneToMany(() => Category, (c) => c.parent)
  children!: Category[];
}
