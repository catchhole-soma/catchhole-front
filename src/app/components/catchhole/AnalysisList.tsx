import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'react-router';
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
import { C } from './constants';
import { PageNavigation } from './PageNavigation';

const PAGE_SIZE = 10;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type AnalysisBatchStatus = NonNullable<AnalysisBatchSummaryResponse['status']>;

const STATUS_VIEW: Record<AnalysisBatchStatus, {
  label: string;
  description: string;
  color: string;
  icon: typeof Clock3;
}> = {
  IN_PROGRESS: {
    label: '분석 중',
    description: '회차별 분석이 진행되고 있습니다.',
    color: C.primary,
    icon: Clock3,
  },
  PARTIALLY_FAILED: {
    label: '일부 실패',
    description: '완료된 회차는 유지되며 실패 회차만 다시 시도할 수 있습니다.',
    color: C.warning,
    icon: TriangleAlert,
  },
  FAILED: {
    label: '분석 실패',
    description: '실패 원인을 확인하고 회차 분석을 다시 시도할 수 있습니다.',
    color: C.danger,
    icon: AlertCircle,
  },
  REVIEW_REQUIRED: {
    label: '후보 검토 필요',
    description: '분석이 끝났으며 추출된 설정 후보를 검토할 차례입니다.',
    color: C.warning,
    icon: FileSearch,
  },
  COMPLETED: {
    label: '분석 완료',
    description: '분석과 설정 후보 검토가 모두 끝났습니다.',
    color: C.success,
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

function actionLabel(group: AnalysisBatchJobGroupResponse): string {
  if (group.status === 'IN_PROGRESS') return '진행 보기';
  if (group.status === 'FAILED' || group.status === 'PARTIALLY_FAILED') return '실패 확인';
  return '결과 보기';
}

export function AnalysisList({ workId }: { workId: string }) {
  const navigate = useAppNavigate();
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
  const batches = pageData?.content ?? [];
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
    );
  };

  const openReview = (batch: AnalysisBatchSummaryResponse) => {
    if (!batch.batchId) return;
    const jobType = batch.jobGroups?.find(group => group.jobType === 'SETTING_EXTRACTION')?.jobType
      ?? batch.jobGroups?.[0]?.jobType
      ?? 'SETTING_EXTRACTION';
    navigate(
      `/setting-review?workId=${encodeURIComponent(workId)}`
      + `&batchId=${encodeURIComponent(batch.batchId)}`
      + `&jobType=${jobType}`,
      'push-right',
    );
  };

  return (
    <div style={{ flex: 1, padding: '32px 40px', overflowY: 'auto' }}>
      <div style={{ marginBottom: 24 }}>
        <div style={{ color: C.t3, fontSize: 12, marginBottom: 4 }}>업로드 묶음별 분석 현황</div>
        <div style={{ color: C.t1, fontSize: 20, fontWeight: 700, letterSpacing: '-0.5px' }}>
          분석 목록
        </div>
        <div style={{ color: C.t3, fontSize: 12, marginTop: 6 }}>
          함께 올린 회차의 진행·실패·설정 후보 검토 상태를 한곳에서 확인합니다.
        </div>
      </div>

      {apiEnabled && analysisQuery.isPending && !hasPageData ? (
        <div style={{
          height: 280,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
          color: C.t3,
        }}>
          <Loader2 size={18} className="spin" /> 분석 목록을 불러오는 중...
        </div>
      ) : apiEnabled && analysisQuery.isError && !hasPageData ? (
        <div style={{
          height: 280,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 12,
          color: C.t3,
        }}>
          <AlertCircle size={36} color={C.danger} />
          <div style={{ color: C.t2, fontSize: 14 }}>분석 목록을 불러오지 못했습니다.</div>
          <button type="button" onClick={() => void analysisQuery.refetch()} style={{
            height: 34,
            padding: '0 14px',
            borderRadius: 6,
            border: `1px solid ${C.border}`,
            background: 'transparent',
            color: C.t2,
            cursor: 'pointer',
            fontFamily: 'inherit',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
          }}>
            <RefreshCw size={12} /> 다시 불러오기
          </button>
        </div>
      ) : batches.length === 0 ? (
        <div style={{
          height: 280,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 10,
          color: C.t3,
        }}>
          <FileSearch size={38} strokeWidth={1.3} />
          <div style={{ color: C.t2, fontSize: 14 }}>아직 요청한 분석이 없습니다.</div>
          <div style={{ fontSize: 12 }}>원고를 올리고 분석을 시작하면 업로드 묶음별로 표시됩니다.</div>
        </div>
      ) : (
        <div style={{ maxWidth: 1120, display: 'flex', flexDirection: 'column', gap: 12 }}>
          {analysisQuery.isError && hasPageData && (
            <div role="alert" style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 12,
              padding: '10px 12px',
              borderRadius: 7,
              border: `1px solid ${C.danger}44`,
              background: `${C.danger}0D`,
              color: C.t2,
              fontSize: 12,
            }}>
              <span>최신 분석 상태를 불러오지 못해 이전 목록을 표시합니다.</span>
              <button type="button" onClick={() => void analysisQuery.refetch()} style={{
                border: 0,
                background: 'transparent',
                color: C.danger,
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
            const view = STATUS_VIEW[status];
            const StatusIcon = view.icon;
            const pendingCount = batch.pendingCandidateCount ?? 0;
            const reviewedCount = batch.reviewedCandidateCount ?? 0;
            const totalCount = batch.totalCandidateCount ?? 0;
            return (
              <article key={batch.batchId} style={{
                padding: '18px 20px',
                borderRadius: 10,
                border: `1px solid ${C.border}`,
                background: C.surface,
              }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
                  <div style={{
                    width: 38,
                    height: 38,
                    flexShrink: 0,
                    borderRadius: 8,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: view.color,
                    background: `${view.color}16`,
                    border: `1px solid ${view.color}33`,
                  }}>
                    <StatusIcon size={19} />
                  </div>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: 16,
                      marginBottom: 7,
                    }}>
                      <div style={{ color: C.t1, fontSize: 15, fontWeight: 700 }}>
                        {episodeRange(batch)}
                        <span style={{ color: C.t3, fontSize: 12, fontWeight: 400, marginLeft: 8 }}>
                          {batch.episodeCount ?? 0}개 회차
                        </span>
                      </div>
                      <span style={{
                        flexShrink: 0,
                        color: view.color,
                        background: `${view.color}14`,
                        border: `1px solid ${view.color}3D`,
                        borderRadius: 12,
                        padding: '3px 9px',
                        fontSize: 11,
                        fontWeight: 700,
                      }}>
                        {view.label}
                      </span>
                    </div>
                    <div style={{ color: C.t3, fontSize: 12, marginBottom: 12 }}>
                      {view.description}
                    </div>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
                      {(batch.jobGroups ?? []).map(group => (
                        <span key={group.jobType} style={{
                          padding: '4px 9px',
                          borderRadius: 5,
                          background: C.bg,
                          border: `1px solid ${C.border}`,
                          color: C.t2,
                          fontSize: 11,
                        }}>
                          {jobTypeLabel(group.jobType)}
                          {' · '}
                          {group.succeededJobCount ?? 0}/{group.totalJobCount ?? 0} 완료
                          {(group.failedJobCount ?? 0) > 0 ? ` · ${group.failedJobCount} 실패` : ''}
                        </span>
                      ))}
                    </div>
                    {totalCount > 0 && (
                      <div style={{ color: C.t2, fontSize: 12 }}>
                        설정 후보 {reviewedCount}/{totalCount}개 검토 완료
                        {pendingCount > 0 && (
                          <span style={{ color: C.warning, marginLeft: 8 }}>
                            {pendingCount}개 대기
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 12,
                  paddingTop: 14,
                  marginTop: 14,
                  borderTop: `1px solid ${C.border}`,
                }}>
                  <span style={{ color: C.t3, fontSize: 11 }}>
                    최근 활동 {formatDateTime(batch.lastActivityAt ?? batch.lastRequestedAt)}
                  </span>
                  <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                    {status === 'REVIEW_REQUIRED' && (
                      <button type="button" onClick={() => openReview(batch)} style={{
                        height: 34,
                        padding: '0 14px',
                        borderRadius: 6,
                        border: `1px solid ${C.primary}`,
                        background: `${C.primary}18`,
                        color: C.primary,
                        fontFamily: 'inherit',
                        fontSize: 12,
                        fontWeight: 700,
                        cursor: 'pointer',
                      }}>
                        설정 후보 검토
                      </button>
                    )}
                    {(batch.jobGroups ?? []).map(group => (
                      <button
                        key={`${group.jobType}-action`}
                        type="button"
                        disabled={(group.currentAnalysisJobIds?.length ?? 0) === 0}
                        onClick={() => openProgress(batch, group)}
                        style={{
                          height: 34,
                          padding: '0 14px',
                          borderRadius: 6,
                          border: `1px solid ${C.border}`,
                          background: 'transparent',
                          color: C.t2,
                          fontFamily: 'inherit',
                          fontSize: 12,
                          cursor: (group.currentAnalysisJobIds?.length ?? 0) > 0 ? 'pointer' : 'default',
                          opacity: (group.currentAnalysisJobIds?.length ?? 0) > 0 ? 1 : 0.45,
                        }}
                      >
                        {(batch.jobGroups?.length ?? 0) > 1 ? `${jobTypeLabel(group.jobType)} ` : ''}
                        {actionLabel(group)}
                      </button>
                    ))}
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
