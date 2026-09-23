# M2 — Validation / Pipe / ExceptionFilter / Interceptor / Config / Logger

> Mục tiêu: mọi API nói cùng 1 "ngôn ngữ" — thành công `{ data, meta? }`, lỗi `{ statusCode, message[], error, path, timestamp, requestId }`; env sai thì crash ngay lúc start; log structured có requestId để trace.
> Từ M2 trở đi `GET /api/...` success đều bị bọc `data` (kể cả health cũ) — đó là chủ ý, không phải bug.

## 1. File mới / sửa trong M2

```text
src/common/filters/http-exception.filter.ts (+ .spec.ts)
  # @Catch() toàn cục — chuẩn hóa HttpException + lỗi lập trình thành error envelope
src/common/interceptors/transform.interceptor.ts
  # Bọc response thành công thành { data, meta? }
src/common/decorators/response-meta.decorator.ts
  # @ResponseMeta({...}) — meta tĩnh, interceptor đọc qua Reflector
src/setup-app.ts
  # Dùng chung cho main.ts + e2e: prefix /api + ValidationPipe global
src/config/app.config.ts + db.config.ts
  # registerAs('app'/'db') — typed config (= @ConfigurationProperties)
src/config/env.validation.ts
  # validateEnv bằng Joi, fail-fast lúc startup (Nest 12 chỉ nhận Standard Schema
  # cho validationSchema nên Joi phải bọc trong hàm validate custom)
src/main.ts
  # bufferLogs + pino Logger + port lấy từ config typed
src/app.module.ts
  # ConfigModule(load + validate) + LoggerModule(pino) + APP_FILTER/APP_INTERCEPTOR
src/modules/di-demo/echo-query.dto.ts + echo-body.dto.ts + echo.dto.spec.ts
  # Demo DTO query/body + test validate() độc lập HTTP
src/modules/di-demo/di-demo.controller.ts
  # GET/POST /api/di-demo/echo
test/app.e2e-spec.ts
  # Chạy setupApp thật + 6 case: envelope, 400 validation, 400 field lạ, 201, 404
```

Packages thêm: `joi`, `nestjs-pino`, `pino`, `pino-pretty` (dev).

## 2. Map Spring

| Spring | Nest M2 | File |
|---|---|---|
| Bean Validation `@Valid @NotBlank @Min` | `ValidationPipe` global + `class-validator` decorator trên DTO class | `setup-app.ts`, `echo-*.dto.ts` |
| `@RestControllerAdvice + @ExceptionHandler` | `@Catch() HttpExceptionFilter` đăng ký `APP_FILTER` | `http-exception.filter.ts` |
| `ResponseBodyAdvice` | `TransformInterceptor` đăng ký `APP_INTERCEPTOR`, đọc `@ResponseMeta` qua `Reflector` | `transform.interceptor.ts` |
| `application.yml + @ConfigurationProperties + @Validated` | `registerAs` + `ConfigModule.load` + `validateEnv` (Joi) | `config/` |
| Logback/Logstash JSON + MDC traceId | `nestjs-pino` JSON (prod) / pretty (dev) + `customProps.requestId` | `app.module.ts` |
| `@MockBean` (đã học M1) | `overrideProvider` (M1) + `validate()` DTO unit + supertest e2e (M2) | `*.spec.ts`, `test/` |

Thứ tự 1 request qua các tầng (thuộc lòng):
```
request -> Middleware -> GUARD -> INTERCEPTOR (trước) -> PIPE -> handler
  -> INTERCEPTOR (sau, bọc data) -> response
  -> ném lỗi ở BẤT KỲ đâu -> FILTER (chuẩn hóa) -> response lỗi
```
(= Spring: Filter -> Interceptor -> ArgumentResolver/Validator -> Controller -> ResponseBodyAdvice; lỗi -> ControllerAdvice)

## 3. ValidationPipe global — 4 công tắc đã bật

`whitelist: true` (strip field thừa) + `forbidNonWhitelisted: true` (field lạ -> 400, chống mass-assignment kiểu `isAdmin: true`) + `transform: true` + `enableImplicitConversion` (`"2"` -> `2`).

```ts
// echo-query.dto.ts — @Type(() => Number) + default values vẫn chạy nhờ transform:
export class EchoQueryDto {
  @IsOptional() @IsString() @MaxLength(50) search?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number = 1;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) limit?: number = 10;
}
```

## 4. Error envelope — đã verify runtime

`GET /api/di-demo/echo?limit=999`:
```json
{"statusCode":400,"message":["limit must not be greater than 100"],"error":"BAD_REQUEST","path":"/api/di-demo/echo?limit=999","timestamp":"...","requestId":"1"}
```
`POST /api/di-demo/echo` body `{"name":"Khai Hoan","isAdmin":true}`:
```json
{"statusCode":400,"message":["property isAdmin should not exist"],"error":"BAD_REQUEST","path":"/api/di-demo/echo","timestamp":"...","requestId":"1"}
```
`GET /api/khong-ton-tai` -> `404` envelope tương tự. Lỗi lập trình (non-HTTP) bị che thành `500 Internal Server Error`, không lộ stack/message nội bộ — xem test `che lỗi lập trình thành 500`.

`requestId` ưu tiên header `x-request-id` (client/gateway truyền), fallback id của pino. Từ M11 gateway/Cron sẽ dùng header này để trace xuyên service.

## 5. Success envelope — đã verify runtime

`GET /api/health` -> `{"data":{"status":"ok",...}}`
`GET /api/di-demo/echo?search=phone&page=2` -> `{"data":{"query":{"search":"phone","page":2,"limit":10}},"meta":{"demo":"query-validation"}}`
`POST /api/di-demo/echo` `{"name":"Khai Hoan","age":30}` -> `201 {"data":{"body":{...}}}`

## 6. Config typed + fail-fast

```ts
// Đọc type-safe, autocomplete, refactor không sợ typo key string:
@Inject(appConfig.KEY) cfg: ConfigType<typeof appConfig>
cfg.port // number — đã parse + validate, không còn process.env.PORT! khắp nơi
```
`validateEnv` crash app ngay nếu thiếu `DB_USER/DB_PASS/DB_NAME` (Joi `.required()`), gom hết lỗi 1 lần (`abortEarly: false`). Thử: xóa `DB_USER` khỏi `.env` rồi `npm run start:dev` — đọc message `Config validation error` rồi trả lại.

`envFilePath: ['.env', '.env.example']` — `.env` ưu tiên, thiếu thì fallback example (máy mới clone vẫn start được để học).

## 7. Logger (pino)

- Dev: pretty 1 dòng, level `debug`. Prod: JSON/line cho Loki/ELK, level `info`. Test (`VITEST=true` hoặc `NODE_ENV=test`): `silent` để output test sạch.
- `app.useLogger(app.get(Logger))` + `bufferLogs: true` — log lúc bootstrap cũng qua pino, không mất dòng nào.
- Muốn log trong service: `private readonly logger = new Logger(TenService.name)` (M1 đã dùng ở `LifecycleService`) — tự đi qua pino.

## 8. Test M2 (tổng unit 11 + e2e 6, đã xanh)

- `http-exception.filter.spec.ts`: 404 envelope giữ requestId header; 500 che stack; giữ mảng message của ValidationPipe.
- `echo.dto.spec.ts`: test decorator DTO bằng `plainToInstance + validate()` không cần HTTP. Nhớ `import 'reflect-metadata'` đầu file test độc lập (đã dính lỗi `Reflect.getMetadata is not a function` 1 lần).
- `di-demo.spec.ts` (M1) phải bổ sung `load: [appConfig, dbConfig] + validate` vì factory M2 giờ inject `appConfig.KEY` — TestingModule cũng phải đăng ký namespace y như AppModule.
- `test/app.e2e-spec.ts`: `setupApp(app)` để e2e chạy đúng prefix/pipe production; assert envelope + các case 400/404.

```powershell
npm test                    # 4 files, 11 tests
npm run test:e2e            # 1 file, 6 tests
```

## 9. Thử tay

```powershell
npm run start:dev
curl.exe -s "http://127.0.0.1:3000/api/di-demo/echo?search=phone&page=2"
curl.exe -s "http://127.0.0.1:3000/api/di-demo/echo?limit=999"
curl.exe -s -X POST http://127.0.0.1:3000/api/di-demo/echo -H "Content-Type: application/json" --data-binary "@body.json"
# body.json = {"name":"Khai Hoan","isAdmin":true} -> 400; {"name":"Khai Hoan"} -> 201
```

## 10. Bài tập (20 phút)

1. Xóa `DB_PASS` khỏi `.env`, start app, đọc lỗi Joi — rồi trả lại.
2. POST `{"name":"a"}` — đọc message `minLength`, đoán xem mảng `message` có mấy phần tử khi sai 2 rule cùng lúc.
3. Thêm `@ResponseMeta({ team: 'backend' })` lên `HealthController`, gọi `/api/health` kiểm tra `meta`.
4. Gửi header `x-request-id: demo-m2` vào 1 request lỗi — kiểm tra `requestId` trong body lỗi và trong log pino có khớp không.

## 11. Checkpoint

- [ ] Kể thứ tự Middleware -> Guard -> Interceptor -> Pipe -> handler -> Interceptor -> Filter khi lỗi.
- [ ] 4 công tắc ValidationPipe để làm gì? Vì sao DTO phải là class?
- [ ] APP_FILTER/APP_INTERCEPTOR khác gì `app.useGlobal*` trong main? (Gợi ý: e2e.)
- [ ] Vì sao Joi phải bọc trong `validate` ở Nest 12?
- [ ] `whitelist + forbidNonWhitelisted` chống được tấn công gì?

## 12. Câu hỏi PV từ M2

1. Pipe/Guard/Interceptor/Filter khác nhau thế nào, thứ tự chạy?
2. Làm sao chuẩn hóa response/error toàn app? (Envelope + ví dụ code.)
3. Mass-assignment là gì, chống bằng gì ở Nest?
4. Config validation fail-fast vì sao quan trọng? So với `@ConfigurationProperties`?
5. Pino vs Winston vs console — khi nào dùng gì? requestId trace để làm gì?

---
Tiếp theo **M3: Postgres + TypeORM + Migration** — `TypeOrmModule.forRootAsync` đọc `dbConfig`, entity đầu tiên, migration thay `synchronize`, seed admin. Lúc đó `useValue/useFactory` (M1) + typed config (M2) sẽ phát huy đúng chỗ.
