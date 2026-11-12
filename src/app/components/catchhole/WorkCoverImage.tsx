import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { BookOpen } from 'lucide-react';
import { getWorkCoverOptions } from '../../api/generated/@tanstack/react-query.gen';
import { usePrivateImageSession } from '../../lib/private-image-session';

const GRADIENTS = [
  'linear-gradient(145deg, #e8f5ff 0%, #cce8ff 52%, #edf9ff 100%)',
  'linear-gradient(145deg, #edf4ff 0%, #d8e4ff 52%, #f0f4ff 100%)',
  'linear-gradient(145deg, #eef9f5 0%, #d4f0e5 52%, #f5fbf8 100%)',
  'linear-gradient(145deg, #f4efff 0%, #e2d8ff 52%, #f8f5ff 100%)',
];

type Props = { workId: string; imageId?: string | null; alt: string; className?: string; previewUrl?: string };

export function WorkCoverImage({ workId, imageId, alt, className = '', previewUrl }: Props) {
  const seed = Array.from(workId).reduce((sum, character) => sum + character.charCodeAt(0), 0);
  return <div className={`work-cover ${className}`} style={{ background: GRADIENTS[seed % GRADIENTS.length] }}>
    {previewUrl ? <img src={previewUrl} alt={alt} />
      : imageId ? <SavedCover key={imageId} workId={workId} imageId={imageId} alt={alt} />
        : <BookOpen size={74} aria-hidden="true" />}
  </div>;
}

function SavedCover({ workId, imageId, alt }: { workId: string; imageId: string; alt: string }) {
  const session = usePrivateImageSession();
  const options = getWorkCoverOptions({ path: { workId, imageId }, parseAs: 'arrayBuffer' });
  const query = useQuery({ ...options, queryKey: [{ ...options.queryKey[0], tags: [`session:${session}`] }], staleTime: 60_000, gcTime: 0 });
  const [decoded, setDecoded] = useState<{ url: string; session: number; workId: string; imageId: string }>();
  const [failedUrl, setFailedUrl] = useState<string>();
  useEffect(() => {
    const bytes: unknown = query.data;
    if (!(bytes instanceof ArrayBuffer)) return;
    const url = URL.createObjectURL(new Blob([bytes], { type: 'image/png' }));
    setDecoded({ url, session, workId, imageId });
    return () => URL.revokeObjectURL(url);
  }, [query.data, session, workId, imageId]);
  return !query.isError && decoded && decoded.session === session && decoded.workId === workId
    && decoded.imageId === imageId && decoded.url !== failedUrl
    ? <img src={decoded.url} alt={alt} decoding="async" onError={() => setFailedUrl(decoded.url)} />
    : <BookOpen size={74} aria-hidden="true" />;
}
