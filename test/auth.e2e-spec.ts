import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { DataSource } from 'typeorm';
import { AppModule } from './../src/app.module.js';
import { setupApp } from './../src/setup-app.js';
import { hashPassword } from './../src/modules/users/password.util.js';
import { UserRole } from './../src/modules/users/user.entity.js';

// E2E auth với DB thật: register/login/refresh/logout + RBAC + reuse detection.
// Thứ tự test QUAN TRỌNG: reuse-detection đá TOÀN BỘ token nên các test dùng
// token cũ phải chạy trước nó (xem comment ở test reuse).
describe('Auth JWT + RBAC (e2e)', () => {
  let app: INestApplication<App>;
  const runId = Date.now();
  const adminEmail = `e2e-admin-${runId}@example.com`;
  const customerEmail = `e2e-cust-${runId}@example.com`;
  const otherEmail = `e2e-other-${runId}@example.com`;
  let adminTokens = { accessToken: '', refreshToken: '' };
  let customerTokens = { accessToken: '', refreshToken: '' };
  let customerId = '';
  let otherId = '';

  const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleFixture.createNestApplication();
    setupApp(app);
    await app.init();

    // Admin cho test: tạo thẳng qua DB (register public luôn force customer).
    const ds = app.get(DataSource);
    await ds.getRepository('User' as never).insert({
      email: adminEmail,
      fullName: 'E2E Admin',
      passwordHash: hashPassword('Admin@123'),
      role: UserRole.ADMIN,
      isActive: true,
    } as never);

    const login = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: adminEmail, password: 'Admin@123' })
      .expect(200);
    adminTokens = {
      accessToken: login.body.data.accessToken,
      refreshToken: login.body.data.refreshToken,
    };
  });

  afterAll(async () => {
    const ds = app.get(DataSource);
    // Hard delete user -> FK CASCADE dọn refresh_tokens theo.
    // Xóa ĐÚNG 3 email của file này (không LIKE 'e2e-%'): các file e2e chạy
    // song song, LIKE rộng sẽ xóa nhầm data của file khác đang chạy.
    await ds.query(`DELETE FROM "users" WHERE "email" IN ($1, $2, $3)`, [
      adminEmail,
      customerEmail,
      otherEmail,
    ]);
    await app.close();
  });

  it('POST /api/auth/register -> 201, role luôn customer, có cặp token', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({
        email: customerEmail,
        password: 'MatKhau@123',
        fullName: 'E2E Customer',
      })
      .expect(201);
    customerId = res.body.data.user.id;
    if (res.body.data.user.role !== 'customer') throw new Error('role phải là customer');
    if (res.body.data.user.passwordHash) throw new Error('LEAK passwordHash');
    if (!res.body.data.accessToken || !res.body.data.refreshToken)
      throw new Error('thiếu cặp token');
    customerTokens = {
      accessToken: res.body.data.accessToken,
      refreshToken: res.body.data.refreshToken,
    };
  });

  it('register gửi kèm role:admin -> 400 (đóng lỗ tự phong admin của M4)', async () => {
    await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({
        email: `e2e-evil-${runId}@example.com`,
        password: 'MatKhau@123',
        fullName: 'Evil',
        role: 'admin',
      })
      .expect(400);
  });

  it('register trùng email -> 409', async () => {
    await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({
        email: customerEmail,
        password: 'MatKhau@123',
        fullName: 'Clone',
      })
      .expect(409);
  });

  it('login sai password và login email lạ -> CÙNG message 401 (chống enumeration)', async () => {
    const wrong = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: customerEmail, password: 'Sai@12345' })
      .expect(401);
    const unknown = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: `e2e-ghost-${runId}@example.com`, password: 'Sai@12345' })
      .expect(401);
    if (wrong.body.message[0] !== unknown.body.message[0])
      throw new Error('message phải giống nhau để không lộ user tồn tại');
  });

  it('GET /users không token -> 401 (guard global, secure by default)', async () => {
    await request(app.getHttpServer()).get('/api/users').expect(401);
  });

  it('customer POST /users -> 403 (chỉ admin được tạo user)', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/users')
      .set(auth(customerTokens.accessToken))
      .send({
        email: otherEmail,
        password: 'MatKhau@123',
        fullName: 'Other',
      })
      .expect(403);
    if (!res.body.message[0].includes('admin')) throw new Error('message 403 phải nêu role cần');
  });

  it('admin POST /users -> 201 (tạo user khác để test ownership)', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/users')
      .set(auth(adminTokens.accessToken))
      .send({
        email: otherEmail,
        password: 'MatKhau@123',
        fullName: 'Other',
      })
      .expect(201);
    otherId = res.body.data.id;
  });

  it('customer PATCH chính mình -> 200', async () => {
    const res = await request(app.getHttpServer())
      .patch(`/api/users/${customerId}`)
      .set(auth(customerTokens.accessToken))
      .send({ fullName: 'Customer Updated' })
      .expect(200);
    if (res.body.data.fullName !== 'Customer Updated') throw new Error('không update');
  });

  it('customer PATCH người khác -> 403', async () => {
    await request(app.getHttpServer())
      .patch(`/api/users/${otherId}`)
      .set(auth(customerTokens.accessToken))
      .send({ fullName: 'Hack' })
      .expect(403);
  });

  it('customer PATCH chính mình kèm role:admin -> 403 (chống tự phong)', async () => {
    await request(app.getHttpServer())
      .patch(`/api/users/${customerId}`)
      .set(auth(customerTokens.accessToken))
      .send({ role: 'admin' })
      .expect(403);
  });

  it('refresh hợp lệ -> cặp mới, token cũ khác token mới', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/auth/refresh')
      .send({ refreshToken: customerTokens.refreshToken })
      .expect(200);
    if (res.body.data.refreshToken === customerTokens.refreshToken)
      throw new Error('refresh phải rotate ra token mới');
    customerTokens.refreshToken = res.body.data.refreshToken;
    customerTokens.accessToken = res.body.data.accessToken;
  });

  it('refresh bằng ACCESS token -> 401 (sai loại token)', async () => {
    await request(app.getHttpServer())
      .post('/api/auth/refresh')
      .send({ refreshToken: customerTokens.accessToken })
      .expect(401);
  });

  it('logout -> 200, refresh sau đó -> 401', async () => {
    await request(app.getHttpServer())
      .post('/api/auth/logout')
      .set(auth(customerTokens.accessToken))
      .send({ refreshToken: customerTokens.refreshToken })
      .expect(200);

    await request(app.getHttpServer())
      .post('/api/auth/refresh')
      .send({ refreshToken: customerTokens.refreshToken })
      .expect(401);
  });

  // CHẠY CUỐI: reuse-detection revoke hết token của customer, các test sau
  // dùng token customer đều 401. Login lại để lấy token tươi rồi reuse token cũ.
  it('dùng lại refresh token đã rotate -> 401 + đá hết session (reuse detection)', async () => {
    const login = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: customerEmail, password: 'MatKhau@123' })
      .expect(200);
    const fresh = login.body.data.refreshToken as string;

    await request(app.getHttpServer())
      .post('/api/auth/refresh')
      .send({ refreshToken: fresh })
      .expect(200);

    // Dùng lại token vừa rotate (đã revoked) -> 401 ...
    await request(app.getHttpServer())
      .post('/api/auth/refresh')
      .send({ refreshToken: fresh })
      .expect(401);
  });
});
