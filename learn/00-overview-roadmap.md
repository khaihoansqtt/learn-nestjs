# 00 — Tổng quan lộ trình học NestJS qua dự án thực tế

> Dành cho: đã vững Spring Framework + tư duy backend/system design + JS, yếu TS.
> Mục tiêu: đi làm / phỏng vấn backend NestJS.
> Dự án: **shop-mini** — E-commerce mini backend.
> Stack: NestJS 12 (ESM) + TS strict + Postgres 16 (Docker) + TypeORM (từ M3) + JWT + Swagger + Vitest.

## 1. Cấu trúc repo

```text
D:\Study\learn-nestjs\
  src/
    main.ts                 # entrypoint (= SpringBootApplication.main)
    app.module.ts           # root module (= @SpringBootApplication + @Configuration)
    app.controller.ts       # demo controller gốc
    app.service.ts          # demo provider gốc
    modules/
      health/               # M0: ví dụ Module/Controller chuẩn
      users/                # M4
      auth/                 # M5
      categories|products/  # M6
      cart|orders|payments| # M8-M9
      reviews|upload|mail/  # M7, M10-M11
    common/                 # M2: filters, pipes, interceptors, decorators
    config/                 # M2-M3: validation env, typeorm config
    database/               # M3: migrations, seeds
  test/                     # e2e (vitest + supertest)
  docker-compose.yml        # Postgres + Adminer
  .env / .env.example
  learn/                    # docs học từng module (bạn đang đọc)
    00-overview-roadmap.md
    M0-setup-typescript.md
    M1-... (sẽ tạo tiếp mỗi module)
```

Quy ước mỗi module học:
1. `learn/Mx-ten-module.md` — lý thuyết + map Spring->Nest + bài tập
2. Code trong `src/` + verify bằng `npm run build`, `npm run lint`, test tay qua curl/Thunder Client
3. Checkpoint cuối file md — tự trả lời được mới qua module tiếp

## 2. Roadmap 13 module

| Module | Tên | Output chính | Map Spring |
|---|---|---|---|
| M0 | Setup + TS cấp tốc | Chạy được `GET /api/health`, Docker Postgres lên | Maven/Gradle -> npm, `application.yml` -> `.env` + ConfigModule |
| M1 | Controller/Provider/Module, DI | Hiểu DI container, scope, lifecycle | `@Controller/@Service/@Configuration`, IoC |
| M2 | Validation/Pipe/Exception/Logging/Config | Chuẩn response `{data,meta}`, global filter | Bean Validation, `@ControllerAdvice`, Logback |
| M3 | Postgres + TypeORM + Migration | Kết nối DB, migration đầu tiên | JPA/Hibernate, Flyway/Liquibase |
| M4 | Users CRUD | Paging/filter, soft-delete, DTO | Spring Data JPA + Pageable |
| M5 | Auth JWT + RBAC | Access/refresh rotation, RolesGuard | Spring Security filter chain + `@PreAuthorize` |
| M6 | Categories + Products | Relations, QueryBuilder, chống N+1 | `@OneToMany/@ManyToMany`, JPQL |
| M7 | Upload file | Multer local -> S3 | `MultipartFile` |
| M8 | Cart + Orders + Transaction | `SELECT FOR UPDATE`, state machine | `@Transactional`, optimistic/pessimistic lock |
| M9 | Payments mock + Webhook | Idempotency | Webhook Stripe/VNPay |
| M10 | Reviews + Redis cache/throttle | CacheInterceptor, Rate-limit | Spring Cache + Redis, Bucket4j |
| M11 | BullMQ + Mail + Cron + WS | Queue mail, cron dọn cart | `@Async/@Scheduled`, WebSocket |
| M12 | Swagger + Docker + Test + CI + Ôn PV | Dockerfile multi-stage, unit+e2e, GHA | JUnit/Mockito/Testcontainers, Jenkins/GHA |

Thời gian gợi ý: ~5-6 tuần nếu 2h/ngày. M0-M2 đi nhanh vì bạn đã mạnh Spring.

## 3. Lệnh dùng hàng ngày

```powershell
# DB
docker compose up -d        # start Postgres + Adminer
docker compose ps
docker compose logs db -f

# App
npm run start:dev           # watch mode (= spring-boot:run + devtools)
npm run build               # nest build
npm run lint                # oxlint src/ test/
npm test                    # vitest run
npm run test:e2e            # vitest e2e

# Kiểm tra API
Invoke-RestMethod http://localhost:3000/api/health | ConvertTo-Json
# Adminer: http://localhost:8080 (system=PostgreSQL, server=db, user=shop, pass=shop123, db=shop_mini)
```

## 4. Quy tắc code khi đi làm (áp từ M0)

1. Luôn prefix `/api`, luôn `ValidationPipe` global với `whitelist + forbidNonWhitelisted + transform`.
2. Không để secret trong code — chỉ `.env`, có `.env.example`.
3. Không dùng `synchronize: true` ở production (sẽ học ở M3, dùng migration).
4. DTO vào, Entity ra — không expose Entity trực tiếp (sẽ học `class-transformer @Exclude` ở M4).
5. Mỗi PR/module phải `build + lint + test` xanh.

---
Tiếp theo: đọc `learn/M0-setup-typescript.md`.
