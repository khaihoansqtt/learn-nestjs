import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { DataSource, type Logger } from 'typeorm';
import { AppModule } from './../src/app.module.js';
import { setupApp } from './../src/setup-app.js';
import { hashPassword } from './../src/modules/users/password.util.js';
import { UserRole } from './../src/modules/users/user.entity.js';

// E2E categories + products: cây danh mục, slug, FK, JOIN nhúng category,
// và ĐẾM QUERY chứng minh list không N+1 (xem test 'không N+1').
describe('Categories + Products (e2e)', () => {
  let app: INestApplication<App>;
  const runId = Date.now();
  const adminEmail = `e2e-m6-admin-${runId}@example.com`;
  let adminAccess = '';
  let rootId = '';
  let childId = '';

  const auth = () => ({ Authorization: `Bearer ${adminAccess}` });

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleFixture.createNestApplication();
    setupApp(app);
    await app.init();

    const ds = app.get(DataSource);
    await ds.getRepository('User' as never).insert({
      email: adminEmail,
      fullName: 'M6 Admin',
      passwordHash: hashPassword('Admin@123'),
      role: UserRole.ADMIN,
      isActive: true,
    } as never);
    const login = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: adminEmail, password: 'Admin@123' })
      .expect(200);
    adminAccess = login.body.data.accessToken;
  });

  afterAll(async () => {
    const ds = app.get(DataSource);
    await ds.query(`DELETE FROM "products" WHERE "slug" LIKE 'e2e-%'`);
    await ds.query(`DELETE FROM "categories" WHERE "slug" LIKE 'e2e-%'`);
    await ds.query(`DELETE FROM "users" WHERE "email" IN ($1)`, [adminEmail]);
    await app.close();
  });

  it('POST /categories -> tự sinh slug tiếng Việt', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/categories')
      .set(auth())
      .send({ name: `E2E Điện Thoại ${runId}` })
      .expect(201);
    rootId = res.body.data.id;
    if (!res.body.data.slug.startsWith('e2e-dien-thoai-'))
      throw new Error(`slug sai: ${res.body.data.slug}`);
  });

  it('POST category con (parentId) -> 201', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/categories')
      .set(auth())
      .send({ name: `E2E iPhone ${runId}`, parentId: rootId })
      .expect(201);
    childId = res.body.data.id;
    if (res.body.data.parentId !== rootId) throw new Error('parentId sai');
  });

  it('POST category parentId lạ -> 404', async () => {
    await request(app.getHttpServer())
      .post('/api/categories')
      .set(auth())
      .send({
        name: `E2E Mồ Côi ${runId}`,
        parentId: '00000000-0000-4000-8000-000000000000',
      })
      .expect(404);
  });

  it('GET /categories/tree (public, không token) -> lồng cha-con', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/categories/tree')
      .expect(200);
    const root = res.body.data.find(
      (n: { id: string }) => n.id === rootId,
    ) as { children: Array<{ id: string }> } | undefined;
    if (!root) throw new Error('thiếu root trong tree');
    if (!root.children.some((c) => c.id === childId))
      throw new Error('thiếu child trong tree');
  });

  it('PATCH tự làm cha chính mình -> 400; tạo cycle -> 400', async () => {
    await request(app.getHttpServer())
      .patch(`/api/categories/${rootId}`)
      .set(auth())
      .send({ parentId: rootId })
      .expect(400);

    await request(app.getHttpServer())
      .patch(`/api/categories/${rootId}`)
      .set(auth())
      .send({ parentId: childId })
      .expect(400);
  });

  it('POST /products 5 món (public đọc, ADMIN ghi)', async () => {
    for (let i = 1; i <= 5; i++) {
      await request(app.getHttpServer())
        .post('/api/products')
        .set(auth())
        .send({
          name: `E2E Pro ${runId} ${i}`,
          price: 100000 + i * 1000,
          stock: i,
          categoryId: childId,
        })
        .expect(201);
    }
    // Không token mà POST -> 401 (ghi cần auth).
    await request(app.getHttpServer())
      .post('/api/products')
      .send({ name: 'X', price: 1, categoryId: childId })
      .expect(401);
  });

  it('GET /products (public) -> category nhúng sẵn, price là number', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/products?q=e2e-pro-${runId}&limit=5&sort=price&order=asc`)
      .expect(200);
    const { items, total } = res.body.data;
    if (total !== 5) throw new Error(`total phải 5, được ${total}`);
    for (const p of items as Array<Record<string, unknown>>) {
      if (typeof p.price !== 'number') throw new Error('price phải là number (numeric transformer)');
      if (!(p.category as { id?: string } | undefined)?.id)
        throw new Error('thiếu category nhúng');
    }
    const prices = (items as Array<{ price: number }>).map((p) => p.price);
    const sorted = [...prices].sort((a, b) => a - b);
    expect(prices).toEqual(sorted);
  });

  it('GET /products list 5 dòng chỉ tốn 2 query (không N+1)', async () => {
    const ds = app.get(DataSource);
    const queries: string[] = [];
    // Logger tạm hứng query: setOptions đổi được cả khi DataSource đã connect
    // (xem DataSource.setOptions). Xong phải TRẢ LẠI logger cũ trong finally.
    const capture: Logger = {
      logQuery: (q: string) => void queries.push(q),
      logQueryError: () => {},
      logQuerySlow: () => {},
      logSchemaBuild: () => {},
      logMigration: () => {},
      log: () => {},
    };
    const original = (ds as unknown as { logger: Logger }).logger;
    (ds as unknown as { setOptions: (o: object) => void }).setOptions({
      logger: capture,
    });
    try {
      await request(app.getHttpServer())
        .get(`/api/products?q=e2e-pro-${runId}&limit=5`)
        .expect(200);
    } finally {
      (ds as unknown as { setOptions: (o: object) => void }).setOptions({
        logger: original,
      });
    }
    // N+1 sẽ là 1 (list) + 5 (category mỗi dòng) + 1 (count) = 7.
    // JOIN đúng: 1 (items + category) + 1 (count) = 2.
    const selects = queries.filter((q) => q.trimStart().startsWith('SELECT'));
    if (selects.length > 3) {
      throw new Error(`nghi N+1: ${selects.length} SELECT cho 5 dòng:\n${selects.join('\n')}`);
    }
  });

  it('POST product categoryId lạ -> 404; trùng slug -> 409', async () => {
    await request(app.getHttpServer())
      .post('/api/products')
      .set(auth())
      .send({
        name: `E2E Ghost ${runId}`,
        price: 1,
        categoryId: '00000000-0000-4000-8000-000000000000',
      })
      .expect(404);

    await request(app.getHttpServer())
      .post('/api/products')
      .set(auth())
      .send({
        name: `E2E Pro ${runId} 1`,
        price: 1,
        categoryId: childId,
      })
      .expect(409);
  });

  it('DELETE category còn product -> 409 (service chặn, FK chặn nốt)', async () => {
    await request(app.getHttpServer())
      .delete(`/api/categories/${childId}`)
      .set(auth())
      .expect(409);
  });

  it('DELETE customer product bị cấm; admin xóa mềm xong restore được', async () => {
    // Login customer nhanh qua register.
    const reg = await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({
        email: `e2e-m6-cust-${runId}@example.com`,
        password: 'MatKhau@123',
        fullName: 'M6 Customer',
      })
      .expect(201);
    const custToken = reg.body.data.accessToken as string;

    const list = await request(app.getHttpServer())
      .get(`/api/products?q=e2e-pro-${runId}&limit=1`)
      .expect(200);
    const pid = list.body.data.items[0].id as string;

    await request(app.getHttpServer())
      .delete(`/api/products/${pid}`)
      .set({ Authorization: `Bearer ${custToken}` })
      .expect(403);

    await request(app.getHttpServer())
      .delete(`/api/products/${pid}`)
      .set(auth())
      .expect(200);
    await request(app.getHttpServer()).get(`/api/products/${pid}`).expect(404);

    await request(app.getHttpServer())
      .post(`/api/products/${pid}/restore`)
      .set(auth())
      .expect(201);
    await request(app.getHttpServer()).get(`/api/products/${pid}`).expect(200);

    await app
      .get(DataSource)
      .query(`DELETE FROM "users" WHERE "email" = $1`, [
        `e2e-m6-cust-${runId}@example.com`,
      ]);
  });
});
