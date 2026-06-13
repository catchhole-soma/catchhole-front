import { useCallback, useEffect, useState } from 'react';
import { getWorks, Work } from '../lib/worksApi';
import { ApiError } from '../lib/api';

interface UseWorksResult {
  works: Work[];
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

export function useWorks(): UseWorksResult {
  const [works, setWorks] = useState<Work[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const refetch = useCallback(() => setReloadKey(k => k + 1), []);

  useEffect(() => {
    let cancelled = false;

    setLoading(true);
    setError(null);

    getWorks()
      .then(data => {
        if (cancelled) return;
        setWorks(data);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(err instanceof ApiError ? err.message : '작품 목록을 불러오지 못했습니다.');
      })
      .finally(() => {
        if (cancelled) return;
        setLoading(false);
      });

    return () => { cancelled = true; };
  }, [reloadKey]);

  return { works, loading, error, refetch };
}
