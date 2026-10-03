import { useLayoutEffect, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getWorldSettingOptions, getWorldSettingsOptions } from '../../../api/generated/@tanstack/react-query.gen';
import { shouldRetryQuery } from '../../../lib/query-client';
import { WorldSubjectImage } from './WorldSubjectImage';
import type { WorldSettingCandidateResponse } from '../../../api/generated/types.gen';
import { ReviewChoiceCards, ReviewNotice, ReviewValueComparison } from '../review-ui/ReviewPrimitives';
import { combineWorldReviewValues, sameWorldReviewDraft, worldReviewSourceDraft, type WorldReviewDraft } from './worldReviewDecisions';

export function WorldReviewDecisionPanel({ candidate, initialDraft, disabled, sharedChoiceAvailable, sourceValue, onSave, onDirtyChange }: {
  candidate: WorldSettingCandidateResponse;
  initialDraft: WorldReviewDraft;
  disabled: boolean;
  sharedChoiceAvailable: boolean;
  sourceValue?: string;
  onSave: (draft: WorldReviewDraft) => void;
  onDirtyChange?: (dirty: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const disabledRef = useRef(disabled);
  useLayoutEffect(() => {
    disabledRef.current = disabled;
    return () => { disabledRef.current = true; };
  }, [disabled]);
  const [targetQuery, setTargetQuery] = useState('');
  const [targetPage, setTargetPage] = useState(0);
  const [targetLoading, setTargetLoading] = useState(false);
  const [targetLoadFailed, setTargetLoadFailed] = useState(false);
  const [targetBefore, setTargetBefore] = useState<string | null>(null);
  const saved = Boolean(candidate.finalOperation);
  const sourceDraft = worldReviewSourceDraft(candidate, initialDraft);
  const targetChanged = saved && (initialDraft.subjectName !== sourceDraft.subjectName || initialDraft.category !== sourceDraft.category);
  const subjectUnresolved = targetChanged || candidate.comparisonReviewReason === 'SUBJECT_UNRESOLVED'
    || candidate.automaticReviewHoldReason === 'SUBJECT_CONFIRMATION_REQUIRED'
    || candidate.automaticReviewHoldReason === 'SUBJECT_RESOLUTION_FAILED';
  const targetsQuery = useQuery({
    ...getWorldSettingsOptions({ path: { workId: candidate.workId ?? '' }, query: {
      category: candidate.category, q: targetQuery || undefined, page: targetPage, size: 6, sort: 'CATEGORY_SUBJECT_ASC',
    } }),
    enabled: subjectUnresolved && Boolean(candidate.workId), retry: shouldRetryQuery,
  });
  const targets = targetsQuery.data?.data?.worldSettings;
  const [draft, setDraft] = useState(initialDraft);
  const [selected, setSelected] = useState<string | null>(null);
  const [selectedTargetId, setSelectedTargetId] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const targetBlocked = targetLoading || targetLoadFailed;
  const dirty = !sameWorldReviewDraft(draft, initialDraft) || targetBlocked;
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
    // 검색·페이지가 바뀌어도 실패한 선택은 동일 ID로 다시 조회한다.
    if (id !== selectedTargetId && (!target?.id || !target.subjectName || !target.category)) return;
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
      const next = { ...sourceDraft, category: detail.category, subjectName: detail.subjectName, operation: 'ADD' as const, value: incoming };
      setTargetBefore(null);
      const normalized = (value?: string | null) => (value ?? '').trim().normalize('NFC').toLocaleLowerCase('ko-KR');
      const existing = detail.properties?.find(property => normalized(property.scopeName) === normalized(next.scopeName)
        && normalized(property.settingName) === normalized(next.settingName));
      setDraft(next);
      if (existing?.value) {
        setTargetBefore(existing.value);
        setEditing(false);
      } else if (conflict) setEditing(true);
      else save(next);
    } catch {
      setTargetLoadFailed(true);
      setError('대상의 현재 설정을 불러오지 못했습니다. 선택한 대상을 다시 불러와 주세요.');
    } finally { setTargetLoading(false); }
  };
  const choose = (id: string, value: WorldReviewDraft) => {
    setSelected(id);
    setDraft(value);
    if (conflict) setEditing(true);
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
      && selectedTarget !== 'new-target' && !selectedTargetId,
    retry: shouldRetryQuery,
  });
  const savedTarget = savedTargetQuery.data?.data;
  const savedTargetBefore = !selectedTargetId && savedTarget?.id === selectedTarget
    && savedTarget.subjectName === initialDraft.subjectName && savedTarget.category === initialDraft.category
    ? savedTarget.properties?.find(property => (property.scopeName?.trim() || null) === (initialDraft.scopeName?.trim() || null)
      && property.settingName?.trim() === initialDraft.settingName.trim())?.value ?? null : null;
  const currentTargetBefore = targetBlocked ? null : targetBefore ?? savedTargetBefore;
  const editorBefore = currentTargetBefore ?? (!subjectUnresolved ? candidate.beforeValue : null);

  return <div className="review-cb-decision-panel">
    {subjectUnresolved && <div className="review-cb-target-search">
      <label>어느 대상의 설정인가요?<input aria-label="기존 세계관 대상 검색" placeholder="기존 대상 이름으로 검색" value={targetQuery}
        onChange={event => { setTargetQuery(event.target.value); setTargetPage(0); }} /></label>
      <p className="review-cb-help">작품에 저장된 대상입니다. 원문에 나온 대상과 같은 것을 선택해 주세요.</p>
      <ReviewChoiceCards label="기존 대상 또는 새로운 대상 선택" value={selectedTarget} disabled={disabled || targetLoading}
        choices={[
          ...(targets?.content ?? []).flatMap(target => target.id && target.subjectName ? [{ id: target.id,
            title: target.subjectName, description: `설정 ${target.propertyCount ?? 0}개`,
            image: <WorldSubjectImage category={target.category} path={target.image?.thumbnailUrl} vaultId={target.image?.vaultId} />,
            footnote: '이 대상에 연결' }] : []),
          { id: 'new-target', title: '새로운 대상', description: candidate.subjectName ?? '', footnote: '기존 대상과 다른 이름으로 새로 추가' },
        ]}
        onChange={id => { if (id === 'new-target') { setSelectedTargetId(id); setTargetBefore(null); setTargetLoadFailed(false); setError(null); setEditing(true); setDraft({ ...sourceDraft, subjectName: candidate.subjectName ?? sourceDraft.subjectName, operation: 'ADD', value: incoming }); } else void chooseTarget(id); }} />
      {targetLoadFailed && selectedTargetId && <button type="button" className="review-cb-secondary" disabled={disabled || targetLoading}
        onClick={() => void chooseTarget(selectedTargetId)}>선택한 대상 다시 불러오기</button>}
      {targetsQuery.isPending && <p role="status">기존 대상을 불러오고 있어요.</p>}
      {targetsQuery.isError && <ReviewNotice tone="warning" action={<button type="button" className="review-cb-secondary" onClick={() => void targetsQuery.refetch()}>다시 불러오기</button>}>기존 대상을 불러오지 못했어요. 새 대상이 없다는 뜻은 아니에요.</ReviewNotice>}
      {(targetPage > 0 || targets?.hasNext) && <div className="review-cb-actions">
        <button type="button" className="review-cb-secondary" disabled={targetPage === 0 || targetLoading} onClick={() => setTargetPage(page => page - 1)}>이전 대상</button>
        <button type="button" className="review-cb-secondary" disabled={!targets?.hasNext || targetLoading} onClick={() => setTargetPage(page => page + 1)}>다음 대상</button>
      </div>}
      {targetLoading && <p role="status">이 대상의 현재 설정을 확인하고 있어요.</p>}
    </div>}
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
      value={editing ? 'edit' : saved && sameWorldReviewDraft(initialDraft, sourceDraft) ? 'keep' : null}
      disabled={disabled || targetLoading}
      choices={[
        { id: 'keep', title: sourceDraft.operation === 'ADD' ? '이 내용 그대로 추가' : '이 내용으로 반영 준비',
          description: [sourceDraft.subjectName, sourceDraft.scopeName, sourceDraft.settingName].filter(Boolean).join(' · '),
          preview: sourceDraft.value,
          footnote: sourceDraft.operation === 'ADD' ? '확인한 위치에 새 설정으로 추가 · 기존 내용은 유지' : '위 내용을 최종 초안으로 준비' },
        { id: 'edit', title: '내용·저장 위치 수정', description: '대상, 범위, 최종 내용을 직접 정할 수 있어요.', footnote: '같은 설정이 이미 있다면 여기에서 반영 방법 선택' },
      ]}
      onChange={id => { if (id === 'edit') setEditing(true); else choose('keep', sourceDraft); }} />}
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
        mode={draft.operation === 'ADD' ? 'neutral' : 'change'} beforeLabel="현재 저장된 내용" afterLabel="저장할 최종 내용" />}
      {error && <ReviewNotice tone="danger">{error}</ReviewNotice>}
      <button type="submit" className="review-cb-primary" disabled={disabled || targetBlocked}>이 내용으로 검토 완료</button>
      <p className="review-cb-help">{dirty ? '아직 저장하지 않은 수정이 있어요. 이 내용으로 검토 완료를 누르거나 수정을 닫아 주세요.' : '선택한 내용은 아래의 모두 확정으로 작품에 반영됩니다.'}</p>
    </form>}
    {error && !editorVisible && <ReviewNotice tone="danger">{error}</ReviewNotice>}
    <div className="review-cb-actions">
    {!editorVisible && (choices.length > 0 || conflict) && <button type="button" className="review-cb-secondary" disabled={disabled || targetLoading}
      onClick={() => setEditing(true)}>최종 내용 직접 다듬기</button>}
    {editorVisible && <button type="button" className="review-cb-secondary" disabled={disabled || targetLoading || (conflict && !saved)}
      onClick={cancelDraft}>수정 닫기</button>}
    {!editorVisible && dirty && <button type="button" className="review-cb-secondary" disabled={disabled || targetLoading}
      onClick={cancelDraft}>변경 취소</button>}
    </div>
  </div>;
}
