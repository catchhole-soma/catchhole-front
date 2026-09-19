import { useState } from 'react';
import { WORLD_DEFAULT_IMAGES } from './worldDefaultImages';
import { useWorldImageThemeContext } from './useWorldImageTheme';
import type { WorldSettingDetailResponse } from '../../../api/generated/types.gen';
import { PrivateSubjectImage } from './PrivateSubjectImage';
import { API_BASE_URL } from '../../../lib/api-config';

/** 도감 API 경로만 사용한다. 파일 오류·구형 응답·공개 데모에는 번들 기본 이미지를 표시한다. */
export function WorldSubjectImage({ category, path, vaultId, className, alt = '', eager = false, fallbackSrc }: {
  category: WorldSettingDetailResponse['category'] | 'ALL';
  path?: string | null;
  vaultId?: string | null;
  className?: string;
  alt?: string;
  eager?: boolean;
  fallbackSrc?: string;
}) {
  const theme = useWorldImageThemeContext();
  const defaultPath = theme?.defaults?.[category ?? 'RACE']?.thumbnailUrl;
  const [failedFallback, setFailedFallback] = useState<string | null>();
  const [failedPath, setFailedPath] = useState<string | null>();
  const privatePath = path?.match(/^\/api\/v1\/works\/([a-f0-9-]{36})\/private-world-images\/([a-f0-9-]{36})\/(image|thumbnail)$/);
  if (privatePath) return <PrivateSubjectImage workId={privatePath[1]} imageId={privatePath[2]} vaultId={vaultId}
    thumbnail={privatePath[3] === 'thumbnail'} className={className} alt={alt} />;
  const validPath = path && /^\/api\/v1\/world-image-assets\/[a-f0-9]{64}\.webp$/.test(path);
  const primary = validPath && path !== failedPath ? path : undefined;
  const validDefault = defaultPath && /^\/api\/v1\/world-image-assets\/[a-f0-9]{64}\.webp$/.test(defaultPath);
  const fallback = !fallbackSrc && validDefault && defaultPath !== failedFallback && defaultPath !== failedPath ? defaultPath : undefined;
  const remote = primary ?? fallback;
  const src = remote ? `${API_BASE_URL.replace(/\/$/, '')}${remote}` : fallbackSrc ?? WORLD_DEFAULT_IMAGES[category ?? 'RACE'];
  return <img className={className} src={src} alt={alt} loading={eager ? 'eager' : 'lazy'}
    decoding="async" width={480} height={320} onError={() => { if (primary) setFailedPath(primary); else if (fallback) setFailedFallback(fallback); }} />;
}
