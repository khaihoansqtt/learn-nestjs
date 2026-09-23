// Các injection token riêng của DiDemoModule.
// Quy ước đặt tên có namespace để tránh đụng khi app lớn dần.
export const GREETING = 'di-demo.greeting';
export const FEATURE_FLAGS = 'di-demo.feature-flags';

export interface FeatureFlags {
  newCheckout: boolean;
}
