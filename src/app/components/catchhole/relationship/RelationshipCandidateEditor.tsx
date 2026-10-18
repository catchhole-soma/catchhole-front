import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, Check, RefreshCw, Save, X } from 'lucide-react';
import {
  confirmRelationshipCandidate, dismissRelationshipCandidate, getRelationshipCandidate,
  getRelationshipSources, updateRelationshipCandidate,
} from '../../../api/generated/sdk.gen';
import type {
  RelationshipCandidateResponse, RelationshipCandidateUpdateRequest, RelationshipSourceResponse,
} from '../../../api/generated/types.gen';
import { privateImageSessionEpoch as authSessionEpoch } from '../../../lib/private-image-session';
import { ActionButton } from '../ui-v2/ActionButton';
import { RelationshipCurrentSetting, RelationshipEvidence } from './RelationshipEvidence';
import { RelationshipTargetPicker } from './RelationshipTargetPicker';
import {
  allowedSubtypes, ASSERTION_LABELS, KIND_LABELS, relationshipError, reviewMessage,
  SUBTYPE_LABELS, TIME_LABELS, type RelationshipAssertion, type RelationshipKind,
  type RelationshipSubtype, type RelationshipTime,
} from './relationship-presentation';

type Draft = Omit<RelationshipCandidateUpdateRequest, 'expectedVersion'>;
function draftFrom(candidate: RelationshipCandidateResponse): Draft {
  return {
    subjectCharacterId: candidate.subjectCharacterId!, objectCharacterId: candidate.objectCharacterId || undefined,
    objectMention: candidate.objectMention || undefined, kind: candidate.kind!, subtype: candidate.subtype!,
    temporalScope: candidate.temporalScope!, timeLabel: candidate.timeLabel || undefined, assertion: candidate.assertion!,
    evidence: (candidate.evidence ?? []).filter(source => source.sourceFactId && source.sourceToken)
      .map(source => ({ sourceFactId: source.sourceFactId!, sourceToken: source.sourceToken! })),
  };
}

export function RelationshipCandidateEditor({ workId, candidate, onClose, onChanged, onOpenEvidence }: {
  workId: string; candidate: RelationshipCandidateResponse; onClose: () => void;
  onChanged: (decided: boolean) => void; onOpenEvidence: (factId: string) => void;
}) {
  const [baseline, setBaseline] = useState(candidate);
  const [draft, setDraft] = useState(() => draftFrom(candidate));
  const [objectName, setObjectName] = useState(candidate.objectCharacterName ?? '');
  const [sources, setSources] = useState<RelationshipSourceResponse[] | null>(null);
  const [busy, setBusy] = useState<'save' | 'confirm' | 'dismiss' | 'refresh' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const dirty = JSON.stringify(draft) !== JSON.stringify(draftFrom(baseline));
  const stale = candidate.version !== baseline.version || candidate.status !== baseline.status;
  const editable = baseline.status === 'PENDING';
  const locked = !!busy || !editable || stale;
  const currentMetadata = !stale ? candidate : baseline;
  const reasons = currentMetadata.reviewReasons ?? [];
  const canConfirm = editable && !stale && !dirty && reasons.length === 0 && !!draft.objectCharacterId
    && draft.assertion === 'ASSERTED' && draft.temporalScope !== 'UNKNOWN' && draft.evidence.length > 0 && draft.evidence.length <= 20;

  function change<K extends keyof Draft>(key: K, value: Draft[K]) {
    setDraft(previous => ({ ...previous, [key]: value }));
    setMessage(null);
  }

  async function refreshContext() {
    const session = authSessionEpoch();
    setBusy('refresh'); setError(null); setMessage(null);
    try {
      const latest = await getRelationshipCandidate({ path: { workId, candidateId: baseline.id! } });
      if (!latest.data.data) throw new Error('Missing candidate');
      if (!mounted.current || session !== authSessionEpoch()) return;
      setBaseline(latest.data.data);
      onChanged(false);
      const ids = [...new Set([draft.subjectCharacterId, draft.objectCharacterId].filter((id): id is string => !!id))];
      const results = await Promise.allSettled(ids.map(characterId => getRelationshipSources({ path: { workId }, query: { characterId } })));
      if (!mounted.current || session !== authSessionEpoch()) return;
      setSources(results.flatMap(result => result.status === 'fulfilled' ? result.value.data.data ?? [] : []));
      const failures = results.filter(result => result.status === 'rejected');
      if (failures.length) setError('일부 인물의 현재 프로필을 불러오지 못했어요. 인물이 보관되었다면 상대를 다시 선택하거나 후보를 제외해 주세요. 기존 근거 선택은 유지했어요.');
      setMessage('최신 검토 상태를 불러왔어요. 입력은 유지했어요. 아래 현재 설정을 읽고 사용할 근거를 선택해 주세요.');
    } catch (cause) {
      if (mounted.current && session === authSessionEpoch()) setError(relationshipError(cause, '현재 설정을 불러오지 못했어요. 입력은 그대로 유지했어요. 다시 시도해 주세요.'));
    } finally { if (mounted.current && session === authSessionEpoch()) setBusy(null); }
  }

  async function submit(action: 'save' | 'confirm' | 'dismiss') {
    const session = authSessionEpoch();
    setBusy(action); setError(null); setMessage(null);
    try {
      const path = { workId, candidateId: baseline.id! };
      const expectedVersion = baseline.version!;
      const result = action === 'save'
        ? await updateRelationshipCandidate({ path, body: { ...draft, expectedVersion } })
        : action === 'confirm'
          ? await confirmRelationshipCandidate({ path, body: { expectedVersion } })
          : await dismissRelationshipCandidate({ path, body: { expectedVersion } });
      if (!result.data.data) throw new Error('Missing candidate');
      if (!mounted.current || session !== authSessionEpoch()) return;
      setBaseline(result.data.data);
      setDraft(draftFrom(result.data.data));
      setObjectName(result.data.data.objectCharacterName ?? objectName);
      setMessage(action === 'save' ? '수정한 내용을 저장했어요. 관계와 근거를 확인한 뒤 반영해 주세요.' : null);
      onChanged(action !== 'save');
    } catch (cause) {
      if (mounted.current && session === authSessionEpoch()) setError(relationshipError(cause, '요청을 완료하지 못했어요. 입력은 그대로 유지했어요. 다시 시도해 주세요.'));
    } finally { if (mounted.current && session === authSessionEpoch()) setBusy(null); }
  }

  return <section className="relationship-editor" aria-label="가족 관계 후보 검토">
    <div className="relationship-editor__heading">
      <ActionButton variant="ghost" size="compact" icon={<ArrowLeft size={16} aria-hidden="true" />} onClick={onClose} disabled={!!busy}>후보 목록</ActionButton>
      <span className="relationship-badge">{baseline.origin === 'CURRENT_SETTING_RULE' ? '현재 설정에서 찾은 관계' : '직접 등록한 관계'}</span>
    </div>
    <h3>{baseline.subjectCharacterName || '주체 인물'}의 가족 관계 확인</h3>
    <p className="relationship-muted">상대와 관계가 명확한지 확인해 주세요. 저장한 뒤 관계에 반영하거나 후보에서 제외할 수 있어요.</p>
    {!editable && <p className="relationship-notice" role="status">이미 {baseline.status === 'CONFIRMED' ? '반영된' : '제외된'} 후보예요. 목록에서 다른 후보를 확인해 주세요.</p>}
    {stale && <p className="relationship-notice" role="alert">다른 곳에서 이 후보가 변경되었어요. 입력은 유지했어요. 현재 설정을 다시 확인한 뒤 저장해 주세요.</p>}
    {reasons.length > 0 && <ul className="relationship-reasons" aria-label="확인이 필요한 이유">{reasons.map(reason => <li key={reason}>{reviewMessage(reason)}</li>)}</ul>}
    <form onSubmit={event => { event.preventDefault(); void submit('save'); }}>
      <RelationshipTargetPicker workId={workId} subjectId={draft.subjectCharacterId} selectedId={draft.objectCharacterId ?? ''}
        selectedName={objectName} disabled={locked} onSelect={(id, name) => {
          change('objectCharacterId', id || undefined); setObjectName(name); setSources(null);
        }} />
      <div className="relationship-form-grid">
        <label>원문 속 상대 이름·호칭<input value={draft.objectMention ?? ''} disabled={locked} maxLength={200}
          onChange={event => change('objectMention', event.target.value || undefined)} placeholder="예: 아버지, 수연" /></label>
        <label>관계<select value={draft.kind} disabled={locked} onChange={event => {
          const kind = event.target.value as RelationshipKind;
          setDraft(previous => ({ ...previous, kind, subtype: allowedSubtypes(kind).includes(previous.subtype) ? previous.subtype : 'UNSPECIFIED' }));
          setMessage(null);
        }}>{Object.entries(KIND_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        <label>세부 관계<select value={draft.subtype} disabled={locked} onChange={event => change('subtype', event.target.value as RelationshipSubtype)}>
          {allowedSubtypes(draft.kind).map(value => <option key={value} value={value}>{SUBTYPE_LABELS[value]}</option>)}
        </select></label>
        <label>서술의 의미<select value={draft.assertion} disabled={locked} onChange={event => change('assertion', event.target.value as RelationshipAssertion)}>
          {Object.entries(ASSERTION_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select></label>
        <label>관계 시점<select value={draft.temporalScope} disabled={locked} onChange={event => change('temporalScope', event.target.value as RelationshipTime)}>
          {Object.entries(TIME_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select></label>
        <label>시점 설명<input value={draft.timeLabel ?? ''} disabled={locked} maxLength={200}
          onChange={event => change('timeLabel', event.target.value || undefined)} placeholder="예: 혼인 전, 10년 전" /></label>
      </div>
      <h4>바탕이 된 설정</h4>
      <RelationshipEvidence evidence={currentMetadata.evidence ?? []} onOpen={onOpenEvidence} />
      <ActionButton type="button" variant="secondary" size="compact" disabled={!!busy} icon={<RefreshCw size={15} aria-hidden="true" />}
        onClick={() => void refreshContext()}>{busy === 'refresh' ? '현재 설정 확인 중…' : '현재 설정 다시 확인'}</ActionButton>
      {sources !== null && <fieldset className="relationship-source-picker" disabled={locked}>
        <legend>현재 설정 중 사용할 근거</legend>
        <p>최신 저장 내용: {baseline.kind && KIND_LABELS[baseline.kind]} · {baseline.objectCharacterName || baseline.objectMention || '상대 미연결'} · {baseline.assertion && ASSERTION_LABELS[baseline.assertion]} · {baseline.temporalScope && TIME_LABELS[baseline.temporalScope]}</p>
        <p className="relationship-muted">설정이 바뀌었다면 내용을 읽고 근거를 20개 이내로 다시 선택해 주세요. 선택한 현재 설정으로 해당 근거를 바꿔 저장해요.</p>
        {sources.length === 0 && <p>이 인물들의 현재 프로필에 사용할 수 있는 설정이 없어요. 캐릭터 설정을 먼저 확인해 주세요.</p>}
        {sources.map(source => <label className="relationship-source-choice" key={`${source.factId}-${source.contextToken}`}>
          <input type="checkbox" checked={draft.evidence.some(item => item.sourceFactId === source.factId && item.sourceToken === source.contextToken)}
            onChange={event => {
              const remaining = draft.evidence.filter(item => item.sourceFactId !== source.factId);
              change('evidence', event.target.checked && source.factId && source.contextToken
                ? [...remaining, { sourceFactId: source.factId, sourceToken: source.contextToken }] : remaining);
            }} />
          <div><strong>{source.characterId === draft.subjectCharacterId ? baseline.subjectCharacterName : objectName} · 현재 프로필</strong>
            <RelationshipCurrentSetting value={source.currentValue} /></div>
        </label>)}
        {draft.evidence.filter(item => !sources.some(source => source.factId === item.sourceFactId && source.contextToken === item.sourceToken))
          .map(item => <div key={item.sourceFactId} className="relationship-obsolete-source">
            <span>현재 설정과 일치하지 않는 기존 근거가 선택되어 있어요.</span>
            <ActionButton type="button" size="compact" variant="ghost" disabled={locked}
              onClick={() => change('evidence', draft.evidence.filter(source => source.sourceFactId !== item.sourceFactId))}>기존 근거 제거</ActionButton>
          </div>)}
      </fieldset>}
      {error && <div className="relationship-notice relationship-notice--error" role="alert"><p>{error}</p><p>입력을 유지했어요. 다시 시도하거나 현재 설정을 확인해 주세요.</p></div>}
      {message && <p className="relationship-notice" role="status">{message}</p>}
      {draft.evidence.length > 20 && <p className="relationship-notice relationship-notice--error" role="alert">근거는 20개까지 선택할 수 있어요.</p>}
      {!dirty && editable && reasons.length > 0 && <p className="relationship-muted">현재 표시된 내용이 맞다면 검토 내용을 저장해 다시 확인할 수 있어요. 실제 관계 유효성은 반영할 때 다시 검사해요.</p>}
      {dirty && <p className="relationship-muted">수정한 내용을 먼저 저장해야 관계에 반영할 수 있어요.</p>}
      <div className="relationship-editor__actions">
        <ActionButton type="submit" variant="secondary" disabled={locked || (!dirty && reasons.length === 0) || draft.evidence.length === 0 || draft.evidence.length > 20} icon={<Save size={16} aria-hidden="true" />}>
          {busy === 'save' ? '저장 중…' : !dirty && reasons.length > 0 ? '검토 내용 저장' : '수정 저장'}</ActionButton>
        <ActionButton type="button" variant="primary" disabled={!!busy || !canConfirm} icon={<Check size={16} aria-hidden="true" />}
          onClick={() => void submit('confirm')}>{busy === 'confirm' ? '반영 중…' : '관계에 반영'}</ActionButton>
        <ActionButton type="button" variant="ghost" disabled={locked} icon={<X size={16} aria-hidden="true" />}
          onClick={() => void submit('dismiss')}>{busy === 'dismiss' ? '제외 중…' : '후보 제외'}</ActionButton>
      </div>
    </form>
  </section>;
}
