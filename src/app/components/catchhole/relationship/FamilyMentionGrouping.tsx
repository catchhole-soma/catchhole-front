import { useEffect, useRef, useState } from 'react';
import { useQueries, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link2, Unlink } from 'lucide-react';
import {
  getRelationshipCandidateOptions, getRelationshipCandidateQueryKey, getRelationshipCandidatesOptions,
  getRelationshipMentionGroupOptions, getRelationshipMentionGroupQueryKey,
} from '../../../api/generated/@tanstack/react-query.gen';
import { createRelationshipMentionGroup, getRelationshipCandidate, ungroupRelationshipMentions } from '../../../api/generated/sdk.gen';
import type { RelationshipCandidateResponse } from '../../../api/generated/types.gen';
import { privateImageSessionEpoch as authSessionEpoch } from '../../../lib/private-image-session';
import { toApiError } from '../../../lib/api-errors';
import { ActionButton } from '../ui-v2/ActionButton';
import { PageNavigation } from '../PageNavigation';
import { RelationshipCurrentSetting, RelationshipEvidenceDisclosure, RelationshipQueryError } from './RelationshipEvidence';
import { COUNTERPART_ROLES, generationLabel, isDistantAncestry, relationshipError, reviewMessage, TIME_LABELS } from './relationship-presentation';
import '../../../../styles/family-mention-group.css';

type Props = {
  workId: string;
  candidate: RelationshipCandidateResponse;
  onChanged: (decided: boolean) => void;
  onOpenEvidence: (factId: string) => void;
  onSelectCandidate: (candidateId: string) => void;
};

function mentionName(candidate: RelationshipCandidateResponse) {
  return candidate.objectCharacterName || candidate.objectMention || '이름 미상';
}

function relationLabel(candidate: RelationshipCandidateResponse) {
  return `${candidate.subjectCharacterName || '인물'}의 ${candidate.kind ? COUNTERPART_ROLES[candidate.kind] : '가족'}`;
}

function eligible(candidate: RelationshipCandidateResponse) {
  return !!candidate.id && candidate.version != null && candidate.status === 'PENDING' && candidate.displayableAsMention === true && !candidate.objectCharacterId && !candidate.mentionGroupId;
}

function signature(candidate: RelationshipCandidateResponse) {
  return JSON.stringify([candidate.id, candidate.version, candidate.status, candidate.mentionGroupId,
    candidate.displayableAsMention, candidate.evidence?.map(source => [source.sourceFactId, source.sourceToken, source.current])]);
}

export function FamilyMentionGrouping({ workId, candidate, onChanged, onOpenEvidence, onSelectCandidate }: Props) {
  const client = useQueryClient();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const trigger = useRef<HTMLDivElement>(null);
  const mounted = useRef(true);
  const submission = useRef(false);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const groupId = candidate.mentionGroupId ?? '';
  const group = useQuery({ ...getRelationshipMentionGroupOptions({ path: { workId, groupId } }),
    enabled: !!groupId, refetchOnWindowFocus: true, refetchInterval: groupId ? 5000 : false });
  const members = useQueries({ queries: (group.data?.data?.candidateIds ?? []).map(candidateId => ({
    ...getRelationshipCandidateOptions({ path: { workId, candidateId } }), enabled: !!groupId && !group.isError,
    refetchOnWindowFocus: true, staleTime: 0,
  })) });
  const data = group.data?.data;

  function close() {
    setOpen(false);
    requestAnimationFrame(() => trigger.current?.querySelector('button')?.focus({ preventScroll: true }));
  }

  async function ungroup() {
    if (busy || submission.current || !data?.id || data.version == null || !data.active || group.isError) return;
    submission.current = true;
    const session = authSessionEpoch();
    setBusy(true); setFailure(null); setMessage(null);
    try {
      const result = await ungroupRelationshipMentions({ path: { workId, groupId: data.id }, body: { expectedVersion: data.version } });
      if (!mounted.current || session !== authSessionEpoch()) return;
      client.setQueryData(getRelationshipMentionGroupQueryKey({ path: { workId, groupId: data.id } }), result.data);
      for (const candidateId of data.candidateIds ?? []) {
        void client.invalidateQueries({ queryKey: getRelationshipCandidateQueryKey({ path: { workId, candidateId } }) });
      }
      setMessage('묶음을 해제했어요. 각 설정의 인물을 따로 표시해요.');
      onChanged(false);
    } catch (cause) {
      if (!mounted.current || session !== authSessionEpoch()) return;
      setFailure(relationshipError(cause, '묶음을 해제하지 못했어요. 다시 시도해 주세요.'));
      void group.refetch();
    } finally { submission.current = false; if (mounted.current && session === authSessionEpoch()) setBusy(false); }
  }

  if (!groupId && !eligible(candidate) && !open) return null;
  return <section className="family-mention-group" aria-label="같은 인물 묶음">
    {groupId ? <>
      {group.isPending && <p role="status">묶인 인물의 관계를 불러오고 있어요.</p>}
      {group.isError && <RelationshipQueryError title="묶인 인물의 관계를 불러오지 못했어요." onRetry={() => void group.refetch()} pending={group.isFetching} />}
      {data && !group.isError && <div>
        <div className="family-mention-group__heading">
          <div><h4>{data.name || mentionName(candidate)}의 관계 {data.candidateIds?.length ?? 0}개</h4>
            <p>{data.active ? '관계를 선택하면 근거가 열려요.' : '이미 해제된 묶음이에요.'}</p></div>
          {data.active && <ActionButton variant="secondary" disabled={busy} icon={<Unlink size={16} aria-hidden="true" />}
            onClick={() => void ungroup()}>{busy ? '해제 중…' : '묶기 해제'}</ActionButton>}
        </div>
        {data.reviewReasons?.some(reason => reason === 'ANCESTRY_CYCLE' || reason === 'GENERATION_GAP_CONFLICT') &&
          <p className="relationship-notice">묶인 관계가 현재 설정과 맞지 않아 가계도에서 숨겨졌어요. 근거를 확인하거나 묶기를 해제해 주세요.</p>}
        {(data.reviewReasons ?? []).map(reason => <p key={reason} className="relationship-notice">{reviewMessage(reason)}</p>)}
        <div className="family-mention-group__members">
          {members.map((member, index) => member.isError ? <RelationshipQueryError key={data.candidateIds?.[index]}
            title="관계 근거를 불러오지 못했어요." onRetry={() => void member.refetch()} pending={member.isFetching} />
            : member.data?.data ? <button type="button" key={member.data.data.id} disabled={busy}
              aria-pressed={member.data.data.id === candidate.id}
              onClick={() => { if (member.data.data?.id) onSelectCandidate(member.data.data.id); }}>
              <strong>{relationLabel(member.data.data)} {mentionName(member.data.data)}</strong>
              <span>{isDistantAncestry(member.data.data.kind) && `${generationLabel(member.data.data.generationGap)} · `}
                {member.data.data.displayableAsMention ? '설정 근거 보기' : '현재 가계도에서 숨겨짐 · 근거 보기'}</span>
            </button> : <p role="status" key={data.candidateIds?.[index]}>관계를 불러오고 있어요.</p>)}
        </div>
        {data.active && <p className="relationship-muted">묶기 해제는 모든 관계를 따로 표시해요. 관계 내용·판단을 저장하거나 프로필을 연결하면 해당 관계만 묶음에서 빠져요.</p>}
      </div>}
    </> : !open && <div className="family-mention-group__heading" ref={trigger}>
      <div><h4>다른 설정에도 같은 인물이 있나요?</h4><p>프로필 없이 여러 가족 관계를 한 인물로 모아 볼 수 있어요.</p></div>
      <ActionButton variant="secondary" icon={<Link2 size={16} aria-hidden="true" />}
        onClick={() => { setOpen(true); setMessage(null); }}>같은 인물로 묶기</ActionButton>
    </div>}
    {open && <MentionGroupPicker workId={workId} candidate={candidate} onOpenEvidence={onOpenEvidence}
      onClose={close} onSaved={(ids, active) => {
        for (const candidateId of ids) {
          void client.invalidateQueries({ queryKey: getRelationshipCandidateQueryKey({ path: { workId, candidateId } }) });
        }
        setOpen(false); setMessage(active ? '같은 인물로 묶었어요.' : '이 요청으로 만든 묶음은 이미 해제되었어요.');
        onChanged(false);
      }} />}
    {failure && <p className="relationship-notice relationship-notice--error" role="alert">{failure}</p>}
    {message && <p className="relationship-notice" role="status">{message}</p>}
  </section>;
}

function MentionGroupPicker({ workId, candidate, onOpenEvidence, onClose, onSaved }: {
  workId: string; candidate: RelationshipCandidateResponse; onOpenEvidence: (factId: string) => void;
  onClose: () => void; onSaved: (ids: string[], active: boolean) => void;
}) {
  const client = useQueryClient();
  const [page, setPage] = useState(0);
  const [name, setName] = useState(mentionName(candidate));
  const [selected, setSelected] = useState<RelationshipCandidateResponse[]>([candidate]);
  const [pending, setPending] = useState<string[]>([candidate.id!]);
  const [saving, setSaving] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const [needsRefresh, setNeedsRefresh] = useState(false);
  const mounted = useRef(true);
  const submission = useRef(false);
  const request = useRef<{ signature: string; id: string } | null>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const choices = useQuery({ ...getRelationshipCandidatesOptions({ path: { workId }, query: { status: 'PENDING', page, size: 20 } }),
    refetchOnWindowFocus: true });
  const base = selected.find(item => item.id === candidate.id);
  const baseChanged = !!base && signature(base) !== signature(candidate);
  const invalid = selected.some(item => !eligible(item));
  const locked = saving || pending.length > 0;
  const canSave = !locked && !baseChanged && !needsRefresh && !invalid && selected.length >= 2 && selected.length <= 20
    && name.trim().length > 0 && name.trim().length <= 200;

  useEffect(() => {
    mounted.current = true;
    heading.current?.focus({ preventScroll: true });
    const session = authSessionEpoch();
    void getRelationshipCandidate({ path: { workId, candidateId: candidate.id! } }).then(result => {
      if (!mounted.current || session !== authSessionEpoch()) return;
      if (!result.data.data) throw new Error('Missing candidate');
      client.setQueryData(getRelationshipCandidateQueryKey({ path: { workId, candidateId: candidate.id! } }), result.data);
      setSelected([result.data.data]);
    }).catch(cause => {
      if (mounted.current && session === authSessionEpoch()) {
        setFailure(relationshipError(cause, '현재 관계를 확인하지 못했어요. 근거를 다시 확인해 주세요.')); setNeedsRefresh(true);
      }
    }).finally(() => { if (mounted.current && session === authSessionEpoch()) setPending([]); });
    return () => { mounted.current = false; };
  }, [client, workId, candidate.id]);

  async function select(item: RelationshipCandidateResponse, checked: boolean) {
    if (!item.id || locked) return;
    if (!checked) { setSelected(previous => previous.filter(value => value.id !== item.id)); return; }
    if (selected.length >= 20) return;
    const session = authSessionEpoch();
    setSelected(previous => [...previous.filter(value => value.id !== item.id), item]);
    setPending([item.id]); setFailure(null);
    try {
      const result = await getRelationshipCandidate({ path: { workId, candidateId: item.id } });
      if (!mounted.current || session !== authSessionEpoch()) return;
      if (!result.data.data) throw new Error('Missing candidate');
      setSelected(previous => [...previous.filter(value => value.id !== item.id), result.data.data!]);
    } catch (cause) {
      if (mounted.current && session === authSessionEpoch()) {
        setFailure(relationshipError(cause, '선택한 관계를 확인하지 못했어요. 근거를 다시 확인해 주세요.'));
        setNeedsRefresh(true);
      }
    } finally { if (mounted.current && session === authSessionEpoch()) setPending([]); }
  }

  async function refreshSelection() {
    if (locked) return;
    const session = authSessionEpoch();
    setPending(selected.flatMap(item => item.id ? [item.id] : [])); setFailure(null);
    try {
      const responses = await Promise.all(selected.map(item => getRelationshipCandidate({ path: { workId, candidateId: item.id! } })));
      if (!mounted.current || session !== authSessionEpoch()) return;
      if (responses.some(result => !result.data.data)) throw new Error('Missing candidate');
      for (const result of responses) {
        client.setQueryData(getRelationshipCandidateQueryKey({ path: { workId, candidateId: result.data.data!.id! } }), result.data);
      }
      setSelected(responses.map(result => result.data.data!)); setNeedsRefresh(false);
      void choices.refetch();
    } catch (cause) {
      if (mounted.current && session === authSessionEpoch()) {
        setFailure(relationshipError(cause, '선택한 근거를 다시 확인하지 못했어요.')); setNeedsRefresh(true);
      }
    } finally { if (mounted.current && session === authSessionEpoch()) setPending([]); }
  }

  async function save() {
    if (!canSave || submission.current) return;
    submission.current = true;
    const session = authSessionEpoch();
    const candidates = selected.map(item => ({ candidateId: item.id!, expectedVersion: item.version! })).sort((a, b) => a.candidateId.localeCompare(b.candidateId));
    const bodySignature = JSON.stringify({ name: name.trim(), candidates });
    if (request.current?.signature !== bodySignature) request.current = { signature: bodySignature, id: crypto.randomUUID() };
    setSaving(true); setFailure(null);
    try {
      const result = await createRelationshipMentionGroup({ path: { workId }, body: { requestId: request.current.id, name: name.trim(), candidates } });
      if (!mounted.current || session !== authSessionEpoch()) return;
      if (!result.data.data) throw new Error('Missing group');
      onSaved(result.data.data.candidateIds ?? candidates.map(item => item.candidateId), result.data.data.active === true);
    } catch (cause) {
      if (mounted.current && session === authSessionEpoch()) {
        setFailure(relationshipError(cause, '같은 인물로 묶지 못했어요. 선택은 유지했어요. 다시 시도해 주세요.'));
        if (toApiError(cause)?.status === 409) setNeedsRefresh(true);
      }
    } finally {
      submission.current = false;
      if (mounted.current && session === authSessionEpoch()) setSaving(false);
    }
  }

  return <div className="family-mention-group-picker">
    <h4 ref={heading} tabIndex={-1}>같은 인물로 묶을 관계 선택</h4>
    <p>각 관계와 근거를 확인해 같은 인물인 경우에만 선택해 주세요.</p>
    <label className="family-mention-group-picker__name">가계도에 표시할 이름
      <input value={name} maxLength={200} disabled={saving} onChange={event => setName(event.target.value)} /></label>
    {choices.isPending && <p role="status">미등록 인물의 관계를 불러오고 있어요.</p>}
    {choices.isError && <RelationshipQueryError title="선택할 관계를 불러오지 못했어요." onRetry={() => void choices.refetch()} pending={choices.isFetching} />}
    {!choices.isError && <div className="family-mention-group-picker__choices">
      {(choices.data?.data?.content ?? []).filter(item => item.id !== candidate.id && !item.objectCharacterId).map(item => <label key={item.id}>
        <input type="checkbox" checked={selected.some(value => value.id === item.id)}
          disabled={locked || !eligible(item) || selected.length >= 20 && !selected.some(value => value.id === item.id)}
          onChange={event => void select(item, event.target.checked)} />
        <span><strong>{mentionName(item)}</strong><span>{relationLabel(item)}{isDistantAncestry(item.kind) && ` · ${generationLabel(item.generationGap)}`}</span>
          {item.mentionGroupId ? <small>이미 다른 묶음에 포함됨 · 해제 후 선택 가능</small> : !eligible(item) && <small>관계 확인 후 선택 가능</small>}</span>
      </label>)}
      {choices.isSuccess && !(choices.data.data?.content ?? []).some(item => item.id !== candidate.id && !item.objectCharacterId) &&
        <p>이 페이지에는 선택할 다른 미등록 인물이 없어요.</p>}
    </div>}
    <PageNavigation page={page} totalPages={choices.data?.data?.totalPages ?? 0} disabled={choices.isFetching || locked} onPageChange={setPage} />
    <div className="family-mention-group-picker__selected" aria-label="선택한 관계와 근거">
      <h5>선택한 관계 {selected.length}개</h5>
      {selected.map(item => <section key={item.id}>
        <div className="family-mention-group-picker__source-heading">
          <strong>{relationLabel(item)} {mentionName(item)}</strong>
          {item.id === candidate.id ? <span>지금 보고 있는 관계</span>
            : <ActionButton variant="ghost" size="compact" disabled={locked} onClick={() => setSelected(previous => previous.filter(value => value.id !== item.id))}>선택 해제</ActionButton>}
        </div>
        <p className="relationship-muted">{isDistantAncestry(item.kind) && `${generationLabel(item.generationGap)} · `}
          {item.temporalScope && TIME_LABELS[item.temporalScope]}{item.timeLabel && ` · ${item.timeLabel}`}
          {!eligible(item) && ' · 지금은 묶을 수 없는 관계'}</p>
        {(item.evidence ?? []).map((source, index) => <div key={`${source.sourceFactId}-${index}`}>
          {source.currentValue != null && <RelationshipCurrentSetting value={source.currentValue} />}
          {!source.current && <p className="relationship-muted">현재 설정과 달라진 근거예요.</p>}
        </div>)}
        <RelationshipEvidenceDisclosure workId={workId} evidence={item.evidence ?? []} onOpen={onOpenEvidence}
          summary={`${item.subjectCharacterName || '인물'} 관계의 원문 근거`}
          characterNames={item.subjectCharacterId ? { [item.subjectCharacterId]: item.subjectCharacterName || '인물' } : {}} />
      </section>)}
    </div>
    {pending.length > 0 && <p role="status">선택한 관계의 최신 근거를 확인하고 있어요.</p>}
    {(baseChanged || needsRefresh || invalid) && <p className="relationship-notice" role="status">선택한 관계가 바뀌었거나 지금 묶을 수 없는 관계가 있어요. 근거를 다시 확인하거나 해당 선택을 해제해 주세요.</p>}
    {failure && <p className="relationship-notice relationship-notice--error" role="alert">{failure}</p>}
    <div className="family-mention-group-picker__actions">
      <ActionButton variant="primary" disabled={!canSave} onClick={() => void save()}>{saving ? '묶는 중…' : `선택한 ${selected.length}개 관계 묶기`}</ActionButton>
      {(baseChanged || needsRefresh || invalid) && <ActionButton variant="secondary" disabled={locked} onClick={() => void refreshSelection()}>선택한 근거 다시 확인</ActionButton>}
      <ActionButton variant="ghost" disabled={saving} onClick={onClose}>취소</ActionButton>
    </div>
  </div>;
}
