import { lazy, Suspense, useEffect, useId, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'react-router';
import { ArrowRight, ChevronDown, GitBranch, RefreshCw, Trash2, UserRound } from 'lucide-react';
import {
  getRelationshipCandidateOptions, getRelationshipCandidateQueryKey, getRelationshipCandidatesOptions, getRelationshipCandidatesQueryKey,
  getRelationshipOptions, getRelationshipQueryKey, getRelationshipProcessingOptions, getRelationshipProcessingQueryKey,
  getRelationshipsOptions, getRelationshipsQueryKey, getFamilyTreeQueryKey,
} from '../../../api/generated/@tanstack/react-query.gen';
import { requestRelationshipProcessing, withdrawRelationship } from '../../../api/generated/sdk.gen';
import type { RelationshipCandidateResponse, RelationshipResponse } from '../../../api/generated/types.gen';
import { privateImageSessionEpoch as authSessionEpoch } from '../../../lib/private-image-session';
import { ActionButton } from '../ui-v2/ActionButton';
import { PageNavigation } from '../PageNavigation';
import { FamilyMentionDetail } from './FamilyMentionDetail';
import { FamilyRelationshipSummary } from './FamilyRelationshipSummary';
import { RelationshipCandidateEditor } from './RelationshipCandidateEditor';
import { RelationshipEvidence, RelationshipEvidenceDialog, RelationshipQueryError } from './RelationshipEvidence';
import { COUNTERPART_ROLES, generationLabel, isDistantAncestry, positivePage, relationshipError, reviewMessage, SUBTYPE_LABELS, TIME_LABELS } from './relationship-presentation';
import '../../../../styles/relationships-v2.css';

const FamilyTreeView = lazy(() => import('./FamilyTreeView'));

export function FamilyRelationshipWorkspace({ workId, enabled, onOpenCharacter }: { workId: string; enabled: boolean; onOpenCharacter: (id: string) => void }) {
  const familyModeId = useId();
  const familyPanelId = useId();
  const [params, setParams] = useSearchParams();
  const client = useQueryClient();
  const view = params.get('relationView') === 'review' ? 'review' : params.get('relationView') === 'list' ? 'list' : 'tree';
  const page = positivePage(params.get('relationPage'));
  const candidateId = params.get('relationshipCandidate') || '';
  const relationshipId = params.get('relationshipId') || '';
  const factId = params.get('relationshipFactId');
  const [requesting, setRequesting] = useState(false);
  const [requestError, setRequestError] = useState<string | null>(null);
  const selectedDetail = useRef<HTMLElement>(null);
  const restoreRelationshipFocus = useRef<string | null>(null);
  const mentionDetail = useRef<HTMLElement>(null);
  const sourceTrigger = useRef<HTMLElement | null>(null);
  const restoreMentionFocus = useRef<'trigger' | 'stable' | null>(null);
  const restoreCandidateFocus = useRef<string | null>(null);
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const processing = useQuery({ ...getRelationshipProcessingOptions({ path: { workId } }), enabled,
    refetchInterval: query => query.state.data?.data?.state === 'PENDING' ? 3000 : 30000 });
  const state = processing.data?.data;
  useEffect(() => {
    if (requestError && processing.isSuccess && (state?.state === 'PENDING' || state?.state === 'SUCCEEDED')) {
      setRequestError(null);
    }
  }, [processing.isSuccess, requestError, state?.state]);
  // Manual review in another tab does not change the automatic processing marker.
  const pending = useQuery({ ...getRelationshipCandidatesOptions({ path: { workId }, query: { status: 'PENDING', page: 0, size: 1 } }), enabled,
    refetchOnWindowFocus: true, refetchInterval: 5000 });
  const relations = useQuery({ ...getRelationshipsOptions({ path: { workId }, query: { page, size: 20 } }), enabled: enabled && view === 'list',
    refetchOnWindowFocus: true, refetchInterval: 5000 });
  const candidates = useQuery({ ...getRelationshipCandidatesOptions({ path: { workId }, query: { status: 'PENDING', page, size: 20 } }), enabled: enabled && view === 'review',
    refetchOnWindowFocus: true, refetchInterval: candidateId ? false : 5000 });
  const candidate = useQuery({ ...getRelationshipCandidateOptions({ path: { workId, candidateId } }),
    enabled: enabled && (view === 'review' || view === 'tree') && !!candidateId, refetchOnWindowFocus: true,
    refetchInterval: query => query.state.data?.data?.status === 'PENDING' ? 5000 : false });
  const relationship = useQuery({ ...getRelationshipOptions({ path: { workId, relationshipId } }), enabled: enabled && view !== 'review' && !!relationshipId,
    refetchOnWindowFocus: true, refetchInterval: query => query.state.data?.data?.validity === 'WITHDRAWN' ? false : 5000 });
  useEffect(() => {
    if (view !== 'review') { restoreCandidateFocus.current = null; return; }
    if (candidateId || candidates.isFetching || candidates.isPending || !restoreCandidateFocus.current) return;
    const id = restoreCandidateFocus.current;
    const frame = requestAnimationFrame(() => {
      const trigger = document.querySelector<HTMLElement>(`.family-candidate-row[data-candidate-id="${CSS.escape(id)}"]`)
        ?? document.querySelector<HTMLElement>('.family-review-queue__heading h3')
        ?? [...document.querySelectorAll<HTMLElement>('.relationship-view-tabs button[aria-pressed="true"], .relationship-mobile-view select')]
          .find(element => element.getClientRects().length > 0);
      trigger?.scrollIntoView({ block: 'nearest', behavior: 'instant' });
      trigger?.focus({ preventScroll: true });
      restoreCandidateFocus.current = null;
    });
    return () => cancelAnimationFrame(frame);
  }, [candidateId, candidates.isFetching, candidates.isPending, view]);
  useEffect(() => {
    if (view !== 'tree') { restoreRelationshipFocus.current = null; return; }
    if (!relationshipId) {
      const id = restoreRelationshipFocus.current;
      if (!id) return;
      // The selected edge is updated after the URL commit; restore its new control on the next frame.
      const frame = requestAnimationFrame(() => {
        const trigger = sourceTrigger.current
          ? sourceTrigger.current.isConnected ? sourceTrigger.current : document.querySelector<HTMLElement>('.family-tree-search input')
          : document.querySelector<HTMLElement>(`[data-relationship-id="${CSS.escape(id)}"]`) ?? document.querySelector<HTMLElement>('.family-tree-search input');
        (trigger?.closest('.family-tree-canvas') ?? trigger)?.scrollIntoView({ block: 'nearest', behavior: 'instant' });
        trigger?.focus({ preventScroll: true });
        restoreRelationshipFocus.current = null;
      });
      return () => cancelAnimationFrame(frame);
    }
    restoreRelationshipFocus.current = null;
    if (document.querySelector('[role="dialog"][aria-modal="true"]')) return;
    selectedDetail.current?.scrollIntoView({ block: 'start', behavior: 'instant' });
    selectedDetail.current?.focus({ preventScroll: true });
  }, [relationshipId, view]);
  useEffect(() => {
    if (view !== 'tree') { sourceTrigger.current = null; restoreMentionFocus.current = null; return; }
    if (candidateId) {
      // Wait until the first response has sized the evidence panel; polling must not scroll it again.
      if (candidate.isPending) return;
      if (document.querySelector('[role="dialog"][aria-modal="true"]')) return;
      mentionDetail.current?.scrollIntoView({ block: 'start', behavior: 'instant' });
      mentionDetail.current?.focus({ preventScroll: true });
    } else if (restoreMentionFocus.current) {
      const frame = requestAnimationFrame(() => {
        const trigger = restoreMentionFocus.current === 'trigger' && sourceTrigger.current?.isConnected
          ? sourceTrigger.current : document.querySelector<HTMLElement>('.family-tree-search input');
        (trigger?.closest('.family-tree-canvas') ?? trigger)?.scrollIntoView({ block: 'nearest', behavior: 'instant' });
        trigger?.focus({ preventScroll: true });
        restoreMentionFocus.current = null;
      });
      return () => cancelAnimationFrame(frame);
    }
  }, [candidateId, candidate.isPending, view]);
  const processingMarker = state ? `${state.state}:${state.inputVersion}:${state.processedVersion}:${state.lastProcessedAt}` : undefined;
  useEffect(() => {
    if (!processingMarker) return;
    void client.invalidateQueries({ queryKey: getFamilyTreeQueryKey({ path: { workId } }) });
    void client.invalidateQueries({ queryKey: getRelationshipsQueryKey({ path: { workId } }) });
    void client.invalidateQueries({ queryKey: getRelationshipCandidatesQueryKey({ path: { workId } }) });
    if (candidateId) void client.invalidateQueries({ queryKey: getRelationshipCandidateQueryKey({ path: { workId, candidateId } }) });
    if (relationshipId) void client.invalidateQueries({ queryKey: getRelationshipQueryKey({ path: { workId, relationshipId } }) });
  }, [candidateId, client, processingMarker, relationshipId, workId]);

  const totalPages = view === 'list' ? relations.data?.data?.totalPages : view === 'review' ? candidates.data?.data?.totalPages : undefined;
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
    void client.invalidateQueries({ queryKey: getFamilyTreeQueryKey({ path: { workId } }) });
    void client.invalidateQueries({ queryKey: getRelationshipsQueryKey({ path: { workId } }) });
    void client.invalidateQueries({ queryKey: getRelationshipCandidatesQueryKey({ path: { workId } }) });
    if (candidateId) void candidate.refetch();
    if (relationshipId) void relationship.refetch();
    if (decided) { restoreMentionFocus.current = 'stable'; updateUrl({ relationshipCandidate: null, relationshipFactId: null, relationPage: null }, true); }
  }
  async function requestProcessing() {
    const session = authSessionEpoch();
    setRequesting(true); setRequestError(null);
    try {
      const result = await requestRelationshipProcessing({ path: { workId } });
      if (!mounted.current || session !== authSessionEpoch()) return;
      client.setQueryData(getRelationshipProcessingQueryKey({ path: { workId } }), result.data);
      refreshLists(false);
    } catch (error) {
      if (mounted.current && session === authSessionEpoch()) setRequestError(relationshipError(error, '가족 관계 정리를 요청하지 못했어요. 다시 시도해 주세요.'));
    } finally { if (mounted.current && session === authSessionEpoch()) setRequesting(false); }
  }

  const processingSummary = state && state.state !== 'SUCCEEDED' && <div className={`relationship-processing${state.state === 'FAILED' ? ' relationship-notice--error' : ''}`} role="status">
      <strong>{state.state === 'PENDING' ? '가족 관계를 정리하고 있어요.' : state.state === 'FAILED' ? '가족 관계 정리를 마치지 못했어요.'
        : '아직 가족 관계를 정리하지 않았어요.'}</strong>
      <p>{state.state === 'PENDING' ? '명확한 관계는 자동으로 반영돼요. 확인이 필요한 내용은 아래에서 검토할 수 있어요.'
        : state.state === 'FAILED' ? (state.retryAt ? '자동으로 다시 시도할 예정이에요. 직접 다시 요청할 수도 있어요.' : '현재 설정은 유지되어 있어요. 다시 시도해 주세요.')
          : '캐릭터 설정이 새로 반영되거나 변경되면 가족 관계를 자동으로 정리해요.'}</p>
      {state.state === 'FAILED' && <ActionButton variant="secondary" icon={<RefreshCw size={16} aria-hidden="true" />} disabled={requesting}
        onClick={() => void requestProcessing()}>{requesting ? '요청 중…' : '관계 정리 다시 시도'}</ActionButton>}
    </div>;

  if (!enabled) return <section className="relationship-workspace relationship-empty"><GitBranch aria-hidden="true" />
    <h2>관계도</h2><p>작품에 저장된 캐릭터 설정으로 가족 관계를 정리할 수 있어요.</p></section>;
  return <section className="relationship-workspace" aria-label="관계도">
    <div className="relationship-mode-tabs" role="tablist" aria-label="관계도 종류">
      <button type="button" role="tab" id={familyModeId} aria-selected="true" aria-controls={familyPanelId}>가계도</button>
      <button type="button" role="tab" aria-selected="false" disabled>인물 관계도<span>업데이트 예정</span></button>
    </div>
    <div role="tabpanel" id={familyPanelId} aria-labelledby={familyModeId}>
    {processing.isPending && <p role="status">가족 관계 처리 상태를 불러오고 있어요.</p>}
    {processing.isError && <RelationshipQueryError title="가족 관계 처리 상태를 불러오지 못했어요." onRetry={() => void processing.refetch()} pending={processing.isFetching} />}
    {processingSummary}
    {requestError && <p className="relationship-notice relationship-notice--error" role="alert">{requestError}</p>}
    <div className="relationship-view-tabs" aria-label="가족 관계 탭">
      <button type="button" aria-pressed={view === 'tree'} onClick={() => changeView('tree')}>가계도</button>
      <button type="button" aria-pressed={view === 'list'} onClick={() => changeView('list')}>가족 관계 목록</button>
      <button type="button" aria-pressed={view === 'review'} onClick={() => changeView('review')}>
        확인·연결{pending.data?.data?.totalElements != null && <span>{pending.data.data.totalElements}</span>}</button>
    </div>
    <label className="relationship-mobile-view">가족 관계 보기<select aria-label="가족 관계 보기" value={view} onChange={event => changeView(event.target.value)}>
      <option value="tree">가계도</option><option value="list">가족 관계 목록</option><option value="review">확인·연결{pending.data?.data?.totalElements != null ? ` (${pending.data.data.totalElements})` : ''}</option>
    </select></label>
    {view === 'tree' && <>
      <Suspense fallback={<p role="status">가계도 화면을 불러오고 있어요.</p>}>
        <FamilyTreeView workId={workId} focusCharacterId={params.get('familyFocus') || ''} includeHistorical={params.get('familyHistory') === 'true'}
          selectedRelationshipId={relationshipId} selectedCandidateId={candidateId} onOpenCharacter={onOpenCharacter}
          onScopeChange={(focus, history) => updateUrl({ familyFocus: focus || null, familyHistory: history ? 'true' : null })}
          onOpenRelationship={id => {
            if (id) {
              const selector = `[data-relationship-id="${CSS.escape(id)}"]`;
              sourceTrigger.current = document.activeElement instanceof HTMLElement && document.activeElement.matches(selector)
                ? document.activeElement : null;
            }
            updateUrl({ relationshipId: id || null, relationshipCandidate: null, relationshipFactId: null });
          }}
          onOpenMention={id => {
            const selector = `[data-candidate-id="${CSS.escape(id)}"]`;
            sourceTrigger.current = document.activeElement instanceof HTMLElement && document.activeElement.matches(selector)
              ? document.activeElement : document.querySelector<HTMLElement>(selector);
            updateUrl({ relationshipCandidate: id, relationshipId: null, relationshipFactId: null });
          }}
          onReview={() => changeView('review')} onList={() => changeView('list')} />
      </Suspense>
      {candidateId && <article className="relationship-card family-tree-selected" aria-label="언급된 인물 근거" key={candidateId} ref={mentionDetail} tabIndex={-1}>
        <div className="relationship-card__heading"><h3>인물 근거</h3><ActionButton variant="ghost" onClick={() => {
          restoreMentionFocus.current = 'trigger';
          updateUrl({ relationshipCandidate: null, relationshipFactId: null });
        }}>인물 근거 닫기</ActionButton></div>
        {candidate.isPending && <p role="status">인물의 설정 근거를 불러오고 있어요.</p>}
        {candidate.isError && <RelationshipQueryError title="인물의 설정 근거를 불러오지 못했어요." onRetry={() => void candidate.refetch()} pending={candidate.isFetching} />}
        {candidate.data?.data && <div hidden={candidate.isError}><FamilyMentionDetail workId={workId} candidate={candidate.data.data}
          onChanged={refreshLists} onOpenEvidence={id => updateUrl({ relationshipFactId: id })}
          onSelectCandidate={id => updateUrl({ relationshipCandidate: id, relationshipFactId: null })} /></div>}
      </article>}
      {relationshipId && <article className="relationship-card family-tree-selected" aria-label="선택한 관계 근거" key={relationshipId} ref={selectedDetail} tabIndex={-1}>
        <div className="relationship-card__heading"><h3>선택한 관계</h3><ActionButton variant="ghost" onClick={() => {
          restoreRelationshipFocus.current = relationshipId;
          updateUrl({ relationshipId: null, relationshipFactId: null });
        }}>관계 근거 닫기</ActionButton></div>
        {relationship.data?.data && <FamilyRelationshipSummary relation={relationship.data.data} />}
        <RelationshipDetail workId={workId} relation={relationship.data?.data} loading={relationship.isPending}
          error={relationship.isError} onRetry={() => void relationship.refetch()} onChanged={() => refreshLists(false)} onOpenEvidence={id => updateUrl({ relationshipFactId: id })} />
      </article>}
    </>}
    {view === 'list' && <>
      <p className="relationship-muted">관계를 누르면 설정과 원문 근거를 볼 수 있어요.</p>
      {relations.isPending && <p role="status">가족 관계를 불러오고 있어요.</p>}
      {relations.isError && <RelationshipQueryError title="가족 관계 목록을 불러오지 못했어요." onRetry={() => void relations.refetch()} pending={relations.isFetching} />}
      {relations.isSuccess && (relations.data.data?.content?.length ?? 0) === 0 && <div className="relationship-empty">
        <GitBranch size={28} aria-hidden="true" /><h3>아직 반영된 가족 관계가 없어요.</h3><p>캐릭터 설정에 명시된 가족 관계가 자동으로 반영돼요. 확인이 필요한 후보가 있다면 검토해 주세요.</p></div>}
      {(relations.data?.data?.content?.length ?? 0) > 0 && <ul className="family-relation-list">{(relations.data?.data?.content ?? []).map(item => <li key={item.id}>
        <FamilyRelationRow relation={item} expanded={relationshipId === item.id}
          onToggle={() => updateUrl({ relationshipId: relationshipId === item.id ? null : item.id!, relationshipFactId: null })}>
        {relationshipId === item.id && <RelationshipDetail workId={workId} relation={relationship.data?.data} loading={relationship.isPending}
          error={relationship.isError} onRetry={() => void relationship.refetch()} onChanged={() => refreshLists(false)}
          onOpenEvidence={id => updateUrl({ relationshipFactId: id })} />}
        </FamilyRelationRow>
      </li>)}</ul>}
      {relationshipId && relations.isSuccess && !(relations.data.data?.content ?? []).some(item => item.id === relationshipId) &&
        <article className="relationship-card family-relation-off-page">
          {relationship.data?.data && <FamilyRelationshipSummary relation={relationship.data.data} />}
          <RelationshipDetail workId={workId} relation={relationship.data?.data} loading={relationship.isPending}
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

      {candidates.isPending && <p role="status">확인할 관계를 불러오고 있어요.</p>}
      {candidates.isError && <RelationshipQueryError title="확인할 관계 목록을 불러오지 못했어요." onRetry={() => void candidates.refetch()} pending={candidates.isFetching} />}
      {candidates.isSuccess && (candidates.data.data?.content?.length ?? 0) === 0 && <div className="relationship-empty"><h3>확인이 필요한 가족 관계가 없어요.</h3><p>명확한 관계는 가족 관계 목록에서 볼 수 있어요.</p></div>}
      {([false, true] as const).map(optional => {
        const items = (candidates.data?.data?.content ?? []).filter(item => !!item.displayableAsMention === optional);
        if (items.length === 0) return null;
        return <section className="family-review-queue" key={String(optional)} aria-label={optional ? '선택적 프로필 연결' : '확인이 필요한 관계'}>
          <div className="family-review-queue__heading"><h3 tabIndex={-1}>{optional ? '가족 프로필 연결' : '확인할 가족 관계'}</h3>
            {optional && <span>선택 사항</span>}</div>
          {optional && <p className="relationship-muted">연결 없이도 가계도에 표시할 수 있어요.</p>}
          <ul className="family-candidate-list">{items.map(item => <li key={item.id}><CandidateReviewCard item={item}
            onOpen={() => { restoreCandidateFocus.current = item.id!; updateUrl({ relationshipCandidate: item.id!, relationshipFactId: null }); }} /></li>)}</ul>
        </section>;
      })}
      <PageNavigation page={page} totalPages={candidates.data?.data?.totalPages ?? 0} disabled={candidates.isFetching}
        onPageChange={next => updateUrl({ relationPage: String(next + 1), relationshipCandidate: null, relationshipFactId: null })} />
    </>)}
    {factId && <RelationshipEvidenceDialog key={factId} workId={workId} factId={factId} onClose={() => updateUrl({ relationshipFactId: null }, true)} />}
    </div>
  </section>;
}

function CandidateReviewCard({ item, onOpen }: { item: RelationshipCandidateResponse; onOpen: () => void }) {
  const descriptionId = useId();
  const subject = item.subjectCharacterName || '인물';
  const counterpart = item.objectCharacterName || item.objectMention || '상대 확인 필요';
  const reason = (item.reviewReasons ?? []).find(value => value !== 'UNRESOLVED_TARGET') ?? item.reviewReasons?.[0];
  const role = item.kind ? COUNTERPART_ROLES[item.kind] : '가족';
  const optional = item.displayableAsMention === true;
  return <button type="button" className="family-candidate-row" data-candidate-id={item.id}
    data-review={optional ? 'optional' : 'required'}
    aria-label={`${subject} 가족 ${counterpart} ${optional ? '프로필 연결' : '관계 확인'}`} aria-describedby={descriptionId} onClick={onOpen}>
    <span className="family-candidate-row__avatar" aria-hidden="true"><UserRound size={23} /></span>
    <span className="family-candidate-row__content">
      <span className="family-candidate-row__identity"><strong>{counterpart}</strong>
        {!optional && !item.objectCharacterId && <span className="family-candidate-row__status">프로필 미등록</span>}</span>
      <span className="family-candidate-row__description" id={descriptionId}>
      <span className="family-candidate-row__relation">{subject}의 {role}{!optional && ' 관계 확인'}</span>
      {(isDistantAncestry(item.kind) || item.temporalScope && item.temporalScope !== 'CURRENT' || item.timeLabel || item.subtype && item.subtype !== 'UNSPECIFIED') &&
        <span className="family-candidate-row__qualifiers">
          {isDistantAncestry(item.kind) && <span>{generationLabel(item.generationGap)}</span>}
          {item.temporalScope && item.temporalScope !== 'CURRENT' && <span>{TIME_LABELS[item.temporalScope]}</span>}
          {item.timeLabel && <span>{item.timeLabel}</span>}
          {item.subtype && item.subtype !== 'UNSPECIFIED' && <span>{SUBTYPE_LABELS[item.subtype]}</span>}
        </span>}
      {!optional && reason && <span className="family-candidate-row__reason">{reviewMessage(reason)}</span>}
      </span>
    </span>
    <span className="family-candidate-row__action">{optional ? '프로필 연결' : '관계 확인'}<ArrowRight size={18} aria-hidden="true" /></span>
  </button>;
}

function FamilyRelationRow({ relation, expanded, onToggle, children }: {
  relation: RelationshipResponse; expanded: boolean; onToggle: () => void; children: React.ReactNode;
}) {
  const id = useId();
  return <article>
    <button type="button" className="family-relation-row" data-relationship-id={relation.id}
      aria-label={expanded ? '관계 근거 접기' : '관계 근거 보기'} aria-describedby={`${id}-summary`}
      aria-expanded={expanded} aria-controls={expanded ? `${id}-evidence` : undefined} onClick={onToggle}>
      <span id={`${id}-summary`}><FamilyRelationshipSummary relation={relation} heading={false} /></span>
      <span className="family-relation-row__action">{expanded ? '근거 접기' : '근거 보기'}<ChevronDown size={18} aria-hidden="true" /></span>
    </button>
    {expanded && <div className="family-relation-row__evidence" id={`${id}-evidence`}>{children}</div>}
  </article>;
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
    const session = authSessionEpoch();
    setWithdrawing(true); setFailure(null);
    try {
      await withdrawRelationship({ path: { workId, relationshipId: relation.id }, body: { expectedVersion: relation.version } });
      if (!mounted.current || session !== authSessionEpoch()) return;
      setConfirmWithdraw(false); onChanged();
    } catch (cause) { if (mounted.current && session === authSessionEpoch()) setFailure(relationshipError(cause, '연결을 삭제하지 못했어요. 다시 시도해 주세요.')); }
    finally { if (mounted.current && session === authSessionEpoch()) setWithdrawing(false); }
  }
  if (loading) return <p role="status">관계 근거를 불러오고 있어요.</p>;
  if (error) return <RelationshipQueryError title="관계 근거를 불러오지 못했어요." onRetry={onRetry} />;
  if (!relation) return null;
  const characterNames: Record<string, string> = {};
  if (relation.subjectCharacterId && relation.subjectCharacterName) characterNames[relation.subjectCharacterId] = relation.subjectCharacterName;
  if (relation.objectCharacterId && relation.objectCharacterName) characterNames[relation.objectCharacterId] = relation.objectCharacterName;
  return <div className="relationship-detail">
    {relation.validity !== 'VALID' && <p className="relationship-notice">{relation.validity === 'WITHDRAWN' ? '삭제된 연결이에요. 당시 연결된 근거는 확인할 수 있어요.'
      : '현재 설정이나 인물 상태를 다시 확인할 관계예요. 캐릭터 설정을 수정한 뒤 관계를 다시 정리해 주세요. 잘못된 연결은 가계도에서 제외할 수 있어요.'}</p>}
    <RelationshipEvidence evidence={relation.evidence ?? []} onOpen={onOpenEvidence} characterNames={characterNames} workId={workId} />
    {relation.validity !== 'WITHDRAWN' && (!confirmWithdraw
      ? <ActionButton variant="ghost" size="compact" className="family-connection-delete" icon={<Trash2 size={15} aria-hidden="true" />}
          onClick={() => setConfirmWithdraw(true)}>이 연결 삭제</ActionButton>
      : <div className="relationship-notice"><p>이 연결을 삭제할까요?</p>
        <p>가계도에서 연결이 사라져요. 두 인물의 프로필 설정과 원문, 연결 이력은 그대로 남아요.</p>
        <div className="relationship-editor__actions"><ActionButton variant="secondary" className="family-connection-delete" disabled={withdrawing}
          onClick={() => void withdraw()}>{withdrawing ? '삭제 중…' : '삭제하기'}</ActionButton>
          <ActionButton variant="ghost" disabled={withdrawing} onClick={() => setConfirmWithdraw(false)}>취소</ActionButton></div></div>)}
    {failure && <div className="relationship-notice relationship-notice--error" role="alert"><p>{failure}</p><ActionButton size="compact" onClick={onRetry}>최신 관계 다시 확인</ActionButton></div>}
  </div>;
}
