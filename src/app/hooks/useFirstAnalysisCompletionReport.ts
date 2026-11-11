import { useEffect, useRef } from 'react';
import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import {
  claimMyFirstAnalysisCompletionReportMutation,
  getMeOptions,
  getMyFirstAnalysisCompletionReportOptions,
  getMyFirstAnalysisCompletionReportQueryKey,
} from '../api/generated/@tanstack/react-query.gen';
import { isGaAvailable, trackGaFirstAnalysisComplete } from '../lib/ga4';

/** 업로드·설정집 진행 화면이 분석 완료를 본 순간 서버 판정을 다시 읽게 한다. */
export function recheckFirstAnalysisCompletionReport(client: QueryClient): void {
  const reportQueryId = getMyFirstAnalysisCompletionReportQueryKey()[0]._id;
  void client.invalidateQueries({
    predicate: query => (query.queryKey[0] as { _id?: unknown } | undefined)?._id === reportQueryId,
  });
}

/**
 * 첫 분석 완료 GA4 이벤트를 계정당 한 번만 보낸다(#426). 완료 여부와 선점은 서버가 정하고
 * claim이 true를 돌려준 요청만 이벤트를 보낸다. GA4가 없는 환경(로컬·Preview)에서는 조회·선점하지 않는다.
 * Preview도 운영 API를 쓰므로, 선점하면 이벤트 없이 계정의 보고 기록만 소비되기 때문이다.
 */
export function useFirstAnalysisCompletionReport(): void {
  const client = useQueryClient();
  const gaAvailable = isGaAvailable();
  const member = useQuery({ ...getMeOptions(), staleTime: 60_000 });
  const memberId = member.data?.data?.id;
  // 계정을 바꿔 로그인하면 다른 캐시를 쓰도록 회원 ID로 범위를 나눈다.
  const scopedKey = { ...getMyFirstAnalysisCompletionReportQueryKey()[0], memberId };
  const queryKey: ReturnType<typeof getMyFirstAnalysisCompletionReportQueryKey> = [scopedKey];
  const report = useQuery({
    ...getMyFirstAnalysisCompletionReportOptions(), queryKey,
    enabled: gaAvailable && memberId != null,
    retry: false, refetchOnWindowFocus: false, staleTime: Infinity,
  });
  const { mutateAsync: claim } = useMutation({ ...claimMyFirstAnalysisCompletionReportMutation(), retry: false });
  const claimedFor = useRef<number | null>(null);
  const shouldReport = report.data?.data?.shouldReport === true;

  useEffect(() => {
    if (!shouldReport || memberId == null || claimedFor.current === memberId) return;
    claimedFor.current = memberId;
    void claim({}).then(response => {
      if (response.data?.shouldReport) trackGaFirstAnalysisComplete();
    }).catch(() => {
      // 보고 실패로 화면을 막거나 자동 재시도하지 않는다. 다음 앱 진입 때 서버 판정을 다시 읽는다.
    }).finally(() => {
      client.setQueryData(
        [{ ...getMyFirstAnalysisCompletionReportQueryKey()[0], memberId }],
        { success: true, data: { shouldReport: false } },
      );
    });
  }, [shouldReport, memberId, claim, client]);
}
