import { useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'react-router';
import { ArrowLeftRight, ArrowRight, GitBranch, Pencil, Trash2, X } from 'lucide-react';
import { getEpisodeRelationshipGraphOptions, getEpisodeRelationshipGraphQueryKey, getEpisodeRelationshipEdgeOptions,
  getEpisodeRelationshipEdgeQueryKey, updateEpisodeRelationshipEdgeMutation, deleteEpisodeRelationshipEdgeMutation } from '../../../api/generated/@tanstack/react-query.gen';
import { privateImageSessionEpoch, usePrivateImageSession } from '../../../lib/private-image-session';
import { toApiError } from '../../../lib/api-errors';
import { ActionButton } from '../ui-v2/ActionButton';
import { RelationshipQueryError } from './RelationshipEvidence';
import { EpisodeRelationshipCanvas } from './EpisodeRelationshipCanvas';
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
  const episodeNo = parseEpisode(params.get('relationEpisode'));
  const focusId = params.get('relationFocus') ?? '';
  const selectedId = params.get('relationEdge') ?? '';
  const session = usePrivateImageSession();
  const selectionTrigger = useRef<HTMLElement | null>(null);
  const [search, setSearch] = useState('');
  const graphOptions = getEpisodeRelationshipGraphOptions({ path: { workId }, query: episodeNo ? { episodeNo } : undefined });
  const graph = useQuery({ ...graphOptions, queryKey: [{ ...graphOptions.queryKey[0], tags: [`session:${session}`] }], gcTime: 0,
    enabled, refetchOnWindowFocus: true, refetchInterval: query => !episodeNo || query.state.data?.data?.analysisStatus === 'PROCESSING' ? 10000 : false });
  const graphError = toApiError(graph.error);
  // Keep this query's successful data through temporary refresh failures, never access/removal errors.
  const canShowGraph = !graph.isError || !graphError || graphError.status >= 500;
  const data = canShowGraph ? graph.data?.data : undefined;
  const partialAnalysis = data?.analysisStatus === 'PARTIAL' || data?.partial === true;
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
  const matching = search.trim() ? people.filter(person => person.name.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase())) : [];
  function update(values: Record<string, string | null>) {
    setParams(previous => {
      const next = new URLSearchParams(previous);
      for (const [key, value] of Object.entries(values)) { if (value === null) next.delete(key); else next.set(key, value); }
      return next;
    });
  }
  function focus(id: string) { setSearch(''); update({ relationFocus: id || null, relationEdge: null }); }
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
      <label>이 회차까지의 관계<select aria-label="관계도 회차" value={episodeNo ?? ''} onChange={event => {
        setSearch(''); update({ relationEpisode: event.target.value || null, relationFocus: null, relationEdge: null });
      }}>
        <option value="">최신 분석 회차{!episodeNo && selectedEpisode?.episodeNo ? ` (${selectedEpisode.episodeNo}화)` : ''}</option>
        {(data?.availableEpisodes ?? []).map(episode => <option key={episode.id} value={episode.episodeNo}>{episode.episodeNo}화</option>)}
        {episodeNo && !(data?.availableEpisodes ?? []).some(episode => episode.episodeNo === episodeNo) && <option value={episodeNo}>{episodeNo}화</option>}
      </select></label>
      <label>인물 찾기<input aria-label="관계도 인물 검색" value={search} onChange={event => setSearch(event.target.value)} placeholder="이름으로 연결 찾기" disabled={!data} /></label>
      {effectiveFocus && <ActionButton variant="secondary" onClick={() => focus('')}>전체 인물 보기</ActionButton>}
    </div>
    {search.trim() && data && <div className="episode-relationship-results" aria-label="인물 검색 결과">
      {matching.length ? matching.map(person => <button type="button" key={person.id} onClick={() => focus(person.id)}>{person.name} 중심으로 보기</button>) : <p>이 회차까지 확인된 인물 중에는 없어요.</p>}
    </div>}
    {graph.isPending && <p role="status">이 회차의 관계도를 불러오고 있어요.</p>}
    {graph.isError && <RelationshipQueryError title={data ? '관계도를 갱신하지 못했어요. 이전 내용을 표시하고 있어요.' : '이 회차의 관계도를 불러오지 못했어요.'}
      onRetry={() => void graph.refetch()} pending={graph.isFetching} />}
    {data && <>
      {data.analysisStatus === 'PROCESSING' && <p role="status" className="relationship-muted">새 회차의 관계를 정리하고 있어요.</p>}
      {(data.analysisStatus === 'FAILED' || data.analysisStatus === 'INVALIDATED') && <p role="status" className="relationship-notice">관계 분석을 마치지 못한 회차가 있어요. 분석 목록에서 진행 상황을 확인해 주세요.</p>}
      <div className="episode-relationship-caption"><p>{selectedEpisode?.episodeNo ? <><strong>{selectedEpisode.episodeNo}화</strong>까지 확인된 관계</> : '분석한 회차의 관계가 여기에 표시돼요.'}</p>
        <p>인물 {visiblePeople.length}명 · 관계 {visibleConnections.length}개</p></div>
      {partialAnalysis && data.analysisStatus !== 'FAILED' && data.analysisStatus !== 'INVALIDATED'
        && <p className="relationship-muted" role="status">관계 분석에 반영하지 못한 내용이 있어요.</p>}
      {data.truncated && <p className="relationship-notice" role="status">관계가 많아 일부만 표시하고 있어요.</p>}
      {!connections.length ? <div className="relationship-empty"><GitBranch size={28} aria-hidden="true" /><h3>아직 표시할 인물 관계가 없어요.</h3>
        <p>새 회차를 분석하면 근거가 확인된 관계가 자동으로 나타나요.</p></div> : <>
        <EpisodeRelationshipCanvas key={`${session}:${workId}:${selectedEpisode?.episodeNo}:${effectiveFocus}`} people={visiblePeople} connections={visibleConnections}
          focusId={effectiveFocus} selectedId={selectedId} onFocus={focus} onSelect={select} />
        {selectedId && selectedEpisode?.episodeNo && <EpisodeRelationshipDetail key={`${session}:${workId}:${selectedEpisode.episodeNo}:${selectedId}`}
          workId={workId} edgeId={selectedId} episodeNo={selectedEpisode.episodeNo} onClose={closeDetail} />}
        <ul className="episode-relationship-list" aria-label="이 회차의 관계 목록">{visibleConnections.map(edge => <li key={edge.id}>
          <button type="button" className="episode-relationship-row" aria-pressed={selectedId === edge.id} onClick={() => select(edge.id)}>
            <div><ConnectionNames source={names.get(edge.source) ?? '인물'} target={names.get(edge.target) ?? '인물'} direction={edge.direction} />
              <p>{edge.label}{edge.ended ? ' · 종료된 관계' : ''}</p></div><span>근거 보기</span>
          </button></li>)}</ul>
      </>}
    </>}
  </div>;
}

function EpisodeRelationshipDetail({ workId, edgeId, episodeNo, onClose }: { workId: string; edgeId: string; episodeNo: number; onClose: () => void }) {
  const client = useQueryClient();
  const session = usePrivateImageSession();
  const detailOptions = getEpisodeRelationshipEdgeOptions({ path: { workId, edgeId }, query: { episodeNo } });
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
  const busy = correction.isPending || deletion.isPending;
  const changed = baseVersion != null && data?.version != null && baseVersion !== data.version;
  async function refresh() {
    await Promise.all([
      client.invalidateQueries({ queryKey: getEpisodeRelationshipGraphQueryKey({ path: { workId } }) }),
      client.invalidateQueries({ queryKey: getEpisodeRelationshipEdgeQueryKey({ path: { workId, edgeId } }) }),
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
