import { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useSearchParams } from 'react-router';
import { AlertCircle, CheckCircle2, Clock3, FileSearch, Loader2, TriangleAlert } from 'lucide-react';
import { analyzeSettingBookMutation, getAnalysisJobOptions, getSettingBookOptions, getSettingBooksQueryKey,
  getSettingCandidatesOptions, getWorldSettingCandidatesOptions } from '../../api/generated/@tanstack/react-query.gen';
import type { AnalysisJobResponse, SettingBookResponse, SettingBookSummaryResponse } from '../../api/generated/types.gen';
import { toApiError } from '../../lib/api-errors';
import { notifyAiTokenQuotaExhausted } from '../../lib/ai-token-quota';
import { analysisSourceLabel, analysisSourceReaderUrl, bookWorkspaceUrl, invalidateAppliedSettings } from '../../lib/analysis-source';
import { canResumeOrderedAnalysis, isCompletedOrderedAnalysis, isInvalidatedAnalysis } from '../../lib/ordered-analysis';
import { combinedSettingReviewProgress } from '../../lib/setting-review-progress';
import { ActionButton } from './ui-v2/ActionButton';
import { AnalysisCard, CandidateReviewCount, type AnalysisTone } from './AnalysisCard';
import { AnalysisProgressCard, AnalysisProgressHero, UploadHeader, UploadStepper } from './UploadLayout';

const PHASES: Record<string, string> = { CHUNKING: '원문 분할', SETTING_EXTRACTION: '인물 설정 추출',
  CHARACTER_FACT_COMPARISON: '인물 설정 비교', WORLD_SETTING_EXTRACTION: '세계관 설정 추출',
  WORLD_SETTING_COMPARISON: '세계관 설정 비교', SETTING_REVIEW: '설정 반영' };
const FAILURE_REASONS: Record<NonNullable<AnalysisJobResponse['failureCode']>, string> = {
  AI_TOKEN_QUOTA_EXHAUSTED: '사용량 부족으로 중단됐습니다.',
  LLM_OUTPUT_TRUNCATED: '분석 응답이 끝까지 도착하지 않아 중단됐습니다.',
  LLM_NETWORK_ERROR: '분석 서비스와 연결하지 못해 중단됐습니다.',
  LLM_PROVIDER_ERROR: '분석 서비스에 문제가 생겨 중단됐습니다.',
  LLM_RESPONSE_PARSE_ERROR: '분석 응답을 읽지 못해 중단됐습니다.',
  COMPARISON_VALIDATION_FAILED: '비교 결과를 확인하지 못해 중단됐습니다.',
  WORKER_LEASE_EXPIRED: '분석을 처리하던 작업이 종료됐습니다.',
  UNEXPECTED_ERROR: '분석 중 문제가 발생했습니다.',
};

type BookAnalysisProps = {
  workId: string; book?: SettingBookSummaryResponse | SettingBookResponse; analysisJobId?: string; batchId?: string;
  unsaved?: boolean; busy?: boolean; onCreated?: (job: AnalysisJobResponse) => void;
};

function useSettingBookAnalysis({ workId, book: suppliedBook, analysisJobId, batchId, unsaved = false, busy = false, onCreated }: BookAnalysisProps) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const id = analysisJobId ?? suppliedBook?.latestAnalysisJob?.id;
  const query = useQuery({ ...getAnalysisJobOptions({ path: { workId, analysisJobId: id ?? '' } }),
    enabled: Boolean(workId && id), retry: false, refetchInterval: query => {
      const job = query.state.data?.data;
      return job && (isCompletedOrderedAnalysis(job) || canResumeOrderedAnalysis(job, [])
        || isInvalidatedAnalysis(job) || job.status === 'CANCELED' || job.status === 'FAILED') ? false : 3000;
    } });
  const job = query.data?.data ?? suppliedBook?.latestAnalysisJob;
  const bookJob = job?.source?.sourceKind === 'SETTING_BOOK' ? job : undefined;
  const bookId = bookJob?.source?.settingBookId;
  const bookQuery = useQuery({ ...getSettingBookOptions({ path: { workId, settingBookId: bookId ?? '' } }),
    enabled: Boolean(bookId && !suppliedBook), retry: false });
  const book = suppliedBook ?? bookQuery.data?.data;
  const bookFailed = !suppliedBook && bookQuery.isError;
  const retrySource = () => Promise.all([query.refetch(), ...(bookId && !suppliedBook ? [bookQuery.refetch()] : [])]);
  const complete = Boolean(bookJob && isCompletedOrderedAnalysis(bookJob));
  const invalidated = Boolean(bookJob && isInvalidatedAnalysis(bookJob));
  const interrupted = Boolean(bookJob && canResumeOrderedAnalysis(bookJob, []));
  const active = Boolean(bookJob && !complete && !invalidated && !interrupted
    && (bookJob.status === 'PENDING' || bookJob.status === 'RUNNING' || bookJob.status === 'SUCCEEDED'));
  const changed = book?.contentChangedSinceAnalysis === true;
  const historical = Boolean(analysisJobId && book && (
    book.latestAnalysisJob?.id && book.latestAnalysisJob.id !== analysisJobId
    || book.revisionId && bookJob?.source?.revisionId && book.revisionId !== bookJob.source.revisionId));
  const sourceReady = Boolean(bookJob && !query.isError);
  const candidateQuery = { batchId: bookJob?.batchId ?? batchId ?? '', sourceAnalysisJobId: id,
    page: 0, size: 1, includeLegacyCandidates: false };
  const characterOptions = getSettingCandidatesOptions({ path: { workId }, query: candidateQuery });
  const worldOptions = getWorldSettingCandidatesOptions({ path: { workId }, query: candidateQuery });
  // Completion starts a fresh cache entry before effects run, including when an in-flight progress read returns late.
  const characterKey = { ...characterOptions.queryKey[0], _settingBookCompleted: complete };
  const worldKey = { ...worldOptions.queryKey[0], _settingBookCompleted: complete };
  const characterQuery = useQuery({ ...characterOptions,
    queryKey: [characterKey],
    enabled: sourceReady && Boolean(candidateQuery.batchId && id), retry: false,
    refetchInterval: active ? 3000 : false });
  const worldQuery = useQuery({ ...worldOptions,
    queryKey: [worldKey],
    enabled: sourceReady && Boolean(candidateQuery.batchId && id), retry: false,
    refetchInterval: active ? 3000 : false });
  const character = characterQuery.data?.data;
  const world = worldQuery.data?.data;
  const progress = combinedSettingReviewProgress(character, world);
  const countsReady = characterQuery.isSuccess && worldQuery.isSuccess
    && progress.directReview != null && progress.processing != null;
  const remaining = countsReady ? progress.directReview! + progress.processing! : null;
  const [error, setError] = useState<string | null>(null);
  const appliedId = useRef<string | null>(null);
  const quotaId = useRef<string | null>(null);
  const analyze = useMutation(analyzeSettingBookMutation());
  useEffect(() => {
    if (!complete || !bookJob?.id || appliedId.current === bookJob.id) return;
    appliedId.current = bookJob.id;
    void invalidateAppliedSettings(queryClient, workId);
  }, [complete, bookJob?.id, queryClient, workId]);
  useEffect(() => {
    if (!interrupted || bookJob?.failureCode !== 'AI_TOKEN_QUOTA_EXHAUSTED' || quotaId.current === bookJob.id) return;
    quotaId.current = bookJob.id ?? null;
    notifyAiTokenQuotaExhausted({ kind: 'analysis-failed', sourceKind: 'SETTING_BOOK' });
  }, [interrupted, bookJob?.id, bookJob?.failureCode]);
  const startDisabled = !book || bookFailed || unsaved || busy || active || historical || analyze.isPending
    || Boolean(id && (query.isPending || query.isError || !sourceReady));
  const start = async () => {
    if (startDisabled || !book) return;
    setError(null);
    try {
      const response = await analyze.mutateAsync({ path: { workId, settingBookId: book.id } });
      if (!response.data?.id) throw new Error('분석 시작을 확인하지 못했습니다.');
      queryClient.setQueryData(getAnalysisJobOptions({ path: { workId, analysisJobId: response.data.id } }).queryKey, response);
      onCreated?.(response.data);
      await Promise.all([queryClient.invalidateQueries({ queryKey: getSettingBooksQueryKey({ path: { workId } }) }),
        queryClient.invalidateQueries({ queryKey: getSettingBookOptions({ path: { workId, settingBookId: book.id } }).queryKey })]);
    } catch (failure) {
      setError(toApiError(failure)?.message ?? '분석을 시작하지 못했습니다. 원문과 분석 상태를 확인한 뒤 다시 시도해 주세요.');
      await Promise.all([query.refetch(),
        queryClient.invalidateQueries({ queryKey: getSettingBooksQueryKey({ path: { workId } }) }),
        queryClient.invalidateQueries({ queryKey: getSettingBookOptions({ path: { workId, settingBookId: book.id } }).queryKey })]);
    }
  };
  const status = !id ? '아직 분석하지 않은 설정집' : query.isError ? '분석 상태 확인 필요'
    : !bookJob ? '분석 출처 확인 중' : invalidated ? '원문 변경으로 중단된 분석'
      : complete ? '분석·자동 반영 완료' : interrupted || bookJob.status === 'FAILED' ? '분석 중단'
        : bookJob.status === 'CANCELED' ? '분석 취소' : bookJob.status === 'PENDING' ? '분석 대기' : '분석 중';
  const failureReason = bookJob?.failureCode ? FAILURE_REASONS[bookJob.failureCode] : null;
  const description = complete ? remaining == null ? '설정집 분석과 자동 반영이 끝났습니다. 검토 상태를 확인하고 있습니다.'
    : remaining > 0 ? `설정집 분석과 자동 반영이 끝났습니다. 확인이 필요한 ${remaining}개 설정을 검토해 주세요.`
      : '설정집 분석과 설정 정리가 모두 끝났습니다. 작품 설정에서 확인할 수 있습니다.'
    : interrupted ? bookJob?.failureCode === 'AI_TOKEN_QUOTA_EXHAUSTED'
      ? '사용량 부족으로 중단됐습니다. 추가 사용량을 받은 뒤 이어서 분석할 수 있습니다.'
      : `${failureReason ?? '분석이 중단되었습니다.'} 완료된 단계는 유지되며 이어서 분석할 수 있습니다.`
    : invalidated ? '원문이나 설정이 변경되었습니다. 설정집에서 최신 원문을 확인해 주세요.'
    : bookJob?.status === 'FAILED' ? `${failureReason ?? '분석 중 문제가 발생했습니다.'} 설정집에서 재개 여부를 확인해 주세요.`
    : bookJob?.status === 'CANCELED' ? '이 분석을 이어갈 수 없습니다. 설정집의 현재 상태를 확인해 주세요.'
    : !id ? '설정집에서 인물과 세계관 설정을 함께 추출합니다.'
    : query.isError ? '분석 상태를 불러오지 못했습니다. 다시 확인해 주세요.'
    : !bookJob ? '설정집 분석의 출처를 확인하고 있습니다.'
    : bookJob.status === 'PENDING' ? '순서가 되면 인물과 세계관을 함께 분석합니다.'
      : `${PHASES[bookJob.currentStep ?? ''] ?? '인물·세계관 설정 추출과 비교·반영'}을 진행하고 있습니다.`;
  const tone: AnalysisTone = complete ? 'success' : invalidated || interrupted || bookJob?.status === 'CANCELED'
    ? 'warning' : bookJob?.status === 'FAILED' || query.isError ? 'danger' : 'primary';
  const icon = complete ? remaining ? FileSearch : CheckCircle2 : tone === 'warning' ? TriangleAlert
    : tone === 'danger' ? AlertCircle : Clock3;
  const review = (history = false) => {
    if (!bookJob?.id || !bookJob.batchId || (!complete && !history)) return;
    const params = new URLSearchParams({ workId, batchId: bookJob.batchId, sourceAnalysisJobId: bookJob.id,
      candidateType: character?.directReviewCandidateCount === 0 && (world?.directReviewCandidateCount ?? 0) > 0 ? 'world' : 'character',
      jobType: 'SETTING_EXTRACTION' });
    if (history) {
      params.set('reviewStatus', 'ALL');
      params.set('characterReviewStatus', 'ALL');
      params.set('worldReviewStatus', 'ALL');
    }
    if (bookJob.source?.settingBookId) params.set('settingBookId', bookJob.source.settingBookId);
    navigate(`/setting-review?${params}`, { state: { returnToAnalysisList: bookWorkspaceUrl(workId, bookJob.source?.settingBookId), returnHistoryDelta: -1 } });
  };
  const openProgress = () => id && navigate(`/episode-upload?${new URLSearchParams({ workId, sourceAnalysisJobId: id })}`);
  const openSettings = () => navigate(`/dashboard?${new URLSearchParams({ workId, nav: 'settingDB', tab: 'characters' })}`);
  const primary = !id ? { label: '분석 시작', disabled: startDisabled, onClick: () => void start() }
    : !sourceReady ? { label: query.isError ? '상태 다시 확인' : '분석 출처 확인 중', disabled: !query.isError, onClick: () => void retrySource() }
    : complete ? historical ? { label: '이전 분석 기록 보기', disabled: false, onClick: () => review(true) }
      : { label: remaining == null ? '검토 상태 확인 중' : remaining > 0 ? `확인이 필요한 ${remaining}개 검토` : '작품 설정 보기',
        disabled: remaining == null, onClick: () => remaining ? review() : openSettings() }
    : { label: active ? '진행 보기' : '사유 확인', disabled: false, onClick: openProgress };
  return { workId, id, book, bookJob, bookFailed, retrySource, query, characterQuery, worldQuery, character, world, progress, remaining, complete,
    active, interrupted, invalidated, changed, historical, unsaved, error, analyze, start, startDisabled,
    status, description, tone, icon, sourceReady, primary, review, openProgress, openSettings,
    readerUrl: analysisSourceReaderUrl(workId, bookJob?.source), bookId };
}

type BookAnalysisState = ReturnType<typeof useSettingBookAnalysis>;

function BookCandidateCounts({ state }: { state: BookAnalysisState }) {
  const { character, world, characterQuery, worldQuery, complete } = state;
  return <>
    <div className="analysis-batch-card__groups">
      <span className="analysis-batch-card__group">인물·세계관 설정 분석 · {complete ? '완료' : state.status}</span>
      <span className="analysis-batch-card__group">설정 자동 반영{complete ? ' · 완료' : ''}</span>
    </div>
    <div className="analysis-review-counts">
      {character && <CandidateReviewCount label="캐릭터 설정 후보" totalCount={character.totalCandidateCount ?? 0}
        reviewedCount={character.reviewedCandidateCount ?? 0} pendingCount={character.pendingCandidateCount ?? 0} />}
      {world && <CandidateReviewCount label="세계관 설정 후보" totalCount={world.totalCandidateCount ?? 0}
        reviewedCount={world.reviewedCandidateCount ?? 0} pendingCount={world.pendingCandidateCount ?? 0} />}
      {(characterQuery.isError || worldQuery.isError) && <div role="alert">검토 상태를 불러오지 못했습니다.
        <button type="button" className="analysis-card-action" onClick={() => { void characterQuery.refetch(); void worldQuery.refetch(); }}>검토 상태 다시 확인</button>
      </div>}
    </div>
  </>;
}

function BookAnalysisNotices({ state }: { state: BookAnalysisState }) {
  return <>
    {state.changed && <p>분석 후 원문이나 기준 시점이 변경되었습니다. 저장한 최신 내용을 다시 분석할 수 있습니다.</p>}
    {state.historical && <p>이전 분석 기록입니다. 설정을 변경할 수 없으며 최신 내용은 설정집에서 확인할 수 있습니다.</p>}
    {state.unsaved && <p>원문과 기준 시점을 저장한 뒤 분석해 주세요.</p>}
    {state.bookFailed && <div role="alert">현재 설정집을 불러오지 못했습니다. 다시 확인해 주세요.
      <button type="button" className="analysis-card-action" onClick={() => void state.retrySource()}>상태 다시 확인</button>
    </div>}
    {state.error && <p role="alert">{state.error}</p>}
  </>;
}

function BookAuxiliaryActions({ state }: { state: BookAnalysisState }) {
  const navigate = useNavigate();
  return <>
    {state.readerUrl && <button type="button" className="analysis-card-action analysis-tone--primary" onClick={() => navigate(state.readerUrl!)}>분석 당시 원문</button>}
    {state.sourceReady && state.bookJob?.batchId && <button type="button" className="analysis-card-action analysis-tone--primary" onClick={() => state.review(true)}>반영·제외 이력</button>}
  </>;
}

export function SettingBookAnalysisStatus(props: BookAnalysisProps & { presentation?: 'card' }) {
  const state = useSettingBookAnalysis(props);
  if (props.presentation === 'card') return <AnalysisCard testId="book-analysis-card" icon={state.icon} tone={state.tone}
    title={<>설정집<small>{state.bookJob?.source?.settingBookName ?? state.book?.originalFilename ?? '파일 확인 중'}</small></>}
    status={<>{state.complete ? '분석 완료' : state.status}{state.complete && state.remaining != null && state.remaining > 0 ? ` · ${state.remaining}개 확인 가능` : ''}</>}
    description={<>{state.description}<BookAnalysisNotices state={state} /></>}
    activityAt={state.bookJob?.updatedAt ?? state.bookJob?.completedAt ?? state.bookJob?.createdAt}
    actions={<><BookAuxiliaryActions state={state} /><button type="button" data-testid={state.complete ? 'setting-book-review' : undefined}
      className={`analysis-card-action analysis-tone--${state.complete ? 'primary' : state.tone}`}
      disabled={state.primary.disabled} onClick={state.primary.onClick}>{state.primary.label}</button></>}>
    <BookCandidateCounts state={state} />
  </AnalysisCard>;
  return <div className="setting-book-analysis-status" data-testid="setting-book-analysis-status" role="status">
    <strong>{state.status}</strong>
    {state.bookJob?.source && <span>{analysisSourceLabel(state.bookJob.source)}</span>}
    <span>{state.description}</span>
    <BookAnalysisNotices state={state} />
    <div className="setting-book-analysis-actions">
      <ActionButton data-testid={!state.id ? 'setting-book-analyze' : state.complete ? 'setting-book-review' : undefined} size="compact"
        disabled={state.primary.disabled} onClick={state.primary.onClick}>{state.active ? '분석 진행 보기' : state.primary.label}</ActionButton>
      {state.book && state.id && !state.historical && <ActionButton variant="secondary" data-testid="setting-book-analyze" size="compact"
        disabled={state.startDisabled} onClick={() => void state.start()}>
        {state.analyze.isPending ? '시작 중…' : state.interrupted && !state.changed ? '분석 재개' : '다시 분석'}
      </ActionButton>}
      {state.id && state.complete && <ActionButton variant="secondary" size="compact" onClick={state.openProgress}>분석 진행 보기</ActionButton>}
      <BookAuxiliaryActions state={state} />
    </div>
  </div>;
}

/** The existing upload progress route restores a book by explicit source and origin Job ID. */
export function SettingBookProgressRoute() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const workId = params.get('workId') ?? '';
  const id = params.get('sourceAnalysisJobId') ?? '';
  const state = useSettingBookAnalysis({ workId, analysisJobId: id,
    onCreated: job => navigate(`/episode-upload?${new URLSearchParams({ workId, sourceAnalysisJobId: job.id! })}`, { replace: true }) });
  const goBack = () => navigate(bookWorkspaceUrl(workId, state.bookId), { replace: true });
  const StatusIcon = state.icon;
  const currentStep = Object.keys(PHASES).indexOf(state.bookJob?.currentStep ?? '');
  return <div className="episode-upload-page theme-v2 workspace-v2">
    <UploadHeader onBack={goBack} backLabel="설정집으로 돌아가기" title="설정집 분석" sourceLabel="SETTING BOOK" />
    <UploadStepper labels={['설정집 업로드', '설정 분석', '설정 확인']} current={state.complete ? 3 : 2} />
    <main className="episode-upload-main">
      <div className="episode-upload-content setting-book-progress">
        <div className="episode-processing" data-testid="setting-book-analysis-status">
          <AnalysisProgressHero
            icon={state.active || state.query.isPending ? <div className="setting-book-progress-spinner"><Loader2 size={46} className="spin" /></div>
              : <StatusIcon size={52} className={`setting-book-progress-icon analysis-tone--${state.tone}`} />}
            title={state.query.isError ? '분석 정보를 불러오지 못했습니다' : state.complete ? '설정집 분석이 완료되었습니다'
              : state.interrupted ? '설정집 분석이 중단되었습니다' : state.invalidated ? '기존 분석을 이어갈 수 없습니다'
                : state.active ? '설정집을 분석하고 있습니다' : state.status}
            description={<>{state.bookJob?.workTitle && `${state.bookJob.workTitle} · `}{analysisSourceLabel(state.bookJob?.source)}</>}
          />
          {state.query.isError ? <div className="episode-upload-alert episode-upload-alert--danger" role="alert">분석 상태를 다시 확인해 주세요.</div>
            : state.query.isPending ? <p role="status">분석 정보를 확인하고 있습니다.</p>
              : !state.sourceReady ? <p role="alert">이 작업은 설정집 분석이 아닙니다.</p>
                : <>
                  <div className={`episode-upload-alert episode-upload-alert--${state.complete ? 'success' : state.interrupted || state.invalidated ? 'warning' : 'info'}`} role="status">{state.description}</div>
                  <BookAnalysisNotices state={state} />
                  <div className="episode-processing__list">
                    <AnalysisProgressCard title={state.bookJob?.source?.settingBookName ?? '설정집'} status={state.status}
                      statusClass={state.complete ? 'ANALYZED' : state.invalidated ? 'REANALYSIS_REQUIRED' : state.interrupted ? 'FAILED' : 'ANALYZING'}>
                      <div className="episode-processing-card__steps">
                        {Object.entries(PHASES).map(([phase, label], index) => <span key={phase}
                          className={state.complete || index < currentStep ? 'is-complete' : phase === state.bookJob?.currentStep ? 'is-current' : ''}>{label}</span>)}
                      </div>
                    </AnalysisProgressCard>
                    <BookCandidateCounts state={state} />
                  </div>
                </>}
          <div className="episode-processing__actions">
            <ActionButton variant="secondary" onClick={goBack}>설정집으로</ActionButton>
            <div className="setting-book-progress-actions">
              {state.interrupted && !state.historical ? <ActionButton data-testid="setting-book-analyze" disabled={state.startDisabled}
                onClick={() => void state.start()}>{state.analyze.isPending ? '시작 중…' : '분석 재개'}</ActionButton>
                : state.complete ? <ActionButton data-testid="setting-book-review" disabled={state.primary.disabled} onClick={state.primary.onClick}>{state.primary.label}</ActionButton>
                  : state.query.isError ? <ActionButton onClick={() => void state.retrySource()}>상태 다시 확인</ActionButton> : null}
            </div>
          </div>
          <div className="setting-book-analysis-actions setting-book-progress-secondary"><BookAuxiliaryActions state={state} /></div>
        </div>
      </div>
    </main>
  </div>;
}
