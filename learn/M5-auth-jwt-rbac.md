# M5 — Auth JWT + RBAC

> Prereq: M0-M4. Output: đăng ký/đăng nhập, access + refresh rotation,
> `JwtAuthGuard` + `RolesGuard` global, đóng lỗ tự phong admin của M4.

## 1. Map Spring -> Nest

| Spring Security | NestJS (tự viết, không passport) | File |
|---|---|---|
| `OncePerRequestFilter` check JWT | `JwtAuthGuard implements CanActivate` (APP_GUARD) | `guards/jwt-auth.guard.ts` |
| `@PreAuthorize("hasRole('ADMIN')")` | `@Roles('admin')` + `RolesGuard` (APP_GUARD) | `decorators/roles.decorator.ts`, `guards/roles.guard.ts` |
| `requestMatchers("/auth/**").permitAll()` | `@Public()` từng method | `decorators/public.decorator.ts` |
| `SecurityContextHolder.getContext()` | `@CurrentUser()` param decorator | `decorators/current-user.decorator.ts` |
| `PasswordEncoder.matches()` | `verifyPassword()` (M3) + `addSelect('user.passwordHash')` | `auth.service.ts` |
| Refresh token store | bảng `refresh_tokens` + rotation | `refresh-token.entity.ts` |
| `BadCredentialsException` chung | 1 message 401 cho mọi ca sai | `auth.service.ts` |

Vì sao không dùng `passport-jwt`? Passport giấu flow trong strategy/callback —
tự viết guard thấy rõ từng bước: tách Bearer -> verify chữ ký -> check type ->
gắn `req.user`. Đi làm dùng passport hay tự viết đều được, nhưng phải hiểu
cơ chế này trước.

## 2. Cấu trúc thêm vào

```text
src/modules/auth/
  auth.types.ts               # AccessPayload / RefreshPayload / TokenPair / AuthUser
  dto/register.dto.ts         # KHÔNG có role (force customer)
  dto/login.dto.ts            # không minLength password (xem §5)
  dto/refresh.dto.ts          # @IsJWT
  refresh-token.entity.ts     # bảng refresh_tokens
  auth.service.ts             # register/login/refresh/logout + rotation
  auth.controller.ts          # POST /auth/register|login|refresh|logout
  auth.module.ts              # JwtModule.registerAsync + APP_GUARD x2
  guards/jwt-auth.guard.ts
  guards/roles.guard.ts
  decorators/public|roles|current-user.decorator.ts
src/config/auth.config.ts     # secret + TTL + chặn secret dev ở prod
src/database/migrations/1790515683304-RefreshTokens.ts
test/auth.e2e-spec.ts         # 14 tests
```

## 3. Luồng token

```
register/login  -> { user, accessToken (15'), refreshToken (7d), expiresIn }
  refresh_tokens: INSERT { userId, sha256(refresh), expiresAt }

refresh(r1)     -> revoke r1 + cấp (a2, r2)        [rotation]
refresh(r1) nữa -> 401 + REVOKE HẾT token user     [reuse detection]
logout(r1)      -> revoke r1 (idempotent)

GET /users + Bearer a1 -> JwtAuthGuard verify -> req.user -> RolesGuard -> handler
```

Access **stateless** (tin chữ ký, không query DB — đổi role/revoke gấp thì chờ
≤15 phút). Refresh **stateful** (sống 7 ngày nên phải revoke/logout được).
DB chỉ lưu **SHA-256** của refresh token, không lưu plaintext.

## 4. Phân quyền Users sau M5

| Route | Ai gọi được |
|---|---|
| `GET /users`, `GET /users/:id` | đăng nhập bất kỳ |
| `POST /users` | ADMIN (tạo user role tùy ý) |
| `PATCH /users/:id` | ADMIN mọi field; CUSTOMER chỉ sửa **chính mình** và cấm `role`/`isActive` |
| `DELETE`, `POST /:id/restore` | ADMIN |

`POST /auth/register` luôn tạo `customer` — gửi `{"role":"admin"}` thì **400**
(`forbidNonWhitelisted`), không phải bị ignore thầm. Muốn admin mới: nhờ admin
có sẵn gọi `POST /users`.

## 5. 4 quyết định bảo mật phải nhớ

1. **Message login chung 1 câu** cho cả không-có-user/sai-pass/bị-khóa/bị-xóa
   (chống user-enumeration). Riêng register giữ 409 lộ tồn tại — vì UX đăng ký
   bắt buộc báo "email đã dùng", không tránh được.
2. **Login không minLength password** — policy đổi sau này không được khóa user cũ
   ngoài cửa; validate độ dài chỉ ở register/update.
3. **Refresh ≠ access**: khác secret + check `payload.type`. Kể cả 2 secret bị
   set trùng, refresh vẫn không gọi được API.
4. **Secret dev fail-fast ở prod**: `assertAuthConfigProductionSafe` chạy lúc
   startup trong `JwtModule.registerAsync` — mang secret mặc định lên prod là
   crash ngay, không đợi request đầu tiên.

## 6. Bẫy đã rơi vào khi làm M5

1. **`ConfigType` trong constructor decorated phải `import type`** (TS1272 +
   `isolatedModules`) — value import là sai, `import type` mới đúng (ngược với
   bẫy `import type { DataSource }` của M3: cái đó cần value vì là DI token).
2. **TypeORM 1.x: `revokedAt: null` trong criteria không compile** — phải dùng
   `IsNull()`.
3. **E2E chạy file song song**: `afterAll` cleanup `LIKE 'e2e-%'` của file này
   xóa nhầm data file kia đang chạy -> fail ảo. Fix: cleanup `IN (email cụ thể)`.

## 7. Thử tay

```powershell
$ct = 'application/json'
# 1. register
$r = Invoke-RestMethod -Uri http://127.0.0.1:3000/api/auth/register -Method Post -ContentType $ct `
     -Body '{"email":"me@m5.dev","password":"MatKhau@123","fullName":"Me"}'
$A = $r.data.accessToken; $R = $r.data.refreshToken
# 2. gọi API kèm token
Invoke-RestMethod -Uri http://127.0.0.1:3000/api/users -Headers @{ Authorization = "Bearer $A" }
# 3. không token -> 401; customer POST /users -> 403
# 4. refresh (rotate)
$n = Invoke-RestMethod -Uri http://127.0.0.1:3000/api/auth/refresh -Method Post -ContentType $ct `
     -Body (@{ refreshToken = $R } | ConvertTo-Json)
# 5. dùng lại R cũ -> 401 + đá hết session
# 6. login admin seed rồi POST /users tạo admin mới
```

## 8. Bài tập (40 phút)

1. Thêm `POST /api/auth/change-password` (cần auth): verify password cũ, hash mới,
   revoke hết refresh token (đổi pass là đá mọi thiết bị — chuẩn bảo mật).
2. Viết cron/job dọn dòng `refresh_tokens` hết hạn + revoked quá 30 ngày (bảng này
   chỉ phình, không ai xóa).
3. Thêm test: admin đổi role customer thành admin qua PATCH -> 200; customer tự
   PATCH `isActive:true` -> 403.
4. Suy nghĩ: access stateless 15' — nếu admin bị hạ quyền, 15' đó hắn vẫn gọi được
   API admin. Chấp nhận hay check DB mỗi request? Chi phí mỗi bên là gì?
   (Gợi ý: denylist jti trong Redis — preview M10.)

## 9. Checkpoint

- [ ] Vì sao access stateless mà refresh stateful? Đảo lại được không?
- [ ] Rotation + reuse detection chống được kịch bản đánh cắp nào, không chống được gì?
- [ ] Vì sao login 1 message chung mà register lại 409 lộ tồn tại?
- [ ] Refresh race (2 request song song) hậu quả gì, fix bằng gì ở M8?
- [ ] `@Public()` cả class vs từng method — khi nào hở bảo mật?
- [ ] Thứ tự APP_GUARD đảo lại (Roles trước Jwt) thì vỡ thế nào?

## 10. Câu hỏi PV từ M5

1. JWT cấu tạo 3 phần gì, server verify cái gì khi nhận token?
2. Lưu access ở đâu (memory/localStorage/cookie)? XSS vs CSRF tradeoff?
3. Refresh rotation là gì, reuse detection để làm gì?
4. Revoke JWT stateless bằng cách nào? (denylist, short TTL, version claim)
5. Bcrypt/scrypt/argon2 khác nhau thế nào, vì sao password cần salt + chậm mà
   refresh token chỉ cần SHA-256?

---
Tiếp theo **M6: Categories + Products** — relations (`@ManyToOne/@OneToMany`),
QueryBuilder join, chống N+1 (`leftJoinAndSelect` vs lazy), và `addSelect`
passwordHash kiểu này sẽ gặp lại khi load relation có điều kiện.
