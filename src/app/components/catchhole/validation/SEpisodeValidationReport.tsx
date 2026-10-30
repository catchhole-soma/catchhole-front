import { useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useLocation, useNavigate, useSearchParams } from 'react-router';
import { ChevronLeft, Loader2, RefreshCw } from 'lucide-react';
import { getCurrentEpisodeValidationOptions } from '../../../api/generated/@tanstack/react-query.gen';
import type { ValidationReviewSummaryCounts } from '../../../api/generated/types.gen';
import { useEpisodeValidationReport } from '../../../hooks/useEpisodeValidationReport';
import { toApiError } from '../../../lib/api-errors';
import { returnToAnalysisList, type ReviewReturnState } from '../../../lib/review-navigation';
import { UserMenu } from '../UserMenu';
import { ReviewNotice } from '../review-ui/ReviewPrimitives';
import { ActionButton } from '../ui-v2/ActionButton';
import { FindingDetailView } from './ValidationFindingDetail';
import { FindingCounts, FindingEmptyState, FindingListPanel } from './ValidationFindingList';
import { ValidationHistoryPanel } from './ValidationHistoryPanel';
import { ReportBasisCard, ReportStatusCard } from './ValidationReportOverview';
import { ValidationRecheckPanel } from './ValidationRecheckPanel';
import { useValidationReportActions, type ReportActionArea } from './useValidationReportActions';
import { reportFixLinks, subjectLink } from './validation-return';
import {
  IMPACT_FILTER_OPTIONS,
  judgmentOptions,
  LOCK_REASON_COPY,
  outcomeOptions,
  SUBJECT_TYPE_FILTER_OPTIONS,
  type BranchFilter,
  type ImpactFilter,
  type JudgmentFilter,
  type SubjectTypeFilter,
} from './validation-report-labels';
import type { FindingFilterChange } from './ValidationFindingList';
import '../../../../styles/validation-report.css';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MOBILE_QUERY = '(max-width: 768px)';
const REPORT_PATH = '/episode-validation-report';
const SELECTION_KEYS = ['findingId', 'evidence'];
const FILTER_KEYS = ['branch', 'judgment', 'outcome', 'impact', 'subjectType', 'page', ...SELECTION_KEYS];
// 검사가 시작되지 않았거나 기준을 준비하지 못한 단계에는 집계·목록을 0건처럼 보여 주지 않는다.
const LIST_HIDDEN_STAGES = new Set(['PREPARING_BASELINE', 'HELD_INCOMPLETE', 'INVALIDATED']);

type ReportLinkState = ReviewReturnState & { latestReportUrl?: unknown };

function subscribeMobile(callback: () => void) {
  const media = window.matchMedia(MOBILE_QUERY);
  media.addEventListener('change', callback);
  return () => media.removeEventListener('change', callback);
}
const mobileSnapshot = () => window.matchMedia(MOBILE_QUERY).matches;

function analysisListUrl(workId: string) {
  return UUID.test(workId) ? `/dashboard?workId=${encodeURIComponent(workId)}&nav=analyses` : '/works';
}

function reportUrl(workId: string, reportId: string, extra = '') {
  return `${REPORT_PATH}?workId=${encodeURIComponent(workId)}&reportId=${encodeURIComponent(reportId)}${extra}`;
}

/** URL은 1-based page·명시적 ALL을 유지하고 API에는 0-based page와 실제 필터만 보낸다. 인용·본문은 넣지 않는다. */
function readFilters(params: URLSearchParams) {
  const rawBranch = params.get('branch');
  const branch: BranchFilter = rawBranch === 'SETTING' || rawBranch === 'TYPO' ? rawBranch : 'ALL';
  const rawJudgment = params.get('judgment');
  const judgment = (judgmentOptions(branch).find(option => option.value === rawJudgment)?.value ?? 'PENDING') as JudgmentFilter;
  const rawOutcome = params.get('outcome');
  const outcome = outcomeOptions(branch).find(option => option.value === rawOutcome)?.value ?? 'ALL';
  // 등급·대상은 설정 검사 항목에만 있으므로 오탈자 분류에서는 버린다.
  const rawImpact = params.get('impact');
  const impact: ImpactFilter = branch === 'TYPO' ? 'ALL' : IMPACT_FILTER_OPTIONS.find(option => option.value === rawImpact)?.value ?? 'ALL';
  const rawSubjectType = params.get('subjectType');
  const subjectType: SubjectTypeFilter = branch === 'TYPO' ? 'ALL'
    : SUBJECT_TYPE_FILTER_OPTIONS.find(option => option.value === rawSubjectType)?.value ?? 'ALL';
  const rawPage = Number.parseInt(params.get('page') ?? '1', 10);
  const page = Number.isFinite(rawPage) && rawPage > 0 ? rawPage : 1;
  const findingId = UUID.test(params.get('findingId') ?? '') ? params.get('findingId') : null;
  return {
    branch, judgment, outcome, impact, subjectType, page, findingId,
    evidence: findingId ? params.get('evidence') : null,
    historyOpen: params.get('history') === '1',
  };
}

function normalizedParams(params: URLSearchParams): URLSearchParams | null {
  const filters = readFilters(params);
  const next = new URLSearchParams(params);
  const expected: Record<string, string | null> = {
    branch: filters.branch === 'ALL' ? null : filters.branch,
    judgment: filters.judgment === 'PENDING' ? null : filters.judgment,
    outcome: filters.outcome === 'ALL' ? null : filters.outcome,
    impact: filters.impact === 'ALL' ? null : filters.impact,
    subjectType: filters.subjectType === 'ALL' ? null : filters.subjectType,
    page: filters.page === 1 ? null : String(filters.page),
    findingId: filters.findingId,
    evidence: filters.evidence,
    history: filters.historyOpen ? '1' : null,
  };
  let changed = false;
  for (const [key, value] of Object.entries(expected)) {
    if (params.get(key) === value) continue;
    changed = true;
    if (value === null) next.delete(key);
    else next.set(key, value);
  }
  return changed ? next : null;
}

function ReportShell({ workId, children }: { workId: string; children: ReactNode }) {
  const navigate = useNavigate();
  const location = useLocation();
  const back = () => returnToAnalysisList(navigate, location.state as ReviewReturnState | null, analysisListUrl(workId));
  return (
    <div className="setting-review-screen theme-v2 workspace-v2 validation-report-screen">
      <header className="review-header app-topbar">
        <button type="button" aria-label="분석 목록으로" className="review-header__back" onClick={back}>
          <ChevronLeft size={18} aria-hidden="true" />
        </button>
        <div className="review-header__title"><small>AI ANALYSIS</small><strong>오류 리포트</strong></div>
        <div className="review-header__spacer" />
        <UserMenu />
      </header>
      <main className="setting-review-main">
        <div className="setting-review-content vr-content">
          <div><button type="button" className="vr-link-button" onClick={back}>← 분석 목록</button></div>
          {children}
        </div>
      </main>
    </div>
  );
}

function StateCard({ title, description, action, busy = false }: { title: string; description?: string; action?: ReactNode; busy?: boolean }) {
  return (
    <section className="vr-card vr-empty" role="status" aria-busy={busy}>
      {busy && <Loader2 size={24} className="spin" aria-hidden="true" />}
      <strong>{title}</strong>
      {description && <span>{description}</span>}
      {action}
    </section>
  );
}

/** `최신 결과로 돌아가기`가 넘긴 이전 최신 결과 주소의 reportId. 같은 작품의 리포트 주소만 받는다. */
function savedReportId(saved: unknown, workId: string) {
  if (typeof saved !== 'string') return null;
  const url = new URL(saved, window.location.origin);
  return url.pathname === REPORT_PATH && url.searchParams.get('workId') === workId ? url.searchParams.get('reportId') : null;
}

/**
 * workId+episodeId 진입은 서버가 가리키는 현재 report로 주소를 바꾼다. 브라우저가 시각/번호로 추측하지 않는다.
 * 재검수로 현재 report가 바뀔 수 있으므로 이전 방문의 캐시로 이동하지 않고 이 mount에서 새로 받은 응답만 쓴다.
 */
function CurrentReportResolver({ workId, episodeId }: { workId: string; episodeId: string }) {
  const location = useLocation();
  const navigate = useNavigate();
  const [, setSearchParams] = useSearchParams();
  const query = useQuery({
    ...getCurrentEpisodeValidationOptions({ path: { workId }, query: { episodeId } }),
    retry: false, staleTime: 0, gcTime: 0, refetchOnMount: 'always',
  });
  const settled = query.isFetchedAfterMount && !query.isFetching;
  const resolved = settled && query.isSuccess ? query.data?.data?.reportId : undefined;
  useEffect(() => {
    if (!resolved) return;
    const linkState = location.state as ReportLinkState | null;
    const state = linkState ? { ...linkState, latestReportUrl: undefined } : linkState;
    // 보던 최신 결과가 여전히 현재 report면 그 주소(필터·선택)를 복원하고, 바뀌었으면 새 report를 연다.
    if (typeof linkState?.latestReportUrl === 'string' && savedReportId(linkState.latestReportUrl, workId) === resolved) {
      navigate(linkState.latestReportUrl, { replace: true, state });
      return;
    }
    setSearchParams(previous => {
      const next = new URLSearchParams(previous);
      next.set('reportId', resolved);
      next.delete('episodeId');
      return next;
    }, { replace: true, state });
  }, [location.state, navigate, resolved, setSearchParams, workId]);
  const missing = settled && query.isError && toApiError(query.error)?.status === 404;
  return (
    <ReportShell workId={workId}>
      {missing ? (
        <StateCard title="이 회차에는 아직 오류 검사 결과가 없어요."
          description="검수를 접수한 회차만 오류 리포트를 볼 수 있어요. 분석 목록에서 진행 상태를 확인해 주세요."
          action={<ActionButton onClick={() => navigate(analysisListUrl(workId))}>분석 목록으로</ActionButton>} />
      ) : settled && query.isError ? (
        <StateCard title="현재 검수 결과를 확인하지 못했어요." description="잠시 후 다시 시도해 주세요."
          action={<ActionButton variant="secondary" onClick={() => void query.refetch()}>다시 불러오기</ActionButton>} />
      ) : <StateCard busy title="현재 검수 결과를 찾고 있어요." />}
    </ReportShell>
  );
}

function pendingFor(counts: ValidationReviewSummaryCounts | undefined, branch: BranchFilter) {
  if (!counts) return null;
  const setting = { total: counts.settingTotal, pending: counts.settingPending, needsFix: counts.settingNeedsFix };
  const typo = { total: counts.typoTotal, pending: counts.typoPending, needsFix: counts.typoNeedsFix };
  if (branch === 'SETTING') return setting;
  if (branch === 'TYPO') return typo;
  if (setting.total == null || typo.total == null) return null;
  return { total: setting.total + typo.total, pending: (setting.pending ?? 0) + (typo.pending ?? 0), needsFix: (setting.needsFix ?? 0) + (typo.needsFix ?? 0) };
}

function ValidationReport({ workId, reportId }: { workId: string; reportId: string }) {
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const filters = readFilters(searchParams);
  const isMobile = useSyncExternalStore(subscribeMobile, mobileSnapshot, () => false);
  const [historyPage, setHistoryPage] = useState(0);
  const [mobileDetailOpen, setMobileDetailOpen] = useState(() => Boolean(filters.findingId));
  const detailHeadingRef = useRef<HTMLHeadingElement>(null);
  const listHeadingRef = useRef<HTMLHeadingElement>(null);
  const detailSectionRef = useRef<HTMLElement>(null);
  const focusTarget = useRef<'detail' | { row: string | null } | null>(null);

  const report = useEpisodeValidationReport({
    workId,
    reportId,
    filters: {
      branch: filters.branch === 'ALL' ? undefined : filters.branch,
      judgment: filters.judgment === 'ALL' ? undefined : filters.judgment,
      outcome: filters.outcome === 'ALL' ? undefined : filters.outcome,
      impact: filters.impact === 'ALL' ? undefined : filters.impact,
      subjectType: filters.subjectType === 'ALL' ? undefined : filters.subjectType,
      page: filters.page - 1,
    },
    findingId: filters.findingId,
    historyOpen: filters.historyOpen,
    historyPage,
  });
  const actions = useValidationReportActions({ workId, reportId, report });
  const { staging, summary, detail, findings } = report;
  const rows = findings?.content ?? [];
  const totalPages = findings?.totalPages ?? 0;
  const listReady = Boolean(findings) && !report.findingsQuery.isPlaceholderData;
  const stage = summary?.reviewStage ?? staging?.reviewStage;
  const pastReport = staging?.current === false;
  const showList = !report.invalidated && !pastReport && !(stage && LIST_HIDDEN_STAGES.has(stage));
  const detailMatchesUrl = Boolean(detail && detail.findingId === filters.findingId);

  const updateParams = (mutate: (next: URLSearchParams) => void) => setSearchParams(previous => {
    const next = new URLSearchParams(previous);
    mutate(next);
    return next;
  }, { replace: true, state: location.state });

  // 잘못된 필터·페이지는 허용 범위로 정규화한다.
  useEffect(() => {
    const next = normalizedParams(searchParams);
    if (next) setSearchParams(next, { replace: true, state: location.state });
  }, [location.state, searchParams, setSearchParams]);

  // 범위를 벗어난 페이지는 마지막 페이지로 옮긴다.
  const pageOverflow = listReady && filters.page > 1 && filters.page > totalPages;
  useEffect(() => {
    if (!pageOverflow) return;
    setSearchParams(previous => {
      const next = new URLSearchParams(previous);
      if (totalPages > 0) next.set('page', String(totalPages)); else next.delete('page');
      SELECTION_KEYS.forEach(key => next.delete(key));
      return next;
    }, { replace: true, state: location.state });
  }, [location.state, pageOverflow, setSearchParams, totalPages]);

  // 큰 화면은 선택이 없으면 서버 순서의 첫 항목을 연다. 작은 화면은 목록을 기본으로 연다.
  const firstId = rows[0]?.findingId;
  const autoSelectId = !isMobile && !filters.findingId && listReady && showList ? firstId : undefined;
  useEffect(() => {
    if (!autoSelectId) return;
    setSearchParams(previous => {
      const next = new URLSearchParams(previous);
      next.set('findingId', autoSelectId);
      return next;
    }, { replace: true, state: location.state });
  }, [autoSelectId, location.state, setSearchParams]);

  // 사용자가 연 상세는 제목으로, 목록 복귀는 원래 항목(없으면 목록 제목)으로 초점을 옮긴다. 자동 갱신은 초점을 건드리지 않는다.
  const listVisible = !(isMobile && mobileDetailOpen);
  useEffect(() => {
    const target = focusTarget.current;
    if (target === 'detail' && detailMatchesUrl) {
      focusTarget.current = null;
      detailHeadingRef.current?.focus({ preventScroll: true });
      // 작은 화면은 목록 대신 상세를 보여 주므로 상세 시작으로, 큰 화면은 필요한 만큼만 이동한다.
      detailSectionRef.current?.scrollIntoView?.({ block: isMobile ? 'start' : 'nearest' });
    } else if (target && typeof target === 'object' && listVisible && listReady) {
      focusTarget.current = null;
      const row = target.row ? document.querySelector<HTMLElement>(`[data-finding-id="${CSS.escape(target.row)}"]`) : null;
      (row ?? listHeadingRef.current)?.focus();
    }
  }, [detailMatchesUrl, isMobile, listReady, listVisible, filters.findingId]);

  const selectFinding = (findingId: string) => {
    focusTarget.current = 'detail';
    setMobileDetailOpen(true);
    actions.clearJudgmentNotice();
    updateParams(next => { next.set('findingId', findingId); next.delete('evidence'); });
  };
  const backToList = () => {
    focusTarget.current = { row: filters.findingId };
    setMobileDetailOpen(false);
    updateParams(next => SELECTION_KEYS.forEach(key => next.delete(key)));
  };
  const changeFilters = (change: FindingFilterChange) => {
    setMobileDetailOpen(false);
    actions.clearJudgmentNotice();
    updateParams(next => {
      const branch = change.branch ?? filters.branch;
      const judgment = change.judgment ?? filters.judgment;
      const outcome = change.outcome ?? filters.outcome;
      const impact = change.impact ?? filters.impact;
      const subjectType = change.subjectType ?? filters.subjectType;
      if (branch === 'ALL') next.delete('branch'); else next.set('branch', branch);
      if (judgment === 'PENDING' || !judgmentOptions(branch).some(option => option.value === judgment)) next.delete('judgment');
      else next.set('judgment', judgment);
      if (outcome === 'ALL' || !outcomeOptions(branch).some(option => option.value === outcome)) next.delete('outcome');
      else next.set('outcome', outcome);
      if (impact === 'ALL' || branch === 'TYPO') next.delete('impact'); else next.set('impact', impact);
      if (subjectType === 'ALL' || branch === 'TYPO') next.delete('subjectType'); else next.set('subjectType', subjectType);
      // 필터를 바꾸면 첫 페이지로 돌아간다. 건수는 서버의 totalElements만 쓴다.
      next.delete('page');
      SELECTION_KEYS.forEach(key => next.delete(key));
    });
  };
  const resetFilters = () => {
    setMobileDetailOpen(false);
    updateParams(next => FILTER_KEYS.forEach(key => next.delete(key)));
  };
  const changePage = (page: number) => {
    setMobileDetailOpen(false);
    updateParams(next => { next.set('page', String(page + 1)); SELECTION_KEYS.forEach(key => next.delete(key)); });
  };
  const toggleHistory = () => updateParams(next => {
    if (filters.historyOpen) next.delete('history'); else next.set('history', '1');
  });

  const summaryStale = report.summaryQuery.isError;
  const writesLocked = !summary || summaryStale || report.invalidated || pastReport;
  const canJudge = Boolean(!writesLocked && !summary?.judgmentLocked && summary?.allowedActions?.includes('SAVE_JUDGMENT')
    && detailMatchesUrl && !detail?.stale);
  const lockMessage = summary?.judgmentLocked && summary.lockReason ? LOCK_REASON_COPY[summary.lockReason]
    : summaryStale ? '최신 상태를 확인하지 못해 판단 저장을 잠갔어요. 잠시 후 다시 확인해 주세요.'
      : !summary ? '판단할 수 있는지 확인하고 있어요.' : null;

  const actionMessage = (area: ReportActionArea) => actions.actionNotice?.area === area
    ? <ReviewNotice tone={actions.actionNotice.tone} title={actions.actionNotice.text} /> : null;

  const episodeLabel = report.episode?.episodeNo != null ? `${report.episode.episodeNo}화` : '회차';
  const subtitle = [report.work?.title, report.episode?.title].filter(Boolean).join(' · ') || '작품 정보 확인 중';
  const holdTypes = new Set((summary?.application?.holdReasons ?? []).map(reason => reason.candidateType));
  const candidateReviewUrl = staging?.batchId
    ? `/setting-review?workId=${encodeURIComponent(workId)}&batchId=${encodeURIComponent(staging.batchId)}${holdTypes.size === 1 && holdTypes.has('WORLD_SETTING') ? '&candidateType=world' : ''}`
    : undefined;
  const sourceLink = !report.invalidated && !pastReport && staging?.episodeId
    ? `/editor?workId=${encodeURIComponent(workId)}&episodeId=${encodeURIComponent(staging.episodeId)}` : undefined;
  // 리포트끼리 이동하면 history가 늘어나므로 분석 목록 복귀의 상대 이동(returnHistoryDelta)은 버리고 저장한 목록 주소만 넘긴다.
  const linkState = { ...(location.state as ReportLinkState | null), returnHistoryDelta: undefined };
  // 보던 주소도 그 사이 재검수로 퇴역했을 수 있어 회차의 현재 report를 새로 확인한다. 같으면 보던 필터·선택을 복원한다.
  const backToLatest = () => {
    const saved = typeof linkState.latestReportUrl === 'string' ? linkState.latestReportUrl : null;
    if (staging?.episodeId) navigate(`${REPORT_PATH}?workId=${encodeURIComponent(workId)}&episodeId=${encodeURIComponent(staging.episodeId)}`, { state: { ...linkState, latestReportUrl: saved ?? undefined } });
    else if (saved) navigate(saved, { state: { ...linkState, latestReportUrl: undefined } });
  };

  if (report.stagingQuery.isError && !staging) {
    const notFound = toApiError(report.stagingQuery.error)?.status === 404;
    return (
      <ReportShell workId={workId}>
        <StateCard title={notFound ? '오류 리포트를 찾을 수 없어요.' : '오류 리포트를 불러오지 못했어요.'}
          description={notFound ? '다른 작품의 결과이거나 볼 수 없는 결과예요. 분석 목록에서 다시 들어와 주세요.' : '잠시 후 다시 시도해 주세요.'}
          action={notFound
            ? <ActionButton onClick={() => navigate(analysisListUrl(workId))}>분석 목록으로</ActionButton>
            : <ActionButton variant="secondary" icon={<RefreshCw size={14} aria-hidden="true" />} onClick={() => void report.stagingQuery.refetch()}>다시 불러오기</ActionButton>} />
      </ReportShell>
    );
  }
  if (!staging) {
    return <ReportShell workId={workId}><StateCard busy title="오류 리포트를 불러오고 있어요." /></ReportShell>;
  }

  const execution = summary?.executionStatus ?? staging.executionStatus;
  const emptyState = listReady ? (
    <FindingEmptyState scope={pendingFor(summary?.counts, filters.branch)} execution={execution}
      defaultView={filters.judgment === 'PENDING' && filters.outcome === 'ALL' && filters.impact === 'ALL' && filters.subjectType === 'ALL'}
      onShowAll={() => changeFilters({ judgment: 'ALL' })} onReset={resetFilters} />
  ) : null;

  const selectedInList = rows.some(row => row.findingId === filters.findingId);
  const detailImpact = (detail?.payload as Record<string, unknown> | undefined)?.impact;
  const matchesFilter = detail && (filters.branch === 'ALL' || detail.branch === filters.branch)
    && (filters.judgment === 'ALL' || (detail.judgment?.value ?? 'PENDING') === filters.judgment)
    && (filters.outcome === 'ALL' || detail.outcome === filters.outcome)
    && (filters.impact === 'ALL' || (detail.branch === 'SETTING' && detailImpact === filters.impact))
    && (filters.subjectType === 'ALL' || (detail.branch === 'SETTING' && detail.subject?.type === filters.subjectType));
  const outsideNotice = detailMatchesUrl && listReady && !selectedInList ? (
    <ReviewNotice tone="info" title={matchesFilter ? '이 항목은 현재 페이지 목록에 없어요.' : '이 항목은 현재 필터에서 제외됐어요.'}
      action={firstId ? <ActionButton variant="secondary" size="compact" onClick={() => selectFinding(firstId)}>다음 항목</ActionButton> : undefined} />
  ) : null;
  const detailError = report.detailQuery.isError && !detailMatchesUrl;
  const detailMissing = detailError && toApiError(report.detailQuery.error)?.status === 404;

  return (
    <ReportShell workId={workId}>
      <div className="vr-sr-only" role="status" aria-live="polite">{actions.announcement}</div>
      <ReportStatusCard
        staging={staging}
        summary={summary}
        title={`${episodeLabel} 오류 리포트`}
        subtitle={subtitle}
        historyOpen={filters.historyOpen || pastReport}
        onToggleHistory={toggleHistory}
        onComplete={() => actions.requestAction('completion')}
        completing={report.completion.isPending}
        onApply={() => actions.requestAction('application')}
        applying={report.application.isPending}
        candidateReviewUrl={candidateReviewUrl}
        message={<>{actionMessage('completion')}{actionMessage('application')}</>}
      >
        {summaryStale && (
          <ReviewNotice tone="warning" title="최신 상태를 확인하지 못했어요. 마지막으로 확인한 내용을 보여 주고 있어요."
            action={<ActionButton variant="secondary" size="compact" onClick={() => void report.refreshReport()}>다시 불러오기</ActionButton>} />
        )}
        {pastReport && (
          <div className="vr-actions">
            <ActionButton onClick={backToLatest}>최신 결과로 돌아가기</ActionButton>
          </div>
        )}
        <ValidationRecheckPanel workId={workId} reportId={reportId} report={report} onRetry={() => actions.requestAction('retry')} />
      </ReportStatusCard>

      {!pastReport && (
        <ReportBasisCard staging={staging} summary={summary} results={report.results}
          resultsUnavailable={report.resultsQuery.isError && !report.results}
          onReloadResults={() => void report.resultsQuery.refetch()}
          onRetry={() => actions.requestAction('retry')} retrying={report.retry.isPending} message={actionMessage('retry')} />
      )}

      {(filters.historyOpen || pastReport) && (
        <ValidationHistoryPanel
          history={report.history}
          loading={report.historyQuery.isPending}
          error={report.historyQuery.isError}
          onRetry={() => void report.historyQuery.refetch()}
          viewingReportId={reportId}
          reportUrl={targetId => reportUrl(workId, targetId, '&history=1')}
          linkState={{ ...linkState, latestReportUrl: pastReport ? linkState.latestReportUrl : `${location.pathname}${location.search}` }}
          page={historyPage}
          onPageChange={setHistoryPage}
        />
      )}

      {showList && (
        <>
          <FindingCounts counts={summary?.counts} unavailable={report.summaryQuery.isError && !summary} />
          <div className={`vr-layout${isMobile && mobileDetailOpen && filters.findingId ? ' is-detail-open' : ''}`}>
            <FindingListPanel
              findings={rows}
              totalElements={listReady ? findings?.totalElements : undefined}
              loading={report.findingsQuery.isPending || report.findingsQuery.isPlaceholderData}
              error={report.findingsQuery.isError ? (
                <ReviewNotice tone="warning" title={findings ? '최신 목록을 불러오지 못해 마지막으로 확인한 목록을 보여 주고 있어요.' : '항목을 불러오지 못했어요.'}
                  action={<ActionButton variant="secondary" size="compact" onClick={() => void report.findingsQuery.refetch()}>다시 불러오기</ActionButton>} />
              ) : null}
              selectedId={filters.findingId}
              onSelect={selectFinding}
              branch={filters.branch}
              judgment={filters.judgment}
              outcome={filters.outcome}
              impact={filters.impact}
              subjectType={filters.subjectType}
              onFilterChange={changeFilters}
              page={Math.min(filters.page - 1, Math.max(totalPages - 1, 0))}
              totalPages={totalPages}
              onPageChange={changePage}
              emptyState={emptyState}
              headingRef={listHeadingRef}
            />
            <section ref={detailSectionRef} className="vr-detail" aria-label="선택한 항목">
              <button type="button" className="setting-review-mobile-back" onClick={backToList}>
                <ChevronLeft size={15} aria-hidden="true" /> 목록으로
              </button>
              {detailMatchesUrl && detail ? (
                <FindingDetailView
                  detail={detail}
                  headingRef={detailHeadingRef}
                  canJudge={canJudge}
                  lockMessage={detail.stale ? null : lockMessage}
                  saving={report.saveJudgment.isPending}
                  judgmentNotice={report.saveJudgment.isPending
                    ? <ReviewNotice tone="info" title="판단을 저장하고 있어요." />
                    : actions.judgmentNotice ? <ReviewNotice tone={actions.judgmentNotice.tone} title={actions.judgmentNotice.text} /> : null}
                  onSaveJudgment={judgment => { if (canJudge) actions.saveJudgment(detail, judgment); }}
                  selectedEvidence={filters.evidence}
                  onSelectEvidence={key => updateParams(next => { if (key) next.set('evidence', key); else next.delete('evidence'); })}
                  sourceLink={sourceLink} topNotice={outsideNotice}
                  fixLinks={reportFixLinks(workId, reportId, report.invalidated || pastReport ? undefined : staging?.episodeId, searchParams)}
                  subject={subjectLink(workId, reportId, detail, searchParams)}
                />
              ) : detailMissing ? (
                <StateCard title="이 항목을 찾을 수 없어요." description="다시 검사되었거나 이 결과에 없는 항목이에요."
                  action={<ActionButton variant="secondary" onClick={backToList}>목록으로</ActionButton>} />
              ) : detailError ? (
                <StateCard title="항목을 불러오지 못했어요." description="목록과 다른 항목은 그대로 볼 수 있어요."
                  action={<ActionButton variant="secondary" onClick={() => void report.detailQuery.refetch()}>다시 불러오기</ActionButton>} />
              ) : filters.findingId ? (
                <StateCard busy title="항목을 불러오고 있어요." />
              ) : (
                <StateCard title={rows.length ? '목록에서 항목을 선택해 주세요.' : '표시할 항목이 없어요.'} />
              )}
            </section>
          </div>
        </>
      )}
    </ReportShell>
  );
}

export default function SEpisodeValidationReport() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const workId = searchParams.get('workId') ?? '';
  const reportId = searchParams.get('reportId') ?? '';
  const episodeId = searchParams.get('episodeId') ?? '';
  if (!UUID.test(workId) || (!UUID.test(reportId) && !UUID.test(episodeId))) {
    return (
      <ReportShell workId={workId}>
        <StateCard title="오류 리포트 정보를 찾을 수 없어요." description="작품과 검수 결과 정보가 필요해요. 분석 목록에서 다시 들어와 주세요."
          action={<ActionButton onClick={() => navigate(analysisListUrl(workId))}>분석 목록으로</ActionButton>} />
      </ReportShell>
    );
  }
  if (!UUID.test(reportId)) return <CurrentReportResolver workId={workId} episodeId={episodeId} />;
  return <ValidationReport key={`${workId}:${reportId}`} workId={workId} reportId={reportId} />;
}
