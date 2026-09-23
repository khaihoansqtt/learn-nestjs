import { registerAs } from '@nestjs/config';

export interface AppConfig {
  port: number;
  nodeEnv: string;
  greetingOwner: string;
}

// Config typed theo namespace 'app' — dùng: config.get('app.port')
// hoặc type-safe hơn: @Inject(appConfig.KEY) cfg: ConfigType<typeof appConfig>.
// (= Spring @ConfigurationProperties(prefix = "app") + record AppProperties).
export const appConfig = registerAs(
  'app',
  (): AppConfig => ({
    port: parseInt(process.env.PORT ?? '3000', 10),
    nodeEnv: process.env.NODE_ENV ?? 'development',
    greetingOwner: process.env.GREETING_OWNER ?? 'shop-mini',
  }),
);
