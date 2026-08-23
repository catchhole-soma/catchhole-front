import { useQuery } from '@tanstack/react-query';
import { Navigate, useSearchParams } from 'react-router';
import { getWorkOptions } from '../../api/generated/@tanstack/react-query.gen';
import { CharacterSettingReview } from './characterreview/CharacterSettingReview';
import { WorldSettingReview } from './worldsetting/WorldSettingReview';

export default function SSettingReview() {
  const [searchParams] = useSearchParams();
  const workId = searchParams.get('workId') ?? '';
  const workQuery = useQuery({
    ...getWorkOptions({ path: { workId } }),
    enabled: Boolean(workId),
    retry: false,
  });
  const work = workQuery.data?.data;

  if (work?.lifecycleStatus === 'PURGING') {
    return (
      <Navigate
        to={`/works?modal=work-delete&targetWorkId=${encodeURIComponent(work.id)}`}
        replace
      />
    );
  }
  if (workId && workQuery.isPending) {
    return <div role="status">작품 상태를 확인하고 있습니다...</div>;
  }

  return searchParams.get('candidateType') === 'world'
    ? <WorldSettingReview />
    : <CharacterSettingReview />;
}
