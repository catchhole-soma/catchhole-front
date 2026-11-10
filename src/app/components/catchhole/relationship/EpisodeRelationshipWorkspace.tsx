import { useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'react-router';
import { ArrowLeft, ArrowLeftRight, ArrowRight, GitBranch, Pencil, Trash2, X } from 'lucide-react';
import { exploreSelectedEpisodeRelationshipsOptions, exploreSelectedEpisodeRelationshipsQueryKey, getExploredRelationshipEdgeOptions,
  getExploredRelationshipEdgeQueryKey, searchEpisodeRelationshipPeopleOptions, searchEpisodeRelationshipPeopleQueryKey, updateEpisodeRelationshipEdgeMutation, deleteEpisodeRelationshipEdgeMutation } from '../../../api/generated/@tanstack/react-query.gen';
import type { Edge } from '../../../api/generated/types.gen';
import { privateImageSessionEpoch, usePrivateImageSession } from '../../../lib/private-image-session';
import { toApiError } from '../../../lib/api-errors';
import { ActionButton } from '../ui-v2/ActionButton';
import { RelationshipQueryError } from './RelationshipEvidence';
import { EpisodeRelationshipCanvas } from './EpisodeRelationshipCanvas';
import { RelationshipPeopleDirectory } from './RelationshipPeopleDirectory';
import type { EpisodeConnection, EpisodePerson } from './episode-relationship-layout';
import '../../../../styles/episode-relationships.css';

function parseEpisode(value: string | null) {
  if (!value || !/^\d+$/.test(value)) return undefined;
  const number = Number(value);
  return Number.isSafeInteger(number) && number > 0 ? number : undefined;
}

function ConnectionNames({ source, target, direction }: { source: string; target: string; direction: string }) {
  return <div className="episode-relationship-pair"><strong>{source}</strong>
    {direction === 'DIRECTED' ? <ArrowRight size={18} aria-label="에서" /> : direction === 'MUTUAL' ? <ArrowLeftRight size={18} aria-label="서로" /> : <span aria-label="와">—</span>}
    <strong>{target}</strong></div>;
}

export default function EpisodeRelationshipWorkspace({ workId, enabled }: { workId: string; enabled: boolean }) {
  const [params, setParams] = useSearchParams();
  const client = useQueryClient();
  const episodeNo = parseEpisode(params.get('relationEpisode'));
  const focusId = params.get('relationFocus') ?? '';
  const selectedId = params.get('relationEdge') ?? '';
  const counterpartKey = params.get('relationPeers') ?? '';
  const counterpartIds = counterpartKey ? counterpartKey.split(',').slice(0, 21) : [];
  const [editingSelection, setEditingSelection] = useState('');
  const session = usePrivateImageSession();
  const selectionTrigger = useRef<HTMLElement | null>(null);
  const scope = `${session}:${workId}:${episodeNo ?? 'latest'}`;
  const [searchState, setSearchState] = useState({ scope, value: '' });
  const search = searchState.scope === scope ? searchState.value : '';
  const setSearch = (value: string) => setSearchState({ scope, value });
  const [composing, setComposing] = useState(false);
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [searchPage, setSearchPage] = useState(0);
  const relationPage = parseEpisode(params.get('relationPeoplePage')) ?? 0;
  useEffect(() => {
    if (composing) return;
    const timer = window.setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => window.clearTimeout(timer);
  }, [search, composing, scope]);
  const graphOptions = exploreSelectedEpisodeRelationshipsOptions({ path: { workId }, query: { episodeNo, focusNodeId: focusId || undefined, counterpartNodeIds: counterpartIds.length ? counterpartIds : undefined, page: relationPage } });
  const graph = useQuery({ ...graphOptions, queryKey: [{ ...graphOptions.queryKey[0], tags: [`session:${session}`] }], gcTime: 0,
    enabled, refetchOnWindowFocus: true, refetchInterval: query => query.state.data?.data?.graph?.analysisStatus === 'PROCESSING' ? 10000 : false });
  const graphError = toApiError(graph.error);
  // Keep this query's successful data through temporary refresh failures, never access/removal errors.
  const canShowGraph = !graph.isError || !graphError || graphError.status >= 500;
  const exploration = canShowGraph ? graph.data?.data : undefined;
  const data = exploration?.graph;
  const selectionScope = `${scope}:${focusId}:${counterpartKey}`;
  const choosing = Boolean(exploration?.counterpartSelectionRequired || editingSelection === selectionScope);
  const directory = Boolean(exploration?.selectionRequired || choosing);
  const backToCounterparts = !directory && counterpartIds.length > 0;
  const listSearchKey = choosing ? 'relationPeerSearch' : 'relationSearch';
  const listPageKey = choosing ? 'relationPeerListPage' : 'relationListPage';
  const searchOptions = searchEpisodeRelationshipPeopleOptions({ path: { workId }, query: { episodeNo, query: debouncedSearch, page: searchPage, size: 20 } });
  const searching = Boolean(search.trim());
  const searchReady = !composing && debouncedSearch === search.trim();
  const searchResult = useQuery({ ...searchOptions, queryKey: [{ ...searchOptions.queryKey[0], tags: [`session:${session}`] }],
    enabled: enabled && Boolean(data) && !directory && searching && searchReady, gcTime: 0, refetchOnWindowFocus: true });
  const updateIncomplete = data?.updateIncomplete === true;
  const legacyPartial = data?.updateIncomplete == null && (data?.analysisStatus === 'PARTIAL' || data?.partial === true);
  const analysisFailed = data?.analysisStatus === 'FAILED' || data?.analysisStatus === 'INVALIDATED';
  const incomplete = updateIncomplete || legacyPartial || analysisFailed;
  const incompleteEpisodes = data?.incompleteEpisodeNos ?? [];
  const incompleteEpisodeLabel = incompleteEpisodes.slice(0, 3).map(number => `${number}화`).join(', ')
    + (incompleteEpisodes.length > 3 ? ` 외 ${incompleteEpisodes.length - 3}개 회차` : '');
  const selectedEpisode = data?.selectedEpisode;
  const people = useMemo<EpisodePerson[]>(() => (data?.nodes ?? []).flatMap(person => person.id && person.name ? [{
    id: person.id, name: person.name, description: person.description ?? undefined, registered: person.profileRegistered,
  }] : []), [data?.nodes]);
  const connections = useMemo<EpisodeConnection[]>(() => (data?.edges ?? []).flatMap(edge => edge.id && edge.sourceNodeId && edge.targetNodeId
    && ['DIRECTED', 'MUTUAL', 'UNDIRECTED'].includes(edge.direction ?? '') && (edge.status === 'ACTIVE' || edge.status === 'ENDED') ? [{
    id: edge.id, source: edge.sourceNodeId, target: edge.targetNodeId, label: edge.label ?? '관계', summary: edge.summary ?? '',
    direction: edge.direction!, ended: edge.status === 'ENDED',
  }] : []), [data?.edges]);
  const names = new Map(people.map(person => [person.id, person.name]));
  const effectiveFocus = names.has(focusId) ? focusId : '';
  const visibleConnections = useMemo(() => effectiveFocus
    ? connections.filter(edge => edge.source === effectiveFocus || edge.target === effectiveFocus) : connections, [connections, effectiveFocus]);
  const visiblePeople = useMemo(() => {
    if (!effectiveFocus) return people;
    const visibleIds = new Set([effectiveFocus, ...visibleConnections.flatMap(edge => [edge.source, edge.target])]);
    return people.filter(person => visibleIds.has(person.id));
  }, [people, effectiveFocus, visibleConnections]);
  const matching = searchReady && !searchResult.isError ? searchResult.data?.data?.content ?? [] : [];
  function update(values: Record<string, string | null>, replace = false) {
    setParams(previous => {
      const next = new URLSearchParams(previous);
      next.set('relationMode', 'people');
      for (const [key, value] of Object.entries(values)) { if (value === null) next.delete(key); else next.set(key, value); }
      return next;
    }, { replace });
  }
  function focus(id: string) { setSearch(''); setSearchPage(0); setEditingSelection(''); update({ relationFocus: id || null, relationEdge: null, relationPeoplePage: null, relationPeers: null, relationPeerSearch: null, relationPeerListPage: null }); }
  function select(id: string) {
    selectionTrigger.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    update({ relationEdge: id });
  }
  function closeDetail() {
    update({ relationEdge: null });
    requestAnimationFrame(() => {
      const trigger = selectionTrigger.current?.isConnected ? selectionTrigger.current : document.querySelector<HTMLElement>('[aria-label="관계도 회차"]');
      trigger?.focus({ preventScroll: true });
    });
  }
  if (!enabled) return <div className="relationship-empty"><p>작품을 선택하면 인물 관계도를 볼 수 있어요.</p></div>;
  return <div className="episode-relationships">
    <div className="episode-relationship-toolbar">
      {focusId && <ActionButton variant="secondary"
        title={backToCounterparts ? '연결 상대 선택으로 돌아가기' : '인물 선택으로 돌아가기'}
        onClick={() => backToCounterparts ? setEditingSelection(selectionScope) : focus('')}>
        <ArrowLeft size={16} aria-hidden="true" />뒤로가기
      </ActionButton>}
      <label>이 회차까지의 관계<select aria-label="관계도 회차" value={episodeNo ?? ''} onChange={event => {
        setSearch(''); setEditingSelection(''); update({ relationEpisode: event.target.value || null, relationFocus: null, relationEdge: null, relationPeoplePage: null, relationPeers: null, relationSearch: null, relationListPage: null, relationPeerSearch: null, relationPeerListPage: null });
      }}>
        <option value="">최신 분석 회차{!episodeNo && selectedEpisode?.episodeNo ? ` (${selectedEpisode.episodeNo}화)` : ''}</option>
        {(data?.availableEpisodes ?? []).map(episode => <option key={episode.id} value={episode.episodeNo}>{episode.episodeNo}화</option>)}
        {episodeNo && !(data?.availableEpisodes ?? []).some(episode => episode.episodeNo === episodeNo) && <option value={episodeNo}>{episodeNo}화</option>}
      </select></label>
      {!directory && <label>인물 찾기<input aria-label="관계도 인물 검색" value={search} onChange={event => { setSearch(event.target.value); setSearchPage(0); }} onCompositionStart={() => setComposing(true)} onCompositionEnd={() => setComposing(false)} placeholder="이름 또는 별칭으로 찾기" maxLength={100} disabled={!data} /></label>}
      <ActionButton variant="secondary" disabled={graph.isFetching} onClick={() => void Promise.all([graph.refetch(), client.invalidateQueries({ queryKey: searchEpisodeRelationshipPeopleQueryKey({ path: { workId } }) })])}>관계 새로고침</ActionButton>
      {data && focusId && !directory && (exploration?.focusEdgeCount ?? 0) >= 200 && <ActionButton variant="secondary" onClick={() => setEditingSelection(selectionScope)}>상대 선택 변경</ActionButton>}
    </div>
    {!directory && searching && data && <div className="episode-relationship-results" aria-label="인물 검색 결과" aria-busy={!searchReady || searchResult.isFetching}>
      {!searchReady || searchResult.isPending ? <p role="status">인물을 찾고 있어요.</p> : searchResult.isError
        ? <RelationshipQueryError title="인물을 찾지 못했어요. 다시 시도해 주세요." onRetry={() => void searchResult.refetch()} pending={searchResult.isFetching} />
        : matching.length ? matching.map(person => person.node?.id && <button type="button" key={person.node.id} onClick={() => focus(person.node!.id!)}>
          {person.node.name} 중심으로 보기</button>) : <p>이 회차까지 확인된 인물 중에는 없어요.</p>}
      {searchReady && !searchResult.isError && (searchPage > 0 || searchResult.data?.data?.hasNext) && <nav aria-label="인물 검색 페이지">
        <ActionButton variant="secondary" disabled={searchPage === 0 || searchResult.isFetching} onClick={() => setSearchPage(value => value - 1)}>이전 검색 결과</ActionButton>
        <span>{searchPage + 1}페이지</span>
        <ActionButton variant="secondary" disabled={!searchResult.data?.data?.hasNext || searchResult.isFetching} onClick={() => setSearchPage(value => value + 1)}>다음 검색 결과</ActionButton>
      </nav>}
    </div>}
    {graph.isPending && <p role="status">이 회차의 관계도를 불러오고 있어요.</p>}
    {graph.isError && <RelationshipQueryError title={data ? '관계도를 갱신하지 못했어요. 이전 내용을 표시하고 있어요.' : '이 회차의 관계도를 불러오지 못했어요.'}
      onRetry={() => void graph.refetch()} pending={graph.isFetching} />}
    {graph.isError && counterpartIds.length > 0 && <ActionButton variant="secondary" onClick={() => {
      setEditingSelection(''); update({ relationPeers: null, relationPeoplePage: null, relationEdge: null });
    }}>상대 다시 선택</ActionButton>}
    {data && <>
      {data.analysisStatus === 'PROCESSING' && <p role="status" className="relationship-muted">새 회차의 관계를 정리하고 있어요.</p>}
      {analysisFailed && <p role="status" className="relationship-notice">관계 분석을 마치지 못한 회차가 있어요. 분석 목록에서 진행 상황을 확인해 주세요.
        {incompleteEpisodeLabel && <> 미완료 회차: {incompleteEpisodeLabel}</>}</p>}
      <div className="episode-relationship-caption"><p>{selectedEpisode?.episodeNo ? <><strong>{selectedEpisode.episodeNo}화</strong>{incomplete ? '까지의 관계' : '까지 확인된 관계'}</> : '분석한 회차의 관계가 여기에 표시돼요.'}</p>
        <p>{choosing ? <>{exploration?.focusNode?.name} · 관계 {exploration?.focusEdgeCount}개</> : exploration?.selectionRequired ? <>인물 {exploration.totalNodeCount}명 · 관계 {data.totalEdgeCount}개</> : <>인물 {visiblePeople.length}명 · 관계 {visibleConnections.length}개{effectiveFocus && <> / 연결 {exploration?.scopeEdgeCount}개</>}</>}</p></div>
      {legacyPartial && !analysisFailed
        && <p className="relationship-muted" role="status">관계 분석에 반영하지 못한 내용이 있어요.</p>}
      {data.truncated && <p className="relationship-notice" role="status">관계가 많아 일부만 표시하고 있어요.</p>}
      {directory ? <RelationshipPeopleDirectory key={`${selectionScope}:${choosing ? 'counterparts' : 'people'}`}
        workId={workId} session={session} episodeNo={episodeNo} focusId={choosing ? focusId : undefined} focusName={exploration?.focusNode?.name}
        search={params.get(listSearchKey) ?? ''} page={parseEpisode(params.get(listPageKey)) ?? 0}
        onSearch={value => update({ [listSearchKey]: value || null, [listPageKey]: null }, true)}
        onPage={value => update({ [listPageKey]: value ? String(value) : null })} onFocus={focus}
        selectedPeople={exploration?.selectedPeople} maxPeople={exploration?.maxSelectedPeople ?? 20} maxEdges={exploration?.maxSelectedEdges ?? 200}
        onApply={ids => { setEditingSelection(''); update({ relationPeers: ids.sort().join(','), relationPeoplePage: null, relationEdge: null }); }}
        onCancel={editingSelection === selectionScope && !exploration?.counterpartSelectionRequired ? () => setEditingSelection('') : undefined}
      /> : !connections.length ? <div className="relationship-empty"><GitBranch size={28} aria-hidden="true" />
        <h3>{relationPage > 0 ? '이 페이지에 표시할 관계가 없어요.' : incomplete ? '표시할 관계를 아직 확인하지 못했어요.' : '아직 표시할 인물 관계가 없어요.'}</h3>
        <p>{relationPage > 0 ? '이전 관계 페이지로 돌아가 주세요.' : incomplete ? '관계가 없는 것으로 판단한 결과는 아니에요.' : '새 회차를 분석하면 근거가 확인된 관계가 자동으로 나타나요.'}</p></div> : <>
        <EpisodeRelationshipCanvas key={`${session}:${workId}:${selectedEpisode?.episodeNo}:${effectiveFocus}:${relationPage}`} people={visiblePeople} connections={visibleConnections}
          focusId={effectiveFocus} selectedId={selectedId} onFocus={focus} onSelect={select} />
      </>}
        {!directory && selectedId && selectedEpisode?.episodeNo && <EpisodeRelationshipDetail key={`${session}:${workId}:${selectedEpisode.episodeNo}:${selectedId}`}
          workId={workId} edgeId={selectedId} episodeNo={selectedEpisode.episodeNo}
          graphEdge={data.edges?.find(edge => edge.id === selectedId)} onClose={closeDetail} />}
        {!directory && effectiveFocus && (relationPage > 0 || exploration?.hasNext) && <nav className="episode-relationship-pagination" aria-label="연결 관계 페이지">
          <ActionButton variant="secondary" disabled={relationPage === 0 || graph.isFetching} onClick={() => update({ relationPeoplePage: relationPage > 1 ? String(relationPage - 1) : null, relationEdge: null })}>이전 관계</ActionButton>
          <span>{relationPage + 1} / {Math.max(1, Math.ceil((exploration?.scopeEdgeCount ?? 0) / (exploration?.pageSize ?? 200)))}</span>
          <ActionButton variant="secondary" disabled={!exploration?.hasNext || graph.isFetching} onClick={() => update({ relationPeoplePage: String(relationPage + 1), relationEdge: null })}>다음 관계</ActionButton>
        </nav>}

      {!directory && connections.length > 0 && <>
        <ul className="episode-relationship-list" aria-label="이 회차의 관계 목록">{visibleConnections.map(edge => <li key={edge.id}>
          <button type="button" className="episode-relationship-row" aria-pressed={selectedId === edge.id} onClick={() => select(edge.id)}>
            <div><ConnectionNames source={names.get(edge.source) ?? '인물'} target={names.get(edge.target) ?? '인물'} direction={edge.direction} />
              <p>{edge.label}{edge.ended ? ' · 종료된 관계' : ''}</p></div><span>근거 보기</span>
          </button></li>)}</ul>
      </>}

    </>}
  </div>;
}

function EpisodeRelationshipDetail({ workId, edgeId, episodeNo, graphEdge, onClose }: {
  workId: string; edgeId: string; episodeNo: number; graphEdge: Edge | undefined; onClose: () => void;
}) {
  const client = useQueryClient();
  const session = usePrivateImageSession();
  const detailOptions = getExploredRelationshipEdgeOptions({ path: { workId, edgeId }, query: { episodeNo } });
  const detail = useQuery({ ...detailOptions, queryKey: [{ ...detailOptions.queryKey[0], tags: [`session:${session}`] }], gcTime: 0, refetchOnWindowFocus: true });
  const correction = useMutation(updateEpisodeRelationshipEdgeMutation());
  const deletion = useMutation(deleteEpisodeRelationshipEdgeMutation());
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [draft, setDraft] = useState('');
  const [baseVersion, setBaseVersion] = useState<number>();
  const [error, setError] = useState<string | null>(null);
  const [conflict, setConflict] = useState(false);
  const mounted = useRef(true);
  const panel = useRef<HTMLElement>(null);
  useEffect(() => {
    mounted.current = true;
    panel.current?.scrollIntoView({ block: 'nearest', behavior: 'instant' });
    panel.current?.focus({ preventScroll: true });
    return () => { mounted.current = false; };
  }, []);
  const data = detail.data?.data;
  const verification = graphEdge?.updateIncomplete == null ? data?.edge : graphEdge;
  const busy = correction.isPending || deletion.isPending;
  const changed = baseVersion != null && data?.version != null && baseVersion !== data.version;
  async function refresh() {
    await Promise.all([
      client.invalidateQueries({ queryKey: exploreSelectedEpisodeRelationshipsQueryKey({ path: { workId } }) }),
      client.invalidateQueries({ queryKey: searchEpisodeRelationshipPeopleQueryKey({ path: { workId } }) }),
      client.invalidateQueries({ queryKey: getExploredRelationshipEdgeQueryKey({ path: { workId, edgeId } }) }),
    ]);
  }
  async function write(remove: boolean) {
    const version = baseVersion ?? data?.version;
    if (version == null || busy || changed || conflict) return;
    const epoch = privateImageSessionEpoch(); setError(null);
    try {
      if (remove) await deletion.mutateAsync({ path: { workId, edgeId }, query: { expectedVersion: version } });
      else await correction.mutateAsync({ path: { workId, edgeId }, body: { expectedVersion: version, summary: draft.trim() } });
      if (!mounted.current || epoch !== privateImageSessionEpoch()) return;
      setEditing(false); setDeleting(false); setBaseVersion(undefined);
      if (remove) onClose();
      await refresh();
    } catch (cause) {
      if (!mounted.current || epoch !== privateImageSessionEpoch()) return;
      if (toApiError(cause)?.status === 409) { setConflict(true); setError('다른 곳에서 이 관계가 변경됐어요. 입력은 유지했어요.'); void detail.refetch(); }
      else setError(remove ? '연결을 삭제하지 못했어요. 다시 시도해 주세요.' : '변경사항을 저장하지 못했어요. 입력은 유지했어요.');
    }
  }
  return <article className="episode-relationship-detail" aria-label="선택한 인물 관계" tabIndex={-1} ref={panel}>
    <header><span className="relationship-muted">{episodeNo}화까지의 관계 근거</span><ActionButton variant="ghost" size="compact" onClick={onClose} disabled={busy} icon={<X size={16} aria-hidden="true" />}>닫기</ActionButton></header>
    {detail.isPending && <p role="status">관계 근거를 불러오고 있어요.</p>}
    {detail.isError && <RelationshipQueryError title="관계 근거를 불러오지 못했어요." onRetry={() => void detail.refetch()} pending={detail.isFetching} />}
    {data && !detail.isError && <>
      <ConnectionNames source={data.sourceNode?.name ?? '인물'} target={data.targetNode?.name ?? '인물'} direction={data.edge?.direction ?? 'UNDIRECTED'} />
      <h3>{data.edge?.label}{data.edge?.status === 'ENDED' ? ' · 종료된 관계' : ''}</h3>
      {verification?.updateIncomplete && <p className="relationship-muted" role="status">
        {verification.lastVerifiedEpisodeNo != null && verification.lastVerifiedEpisodeNo > 0
          ? `마지막 확인: ${verification.lastVerifiedEpisodeNo}화. 이후 관계 업데이트를 마치지 못했어요.`
          : verification.lastVerifiedEpisodeNo === 0 ? '앞선 회차부터 관계 업데이트를 마치지 못했어요.' : '이 관계의 업데이트를 마치지 못했어요.'}
      </p>}
      {!editing && <p>{data.edge?.summary}</p>}
      {editing && <form className="episode-relationship-edit" onSubmit={event => { event.preventDefault(); void write(false); }}>
        <label>관계 설명<textarea value={draft} onChange={event => setDraft(event.target.value)} maxLength={500} disabled={busy} /></label>
        <p className="relationship-muted">분석에서 잘못 읽은 설명을 고쳐요. 모든 회차의 같은 관계 설명에 적용돼요.</p>
        <div className="episode-relationship-edit-actions"><ActionButton disabled={busy || changed || conflict || !draft.trim()} type="submit">{busy ? '저장 중…' : '변경사항 저장'}</ActionButton>
          <ActionButton variant="secondary" disabled={busy} onClick={() => { setEditing(false); setBaseVersion(undefined); setError(null); setConflict(false); }}>취소</ActionButton></div>
      </form>}
      {deleting && <div className="relationship-notice"><p>이 연결을 모든 회차의 관계도에서 삭제할까요? 인물과 원문은 유지돼요.</p>
        <div className="episode-relationship-edit-actions"><ActionButton className="is-danger" variant="secondary" disabled={busy || changed || conflict} onClick={() => void write(true)}>삭제하기</ActionButton>
          <ActionButton variant="ghost" disabled={busy} onClick={() => { setDeleting(false); setBaseVersion(undefined); setConflict(false); setError(null); }}>취소</ActionButton></div></div>}
      {error && <p role="alert" className="relationship-notice relationship-notice--error">{error}</p>}
      {(changed || conflict) && <div className="relationship-notice"><p>현재 저장된 설명: {data.edge?.summary}</p>
        <ActionButton variant="secondary" disabled={busy || detail.isFetching} onClick={() => { setBaseVersion(data.version); setConflict(false); setError(null); }}>변경 내용 확인</ActionButton></div>}
      <div aria-label="원문 근거">{(data.evidence ?? []).map(evidence => <div className="episode-relationship-evidence" key={`${evidence.episodeId}:${evidence.startOffset}:${evidence.endOffset}:${evidence.quote}`}>
        <span>{evidence.episodeNo}화{evidence.episodeTitle?.trim() && evidence.episodeTitle.trim() !== `${evidence.episodeNo}화` ? ` · ${evidence.episodeTitle}` : ''}</span><blockquote>{evidence.quote}</blockquote>
      </div>)}</div>
      {!editing && !deleting && <footer><ActionButton variant="ghost" size="compact" disabled={busy || data.version == null} icon={<Pencil size={14} aria-hidden="true" />}
        onClick={() => { setDraft(data.edge?.summary ?? ''); setBaseVersion(data.version); setEditing(true); setError(null); }}>설명 수정</ActionButton>
        <ActionButton variant="ghost" size="compact" className="is-danger" disabled={busy || data.version == null} icon={<Trash2 size={14} aria-hidden="true" />}
          onClick={() => { setBaseVersion(data.version); setDeleting(true); setError(null); }}>이 연결 삭제</ActionButton></footer>}
    </>}
  </article>;
}
