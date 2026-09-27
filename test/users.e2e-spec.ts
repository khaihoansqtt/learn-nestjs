import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { DataSource } from 'typeorm';
import { AppModule } from './../src/app.module.js';
import { setupApp } from './../src/setup-app.js';

// E2E CRUD với DB THẬT (Docker Postgres) — kiểm chứng điều unit test không
// thấy được: soft-delete, unique index 23505, serialization, parse UUID.
// Dòng dữ liệu test mang prefix `e2e-<runId>` và bị xóa cứng sau mỗi run
// để DB không rác.
describe('Users CRUD (e2e)', () => {
  let app: INestApplication<App>;
  const runId = Date.now();
  const email = `e2e-${runId}@example.com`;
  let createdId = '';

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleFixture.createNestApplication();
    setupApp(app);
    await app.init();
  });

  afterAll(async () => {
    // Dọn dữ liệu test (xóa cứng, kể cả bản đã soft-delete).
    const ds = app.get(DataSource);
    await ds.query(`DELETE FROM "users" WHERE "email" LIKE 'e2e-%@example.com'`);
    await app.close();
  });

  it('POST /api/users hợp lệ -> 201, KHÔNG lộ passwordHash', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/users')
      .send({ email, password: 'MatKhau@123', fullName: 'E2E User' })
      .expect(201);

    createdId = res.body.data.id;
    if (!createdId) throw new Error('thiếu id');
    if (res.body.data.passwordHash) throw new Error('LEAK passwordHash');
    if (res.body.data.password) throw new Error('LEAK password plaintext');
    if (res.body.data.deletedAt !== null) throw new Error('deletedAt phải null');
  });

  it('POST email trùng -> 409 error envelope', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/users')
      .send({ email, password: 'MatKhau@123', fullName: 'Clone' })
      .expect(409);
    if (res.body.statusCode !== 409) throw new Error('thiếu statusCode 409');
  });

  it('POST password ngắn -> 400 kèm message minLength', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/users')
      .send({ email: 'ngan@example.com', password: 'abc', fullName: 'X' })
      .expect(400);
    if (!res.body.message?.some((m: string) => m.includes('8')))
      throw new Error('thiếu message minLength');
  });

  it('GET /api/users?page=1&limit=10 -> Page có item vừa tạo', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/users?page=1&limit=10')
      .expect(200);
    const { items, total, page, totalPages } = res.body.data;
    if (!Array.isArray(items)) throw new Error('items phải là mảng');
    if (page !== 1 || totalPages < 1) throw new Error('sai pagination meta');
    if (total < 1) throw new Error('total phải >= 1');
    if (items.some((u: { passwordHash?: string }) => u.passwordHash))
      throw new Error('LEAK passwordHash trong list');
  });

  it('GET /api/users/:id hợp lệ -> 200', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/users/${createdId}`)
      .expect(200);
    if (res.body.data.email !== email) throw new Error('sai user');
  });

  it('GET id không phải UUID -> 400 (ParseUUIDPipe chặn trước khi chạm DB)', () => {
    return request(app.getHttpServer())
      .get('/api/users/khong-phai-uuid')
      .expect(400);
  });

  it('GET id không tồn tại -> 404 error envelope', () => {
    return request(app.getHttpServer())
      .get('/api/users/00000000-0000-4000-8000-000000000000')
      .expect(404);
  });

  it('PATCH đổi fullName -> 200', async () => {
    const res = await request(app.getHttpServer())
      .patch(`/api/users/${createdId}`)
      .send({ fullName: 'E2E Updated' })
      .expect(200);
    if (res.body.data.fullName !== 'E2E Updated') throw new Error('không update');
  });

  it('DELETE -> soft-delete, GET sau đó -> 404', async () => {
    await request(app.getHttpServer())
      .delete(`/api/users/${createdId}`)
      .expect(200);

    await request(app.getHttpServer())
      .get(`/api/users/${createdId}`)
      .expect(404);

    // Bằng chứng xóa MỀM: dòng vẫn còn trong DB, chỉ khác deletedAt.
    const ds = app.get(DataSource);
    const rows: Array<{ deletedAt: Date | null }> = await ds.query(
      `SELECT "deletedAt" FROM "users" WHERE "id" = $1`,
      [createdId],
    );
    if (rows.length !== 1) throw new Error('dòng phải còn (soft-delete)');
    if (!rows[0].deletedAt) throw new Error('deletedAt phải được set');
  });

  it('GET ?includeDeleted=true -> thấy lại user đã xóa', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/users?includeDeleted=true&q=e2e-')
      .expect(200);
    const found = res.body.data.items.some(
      (u: { id: string }) => u.id === createdId,
    );
    if (!found) throw new Error('includeDeleted không hoạt động');
  });

  it('POST /:id/restore -> user hoạt động lại', async () => {
    await request(app.getHttpServer())
      .post(`/api/users/${createdId}/restore`)
      .expect(201);

    await request(app.getHttpServer())
      .get(`/api/users/${createdId}`)
      .expect(200);
  });
});
