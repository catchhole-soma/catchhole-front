import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { GitBranch, X } from 'lucide-react';
import { searchEpisodeRelationshipPeopleOptions } from '../../../api/generated/@tanstack/react-query.gen';
import type { Person } from '../../../api/generated/types.gen';
import { ActionButton } from '../ui-v2/ActionButton';
import { RelationshipQueryError } from './RelationshipEvidence';

type Props = {
  workId: string; episodeNo?: number; session: string | number; focusId?: string; focusName?: string;
  search: string; page: number; onSearch: (value: string) => void; onPage: (value: number) => void;
  onFocus: (id: string) => void; onApply: (ids: string[]) => void; onCancel?: () => void;
  selectedPeople?: Person[]; maxPeople: number; maxEdges: number;
};

export function RelationshipPeopleDirectory({ workId, episodeNo, session, focusId, focusName, search, page,
  onSearch, onPage, onFocus, onApply, onCancel, selectedPeople = [], maxPeople, maxEdges }: Props) {
  const [selected, setSelected] = useState(selectedPeople);
  const [input, setInput] = useState(search);
  const [composing, setComposing] = useState(false);
  const publishedSearch = useRef<string>();
  useEffect(() => {
    // Acknowledging our URL update must not overwrite newer keystrokes.
    // External navigation (including browser Back) still restores its search.
    if (publishedSearch.current !== search) setInput(search);
    publishedSearch.current = undefined;
  }, [search]);
  useEffect(() => {
    if (composing || input === search) return;
    const timer = window.setTimeout(() => {
      publishedSearch.current = input;
      onSearch(input);
    }, 300);
    return () => window.clearTimeout(timer);
  }, [input, search, composing, onSearch]);
  const ready = !composing && input === search;
  const options = searchEpisodeRelationshipPeopleOptions({ path: { workId },
    query: { episodeNo, focusNodeId: focusId, query: search.trim(), page, size: 24 } });
  const result = useQuery({ ...options, queryKey: [{ ...options.queryKey[0], tags: [`session:${session}`] }],
    enabled: ready, gcTime: 0, refetchOnWindowFocus: true });
  const people = ready && !result.isError ? result.data?.data?.content ?? [] : [];
  const currentSelected = selected.map(person => people.find(row => row.node?.id === person.node?.id) ?? person);
  const edgeCount = currentSelected.reduce((sum, person) => sum + (person.edgeCount ?? 0), 0);
  const oversizedPair = currentSelected.length === 1 && edgeCount > maxEdges;
  const overLimit = currentSelected.length > maxPeople || currentSelected.length > 1 && edgeCount > maxEdges;
  function toggle(person: Person) {
    setSelected(previous => previous.some(row => row.node?.id === person.node?.id)
      ? previous.filter(row => row.node?.id !== person.node?.id) : [...previous, person]);
  }
  return <section className="episode-relationship-entry" aria-label={focusId ? '연결 상대 선택' : '관계도 인물 선택'}>
    <GitBranch size={28} aria-hidden="true" />
    <h3>{focusId ? `${focusName ?? '선택한 인물'}와 어떤 인물의 관계를 볼까요?` : '어떤 인물의 관계를 살펴볼까요?'}</h3>
    <p>{focusId ? `함께 볼 상대를 골라 주세요. 최대 ${maxPeople}명 · 관계 ${maxEdges}개까지 볼 수 있어요.`
      : '관계가 있는 모든 인물을 관계 수가 많은 순서로 볼 수 있어요.'}</p>
    <label className="episode-relationship-directory-search">{focusId ? '연결 상대 찾기' : '인물 찾기'}
      <input aria-label={focusId ? '연결 상대 검색' : '관계도 인물 검색'} value={input}
        onChange={event => setInput(event.target.value)} onCompositionStart={() => setComposing(true)}
        onCompositionEnd={event => { setInput(event.currentTarget.value); setComposing(false); }}
        maxLength={100} placeholder="이름 또는 별칭으로 찾기" />
    </label>
    {focusId && <div className="episode-relationship-selection-bar">
      <strong aria-live="polite">선택한 인물 {currentSelected.length}명 · 관계 {edgeCount}개</strong>
      {currentSelected.length > 0 && <div className="episode-relationship-selected-people" aria-label="선택한 상대">
        {currentSelected.map(person => <button type="button" key={person.node?.id} onClick={() => toggle(person)} aria-label={`${person.node?.name} 선택 해제`}>
          {person.node?.name}<X size={14} aria-hidden="true" />
        </button>)}
      </div>}
      {oversizedPair && <p>이 상대와의 관계는 {maxEdges}개씩 나눠 보여드려요. 다른 상대는 함께 선택할 수 없어요.</p>}
      {overLimit && <p role="alert">관계 수가 변경됐어요. 선택을 줄이거나 한 명만 선택해 주세요.</p>}
      <div className="episode-relationship-selection-actions">
        <ActionButton disabled={!currentSelected.length || overLimit || result.isFetching || !ready || result.isError}
          onClick={() => onApply(currentSelected.flatMap(person => person.node?.id ? [person.node.id] : []))}>관계 보기</ActionButton>
        {selected.length > 0 && <ActionButton variant="secondary" onClick={() => setSelected([])}>선택 해제</ActionButton>}
        {onCancel && <ActionButton variant="ghost" onClick={onCancel}>취소</ActionButton>}
      </div>
    </div>}
    <div aria-label="인물 검색 결과" aria-busy={!ready || result.isFetching}>
      {!ready || result.isPending ? <p role="status">인물을 찾고 있어요.</p> : result.isError
        ? <RelationshipQueryError title="인물을 찾지 못했어요. 다시 시도해 주세요." onRetry={() => void result.refetch()} pending={result.isFetching} />
        : <>
          <p className="relationship-muted">{search.trim() ? '검색 결과' : focusId ? '연결 상대' : '전체 인물'} {result.data?.data?.totalElements ?? people.length}명</p>
          <div className="episode-relationship-suggestions">
            {people.map(person => {
              if (!person.node?.id) return null;
              const checked = currentSelected.some(row => row.node?.id === person.node?.id);
              const blocked = !checked && (currentSelected.length >= maxPeople
                || currentSelected.length > 0 && edgeCount + (person.edgeCount ?? 0) > maxEdges);
              return focusId ? <label key={person.node.id} className={`episode-relationship-person-choice${checked ? ' is-selected' : ''}${blocked ? ' is-disabled' : ''}`}>
                <input type="checkbox" checked={checked} disabled={blocked} aria-label={`${person.node.name} 선택`}
                  onChange={() => toggle(person)} />
                <span><strong>{person.node.name}</strong><small>관계 {person.edgeCount ?? 0}개{blocked ? ' · 선택 한도 초과' : ''}</small></span>
              </label> : <button type="button" key={person.node.id} aria-label={`${person.node.name} 중심으로 보기`} onClick={() => onFocus(person.node!.id!)}>
                <strong>{person.node.name}</strong><span>관계 {person.edgeCount ?? 0}개</span>
              </button>;
            })}
          </div>
          {!people.length && <p>{page > 0 ? '이 페이지에 표시할 인물이 없어요. 이전 페이지로 돌아가 주세요.' : '이 회차까지 확인된 인물 중에는 없어요.'}</p>}
        </>}
      {ready && !result.isError && (page > 0 || result.data?.data?.hasNext) && <nav className="episode-relationship-pagination" aria-label="인물 목록 페이지">
        <ActionButton variant="secondary" disabled={page === 0 || result.isFetching} onClick={() => onPage(page - 1)}>이전 인물</ActionButton>
        <span>{page + 1} / {Math.max(1, result.data?.data?.totalPages ?? 1)}</span>
        <ActionButton variant="secondary" disabled={!result.data?.data?.hasNext || result.isFetching} onClick={() => onPage(page + 1)}>다음 인물</ActionButton>
      </nav>}
    </div>
  </section>;
}
