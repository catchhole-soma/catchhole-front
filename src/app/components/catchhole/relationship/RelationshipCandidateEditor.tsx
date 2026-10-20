import { useEffect, useId, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Check, CircleHelp, Save } from 'lucide-react';
import { getRelationshipCandidateQueryKey } from '../../../api/generated/@tanstack/react-query.gen';
import {
  confirmRelationshipCandidate, dismissRelationshipCandidate, updateRelationshipCandidate,
} from '../../../api/generated/sdk.gen';
import type {
  CommonResponseRelationshipCandidateResponse, RelationshipCandidateResponse, RelationshipCandidateUpdateRequest,
} from '../../../api/generated/types.gen';
import { toApiError } from '../../../lib/api-errors';
import { privateImageSessionEpoch as authSessionEpoch } from '../../../lib/private-image-session';
import { ActionButton } from '../ui-v2/ActionButton';
import { ReviewChoiceCards, ReviewSettingHeading } from '../review-ui/ReviewPrimitives';
import '../../../../styles/family-review-v2.css';
import '../../../../styles/family-edit-fields.css';
import { RelationshipCurrentSetting, RelationshipEvidenceDisclosure } from './RelationshipEvidence';
import { RelationshipTargetPicker } from './RelationshipTargetPicker';
import { RelationshipPairPreview } from './RelationshipPairPreview';
import { useRelationshipContext } from './useRelationshipContext';
import {
  allowedSubtypes, ASSERTION_LABELS, COUNTERPART_ROLES, generationLabel, isDistantAncestry, KIND_LABELS, relationshipError, reviewMessage,
  SUBTYPE_LABELS, TIME_LABELS, type RelationshipKind,
  type RelationshipSubtype, type RelationshipTime,
} from './relationship-presentation';

type Draft = Omit<RelationshipCandidateUpdateRequest, 'expectedVersion'>;
type Decision = 'family' | 'exclude' | 'unknown';

function readyToConfirm(candidate: RelationshipCandidateResponse) {
  return candidate.status === 'PENDING' && (candidate.reviewReasons?.length ?? 0) === 0
    && !!candidate.objectCharacterId && candidate.assertion === 'ASSERTED' && candidate.temporalScope !== 'UNKNOWN'
    && (candidate.evidence?.length ?? 0) > 0 && (candidate.evidence?.length ?? 0) <= 20;
}

function draftFrom(candidate: RelationshipCandidateResponse): Draft {
  return {
    subjectCharacterId: candidate.subjectCharacterId!, objectCharacterId: candidate.objectCharacterId || undefined,
    objectMention: candidate.objectMention || undefined, kind: candidate.kind!, subtype: candidate.subtype!,
    generationGap: candidate.generationGap ?? undefined,
    temporalScope: candidate.temporalScope!, timeLabel: candidate.timeLabel || undefined, assertion: candidate.assertion!,
    evidence: (candidate.evidence ?? []).filter(source => source.sourceFactId && source.sourceToken)
      .map(source => ({ sourceFactId: source.sourceFactId!, sourceToken: source.sourceToken! })),
  };
}

export function RelationshipCandidateEditor({ workId, candidate, onClose, onChanged, onOpenEvidence, closeLabel = '후보 목록', initialIntent = 'review' }: {
  workId: string; candidate: RelationshipCandidateResponse; onClose: () => void;
  initialIntent?: 'review' | 'link' | 'edit'; closeLabel?: string; onChanged: (decided: boolean) => void; onOpenEvidence: (factId: string) => void;
}) {
  const client = useQueryClient();
  const editor = useRef<HTMLElement>(null);
  const diagram = useRef<HTMLDivElement>(null);
  const judgment = useRef<HTMLElement>(null);
  const pickerId = useId();
  const relationshipQuestionId = useId();
  const generationHintId = useId();
  const [pickerOpen, setPickerOpen] = useState(false);
  useEffect(() => {
    editor.current?.scrollIntoView({ block: 'start', behavior: 'instant' });
    editor.current?.focus({ preventScroll: true });
  }, []);
  const [baseline, setBaseline] = useState(candidate);
  const [draft, setDraft] = useState(() => draftFrom(candidate));
  const [objectName, setObjectName] = useState(candidate.objectCharacterName ?? '');
  const [sourcePickerOpen, setSourcePickerOpen] = useState(false);
  const [busy, setBusy] = useState<'save' | 'apply' | 'dismiss' | 'judgment' | null>(null);
  const [decision, setDecision] = useState<Decision | null>(null);
  const [judgmentOpen, setJudgmentOpen] = useState(candidate.assertion !== 'ASSERTED');
  const [detailsOpen, setDetailsOpen] = useState(initialIntent === 'edit');
  const [linkIntent] = useState(initialIntent === 'link' || !!candidate.displayableAsMention);
  const submitting = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const contextCandidate = (baseline.version ?? 0) > (candidate.version ?? 0) ? baseline : candidate;
  const context = useRelationshipContext(workId, contextCandidate,
    [draft.subjectCharacterId, draft.objectCharacterId].filter((id): id is string => !!id));
  const sources = context.sources;
  const currentMetadata = context.latest && (context.latest.version ?? 0) >= (contextCandidate.version ?? 0)
    ? context.latest : contextCandidate;
  const dirty = JSON.stringify(draft) !== JSON.stringify(draftFrom(baseline));
  const stale = currentMetadata.version !== baseline.version || currentMetadata.status !== baseline.status;
  const editable = baseline.status === 'PENDING';
  const locked = !!busy || !editable || stale;
  const reasons = currentMetadata.reviewReasons ?? [];
  const judgmentUnsaved = judgmentOpen || draft.assertion !== baseline.assertion;
  const visibleReasons = reasons.filter(reason => !['UNRESOLVED_TARGET', 'UNCERTAIN', 'NEGATED', 'FIGURATIVE', 'CONFLICTING', 'UNKNOWN_TEMPORAL_SCOPE'].includes(reason));
  const validEvidence = draft.evidence.length > 0 && draft.evidence.length <= 20;
  const selectedSourcesCurrent = draft.evidence.every(item =>
    sources !== null ? sources.some(source => source.factId === item.sourceFactId && source.contextToken === item.sourceToken)
      : currentMetadata.evidence?.some(source => source.current && source.sourceFactId === item.sourceFactId && source.sourceToken === item.sourceToken));
  const evidenceFor = (subjectId: string | undefined, objectId: string | undefined) => draft.evidence.every(item =>
    sources?.some(source => source.factId === item.sourceFactId && source.contextToken === item.sourceToken
      && !!source.characterId && (source.characterId === subjectId || source.characterId === objectId)));
  const draftSourcesValid = selectedSourcesCurrent && evidenceFor(draft.subjectCharacterId, draft.objectCharacterId);
  const judgmentSourcesValid = selectedSourcesCurrent && evidenceFor(baseline.subjectCharacterId, baseline.objectCharacterId);
  const contextReady = !context.pending && !!context.latest && sources !== null;
  const validGeneration = draft.generationGap == null || isDistantAncestry(draft.kind)
    && Number.isSafeInteger(draft.generationGap) && draft.generationGap >= 1 && draft.generationGap <= 2147483647;
  const canSave = !locked && contextReady && !judgmentUnsaved && validEvidence && selectedSourcesCurrent
    && draftSourcesValid && validGeneration && (!!draft.objectCharacterId || !!draft.objectMention?.trim());
  const canSaveJudgment = !locked && !!context.latest && decision !== null && (decision === 'exclude'
    || contextReady && validEvidence && judgmentSourcesValid && (!!baseline.objectCharacterId || !!baseline.objectMention?.trim()));
  const needsSourceSelection = !validEvidence || !selectedSourcesCurrent || reasons.includes('SOURCE_CHANGED')
    || (judgmentOpen && decision !== 'exclude' ? !judgmentSourcesValid : !draftSourcesValid);
  const unchangedBlocker = !dirty && reasons.some(reason => ['CURRENT_VALUE_CONFLICT', 'UNSUPPORTED_STRUCTURED_CONTEXT',
    'UNSUPPORTED_FAMILY_SYNTAX', 'INPUT_LIMIT_EXCEEDED', 'ARCHIVED_ENDPOINT', 'SELF_REFERENCE'].includes(reason));
  const canApply = canSave && baseline.assertion === 'ASSERTED' && selectedSourcesCurrent && !unchangedBlocker
    && draft.assertion === 'ASSERTED' && draft.temporalScope !== 'UNKNOWN';
  const evidence = currentMetadata.evidence ?? [];
  const sourceCount = evidence.filter(source => source.hasEvidence && source.sourceFactId).length;
  const subjectName = baseline.subjectCharacterName || '이 인물';
  const sourceNames = {
    ...(baseline.subjectCharacterId ? { [baseline.subjectCharacterId]: subjectName } : {}),
    ...(baseline.objectCharacterId ? { [baseline.objectCharacterId]: baseline.objectCharacterName || '상대 인물' } : {}),
    ...(currentMetadata.subjectCharacterId ? { [currentMetadata.subjectCharacterId]: currentMetadata.subjectCharacterName || '인물' } : {}),
    ...(currentMetadata.objectCharacterId ? { [currentMetadata.objectCharacterId]: currentMetadata.objectCharacterName || '상대 인물' } : {}),
    ...(draft.objectCharacterId ? { [draft.objectCharacterId]: objectName || '선택한 인물' } : {}),
  };
  const counterpartName = draft.objectCharacterId ? objectName || '선택한 인물' : draft.objectMention || '이름 미상';
  const mainLabel = linkIntent ? '프로필 연결하기' : '가계도에 반영하기';
  const judgmentStatus = baseline.assertion === 'ASSERTED' ? '가족 관계예요'
    : baseline.assertion === 'UNCERTAIN' ? '아직 모르는 관계예요'
      : baseline.assertion === 'NEGATED' ? '가족이 아니라는 표현이 있어요'
        : baseline.assertion === 'FIGURATIVE' ? '가족에 빗댄 표현이에요' : '서로 다른 가족 설정이 있어요';

  function closePicker() {
    setPickerOpen(false);
    requestAnimationFrame(() => {
      const trigger = diagram.current?.querySelector<HTMLButtonElement>('[data-person="object"]');
      trigger?.scrollIntoView({ block: 'nearest', behavior: 'instant' });
      trigger?.focus({ preventScroll: true });
    });
  }

  function change<K extends keyof Draft>(key: K, value: Draft[K]) {
    setDraft(previous => ({ ...previous, [key]: value }));
    setMessage(null);
  }

  async function syncCandidateCache(response: CommonResponseRelationshipCandidateResponse, session: number) {
    if (!mounted.current || session !== authSessionEpoch()) return false;
    const queryKey = getRelationshipCandidateQueryKey({ path: { workId, candidateId: baseline.id! } });
    // An older in-flight read must not replace this successful response.
    await client.cancelQueries({ queryKey, exact: true });
    if (!mounted.current || session !== authSessionEpoch()) return false;
    let superseded = false;
    client.setQueryData<CommonResponseRelationshipCandidateResponse>(queryKey, current => {
      // A newer external edit still needs the existing stale-draft protection.
      if (current?.data?.version != null && response.data?.version != null
        && current.data.version > response.data.version) { superseded = true; return current; }
      return response;
    });
    if (superseded) setError('더 최근에 수정된 내용이 있어요. 최신 내용을 확인한 뒤 이어서 저장해 주세요.');
    return !superseded;
  }

  function acknowledgeChanges() {
    if (busy || context.pending || !context.latest || !stale) return;
    const previous = draftFrom(baseline);
    const latest = draftFrom(currentMetadata);
    const edits = Object.fromEntries((Object.keys(draft) as (keyof Draft)[])
      .filter(key => JSON.stringify(draft[key]) !== JSON.stringify(previous[key]))
      .map(key => [key, draft[key]]));
    // Retain relationship edits together so a newer kind cannot inherit an incompatible subtype or generation gap.
    const relationEdited = draft.kind !== previous.kind || draft.subtype !== previous.subtype || draft.generationGap !== previous.generationGap;
    const nextDraft = { ...latest, ...edits, ...(relationEdited ? { kind: draft.kind, subtype: draft.subtype,
      generationGap: draft.generationGap !== previous.generationGap || draft.kind !== latest.kind ? draft.generationGap : latest.generationGap } : {}),
      ...(decision !== null ? { assertion: draft.assertion } : {}), evidence: draft.evidence };
    context.acknowledgeRead(currentMetadata, [nextDraft.subjectCharacterId, nextDraft.objectCharacterId].filter((id): id is string => !!id));
    setDraft(nextDraft);
    if (draft.objectCharacterId === previous.objectCharacterId) setObjectName(currentMetadata.objectCharacterName ?? '');
    if (decision === null && currentMetadata.assertion !== baseline.assertion) setJudgmentOpen(currentMetadata.assertion !== 'ASSERTED');
    setBaseline(currentMetadata);
    setError(null);
    setMessage('입력 중인 수정은 유지하고, 나머지는 최신 내용으로 맞췄어요.');
  }

  async function submit(action: 'save' | 'apply' | 'dismiss' | 'judgment') {
    if (submitting.current || locked) return;
    if ((action === 'judgment' || action === 'dismiss') ? !canSaveJudgment : !canSave) return;
    if (action === 'dismiss' && decision !== 'exclude') return;
    if (action === 'judgment' && decision !== 'family' && decision !== 'unknown') return;
    if (action === 'apply' && !canApply) return;
    submitting.current = true;
    const session = authSessionEpoch();
    let saved = false;
    setBusy(action); setError(null); setMessage(null);
    try {
      const path = { workId, candidateId: baseline.id! };
      let latest = baseline;
      if (action === 'dismiss') {
        const result = await dismissRelationshipCandidate({ path, body: { expectedVersion: latest.version! } });
        if (!result.data.data) throw new Error('Missing candidate');
        if (!await syncCandidateCache(result.data, session)) return;
        context.acceptWrite(result.data.data);
        setBaseline(result.data.data);
        onChanged(true);
        return;
      }
      if (action === 'judgment') {
        // A judgment never silently saves a selected profile or other relationship edits.
        // Only the user's explicit source selection accompanies the baseline assertion change.
        const result = await updateRelationshipCandidate({ path, body: {
          ...draftFrom(baseline), assertion: decision === 'family' ? 'ASSERTED' : 'UNCERTAIN',
          evidence: draft.evidence, expectedVersion: baseline.version!,
        } });
        if (!result.data.data) throw new Error('Missing candidate');
        if (!await syncCandidateCache(result.data, session)) return;
        latest = result.data.data;
        context.acceptWrite(latest);
        setBaseline(latest);
        const stored = draftFrom(latest);
        setDraft(previous => ({ ...previous, assertion: stored.assertion, evidence: stored.evidence }));
        setSourcePickerOpen(false);
        finishJudgment();
        setMessage(decision === 'family' ? '가족 관계로 판단을 저장했어요.' : '판단을 보류했어요. 가계도에는 표시하지 않아요.');
        onChanged(false);
        return;
      }
      // Retrying a failed confirmation must not save again.
      if (action === 'save' || dirty || reasons.length > 0) {
        const result = await updateRelationshipCandidate({ path, body: { ...draft, expectedVersion: latest.version! } });
        if (!result.data.data) throw new Error('Missing candidate');
        if (!await syncCandidateCache(result.data, session)) return;
        latest = result.data.data;
        context.acceptWrite(latest);
        saved = true;
        setBaseline(latest);
        setDraft(draftFrom(latest));
        setSourcePickerOpen(false);
        setObjectName(latest.objectCharacterName ?? objectName);
      }
      if (action === 'apply' && latest.objectCharacterId && readyToConfirm(latest)) {
        // The saved response owns the version and remaining blockers, not the pre-save draft.
        const result = await confirmRelationshipCandidate({ path, body: { expectedVersion: latest.version! } });
        if (!result.data.data) throw new Error('Missing candidate');
        if (!await syncCandidateCache(result.data, session)) return;
        context.acceptWrite(result.data.data);
        setBaseline(result.data.data);
        setDraft(draftFrom(result.data.data));
        onChanged(true);
      } else {
        setMessage(latest.displayableAsMention
          ? '수정한 내용을 저장했어요. 프로필 없이 가계도에 표시할 수 있어요. 인물 연결은 선택 사항이에요.'
          : readyToConfirm(latest) ? '수정한 내용을 저장했어요. 확인한 관계를 가계도에 반영할 수 있어요.'
            : '수정한 내용을 저장했어요. 아직 확인할 내용이 남아 있어요. 아래 안내를 확인해 주세요.');
        onChanged(false);
      }
    } catch (cause) {
      if (mounted.current && session === authSessionEpoch()) {
        const failure = relationshipError(cause, '요청을 완료하지 못했어요. 입력은 그대로 유지했어요. 다시 시도해 주세요.');
        setError(saved ? `내용은 저장했지만 ${linkIntent ? '프로필 연결을' : '관계 반영을'} 마치지 못했어요. ${failure}` : failure);
        if (toApiError(cause)?.status === 409) context.retry();
        if (saved) onChanged(false);
      }
    } finally {
      submitting.current = false;
      if (mounted.current && session === authSessionEpoch()) setBusy(null);
    }
  }

  function openJudgment() {
    setPickerOpen(false);
    setJudgmentOpen(true);
    setDecision(null);
    setMessage(null);
    requestAnimationFrame(() => judgment.current?.querySelector<HTMLButtonElement>('.review-cb-choice')?.focus({ preventScroll: true }));
  }

  function finishJudgment() {
    setDecision(null);
    setJudgmentOpen(false);
    requestAnimationFrame(() => judgment.current?.querySelector<HTMLButtonElement>('[data-judgment-change]')?.focus({ preventScroll: true }));
  }

  function cancelJudgment() {
    change('assertion', baseline.assertion!);
    finishJudgment();
  }

  function choose(value: string) {
    setPickerOpen(false);
    setDecision(value as Decision);
    change('assertion', value === 'family' ? 'ASSERTED' : value === 'unknown' ? 'UNCERTAIN' : baseline.assertion!);
  }

  return <section className="relationship-editor family-review-editor" aria-label="가족 관계 후보 검토" ref={editor} tabIndex={-1}>
    <div className="relationship-editor__heading">
      <ActionButton variant="ghost" size="compact" onClick={onClose} disabled={!!busy}><ArrowLeft size={16} aria-hidden="true" />{closeLabel}</ActionButton>
      <span className="relationship-badge">{!editable ? baseline.status === 'CONFIRMED' ? '반영 완료' : '제외됨'
        : currentMetadata.displayableAsMention ? '프로필 연결은 선택' : '관계 확인 필요'}</span>
    </div>
    <ReviewSettingHeading title={linkIntent ? `${baseline.objectMention || counterpartName}의 프로필 연결` : `${subjectName}의 가족 관계 확인`} />
    {baseline.mentionGroupId && <p className="relationship-notice">관계 내용·판단을 저장하거나 프로필을 연결하면 이 관계는 같은 인물 묶음에서 빠져요. 다른 관계와 근거는 유지돼요.</p>}
    <div ref={diagram}>
      <RelationshipPairPreview subjectName={subjectName} objectName={counterpartName} kind={draft.kind} subtype={draft.subtype}
        generationGap={draft.generationGap} temporalScope={draft.temporalScope} objectHasProfile={!!draft.objectCharacterId}
        objectSelectionChanged={draft.objectCharacterId !== baseline.objectCharacterId}
        changesPending={dirty || decision !== null} uncertain={draft.assertion !== 'ASSERTED' || decision === 'exclude'}
        disabled={locked || decision === 'exclude'}
        pickerOpen={pickerOpen} pickerId={pickerId} onPickObject={() => setPickerOpen(previous => !previous)} />
    </div>
    {editable && <section className="family-judgment" aria-label="가족 관계 판단" ref={judgment}>
      {judgmentOpen ? <>
        <ReviewChoiceCards label="두 사람은 실제 가족인가요?" disabled={locked} value={decision} onChange={choose}
          choices={[
            { id: 'family', title: '실제 가족이에요', description: '가족 관계로 판단해요. 프로필 연결은 따로 반영해요.' },
            { id: 'exclude', title: '가족이 아니에요', description: '이 관계 후보를 제외해요. 프로필과 원문은 유지해요.' },
            { id: 'unknown', title: '아직 모르겠어요', description: '확인·연결에 남겨 두고 가계도에는 표시하지 않아요.' },
          ]} />
        <div className="family-judgment__actions">
          <ActionButton variant="primary" disabled={!canSaveJudgment} icon={<Check size={16} aria-hidden="true" />}
            onClick={() => void submit(decision === 'exclude' ? 'dismiss' : 'judgment')}>
            {busy === 'judgment' || busy === 'dismiss' ? '저장 중…' : '판단 저장'}</ActionButton>
          <ActionButton variant="ghost" disabled={!!busy} onClick={cancelJudgment}>선택 취소</ActionButton>
        </div>
      </> : <div className="family-judgment__summary">
        <span>{baseline.assertion === 'ASSERTED' ? <Check size={17} aria-hidden="true" /> : <CircleHelp size={17} aria-hidden="true" />}{judgmentStatus}</span>
        <ActionButton variant="ghost" size="compact" data-judgment-change disabled={locked} onClick={openJudgment}>판단 변경</ActionButton>
      </div>}
    </section>}
    {editable && <RelationshipTargetPicker workId={workId} subjectId={draft.subjectCharacterId} selectedId={draft.objectCharacterId ?? ''}
      mention={draft.objectMention || counterpartName} disabled={locked} open={pickerOpen && decision !== 'exclude'}
      id={pickerId} onClose={closePicker} onSelect={(id, name) => {
        change('objectCharacterId', id || undefined); setObjectName(name); closePicker();
      }} />}
    <div className="family-review-source-caption" aria-label="판단할 가족 설정">
      {evidence.filter(source => source.current && source.currentValue != null).map(source =>
        <div key={`${source.sourceFactId}-${source.sourceToken}-${source.candidateId}`}>
          <span>{source.characterId === baseline.subjectCharacterId ? subjectName
            : source.characterId === baseline.objectCharacterId && baseline.objectCharacterName ? baseline.objectCharacterName : '인물'}의 설정</span>
          <RelationshipCurrentSetting value={source.currentValue} />
        </div>)}
      {!evidence.some(source => source.current && source.currentValue != null) && <p className="relationship-notice">
        현재 가족 설정을 확인할 수 없어요. 아래에서 사용할 근거를 확인해 주세요.</p>}
    </div>
    {editable && !judgmentOpen && currentMetadata.displayableAsMention && !draft.objectCharacterId && <p className="family-review-optional-note">프로필 없이도 가계도에 표시할 수 있어요.</p>}
    {!editable && <p className="relationship-notice" role="status">이미 {baseline.status === 'CONFIRMED' ? '반영된' : '제외된'} 후보예요. 목록에서 다른 후보를 확인해 주세요.</p>}
    {context.pending && <p className="family-context-status" role="status">최신 관계와 근거를 확인하고 있어요.</p>}
    {context.error && <div className="relationship-notice relationship-notice--error family-context-error" role="alert">
      <p>{context.error}</p><ActionButton type="button" variant="secondary" disabled={!!busy} onClick={context.retry}>다시 시도</ActionButton>
    </div>}
    {stale && <section className="family-context-changes" aria-label="최신 관계 변경 내용">
      <h4>다른 곳에서 관계가 바뀌었어요.</h4>
      <dl>
        <div><dt>상태</dt><dd>{currentMetadata.status === 'CONFIRMED' ? '반영 완료' : currentMetadata.status === 'DISMISSED' ? '제외됨' : '확인 중'}</dd></div>
        <div><dt>상대 인물</dt><dd>{currentMetadata.objectCharacterName || currentMetadata.objectMention || '상대 미연결'}</dd></div>
        <div><dt>관계</dt><dd>{currentMetadata.kind && KIND_LABELS[currentMetadata.kind]}{currentMetadata.subtype && currentMetadata.subtype !== 'UNSPECIFIED' && ` (${SUBTYPE_LABELS[currentMetadata.subtype]})`}</dd></div>
        {isDistantAncestry(currentMetadata.kind) && <div><dt>세대 차이</dt><dd>{generationLabel(currentMetadata.generationGap)}</dd></div>}
        <div><dt>가족 판단</dt><dd>{currentMetadata.assertion && ASSERTION_LABELS[currentMetadata.assertion]}</dd></div>
        <div><dt>관계 시점</dt><dd>{currentMetadata.temporalScope && TIME_LABELS[currentMetadata.temporalScope]}{currentMetadata.timeLabel && ` (${currentMetadata.timeLabel})`}</dd></div>
      </dl>
      <p>입력 중인 수정은 유지해요. 변경 내용을 확인하면 나머지는 최신 내용으로 맞춰요.</p>
      <ActionButton type="button" variant="secondary" disabled={!!busy || context.pending || !context.latest} onClick={acknowledgeChanges}>변경 내용 확인</ActionButton>
    </section>}
    {editable && <form onSubmit={event => { event.preventDefault(); void submit('apply'); }}>
      {draft.assertion === 'ASSERTED' && baseline.temporalScope === 'UNKNOWN' &&
        <div className="relationship-form-grid"><label>관계 시점<select value={draft.temporalScope} disabled={locked}
          onChange={event => change('temporalScope', event.target.value as RelationshipTime)}>
          {Object.entries(TIME_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select></label></div>}
      {visibleReasons.length > 0 && <ul className="relationship-reasons" aria-label="확인이 필요한 이유">{visibleReasons.map(reason => <li key={reason}>{reviewMessage(reason)}</li>)}</ul>}
      {draft.objectCharacterId && (baseline.assertion === 'ASSERTED' || draft.assertion === 'ASSERTED') &&
        <div className="relationship-editor__actions family-review-primary">
          <ActionButton type="submit" variant="primary" disabled={!canApply} icon={<Check size={16} aria-hidden="true" />}>
            {busy === 'apply' ? '반영 중…' : mainLabel}</ActionButton>
          {judgmentUnsaved && <span className="family-judgment__save-hint">판단을 저장하거나 선택을 취소한 뒤 반영할 수 있어요.</span>}
        </div>}
      {error && <div className="relationship-notice relationship-notice--error" role="alert"><p>{error}</p><p>입력을 유지했어요.</p></div>}
      {message && <p className="relationship-notice" role="status">{message}</p>}
      {draft.evidence.length > 20 && <p className="relationship-notice relationship-notice--error" role="alert">근거는 20개까지 선택할 수 있어요.</p>}
      <details className="family-review-details" open={detailsOpen} onToggle={event => setDetailsOpen(event.currentTarget.open)}>
        <summary>관계 내용 수정</summary>
        <div className="family-edit-fields">
          <label className="family-edit-question">
            <span id={relationshipQuestionId}><strong>{counterpartName}</strong><span>{subjectName}에게 어떤 가족인가요?</span></span>
            <select aria-label="관계" aria-describedby={relationshipQuestionId} value={draft.kind} disabled={locked} onChange={event => {
              const kind = event.target.value as RelationshipKind;
              setDraft(previous => ({ ...previous, kind, subtype: allowedSubtypes(kind).includes(previous.subtype) ? previous.subtype : 'UNSPECIFIED',
                generationGap: isDistantAncestry(kind) ? previous.generationGap : undefined }));
              setMessage(null);
            }}>{Object.entries(COUNTERPART_ROLES).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
          </label>
          {isDistantAncestry(draft.kind) && <fieldset className="family-edit-group" disabled={locked}>
            <legend>조상과 후손의 세대 차이</legend>
            <label className="family-edit-field"><span>몇 대손인가요? <small>선택</small></span>
              <input aria-label="대손 수" aria-describedby={generationHintId} type="number" inputMode="numeric"
                min={1} max={2147483647} step={1} value={draft.generationGap ?? ''} aria-invalid={!validGeneration}
                onChange={event => change('generationGap', event.target.value === '' ? undefined : Number(event.target.value))}
                placeholder="예: 5" />
            </label>
            <p className="relationship-muted" id={generationHintId}>원문에 나온 대손 수만 입력해 주세요. 알 수 없으면 비워 두세요.</p>
            {!validGeneration && <p className="relationship-notice relationship-notice--error" role="alert">대손 수는 1 이상의 정수로 입력해 주세요.</p>}
          </fieldset>}
          <label className="family-edit-field family-edit-field--mention"><span>원문에 나온 이름</span>
            <input aria-label="원문 속 상대 이름·호칭" value={draft.objectMention ?? ''} disabled={locked} maxLength={200}
              onChange={event => change('objectMention', event.target.value || undefined)} placeholder="예: 아버지, 수연" />
          </label>
          <fieldset className="family-edit-group" disabled={locked}>
            <legend>가족의 세부 관계</legend>
            <label className="family-edit-field"><span>관계 구분</span>
              <select aria-label="세부 관계" value={draft.subtype} onChange={event => change('subtype', event.target.value as RelationshipSubtype)}>
                {allowedSubtypes(draft.kind).map(value => <option key={value} value={value}>{value === 'UNSPECIFIED' ? '알 수 없음' : SUBTYPE_LABELS[value]}</option>)}
              </select>
            </label>
          </fieldset>
          <fieldset className="family-edit-group" disabled={locked}>
            <legend>관계 시점</legend>
            {baseline.temporalScope !== 'UNKNOWN' && <label className="family-edit-field"><span>언제의 관계인가요?</span>
              <select aria-label="관계 시점" value={draft.temporalScope} onChange={event => change('temporalScope', event.target.value as RelationshipTime)}>
                {Object.entries(TIME_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </label>}
            <label className="family-edit-field"><span>시점 메모 <small>선택</small></span>
              <input aria-label="시점 설명" value={draft.timeLabel ?? ''} maxLength={200}
                onChange={event => change('timeLabel', event.target.value || undefined)} placeholder="예: 혼인 전, 10년 전" />
            </label>
          </fieldset>
          <div className="family-edit-save">
            <ActionButton variant="primary" disabled={!canSave || (!dirty && reasons.length === 0)} icon={<Save size={16} aria-hidden="true" />}
              onClick={() => void submit('save')}>{busy === 'save' ? '저장 중…' : '변경사항 저장'}</ActionButton>
          </div>
        </div>
      </details>
      {sources !== null && (needsSourceSelection || sourcePickerOpen) && <fieldset className="relationship-source-picker" disabled={locked}>
        <legend>현재 설정 중 사용할 근거</legend>
        <p className="relationship-muted">{needsSourceSelection ? '바탕이 된 설정이 바뀌었거나 근거가 없어요. 사용할 현재 설정을 선택해 주세요.' : '이 관계에 사용할 현재 설정을 선택해 주세요.'}</p>
        {judgmentOpen && decision !== 'exclude' && !judgmentSourcesValid && draft.objectCharacterId !== baseline.objectCharacterId &&
          <p className="relationship-muted">판단 저장에는 현재 저장된 인물의 근거를 사용해요. 선택 중인 프로필은 별도로 반영해요.</p>}
        {sources.length === 0 && <p>이 인물들의 현재 프로필에 사용할 수 있는 설정이 없어요. 캐릭터 설정을 먼저 확인해 주세요.</p>}
        {sources.map(source => <label className="relationship-source-choice" key={`${source.factId}-${source.contextToken}`}>
          <input type="checkbox" checked={draft.evidence.some(item => item.sourceFactId === source.factId && item.sourceToken === source.contextToken)}
            onChange={event => {
              setSourcePickerOpen(true);
              const remaining = draft.evidence.filter(item => item.sourceFactId !== source.factId);
              change('evidence', event.target.checked && source.factId && source.contextToken
                ? [...remaining, { sourceFactId: source.factId, sourceToken: source.contextToken }] : remaining);
            }} />
          <div><strong>{source.characterId ? sourceNames[source.characterId] || '인물' : '인물'} · 현재 프로필</strong>
            <RelationshipCurrentSetting value={source.currentValue} /></div>
        </label>)}
        {draft.evidence.filter(item => !sources.some(source => source.factId === item.sourceFactId && source.contextToken === item.sourceToken))
          .map(item => <div key={item.sourceFactId} className="relationship-obsolete-source">
            <span>현재 설정과 일치하지 않는 기존 근거가 선택되어 있어요.</span>
            <ActionButton type="button" size="compact" variant="ghost" disabled={locked}
              onClick={() => {
                setSourcePickerOpen(true);
                change('evidence', draft.evidence.filter(source => source.sourceFactId !== item.sourceFactId));
              }}>기존 근거 제거</ActionButton>
          </div>)}
      </fieldset>}
    </form>}
    <RelationshipEvidenceDisclosure workId={workId} evidence={evidence} onOpen={onOpenEvidence}
      summary={sourceCount ? `원문 근거 ${sourceCount}개 보기` : '설정 근거 자세히 보기'}
      characterNames={{
        ...(baseline.subjectCharacterId ? { [baseline.subjectCharacterId]: subjectName } : {}),
        ...(baseline.objectCharacterId && baseline.objectCharacterName ? { [baseline.objectCharacterId]: baseline.objectCharacterName } : {}),
      }} />
  </section>;
}
