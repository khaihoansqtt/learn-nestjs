// Token + kiểu dữ liệu cho metadata của app.
// Dùng string token thay vì class để demo custom provider với useValue/useFactory.
// (= Spring: @Bean(name = "appInfo") + @Qualifier("appInfo"))
export const APP_INFO = 'core.app-info';

export interface AppInfo {
  name: string;
  version: string;
  nodeEnv: string;
}
