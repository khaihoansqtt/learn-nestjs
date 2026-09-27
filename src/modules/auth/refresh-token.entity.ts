import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { User } from '../users/user.entity.js';

// Refresh token rotation lưu DB (stateful) — mỗi refresh thành công:
// revoke token cũ + cấp token mới. Token cũ dùng lại -> nghi đánh cắp ->
// revoke TOÀN BỘ token của user (reuse detection, xem auth.service).
//
// Vì sao refresh stateful mà access stateless? Access TTL 15 phút nên rủi ro
// thấp, verify chữ ký là đủ (không query DB mỗi request). Refresh sống 7 ngày
// nên PHẢI có trong DB để revoke/logout được. (= Spring: refresh token store)
@Entity('refresh_tokens')
@Index('UQ_refresh_tokens_hash', ['tokenHash'], { unique: true })
@Index('IX_refresh_tokens_user', ['userId'])
// Không extend common BaseEntity: bảng này không cần updatedAt
// (dòng chỉ insert 1 lần + update revokedAt), giữ schema gọn đúng nhu cầu.
export class RefreshToken {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  userId!: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user!: User;

  // SHA-256 hex của refresh token JWT. DB lộ cũng không dùng được token
  // (one-way), khác hẳn lưu plaintext. (= Spring: lưu hash, so khi dùng)
  @Column({ type: 'varchar', length: 64 })
  tokenHash!: string;

  @Column({ type: 'timestamptz' })
  expiresAt!: Date;

  // NULL = còn hiệu lực. Set giờ khi rotate/logout -> token chết dù JWT chưa hết hạn.
  @Column({ type: 'timestamptz', nullable: true })
  revokedAt!: Date | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;
}
