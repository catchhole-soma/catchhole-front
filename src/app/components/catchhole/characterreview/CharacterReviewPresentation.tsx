import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getCharactersOptions } from '../../../api/generated/@tanstack/react-query.gen';
import type { CharacterSummaryResponse, SettingCandidateResponse } from '../../../api/generated/types.gen';
import { CharacterSubjectImage } from '../character/CharacterSubjectImage';
import { getCharacterFactComparisonPolicy, type CharacterFactApplicationMode } from '../character/character-fact-comparison-policy';
import { isReviewableComparisonFailure, orderedComparisonRecoveryMessage } from '../../../lib/setting-review-progress';
import { ReviewChoiceCards, ReviewInlineValue, ReviewNotice, ReviewValueComparison } from '../review-ui/ReviewPrimitives';
import { bookReviewValueKey } from '../../../lib/book-current-review';
import { REVIEW_SAVE_TEXT, type ReviewSaveState } from '../../../lib/review-save-state';

function displayValue(text: string | null | undefined, structured: unknown): string | null {
  if (text != null) return text;
  if (structured == null) return null;
  if (typeof structured === 'string') return structured;
  if (typeof structured === 'object' && !Array.isArray(structured)
    && Object.keys(structured).length === 1 && 'value' in structured) return displayValue(null, structured.value);
  return typeof structured === 'object' ? JSON.stringify(structured) : String(structured);
}

function characterReviewValues(candidate: SettingCandidateResponse) {
  const changes = candidate.snapshotChanges ?? [];
  const primary = changes.find(change => change.action === 'UPSERT'
    && (!candidate.comparisonTargetFactKey || change.factKey === candidate.comparisonTargetFactKey))
    ?? changes.find(change => change.action === 'UPSERT')
    ?? changes.find(change => change.action === 'REMOVE');
  return {
    before: displayValue(primary?.beforeFactValue, primary?.beforeValueJson),
    after: displayValue(primary?.proposedFactValue ?? candidate.proposedFactValue,
      primary?.proposedValueJson ?? candidate.proposedValueJson) ?? candidate.attributeValue,
    additional: changes.filter(change => change !== primary),
  };
}

/** 인라인으로 보여 줄 등록 인물 수. 나머지는 작품 전체 검색(연결 모달)으로 찾는다. */
const INLINE_TARGET_COUNT = 3;

/**
 * 연결 확인이 필요한 후보의 인라인 인물 선택. 등록된 인물 목록의 첫 몇 명(AI 추천이 아님)과 새 인물 카드만 두고,
 * 그 밖의 인물은 원문 표현을 검색어로 넣은 작품 전체 검색으로 찾는다. 카드마다 긴 목록·페이지를 반복하지 않는다.
 */
export function CharacterTargetChoices({ workId, previewCharacters, candidate, disabled, resolutionError, onResolve, onBrowse }: {
  workId?: string;
  previewCharacters?: CharacterSummaryResponse[];
  candidate: SettingCandidateResponse;
  disabled: boolean;
  resolutionError?: string | null;
  onResolve: (resolution: 'MATCH_EXISTING' | 'CREATE_NEW', value: string) => void;
  onBrowse: () => void;
}) {
  const [createNew, setCreateNew] = useState(false);
  const [selectedCharacterId, setSelectedCharacterId] = useState<string | null>(null);
  const [name, setName] = useState(candidate.entityName === '미상' ? '' : candidate.entityName ?? '');
  const query = useQuery({ ...getCharactersOptions({ path: { workId: workId ?? '' }, query: { page: 0, size: INLINE_TARGET_COUNT } }),
    enabled: !previewCharacters && Boolean(workId) });
  const characters = previewCharacters ?? query.data?.data?.content ?? [];
  return <div className="review-character-targets">
    <ReviewChoiceCards label="누구에 관한 내용인가요?"
      value={createNew ? 'new' : selectedCharacterId ?? candidate.matchedCharacterId ?? null} disabled={disabled || query.isFetching}
      choices={[
        ...characters.flatMap(character => character.id ? [{ id: character.id, title: character.name || '이름 없는 인물',
          description: [character.representativeAttributeLabel && character.representativeAttributeValue
            ? `${character.representativeAttributeLabel} · ${character.representativeAttributeValue}` : null,
          character.firstAppearanceEpisodeNo != null ? `첫 등장 ${character.firstAppearanceEpisodeNo}화` : null].filter(Boolean).join(' · '),
          image: <CharacterSubjectImage image={character.image} />, footnote: '이 인물에 연결',
        }] : []),
        { id: 'new', title: '새로운 인물', description: '이름을 입력해 새로 등록', image: <CharacterSubjectImage />, footnote: '기존 인물과 다른 사람이에요' },
      ]}
      onChange={id => { setCreateNew(id === 'new'); if (id !== 'new') { setSelectedCharacterId(id); onResolve('MATCH_EXISTING', id); } }} />
    {resolutionError && !createNew && selectedCharacterId && <button type="button" className="review-cb-secondary" disabled={disabled}
      onClick={() => onResolve('MATCH_EXISTING', selectedCharacterId)}>선택한 인물로 다시 연결</button>}
    <div className="review-inline-actions">
      <span>{!previewCharacters && query.isPending ? '등록된 인물을 불러오고 있어요.' : '목록에 없으면 작품 전체에서 검색해 주세요.'}</span>
      <button type="button" className="review-action" disabled={disabled} onClick={onBrowse}>검색으로 찾기</button>
    </div>
    {query.isError && <ReviewNotice tone="warning" title="인물 목록을 불러오지 못했어요"
      action={<button type="button" className="review-action" disabled={query.isFetching} onClick={() => void query.refetch()}>다시 불러오기</button>}>
      선택한 내용은 유지됩니다. 목록을 다시 불러오거나 검색으로 찾기를 사용해 주세요.
    </ReviewNotice>}
    {createNew && <form className="review-inline-editor" onSubmit={event => { event.preventDefault(); if (!disabled && name.trim()) onResolve('CREATE_NEW', name.trim()); }}>
      <label>새 캐릭터 이름<input value={name} disabled={disabled} onChange={event => setName(event.target.value)} placeholder="인물의 이름" /></label>
      <button className="review-action" type="submit" disabled={disabled || !name.trim()}>이 이름으로 연결</button>
    </form>}
  </div>;
}

export function CharacterReviewComparison({ candidate, applicationMode, reviewed, decisionChosen, disabled, onModeChange, onReview, onEdit, onRetry, retrying, retryError,
  saveState, localChoiceMarked = false, showChoiceExample = true }: {
  candidate: SettingCandidateResponse;
  applicationMode: CharacterFactApplicationMode;
  reviewed: boolean;
  decisionChosen: boolean;
  disabled: boolean;
  onModeChange: (mode: CharacterFactApplicationMode) => void;
  onReview?: (mode: CharacterFactApplicationMode) => void;
  onEdit?: () => void;
  onRetry?: () => void;
  retrying: boolean;
  retryError: string | null;
  saveState?: ReviewSaveState;
  localChoiceMarked?: boolean;
  /** `이력에만 저장` 설명의 예문. 묶음 안에서는 첫 미결정 카드에만 보여 반복을 줄인다. */
  showChoiceExample?: boolean;
}) {
  const originalLabel = candidate.source?.sourceKind === 'SETTING_BOOK' ? '이번 설정집에서' : '이번 원고에서';
  const status = candidate.comparisonStatus ?? 'NOT_REQUIRED';
  const operation = candidate.suggestedOperation;
  const bookRemoval = candidate.source?.sourceKind === 'SETTING_BOOK' && operation === 'REMOVE';
  const policy = getCharacterFactComparisonPolicy(candidate);
  const values = characterReviewValues(candidate);
  const ordered = candidate.analysisMode === 'ORDERED_PROVISIONAL';
  const pending = candidate.reviewStatus == null || candidate.reviewStatus === 'PENDING_REVIEW';
  const manual = candidate.manualReviewAvailable === true;
  const failure = isReviewableComparisonFailure(candidate);
  const uncertain = pending && (manual ? !reviewed : operation === 'REVIEW_REQUIRED' && !decisionChosen);
  const history = candidate.historyOnly === true || !uncertain && applicationMode === 'HISTORY_ONLY';
  // A manual choice saves the author-reviewed extraction, not the earlier AI merge proposal.
  // History also records the extraction while leaving the current snapshot untouched.
  const finalValue = manual || candidate.reviewedApplicationMode != null || history || candidate.historyOnly
    ? candidate.attributeValue : values.after;
  const exclude = operation === 'EXCLUDE' || candidate.reviewStatus === 'DISMISSED';
  const removed = !pending && operation === 'REMOVE' && !history && !exclude;
  const completed = status === 'COMPLETED';
  const needsTarget = candidate.matchStatus === 'AMBIGUOUS';
  const active = status === 'PENDING' || status === 'PROCESSING';
  const showProposal = (completed || reviewed) && !uncertain && !exclude;
  const canChoose = pending && !needsTarget && !active && (manual || completed) && !exclude;
  const canReviewCurrent = manual && Boolean(onReview) && candidate.valueValidation?.status !== 'INVALID';
  const bookCurrentReview = bookReviewValueKey(candidate, candidate.matchedCharacterId, candidate.currentSnapshotVersion) != null;
  const recovery = orderedComparisonRecoveryMessage(candidate);
  const temporalLabel = manual ? candidate.temporalScope === 'PAST' ? '과거 설정'
    : candidate.temporalScope === 'HYPOTHETICAL' ? '가정·미래 계획'
    : candidate.temporalScope === 'UNKNOWN' ? '시점이 불명확한 설정' : null : null;
  const operationLabel = !pending ? '반영된 설정' : operation === 'MERGE' ? '합친 뒤의 설정' : operation === 'REMOVE' ? '반영 후' : '반영할 설정';
  const historyLabel = pending ? '이력에 남길 내용' : '이력에 저장한 내용';
  const singleValueLabel = exclude ? pending ? '반영하지 않을 내용' : '반영하지 않은 내용'
    : history ? historyLabel : uncertain ? originalLabel
    : !pending ? '반영된 설정'
    : operation === 'ADD' && !manual && candidate.reviewedApplicationMode == null ? '추가할 설정' : '반영할 최종 내용';
  return <section className="review-character-comparison" aria-label="캐릭터 설정 AI 비교 결과">
    {!needsTarget && (showProposal || uncertain || exclude || !pending) && <>
      {/* Ordered comparisons may include provisional changes that were later held. */}
      {removed ? <>
        {candidate.analysisMode === 'ORDERED_PROVISIONAL' && values.before != null && <ReviewInlineValue tone="neutral" label="비교 당시 내용">
          {values.before}
        </ReviewInlineValue>}
        <ReviewInlineValue tone="neutral" label={`${originalLabel} 확인한 변화`}>
          {candidate.attributeValue || '값 없음'}
        </ReviewInlineValue>
      </> : values.before != null && (pending || history || exclude) ? <ReviewValueComparison before={values.before}
        after={exclude ? candidate.attributeValue : operation === 'REMOVE' && !history && !manual ? '현재 설정에서 종료' : finalValue}
        mode={exclude || history || candidate.historyOnly ? 'neutral' : uncertain ? 'ambiguous' : 'change'}
        beforeLabel={ordered ? '비교 당시 내용' : exclude ? '유지되는 기존 설정' : history || candidate.historyOnly ? '유지되는 현재 설정' : '기존 설정'}
        afterLabel={exclude ? `${originalLabel} 찾은 내용` : history ? historyLabel : uncertain ? `${originalLabel} 찾은 내용` : operationLabel} />
        : <ReviewInlineValue tone={uncertain || exclude || history ? 'neutral' : 'new'}
          label={singleValueLabel}>
          {finalValue || '값 없음'}
        </ReviewInlineValue>}
      {pending && showProposal && !history && !manual && candidate.reviewedApplicationMode == null && values.additional.length > 0 && <details className="review-additional-changes"><summary>함께 바뀌는 설정 {values.additional.length}개</summary>
        {values.additional.map((change, index) => <ReviewValueComparison key={`${change.factKey}-${index}`}
          before={displayValue(change.beforeFactValue, change.beforeValueJson)}
          after={change.action === 'REMOVE' ? '현재 설정에서 종료' : displayValue(change.proposedFactValue, change.proposedValueJson)}
          mode={history ? 'neutral' : 'change'} beforeLabel={change.factKey || '기존 설정'} afterLabel={change.action === 'REMOVE' ? '종료할 설정' : '반영할 설정'} />)}
      </details>}
    </>}
    {!showProposal && !uncertain && !exclude && pending && !needsTarget && <ReviewInlineValue label={originalLabel}>{candidate.attributeValue || '값 없음'}</ReviewInlineValue>}

    {pending && active && <ReviewNotice title="설정을 비교하고 있어요">비교가 끝나면 같은 화면에서 확인하고 확정할 수 있어요.</ReviewNotice>}
    {pending && needsTarget && !completed && !manual && <ReviewNotice title="누구의 설정인지 먼저 선택해 주세요">인물을 연결한 뒤 그 인물의 현재 설정과 비교합니다.</ReviewNotice>}
    {pending && failure && !reviewed && <ReviewNotice tone="warning" title="자동 비교를 마치지 못했어요">기존 설정이 없다는 뜻은 아니에요. 원문과 인물을 확인하고 아래에서 저장할 내용을 정해 주세요.</ReviewNotice>}
    {pending && !manual && !active && policy.retryAvailable && <ReviewNotice tone="warning"
      title={status === 'RECOMPARISON_REQUIRED' ? '비교 후 설정이 달라졌어요' : status === 'FAILED' ? '비교 결과를 확인해야 해요' : '현재 설정과 비교가 필요해요'}
      action={candidate.analysisMode !== 'ORDERED_PROVISIONAL' && onRetry
        ? <button type="button" className="review-action" disabled={disabled || retrying} onClick={onRetry}>{retrying ? '비교 요청 중…' : status === 'NOT_REQUIRED' || status === 'WAITING_FOR_CHARACTER_MATCH' ? '현재 설정 비교 시작' : '다시 비교'}</button> : undefined}>
      {recovery ?? (candidate.comparisonFailureCode === 'AI_TOKEN_QUOTA_EXHAUSTED'
        ? '사용량이 부족해 비교가 중단되었습니다. 사용량을 추가한 뒤 다시 비교해 주세요.'
        : '최신 설정과 비교한 결과를 받은 뒤 확정할 수 있어요. 원문과 입력한 내용은 유지됩니다.')}
    </ReviewNotice>}
    {retryError && <ReviewNotice tone="danger">{retryError}</ReviewNotice>}
    {pending && (manual || operation === 'REVIEW_REQUIRED') && candidate.comparisonReason && <ReviewNotice tone="warning" title="확인이 필요한 이유">
      {candidate.comparisonReason}
    </ReviewNotice>}
    {canChoose && <ReviewChoiceCards label={temporalLabel ? `${temporalLabel}을 어떻게 저장할까요?` : uncertain ? '이 내용을 어떻게 저장할까요?' : '반영할 내용을 확인해 주세요'}
      value={manual && !reviewed || operation === 'REVIEW_REQUIRED' && !decisionChosen
        || bookCurrentReview && applicationMode === 'APPLY_PROPOSAL' && !decisionChosen ? null : applicationMode} disabled={disabled}
      choices={[
        ...(!bookRemoval && (policy.canApplyProposal || canReviewCurrent) ? [{ id: 'APPLY_PROPOSAL', title: operation === 'REMOVE' && !manual ? '현재 설정에서 종료' : operation === 'MERGE' && !manual ? '기존 내용과 합치기' : '현재 설정에 반영',
          description: temporalLabel ? '이 내용을 현재 시점의 설정으로 확인했다면, 표시된 값으로 현재 설정을 바꿉니다.'
            : manual ? '확인한 이번 내용으로 현재 설정을 바꿉니다.' : '위에 표시된 제안값을 현재 설정에 반영합니다.',
          preview: operation === 'REMOVE' && !manual ? '이전 내용은 이력에 남아요.' : manual ? candidate.attributeValue : values.after ?? undefined }] : []),
        ...(policy.canSaveHistory || canReviewCurrent ? [{ id: 'HISTORY_ONLY', title: '이력에만 저장',
          description: bookRemoval ? '이번 설정집의 내용과 원문 근거를 이력에 남기고 현재 설정은 유지합니다.'
            : temporalLabel ? `${temporalLabel}과 원문 근거를 이력에 남기고 현재 설정은 유지합니다.`
            : showChoiceExample
              ? <>회상이나 과거 상태처럼 현재 시점의 설정이 아닐 때 선택합니다.<br />예: ‘과거에는 용병이었다’는 이력에 남기되 현재 직업은 바꾸지 않습니다.</>
              : '회상이나 과거 상태처럼 현재 시점의 설정이 아닐 때 선택합니다.',
          preview: !ordered && values.before ? `현재 설정 유지 · ${values.before}` : '현재 설정을 바꾸지 않습니다.' }] : []),
        ...(!bookRemoval && !policy.canApplyProposal && !canReviewCurrent && onEdit ? [{ id: 'edit', title: '현재 반영할 내용 수정',
          description: '현재 설정을 바꿔야 한다면 값을 수정해 주세요.', footnote: '수정 창 열기' }] : []),
      ]}
      onChange={id => { if (id === 'edit') onEdit?.(); else if (manual && onReview) onReview(id as CharacterFactApplicationMode); else onModeChange(id as CharacterFactApplicationMode); }} />}
    {/* 서버가 저장한 선택, 저장 중, 확정 때 적용할 로컬 선택을 문장으로 구분한다. 결과 미확인은 카드 안내가 대신한다. */}
    {pending && (saveState?.kind === 'saving' ? <div className="review-draft-saved is-pending" role="status">{REVIEW_SAVE_TEXT.saving}</div>
      : saveState?.kind === 'unverified' || saveState?.kind === 'failed' ? null
      : reviewed ? <div className="review-draft-saved" role="status">{REVIEW_SAVE_TEXT.saved}</div>
      : localChoiceMarked && !manual ? <div className="review-draft-saved is-local" role="status">{REVIEW_SAVE_TEXT.localChoice}</div>
      : null)}
    {exclude && pending && <ReviewNotice title="모두 확정하면 이 후보는 제외돼요">이 내용은 현재 설정이나 이력에 추가하지 않고, 기존 설정은 그대로 유지합니다. 반영하려면 확정 전에 내용을 수정해 주세요.</ReviewNotice>}
  </section>;
}
