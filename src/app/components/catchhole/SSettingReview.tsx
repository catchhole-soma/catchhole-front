import { useState } from 'react';
import { CharacterSettingLabelProvider } from './character/CharacterSettingLabelProvider';
import { useQuery } from '@tanstack/react-query';
import { Navigate, useSearchParams } from 'react-router';
import { getWorkOptions } from '../../api/generated/@tanstack/react-query.gen';
import type { CharacterFactApplicationMode } from './character/character-fact-comparison-policy';
import { CharacterSettingReview } from './characterreview/CharacterSettingReview';
import { WorldSettingReview } from './worldsetting/WorldSettingReview';
import { WorldImageThemeProvider } from './worldsetting/WorldImageThemeProvider';

function SettingReviewContent({ world }: { world: boolean }) {
  const [applicationModes, setApplicationModes] = useState<Record<string, CharacterFactApplicationMode>>({});
  return world ? <WorldSettingReview /> : <CharacterSettingReview
    applicationModes={applicationModes}
    onApplicationModeChange={(candidateId, mode) => setApplicationModes(previous => ({ ...previous, [candidateId]: mode }))}
    onClearApplicationModes={candidateIds => setApplicationModes(previous => {
      const next = { ...previous };
      candidateIds.forEach(candidateId => delete next[candidateId]);
      return next;
    })}
  />;
}

export default function SSettingReview() {
  const [searchParams] = useSearchParams();
  const workId = searchParams.get('workId') ?? '';
  const batchId = searchParams.get('batchId') ?? '';
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

  return <CharacterSettingLabelProvider genre={work?.genre}>
    <WorldImageThemeProvider workId={workId} enabled={Boolean(work)}>
      {/* 탭 왕복은 선택을 유지하고, 작품·업로드 묶음 변경은 저장하지 않은 선택을 초기화한다. */}
      <SettingReviewContent key={`${workId}:${batchId}`} world={searchParams.get('candidateType') === 'world'} />
    </WorldImageThemeProvider>
  </CharacterSettingLabelProvider>;
}
