import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getWorldSettingOptions } from '../../../api/generated/@tanstack/react-query.gen';
import { shouldRetryQuery } from '../../../lib/query-client';
import type { WorldSettingCandidateResponse } from '../../../api/generated/types.gen';
import { useWorldTargetSearch } from './useWorldTargetSearch';
import { NEW_WORLD_TARGET_ID, WorldTargetPicker } from './WorldTargetPicker';
import { WorldSubjectImage } from './WorldSubjectImage';
import { ReviewChoiceCards, ReviewNotice, ReviewValueComparison } from '../review-ui/ReviewPrimitives';
import {
  combineWorldReviewValues, sameWorldReviewDraft, worldReviewSourceDraft,
  type WorldLinkTarget, type WorldReviewDraft, type WorldTargetLinkOutcome,
} from './worldReviewDecisions';

/** 묶음의 선택 대상 연결에서 저장하지 않고 이 행에 남긴 대상. 행에서 병합·교체·최종 내용을 정한다. */
export interface WorldPresetTarget {
  target: WorldLinkTarget;
  reason: Exclude<WorldTargetLinkOutcome, 'add'>;
}

const PRESET_TITLES: Record<WorldPresetTarget['reason'], string> = {
  existing: '대상은 골랐어요. 기존값과 어떻게 합칠지 정해 주세요.',
  conflict: '대상은 골랐어요. 원문마다 다른 내용을 하나로 정해 주세요.',
  duplicate: '대상은 골랐어요. 함께 고른 다른 설정과 위치가 같아 내용을 정해 주세요.',
};

/** 대상 미정 행이 검색 없이 바로 보여 줄 최근 대상 수. */
const RECENT_TARGET_COUNT = 3;

export function WorldReviewDecisionPanel({ candidate, categoryLabel, initialDraft, disabled, sharedChoiceAvailable, sourceValue, presetTarget,
  compactTargetPicker = false, recentTargets = [], onTargetChosen, onSave, onDirtyChange }: {
  candidate: WorldSettingCandidateResponse;
  categoryLabel: string;
  initialDraft: WorldReviewDraft;
  disabled: boolean;
  sharedChoiceAvailable: boolean;
  sourceValue?: string;
  /** 처음 열 때 이미 골라 둔 대상. 대상의 현재 설정을 읽어 행에서 이어서 결정하게 한다. */
  presetTarget?: WorldPresetTarget;
  /**
   * 묶음에 대상 미정 행이 여럿이라 검색 목록이 반복될 때. 행마다 6개 카드·페이지를 펼치는 대신 최근 고른 대상과 새 등록,
   * `대상 검색`만 먼저 보여 준다. 대상 미정 행이 하나뿐이면 기존 검색 목록을 그대로 둔다.
   */
  compactTargetPicker?: boolean;
  /** 이번 검토에서 고른 기존 대상(최근 순). 축소형 대상 선택에서 검색 없이 바로 고를 수 있다. */
  recentTargets?: WorldLinkTarget[];
  /** 기존 대상을 골라 현재 설정을 읽었을 때 알린다(최근 대상으로 기억). */
  onTargetChosen?: (target: WorldLinkTarget) => void;
  onSave: (draft: WorldReviewDraft) => void;
  onDirtyChange?: (dirty: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const disabledRef = useRef(disabled);
  useLayoutEffect(() => {
    disabledRef.current = disabled;
    return () => { disabledRef.current = true; };
  }, [disabled]);
  const [targetLoading, setTargetLoading] = useState(false);
  const [targetLoadFailed, setTargetLoadFailed] = useState(false);
  const [targetBefore, setTargetBefore] = useState<string | null>(null);
  const saved = Boolean(candidate.finalOperation);
  const sourceDraft = worldReviewSourceDraft(candidate, initialDraft);
  const targetChanged = saved && (initialDraft.subjectName !== sourceDraft.subjectName || initialDraft.category !== sourceDraft.category);
  const subjectUnresolved = targetChanged || candidate.comparisonReviewReason === 'SUBJECT_UNRESOLVED'
    || candidate.automaticReviewHoldReason === 'SUBJECT_CONFIRMATION_REQUIRED'
    || candidate.automaticReviewHoldReason === 'SUBJECT_RESOLUTION_FAILED';
  // 축소형에서는 작가가 `대상 검색`을 눌렀을 때만 목록을 연다. 행마다 목록을 미리 불러오지 않는다.
  const [searchOpen, setSearchOpen] = useState(!compactTargetPicker);
  const targetSearch = useWorldTargetSearch({ workId: candidate.workId, category: candidate.category,
    enabled: subjectUnresolved && (searchOpen || saved) });
  const recentChoices = recentTargets.filter(target => target.worldSettingId && target.category === candidate.category)
    .slice(0, RECENT_TARGET_COUNT);
  const targets = targetSearch.targets;
  const [draft, setDraft] = useState(initialDraft);
  const [selected, setSelected] = useState<string | null>(null);
  const [selectedTargetId, setSelectedTargetId] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const targetBlocked = targetLoading || targetLoadFailed;
  const dirty = editing || selected !== null || selectedTargetId !== null
    || !sameWorldReviewDraft(draft, initialDraft) || targetBlocked;
  useLayoutEffect(() => {
    onDirtyChange?.(dirty);
    return () => onDirtyChange?.(false);
  }, [dirty, onDirtyChange]);
  const cancelDraft = () => {
    setDraft(initialDraft);
    setEditing(false);
    setError(null);
    setSelected(null);
    setSelectedTargetId(null);
    setTargetLoadFailed(false);
    setTargetBefore(null);
  };
  const unresolved = candidate.comparisonReviewReason === 'SCOPE_UNRESOLVED';
  const mismatch = candidate.comparisonReviewReason === 'SCOPE_MISMATCH';
  const conflict = candidate.consolidationStatus === 'CONFLICT';
  const matched = Boolean(candidate.matchedPropertyName && candidate.beforeValue?.trim());
  // Consolidation combines extracted sources; proposedValue may also contain the old DB value.
  const incoming = sourceValue ?? candidate.extractedValue ?? sourceDraft.value;
  const combined = candidate.suggestedOperation === 'MERGE' && candidate.proposedValue
    ? candidate.proposedValue : combineWorldReviewValues(candidate.beforeValue, incoming);
  const matchedDraft = { ...sourceDraft, scopeName: candidate.matchedScopeName,
    settingName: candidate.matchedPropertyName ?? sourceDraft.settingName };
  const canChooseScope = (unresolved || mismatch) && matched && sharedChoiceAvailable && !subjectUnresolved;
  const canChooseChange = !unresolved && !mismatch && matched && sharedChoiceAvailable
    && !subjectUnresolved;
  const separateDraft = { ...sourceDraft, operation: 'ADD' as const, scopeName: candidate.scopeName,
    settingName: candidate.settingName ?? sourceDraft.settingName, value: incoming };
  const choiceDraft = (id: string): WorldReviewDraft => id === 'separate' ? separateDraft
    : { ...matchedDraft, operation: id === 'merge' ? 'MERGE' : 'UPDATE', value: id === 'merge' ? combined : incoming };
  const selectedOriginalChoice = ['merge', 'replace', 'separate'].find(id => sameWorldReviewDraft(initialDraft, choiceDraft(id))) ?? null;

  const save = (value: WorldReviewDraft) => {
    const normalized = { ...value, subjectName: value.subjectName.trim(), settingName: value.settingName.trim(),
      scopeName: value.scopeName?.trim() || null, value: value.value.trim() };
    if (!normalized.subjectName || !normalized.settingName || !normalized.value) {
      setError('대상·설정명·최종 내용을 모두 입력해 주세요.');
      return;
    }
    if (conflict && candidate.comparisonReviewReason === 'BATCH_LIMIT_EXCEEDED'
      && normalized.value.normalize('NFC').replace(/\s+/g, '') === incoming.normalize('NFC').replace(/\s+/g, '')) {
      setError('서로 다른 추출값을 하나의 최종 내용으로 정리해 주세요.');
      return;
    }
    setError(null);
    onSave(normalized);
  };
  const chooseTarget = async (id: string) => {
    const target = targets?.content?.find(item => item.id === id);
    if (disabled || targetLoading || !candidate.workId) return;
    // 검색·페이지가 바뀌어도 실패한 선택은 동일 ID로 다시 조회한다. 최근 대상 카드는 검색 결과 밖이어도 고를 수 있다.
    if (id !== selectedTargetId && !recentChoices.some(item => item.worldSettingId === id)
      && (!target?.id || !target.subjectName || !target.category)) return;
    await loadTarget(id);
  };
  /** 고른 대상의 현재 설정을 읽어 같은 경로가 있으면 병합·교체 선택을, 없으면 추가 초안을 연다. */
  const loadTarget = async (id: string) => {
    if (!candidate.workId) return;
    setSelectedTargetId(id);
    setTargetBefore(null);
    setTargetLoadFailed(false);
    setTargetLoading(true);
    setError(null);
    try {
      const response = await queryClient.fetchQuery(getWorldSettingOptions({ path: { workId: candidate.workId!, worldSettingId: id } }));
      if (disabledRef.current) return;
      const detail = response.data;
      if (detail?.id !== id || !detail.category || !detail.subjectName) throw new Error('missing target');
      onTargetChosen?.({ worldSettingId: id, category: detail.category, subjectName: detail.subjectName });
      const next = { ...sourceDraft, category: detail.category, subjectName: detail.subjectName, operation: 'ADD' as const, value: incoming };
      setTargetBefore(null);
      const normalized = (value?: string | null) => (value ?? '').trim().normalize('NFC').toLocaleLowerCase('ko-KR');
      const existing = detail.properties?.find(property => normalized(property.scopeName) === normalized(next.scopeName)
        && normalized(property.settingName) === normalized(next.settingName));
      setDraft(next);
      if (existing?.value) {
        setTargetBefore(existing.value);
        setEditing(false);
      } else setEditing(true);
    } catch {
      setTargetLoadFailed(true);
      setError('대상의 현재 설정을 불러오지 못했습니다. 선택한 대상을 다시 불러와 주세요.');
    } finally { setTargetLoading(false); }
  };
  // 묶음에서 골라 둔 대상은 처음 열 때 한 번 불러온다(패널 key가 대상마다 바뀐다).
  const presetAppliedRef = useRef(false);
  useEffect(() => {
    // 저장 요청·복구 확인 중에는 늦은 응답을 버리므로, 행을 다시 쓸 수 있게 된 뒤 한 번 적용한다.
    if (!presetTarget || presetAppliedRef.current || disabled) return;
    presetAppliedRef.current = true;
    const { target } = presetTarget;
    if (target.worldSettingId) {
      void loadTarget(target.worldSettingId);
      return;
    }
    setSelectedTargetId(NEW_WORLD_TARGET_ID);
    setEditing(true);
    setDraft({ ...sourceDraft, category: target.category, subjectName: target.subjectName, operation: 'ADD', value: incoming });
  // 한 번만 적용한다. 이후 작가의 선택을 덮지 않는다.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [disabled]);
  const choose = (id: string, value: WorldReviewDraft) => {
    setSelected(id);
    setDraft(value);
    if (subjectUnresolved || conflict) setEditing(true);
    else { setEditing(false); save(value); }
  };
  const choices = canChooseScope ? [
    { id: 'merge', title: unresolved ? '예, 포함된 내용이에요' : '기존 범위에 합치기',
      description: `${candidate.matchedScopeName || '공통 설정'} · ${candidate.matchedPropertyName}`,
      preview: combined, footnote: '기존 내용과 이번 내용을 함께 저장' },
    { id: 'separate', title: unresolved ? '아니요, 별도 설정이에요' : '이번 범위에 따로 저장',
      description: `${candidate.scopeName || '공통 설정'} · ${candidate.settingName}`,
      preview: incoming, footnote: '기존 설정을 유지하고 새로 추가' },
  ] : canChooseChange ? [
    { id: 'merge', title: '기존 내용과 합치기', preview: combined, footnote: '두 내용을 함께 저장' },
    { id: 'replace', title: '이번 내용으로 바꾸기', preview: incoming, footnote: '이 항목의 기존 내용을 교체' },
  ] : [];

  const simpleReview = !subjectUnresolved && !choices.length && !conflict;
  const selectedTargets = (targets?.content ?? []).filter(target => target.subjectName === initialDraft.subjectName
    && target.category === initialDraft.category);
  const selectedTarget = selectedTargetId ?? (saved && selectedTargets.length === 1 ? selectedTargets[0].id ?? null : null);
  const editorVisible = editing || (conflict && !saved);
  const savedTargetQuery = useQuery({
    ...getWorldSettingOptions({ path: { workId: candidate.workId ?? '', worldSettingId: selectedTarget ?? '' } }),
    enabled: subjectUnresolved && saved && Boolean(candidate.workId) && Boolean(selectedTarget)
      && selectedTarget !== NEW_WORLD_TARGET_ID && !selectedTargetId,
    retry: shouldRetryQuery,
  });
  const savedTarget = savedTargetQuery.data?.data;
  const savedTargetBefore = !selectedTargetId && savedTarget?.id === selectedTarget
    && savedTarget.subjectName === initialDraft.subjectName && savedTarget.category === initialDraft.category
    ? savedTarget.properties?.find(property => (property.scopeName?.trim() || null) === (initialDraft.scopeName?.trim() || null)
      && property.settingName?.trim() === initialDraft.settingName.trim())?.value ?? null : null;
  const currentTargetBefore = targetBlocked ? null : targetBefore ?? savedTargetBefore;
  const editorBefore = currentTargetBefore ?? (!subjectUnresolved ? candidate.beforeValue : null);
  const extractedName = candidate.subjectName ?? sourceDraft.subjectName;
  const pickerLabel = `‘${extractedName}’ — 기존 ${categoryLabel}에 연결할까요, 새로 등록할까요?`;
  const newTargetCard = { title: `‘${extractedName}’ 새로 등록`, description: `기존 ${categoryLabel} 항목과 별개인 경우 선택해 주세요.`, footnote: '이름·설정을 검토한 뒤 모두 확정할 때 등록' };
  const chooseTargetCard = (id: string) => {
    if (id !== NEW_WORLD_TARGET_ID) {
      void chooseTarget(id);
      return;
    }
    setSelectedTargetId(id);
    setTargetBefore(null);
    setTargetLoadFailed(false);
    setError(null);
    setEditing(true);
    setDraft({ ...sourceDraft, subjectName: candidate.subjectName ?? sourceDraft.subjectName, operation: 'ADD', value: incoming });
  };

  return <div className="review-cb-decision-panel">
    {presetTarget && <ReviewNotice tone="warning" title={PRESET_TITLES[presetTarget.reason]}>
      연결할 대상 ‘{presetTarget.target.subjectName}’에 저장하기 전에 이 설정의 내용을 확인해 주세요.
    </ReviewNotice>}
    {presetTarget && !subjectUnresolved && targetLoadFailed && selectedTargetId && <button type="button" className="review-cb-secondary"
      disabled={disabled || targetLoading} onClick={() => void loadTarget(selectedTargetId)}>선택한 대상 다시 불러오기</button>}
    {presetTarget && !subjectUnresolved && targetLoading && <p role="status">이 대상의 현재 설정을 확인하고 있어요.</p>}
    {subjectUnresolved && !searchOpen && !saved && <div className="review-cb-target-search is-compact">
      <ReviewChoiceCards label={pickerLabel} value={selectedTarget} disabled={disabled || targetLoading}
        choices={[
          ...recentChoices.map(target => ({ id: target.worldSettingId!, title: target.subjectName, description: '이번 검토에서 고른 대상',
            image: <WorldSubjectImage category={target.category} />, footnote: '이 대상에 연결' })),
          { id: NEW_WORLD_TARGET_ID, ...newTargetCard },
        ]}
        onChange={chooseTargetCard} />
      <div className="review-inline-actions">
        <span>{recentChoices.length ? '다른 대상은 검색해서 고를 수 있어요.' : `기존 ${categoryLabel}에 연결하려면 검색해 주세요.`}</span>
        <button type="button" className="review-action" disabled={disabled || targetLoading} onClick={() => setSearchOpen(true)}>대상 검색</button>
      </div>
      {targetLoading && <p role="status">이 대상의 현재 설정을 확인하고 있어요.</p>}
      {targetLoadFailed && selectedTargetId && <button type="button" className="review-cb-secondary" disabled={disabled || targetLoading}
        onClick={() => void chooseTarget(selectedTargetId)}>선택한 대상 다시 불러오기</button>}
    </div>}
    {subjectUnresolved && (searchOpen || saved) && <WorldTargetPicker search={targetSearch}
      label={pickerLabel} categoryLabel={categoryLabel}
      value={selectedTarget} disabled={disabled || targetLoading} pagerDisabled={targetLoading}
      help="추출된 이름과 작품에 저장된 대상이 같은지 확인하는 단계예요. 같은 대상이면 연결하고, 별개라면 새로 등록해 주세요."
      newTarget={newTargetCard}
      onChange={chooseTargetCard}
      footer={targetLoading && <p role="status">이 대상의 현재 설정을 확인하고 있어요.</p>}>
      {targetLoadFailed && selectedTargetId && <button type="button" className="review-cb-secondary" disabled={disabled || targetLoading}
        onClick={() => void chooseTarget(selectedTargetId)}>선택한 대상 다시 불러오기</button>}
    </WorldTargetPicker>}
    {currentTargetBefore && <ReviewChoiceCards label="이 대상에 같은 설정이 있어요. 어떻게 반영할까요?" value={draft.operation === 'ADD' ? null : draft.operation}
      choices={[
        { id: 'MERGE', title: '기존 내용과 합치기', preview: combineWorldReviewValues(currentTargetBefore, incoming) },
        { id: 'UPDATE', title: '이번 내용으로 바꾸기', preview: incoming },
      ]} disabled={disabled || targetLoading} onChange={id => choose(id, { ...draft, operation: id as 'MERGE' | 'UPDATE', value: id === 'MERGE' ? combineWorldReviewValues(currentTargetBefore, incoming) : incoming })} />}

    {choices.length > 0 && <ReviewChoiceCards
      label={unresolved ? `‘${candidate.matchedScopeName || candidate.matchedPropertyName}’에 포함된 내용인가요?`
        : mismatch ? '어느 범위에 반영할까요?' : '이 설정을 어떻게 반영할까요?'}
      value={selected ?? (saved ? selectedOriginalChoice : candidate.suggestedOperation === 'MERGE' ? 'merge' : candidate.suggestedOperation === 'UPDATE' ? 'replace' : null)}
      choices={choices}
      disabled={disabled || targetLoading}
      onChange={id => choose(id, choiceDraft(id))}
    />}
    {simpleReview && <ReviewChoiceCards
      label={candidate.comparisonStatus === 'FAILED' ? '원문과 저장할 대상·내용을 확인해 주세요' : '이 내용을 어떻게 반영할까요?'}
      value={selected ?? (saved && sameWorldReviewDraft(initialDraft, sourceDraft) ? 'keep' : null)}
      disabled={disabled || targetLoading}
      choices={[
        { id: 'keep', title: sourceDraft.operation === 'ADD' ? '이 내용 그대로 추가' : '이 내용으로 반영 준비',
          description: [sourceDraft.subjectName, sourceDraft.scopeName, sourceDraft.settingName].filter(Boolean).join(' · '),
          preview: sourceDraft.value,
          footnote: sourceDraft.operation === 'ADD' ? '확인한 위치에 새 설정으로 추가 · 기존 내용은 유지' : '위 내용을 최종 초안으로 준비' },
        { id: 'edit', title: '내용·저장 위치 수정', description: '대상, 범위, 최종 내용을 직접 정할 수 있어요.', footnote: '같은 설정이 이미 있다면 여기에서 반영 방법 선택' },
      ]}
      onChange={id => { if (id === 'edit') { setSelected(id); setEditing(true); } else choose('keep', sourceDraft); }} />}
    {editorVisible && <form className="review-cb-inline-editor" onSubmit={event => { event.preventDefault(); if (!disabled && !targetBlocked) save(draft); }}>
      <strong>{conflict ? '최종 내용을 확인해 주세요' : '반영할 내용을 정해 주세요'}</strong>
      {candidate.comparisonReviewReason === 'SUBJECT_UNRESOLVED' && <p>어느 대상의 설정인지 원문을 확인해 대상 이름을 입력해 주세요. 기존 대상의 정확한 이름을 입력하면 해당 대상에 반영합니다.</p>}
      <div className="review-cb-inline-fields">
        <label>대상<input aria-label="반영할 대상" value={draft.subjectName} disabled={disabled || targetLoading}
          onChange={event => setDraft(current => ({ ...current, subjectName: event.target.value }))} /></label>
        <label>범위 (선택)<input aria-label="반영할 범위" placeholder="범위가 없다면 비워 두세요" value={draft.scopeName ?? ''} disabled={disabled || targetLoading}
          onChange={event => setDraft(current => ({ ...current, scopeName: event.target.value }))} /></label>
        <label>설정명<input aria-label="반영할 설정명" value={draft.settingName} disabled={disabled || targetLoading}
          onChange={event => setDraft(current => ({ ...current, settingName: event.target.value }))} /></label>
        <label>저장 방법<select aria-label="저장 방법" value={draft.operation} disabled={disabled || targetLoading}
          onChange={event => { const operation = event.target.value as WorldReviewDraft['operation']; setDraft(current => ({ ...current, operation, value: operation === 'MERGE' && current.operation !== 'MERGE' ? combineWorldReviewValues(editorBefore, current.value) : current.value })); }}>
          <option value="ADD">새 설정으로 추가</option><option value="MERGE">기존 내용과 합치기</option><option value="UPDATE">기존값을 교체</option>
        </select></label>
      </div>
      <label>최종 내용<textarea aria-label="최종 내용" rows={4} value={draft.value} disabled={disabled || targetLoading}
        onChange={event => setDraft(current => ({ ...current, value: event.target.value }))} /></label>
      {editorBefore && <ReviewValueComparison before={editorBefore} after={draft.value}
        mode={draft.operation === 'ADD' ? 'neutral' : 'change'}
        beforeLabel={candidate.source?.sourceKind === 'SETTING_BOOK' && currentTargetBefore == null ? '비교 당시 내용' : '현재 저장된 내용'}
        afterLabel="저장할 최종 내용" />}
      {error && <ReviewNotice tone="danger">{error}</ReviewNotice>}
      <footer className="review-cb-inline-editor__footer">
        <p className="review-cb-help">{dirty ? '아직 저장하지 않은 수정이 있어요. 이 내용으로 검토 완료를 누르거나 수정을 닫아 주세요.' : '선택한 내용은 아래의 모두 확정으로 작품에 반영됩니다.'}</p>
        <div className="review-cb-actions">
          <button type="button" className="review-cb-secondary" disabled={disabled || targetLoading || (conflict && !saved)}
            onClick={cancelDraft}>수정 닫기</button>
          <button type="submit" className="review-cb-primary" disabled={disabled || targetBlocked}>이 내용으로 검토 완료</button>
        </div>
      </footer>
    </form>}
    {error && !editorVisible && <ReviewNotice tone="danger">{error}</ReviewNotice>}
    {!editorVisible && <div className="review-cb-actions">
    {!editorVisible && (choices.length > 0 || conflict) && <button type="button" className="review-cb-secondary" disabled={disabled || targetLoading}
      onClick={() => setEditing(true)}>최종 내용 직접 다듬기</button>}
    {!editorVisible && dirty && <button type="button" className="review-cb-secondary" disabled={disabled || targetLoading}
      onClick={cancelDraft}>변경 취소</button>}
    </div>}
  </div>;
}
