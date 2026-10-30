import { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  getCurrentEpisodeValidationOptions,
  getCurrentEpisodeValidationQueryKey,
  getEpisodeOptions,
  getEpisodeValidationEligibilityOptions,
  recheckEpisodeValidationMutation,
} from '../../../api/generated/@tanstack/react-query.gen';
import type { useEpisodeValidationReport } from '../../../hooks/useEpisodeValidationReport';
import { toApiError } from '../../../lib/api-errors';

type ReportData = ReturnType<typeof useEpisodeValidationReport>;
export type RecheckNotice = { tone: 'info' | 'warning' | 'danger'; text: string; suggestRetry?: boolean } | null;

const RECHECK_ERROR_COPY: Record<string, string> = {
  VALIDATION_RECHECK_INPUT_UNCHANGED: '원고와 비교 기준이 이전 검수와 같아요. 새 검수 대신 중단된 검사 다시 시도를 사용해 주세요.',
  VALIDATION_REPORT_VERSION_CONFLICT: '다른 곳에서 검수 상태가 바뀌었어요. 최신 상태를 확인한 뒤 다시 눌러 주세요.',
  VALIDATION_SOURCE_VERSION_CONFLICT: '원고나 비교 기준이 방금 바뀌었어요. 최신 원고를 다시 확인한 뒤 눌러 주세요.',
  VALIDATION_TARGET_INVALID: '재검수는 가장 마지막 회차에서 진행 중인 분석이 없을 때만 할 수 있어요.',
  VALIDATION_CORRECTION_CONFLICT: '설정 정정 기록이 이 검수와 맞지 않아요. 최신 상태를 확인한 뒤 다시 눌러 주세요.',
};
/**
 * 같은 VALIDATION_SOURCE_VERSION_CONFLICT라도 `context.reason`이 있으면 원고가 아니라 report의 기준 식별값 문제다(#314 B2).
 * 화면은 최신 report를 다시 읽고 원고 충돌 문구와 다른 안내를 보여 준다.
 */
const BASELINE_FINGERPRINT_REASONS = new Set(['BASELINE_FINGERPRINT_REQUIRED', 'BASELINE_FINGERPRINT_MISMATCH']);
const BASELINE_FINGERPRINT_COPY = '검사 기준 식별값이 바뀌어 최신 검수 상태를 다시 확인했어요. 확인한 뒤 다시 눌러 주세요.';

function newIdempotencyKey() {
  const random = typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return `validation-recheck-${random}`;
}

/**
 * A11 수정 내용으로 재검수. 서버 검토 요약의 `allowedActions`에 RECHECK가 있고(무효화된 현재 report, #314 B2부터 서버가 받는
 * 회차의 APPLIED report 포함) 자격 조회가 최신 회차라고 확인한 경우에만 연다. 요청은 회차 상세의 현재 원고 hash/key/version/revision과
 * report의 고정 기준 fingerprint, 설정 정정 receipt가 있으면 그 ID를 그대로 보낸다. 같은 의도의 재시도는 같은 키를 쓰고 응답 유실은 현재 검수로 확인한다.
 */
export function useValidationRecheck({ workId, reportId, report, correctionReceiptId, onRechecked }: {
  workId: string;
  reportId: string;
  report: ReportData;
  /** A10 정정 화면이 돌려준 receipt. 같은 report의 정정만 서버가 받는다. */
  correctionReceiptId?: string | null;
  onRechecked: (nextReportId: string) => void;
}) {
  const queryClient = useQueryClient();
  const { staging, summary } = report;
  const episodeId = staging?.episodeId ?? '';
  const current = staging?.current !== false;
  // 확정 완료(APPLIED) report의 진단 재검수도 서버가 RECHECK로 알려 준다. 단계·최신 회차로 추측하지 않는다.
  const serverAllowed = summary?.allowedActions?.includes('RECHECK') === true;
  // 검토 요약을 읽기 전에는 허용으로 추측하지 않는다.
  const listed = current && Boolean(episodeId) && Boolean(summary) && serverAllowed;
  const [open, setOpen] = useState(false);
  const [notice, setNotice] = useState<RecheckNotice>(null);
  const key = useRef<{ key: string; version: number } | null>(null);
  // 응답 전에 리포트를 떠나면 늦은 응답으로 화면을 바꾸지 않는다. 서버의 재검수 요청은 취소하지 않는다.
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);
  const contextOf = () => `${window.location.pathname}?reportId=${new URLSearchParams(window.location.search).get('reportId') ?? ''}`;
  const stillHere = (context: string) => mounted.current && contextOf() === context;
  // 원고 확인을 기다리는 동안 확인 영역이 닫히거나(취소·권한 변경) 화면을 떠나면 요청을 보내지 않는다.
  const confirmationOpen = useRef(false);

  const eligibilityQuery = useQuery({
    ...getEpisodeValidationEligibilityOptions({ path: { workId }, query: { episodeId } }),
    enabled: listed,
    retry: false,
  });
  const latest = eligibilityQuery.data?.data?.latestEpisode;
  const episodeQuery = useQuery({
    ...getEpisodeOptions({ path: { workId, episodeId } }),
    enabled: listed && open,
    staleTime: 0,
    gcTime: 0,
    retry: false,
  });
  const mutation = useMutation(recheckEpisodeValidationMutation());
  const summaryStale = report.summaryQuery.isError;
  // 한 번의 제출은 현재 원고 확인(preparing) → 재검수 요청(sending) 순서다. 요청을 보내기 전까지만 취소할 수 있다.
  const [phase, setPhase] = useState<'idle' | 'preparing' | 'sending'>('idle');
  const submission = useRef(0);
  const sending = phase === 'sending' || mutation.isPending;
  const pending = phase !== 'idle' || mutation.isPending;
  const canRecheck = listed && latest === true && !summaryStale && report.reportVersion != null;
  const lockReason = !listed ? null
    : summaryStale ? '최신 검수 상태를 확인하지 못해 재검수를 잠갔어요.'
      : eligibilityQuery.isError ? '가장 마지막 회차인지 확인하지 못했어요. 다시 확인해 주세요.'
        : latest === false ? '가장 마지막 회차만 재검수할 수 있어요. 이 회차 뒤에 다른 회차가 있어요.'
          : latest == null ? '재검수할 수 있는지 확인하고 있어요.' : null;
  useEffect(() => { confirmationOpen.current = listed && open; });
  // 이미 확정한 회차(확정 report 또는 결과 전용 재검수)의 다음 검수는 결과만 제공한다.
  const diagnostic = summary?.mode === 'DIAGNOSTIC_ONLY' || summary?.application?.status === 'APPLIED';

  // 재검수가 현재 report를 바꿨으므로 회차의 현재 검수 캐시를 버려 다음 회차 주소 진입이 새로 확인하게 한다.
  // 화면 이동은 요청을 시작한 리포트에 그대로 있을 때만 한다.
  const finish = (nextReportId: string, context: string) => {
    key.current = null;
    queryClient.removeQueries({ queryKey: getCurrentEpisodeValidationQueryKey({ path: { workId }, query: { episodeId } }) });
    if (!stillHere(context)) return;
    setOpen(false);
    onRechecked(nextReportId);
  };

  const takeKey = (version: number) => {
    if (!key.current || key.current.version !== version) key.current = { key: newIdempotencyKey(), version };
    return key.current.key;
  };

  const recoverLostResponse = async (context: string) => {
    try {
      const latestReport = (await queryClient.fetchQuery({
        ...getCurrentEpisodeValidationOptions({ path: { workId }, query: { episodeId } }), staleTime: 0, retry: false,
      })).data;
      if (latestReport?.reportId && latestReport.reportId !== reportId) {
        finish(latestReport.reportId, context);
        return;
      }
    } catch {
      // 현재 검수를 읽지 못해도 같은 키로 다시 시도할 수 있게 둔다.
    }
    if (stillHere(context)) setNotice({ tone: 'warning', text: '재검수 요청 결과를 확인하지 못했어요. 다시 누르면 같은 요청으로 확인해요.' });
  };

  const submit = async () => {
    const version = report.reportVersion;
    if (!canRecheck || pending || version == null) return;
    const context = contextOf();
    const token = ++submission.current;
    const settle = () => { if (submission.current === token && mounted.current) setPhase('idle'); };
    setPhase('preparing');
    setNotice(null);
    let episode;
    try {
      episode = (await episodeQuery.refetch({ throwOnError: true })).data?.data;
    } catch {
      episode = undefined;
    }
    if (submission.current !== token || !confirmationOpen.current || !stillHere(context)) {
      settle();
      return;
    }
    if (!episode?.contentHash || !episode.contentS3Key || episode.contentRevision == null) {
      settle();
      setNotice({ tone: 'danger', text: '현재 원고 정보를 확인하지 못했어요. 잠시 후 다시 눌러 주세요.' });
      return;
    }
    setPhase('sending');
    try {
      const response = await mutation.mutateAsync({
        path: { workId, reportId },
        body: {
          idempotencyKey: takeKey(version),
          expectedReportVersion: version,
          expectedContentHash: episode.contentHash,
          expectedContentS3Key: episode.contentS3Key,
          ...(episode.contentS3Version ? { expectedContentS3Version: episode.contentS3Version } : {}),
          expectedContentRevision: episode.contentRevision,
          // 서버는 재검수 기준을 report의 고정 기준 fingerprint와 비교한다. 무효화 뒤에도 남는 값이다.
          ...(staging?.baselineFingerprint ? { expectedBaselineHash: staging.baselineFingerprint } : {}),
          // 정정 receipt가 있으면 서버가 그 정정을 새 기준의 작가 정정으로 연결한다.
          ...(correctionReceiptId ? { correctionReceiptId } : {}),
        },
      });
      if (response.data?.reportId && response.data.reportId !== reportId) finish(response.data.reportId, context);
      else await recoverLostResponse(context);
    } catch (error) {
      const api = toApiError(error);
      if (api && api.status >= 400 && api.status < 500) {
        key.current = null;
        if (!stillHere(context)) return;
        const reason = typeof api.context?.reason === 'string' ? api.context.reason : null;
        const baselineChanged = api.code === 'VALIDATION_SOURCE_VERSION_CONFLICT' && reason !== null && BASELINE_FINGERPRINT_REASONS.has(reason);
        setNotice({
          tone: api.status === 409 ? 'warning' : 'danger',
          text: baselineChanged ? BASELINE_FINGERPRINT_COPY : RECHECK_ERROR_COPY[api.code] ?? (api.message || '재검수를 시작하지 못했어요.'),
          suggestRetry: api.code === 'VALIDATION_RECHECK_INPUT_UNCHANGED',
        });
        // 기준 식별값 충돌은 보고 있는 report의 fingerprint가 오래된 경우다. 최신 report를 다시 읽어 다음 요청에 쓴다.
        void report.refreshReport();
        void eligibilityQuery.refetch();
        return;
      }
      await recoverLostResponse(context);
    } finally {
      settle();
    }
  };

  return {
    listed,
    canRecheck,
    lockReason,
    open,
    openConfirmation: () => { setNotice(null); setOpen(true); },
    // 원고 확인 중 취소는 이번 제출을 무효로 만든다. 재검수 요청을 보낸 뒤에는 취소하지 않는다.
    closeConfirmation: () => {
      if (sending) return;
      submission.current += 1;
      setPhase('idle');
      setOpen(false);
      setNotice(null);
    },
    episode: episodeQuery.data?.data,
    episodeLoading: episodeQuery.isPending && episodeQuery.fetchStatus !== 'idle',
    episodeError: episodeQuery.isError,
    reloadEpisode: () => void episodeQuery.refetch(),
    reloadEligibility: () => void eligibilityQuery.refetch(),
    eligibilityError: eligibilityQuery.isError,
    diagnostic,
    corrected: Boolean(correctionReceiptId),
    notice,
    pending,
    preparing: phase === 'preparing',
    sending,
    submit,
  };
}
