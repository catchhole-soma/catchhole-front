import { useLayoutEffect, useRef } from 'react';
import { useQuery, type UseMutationOptions } from '@tanstack/react-query';
import { getAnalysisJobOptions, getSettingBookOptions } from '../api/generated/@tanstack/react-query.gen';
import { isSameReviewScope } from '../lib/analysis-source';

/** Public book writes belong to the origin Job and its still-current frozen revision. */
export function useReviewAnalysisSource(workId: string, batchId: string, sourceAnalysisJobId?: string) {
  const jobQuery = useQuery({ ...getAnalysisJobOptions({ path: { workId, analysisJobId: sourceAnalysisJobId ?? '' } }),
    enabled: Boolean(workId && sourceAnalysisJobId), retry: false });
  const job = jobQuery.data?.data;
  const source = job?.source;
  const book = source?.sourceKind === 'SETTING_BOOK';
  const knownSource = book || source?.sourceKind === 'EPISODE';
  const bookQuery = useQuery({ ...getSettingBookOptions({ path: { workId, settingBookId: source?.settingBookId ?? '' } }),
    enabled: Boolean(workId && book && source?.settingBookId), retry: false,
    refetchInterval: book ? 5000 : false });
  const current = bookQuery.data?.data;
  const pending = Boolean(sourceAnalysisJobId && (jobQuery.isPending || book && bookQuery.isPending));
  const unavailable = Boolean(sourceAnalysisJobId && (jobQuery.isError || !pending && (!job || !knownSource)
    || book && (bookQuery.isError || !pending && !current)));
  const historical = Boolean(book && current && (current.revisionId !== source?.revisionId
    || current.latestAnalysisJob?.id !== sourceAnalysisJobId));
  const mismatched = Boolean(job && job.batchId !== batchId);
  const blocked = pending || unavailable || historical || mismatched;
  const blockedRef = useRef(blocked);
  useLayoutEffect(() => { blockedRef.current = blocked; }, [blocked]);
  const canWrite = () => !blockedRef.current && isSameReviewScope(workId, batchId, sourceAnalysisJobId);
  const refresh = () => Promise.all([jobQuery.refetch(), ...(book ? [bookQuery.refetch()] : [])]);
  return { source, blocked, canWrite, refresh,
    message: pending ? '분석 출처와 최신 원문을 확인하고 있습니다.'
      : mismatched ? '이 분석은 현재 검토 묶음에 속하지 않습니다.'
        : unavailable ? '분석 출처나 현재 원문을 확인할 수 없어 읽기 전용으로 표시합니다. 저장된 근거는 확인할 수 있습니다.'
          : historical ? '이전 분석 기록 · 읽기 전용입니다. 원문이나 최신 분석이 변경되어 이 기록은 수정할 수 없습니다.'
            : null };
}

/** Recheck scope at submission time, including dialogs left open during a source refresh. */
export function guardReviewSourceMutation<TData, TError, TVariables>(
  options: UseMutationOptions<TData, TError, TVariables>, canWrite: () => boolean,
): UseMutationOptions<TData, TError, TVariables> {
  return { ...options, mutationFn: (variables, context) => {
    if (!canWrite()) throw new Error('이전 분석 기록은 수정할 수 없습니다. 입력한 내용은 유지됩니다.');
    if (!options.mutationFn) throw new Error('저장 요청을 확인하지 못했습니다.');
    return options.mutationFn(variables, context);
  } };
}
