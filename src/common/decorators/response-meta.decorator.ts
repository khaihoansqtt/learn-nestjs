import { SetMetadata } from '@nestjs/common';

export const RESPONSE_META_KEY = 'common.response-meta';

// Gắn meta tĩnh cho response thành công, TransformInterceptor sẽ đọc.
// VD: @ResponseMeta({ version: 'v1' }). Meta động (paging) sẽ tự build
// trong handler ở M4/M6 thay vì dùng decorator này.
export const ResponseMeta = (meta: Record<string, unknown>) =>
  SetMetadata(RESPONSE_META_KEY, meta);
