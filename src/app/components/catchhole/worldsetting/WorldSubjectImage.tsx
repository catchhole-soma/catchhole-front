import { useState } from 'react';
import { WORLD_CATEGORY_IMAGES } from './worldCategoryImages';
import type { WorldSettingDetailResponse } from '../../../api/generated/types.gen';
import { API_BASE_URL } from '../../../lib/api-config';

/** 도감 API 경로만 사용한다. 파일 오류·구형 응답·공개 데모에는 번들 기본 이미지를 표시한다. */
export function WorldSubjectImage({ category, path, className, alt = '', eager = false }: {
  category: WorldSettingDetailResponse['category'];
  path?: string | null;
  className?: string;
  alt?: string;
  eager?: boolean;
}) {
  const [failedPath, setFailedPath] = useState<string | null>();
  const validPath = path && /^\/api\/v1\/world-image-assets\/[a-f0-9]{64}\.webp$/.test(path);
  const src = validPath && path !== failedPath
    ? `${API_BASE_URL.replace(/\/$/, '')}${path}`
    : WORLD_CATEGORY_IMAGES[category ?? 'ALL'];
  return <img className={className} src={src} alt={alt} loading={eager ? 'eager' : 'lazy'}
    decoding="async" width={480} height={320} onError={() => setFailedPath(path)} />;
}
