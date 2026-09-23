# M1 — Controller / Provider / Module + DI chuyên sâu

> Mục tiêu: hiểu DI container của Nest ở mức đi phỏng vấn được, phân biệt được 4 loại provider, 3 scope, lifecycle hooks, `@Global` vs `forwardRef`, và biết test DI bằng `overrideProvider` (= `@MockBean`).
> Code demo: `src/core/` + `src/modules/di-demo/` (playground, sau này module domain thật ở M4+ sẽ thay chỗ này).

## 1. File mới / sửa trong M1

```text
src/core/
  app-info.token.ts      # APP_INFO token + interface AppInfo
  id.service.ts          # singleton mẫu, có instanceId để đối chiếu
  core.module.ts         # @Global(), export useFactory APP_INFO + IdService
src/modules/di-demo/
  tokens.ts              # GREETING, FEATURE_FLAGS
  transient-counter.service.ts  # Scope.TRANSIENT
  request-id.service.ts         # Scope.REQUEST (đọc x-request-id)
  lifecycle.service.ts          # 4 hooks + Logger
  node-a.service.ts / node-b.service.ts  # circular gỡ bằng forwardRef
  di-demo.service.ts     # singleton tổng hợp: inject global + custom + ModuleRef resolve transient + circular
  di-demo.controller.ts  # 5 route demo; bị lan truyền request-scope (xem §5)
  di-demo.module.ts      # khai báo useFactory (GREETING) + useValue (FEATURE_FLAGS)
  di-demo.spec.ts        # 3 test: mock token, transient khác instance, circular
src/modules/health/health.controller.ts  # thêm GET /api/health/info dùng @Global
src/app.module.ts        # import CoreModule + DiDemoModule
.env / .env.example      # thêm GREETING_OWNER=shop-mini
```

## 2. Module graph — map Spring

| Spring | Nest M1 | Ý nghĩa thực tế |
|---|---|---|
| `@Configuration` + `@Bean` | `@Module({providers, exports})` | Đơn vị đóng gói DI. Muốn module khác dùng → phải `exports`, bên dùng phải `imports`. Quên 1 trong 2 là lỗi `Nest can't resolve dependencies` |
| `@ComponentScan` toàn app | `CoreModule` + `@Global()` | Shared beans (AppInfo, IdService) dùng khắp nơi không cần import. Chỉ dùng cho hạ tầng thật chung |
| `@SpringBootApplication` scan tất cả | `AppModule imports: [Config, Core, Health, DiDemo]` | Root graph tường minh — nhìn `AppModule` là biết app có gì |
| Circular gỡ bằng proxy | `forwardRef(() => X)` cả 2 phía | Bắt buộc explicit. Gặp circular thật → nên tách service thứ 3 thay vì forwardRef. Lưu ý ESM: param vòng tròn phải typed `any` + cast `InstanceType<...>` tại chỗ dùng (xem `node-a/b.service.ts`), nếu không `emitDecoratorMetadata` gây `ReferenceError` lúc load file |

```ts
// Dynamic module đã dùng từ M0 mà chưa gọi tên:
ConfigModule.forRoot({ isGlobal: true, envFilePath: ['.env'] })
// forRoot(...) = static method trả về DynamicModule (module tạo lúc runtime theo options).
// Giống Spring Boot Starter auto-config theo properties.
```

## 3. 4 loại provider (thuộc lòng khi PV)

```ts
// 1. Standard (class) — 90% code:
providers: [DiDemoService] // token = chính class

// 2. useValue — hằng số/static:
{ provide: FEATURE_FLAGS, useValue: { newCheckout: false } }

// 3. useFactory — tạo động, được inject provider khác:
// GREETING phụ thuộc ConfigService + APP_INFO (global):
{
  provide: GREETING,
  inject: [ConfigService, APP_INFO],
  useFactory: (config: ConfigService, appInfo: AppInfo) =>
    `hello from ${config.get('GREETING_OWNER', 'shop-mini')} [${appInfo.nodeEnv}]`,
}

// 4. useClass / useExisting (chưa demo, nhớ tên):
// useClass: 1 token map sang class khác (strategy pattern: { provide: PAYMENT, useClass: VnpayPayment })
// useExisting: alias 1 token sang provider đã có (singleton dùng chung, không tạo mới)
```

Inject token không phải class thì **bắt buộc** `@Inject(TOKEN)`:

```ts
constructor(@Inject(APP_INFO) private readonly appInfo: AppInfo) {}
// Quên @Inject với string token → lỗi resolve (vì không còn type metadata để đoán).
```

## 4. Controller — những gì dân Spring cần nhớ

- `@Controller('di-demo') + @Get('singleton')` = `@RequestMapping("di-demo") + @GetMapping("singleton")` → `GET /api/di-demo/singleton` (đã prefix `/api` ở `main.ts`).
- Param/query/body: `@Param('id')`, `@Query('page')`, `@Body()` + DTO (M2 siết validation).
- Controller nên mỏng: parse input → gọi service → trả DTO. Logic nghiệp vụ nằm ở `providers`, không nằm ở controller (giống Service layer trong Spring).

## 5. 3 scope — phần dễ mất điểm nhất

| Scope | Nest | Spring tương đương | Khi nào dùng |
|---|---|---|---|
| `DEFAULT` (singleton) | 1 instance toàn app | singleton | Mặc định, dùng cho mọi service stateless |
| `TRANSIENT` | mỗi **consumer** 1 instance riêng; muốn nhiều instance độc lập thì `moduleRef.resolve()` mỗi lần 1 cái mới | prototype (gần đúng) | Builder/counter/strategy có state theo consumer. Demo: `describeTransients()` resolve 2 lần → `sameInstance: false` |
| `REQUEST` | mỗi HTTP request 1 instance | `@RequestScope` | request-id, tenant, user-context. Demo: `RequestIdService` đọc `x-request-id` |

**Bẫy lan truyền (bắt buộc nhớ):**
`DiDemoController` inject `RequestIdService` (request-scoped) → **cả controller thành request-scoped**: mỗi request tạo controller mới. Gọi 2 lần `GET /api/di-demo/scopes` sẽ thấy `controllerInstanceId` khác nhau, còn singleton (`IdService`) giữ nguyên. Trong code thật: đừng inject request-scoped vào service singleton dùng chung; tách controller riêng cho route cần request-context.

## 6. Lifecycle hooks (thứ tự start/stop)

```
start: onModuleInit → onApplicationBootstrap → listen
stop (SIGTERM/SIGINT, cần enableShutdownHooks đã bật ở main.ts):
  beforeApplicationShutdown(signal) → onModuleDestroy
```

Xem `LifecycleService`: mỗi hook log + push vào `events[]`, check qua `GET /api/di-demo/lifecycle`. Tương đương Spring: `@PostConstruct` → `CommandLineRunner` → `@PreDestroy`.

## 7. Test DI — `overrideProvider` (= `@MockBean`)

`di-demo.spec.ts` dùng `Test.createTestingModule(...).overrideProvider(GREETING).useValue('hello-test')` để mock token. 3 test hiện tại:
1. Mock `GREETING` inject đúng giá trị mock.
2. 2 lần `ModuleRef.resolve()` transient cho 2 instance khác nhau (`sameInstance === false`). Nhớ: inject 2 lần vào cùng 1 constructor vẫn CHUNG 1 instance của consumer đó.
3. Circular `ping()` → `'node-a -> node-b-pong'`.

Chạy: `npm test -- di-demo` (vitest filter theo tên file).

## 8. Thử tay (sau `npm run start:dev`)

```powershell
Invoke-RestMethod http://127.0.0.1:3000/api/health/info | ConvertTo-Json -Depth 5
Invoke-RestMethod http://127.0.0.1:3000/api/di-demo/singleton | ConvertTo-Json -Depth 5
Invoke-RestMethod http://127.0.0.1:3000/api/di-demo/tokens | ConvertTo-Json -Depth 5
Invoke-RestMethod http://127.0.0.1:3000/api/di-demo/circular | ConvertTo-Json -Depth 5
Invoke-RestMethod http://127.0.0.1:3000/api/di-demo/scopes -Headers @{'x-request-id'='demo-1'} | ConvertTo-Json -Depth 5
# Gọi /scopes 2 lần, so controllerInstanceId + transients.a/b.instanceId (đổi), requestId (theo header/lần đầu random)
Invoke-RestMethod http://127.0.0.1:3000/api/di-demo/lifecycle | ConvertTo-Json -Depth 5
```

## 9. Bài tập (20 phút)

1. Đổi `FEATURE_FLAGS.newCheckout` thành `true` trong `di-demo.module.ts`, gọi lại `/tokens` — hiểu `useValue` là static.
2. Bỏ `exports: [DiDemoService]` rồi tự tạo 1 module khác inject `DiDemoService` — đọc lỗi resolve, rồi trả lại.
3. Bỏ 1 phía `forwardRef` trong `node-a/b.service.ts`, chạy lại và đọc lỗi circular — rồi trả lại.
4. Thêm header `x-request-id: demo-1` gọi `/scopes` 2 lần: `requestId` giữ `demo-1`, các id khác đổi — giải thích vì sao.

## 10. Checkpoint (trả lời được mới qua M2)

- [ ] Kể 4 loại provider + ví dụ trong code M1 cho từng loại.
- [ ] Phân biệt `imports` vs `providers` vs `exports` vs `@Global`.
- [ ] TRANSIENT khác REQUEST ở điểm nào? Bẫy lan truyền request-scope là gì?
- [ ] Thứ tự lifecycle hooks khi start/stop? Cần gì để hook stop chạy?
- [ ] `overrideProvider` dùng để làm gì? Tương đương gì trong Spring Test?

## 11. Câu hỏi PV từ M1

1. DI container của Nest resolve dependency thế nào? Token là gì?
2. Khi nào dùng `useFactory` vs `useValue` vs `useClass` vs `useExisting`?
3. Singleton/Request/Transient khác nhau ra sao? Cái nào nguy hiểm nhất khi dùng sai?
4. `forwardRef` hoạt động thế nào, vì sao Spring không cần mà Nest cần?
5. Dynamic module (`forRoot/forFeature`) là gì? Cho ví dụ.

---
Tiếp theo **M2: Validation/Pipe/Exception/Logging/Config** — chuẩn response, `ExceptionFilter` (= `@ControllerAdvice`), typed config validate bằng `Joi/Zod`, Pino logger, và viết `GET /api/di-demo/echo` để thấy pipe hoạt động.
