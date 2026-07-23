import { useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getMyWorksOptions } from '../api/generated/@tanstack/react-query.gen';
import {
  DEMO_WORKS_QUERY_KEY,
  getDemoWorks,
  isDemoMode,
  toWork,
  type Work,
} from '../lib/worksApi';
import { NetworkError } from '../lib/api-errors';

interface UseWorksResult {
  works: Work[];
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

export function useWorks(): UseWorksResult {
  const demoMode = isDemoMode();
  const serverQuery = useQuery({
    ...getMyWorksOptions(),
    enabled: !demoMode,
  });
  const demoQuery = useQuery({
    queryKey: DEMO_WORKS_QUERY_KEY,
    queryFn: getDemoWorks,
    enabled: demoMode,
  });
  const activeQuery = demoMode ? demoQuery : serverQuery;
  const works = demoMode
    ? (demoQuery.data ?? [])
    : (serverQuery.data?.data ?? []).flatMap(work => {
        const mapped = toWork(work);
        return mapped ? [mapped] : [];
      });
  const error = activeQuery.isError
    ? activeQuery.error instanceof NetworkError
      ? '서버에 연결할 수 없습니다. 네트워크 상태를 확인해주세요.'
      : '작품 목록을 불러오지 못했습니다.'
    : null;
  const refetch = useCallback(() => {
    void activeQuery.refetch();
  }, [activeQuery]);

  return { works, loading: activeQuery.isPending, error, refetch };
}
