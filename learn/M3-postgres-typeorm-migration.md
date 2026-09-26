# M3 — Postgres + TypeORM + Migration

> Prereq: M0-M2 (setup, DI/module, validation/filter/logging) đã xanh.
> Stack: Postgres 16 (Docker) + TypeORM 0.3 + `@nestjs/typeorm` 12.
> Output: DB kết nối, entity đầu tiên, migration đầu tiên chạy, seed admin, health check DB.

## 1. Map Spring -> Nest (bảng nhanh)

| Spring/JPA | NestJS/TypeORM | Ghi chú |
|---|---|---|
| `application.yml` datasource | `.env` + `dbConfig` + `TypeOrmModule.forRootAsync` | M2 đã validate env bằng Joi |
| `DataSource` / `EntityManager` | `DataSource` / `EntityManager` inject được | `@Global` |
| `@Entity` | `@Entity('users')` | |
| `@MappedSuperclass` | class abstract extend (BaseEntity) | không tạo bảng riêng |
| `@GeneratedValue IDENTITY` | `@PrimaryGeneratedColumn('uuid')` | |
| `@Column` | `@Column({ type: 'varchar', length: 255 })` | **phải khai báo type tường minh** |
| `@OneToMany/@ManyToOne` | `@OneToMany(() => Product, ...)` | M6 |
| `@SQLDelete` + `@Where` | `@DeleteDateColumn` + `withDeleted()` | built-in |
| Hibernate `ddl-auto` | `synchronize` — **chỉ false** | |
| Flyway / Liquibase | TypeORM migration (`up/down`) | bảng `migrations` |
| `@Transactional` | `@Transactional()` (typeorm) / `queryRunner.manager` | M8 |
| `JpaRepository.save/find` | `repo.save/findOne/find` | M4 |
| Spring Data `Page<T>` | `findAndCount` + offset/limit | M4 |
| `CommandLineRunner` | `db:seed` script | |

## 2. Cấu trúc thêm vào ở M3

```text
src/
  common/entities/base.entity.ts        # id/createdAt/updatedAt (=@MappedSuperclass)
  modules/users/user.entity.ts          # entity đầu tiên (M4 làm CRUD)
  modules/users/password.util.ts        # scrypt hash (M5 auth dùng lại)
  config/
    typeorm.config.ts                   # createTypeOrmOptions() cho Nest
    db.config.ts                        # + poolSize
  database/                             # = src/main/resources/db (Spring)
    entities.ts                         # ENTITIES — single source of truth
    migrations/index.ts                 # MIGRATIONS — single source of truth
    migrations/1790380800000-InitUsers.ts
    data-source.ts                      # DataSource độc lập cho CLI
    load-env.ts                         # .env loader cho CLI (không cần dotenv)
    seed.ts                             # seed admin (idempotent)
    cli.ts                              # run | revert | show | seed
```

## 3. Kết nối DB

```ts
// app.module.ts
TypeOrmModule.forRootAsync({
  inject: [dbConfig.KEY],          // typed config đã Joi-validate (M2)
  useFactory: createTypeOrmOptions,
})
```

3 quyết định trong `createTypeOrmOptions()` phải nhớ đi làm:

1. `synchronize: false` — schema **chỉ** đổi qua migration.
2. `migrationsRun: false` — migration là lệnh tường minh `npm run db:migrate`, không chạy ngầm mỗi lần boot.
3. `poolSize: 10` — giới hạn kết nối (TypeORM mặc định không giới hạn; app 20 instance sẽ dồn ép Postgres).

`TypeOrmCoreModule` là `@Global()` nên **inject `DataSource` ở bất kỳ module nào cũng được**, không cần `forFeature`. Muốn repository: `TypeOrmModule.forFeature([User])`.

## 4. Entity vs bảng: 2 nơi phải khớp

`ENTITIES` và `MIGRATIONS` là 2 danh sách single-source-of-thought, cả Nest và CLI đều đọc từ đó. Thay vì glob `'dist/**/*.entity.js'` (chạy trên dist là trỏ sai, không ổn với ESM), ta import explicit — type-safe, `tsc` bắt ngay khi file đổi tên.

Entity chú ý:

- `@Column` **phải** khai `type` tường minh — không thì TypeORM đoán qua `emitDecoratorMetadata`, đoán sai là schema lệch âm thầm.
- `timestamptz` chứ không `timestamp`: lưu UTC thật sự.
- `passwordHash` đặt `select: false`: mọi `find()` mặc định **không** trả password hash về (muốn có phải `.addSelect`).

## 5. Migration — phần lõi của M3

```powershell
npm run db:migrate:show     # có migration nào chờ không
npm run db:migrate           # chạy các migration chưa apply
npm run db:migrate:revert    # LÙI 1 bước (down)
npm run db:seed              # chèn admin (idempotent)
```

**Vì sao `up()` viết SQL thuần thay vì `queryRunner.createTable()`?**
Vì đó là thứ thực sự chạy trên DB. Đi làm đọc `CREATE TABLE` 30 giây là hiểu, còn `createTable()` giấu hết sau API.

**Vì sao CLI chạy trên `dist` chứ không `tsx`?**
`tsx` = esbuild, và esbuild **không sinh `emitDecoratorMetadata`**. TypeORM sẽ đọc sai column type mà không báo lỗi. `tsc` + `node` là đường chắc chắn.

**Vì sao có `down()`?**
Để `revert` lùi được 1 bước khi deploy sai. Quy tắc: `down()` hoàn ngược **đúng thứ tự** `up()` (index trước, table sau). Prod nhiều team còn cấm luôn `down()`, buộc viết migration mới khắc phục — luật team tuỳ thực tế.

**Các lệnh migration quen thuộc (Spring -> TypeORM):**

| Flyway | TypeORM |
|---|---|
| `flyway migrate` | `npm run db:migrate` |
| `flyway info` | `npm run db:migrate:show` |
| `flyway repair` | — (xem bảng `migrations` tay) |
| `V1__init.sql` | `1790380800000-InitUsers.ts` |

## 6. Seed

`seedAdmin()` kiểm tra email tồn tại rồi mới chèn → chạy 10 lần vẫn 1 admin. **Mọi seed script phải idempotent.** Warning khi còn dùng mật khẩu mặc định.

```sql
-- verify tay
docker exec shop-mini-db psql -U shop -d shop_mini -c "\d users"
```

## 7. Health check DB

`GET /api/health/db` — readiness probe kiểu Spring Actuator:

- `SELECT 1` (không đụng bảng) nên chạy được cả khi chưa migrate.
- DB chết -> `ServiceUnavailableException` -> 503 với envelope M2.

## 8. 4 bẫy THẬT đã rơi vào khi làm M3 (học từ lỗi)

1. **`import type { DataSource }` làm DI vỡ.** `import type` bị TS loại bỏ ở runtime
   nên `emitDecoratorMetadata` ghi `design:paramtypes = Object` -> Nest tìm provider
   token `Object` -> `UnknownDependenciesException`. Fix: import value
   (`import { DataSource } from 'typeorm'`). Lỗi này KHÔNG hiện ở `tsc`, chỉ nổ lúc boot.

2. **`new Logger(name)` của `nestjs-pino` khác của `@nestjs/common`.**
   nestjs-pino cần `(PinoLogger, { renameContext })`, truyền 1 tham số là compile error —
   và khi `nest start --watch` compile fail thì **app vẫn chạy bản cũ**, mọi test tay
   trả kết quả của code đã chết. Cẩn thận: đọc log compile, đừng chỉ nhìn API trả về.

3. **`AggregateError.message` là `''`.** TCP connect fail thì Node thử cả `::1` và
   `127.0.0.1` rồi ném `AggregateError` không message -> client nhận `message: [""]`.
   Phải đào `err.errors[0].message` (xem `describeError` + spec).

4. **Joi `.email()` reject TLD `.local`.** `admin@shop-mini.local` bị fail-fast ngay
   lúc boot — đúng behaviour, nhưng nhớ khi cấu hình seed (dùng `.dev`/`.com`).

## 9. Thử tay

```powershell
docker compose up -d
npm run db:migrate
npm run db:seed
npm run start:dev
curl.exe -s http://127.0.0.1:3000/api/health/db
docker exec shop-mini-db psql -U shop -d shop_mini -c "SELECT * FROM migrations;"
docker exec shop-mini-db psql -U shop -d shop_mini -c "SELECT email, role FROM users;"
```

Kiểm chứng `synchronize:false` là thật: xoá 1 dòng trong migration, `db:migrate:revert`, xem bảng — rồi tạo migration mới thấy `tsc`/`node` complain gì nếu entity lệch schema.

## 10. Bài tập (30 phút)

1. Tạo migration `AddUsersPhone` thêm cột `phone varchar(20) NULL` bằng `npm`-style tự viết file + đăng vào `MIGRATIONS`. Sau đó revert, sửa lại `NOT NULL DEFAULT ''`, chạy lại.
2. Thêm `SELECT 1` delay test: `docker compose stop db`, gọi `/api/health/db`, thấy 503 + envelope; `docker compose start db` thì up lại.
3. Viết spec cho `verifyPassword()` (đúng/sai scheme/sai mật khẩu/timing).
4. Suy nghĩ: app đang chạy 3 instance cùng lúc, 1 deploy mới có 3 migration cần chạy — nên cho cả 3 tự chạy, hay 1 job riêng? Vì sao? (Đối chiếu cách `migrationsRun:false` đang làm.)

## 11. Checkpoint

- [ ] `synchronize:true` nguy hiểm ở đâu, kể cả chỉ bật trên dev?
- [ ] Vì sao `@Column` phải khai `type` tường minh, và `tsx`/esbuild phá TypeORM thế nào?
- [ ] 3 chỗ nào phải khớp nhau: entity ↔ migration ↔ `ENTITIES`?
- [ ] `migrationsRun:false` + `db:migrate` tách ra thì deploy sequence nên thế nào?
- [ ] `timestamptz` khác `timestamp` thế nào, vì sao chọn nó?
- [ ] Seed không idempotent thì hỏng gì?

## 12. Câu hỏi PV từ M3

1. Chọn UUID hay bigint làm PK? Trade-off (index, join, phân tán)?
2. Flyway và TypeORM migration khác gì, migration lock/locking chạy thế nào khi nhiều instance?
3. `passwordHash` `select:false` — làm sao vẫn verify được login?
4. Soft-delete (`deletedAt`) ảnh hưởng unique index email thế nào? (Trả lời: broken — user xóa mềm vẫn chặn email mới. Sửa ở đâu?)
5. Pool size đặt bao nhiêu là hợp lý, theo gì?

---
Tiếp theo **M4: Users CRUD** — `TypeOrmModule.forFeature([User])`, DTO vào/Entity ra, paging/filter, soft-delete với `withDeleted()`, và `findAndCount` map về `Page<T>` kiểu Spring Data.
