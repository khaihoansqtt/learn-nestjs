# M0 — Setup + TypeScript cấp tốc cho dân Spring

> Mục tiêu M0: dựng được project NestJS 12 chạy được, hiểu Module/Controller/Provider ở mức map được với Spring, nắm TS đủ để viết DTO/Entity từ M3 trở đi, Postgres chạy bằng Docker.
> Verify cuối: `GET http://localhost:3000/api/health` trả `{"status":"ok",...}`, `npm run build` + `npm run lint` xanh, `docker compose ps` thấy `shop-mini-db healthy`.

## 1. Những gì M0 đã setup sẵn cho bạn

- `nest new shop-mini --directory . --strict` — TS strict, ESM (`"type":"module"`, import phải có `.js` ở cuối).
- Thêm package: `@nestjs/config`, `class-validator`, `class-transformer`.
- `docker-compose.yml`: `postgres:16-alpine` + `adminer`. Volume `pgdata` để không mất data.
- `.env` + `.env.example`: `PORT, NODE_ENV, DB_HOST/PORT/USER/PASS/NAME`.
- `src/main.ts`: `setGlobalPrefix('api')` + `ValidationPipe` global + `enableShutdownHooks()`.
- `src/app.module.ts`: `ConfigModule.forRoot({isGlobal:true})` (= đọc `application.yml` 1 lần dùng khắp nơi).
- `src/modules/health/`: ví dụ tối giản 1 Module đúng chuẩn để bạn soi.

Chạy thử:

```powershell
docker compose up -d
npm run start:dev
# tab khác:
Invoke-RestMethod http://localhost:3000/api/health | ConvertTo-Json
Invoke-RestMethod http://localhost:3000/api | ConvertTo-Json
# Adminer: http://localhost:8080
```

## 2. Map tư duy Spring -> Nest (rất quan trọng)

| Spring Boot | NestJS | Ghi chú |
|---|---|---|
| `@SpringBootApplication` + `main()` | `AppModule` + `bootstrap()` trong `main.ts` | `NestFactory.create(AppModule)` tạo IoC container |
| `@Controller + @GetMapping` | `@Controller('health') + @Get()` | Giống 95%, chỉ khác tên decorator |
| `@Service/@Component` | `@Injectable()` + khai báo trong `providers: []` | Quên khai báo là lỗi `Nest can't resolve dependencies` — giống quên `@Bean/@ComponentScan` |
| `@Configuration + @Bean` | `@Module({imports, providers, exports})` | `exports` = public bean cho module khác dùng |
| `application.yml + @Value` | `ConfigModule` + `ConfigService.get('DB_HOST')` | M0 đã set `isGlobal:true` nên không cần import lại |
| Bean Validation `@Valid @NotBlank` | `ValidationPipe` + `class-validator` `@IsNotEmpty()` | Đã bật global ở `main.ts`, M2 học sâu |
| `@ControllerAdvice` | `ExceptionFilter` | M2 làm |
| Spring IoC (runtime reflection) | `reflect-metadata` + `emitDecoratorMetadata` | Bật sẵn trong `tsconfig.json`, đừng tắt |

```ts
// Spring:
// @RestController @RequestMapping("/health")
// public class HealthController { @GetMapping() ... }

// Nest (src/modules/health/health.controller.ts):
import { Controller, Get } from '@nestjs/common';

@Controller('health')
export class HealthController {
  @Get()
  check() {
    return { status: 'ok', timestamp: new Date().toISOString(), uptime: process.uptime() };
  }
}
```

## 3. TypeScript tối thiểu cho dân JS mạnh nhưng yếu TS

### 3.1 `interface` vs `type` vs `class` — khi nào dùng gì trong Nest?

```ts
// interface: hợp đồng dữ liệu, không emit JS — dùng cho response shape, options
interface Pagination { page: number; limit: number; }

// type: union/literal — dùng cho status, role
type OrderStatus = 'PENDING' | 'PAID' | 'SHIPPED' | 'DONE' | 'CANCELLED';
type Role = 'ADMIN' | 'USER';

// class: có decorator + runtime metadata — BẮT BUỘC cho DTO + Entity
import { IsEmail, IsNotEmpty, MinLength } from 'class-validator';

export class CreateUserDto {
  @IsEmail()
  email!: string;

  @IsNotEmpty()
  @MinLength(6)
  password!: string;
}
// Vì sao DTO phải là class? ValidationPipe dùng reflect-metadata đọc decorator lúc runtime.
// interface/type bị xóa sau compile nên không validate được.
```

### 3.2 Generics + Utility types (dùng mỗi ngày từ M4)

```ts
// Chuẩn response khi đi làm:
interface ApiResponse<T> {
  data: T;
  meta?: { page: number; total: number };
  message?: string;
}

// Partial/Pick/Omit/Pick — đừng tự viết tay UpdateDto:
import { PartialType } from '@nestjs/mapped-types'; // M4 sẽ dùng, M0 hiểu trước

export class UpdateUserDto implements Partial<CreateUserDto> {}
// Partial<T>: mọi field thành optional — giống PATCH trong REST
// Pick<T,'email'>: chỉ lấy email — dùng cho projection
// Omit<T,'password'>: bỏ password khi trả về client — chống lộ secret
```

### 3.3 Decorator — thứ bạn đã quen trong Spring

```ts
// Spring: @Autowired, @GetMapping, @Entity — Nest y hệt, chỉ là TS experimentalDecorators
// tsconfig.json đã bật: "experimentalDecorators": true, "emitDecoratorMetadata": true

import { Injectable } from '@nestjs/common';

@Injectable() // = @Service — đăng ký vào IoC, inject được qua constructor
export class AppService {
  getHello(): string {
    return 'Hello World!';
  }
}

// Constructor injection giống Spring:
import { Controller, Get } from '@nestjs/common';
@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {} // = @Autowired via constructor (chuẩn Spring)

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }
}
```

### 3.4 `strict` mode — 3 lỗi dân JS hay dính

```ts
// tsconfig: "strict": true, "strictPropertyInitialization": false
// 1. null/undefined không gán bừa được:
let name: string = 'shop';
// name = undefined; // ❌ TS2322 — phải khai string | undefined nếu cho phép

// 2. Query param luôn là string, phải transform:
 // GET /products?page=2 — page là "2", nhờ ValidationPipe transform + enableImplicitConversion (đã bật ở main.ts)

// 3. ! (non-null assertion) — dùng khi chắc chắn có giá trị (ví dụ env đã validate):
const port = process.env.PORT!; // biết chắc PORT có, hoặc dùng ConfigService
```

### 3.5 ESM `.js` suffix — bẫy của Nest 12

```ts
// ĐÚNG (dự án này là "type":"module"):
import { AppModule } from './app.module.js';
import { HealthModule } from './modules/health/health.module.js';

// SAI: thiếu .js sẽ lỗi ERR_MODULE_NOT_FOUND khi chạy compiled JS
// import { AppModule } from './app.module';
```

## 4. Bài tập M0 (15-20 phút, làm ngay trong `src/`)

1. Thêm `GET /api/health/db` trả `{db: 'not-connected-yet'}` — M3 sẽ thay bằng check Postgres thật. Mục đích: quen thêm route vào Controller.
2. Tự viết `CreateUserDto` (class + decorator) vào file tạm `src/create-user.dto.ts`, rồi xóa đi sau khi hiểu — M4 sẽ làm thật:
```ts
import { IsEmail, IsString, MinLength } from 'class-validator';
export class CreateUserDto {
  @IsEmail() email!: string;
  @IsString() @MinLength(6) password!: string;
}
```
3. Thử bỏ `HealthModule` khỏi `imports` trong `app.module.ts`, chạy lại và đọc lỗi `404 /api/health` — hiểu vai trò `imports`.

## 5. Lỗi thường gặp (Windows + Node 25)

- `port 5432 already in use`: máy đã cài Postgres local. Đổi `DB_PORT=5433` trong `.env` + `docker-compose.yml` hoặc tắt service local.
- `docker compose up -d` báo Docker Desktop chưa chạy: mở Docker Desktop trước.
- `EBADENGINE node v25`: warning từ `@angular-devkit`, bỏ qua được. Nếu `nest start` lỗi lạ, downgrade Node LTS 22 bằng `nvm`.
- `Cannot find module './app.module.js'`: do thiếu `.js` — Nest 12 ESM bắt buộc.
- `Nest can't resolve dependencies`: quên thêm Service vào `providers` hoặc Module vào `imports`.

## 6. Checkpoint tự đánh giá (trả lời được mới qua M1)

- [ ] Kể được vòng đời 1 request: `main.ts -> AppModule -> HealthModule -> HealthController.check()` tương đương gì trong Spring?
- [ ] Vì sao DTO phải là `class` chứ không phải `interface`?
- [ ] `whitelist + forbidNonWhitelisted + transform` trong `ValidationPipe` để làm gì?
- [ ] `ConfigModule.forRoot({isGlobal:true})` tương đương gì trong Spring Boot?
- [ ] Chạy xanh: `docker compose ps`, `npm run build`, `npm run lint`, `GET /api/health`.

## 7. Câu hỏi phỏng vấn hay gặp từ M0

1. DI container của Nest hoạt động thế nào? Khác gì Spring IoC?
2. `@Injectable/@Controller/@Module` thực chất là gì? (Gợi ý: function decorator + metadata).
3. Vì sao cần `reflect-metadata`?
4. Middleware vs Guard vs Interceptor vs Pipe — thứ tự chạy? (M1-M2 trả lời chi tiết, M0 nhớ tên trước).

---
Xong M0. Sang **M1: Controller/Provider/Module + DI scope/lifecycle** — mình sẽ tách `AppController` demo ra và viết `Config` typed bằng `Joi/Zod`.
