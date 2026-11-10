import { useEffect, useRef, useState } from 'react';
import { GitBranch, Search } from 'lucide-react';
import type { PageResponseFamilyTreePerson } from '../../../api/generated/types.gen';
import { PageNavigation } from '../PageNavigation';

export function FamilyTreePeople({ people, totalEdges, search, page, pending, onSearch, onPage, onSelect }: {
  people?: PageResponseFamilyTreePerson | null; totalEdges: number; search: string; page: number; pending: boolean;
  onSearch: (query: string) => void; onPage: (page: number) => void; onSelect: (id: string) => void;
}) {
  const [input, setInput] = useState(search);
  const [composing, setComposing] = useState(false);
  const published = useRef<string>();
  useEffect(() => {
    if (published.current !== search) setInput(search);
    published.current = undefined;
  }, [search]);
  useEffect(() => {
    if (composing || input === search) return;
    const timer = window.setTimeout(() => { published.current = input; onSearch(input); }, 300);
    return () => window.clearTimeout(timer);
  }, [composing, input, search, onSearch]);
  const ready = !composing && input === search;
  return <section className="family-tree-picker" aria-label="가계도 인물 선택">
    <GitBranch size={28} aria-hidden="true" />
    <h3>어떤 인물의 가계도를 살펴볼까요?</h3>
    <p>전체 가족 관계 {totalEdges}개 · 인물을 선택하면 연결된 가족을 볼 수 있어요.</p>
    <label className="family-tree-picker-search">인물 찾기
      <span><Search size={16} aria-hidden="true" /><input aria-label="가계도 중심 인물 검색" value={input}
        onChange={event => setInput(event.target.value)} onCompositionStart={() => setComposing(true)}
        onCompositionEnd={event => { setInput(event.currentTarget.value); setComposing(false); }}
        maxLength={100} placeholder="이름으로 찾기" /></span>
    </label>
    <div aria-busy={!ready || pending}>
      {!ready || pending ? <p role="status">인물을 찾고 있어요.</p> : <>
        <p>{search.trim() ? '검색 결과' : '전체 인물'} {people?.totalElements ?? 0}명</p>
        <div className="family-tree-picker-grid">{people?.content?.map(person => person.id && <button
          type="button" key={person.id} onClick={() => onSelect(person.id!)} aria-label={`${person.name} 중심으로 보기`}>
          <strong>{person.name}</strong><span>연결된 가족 {person.familyCount ?? 0}명</span>
        </button>)}</div>
        {!people?.content?.length && <p>{page > 0 ? '이 페이지에 표시할 인물이 없어요. 이전 페이지로 돌아가 주세요.' : '해당하는 인물이 없어요.'}</p>}
      </>}
      {(page > 0 || (people?.totalPages ?? 0) > 1) && <PageNavigation page={page} totalPages={people?.totalPages ?? 0}
        disabled={!ready || pending} onPageChange={onPage} />}
    </div>
  </section>;
}
