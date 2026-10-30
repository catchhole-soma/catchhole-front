import { useEffect, useRef, useState } from 'react';
import { useMutation, useQueryClient, type QueryClient } from '@tanstack/react-query';
import {
  getCurrentEpisodeValidationOptions,
  getEpisodeOptions,
  getEpisodeValidationEligibilityOptions,
  startEpisodeValidationMutation,
} from '../../../api/generated/@tanstack/react-query.gen';
import { toApiError, type ApiError } from '../../../lib/api-errors';
import { admissionBlockFromError, type AdmissionBlock } from './validation-admission';
import { ELIGIBILITY_REASON_COPY } from './validation-report-labels';

export type IntakeFailure =
  /** 현재 검수가 없음을 확인했다. 접수 요청이 서버에 닿지 않았다. */
  | { kind: 'not-started' }
  /** 접수 결과와 현재 검수를 모두 확인하지 못했다. */
  | { kind: 'unconfirmed' }
  /** 서버가 이 회차의 접수를 거절했다. fallback이면 기존 설정 구축을 대신 제안한다. */
  | { kind: 'refused'; message: string; detail?: string; fallback: boolean }
  /** 원고 버전·요청 키 충돌처럼 최신 상태를 다시 읽고 시도하면 되는 거절. */
  | { kind: 'retryable'; message: string }
  | { kind: 'blocked'; block: AdmissionBlock };

export type ValidationIntake = {
  batchId: string;
  episodeId: string;
  phase: 'starting' | 'recovering' | 'failed';
  failure?: IntakeFailure;
};

type IntakeTarget = { batchId: string; episodeId: string };
type CurrentReport = { reportId: string } | 'missing' | 'unknown';

function newIdempotencyKey() {
  const random = typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return `validation-start-${random}`;
}

/** 응답을 받지 못한 접수는 회차의 현재 검수로 확인한다. 새 접수를 다시 보내지 않는다. */
async function findCurrentReport(queryClient: QueryClient, workId: string, episodeId: string): Promise<CurrentReport> {
  try {
    const response = await queryClient.fetchQuery({
      ...getCurrentEpisodeValidationOptions({ path: { workId }, query: { episodeId } }), staleTime: 0, retry: false,
    });
    return response.data?.reportId ? { reportId: response.data.reportId } : 'unknown';
  } catch (error) {
    return toApiError(error)?.status === 404 ? 'missing' : 'unknown';
  }
}

function failedIntake(target: IntakeTarget, result: 'missing' | 'unknown'): ValidationIntake {
  return { ...target, phase: 'failed', failure: { kind: result === 'missing' ? 'not-started' : 'unconfirmed' } };
}

/** 접수 거절 문구. VALIDATION_TARGET_INVALID는 사유를 공유하므로 자격 조회의 reasonCode로 구분한다. */
async function intakeRefusal(queryClient: QueryClient, workId: string, episodeId: string, api: ApiError): Promise<IntakeFailure | { reportId: string }> {
  const block = admissionBlockFromError(api);
  if (block) return { kind: 'blocked', block };
  if (api.code === 'VALIDATION_COMPARISON_MATERIAL_REQUIRED') return {
    kind: 'refused',
    message: ELIGIBILITY_REASON_COPY.COMPARISON_MATERIAL_REQUIRED,
    detail: '비교할 자료가 아직 없어요. 설정집을 먼저 올리거나 이 회차를 기존 설정 구축으로 분석해 설정을 만들어 주세요.',
    fallback: true,
  };
  if (api.code === 'VALIDATION_SOURCE_VERSION_CONFLICT' || api.code === 'VALIDATION_IDEMPOTENCY_CONFLICT') {
    return { kind: 'retryable', message: api.message || '원고 상태가 바뀌었어요. 최신 원고를 확인한 뒤 다시 시도해 주세요.' };
  }
  if (api.code === 'VALIDATION_TARGET_INVALID') {
    try {
      const eligibility = (await queryClient.fetchQuery({
        ...getEpisodeValidationEligibilityOptions({ path: { workId }, query: { episodeId } }), staleTime: 0, retry: false,
      })).data;
      if (eligibility?.reasonCode === 'REPORT_EXISTS' && eligibility.currentReport?.reportId) return { reportId: eligibility.currentReport.reportId };
      if (eligibility?.reasonCode && eligibility.reasonCode !== 'ELIGIBLE') {
        return { kind: 'refused', message: ELIGIBILITY_REASON_COPY[eligibility.reasonCode], fallback: eligibility.reasonCode !== 'EPISODE_NOT_FOUND' };
      }
    } catch {
      // 사유를 다시 읽지 못해도 서버가 정규화한 거절 문구를 보여 준다.
    }
    return { kind: 'refused', message: api.message || ELIGIBILITY_REASON_COPY.NOT_SINGLE_APPEND_UPLOAD, fallback: true };
  }
  return { kind: 'refused', message: api.message || '이 회차의 검수를 시작하지 못했어요.', fallback: false };
}

/**
 * 업로드한 신규 단일 회차의 검수 접수(POST /episode-validations). 업로드 시도마다 멱등 키 하나를 만들고
 * 응답 유실·5xx 재시도에는 같은 키를, 확정된 4xx 거절 뒤에는 새 키를 쓴다. 새로고침 복구는 현재 검수만 읽는다.
 */
export function useValidationIntake({ workId, resumeTarget, onReport }: {
  workId: string;
  resumeTarget: IntakeTarget | null;
  onReport: (reportId: string) => void;
}) {
  const queryClient = useQueryClient();
  const startMutation = useMutation(startEpisodeValidationMutation());
  const [intake, setIntake] = useState<ValidationIntake | null>(() => resumeTarget ? { ...resumeTarget, phase: 'recovering' } : null);
  const [initialTarget] = useState(resumeTarget);
  const keyRef = useRef<string | null>(null);
  const inFlight = useRef(false);
  const onReportRef = useRef(onReport);
  useEffect(() => { onReportRef.current = onReport; });
  // 사용자가 접수 응답 전에 화면을 떠나면 늦은 응답으로 화면을 바꾸지 않는다. 서버의 접수 자체는 취소하지 않는다.
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);
  const contextOf = () => window.location.pathname;
  const stillHere = (context: string) => mounted.current && contextOf() === context;

  // 새로고침·재진입: 접수 여부를 현재 검수로만 확인한다.
  useEffect(() => {
    if (!initialTarget) return;
    let cancelled = false;
    void findCurrentReport(queryClient, workId, initialTarget.episodeId).then(result => {
      if (cancelled) return;
      if (typeof result === 'object') onReportRef.current(result.reportId);
      else setIntake(failedIntake(initialTarget, result));
    });
    return () => { cancelled = true; };
  }, [initialTarget, queryClient, workId]);

  const recover = async ({ batchId, episodeId }: IntakeTarget, context = contextOf()) => {
    const target = { batchId, episodeId };
    if (inFlight.current || !stillHere(context)) return;
    inFlight.current = true;
    setIntake({ ...target, phase: 'recovering' });
    try {
      const result = await findCurrentReport(queryClient, workId, target.episodeId);
      if (!stillHere(context)) return;
      if (typeof result === 'object') onReportRef.current(result.reportId);
      else setIntake(failedIntake(target, result));
    } finally {
      inFlight.current = false;
    }
  };

  const start = async ({ batchId, episodeId }: IntakeTarget) => {
    const target = { batchId, episodeId };
    const context = contextOf();
    if (inFlight.current) return;
    inFlight.current = true;
    setIntake({ ...target, phase: 'starting' });
    let lost = false;
    try {
      // 접수는 업로드 뒤 회차 상세의 현재 원고 hash/key/version으로 한다(Backend episode-validation-staging.md).
      const episode = (await queryClient.fetchQuery({
        ...getEpisodeOptions({ path: { workId, episodeId: target.episodeId } }), staleTime: 0, gcTime: 0, retry: false,
      })).data;
      if (!episode?.contentHash || !episode.contentS3Key) throw new Error('원고 버전을 확인하지 못했어요.');
      keyRef.current ??= newIdempotencyKey();
      const response = await startMutation.mutateAsync({
        path: { workId },
        body: {
          idempotencyKey: keyRef.current,
          batchId: target.batchId,
          episodeId: target.episodeId,
          expectedContentHash: episode.contentHash,
          expectedContentS3Key: episode.contentS3Key,
          ...(episode.contentS3Version ? { expectedContentS3Version: episode.contentS3Version } : {}),
        },
      });
      if (!stillHere(context)) return;
      if (response.data?.reportId) onReportRef.current(response.data.reportId);
      else lost = true;
    } catch (error) {
      const api = toApiError(error);
      if (api && api.status >= 400 && api.status < 500) {
        keyRef.current = null;
        if (!stillHere(context)) return;
        const refusal = await intakeRefusal(queryClient, workId, target.episodeId, api);
        if (!stillHere(context)) return;
        if ('reportId' in refusal) onReportRef.current(refusal.reportId);
        else setIntake({ ...target, phase: 'failed', failure: refusal });
      } else {
        lost = true;
      }
    } finally {
      inFlight.current = false;
    }
    if (lost) await recover(target, context);
  };

  return { intake, start, recover, clear: () => setIntake(null) };
}
