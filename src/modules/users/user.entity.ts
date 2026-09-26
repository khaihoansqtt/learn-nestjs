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
  // unique:true -> TypeORM sinh unique constraint; KHỚP với index trong migration.
  @Column({ type: 'varchar', length: 255 })
  email!: string;

  // Format: scrypt$<salt>$<hash> (xem password.util.ts). M5 sẽ verify.
  @Column({ type: 'varchar', length: 255, select: false })
  passwordHash!: string;

  @Column({ type: 'varchar', length: 120 })
  fullName!: string;

  @Column({ type: 'varchar', length: 20, default: UserRole.CUSTOMER })
  role!: UserRole;

  @Column({ type: 'boolean', default: true })
  isActive!: boolean;

  // Soft-delete (= @SQLDelete + @Where của Hibernate). TypeORM tự set khi .remove()
  // và TỰ động thêm "deletedAt IS NULL" vào mọi query find*. Muốn đọc bản đã
  // xóa: withDeleted(). NPP.@DeleteDateColumn
  @DeleteDateColumn({ type: 'timestamptz', nullable: true })
  deletedAt!: Date | null;
}
