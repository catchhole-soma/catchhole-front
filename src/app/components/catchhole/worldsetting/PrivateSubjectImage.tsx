import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { LockKeyhole } from 'lucide-react';
import { getPrivateWorldImageContentOptions, getPrivateWorldImageThumbnailOptions } from '../../../api/generated/@tanstack/react-query.gen';
import { usePrivateImageKey } from '../../../lib/use-private-image-key';
import { decryptPrivateImage } from '../../../lib/private-image-crypto';

interface PrivateSubjectImageProps {
  workId: string; imageId: string; vaultId: string; thumbnail?: boolean; className?: string; alt?: string;
}

export function PrivateSubjectImage(props: PrivateSubjectImageProps) {
  const key = usePrivateImageKey(props.vaultId);
  if (!key) return <span className={`private-image-placeholder ${props.className ?? ''}`} role="img" aria-label="잠긴 내 이미지"
    title="대표 이미지 선택 → 내 이미지에서 잠금을 풀어 주세요.">
    <LockKeyhole size={20} aria-hidden="true" /><small>잠긴 내 이미지</small>
  </span>;
  // Unmounting this child on lock discards its decoded state and revokes its URL.
  return <UnlockedPrivateSubjectImage {...props} vaultKey={key} />;
}

function UnlockedPrivateSubjectImage({ workId, imageId, vaultId, vaultKey: key, thumbnail = true, className = '', alt = '' }:
  PrivateSubjectImageProps & { vaultKey: CryptoKey }) {
  const query = useQuery({
    ...(thumbnail ? getPrivateWorldImageThumbnailOptions : getPrivateWorldImageContentOptions)({
      path: { workId, imageId }, parseAs: 'arrayBuffer',
    }),
    enabled: !!key, staleTime: 60_000,
  });
  // Only ciphertext enters the query cache; plaintext URLs are tied to this component and key.
  const [decoded, setDecoded] = useState<{ url: string; key: CryptoKey; imageId: string; thumbnail: boolean }>();
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    const bytes: unknown = query.data;
    if (!key || !(bytes instanceof ArrayBuffer)) return;
    let cancelled = false;
    let url: string | undefined;
    void decryptPrivateImage(key, vaultId, imageId, thumbnail ? 'thumbnail' : 'image', bytes).then(blob => {
      if (cancelled) return;
      url = URL.createObjectURL(blob);
      setDecoded({ url, key, imageId, thumbnail }); setFailed(false);
    }).catch(() => { if (!cancelled) setFailed(true); });
    return () => { cancelled = true; if (url) URL.revokeObjectURL(url); };
  }, [key, query.data, vaultId, imageId, thumbnail]);
  if (key && decoded?.key === key && decoded.imageId === imageId && decoded.thumbnail === thumbnail) {
    return <img className={className} src={decoded.url} alt={alt} decoding="async" width={480} height={320} />;
  }
  const label = failed || query.isError ? '이미지를 열 수 없어요' : '이미지 여는 중';
  return <span className={`private-image-placeholder ${className}`} role="img" aria-label={label} title={label}>
    <LockKeyhole size={20} aria-hidden="true" /><small>{label}</small>
  </span>;
}
