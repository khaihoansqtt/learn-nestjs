import type { QueryRunner, MigrationInterface } from 'typeorm';

// Bảng refresh_tokens cho rotation + reuse detection (xem refresh-token.entity).
//
// FK users(id) ON DELETE CASCADE: xóa cứng user -> token của họ tự dọn,
// không còn dòng mồ côi. (Soft-delete không trigger CASCADE — đúng ý, vì
// user xóa mềm vẫn có thể restore và refresh token cũ đã revoke hết lúc đó.)
export class RefreshTokens1790515683304 implements MigrationInterface {
  name = 'RefreshTokens1790515683304';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "refresh_tokens" (
        "id"         uuid         NOT NULL DEFAULT gen_random_uuid(),
        "userId"     uuid         NOT NULL,
        "tokenHash"  varchar(64)  NOT NULL,
        "expiresAt"  timestamptz  NOT NULL,
        "revokedAt"  timestamptz,
        "createdAt"  timestamptz  NOT NULL DEFAULT now(),
        CONSTRAINT "PK_refresh_tokens_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_refresh_tokens_user" FOREIGN KEY ("userId")
          REFERENCES "users" ("id") ON DELETE CASCADE
      )
    `);

    // Lookup theo hash khi refresh/logout — query nóng nhất của bảng này.
    await queryRunner.query(`
      CREATE UNIQUE INDEX "UQ_refresh_tokens_hash" ON "refresh_tokens" ("tokenHash")
    `);
    // Dọn/revoke toàn bộ token của 1 user (reuse detection, xóa tài khoản).
    await queryRunner.query(`
      CREATE INDEX "IX_refresh_tokens_user" ON "refresh_tokens" ("userId")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // down() ngược thứ tự up(): index -> table (FK đi theo table).
    await queryRunner.query(`DROP INDEX "public"."IX_refresh_tokens_user"`);
    await queryRunner.query(`DROP INDEX "public"."UQ_refresh_tokens_hash"`);
    await queryRunner.query(`DROP TABLE "refresh_tokens"`);
  }
}
