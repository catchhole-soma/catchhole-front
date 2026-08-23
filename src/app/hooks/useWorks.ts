import { useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getMyWorksOptions } from '../api/generated/@tanstack/react-query.gen';
import {
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
  const serverQuery = useQuery({
    ...getMyWorksOptions(),
    refetchInterval: query => (
      query.state.data?.data?.some(work => work.lifecycleStatus === 'PURGING')
        ? 3_000
        : false
    ),
  });
  const works = (serverQuery.data?.data ?? []).flatMap(work => {
    const mapped = toWork(work);
    return mapped ? [mapped] : [];
  });
  const error = serverQuery.isError
    ? serverQuery.error instanceof NetworkError
      ? '서버에 연결할 수 없습니다. 네트워크 상태를 확인해주세요.'
      : '작품 목록을 불러오지 못했습니다.'
    : null;
  const refetch = useCallback(() => {
    void serverQuery.refetch();
  }, [serverQuery]);

  return { works, loading: serverQuery.isPending, error, refetch };
}
