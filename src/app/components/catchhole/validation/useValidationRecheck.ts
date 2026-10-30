import { useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  getCurrentEpisodeValidationOptions,
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
};

function newIdempotencyKey() {
  const random = typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return `validation-recheck-${random}`;
}

/**
 * A11 수정 내용으로 재검수. 서버가 RECHECK를 허용했거나(무효화된 현재 report) 확정 완료 report의 진단 재검수이고,
 * 자격 조회가 최신 회차라고 확인한 경우에만 연다. 요청은 회차 상세의 현재 원고 hash/key/version/revision과
 * report의 고정 기준 fingerprint를 그대로 보낸다. 같은 의도의 재시도는 같은 키를 쓰고 응답 유실은 현재 검수로 확인한다.
 */
export function useValidationRecheck({ workId, reportId, report, onRechecked }: {
  workId: string;
  reportId: string;
  report: ReportData;
  onRechecked: (nextReportId: string) => void;
}) {
  const queryClient = useQueryClient();
  const { staging, summary } = report;
  const episodeId = staging?.episodeId ?? '';
  const current = staging?.current !== false;
  const serverAllowed = summary?.allowedActions?.includes('RECHECK') === true;
  // 확정 완료 report는 무효화되지 않지만 회차 전체 확정이 기준 입력을 바꾼 것으로 보아 진단 재검수를 받는다(Backend 재검수 규칙).
  const diagnosticOfApplied = summary?.reviewStage === 'APPLIED' && summary.mode !== 'DIAGNOSTIC_ONLY';
  // 검토 요약을 읽기 전에는 허용으로 추측하지 않는다.
  const listed = current && Boolean(episodeId) && Boolean(summary) && (serverAllowed || diagnosticOfApplied);
  const [open, setOpen] = useState(false);
  const [notice, setNotice] = useState<RecheckNotice>(null);
  const key = useRef<{ key: string; version: number } | null>(null);

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
  const pending = mutation.isPending;
  const canRecheck = listed && latest === true && !summaryStale && report.reportVersion != null;
  const lockReason = !listed ? null
    : summaryStale ? '최신 검수 상태를 확인하지 못해 재검수를 잠갔어요.'
      : eligibilityQuery.isError ? '가장 마지막 회차인지 확인하지 못했어요. 다시 확인해 주세요.'
        : latest === false ? '가장 마지막 회차만 재검수할 수 있어요. 이 회차 뒤에 다른 회차가 있어요.'
          : latest == null ? '재검수할 수 있는지 확인하고 있어요.' : null;
  // 이미 확정한 회차(확정 report 또는 결과 전용 재검수)의 다음 검수는 결과만 제공한다.
  const diagnostic = summary?.mode === 'DIAGNOSTIC_ONLY' || summary?.application?.status === 'APPLIED';

  const takeKey = (version: number) => {
    if (!key.current || key.current.version !== version) key.current = { key: newIdempotencyKey(), version };
    return key.current.key;
  };

  const recoverLostResponse = async () => {
    try {
      const latestReport = (await queryClient.fetchQuery({
        ...getCurrentEpisodeValidationOptions({ path: { workId }, query: { episodeId } }), staleTime: 0, retry: false,
      })).data;
      if (latestReport?.reportId && latestReport.reportId !== reportId) {
        key.current = null;
        onRechecked(latestReport.reportId);
        return;
      }
    } catch {
      // 현재 검수를 읽지 못해도 같은 키로 다시 시도할 수 있게 둔다.
    }
    setNotice({ tone: 'warning', text: '재검수 요청 결과를 확인하지 못했어요. 다시 누르면 같은 요청으로 확인해요.' });
  };

  const submit = async () => {
    const version = report.reportVersion;
    if (!canRecheck || pending || version == null) return;
    setNotice(null);
    let episode;
    try {
      episode = (await episodeQuery.refetch({ throwOnError: true })).data?.data;
    } catch {
      episode = undefined;
    }
    if (!episode?.contentHash || !episode.contentS3Key || episode.contentRevision == null) {
      setNotice({ tone: 'danger', text: '현재 원고 정보를 확인하지 못했어요. 잠시 후 다시 눌러 주세요.' });
      return;
    }
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
        },
      });
      if (response.data?.reportId && response.data.reportId !== reportId) {
        key.current = null;
        setOpen(false);
        onRechecked(response.data.reportId);
      } else {
        await recoverLostResponse();
      }
    } catch (error) {
      const api = toApiError(error);
      if (api && api.status >= 400 && api.status < 500) {
        key.current = null;
        setNotice({
          tone: api.status === 409 ? 'warning' : 'danger',
          text: RECHECK_ERROR_COPY[api.code] ?? (api.message || '재검수를 시작하지 못했어요.'),
          suggestRetry: api.code === 'VALIDATION_RECHECK_INPUT_UNCHANGED',
        });
        void report.refreshReport();
        void eligibilityQuery.refetch();
        return;
      }
      await recoverLostResponse();
    }
  };

  return {
    listed,
    canRecheck,
    lockReason,
    open,
    openConfirmation: () => { setNotice(null); setOpen(true); },
    closeConfirmation: () => { if (!pending) { setOpen(false); setNotice(null); } },
    episode: episodeQuery.data?.data,
    episodeLoading: episodeQuery.isPending && episodeQuery.fetchStatus !== 'idle',
    episodeError: episodeQuery.isError,
    reloadEpisode: () => void episodeQuery.refetch(),
    reloadEligibility: () => void eligibilityQuery.refetch(),
    eligibilityError: eligibilityQuery.isError,
    diagnostic,
    notice,
    pending,
    submit,
  };
}
