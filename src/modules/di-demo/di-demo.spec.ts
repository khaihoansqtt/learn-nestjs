import { ConfigModule } from '@nestjs/config';
import { Test, type TestingModule } from '@nestjs/testing';
import { describe, expect, it } from 'vitest';
import { CoreModule } from '../../core/core.module.js';
import { DiDemoService } from './di-demo.service.js';
import { DiDemoModule } from './di-demo.module.js';
import { GREETING } from './tokens.js';

// Test DI bằng TestingModule:
// - imports module thật (giống @SpringBootTest trữ tình rút gọn)
// - overrideProvider(...).useValue(...) để mock bean (giống @MockBean)
describe('DiDemoService (DI)', () => {
  async function createModule(greeting: string): Promise<TestingModule> {
    return Test.createTestingModule({
      imports: [ConfigModule.forRoot({ isGlobal: true }), CoreModule, DiDemoModule],
    })
      .overrideProvider(GREETING)
      .useValue(greeting)
      .compile();
  }

  it('inject được custom token đã mock', async () => {
    const mod = await createModule('hello-test');
    const svc = mod.get(DiDemoService);
    expect(svc.describeTokens().greeting).toBe('hello-test');
    await mod.close();
  });

  it('mỗi lần ModuleRef.resolve() TRANSIENT cho instance mới', async () => {
    const mod = await createModule('hello-test');
    const svc = mod.get(DiDemoService);
    const t = await svc.describeTransients();
    expect(t.sameInstance).toBe(false);
    expect(t.a.instanceId).not.toBe(t.b.instanceId);
    await mod.close();
  });

  it('circular A<->B gỡ được bằng forwardRef', async () => {
    const mod = await createModule('hello-test');
    const svc = mod.get(DiDemoService);
    expect(svc.pingCircular()).toBe('node-a -> node-b-pong');
    await mod.close();
  });
});
