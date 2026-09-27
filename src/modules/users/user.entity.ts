import { Exclude } from 'class-transformer';
import { Column, DeleteDateColumn, Entity, Index } from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity.js';

// Const object + type thay vì enum: tương tác tốt với isolatedModules/ESM,
// không sinh code runtime, vẫn autocomplete được UserRole['ADMIN'].
export const UserRole = {
  ADMIN: 'admin',
  CUSTOMER: 'customer',
} as const;

export type UserRole = (typeof UserRole)[keyof typeof UserRole];

@Entity('users')
@Index('UQ_users_email', ['email'], { unique: true })
export class User extends BaseEntity {
  // Unique qua @Index (KHÔNG phải unique:true trên @Column) để TÊN index
  // được chốt là "UQ_users_email" — migration tạo đúng tên đó nên 2 bên khớp.
  @Column({ type: 'varchar', length: 255 })
  email!: string;

  // Format: scrypt$<salt>$<hash> (xem password.util.ts). M5 sẽ verify.
  //
  // select:false: mọi find() mặc định KHÔNG load cột này.
  // @Exclude: phòng thủ tầng 2 — kể cả khi service chủ động addSelect() rồi
  // trả entity ra API, ClassSerializerInterceptor cũng loại nó khỏi JSON.
  @Exclude()
  @Column({ type: 'varchar', length: 255, select: false })
  passwordHash!: string;

  @Column({ type: 'varchar', length: 120 })
  fullName!: string;

  @Column({ type: 'varchar', length: 20, default: UserRole.CUSTOMER })
  role!: UserRole;

  @Column({ type: 'boolean', default: true })
  isActive!: boolean;

  // Soft-delete (= @SQLDelete + @Where của Hibernate). repo.softDelete() /
  // repo.softRemove() set deletedAt, còn repo.remove()/repo.delete() là XÓA CỨNG.
  // TypeORM TỰ thêm "deletedAt IS NULL" vào mọi query find*. Muốn đọc bản đã
  // xóa: withDeleted().
  @DeleteDateColumn({ type: 'timestamptz', nullable: true })
  deletedAt!: Date | null;
}
