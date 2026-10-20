import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { X } from 'lucide-react';
import { getCharactersOptions } from '../../../api/generated/@tanstack/react-query.gen';
import { ActionButton } from '../ui-v2/ActionButton';
import { PageNavigation } from '../PageNavigation';
import { RelationshipQueryError } from './RelationshipEvidence';

export function RelationshipTargetPicker({ workId, subjectId, selectedId, mention, disabled, open, id, onClose, onSelect }: {
  workId: string; subjectId: string; selectedId: string; mention: string; disabled: boolean;
  open: boolean; id: string; onClose: () => void; onSelect: (id: string, name: string) => void;
}) {
  const panel = useRef<HTMLElement>(null);
  const [page, setPage] = useState(0);
  const query = useQuery({ ...getCharactersOptions({ path: { workId }, query: { page, size: 12 } }), enabled: open });
  const directory = query.data?.data;
  const choices = (directory?.content ?? []).filter(character => character.id !== subjectId);
  useEffect(() => {
    if (!open) return;
    panel.current?.scrollIntoView({ block: 'nearest', behavior: 'instant' });
    panel.current?.focus({ preventScroll: true });
  }, [open]);
  if (!open) return null;
  return <section className="relationship-target-picker family-profile-picker" ref={panel} id={id}
    tabIndex={-1} aria-labelledby={`${id}-heading`} onKeyDown={event => {
      if (event.key === 'Escape') { event.stopPropagation(); onClose(); }
    }}>
    <div className="family-profile-picker__heading">
      <h4 id={`${id}-heading`}>{mention}과 같은 인물 선택</h4>
      <ActionButton variant="ghost" size="compact" aria-label="선택 닫기" icon={<X size={16} aria-hidden="true" />} onClick={onClose}>닫기</ActionButton>
    </div>
    {query.isPending && <p role="status">인물을 불러오고 있어요.</p>}
    {query.isError && <RelationshipQueryError title="인물 목록을 불러오지 못했어요." onRetry={() => void query.refetch()} pending={query.isFetching} />}
    {query.isSuccess && <>
      <div className="relationship-character-choices">
        {choices.map(character => <button key={character.id} type="button" disabled={disabled || !character.id}
          aria-pressed={selectedId === character.id} onClick={() => {
            if (character.id) onSelect(character.id, character.name || '이름 없는 인물');
          }}>
          <strong>{character.name || '이름 없는 인물'}</strong>
          <span>{character.firstAppearanceEpisodeNo != null
            ? `첫 등장 ${character.firstAppearanceEpisodeNo}화` : '첫 등장 회차 미확인'}</span>
        </button>)}
      </div>
      {choices.length === 0 && <p>이 페이지에는 연결할 다른 인물이 없어요.</p>}
      <PageNavigation page={page} totalPages={directory?.totalPages ?? 0} disabled={disabled || query.isFetching} onPageChange={setPage} />
    </>}
    {selectedId && <ActionButton variant="ghost" size="compact" disabled={disabled} onClick={() => onSelect('', '')}>프로필 선택 해제</ActionButton>}
  </section>;
}
