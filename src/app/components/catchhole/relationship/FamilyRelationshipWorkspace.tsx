import { useEffect, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'react-router';
import { GitBranch, RefreshCw } from 'lucide-react';
import {
  getRelationshipCandidateOptions, getRelationshipCandidateQueryKey, getRelationshipCandidatesOptions, getRelationshipCandidatesQueryKey,
  getRelationshipOptions, getRelationshipQueryKey, getRelationshipProcessingOptions, getRelationshipProcessingQueryKey,
  getRelationshipsOptions, getRelationshipsQueryKey,
} from '../../../api/generated/@tanstack/react-query.gen';
import { requestRelationshipProcessing, withdrawRelationship } from '../../../api/generated/sdk.gen';
import type { RelationshipResponse } from '../../../api/generated/types.gen';
import { getAccessToken } from '../../../lib/api-config';
import { ActionButton } from '../ui-v2/ActionButton';
import { PageNavigation } from '../PageNavigation';
import { RelationshipCandidateEditor } from './RelationshipCandidateEditor';
import { RelationshipEvidence, RelationshipEvidenceDialog, RelationshipQueryError } from './RelationshipEvidence';
import { KIND_LABELS, positivePage, relationshipError, reviewMessage, SUBTYPE_LABELS, TIME_LABELS, VALIDITY_LABELS } from './relationship-presentation';
import '../../../../styles/relationships-v2.css';

export function FamilyRelationshipWorkspace({ workId, enabled }: { workId: string; enabled: boolean }) {
  const [params, setParams] = useSearchParams();
  const client = useQueryClient();
  const view = params.get('relationView') === 'review' ? 'review' : 'list';
  const page = positivePage(params.get('relationPage'));
  const candidateId = params.get('relationshipCandidate') || '';
  const relationshipId = params.get('relationshipId') || '';
  const factId = params.get('relationshipFactId');
  const [requesting, setRequesting] = useState(false);
  const [requestError, setRequestError] = useState<string | null>(null);
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const processing = useQuery({ ...getRelationshipProcessingOptions({ path: { workId } }), enabled,
    refetchInterval: query => query.state.data?.data?.state === 'PENDING' ? 3000 : 30000 });
  const state = processing.data?.data;
  const pending = useQuery({ ...getRelationshipCandidatesOptions({ path: { workId }, query: { status: 'PENDING', page: 0, size: 1 } }), enabled });
  const relations = useQuery({ ...getRelationshipsOptions({ path: { workId }, query: { page, size: 20 } }), enabled: enabled && view === 'list' });
  const candidates = useQuery({ ...getRelationshipCandidatesOptions({ path: { workId }, query: { status: 'PENDING', page, size: 20 } }), enabled: enabled && view === 'review' });
  const candidate = useQuery({ ...getRelationshipCandidateOptions({ path: { workId, candidateId } }), enabled: enabled && view === 'review' && !!candidateId });
  const relationship = useQuery({ ...getRelationshipOptions({ path: { workId, relationshipId } }), enabled: enabled && view === 'list' && !!relationshipId });
  const processingMarker = state ? `${state.state}:${state.inputVersion}:${state.processedVersion}:${state.lastProcessedAt}` : undefined;
  useEffect(() => {
    if (!processingMarker) return;
    void client.invalidateQueries({ queryKey: getRelationshipsQueryKey({ path: { workId } }) });
    void client.invalidateQueries({ queryKey: getRelationshipCandidatesQueryKey({ path: { workId } }) });
    if (candidateId) void client.invalidateQueries({ queryKey: getRelationshipCandidateQueryKey({ path: { workId, candidateId } }) });
    if (relationshipId) void client.invalidateQueries({ queryKey: getRelationshipQueryKey({ path: { workId, relationshipId } }) });
  }, [candidateId, client, processingMarker, relationshipId, workId]);

  const totalPages = view === 'list' ? relations.data?.data?.totalPages : candidates.data?.data?.totalPages;
  useEffect(() => {
    if (totalPages == null || page === 0 || page < totalPages) return;
    setParams(previous => {
      const next = new URLSearchParams(previous);
      next.set('relationPage', String(Math.max(1, totalPages)));
      return next;
    }, { replace: true });
  }, [page, setParams, totalPages]);

  function updateUrl(values: Record<string, string | null>, replace = false) {
    setParams(previous => {
      const next = new URLSearchParams(previous);
      for (const [key, value] of Object.entries(values)) { if (value === null) next.delete(key); else next.set(key, value); }
      return next;
    }, { replace });
  }
  function changeView(next: string) {
    updateUrl({ relationView: next, relationPage: null, relationshipCandidate: null, relationshipId: null, relationshipFactId: null });
  }
  function refreshLists(decided: boolean) {
    void client.invalidateQueries({ queryKey: getRelationshipsQueryKey({ path: { workId } }) });
    void client.invalidateQueries({ queryKey: getRelationshipCandidatesQueryKey({ path: { workId } }) });
    if (candidateId) void candidate.refetch();
    if (relationshipId) void relationship.refetch();
    if (decided) updateUrl({ relationshipCandidate: null, relationPage: null }, true);
  }
  async function requestProcessing() {
    const sessionToken = getAccessToken();
    setRequesting(true); setRequestError(null);
    try {
      const result = await requestRelationshipProcessing({ path: { workId } });
      if (!mounted.current || sessionToken !== getAccessToken()) return;
      client.setQueryData(getRelationshipProcessingQueryKey({ path: { workId } }), result.data);
      refreshLists(false);
    } catch (error) {
      if (mounted.current) setRequestError(relationshipError(error, '가족 관계 정리를 요청하지 못했어요. 다시 시도해 주세요.'));
    } finally { if (mounted.current) setRequesting(false); }
  }

  if (!enabled) return <section className="relationship-workspace relationship-empty"><GitBranch aria-hidden="true" />
    <h2>가족 관계</h2><p>작품에 저장된 캐릭터 설정으로 가족 관계를 정리할 수 있어요.</p></section>;
  return <section className="relationship-workspace" aria-label="가족 관계">
    <header className="relationship-header"><div><h2>가족 관계</h2>
      <p>현재 캐릭터 설정에서 명확한 가족 관계를 반영하고, 확인이 필요한 내용만 따로 모아요.</p></div>
      <ActionButton variant="secondary" icon={<RefreshCw size={16} aria-hidden="true" />} disabled={requesting || state?.state === 'PENDING'}
        onClick={() => void requestProcessing()}>{requesting ? '요청 중…' : state?.state === 'FAILED' ? '관계 정리 다시 시도' : '현재 설정에서 관계 찾기'}</ActionButton>
    </header>
    {processing.isPending && <p role="status">가족 관계 처리 상태를 불러오고 있어요.</p>}
    {processing.isError && <RelationshipQueryError title="가족 관계 처리 상태를 불러오지 못했어요." onRetry={() => void processing.refetch()} pending={processing.isFetching} />}
    {state && <div className={`relationship-processing${state.state === 'FAILED' ? ' relationship-notice--error' : ''}`} role="status">
      <strong>{state.state === 'PENDING' ? '가족 관계를 정리하고 있어요.' : state.state === 'FAILED' ? '가족 관계 정리를 마치지 못했어요.'
        : state.state === 'NEVER_PROCESSED' ? '현재 설정에서 가족 관계를 찾아보세요.' : '현재 설정의 가족 관계를 정리했어요.'}</strong>
      <p>{state.state === 'PENDING' ? '명확한 관계는 자동으로 반영돼요. 확인이 필요한 내용은 아래에서 검토할 수 있어요.'
        : state.state === 'FAILED' ? (state.retryAt ? '자동으로 다시 시도할 예정이에요. 직접 다시 요청할 수도 있어요.' : '현재 설정은 유지되어 있어요. 다시 시도해 주세요.')
          : state.state === 'NEVER_PROCESSED' ? '이미 저장된 프로필을 사용해요. 새 AI 분석을 요청하거나 사용량을 차감하지 않아요.'
            : `최근 정리에서 ${state.autoConfirmedCount ?? 0}개를 새로 반영하고, ${state.reviewRequiredCount ?? 0}개를 확인이 필요한 후보로 찾았어요.`}</p>
      {(state.unsupportedSourceCount ?? 0) > 0 && <p className="relationship-muted">가족을 언급하지만 관계를 명확히 읽을 수 없는 설정 {state.unsupportedSourceCount}개는 반영하지 않았어요. 필요한 내용은 캐릭터 설정에서 확인해 주세요.</p>}
    </div>}
    {requestError && <p className="relationship-notice relationship-notice--error" role="alert">{requestError}</p>}
    <div className="relationship-view-tabs" aria-label="가족 관계 탭">
      <button type="button" aria-pressed={view === 'list'} onClick={() => changeView('list')}>가족 관계 목록</button>
      <button type="button" aria-pressed={view === 'review'} onClick={() => changeView('review')}>
        확인 필요{pending.data?.data?.totalElements != null && <span>{pending.data.data.totalElements}</span>}</button>
    </div>
    <label className="relationship-mobile-view">가족 관계 보기<select aria-label="가족 관계 보기" value={view} onChange={event => changeView(event.target.value)}>
      <option value="list">가족 관계 목록</option><option value="review">확인 필요{pending.data?.data?.totalElements != null ? ` (${pending.data.data.totalElements})` : ''}</option>
    </select></label>
    {view === 'list' && <>
      <p className="relationship-muted">현재·과거 관계와 다시 확인할 관계를 함께 보여줘요. 관계에 연결된 설정과 원문을 확인할 수 있어요.</p>
      {relations.isPending && <p role="status">가족 관계를 불러오고 있어요.</p>}
      {relations.isError && <RelationshipQueryError title="가족 관계 목록을 불러오지 못했어요." onRetry={() => void relations.refetch()} pending={relations.isFetching} />}
      {relations.isSuccess && (relations.data.data?.content?.length ?? 0) === 0 && <div className="relationship-empty">
        <GitBranch size={28} aria-hidden="true" /><h3>아직 반영된 가족 관계가 없어요.</h3><p>현재 설정에서 관계를 찾거나 확인이 필요한 후보를 검토해 주세요.</p></div>}
      <div className="relationship-list">{(relations.data?.data?.content ?? []).map(item => <article className="relationship-card" key={item.id}>
        <RelationSummary relation={item} />
        <ActionButton variant="secondary" size="compact" aria-expanded={relationshipId === item.id}
          onClick={() => updateUrl({ relationshipId: relationshipId === item.id ? null : item.id!, relationshipFactId: null })}>
          {relationshipId === item.id ? '관계 근거 접기' : '관계 근거 보기'}</ActionButton>
        {relationshipId === item.id && <RelationshipDetail workId={workId} relation={relationship.data?.data} loading={relationship.isPending}
          error={relationship.isError} onRetry={() => void relationship.refetch()} onChanged={() => refreshLists(false)}
          onOpenEvidence={id => updateUrl({ relationshipFactId: id })} />}
      </article>)}</div>
      {relationshipId && relations.isSuccess && !(relations.data.data?.content ?? []).some(item => item.id === relationshipId) &&
        <article className="relationship-card"><RelationshipDetail workId={workId} relation={relationship.data?.data} loading={relationship.isPending}
          error={relationship.isError} onRetry={() => void relationship.refetch()} onChanged={() => refreshLists(false)} onOpenEvidence={id => updateUrl({ relationshipFactId: id })} /></article>}
      <PageNavigation page={page} totalPages={relations.data?.data?.totalPages ?? 0} disabled={relations.isFetching}
        onPageChange={next => updateUrl({ relationPage: String(next + 1), relationshipId: null, relationshipFactId: null })} />
    </>}
    {view === 'review' && (candidateId ? <>
      {candidate.isPending && <p role="status">확인할 관계를 불러오고 있어요.</p>}
      {candidate.isError && <RelationshipQueryError title="확인할 관계를 불러오지 못했어요." onRetry={() => void candidate.refetch()} pending={candidate.isFetching} />}
      {candidate.data?.data && <RelationshipCandidateEditor key={candidateId} workId={workId} candidate={candidate.data.data}
        onClose={() => updateUrl({ relationshipCandidate: null, relationshipFactId: null })} onChanged={refreshLists}
        onOpenEvidence={id => updateUrl({ relationshipFactId: id })} />}
    </> : <>
      <p className="relationship-muted">대상이나 관계의 의미가 모호한 내용이에요. 현재 설정을 확인한 뒤 반영하거나 제외해 주세요.</p>
      {candidates.isPending && <p role="status">확인할 관계를 불러오고 있어요.</p>}
      {candidates.isError && <RelationshipQueryError title="확인할 관계 목록을 불러오지 못했어요." onRetry={() => void candidates.refetch()} pending={candidates.isFetching} />}
      {candidates.isSuccess && (candidates.data.data?.content?.length ?? 0) === 0 && <div className="relationship-empty"><h3>확인이 필요한 가족 관계가 없어요.</h3><p>명확한 관계는 가족 관계 목록에서 볼 수 있어요.</p></div>}
      <div className="relationship-list">{(candidates.data?.data?.content ?? []).map(item => <article className="relationship-card" key={item.id}>
        <div className="relationship-card__heading"><h3>{item.subjectCharacterName || '주체 인물'} <span>·</span> {item.objectCharacterName || item.objectMention || '상대 확인 필요'}</h3>
          <span className="relationship-badge relationship-badge--review">확인 필요</span></div>
        <p>{item.kind && KIND_LABELS[item.kind]} · {item.temporalScope && TIME_LABELS[item.temporalScope]}</p>
        {(item.reviewReasons ?? []).slice(0, 2).map(reason => <p className="relationship-muted" key={reason}>{reviewMessage(reason)}</p>)}
        <ActionButton variant="secondary" size="compact" onClick={() => updateUrl({ relationshipCandidate: item.id!, relationshipFactId: null })}>
          {item.subjectCharacterName || '인물'} · {item.objectCharacterName || item.objectMention || '상대'} 관계 확인</ActionButton>
      </article>)}</div>
      <PageNavigation page={page} totalPages={candidates.data?.data?.totalPages ?? 0} disabled={candidates.isFetching}
        onPageChange={next => updateUrl({ relationPage: String(next + 1), relationshipCandidate: null, relationshipFactId: null })} />
    </>)}
    {factId && <RelationshipEvidenceDialog key={factId} workId={workId} factId={factId} onClose={() => updateUrl({ relationshipFactId: null }, true)} />}
  </section>;
}

function RelationSummary({ relation }: { relation: RelationshipResponse }) {
  return <><div className="relationship-card__heading"><h3>{relation.subjectCharacterName || '주체 인물'} <span>{relation.kind === 'PARENT_OF' ? '→' : '·'}</span> {relation.objectCharacterName || '상대 인물'}</h3>
    <span className={`relationship-badge${relation.validity === 'VALID' ? '' : ' relationship-badge--review'}`}>{relation.validity && VALIDITY_LABELS[relation.validity]}</span></div>
    <p>{relation.kind && KIND_LABELS[relation.kind]}{relation.subtype && relation.subtype !== 'UNSPECIFIED' ? ` · ${SUBTYPE_LABELS[relation.subtype]}` : ''}
      {' · '}{relation.temporalScope && TIME_LABELS[relation.temporalScope]}{relation.timeLabel ? ` · ${relation.timeLabel}` : ''}</p></>;
}

function RelationshipDetail({ workId, relation, loading, error, onRetry, onChanged, onOpenEvidence }: {
  workId: string; relation?: RelationshipResponse; loading: boolean; error: boolean;
  onRetry: () => void; onChanged: () => void; onOpenEvidence: (factId: string) => void;
}) {
  const [withdrawing, setWithdrawing] = useState(false);
  const [confirmWithdraw, setConfirmWithdraw] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  async function withdraw() {
    if (!relation?.id || relation.version == null) return;
    const sessionToken = getAccessToken();
    setWithdrawing(true); setFailure(null);
    try {
      await withdrawRelationship({ path: { workId, relationshipId: relation.id }, body: { expectedVersion: relation.version } });
      if (!mounted.current || sessionToken !== getAccessToken()) return;
      setConfirmWithdraw(false); onChanged();
    } catch (cause) { if (mounted.current) setFailure(relationshipError(cause, '관계를 철회하지 못했어요. 다시 시도해 주세요.')); }
    finally { if (mounted.current) setWithdrawing(false); }
  }
  if (loading) return <p role="status">관계 근거를 불러오고 있어요.</p>;
  if (error) return <RelationshipQueryError title="관계 근거를 불러오지 못했어요." onRetry={onRetry} />;
  if (!relation) return null;
  return <div className="relationship-detail">
    {relation.validity !== 'VALID' && <p className="relationship-notice">{relation.validity === 'WITHDRAWN' ? '철회된 관계예요. 당시 연결된 근거는 확인할 수 있어요.'
      : '현재 설정이나 인물 상태를 다시 확인할 관계예요. 캐릭터 설정을 수정한 뒤 관계를 다시 정리해 주세요. 잘못된 연결은 철회할 수 있어요.'}</p>}
    <RelationshipEvidence evidence={relation.evidence ?? []} onOpen={onOpenEvidence} />
    {relation.validity !== 'WITHDRAWN' && (!confirmWithdraw
      ? <ActionButton variant="ghost" size="compact" onClick={() => setConfirmWithdraw(true)}>잘못된 관계 철회</ActionButton>
      : <div className="relationship-notice"><p>이 관계를 잘못된 연결로 철회할까요? 작품 속 이혼이나 관계 종료는 캐릭터 설정에서 수정해 주세요.</p>
        <div className="relationship-editor__actions"><ActionButton variant="secondary" disabled={withdrawing} onClick={() => void withdraw()}>{withdrawing ? '철회 중…' : '관계 철회'}</ActionButton>
          <ActionButton variant="ghost" disabled={withdrawing} onClick={() => setConfirmWithdraw(false)}>취소</ActionButton></div></div>)}
    {failure && <div className="relationship-notice relationship-notice--error" role="alert"><p>{failure}</p><ActionButton size="compact" onClick={onRetry}>최신 관계 다시 확인</ActionButton></div>}
  </div>;
}
