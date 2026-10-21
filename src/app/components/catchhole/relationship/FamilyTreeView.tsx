import { useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { ArrowRight, Check, ChevronDown, CircleHelp, GitBranch, History, Search } from 'lucide-react';
import { getCharactersOptions, getFamilyTreeOptions } from '../../../api/generated/@tanstack/react-query.gen';
import { useAppNavigate } from '../../../hooks/useAppNavigate';
import { ActionButton } from '../ui-v2/ActionButton';
import { PageNavigation } from '../PageNavigation';
import { RelationshipQueryError } from './RelationshipEvidence';
import { layoutFamilyTree, type FamilyTreeInput } from './family-tree-layout';
import { FamilyTreeCanvas } from './FamilyTreeCanvas';
import '../../../../styles/family-tree-v2.css';

const compactQuery = '(max-width: 600px)';
function subscribeCompactCanvas(listener: () => void) {
  const query = window.matchMedia(compactQuery);
  query.addEventListener('change', listener);
  return () => query.removeEventListener('change', listener);
}
const compactSnapshot = () => window.matchMedia(compactQuery).matches;

export default function FamilyTreeView({ workId, focusCharacterId, includeHistorical, selectedRelationshipId, selectedCandidateId, onScopeChange, onOpenCharacter, onOpenRelationship, onOpenMention, onReview, onList }: {
  workId: string; focusCharacterId: string; includeHistorical: boolean; selectedRelationshipId: string; selectedCandidateId: string;
  onScopeChange: (focus: string, history: boolean) => void; onOpenCharacter: (id: string) => void;
  onOpenRelationship: (id: string) => void; onOpenMention: (id: string) => void; onReview: () => void; onList: () => void;
}) {
  const navigate = useAppNavigate();
  const compact = useSyncExternalStore(subscribeCompactCanvas, compactSnapshot, () => false);
  const graph = useQuery({ ...getFamilyTreeOptions({ path: { workId }, query: { includeHistorical, limit: 100, ...(focusCharacterId ? { focusCharacterId } : {}) } }),
    refetchOnWindowFocus: true, refetchInterval: 5000 });
  const data = graph.data?.data;
  const images = useMemo(() => new Map((data?.nodes ?? []).map(node => [node.id ?? '', node.image])), [data?.nodes]);
  const [search, setSearch] = useState('');
  const input = useMemo<FamilyTreeInput>(() => ({
    nodes: (data?.nodes ?? []).flatMap(node => node.id && node.name != null ? [{ id: node.id, name: node.name,
      nodeType: node.nodeType, characterId: node.characterId, candidateId: node.candidateId ?? node.candidateIds?.[0],
      candidateIds: node.candidateIds, mentionGroupId: node.mentionGroupId }] : []),
    edges: (data?.edges ?? []).flatMap(edge => {
      const subject = edge.subjectNodeId ?? edge.subjectCharacterId, object = edge.objectNodeId ?? edge.objectCharacterId;
      return edge.id && subject && object && (edge.kind === 'PARENT_OF' || edge.kind === 'SPOUSE' || edge.kind === 'SIBLING' || edge.kind === 'ANCESTOR_OF') ? [{
        id: edge.id, subjectCharacterId: subject, objectCharacterId: object, kind: edge.kind,
        generationGap: edge.generationGap,
        subjectRole: edge.subjectRole, objectRole: edge.objectRole, sourceType: edge.sourceType, relationshipId: edge.relationshipId, candidateId: edge.candidateId,
        subtype: edge.subtype, temporalScope: edge.temporalScope, timeLabel: edge.timeLabel ?? undefined,
      }] : [];
    }),
  }), [data?.nodes, data?.edges]);
  const layout = useQuery({ queryKey: ['family-tree-layout', workId, compact, input], queryFn: () => layoutFamilyTree(input, compact ? { nodeWidth: 136, nodeHeight: 88 } : {}),
    enabled: Boolean(data), staleTime: Infinity, gcTime: 60000, retry: false, placeholderData: keepPreviousData });
  const warnings = [...new Map((layout.data?.warnings ?? []).map(warning => [JSON.stringify(warning), warning])).entries()];
  const matching = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();
    return query ? (data?.nodes ?? []).filter(node => node.name?.toLocaleLowerCase().includes(query)) : [];
  }, [data?.nodes, search]);
  const searchMatchIds = useMemo(() => new Set(matching.flatMap(node => node.id ? [node.id] : [])), [matching]);
  return <div className="family-tree-view">
    <aside className="family-tree-upload-guide" aria-label="설정집으로 가계도 채우기">
      <div>
        <h3>설정집으로 가계도를 채워 보세요</h3>
        <p>가족 관계를 적은 설정집을 분석하면, 확인된 관계가 가계도에 반영돼요.</p>
      </div>
      <ActionButton variant="secondary" icon={<ArrowRight size={16} aria-hidden="true" />}
        onClick={() => navigate(`/dashboard?workId=${encodeURIComponent(workId)}&nav=settingDB&tab=worldrules&modal=setting-book-upload`, 'dissolve')}>
        설정집 업로드하기
      </ActionButton>
    </aside>
    <div className="family-tree-toolbar">
      <label className="family-tree-search"><Search size={16} aria-hidden="true" /><input aria-label="가계도 인물 검색" placeholder="가계도에서 인물 찾기" value={search} onChange={event => setSearch(event.target.value)} /></label>
      <ActionButton variant="secondary" className="family-tree-history" aria-pressed={includeHistorical} onClick={() => onScopeChange(focusCharacterId, !includeHistorical)}>
        {includeHistorical ? <Check size={16} aria-hidden="true" /> : <History size={16} aria-hidden="true" />}
        과거 관계 포함
      </ActionButton>
      {focusCharacterId && <ActionButton variant="secondary" onClick={() => { setSearch(''); onScopeChange('', includeHistorical); }}>작품 전체 보기</ActionButton>}
      <FamilyDirectory workId={workId} onSelect={id => { setSearch(''); onScopeChange(id, includeHistorical); }} />
    </div>
    {search.trim() && <div className="family-tree-search-results" aria-label="가계도 인물 검색 결과">
      {matching.length ? matching.map(node => {
        const candidateId = node.candidateId ?? node.candidateIds?.[0];
        return <button type="button" key={node.id} data-candidate-id={node.nodeType === 'MENTION' ? candidateId : undefined} onClick={() => { if (node.nodeType === 'MENTION') { if (candidateId) onOpenMention(candidateId); } else if (node.characterId ?? node.id) { setSearch(''); onScopeChange((node.characterId ?? node.id)!, includeHistorical); } }}>{node.name} {node.nodeType === 'MENTION' ? '설정 근거 보기' : '중심으로 보기'}</button>;
      })
        : <p>지금 보이는 가계도에는 해당 이름이 없어요. ‘특정 인물 중심으로 보기’에서 찾아 주세요.</p>}
    </div>}
    {graph.isPending && <p role="status">가계도를 불러오고 있어요.</p>}
    {graph.isError && <RelationshipQueryError title="가계도를 불러오지 못했어요." onRetry={() => void graph.refetch()} pending={graph.isFetching} />}
    {data && <div hidden={graph.isError}>
      <div className="family-tree-summary"><span>인물 <strong>{data.nodes?.length ?? 0}</strong>명 · 관계 <strong>{data.edges?.length ?? 0}</strong>개{focusCharacterId ? ' · 연결된 가족' : ''}</span>
        <details className="family-tree-help">
          <summary><CircleHelp size={16} aria-hidden="true" />가계도 안내<ChevronDown size={14} aria-hidden="true" /></summary>
          <div className="family-tree-help-panel">
            <p>호칭이 명시된 경우 아버지·어머니, 아들·딸로 표시해요. 알 수 없으면 부모·자녀로 표시해요.</p>
            <p>부모는 위에, 자녀는 아래에 표시돼요. 좌우 순서는 나이나 성별을 뜻하지 않아요.</p>
            <div className="family-tree-legend" aria-label="가계도 범례"><span><i className="family-tree-legend-line" />부모·자녀</span><span><i className="family-tree-legend-line is-spouse" />배우자</span><span><i className="family-tree-legend-line is-adoptive" />입양</span>
              {input.edges.some(edge => edge.kind === 'ANCESTOR_OF') && <span><b aria-hidden="true">∕∕</b>조상·후손 · 중간 계보 생략</span>}<span>과거 관계는 ‘과거’로 표시</span></div>
            <p>등록된 인물을 누르면 프로필을, ‘프로필 미등록’ 인물을 누르면 근거를 열어요. 선이나 관계 이름을 눌러도 근거를 볼 수 있어요.</p>
            <p>프로필이 등록되지 않은 인물도 연결 없이 표시돼요. 등록된 인물에 연결하려면 ‘확인·연결’에서 선택해 주세요.</p>
          </div>
        </details>
      </div>
      {data.truncated && <div className="relationship-notice" role="status">전체 관계 {data.totalEdgeCount}개 중 {data.edges?.length}개를 보여주고 있어요. 일부 가족 연결이 생략될 수 있어요. 인물을 선택해 범위를 좁혀 주세요. 등록된 인물끼리의 관계는 목록에서, 프로필이 등록되지 않은 인물은 확인·연결에서 볼 수 있어요.
        <ActionButton variant="secondary" onClick={onList}>가족 관계 목록</ActionButton><ActionButton variant="secondary" onClick={onReview}>확인·연결 보기</ActionButton></div>}
      {(data.nodes?.length ?? 0) === 0 ? <div className="relationship-empty"><GitBranch size={30} aria-hidden="true" /><h3>아직 가계도에 표시할 관계가 없어요.</h3>
        <p>명확하게 확인된 현재 가족 관계를 보여줘요. 과거 관계는 위의 옵션으로 볼 수 있고, 확인이 필요한 내용은 따로 검토할 수 있어요.</p>
        <ActionButton variant="secondary" onClick={onReview}>확인할 관계 보기</ActionButton></div> : <>
        {layout.isError && <RelationshipQueryError title="가계도 배치를 만들지 못했어요. 목록에서도 관계를 확인할 수 있어요." onRetry={() => void layout.refetch()} pending={layout.isFetching} />}
        {!layout.data && layout.isPending && <p role="status">가계도 배치를 정리하고 있어요.</p>}
        {layout.data && <FamilyTreeCanvas layout={layout.data} images={images} scopeKey={`${workId}:${focusCharacterId}:${includeHistorical}:${compact}`} ready={!layout.isPlaceholderData && !layout.isError}
          focusCharacterId={focusCharacterId} searchMatchIds={searchMatchIds}
          selectedRelationshipId={selectedRelationshipId} selectedCandidateId={selectedCandidateId} onOpenCharacter={onOpenCharacter} onOpenRelationship={onOpenRelationship} onOpenMention={onOpenMention} />}
        {!!layout.data?.warnings.length && <div className="relationship-notice" role="status">{warnings.map(([key, warning]) => <p key={key}>{warning.message}</p>)}</div>}
      </>}
    </div>}
  </div>;
}

function FamilyDirectory({ workId, onSelect }: { workId: string; onSelect: (id: string) => void }) {
  const [open, setOpen] = useState(false);
  const [page, setPage] = useState(0);
  const directory = useQuery({ ...getCharactersOptions({ path: { workId }, query: { page, size: 12 } }), enabled: open });
  const totalPages = directory.data?.data?.totalPages;
  useEffect(() => {
    if (totalPages != null && page > 0 && page >= totalPages) setPage(Math.max(0, totalPages - 1));
  }, [page, totalPages]);
  return <div className="family-tree-directory">
    <ActionButton variant="secondary" aria-expanded={open} onClick={() => setOpen(!open)}>특정 인물 중심으로 보기</ActionButton>
    {open && <div className="family-tree-directory-panel">
      <p>인물을 선택하면 연결된 가족을 보여줘요.</p>
      {directory.isPending && <p role="status">인물을 불러오고 있어요.</p>}
      {directory.isError && <RelationshipQueryError title="인물 목록을 불러오지 못했어요." onRetry={() => void directory.refetch()} />}
      <div className="relationship-character-choices">{(directory.data?.data?.content ?? []).map(node => <button key={node.id} type="button" onClick={() => { if (node.id) { onSelect(node.id); setOpen(false); } }}>{node.name} 중심으로 보기</button>)}</div>
      {directory.isSuccess && !directory.data.data?.content?.length && <p>등록된 인물이 없어요.</p>}
      <PageNavigation page={page} totalPages={directory.data?.data?.totalPages ?? 0} disabled={directory.isFetching} onPageChange={setPage} />
      <ActionButton variant="ghost" onClick={() => setOpen(false)}>인물 목록 닫기</ActionButton>
    </div>}
  </div>;
}
