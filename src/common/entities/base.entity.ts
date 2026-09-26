import {
  CreateDateColumn,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

// Giống hệt @MappedSuperclass trong JPA: KHÔNG tạo bảng riêng,
// chỉ là "template" cột chung mà mọi entity extend.
// id/createdAt/updatedAt là chuẩn bắt buộc cho mọi bảng của app.
export abstract class BaseEntity {
  // uuid thay vì bigint: không lộ thứ tự, merge nhiều DB không conflict,
  // tạo phía DB (gen_random_uuid) nên nhiều instance insert song song không đụng id.
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  // timestamptz (WITH time zone) thay timestamp: lưu UTC, đổi timezone khi render.
  // TypeORM tự set 2 cột này ở level application (không cần DEFAULT now() trong DB),
  // nhưng vẫn đặt DEFAULT trong migration để insert bằng SQL thuần không lỗi.
  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;
}
