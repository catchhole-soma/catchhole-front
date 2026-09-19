import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ImageIcon } from 'lucide-react';
import { usePrivateImageSession } from '../../../lib/private-image-session';
import { getPrivateWorldImageContentOptions, getPrivateWorldImageThumbnailOptions } from '../../../api/generated/@tanstack/react-query.gen';

interface PrivateSubjectImageProps {
  workId: string; imageId: string; vaultId?: string | null; thumbnail?: boolean; className?: string; alt?: string;
}

export function PrivateSubjectImage(props: PrivateSubjectImageProps) {
  if (props.vaultId) return <span className={`private-image-placeholder ${props.className ?? ''}`} role="img"
    aria-label="다시 올려야 하는 이전 이미지" title="이전 방식으로 보관한 이미지예요. 내 이미지에서 원본을 다시 올려 교체해 주세요.">
    <ImageIcon size={20} aria-hidden="true" /><small>이미지를 다시 올려 주세요</small>
  </span>;
  return <AccountPrivateSubjectImage {...props} />;
}

function AccountPrivateSubjectImage({ workId, imageId, thumbnail = true, className = '', alt = '' }: PrivateSubjectImageProps) {
  const session = usePrivateImageSession();
  const options = (thumbnail ? getPrivateWorldImageThumbnailOptions : getPrivateWorldImageContentOptions)({
    path: { workId, imageId }, parseAs: 'arrayBuffer',
  });
  const query = useQuery({
    ...options, queryKey: [{ ...options.queryKey[0], tags: [`session:${session}`] }],
    staleTime: 60_000, gcTime: 0,
  });
  const [decoded, setDecoded] = useState<{ url: string; session: number; imageId: string; workId: string; thumbnail: boolean }>();
  useEffect(() => {
    const bytes: unknown = query.data;
    if (!(bytes instanceof ArrayBuffer)) return;
    const url = URL.createObjectURL(new Blob([bytes], { type: 'image/png' }));
    setDecoded({ url, session, imageId, workId, thumbnail });
    return () => URL.revokeObjectURL(url);
  }, [query.data, workId, imageId, thumbnail, session]);
  if (!query.isError && query.data && decoded?.session === session && decoded?.imageId === imageId && decoded.workId === workId && decoded.thumbnail === thumbnail) {
    return <img className={className} src={decoded.url} alt={alt} decoding="async" width={480} height={320} />;
  }
  const label = query.isError ? '이미지를 열 수 없어요' : '이미지 여는 중';
  return <span className={`private-image-placeholder ${className}`} role="img" aria-label={label} title={label}>
    <ImageIcon size={20} aria-hidden="true" /><small>{label}</small>
  </span>;
}
