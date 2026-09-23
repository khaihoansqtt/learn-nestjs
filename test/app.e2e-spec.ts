import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module.js';
import { setupApp } from './../src/setup-app.js';

describe('App (e2e)', () => {
  let app: INestApplication<App>;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    // Áp đúng setup production (prefix /api + ValidationPipe global).
    // APP_FILTER/APP_INTERCEPTOR đã có sẵn từ AppModule.
    setupApp(app);
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('GET /api -> envelope { data }', () => {
    return request(app.getHttpServer())
      .get('/api')
      .expect(200)
      .expect({ data: 'Hello World!' });
  });

  it('GET /api/di-demo/echo hợp lệ -> { data, meta }', () => {
    return request(app.getHttpServer())
      .get('/api/di-demo/echo?search=phone&page=2')
      .expect(200)
      .expect((res) => {
        if (res.body.data?.query?.page !== 2) throw new Error('page chưa transform sang number');
        if (res.body.meta?.demo !== 'query-validation') throw new Error('thiếu meta');
      });
  });

  it('GET /api/di-demo/echo?limit=999 -> 400 error envelope', () => {
    return request(app.getHttpServer())
      .get('/api/di-demo/echo?limit=999')
      .expect(400)
      .expect((res) => {
        if (res.body.statusCode !== 400) throw new Error('thiếu statusCode');
        if (!Array.isArray(res.body.message)) throw new Error('message phải là mảng');
        if (!res.body.requestId) throw new Error('thiếu requestId');
      });
  });

  it('POST /api/di-demo/echo field lạ -> 400 (forbidNonWhitelisted)', () => {
    return request(app.getHttpServer())
      .post('/api/di-demo/echo')
      .send({ name: 'Khai Hoan', isAdmin: true })
      .expect(400);
  });

  it('POST /api/di-demo/echo hợp lệ -> 201 envelope', () => {
    return request(app.getHttpServer())
      .post('/api/di-demo/echo')
      .send({ name: 'Khai Hoan' })
      .expect(201)
      .expect((res) => {
        if (res.body.data?.body?.name !== 'Khai Hoan') throw new Error('sai data');
      });
  });

  it('GET route không tồn tại -> 404 error envelope', () => {
    return request(app.getHttpServer())
      .get('/api/khong-ton-tai')
      .expect(404)
      .expect((res) => {
        if (res.body.statusCode !== 404) throw new Error('thiếu statusCode 404');
        if (!res.body.path) throw new Error('thiếu path');
      });
  });
});
