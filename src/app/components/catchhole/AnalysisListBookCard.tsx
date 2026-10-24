import { AlertCircle, CheckCircle2, Clock3, FileSearch, TriangleAlert } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router';
import type { AnalysisBatchSettingBookResponse } from '../../api/generated/types.gen';
import { analysisSourceReaderUrl } from '../../lib/analysis-source';
import { SETTING_BOOK_FAILURE_REASONS, SETTING_BOOK_PHASES } from '../../lib/setting-book-analysis-labels';
import { AnalysisCard, CandidateReviewCount, type AnalysisTone } from './AnalysisCard';

/** List cards consume the batch summary; clicked screens own detail reads. */
export function AnalysisListBookCard({ workId, book }: { workId: string; book: AnalysisBatchSettingBookResponse }) {
  const navigate = useNavigate();
  const location = useLocation();
  const complete = book.status === 'COMPLETED';
  const interrupted = book.status === 'INTERRUPTED';
  const invalidated = book.status === 'INVALIDATED';
  const active = book.status === 'PENDING' || book.status === 'IN_PROGRESS';
  const character = book.characterCandidates;
  const world = book.worldCandidates;
  const remaining = (character?.directReviewCandidateCount ?? 0) + (character?.processingCandidateCount ?? 0)
    + (world?.directReviewCandidateCount ?? 0) + (world?.processingCandidateCount ?? 0);
  const status = invalidated ? '원문 변경으로 중단된 분석' : complete ? '분석·자동 반영 완료'
    : interrupted || book.status === 'FAILED' ? '분석 중단' : book.status === 'CANCELED' ? '분석 취소'
      : book.status === 'PENDING' ? '분석 대기' : '분석 중';
  const failureReason = book.failureCode ? SETTING_BOOK_FAILURE_REASONS[book.failureCode] : null;
  const description = complete ? remaining > 0
    ? `설정집 분석과 자동 반영이 끝났습니다. 확인이 필요한 ${remaining}개 설정을 검토해 주세요.`
    : '설정집 분석과 설정 정리가 모두 끝났습니다. 작품 설정에서 확인할 수 있습니다.'
    : interrupted ? book.failureCode === 'AI_TOKEN_QUOTA_EXHAUSTED'
      ? '사용량 부족으로 중단됐습니다. 추가 사용량을 받은 뒤 이어서 분석할 수 있습니다.'
      : `${failureReason ?? '분석이 중단되었습니다.'} 완료된 단계는 유지되며 이어서 분석할 수 있습니다.`
      : invalidated ? '원문이나 설정이 변경되었습니다. 설정집에서 최신 원문을 확인해 주세요.'
        : book.status === 'FAILED' ? `${failureReason ?? '분석 중 문제가 발생했습니다.'} 설정집에서 재개 여부를 확인해 주세요.`
          : book.status === 'CANCELED' ? '이 분석을 이어갈 수 없습니다. 설정집의 현재 상태를 확인해 주세요.'
            : book.status === 'PENDING' ? '순서가 되면 인물과 세계관을 함께 분석합니다.'
              : `${SETTING_BOOK_PHASES[book.currentStep ?? ''] ?? '인물·세계관 설정 추출과 비교·반영'}을 진행하고 있습니다.`;
  const tone: AnalysisTone = complete ? 'success' : invalidated || interrupted || book.status === 'CANCELED'
    ? 'warning' : book.status === 'FAILED' ? 'danger' : 'primary';
  const icon = complete ? remaining ? FileSearch : CheckCircle2 : tone === 'warning' ? TriangleAlert
    : tone === 'danger' ? AlertCircle : Clock3;
  const sourceReady = Boolean(book.sourceAnalysisJobId && book.batchId && book.settingBookId);
  const returnState = { returnToAnalysisList: `${location.pathname}${location.search}`, returnHistoryDelta: -1 };
  const review = (history = false) => {
    if (!sourceReady || (!complete && !history)) return;
    const params = new URLSearchParams({ workId, batchId: book.batchId!, sourceAnalysisJobId: book.sourceAnalysisJobId!,
      settingBookId: book.settingBookId!, jobType: 'SETTING_EXTRACTION',
      candidateType: (character?.directReviewCandidateCount ?? 0) === 0 && (world?.directReviewCandidateCount ?? 0) > 0 ? 'world' : 'character' });
    if (history) for (const key of ['reviewStatus', 'characterReviewStatus', 'worldReviewStatus']) params.set(key, 'ALL');
    navigate(`/setting-review?${params}`, { state: returnState });
  };
  const openProgress = () => {
    if (!book.sourceAnalysisJobId) return;
    navigate(`/episode-upload?${new URLSearchParams({ workId, sourceAnalysisJobId: book.sourceAnalysisJobId })}`, { state: returnState });
  };
  const primary = complete ? book.historical
    ? { label: '이전 분석 기록 보기', onClick: () => review(true) }
    : remaining > 0 ? { label: `확인이 필요한 ${remaining}개 검토`, onClick: () => review() }
      : { label: '작품 설정 보기', onClick: () => navigate(`/dashboard?${new URLSearchParams({ workId, nav: 'settingDB', tab: 'characters' })}`) }
    : { label: active ? '진행 보기' : '사유 확인', onClick: openProgress };
  const readerUrl = analysisSourceReaderUrl(workId, { sourceKind: 'SETTING_BOOK', settingBookId: book.settingBookId, revisionId: book.revisionId });
  return <AnalysisCard testId="book-analysis-card" icon={icon} tone={tone}
    title={<>설정집<small>{book.settingBookName ?? '파일 확인 중'}</small></>}
    status={<>{complete ? '분석 완료' : status}{complete && remaining > 0 ? ` · ${remaining}개 확인 가능` : ''}</>}
    description={<>{description}
      {book.contentChangedSinceAnalysis && <p>분석 후 원문이나 기준 시점이 변경되었습니다. 저장한 최신 내용을 다시 분석할 수 있습니다.</p>}
      {book.historical && <p>이전 분석 기록입니다. 설정을 변경할 수 없으며 최신 내용은 설정집에서 확인할 수 있습니다.</p>}
    </>}
    activityAt={book.lastActivityAt}
    actions={<>
      {readerUrl && <button type="button" className="analysis-card-action analysis-tone--primary" onClick={() => navigate(readerUrl)}>분석 당시 원문</button>}
      {sourceReady && <button type="button" className="analysis-card-action analysis-tone--primary" onClick={() => review(true)}>반영·제외 이력</button>}
      <button type="button" data-testid={complete ? 'setting-book-review' : undefined} disabled={!sourceReady}
        className={`analysis-card-action analysis-tone--${complete ? 'primary' : tone}`} onClick={primary.onClick}>{primary.label}</button>
    </>}>
    <div className="analysis-batch-card__groups">
      <span className="analysis-batch-card__group">인물·세계관 설정 분석 · {complete ? '완료' : status}</span>
      <span className="analysis-batch-card__group">설정 자동 반영{complete ? ' · 완료' : ''}</span>
    </div>
    <div className="analysis-review-counts">
      {character && <CandidateReviewCount label="캐릭터 설정 후보" totalCount={character.totalCandidateCount ?? 0}
        reviewedCount={character.reviewedCandidateCount ?? 0} pendingCount={character.pendingCandidateCount ?? 0} />}
      {world && <CandidateReviewCount label="세계관 설정 후보" totalCount={world.totalCandidateCount ?? 0}
        reviewedCount={world.reviewedCandidateCount ?? 0} pendingCount={world.pendingCandidateCount ?? 0} />}
    </div>
  </AnalysisCard>;
}
