# M6 — Categories + Products

> Prereq: M0-M5. Output: danh mục cây + sản phẩm CRUD, JOIN nhúng category,
> test đếm query chứng minh không N+1.

## 1. Map Spring -> Nest

| Spring/JPA | NestJS/TypeORM | File |
|---|---|---|
| `@ManyToOne` self-join + `mappedBy` | `@ManyToOne(() => Category, c => c.children)` + `@OneToMany` | `category.entity.ts` |
| `@ManyToOne(fetch = LAZY)` | mặc định lazy (không `eager: true`) + `leftJoinAndSelect` tường minh | `products.service.ts` |
| JPQL `JOIN FETCH` | `leftJoinAndSelect('product.category', 'category')` |同上 |
| `BigDecimal` price | `numeric(12,2)` + `ValueTransformer` (driver pg trả string!) | `product.entity.ts` |
| Slug/URL thân thiện | `slugify()` (NFD strip dấu tiếng Việt) + unique index | `common/utils/slugify.util.ts` |
| `DataIntegrityViolationException` FK | `isFkViolation` (23503) -> 404/409 | `common/utils/postgres-error.util.ts` |
| `@RestController` public read | `@Public()` trên GET, `@Roles(ADMIN)` trên ghi | controllers |

## 2. Cấu trúc thêm vào

```text
src/modules/categories/   entity, dto x3, service (tree, cycle-check), controller, module
src/modules/products/     entity (NumericTransformer), dto x3, service (JOIN), controller, module
src/common/utils/         slugify + escape-like + postgres-error (dùng chung M4-M6)
migration 1790519937930   categories + products + FK (RESTRICT / SET NULL)
test/categories-products.e2e-spec.ts   11 tests (kèm đếm query)
```

## 3. Quan hệ và quy tắc xóa

```
Category 1-N Category (parent/children, self-FK ON DELETE SET NULL)
Category 1-N Product  (FK ON DELETE RESTRICT)
```

- Xóa category: service chặn 409 nếu còn con hoặc còn product; FK là chốt cuối.
- Xóa cha (`SET NULL`): con thành gốc, không mất cả cây (khác CASCADE).
- Xóa product: mềm (`deletedAt`) như users — giữ lịch sử cho đơn hàng M8.

## 4. Chống N+1 (phần lõi)

Relation để **LAZY**, không `eager: true` (eager tiện nhưng mọi query đều JOIN
theo, mất kiểm soát). Mỗi case join tường minh:

- `findAll`: `leftJoinAndSelect` -> items + category trong **1 query**
  (+1 query count) = 2 query cố định dù page 5 hay 100 dòng.
- `findOne`: cùng 1 QB join để shape **nhất quán** với list.
- `tree()`: **1 query** `find()` + build cây memory O(n), không đệ quy query
  từng tầng. Cây chục nghìn node mới cần nested-set/ltree.

Test e2e gắn logger tạm (`DataSource.setOptions({logger})`) đếm SELECT của
`GET /products?limit=5`: N+1 sẽ là 7 SELECT (1 list + 5 category + 1 count),
JOIN đúng là 2. Test fail nếu > 3.

## 5. 4 quyết định dữ liệu phải nhớ

1. **Slug ổn định**: sinh lúc tạo, rename KHÔNG tự đổi (URL cũ phải sống),
   chỉ đổi khi gửi `slug` tường minh. Slug rỗng sau normalize (`'!!!'`) -> 400.
2. **Giá numeric**: driver pg trả string — transformer ép number ở entity
   (1 chỗ, mọi query đúng). Alternative: lưu integer subunit (VND không có subunit).
3. **Re-fetch sau save để shape nhất quán**: entity vừa `save()` không có
   relation loaded (chỉ có `categoryId`), và sau đổi `categoryId` thì object
   `category` cũ bị stale — `create`/`update` đều `findOne()` lại (đã JOIN)
   trước khi trả. Bẫy này lòi ra khi test tay: POST trả `category` rỗng.
4. **Cycle cây**: `parentId === id` chặn ngay; cycle dài (A->B->A) check bằng
   ancestor-walk có `visited`-set; `tree()` vẫn guard tự trỏ để JSON không
   đệ quy vô hạn nếu data cũ bẩn.

## 6. Thử tay

```powershell
$ct = 'application/json'
$admin = (Invoke-RestMethod -Uri http://127.0.0.1:3000/api/auth/login -Method Post `
  -ContentType $ct -Body '{"email":"admin@shop-mini.local","password":"Admin@123"}').data.accessToken
$H = @{ Authorization = "Bearer $admin" }
$cat = Invoke-RestMethod -Uri http://127.0.0.1:3000/api/categories -Method Post -ContentType $ct -Headers $H `
  -Body '{"name":"Điện Thoại"}'
Invoke-RestMethod -Uri http://127.0.0.1:3000/api/categories/tree
Invoke-RestMethod -Uri "http://127.0.0.1:3000/api/products?categoryId=$($cat.data.id)&sort=price&order=asc"
```

## 7. Bài tập (40 phút)

1. Thêm `PATCH /products/:id/stock` cộng/trừ tồn kho (`{delta: -2}`, chặn âm) —
   tiền đề cho trừ kho transaction ở M8 (gợi ý: race ở đây fix bằng gì?).
2. Thêm filter `slug` exact-match cho cả 2 list (lookup URL `/c/:slug` kiểu storefront).
3. Viết migration partial index `UQ_users_email WHERE deletedAt IS NULL`
   (bài tập M4 còn nợ) — pattern y hệt index M6 này.
4. Suy nghĩ: category tree 10.000 node — `tree()` 1 query + memory còn ổn không?
   Khi nào cần `ltree`/nested-set/closure-table?

## 8. Checkpoint

- [ ] `eager: true` tiện ở đâu, hại ở đâu? Vì sao project cấm?
- [ ] N+1 là gì, đếm query kiểu gì để bắt nó?
- [ ] `leftJoinAndSelect` khác `innerJoinAndSelect` khi nào (product luôn có category ở đây thì sao)?
- [ ] Vì sao rename không đổi slug? Khi nào ĐƯỢC đổi slug?
- [এ] RESTRICT vs CASCADE vs SET NULL — mỗi cái cho case nào ở M6?
- [ ] numeric pg trả string — transformer chạy lúc nào (insert/select)?

## 9. Câu hỏi PV từ M6

1. Lazy vs Eager loading, N+1 query problem và 3 cách fix?
2. Self-referencing entity (cây) model/query thế nào? Adjacency list vs nested set?
3. Unique slug race: 2 request cùng slug cùng lúc — check-trước có đủ không?
   (Không — 23505 backstop, giống M4.)
4. Giá tiền lưu numeric/float/integer? Float hại gì? (0.1+0.2)
5. Soft-delete product ảnh hưởng unique slug thế nào? (Giống bài M4: slug của
   product đã xóa mềm vẫn chặn tạo mới — muốn tái dùng slug thì partial index.)

---
Tiếp theo **M7: Upload file** — Multer local -> S3, ảnh sản phẩm (relation
Product 1-N ProductImage sẽ dùng lại JOIN M6), validate MIME/size, serve static.
