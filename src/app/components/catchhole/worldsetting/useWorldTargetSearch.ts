import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getWorldSettingsOptions } from '../../../api/generated/@tanstack/react-query.gen';
import type { WorldSettingCandidateResponse } from '../../../api/generated/types.gen';
import { shouldRetryQuery } from '../../../lib/query-client';

type WorldCategory = NonNullable<WorldSettingCandidateResponse['category']>;

/** 대상 연결 카드가 한 번에 보여 주는 기존 대상 수. */
const WORLD_TARGET_PAGE_SIZE = 6;

/**
 * 실제 등록된 세계관 대상을 이름으로 찾는 검색 상태. 검색어·페이지는 이 훅을 쓰는 화면(행 패널·묶음 피커)이 각자 가진다.
 * 분류를 바꾸거나 검색어를 바꾸면 첫 페이지부터 다시 찾는다.
 */
export function useWorldTargetSearch({ workId, category: initialCategory, enabled }: {
  workId?: string | null;
  category?: WorldCategory | null;
  enabled: boolean;
}) {
  const [query, setQueryState] = useState('');
  const [page, setPage] = useState(0);
  const [category, setCategoryState] = useState<WorldCategory | undefined>(initialCategory ?? undefined);
  const targetsQuery = useQuery({
    ...getWorldSettingsOptions({ path: { workId: workId ?? '' }, query: {
      category, q: query || undefined, page, size: WORLD_TARGET_PAGE_SIZE, sort: 'CATEGORY_SUBJECT_ASC',
    } }),
    enabled: enabled && Boolean(workId), retry: shouldRetryQuery,
  });
  return {
    query,
    setQuery: (value: string) => { setQueryState(value); setPage(0); },
    page,
    setPage,
    category,
    setCategory: (value: WorldCategory | undefined) => { setCategoryState(value); setPage(0); },
    targetsQuery,
    targets: targetsQuery.data?.data?.worldSettings,
  };
}

export type WorldTargetSearch = ReturnType<typeof useWorldTargetSearch>;
