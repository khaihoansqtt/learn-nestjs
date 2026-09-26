import type { QueryRunner, MigrationInterface } from 'typeorm';

// Migration đầu tiên: tạo bảng users.
//
// QUY TẮC: file name = <timestamp ms>-<TenPascal>.ts
// Timestamp quyết định thứ tự chạy — sinh bằng Date.now() khi tạo migration mới.
//
// So với Spring: đây chính là Flyway/Liquibase migration.
//   - up()  = versioned migration (V1__xxx.sql)
//   - down() = LƯU TRỮ (Liquibase có, Flyway community không có)
//   - bảng "migrations" TypeORM tự tạo = schema_history của Flyway
//
// TẠI SAO VIẾT SQL THUẦN thay vì queryRunner.createTable()?
// Vì đó là thứ thực sự chạy trên DB bạn phải hiểu khi đi làm:
// mất 30 giây đọc CREATE TABLE, còn createTable() giấu mọi thứ sau API.
export class InitUsers1790380800000 implements MigrationInterface {
  name = 'InitUsers1790380800000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // gen_random_uuid(): built-in từ Postgres 13+, KHÔNG cần extension pgcrypto.
    // timestamptz: lưu UTC + offset (đã bàn ở BaseEntity).
    await queryRunner.query(`
      CREATE TABLE "users" (
        "id"           uuid         NOT NULL DEFAULT gen_random_uuid(),
        "email"        varchar(255) NOT NULL,
        "passwordHash" varchar(255) NOT NULL,
        "fullName"     varchar(120) NOT NULL,
        "role"         varchar(20)  NOT NULL DEFAULT 'customer',
        "isActive"     boolean      NOT NULL DEFAULT true,
        "deletedAt"    timestamptz,
        "createdAt"    timestamptz  NOT NULL DEFAULT now(),
        "updatedAt"    timestamptz  NOT NULL DEFAULT now(),
        CONSTRAINT "PK_users_id" PRIMARY KEY ("id")
      )
    `);

    // Unique index cho email — chống đăng ký trùng.
    // Index ≠ constraint thuần: unique index cũng chặn luôn, nhưng nhanh hơn
    // và TypeORM metadata (@Index unique) map đúng vào nó.
    await queryRunner.query(`
      CREATE UNIQUE INDEX "UQ_users_email" ON "users" ("email")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // down() phải HOÀN NGƯỢC đúng thứ tự up(): index trước, table sau.
    // Đây là "bảo hiểm" khi deploy sai — `db:migrate:revert` lùi 1 bước.
    await queryRunner.query(`DROP INDEX "public"."UQ_users_email"`);
    await queryRunner.query(`DROP TABLE "users"`);
  }
}
