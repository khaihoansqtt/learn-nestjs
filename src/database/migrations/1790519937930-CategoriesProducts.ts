import type { QueryRunner, MigrationInterface } from 'typeorm';

// Bảng categories (cây tự tham chiếu) + products (FK về categories).
//
// Quyết định FK:
// - products.categoryId ON DELETE RESTRICT: còn hàng thì category không xóa
//   được ở tầng DB (service đã chặn mềm với 409 trước đó).
// - categories.parentId ON DELETE SET NULL: xóa cha thì con thành gốc thay vì
//   mất cả cây (khác CASCADE xóa theo — nguy hiểm với danh mục).
export class CategoriesProducts1790519937930 implements MigrationInterface {
  name = 'CategoriesProducts1790519937930';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "categories" (
        "id"          uuid         NOT NULL DEFAULT gen_random_uuid(),
        "name"        varchar(120) NOT NULL,
        "slug"        varchar(140) NOT NULL,
        "description" text,
        "parentId"    uuid,
        "createdAt"   timestamptz  NOT NULL DEFAULT now(),
        "updatedAt"   timestamptz  NOT NULL DEFAULT now(),
        CONSTRAINT "PK_categories_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_categories_parent" FOREIGN KEY ("parentId")
          REFERENCES "categories" ("id") ON DELETE SET NULL
      )
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX "UQ_categories_slug" ON "categories" ("slug")
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX "UQ_categories_name" ON "categories" ("name")
    `);

    await queryRunner.query(`
      CREATE TABLE "products" (
        "id"          uuid          NOT NULL DEFAULT gen_random_uuid(),
        "name"        varchar(200)  NOT NULL,
        "slug"        varchar(220)  NOT NULL,
        "description" text,
        "price"       numeric(12,2) NOT NULL,
        "stock"       integer       NOT NULL DEFAULT 0,
        "isActive"    boolean       NOT NULL DEFAULT true,
        "categoryId"  uuid          NOT NULL,
        "deletedAt"   timestamptz,
        "createdAt"   timestamptz   NOT NULL DEFAULT now(),
        "updatedAt"   timestamptz   NOT NULL DEFAULT now(),
        CONSTRAINT "PK_products_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_products_category" FOREIGN KEY ("categoryId")
          REFERENCES "categories" ("id") ON DELETE RESTRICT
      )
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX "UQ_products_slug" ON "products" ("slug")
    `);
    // Lọc theo category là query nóng nhất của storefront (kèm sort theo giá).
    await queryRunner.query(`
      CREATE INDEX "IX_products_category" ON "products" ("categoryId")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "public"."IX_products_category"`);
    await queryRunner.query(`DROP INDEX "public"."UQ_products_slug"`);
    await queryRunner.query(`DROP TABLE "products"`);
    await queryRunner.query(`DROP INDEX "public"."UQ_categories_name"`);
    await queryRunner.query(`DROP INDEX "public"."UQ_categories_slug"`);
    await queryRunner.query(`DROP TABLE "categories"`);
  }
}
