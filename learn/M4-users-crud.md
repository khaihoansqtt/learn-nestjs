# M4 — Users CRUD

> Prereq: M0-M3 (setup, DI, validation, DB + migration). Output: CRUD đầy đủ `/api/users`
> với phân trang/filter/sort, soft-delete, chống lộ mật khẩu, test unit + e2e.

## 1. Map Spring -> Nest

| Spring | Nest/TypeORM | File |
|---|---|---|
| `@RestController @RequestMapping("/users")` | `@Controller('users')` | `users.controller.ts` |
| `@GetMapping/@PostMapping/@PatchMapping/@DeleteMapping` | `@Get/@Post/@Patch/@Delete` |同上 |
| `UserService extends JpaRepository` | `UsersService` + `@InjectRepository(User)` | `users.service.ts` |
| `@EnableJpaRepositories` | `TypeOrmModule.forFeature([User])` | `users.module.ts` |
| `Pageable` + `Page<T>` | `ListUsersDto` + `Page<T>` (items/total/totalPages) | `dto/list-users.dto.ts` |
| `@PathVariable UUID` | `@Param('id', ParseUUIDPipe)` | controller |
| `@NotBlank/@Email/@Size` | `@IsString/@IsEmail/@MaxLength` | `dto/*.dto.ts` |
| `@Transactional` | chưa cần (1 query = 1 tx tự động) — M8 | |
| `@SQLDelete` soft-delete | `@DeleteDateColumn` + `repo.softDelete()` | entity/service |
| `@JsonIgnore password` | `@Exclude()` + `ClassSerializerInterceptor` | entity/AppModule |
| `DataIntegrityViolationException` 409 | `QueryFailedError code 23505` -> `ConflictException` | service |
| `@Repository` + `save` | `repo.create(...)` + `repo.save(...)` | service |

## 2. Cấu trúc module

```text
src/modules/users/
  user.entity.ts          # (M3) + @Exclude() passwordHash
  password.util.ts        # (M3) scrypt
  dto/
    create-user.dto.ts    # email/password/fullName/role
    update-user.dto.ts    # PartialType(CreateUserDto)
    list-users.dto.ts     # page/limit/q/role/isActive/includeDeleted/sort/order
  users.service.ts        # business logic + Page<T>
  users.controller.ts     # REST
  users.module.ts         # TypeOrmModule.forFeature([User])
  users.service.spec.ts   # 13 unit tests
test/users.e2e-spec.ts    # 11 e2e tests (DB thật)
```

## 3. Các endpoint

| Method | Path | Trả về | Ghi chú |
|---|---|---|---|
| GET | `/api/users` | `Page<User>` | phân trang + filter + sort |
| POST | `/api/users` | 201 `User` | 409 nếu email trùng |
| GET | `/api/users/:id` | `User` | 400 nếu không phải UUID, 404 nếu không có |
| PATCH | `/api/users/:id` | `User` | merge từng field tường minh (+ `isActive` để khóa/mở) |
| DELETE | `/api/users/:id` | `{id, deleted: true, soft: true}` | **soft**-delete |
| POST | `/api/users/:id/restore` | `User` | khôi phục, idempotent |

**CHƯA CÓ GUARD** — đúng cho M4. M5 thêm `JwtAuthGuard` + `RolesGuard`, mỗi route chỉ khai `@UseGuards(...)`.

## 4. Phân trang + filter (Spring Pageable)

`findAll()` dùng **QueryBuilder** thay vì `findAndCount` vì cần
`email ILIKE :q OR fullName ILIKE :q` (OR giữa cột) kết hợp AND filter —
`FindOptionsWhere` không diễn đạt gọn.

```powershell
curl "http://127.0.0.1:3000/api/users?page=1&limit=10&q=khai&role=customer&sort=createdAt&order=desc"
```

3 điểm bắt buộc nhớ:

1. **Sort phải whitelist** (`IsIn(['createdAt',...])`) — không bao giờ nối string
   từ query vào `ORDER BY` (SQL injection).
2. **Boolean query param**: `enableImplicitConversion` biến `"false"` -> `true`
   (`Boolean('false') === true`). Dùng `@Transform(({value}) => value === 'true')`.
3. **`q` phải escape LIKE** (`escapeLike()`): query đã parameterized nên không SQLi,
   nhưng `%`/`_` trong từ khóa sẽ thành wildcard match tất cả (LIKE-pattern injection).
4. **Email normalize** (`normalizeEmail()` trong service): `A@X.com` và `a@x.com`
   là 1 người — unique index varchar case-sensitive sẽ cho qua 2 tài khoản trùng
   nghĩa nếu không lowercase+trim trước check và lưu.
3. `qb.skip((page-1)*limit).take(limit)` = `OFFSET/LIMIT`, `getManyAndCount()`
   chạy 2 query (data + count) trong 1 lệnh.

Response:

```json
{ "data": { "items": [...], "total": 25, "page": 2, "limit": 10, "totalPages": 3 } }
```

## 5. Soft-delete

`repo.softDelete({id})` -> `UPDATE users SET deletedAt = now() WHERE id = ...`
(không `DELETE`). Sau đó:

- `findOne()` của TypeORM **tự** thêm `deletedAt IS NULL` -> đã xóa = 404.
- QueryBuilder cũng tự thêm (verify qua `SelectQueryBuilder.js:1112`).
  Muốn thấy bản đã xóa: `.withDeleted()` hoặc `find({ withDeleted: true })`.

**Bẫy đã thấy thực tế:** unique index `UQ_users_email` vẫn chặn user *đã xóa mềm*
đăng ký lại email. Sửa: partial unique index `WHERE "deletedAt" IS NULL` (bạn tự làm
ở bài tập 1). Đây là lý do soft-delete luôn đi kèm suy nghĩ về constraint.

## 6. Không lộ mật khẩu (2 tầng phòng thủ)

1. `@Column({ select: false })` — mọi `find()` mặc định **không load** cột hash.
2. `@Exclude()` + `ClassSerializerInterceptor` global (`APP_INTERCEPTOR`) —
   kể cả khi service chủ động `addSelect('user.passwordHash')` để verify login
   (M5 sẽ làm), entity trả ra API vẫn bị loại khỏi JSON.

Ngoài ra: `hashPassword()` ngay trong service, không bao giờ nhận `passwordHash` từ client
(`forbidNonWhitelisted` của M2 chặn field lạ).

## 7. Lỗi trùng email: 2 lớp

```ts
const exists = await repo.findOne({ where: { email } });  // lớp 1: message đẹp
if (exists) throw new ConflictException(...);
try { return await repo.save(...); }
catch (err) { if (isUniqueViolation(err)) throw new ConflictException(...); } // lớp 2: race
```

Lớp 1 bị race (2 request cùng lúc), lớp 2 bắt SQLSTATE **23505** — bắt theo
`code`, **không** so `message` (đổi theo locale/phiên bản Postgres).
TypeORM tự copy `driverError.code` lên `QueryFailedError` nên `err.code` đọc được
(kiểm chứng `node_modules/typeorm/error/QueryFailedError.js:19-24`).

## 8. Thử tay

```powershell
npm run start:dev
curl -X POST http://127.0.0.1:3000/api/users -H "Content-Type: application/json" `
     -d '{"email":"hn@shop.dev","password":"MatKhau@123","fullName":"Ha Noi"}'
curl "http://127.0.0.1:3000/api/users?q=ha&sort=fullName&order=asc"
curl -X PATCH http://127.0.0.1:3000/api/users/<id> -H "Content-Type: application/json" -d '{"fullName":"HN Updated"}'
curl -X DELETE http://127.0.0.1:3000/api/users/<id>
curl "http://127.0.0.1:3000/api/users?includeDeleted=true"
docker exec shop-mini-db psql -U shop -d shop_mini -c "SELECT id,email,\"deletedAt\" FROM users;"
```

## 9. Bài tập (40 phút)

1. **Sửa unique email cho soft-delete**: migration mới đổi index thành
   `CREATE UNIQUE INDEX "UQ_users_email" ON "users"("email") WHERE "deletedAt" IS NULL;`
   rồi test: tạo user -> xóa mềm -> tạo lại cùng email -> 201 (không còn 409).
2. Viết `GET /api/users/count` trả `{ total, active }` dùng `repo.count()`.
3. Thêm filter `createdFrom/createdTo` (`IsDateString`) -> `qb.andWhere('user.createdAt BETWEEN :from AND :to')`.
4. Suy nghĩ: nếu cho `limit=10000` thì sao? Đã `@Max(100)` — nếu client gọi
   thẳng service (không qua HTTP) thì giới hạn nằm ở đâu? (Gợi ý: validate lại
   trong service hoặc trả `Page` bất biến.)

## 10. Checkpoint

- [ ] Vì sao `forFeature` cần ở module chứa repository, inject ở nơi khác thì sao?
- [ ] `softDelete()` khác `delete()` thế nào? 2 chỗ nào tự lọc `deletedAt`?
- [ ] `@Exclude` và `select: false` khác nhau thế nào, vì sao cần cả 2?
- [ ] 23505 là gì? Vì sao không so `err.message`?
- [ ] `PartialType` của `@nestjs/mapped-types` tiết kiệm gì, khác gì copy DTO?
- [ ] Boolean query param `"false"` thành gì nếu thiếu `@Transform`?

## 11. Câu hỏi PV từ M4

1. Paging offset/limit gặp vấn đề gì ở data lớn? Keyset cursor pagination là gì?
2. `ILIKE %q%` có dùng index được không? Redis/FTS/PG trigram ở mức nào?
3. Soft-delete ảnh hưởng FK/unique/reporting ra sao, khi nào nên hard-delete?
4. Conflict 409 vs 422 khi validate business rule?
5. Làm sau tránh N+1 khi `GET /users` cần kèm order count? (M6 preview.)

---
Tiếp theo **M5: Auth JWT + RBAC** — đăng ký/đăng nhập, hash verify, access + refresh
token rotation, `JwtAuthGuard` + `RolesGuard`, map từ Spring Security filter chain.
