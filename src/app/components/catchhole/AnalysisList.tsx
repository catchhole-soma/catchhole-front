import { useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
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
import { getAnalysisBatchesOptions } from '../../api/generated/@tanstack/react-query.gen';
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

const PAGE_SIZE = 10;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type AnalysisBatchStatus = NonNullable<AnalysisBatchSummaryResponse['status']>;

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
  PARTIALLY_FAILED: {
    label: '일부 실패',
    description: '완료된 회차는 유지되며 실패 회차만 다시 시도할 수 있습니다.',
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
    label: '후보 검토 필요',
    description: '분석이 끝났으며 추출된 설정 후보를 검토할 차례입니다.',
    tone: 'warning',
    icon: FileSearch,
  },
  COMPLETED: {
    label: '분석 완료',
    description: '분석과 설정 후보 검토가 모두 끝났습니다.',
    tone: 'success',
    icon: CheckCircle2,
  },
};

function parsePage(value: string | null): number {
  const parsed = Number.parseInt(value ?? '1', 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed - 1 : 0;
}

function formatDateTime(value?: string): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
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
  if (status === 'FAILED' || status === 'PARTIALLY_FAILED') return '실패 확인';
  return '결과 보기';
}

function hasSettledTokenInterruption(batch: AnalysisBatchSummaryResponse): boolean {
  return batch.status !== 'IN_PROGRESS'
    && (batch.worldSettingTokenInterruptedCandidateCount ?? 0) > 0;
}

function hasAnalysisFailure(batch: AnalysisBatchSummaryResponse): boolean {
  return (batch.jobGroups ?? []).some(group => (
    group.status === 'FAILED' || group.status === 'PARTIALLY_FAILED'
  ));
}

function CandidateReviewCount({
  label,
  totalCount,
  reviewedCount,
  pendingCount,
}: {
  label: string;
  totalCount: number;
  reviewedCount: number;
  pendingCount: number;
}) {
  if (totalCount === 0) return null;

  return (
    <div className="analysis-review-count">
      {label} {reviewedCount}/{totalCount}개 검토 완료
      {pendingCount > 0 && (
        <span className="analysis-review-count__pending">
          {pendingCount}개 대기
        </span>
      )}
    </div>
  );
}

function findActionJobGroup(
  batch: AnalysisBatchSummaryResponse,
  status: AnalysisBatchStatus,
): AnalysisBatchJobGroupResponse | undefined {
  const groups = batch.jobGroups ?? [];
  const preferredStatuses = status === 'IN_PROGRESS'
    ? ['IN_PROGRESS']
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

export function AnalysisList({ workId }: { workId: string }) {
  const navigate = useAppNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const page = parsePage(searchParams.get('analysisPage'));
  const apiEnabled = UUID_PATTERN.test(workId);
  const analysisQuery = useQuery({
    ...getAnalysisBatchesOptions({
      path: { workId },
      query: { page, size: PAGE_SIZE },
    }),
    enabled: apiEnabled,
    retry: false,
    refetchInterval: query => (
      query.state.data?.data?.content?.some(batch => batch.status === 'IN_PROGRESS')
        ? 10_000
        : false
    ),
  });
  const pageData = analysisQuery.data?.data;
  const batches = useMemo(() => pageData?.content ?? [], [pageData?.content]);
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
        active: batch.status === 'IN_PROGRESS',
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
    const jobIds = [...new Set(group.currentAnalysisJobIds ?? [])];
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
      },
    );
  };

  const openReview = (batch: AnalysisBatchSummaryResponse) => {
    if (!batch.batchId) return;
    const jobType = batch.jobGroups?.find(group => group.jobType === 'SETTING_EXTRACTION')?.jobType
      ?? batch.jobGroups?.[0]?.jobType
      ?? 'SETTING_EXTRACTION';
    const reviewStatus = batch.status === 'COMPLETED' ? '&reviewStatus=ALL' : '';
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

  return (
    <div className="analysis-list-page">
      <PageHeading
        eyebrow="AI ANALYSIS"
        title="분석 목록"
        description="함께 올린 회차의 진행·실패·설정 후보 검토 상태를 한곳에서 확인합니다."
      />

      {apiEnabled && analysisQuery.isPending && !hasPageData ? (
        <div className="analysis-list-state">
          <Loader2 size={18} className="spin" /> 분석 목록을 불러오는 중...
        </div>
      ) : apiEnabled && analysisQuery.isError && !hasPageData ? (
        <div className="analysis-list-state">
          <AlertCircle size={36} />
          <div>분석 목록을 불러오지 못했습니다.</div>
          <button type="button" className="analysis-card-action analysis-tone--danger" onClick={() => void analysisQuery.refetch()}>
            <RefreshCw size={12} /> 다시 불러오기
          </button>
        </div>
      ) : batches.length === 0 ? (
        <div className="analysis-list-state">
          <FileSearch size={38} strokeWidth={1.3} />
          <div>아직 요청한 분석이 없습니다.</div>
          <small>원고를 올리고 분석을 시작하면 업로드 묶음별로 표시됩니다.</small>
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
              <span>최신 분석 상태를 불러오지 못해 이전 목록을 표시합니다.</span>
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
            const status = batch.status ?? 'COMPLETED';
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
            const StatusIcon = view.icon;
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
            return (
              <article className="analysis-batch-card" key={batch.batchId}>
                <div className="analysis-batch-card__main">
                  <div className={`analysis-batch-card__icon analysis-tone--${view.tone}`}>
                    <StatusIcon size={19} />
                  </div>
                  <div className="analysis-batch-card__body">
                    <div className="analysis-batch-card__title-row">
                      <div className="analysis-batch-card__title">
                        {episodeRange(batch)}
                        <small>
                          {batch.episodeCount ?? 0}개 회차
                        </small>
                      </div>
                      <span className={`analysis-status analysis-tone--${view.tone}`}>
                        {view.label}
                      </span>
                    </div>
                    <div className="analysis-batch-card__description">
                      {view.description}
                    </div>
                    <div className="analysis-batch-card__groups">
                      {(batch.jobGroups ?? []).map(group => (
                        <span key={group.jobType} className="analysis-batch-card__group">
                          {jobTypeLabel(group.jobType)}
                          {' · '}
                          {group.succeededJobCount ?? 0}/{group.totalJobCount ?? 0} 완료
                          {(group.failedJobCount ?? 0) > 0 ? ` · ${group.failedJobCount} 실패` : ''}
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
                  </div>
                </div>

                <div className="analysis-card-footer">
                  <time>
                    최근 활동 {formatDateTime(batch.lastActivityAt ?? batch.lastRequestedAt)}
                  </time>
                  <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                    <button
                      type="button"
                      disabled={!actionEnabled}
                      onClick={() => {
                        if (opensReview) openReview(batch);
                        else if (actionGroup) openProgress(batch, actionGroup);
                      }}
                      className={`analysis-card-action analysis-tone--${opensReview ? 'primary' : view.tone}`}
                    >
                      {actionLabel(status, prioritizesTokenInterruption ? tokenInterruptedCount : 0)}
                    </button>
                  </div>
                </div>
              </article>
            );
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
    </div>
  );
}
