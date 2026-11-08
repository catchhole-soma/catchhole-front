import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocation, useSearchParams } from 'react-router';
import {
  AlertCircle,
  CheckCircle2,
  Clock3,
  FileSearch,
  Loader2,
  RefreshCw,
  TriangleAlert,
} from 'lucide-react';
import {
  deleteAnalysisBatchHistoryMutation,
  getAnalysisBatchesOptions,
  getAnalysisBatchesQueryKey,
} from '../../api/generated/@tanstack/react-query.gen';
import type {
  AnalysisBatchJobGroupResponse,
  AnalysisBatchSummaryResponse,
} from '../../api/generated/types.gen';
import { useAppNavigate } from '../../hooks/useAppNavigate';
import {
  notifyAiTokenQuotaExhausted,
  observeAnalysisInterruption,
} from '../../lib/ai-token-quota';
import { PageNavigation } from './PageNavigation';
import { PageHeading } from './ui-v2/PageHeading';
import { AnalysisListBookCard } from './AnalysisListBookCard';
import { invalidateAppliedSettings } from '../../lib/analysis-source';
import { AnalysisCard, CandidateReviewCount } from './AnalysisCard';
import { AnalysisHistoryDeleteModal } from './AnalysisHistoryDeleteModal';
import { toApiError } from '../../lib/api-errors';
import {
  ACTIVE_VALIDATION_STAGES,
  VALIDATION_STAGE_SUMMARY,
  validationReportUrl,
} from './validation/validation-report-labels';

const PAGE_SIZE = 10;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type AnalysisBatchStatus = NonNullable<AnalysisBatchSummaryResponse['episodeStatus']>;

type ValidationRequest = NonNullable<AnalysisBatchSummaryResponse['validationReports']>[number];

/** 분석 목록은 설정 추출 배치, 오류 리포트 목록은 신규 회차 검수 배치를 서버 페이지 단위로 받는다. */
export type AnalysisListKind = 'ANALYSIS' | 'VALIDATION';

const LIST_COPY: Record<AnalysisListKind, {
  eyebrow: string; title: string; description: string; returnLabel: string; emptyTitle: string; emptyDescription: string;
  loading: string; loadFailed: string;
}> = {
  ANALYSIS: {
    eyebrow: 'AI ANALYSIS',
    title: '분석 목록',
    description: '회차와 설정집의 분석 진행·실패·설정 후보 검토 상태를 확인합니다.',
    returnLabel: '분석 목록',
    emptyTitle: '아직 요청한 분석이 없습니다.',
    emptyDescription: '원고를 올리고 분석을 시작하면 업로드 묶음별로 표시됩니다.',
    loading: '분석 목록을 불러오는 중...',
    loadFailed: '분석 목록을 불러오지 못했습니다.',
  },
  VALIDATION: {
    eyebrow: 'ERROR REPORT',
    title: '오류 리포트',
    description: '신규 회차 검수의 오류 검사·검토 상태를 확인합니다. 검토를 마친 회차의 설정 추출은 분석 목록에서 이어집니다.',
    returnLabel: '오류 리포트 목록',
    emptyTitle: '아직 검수한 회차가 없습니다.',
    emptyDescription: '회차를 올릴 때 신규 회차 검수를 고르면 회차별 오류 리포트가 표시됩니다.',
    loading: '오류 리포트 목록을 불러오는 중...',
    loadFailed: '오류 리포트 목록을 불러오지 못했습니다.',
  },
};

const VALIDATION_STAGE_ICONS: Record<keyof typeof VALIDATION_STAGE_SUMMARY, typeof Clock3> = {
  PREPARING_BASELINE: Clock3,
  VALIDATING: Clock3,
  AWAITING_REVIEW: FileSearch,
  REVIEW_COMPLETED: Clock3,
  EXTRACTION_FAILED: AlertCircle,
  APPLICATION_HELD: TriangleAlert,
  APPLIED: CheckCircle2,
  HELD_INCOMPLETE: TriangleAlert,
  INVALIDATED: AlertCircle,
};

/** 배치 요약의 현재 검수 report. 리포트를 열 수 있는 식별자가 있는 것만 사용한다. */
function validationRequest(batch: AnalysisBatchSummaryResponse): ValidationRequest | undefined {
  return batch.validationReports?.find(report => Boolean(report.reportId));
}

/** 검수 기준 준비·검사·검토 종료 뒤 추출 중에는 같은 배치 요약만 다시 읽어 단계를 갱신한다. */
function hasActiveValidation(batch: AnalysisBatchSummaryResponse) {
  return (batch.validationReports ?? []).some(report => report.reviewStage && ACTIVE_VALIDATION_STAGES.has(report.reviewStage));
}

const STATUS_VIEW: Record<AnalysisBatchStatus, {
  label: string;
  description: string;
  tone: 'primary' | 'warning' | 'danger' | 'success';
  icon: typeof Clock3;
}> = {
  IN_PROGRESS: {
    label: '분석 중',
    description: '회차별 분석이 진행되고 있습니다.',
    tone: 'primary',
    icon: Clock3,
  },
  CANCELED: {
    label: '분석 취소',
    description: '원문이나 설정 변경, 작품 삭제로 분석을 이어갈 수 없습니다. 현재 상태를 확인해 주세요.',
    tone: 'warning',
    icon: AlertCircle,
  },
  PARTIALLY_FAILED: {
    label: '일부 분석 중단',
    description: '완료된 회차는 유지됩니다. 중단된 회차를 재개하면 대기 중인 회차도 이어집니다.',
    tone: 'warning',
    icon: TriangleAlert,
  },
  FAILED: {
    label: '분석 실패',
    description: '실패 원인을 확인하고 회차 분석을 다시 시도할 수 있습니다.',
    tone: 'danger',
    icon: AlertCircle,
  },
  REVIEW_REQUIRED: {
    label: '분석 완료',
    description: '회차 분석은 끝났습니다. 아직 확인하지 않은 설정은 결과에서 확인할 수 있습니다.',
    tone: 'success',
    icon: FileSearch,
  },
  COMPLETED: {
    label: '분석 완료',
    description: '회차 분석과 설정 정리가 모두 끝났습니다.',
    tone: 'success',
    icon: CheckCircle2,
  },
  // GH314: 오류 검사 우선 검수의 배치 상태. 검토 종료 뒤 단계는 reviewStage가 결정하므로 결과를 단정하지 않는다.
  ERROR_REVIEW_PREPARING: {
    label: '오류 검사 중',
    description: '설정 충돌을 확인하고 있어요.',
    tone: 'primary',
    icon: Clock3,
  },
  ERROR_REVIEW_PENDING: {
    label: '오류 검토',
    description: '오류 리포트에서 검사 결과와 설정 추출 상태를 확인해 주세요.',
    tone: 'warning',
    icon: FileSearch,
  },
  ERROR_REVIEW_HELD: {
    label: '오류 검사 보류',
    description: '비교할 기준을 준비하지 못했어요.',
    tone: 'warning',
    icon: TriangleAlert,
  },
  ERROR_REVIEW_INVALIDATED: {
    label: '재검수 필요',
    description: '원고 또는 비교한 설정이 바뀌었어요. 수정 내용을 반영해 다시 검수해 주세요.',
    tone: 'warning',
    icon: AlertCircle,
  },
};

/**
 * 신규 회차 검수 배치 카드. 단계는 배치 요약의 reviewStage만 쓰고, 모든 단계에서 같은 오류 리포트를 연다.
 * 설정 추출 실패만 검토 종료가 만든 추출 Job의 기존 진행 화면을 함께 연다.
 */
function ValidationBatchCard({ batch, validation, reportId, fallbackView, onOpenReport, onOpenProgress }: {
  batch: AnalysisBatchSummaryResponse;
  validation: ValidationRequest;
  reportId: string;
  fallbackView: (typeof STATUS_VIEW)[AnalysisBatchStatus];
  onOpenReport: (reportId: string) => void;
  onOpenProgress: (group: AnalysisBatchJobGroupResponse) => void;
}) {
  const stage = validation.reviewStage;
  // reviewStage가 없는 구응답만 배치 상태를 표시용으로 사용한다.
  const view = stage ? { ...VALIDATION_STAGE_SUMMARY[stage], icon: VALIDATION_STAGE_ICONS[stage] } : fallbackView;
  const extractionGroup = stage === 'EXTRACTION_FAILED' ? findActionJobGroup(batch, 'FAILED') : undefined;
  return (
    <AnalysisCard
      testId="validation-analysis-card"
      icon={view.icon}
      tone={view.tone}
      title={<>{validation.sourceEpisodeNo != null ? `${validation.sourceEpisodeNo}화` : episodeRange(batch)}<small>신규 회차 검수</small></>}
      status={view.label}
      description={view.description}
      activityAt={batch.lastActivityAt ?? batch.lastRequestedAt}
      actions={<>
        {extractionGroup && (extractionGroup.currentAnalysisJobIds?.length ?? 0) > 0 && (
          <button type="button" className="analysis-card-action analysis-tone--danger" onClick={() => onOpenProgress(extractionGroup)}>
            추출 상태 보기
          </button>
        )}
        <button type="button" className="analysis-card-action analysis-tone--primary" onClick={() => onOpenReport(reportId)}>
          오류 리포트 보기
        </button>
      </>}
    />
  );
}

type ExtractionPhase = 'IN_PROGRESS' | 'FAILED' | 'CANCELED' | 'COMPLETED';

const EXTRACTION_VIEW: Record<ExtractionPhase, {
  label: string; description: string; tone: 'primary' | 'warning' | 'danger' | 'success'; icon: typeof Clock3; action: string;
}> = {
  IN_PROGRESS: {
    label: '설정 추출 중',
    description: '오류 검토를 마쳐 이번 회차의 설정을 추출하고 있습니다.',
    tone: 'primary', icon: Clock3, action: '진행 보기',
  },
  FAILED: {
    label: '설정 추출 실패',
    description: '오류 검사와 검토 결과는 그대로 남아 있습니다. 추출 상태를 확인해 주세요.',
    tone: 'danger', icon: AlertCircle, action: '실패 확인',
  },
  CANCELED: {
    label: '설정 추출 취소',
    description: '원문이나 설정이 바뀌어 추출을 이어갈 수 없습니다. 현재 상태를 확인해 주세요.',
    tone: 'warning', icon: AlertCircle, action: '취소 확인',
  },
  COMPLETED: {
    label: '설정 추출 완료',
    description: '설정 추출을 마쳤습니다. 설정 확정 결과는 오류 리포트에서 확인할 수 있습니다.',
    tone: 'success', icon: CheckCircle2, action: '결과 보기',
  },
};

function extractionPhase(status?: AnalysisBatchJobGroupResponse['status']): ExtractionPhase {
  if (status === 'IN_PROGRESS') return 'IN_PROGRESS';
  if (status === 'FAILED' || status === 'PARTIALLY_FAILED') return 'FAILED';
  if (status === 'CANCELED') return 'CANCELED';
  return 'COMPLETED';
}

/**
 * 검토를 마친 검수 회차의 설정 추출 카드(분석 목록). 검수 배치 status는 검수 단계를 가리키므로
 * 검토 종료가 만든 추출 Job 그룹의 상태로 진행·실패·완료를 고른다.
 */
function ValidationExtractionCard({ batch, validation, reportId, group, onOpenReport, onOpenProgress, onOpenResults, deleteAction }: {
  batch: AnalysisBatchSummaryResponse;
  validation: ValidationRequest;
  reportId: string;
  group: AnalysisBatchJobGroupResponse;
  onOpenReport: (reportId: string) => void;
  onOpenProgress: (group: AnalysisBatchJobGroupResponse) => void;
  onOpenResults: () => void;
  deleteAction?: ReactNode;
}) {
  const phase = extractionPhase(group.status);
  const view = EXTRACTION_VIEW[phase];
  const progressAvailable = (group.currentAnalysisJobIds?.length ?? 0) > 0;
  const actionEnabled = phase === 'COMPLETED' ? Boolean(batch.batchId) : progressAvailable;
  return (
    <AnalysisCard
      testId="validation-extraction-card"
      icon={view.icon}
      tone={view.tone}
      title={<>{validation.sourceEpisodeNo != null ? `${validation.sourceEpisodeNo}화` : episodeRange(batch)}<small>신규 회차 검수 · 설정 추출</small></>}
      status={view.label}
      description={view.description}
      activityAt={batch.lastActivityAt ?? batch.lastRequestedAt}
      actions={<>
        {deleteAction}
        <button type="button" className="analysis-card-action analysis-tone--primary" onClick={() => onOpenReport(reportId)}>
          오류 리포트 보기
        </button>
        <button type="button" disabled={!actionEnabled}
          className={`analysis-card-action analysis-tone--${phase === 'COMPLETED' ? 'primary' : view.tone}`}
          onClick={() => (phase === 'COMPLETED' ? onOpenResults() : onOpenProgress(group))}>
          {view.action}
        </button>
      </>}
    >
      <div className="analysis-batch-card__groups">
        <span className="analysis-batch-card__group">
          설정 추출 · {group.succeededJobCount ?? 0}/{group.totalJobCount ?? 0} 완료
          {(group.failedJobCount ?? 0) > 0 ? ` · ${group.failedJobCount} 실패` : ''}
          {(group.canceledJobCount ?? 0) > 0 ? ` · ${group.canceledJobCount} 취소` : ''}
        </span>
      </div>
    </AnalysisCard>
  );
}

function parsePage(value: string | null): number {
  const parsed = Number.parseInt(value ?? '1', 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed - 1 : 0;
}

function episodeRange(batch: AnalysisBatchSummaryResponse): string {
  const start = batch.episodeStartNo;
  const end = batch.episodeEndNo;
  if (start === null || start === undefined) return '대상 회차 정보 없음';
  if (end === null || end === undefined || start === end) return `${start}화`;
  return `${start}~${end}화`;
}

function jobTypeLabel(jobType?: AnalysisBatchJobGroupResponse['jobType']): string {
  return jobType === 'SETTING_EXTRACTION' ? '기존 설정 구축' : '신규 회차 검수';
}

function actionLabel(status: AnalysisBatchStatus, tokenInterruptedCount: number): string {
  if (tokenInterruptedCount > 0) return '남은 비교 확인';
  if (status === 'IN_PROGRESS') return '진행 보기';
  if (status === 'CANCELED') return '취소 확인';
  if (status === 'FAILED' || status === 'PARTIALLY_FAILED') return '실패 확인';
  return '결과 보기';
}

function hasSettledTokenInterruption(batch: AnalysisBatchSummaryResponse): boolean {
  return batch.episodeStatus !== 'IN_PROGRESS'
    && batch.episodeStatus !== 'CANCELED'
    && (batch.worldSettingTokenInterruptedCandidateCount ?? 0) > 0;
}

function hasAnalysisFailure(batch: AnalysisBatchSummaryResponse): boolean {
  return (batch.episodeJobGroups ?? []).some(group => (
    group.status === 'FAILED' || group.status === 'PARTIALLY_FAILED'
  ));
}

function findActionJobGroup(
  batch: AnalysisBatchSummaryResponse,
  status: AnalysisBatchStatus,
): AnalysisBatchJobGroupResponse | undefined {
  const groups = batch.episodeJobGroups ?? [];
  const preferredStatuses = status === 'IN_PROGRESS'
    ? ['IN_PROGRESS']
    : status === 'CANCELED'
      ? ['CANCELED']
      : status === 'PARTIALLY_FAILED'
        ? ['PARTIALLY_FAILED', 'FAILED']
        : status === 'FAILED'
          ? ['FAILED', 'PARTIALLY_FAILED']
          : [];

  return preferredStatuses
    .map(preferredStatus => groups.find(group => (
      group.status === preferredStatus
      && (group.currentAnalysisJobIds?.length ?? 0) > 0
    )))
    .find(group => group !== undefined)
    ?? groups.find(group => (group.currentAnalysisJobIds?.length ?? 0) > 0);
}

export function AnalysisList({ workId, kind }: { workId: string; kind: AnalysisListKind }) {
  const copy = LIST_COPY[kind];
  const navigate = useAppNavigate();
  const queryClient = useQueryClient();
  const invalidatedCompletedOrigins = useRef(new Set<string>());
  const notifiedQuotaOrigins = useRef(new Set<string>());
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const page = parsePage(searchParams.get('analysisPage'));
  const apiEnabled = UUID_PATTERN.test(workId);
  const analysisQuery = useQuery({
    ...getAnalysisBatchesOptions({
      path: { workId },
      query: { page, size: PAGE_SIZE, kind },
    }),
    enabled: apiEnabled,
    retry: false,
    refetchInterval: query => (
      query.state.data?.data?.content?.some(batch => batch.status === 'IN_PROGRESS'
        || batch.settingBooks?.some(book => book.status === 'PENDING' || book.status === 'IN_PROGRESS')
        || hasActiveValidation(batch))
        ? 10_000
        : false
    ),
  });
  const pageData = analysisQuery.data?.data;
  const batches = useMemo(() => pageData?.content ?? [], [pageData?.content]);
  const [historyDeleteTarget, setHistoryDeleteTarget] = useState<AnalysisBatchSummaryResponse | null>(null);
  const [historyDeleteError, setHistoryDeleteError] = useState<string | null>(null);
  const historyDeleteRequest = useMutation(deleteAnalysisBatchHistoryMutation());
  const totalPages = Math.max(1, pageData?.totalPages ?? 1);
  const hasPageData = pageData !== undefined;

  useEffect(() => {
    if (!pageData || page < totalPages) return;
    setSearchParams(params => {
      if (totalPages <= 1) params.delete('analysisPage');
      else params.set('analysisPage', String(totalPages));
      return params;
    }, { replace: true });
  }, [page, pageData, setSearchParams, totalPages]);

  useEffect(() => {
    const interruptedBatches = batches.filter(batch => {
      if (!batch.batchId) return false;
      const shouldNotify = observeAnalysisInterruption({
        batchId: batch.batchId,
        interruptedComparisonCount: batch.worldSettingTokenInterruptedCandidateCount ?? 0,
        active: batch.episodeStatus === 'IN_PROGRESS',
      });
      return hasSettledTokenInterruption(batch) && shouldNotify;
    });
    if (interruptedBatches.length === 0) return;
    notifyAiTokenQuotaExhausted({
      kind: 'analysis-interrupted',
      interruptedComparisonCount: interruptedBatches.reduce(
        (total, batch) => total + (batch.worldSettingTokenInterruptedCandidateCount ?? 0),
        0,
      ),
    });
  }, [batches]);

  useEffect(() => {
    let completed = false;
    let quotaInterrupted = false;
    for (const batch of batches) for (const book of batch.settingBooks ?? []) {
      if (!book.sourceAnalysisJobId) continue;
      const key = `${workId}:${book.sourceAnalysisJobId}`;
      if (book.status === 'COMPLETED' && !invalidatedCompletedOrigins.current.has(key)) {
        invalidatedCompletedOrigins.current.add(key);
        completed = true;
      }
      if (book.status === 'INTERRUPTED' && book.failureCode === 'AI_TOKEN_QUOTA_EXHAUSTED'
        && !notifiedQuotaOrigins.current.has(key)) {
        notifiedQuotaOrigins.current.add(key);
        quotaInterrupted = true;
      }
    }
    if (completed) void invalidateAppliedSettings(queryClient, workId, {
      excludeQueryKey: getAnalysisBatchesQueryKey({ path: { workId }, query: { page, size: PAGE_SIZE, kind } }),
    });
    if (quotaInterrupted) notifyAiTokenQuotaExhausted({ kind: 'analysis-failed', sourceKind: 'SETTING_BOOK' });
  }, [batches, kind, page, queryClient, workId]);

  const changePage = (nextPage: number) => {
    setSearchParams(params => {
      if (nextPage <= 0) params.delete('analysisPage');
      else params.set('analysisPage', String(nextPage + 1));
      return params;
    }, { replace: true });
  };

  const openProgress = (
    batch: AnalysisBatchSummaryResponse,
    group: AnalysisBatchJobGroupResponse,
  ) => {
    if (!batch.batchId || !group.jobType) return;
    const currentIds = [...new Set(group.currentAnalysisJobIds ?? [])];
    const jobIds = currentIds;
    if (jobIds.length === 0) return;
    const encodedIds = encodeURIComponent(jobIds.join(','));
    navigate(
      `/episode-upload?workId=${encodeURIComponent(workId)}`
      + `&batchId=${encodeURIComponent(batch.batchId)}`
      + `&analysisJobIds=${encodedIds}`
      + `&currentAnalysisJobIds=${encodedIds}`
      + `&jobType=${group.jobType}`,
      'push-right',
      {
        returnToAnalysisList: `${location.pathname}${location.search}`,
        returnHistoryDelta: -1,
        returnLabel: copy.returnLabel,
      },
    );
  };

  /** 0건·부분 결과·보류·확정·무효를 포함한 모든 검수 단계는 같은 오류 리포트를 연다. */
  const openValidationReport = (reportId: string) => navigate(validationReportUrl(workId, reportId), 'dissolve',
    { returnToAnalysisList: `${location.pathname}${location.search}`, returnHistoryDelta: -1, returnLabel: copy.returnLabel });

  const openReview = (batch: AnalysisBatchSummaryResponse, showAll = batch.episodeStatus === 'COMPLETED') => {
    if (!batch.batchId) return;
    const jobType = batch.episodeJobGroups?.find(group => group.jobType === 'SETTING_EXTRACTION')?.jobType
      ?? batch.episodeJobGroups?.[0]?.jobType
      ?? 'SETTING_EXTRACTION';
    const reviewStatus = showAll ? '&reviewStatus=ALL' : '';
    const candidateType = (batch.worldSettingTokenInterruptedCandidateCount ?? 0) > 0
      ? '&candidateType=world'
      : '';
    navigate(
      `/setting-review?workId=${encodeURIComponent(workId)}`
      + `&batchId=${encodeURIComponent(batch.batchId)}`
      + `&jobType=${jobType}`
      + candidateType
      + reviewStatus,
      'dissolve',
      {
        returnToAnalysisList: `${location.pathname}${location.search}`,
        returnHistoryDelta: -1,
      },
    );
  };

  const closeHistoryDelete = () => {
    if (historyDeleteRequest.isPending) return;
    setHistoryDeleteTarget(null);
    setHistoryDeleteError(null);
  };

  const deleteHistory = async () => {
    const batchId = historyDeleteTarget?.batchId;
    if (!batchId || historyDeleteRequest.isPending) return;
    setHistoryDeleteError(null);
    try {
      await historyDeleteRequest.mutateAsync({ path: { workId, batchId } });
      setHistoryDeleteTarget(null);
    } catch (error) {
      setHistoryDeleteError(toApiError(error)?.message ?? '분석 기록을 삭제하지 못했습니다. 잠시 후 다시 시도해 주세요.');
    } finally {
      // 원고 목록 위 알림도 같은 배치 요약(전체 목록 첫 묶음)을 읽으므로 이 작품의 모든 목록을 다시 받는다.
      void queryClient.invalidateQueries({ queryKey: getAnalysisBatchesQueryKey({ path: { workId } }) });
    }
  };

  /** 서버가 삭제할 수 있다고 한 분석 목록 카드에만 둔다. 오류 리포트 목록에서는 제공하지 않는다. */
  const historyDeleteAction = (batch: AnalysisBatchSummaryResponse) => (
    kind === 'ANALYSIS' && batch.historyDeletable === true && batch.batchId ? (
      <button type="button" className="analysis-card-action analysis-card-action--quiet"
        onClick={() => { setHistoryDeleteError(null); setHistoryDeleteTarget(batch); }}>
        기록 삭제
      </button>
    ) : null
  );

  return (
    <div className="analysis-list-page">
      <PageHeading eyebrow={copy.eyebrow} title={copy.title} description={copy.description} />

      {apiEnabled && analysisQuery.isPending && !hasPageData ? (
        <div className="analysis-list-state">
          <Loader2 size={18} className="spin" /> {copy.loading}
        </div>
      ) : apiEnabled && analysisQuery.isError && !hasPageData ? (
        <div className="analysis-list-state">
          <AlertCircle size={36} />
          <div>{copy.loadFailed}</div>
          <button type="button" className="analysis-card-action analysis-tone--danger" onClick={() => void analysisQuery.refetch()}>
            <RefreshCw size={12} /> 다시 불러오기
          </button>
        </div>
      ) : batches.length === 0 ? (
        <div className="analysis-list-state">
          <FileSearch size={38} strokeWidth={1.3} />
          <div>{copy.emptyTitle}</div>
          <small>{copy.emptyDescription}</small>
        </div>
      ) : (
        <div className="analysis-list-content">
          {analysisQuery.isError && hasPageData && (
            <div role="alert" className="work-picker-alert" style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 12,
              padding: '10px 12px',
              borderRadius: 7,
              fontSize: 12,
            }}>
              <span>최신 상태를 불러오지 못해 이전 목록을 표시합니다.</span>
              <button type="button" onClick={() => void analysisQuery.refetch()} style={{
                border: 0,
                background: 'transparent',
                color: 'inherit',
                fontFamily: 'inherit',
                fontSize: 12,
                fontWeight: 700,
                cursor: 'pointer',
              }}>
                다시 불러오기
              </button>
            </div>
          )}
          {batches.map(batch => {
            const validation = validationRequest(batch);
            if (kind === 'VALIDATION') {
              // 서버가 현재 검수 report가 있는 배치만 준다. 설정집 카드는 분석 목록에만 둔다.
              if (!validation?.reportId || batch.episodeStatus == null) return null;
              return <div key={batch.batchId}><ValidationBatchCard batch={batch} validation={validation} reportId={validation.reportId}
                fallbackView={STATUS_VIEW[batch.episodeStatus]} onOpenReport={openValidationReport} onOpenProgress={group => openProgress(batch, group)} /></div>;
            }
            const bookCards = (batch.settingBooks ?? []).map(book => (
              <AnalysisListBookCard key={book.sourceAnalysisJobId} workId={workId} book={book} />
            ));
            if (validation?.reportId) {
              // 검수 배치는 검토 종료가 만든 설정 추출 Job부터 분석 목록에 나온다. 검사·검토 단계는 오류 리포트 목록에서 본다.
              const extractionGroup = batch.episodeJobGroups?.find(group => group.jobType === 'SETTING_EXTRACTION');
              if (!extractionGroup) return <div key={batch.batchId}>{bookCards}</div>;
              return <div key={batch.batchId}><ValidationExtractionCard batch={batch} validation={validation} reportId={validation.reportId}
                group={extractionGroup} onOpenReport={openValidationReport} onOpenProgress={group => openProgress(batch, group)}
                onOpenResults={() => openReview(batch, true)} deleteAction={historyDeleteAction(batch)} />{bookCards}</div>;
            }
            if (batch.episodeStatus == null) return <div key={batch.batchId}>{bookCards}</div>;
            const status = batch.episodeStatus;
            const tokenInterruptedCount = batch.worldSettingTokenInterruptedCandidateCount ?? 0;
            const hasTokenInterruption = hasSettledTokenInterruption(batch);
            const analysisFailure = hasAnalysisFailure(batch);
            const prioritizesTokenInterruption = hasTokenInterruption && !analysisFailure;
            const view = prioritizesTokenInterruption
              ? {
                  label: '세계관 비교 일부 중단',
                  description: `${tokenInterruptedCount}개 비교가 사용량 부족으로 중단됐습니다. 완료된 추출과 비교 결과는 유지됩니다.`,
                  tone: 'warning' as const,
                  icon: TriangleAlert,
                }
              : STATUS_VIEW[status];
            const characterPendingCount = batch.pendingCandidateCount ?? 0;
            const characterReviewedCount = batch.reviewedCandidateCount ?? 0;
            const characterTotalCount = batch.totalCandidateCount ?? 0;
            const worldSettingPendingCount = batch.worldSettingPendingCandidateCount ?? 0;
            const worldSettingReviewedCount = batch.worldSettingReviewedCandidateCount ?? 0;
            const worldSettingTotalCount = batch.worldSettingTotalCandidateCount ?? 0;
            const hasCandidateCounts = characterTotalCount > 0 || worldSettingTotalCount > 0;
            const opensReview = !analysisFailure && (
              hasTokenInterruption
              || status === 'REVIEW_REQUIRED'
              || status === 'COMPLETED'
            );
            const actionGroup = opensReview ? undefined : findActionJobGroup(batch, status);
            const actionEnabled = opensReview
              ? Boolean(batch.batchId)
              : (actionGroup?.currentAnalysisJobIds?.length ?? 0) > 0;
            const episodeCard = (
              <AnalysisCard
                key={batch.batchId}
                icon={view.icon}
                tone={view.tone}
                title={<>{episodeRange(batch)}<small>{batch.episodeCount ?? 0}개 회차</small></>}
                status={<>{view.label}{status === 'REVIEW_REQUIRED'
                  && characterPendingCount + worldSettingPendingCount > 0
                  ? ` · ${characterPendingCount + worldSettingPendingCount}개 확인 가능` : ''}</>}
                description={view.description}
                activityAt={batch.lastActivityAt ?? batch.lastRequestedAt}
                actions={<>
                  {historyDeleteAction(batch)}
                  <button type="button" disabled={!actionEnabled}
                    onClick={() => {
                      if (opensReview) openReview(batch);
                      else if (actionGroup) openProgress(batch, actionGroup);
                    }}
                    className={`analysis-card-action analysis-tone--${opensReview ? 'primary' : view.tone}`}>
                    {actionLabel(status, prioritizesTokenInterruption ? tokenInterruptedCount : 0)}
                  </button>
                </>}
              >
                    <div className="analysis-batch-card__groups">
                      {(batch.episodeJobGroups ?? []).map(group => (
                        <span key={group.jobType} className="analysis-batch-card__group">
                          {jobTypeLabel(group.jobType)}
                          {' · '}
                          {group.succeededJobCount ?? 0}/{group.totalJobCount ?? 0} 완료
                          {(group.failedJobCount ?? 0) > 0 ? ` · ${group.failedJobCount} 실패` : ''}
                          {(group.canceledJobCount ?? 0) > 0 ? ` · ${group.canceledJobCount} 취소` : ''}
                          {(group.pendingJobCount ?? 0) > 0 ? ` · ${group.pendingJobCount} 대기` : ''}
                        </span>
                      ))}
                    </div>
                    {hasCandidateCounts && (
                      <div className="analysis-review-counts">
                        <CandidateReviewCount
                          label="캐릭터 설정 후보"
                          totalCount={characterTotalCount}
                          reviewedCount={characterReviewedCount}
                          pendingCount={characterPendingCount}
                        />
                        <CandidateReviewCount
                          label="세계관 설정 후보"
                          totalCount={worldSettingTotalCount}
                          reviewedCount={worldSettingReviewedCount}
                          pendingCount={worldSettingPendingCount}
                        />
                      </div>
                    )}
              </AnalysisCard>
            );
            return <div key={batch.batchId}>{episodeCard}{bookCards}</div>;
          })}
          <div style={{ marginTop: 6 }}>
            <PageNavigation
              page={Math.min(page, totalPages - 1)}
              totalPages={totalPages}
              disabled={analysisQuery.isFetching}
              onPageChange={changePage}
            />
          </div>
        </div>
      )}
      {historyDeleteTarget && (
        <AnalysisHistoryDeleteModal
          label={episodeRange(historyDeleteTarget)}
          submitting={historyDeleteRequest.isPending}
          errorMessage={historyDeleteError}
          onClose={closeHistoryDelete}
          onDelete={() => void deleteHistory()}
        />
      )}
    </div>
  );
}
