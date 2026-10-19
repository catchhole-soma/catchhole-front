import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getCharactersOptions } from '../../../api/generated/@tanstack/react-query.gen';
import { ActionButton } from '../ui-v2/ActionButton';
import { PageNavigation } from '../PageNavigation';
import { RelationshipQueryError } from './RelationshipEvidence';

export function RelationshipTargetPicker({ workId, subjectId, selectedId, selectedName, disabled, onSelect }: {
  workId: string; subjectId: string; selectedId: string; selectedName: string;
  disabled: boolean; onSelect: (id: string, name: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [page, setPage] = useState(0);
  const query = useQuery({ ...getCharactersOptions({ path: { workId }, query: { page, size: 12 } }), enabled: open });
  const directory = query.data?.data;
  return <div className="relationship-target-picker">
    <div className="relationship-target-picker__summary">
      <span><strong>상대 인물</strong> · {selectedId ? selectedName || '연결된 인물' : '아직 연결되지 않았어요'}</span>
      <ActionButton variant="secondary" size="compact" disabled={disabled} aria-expanded={open}
        onClick={() => setOpen(!open)}>{open ? '인물 목록 접기' : '상대 인물 선택'}</ActionButton>
    </div>
    {open && <div className="relationship-target-picker__directory">
      <p className="relationship-muted">작품에 등록된 인물 중에서 선택해 주세요. 같은 이름이어도 서로 다른 인물일 수 있어요.</p>
      {query.isPending && <p role="status">인물을 불러오고 있어요.</p>}
      {query.isError && <RelationshipQueryError title="인물 목록을 불러오지 못했어요." onRetry={() => void query.refetch()} pending={query.isFetching} />}
      {query.isSuccess && <>
        <div className="relationship-character-choices">
          {(directory?.content ?? []).filter(character => character.id !== subjectId).map(character => <button
            key={character.id} type="button" disabled={disabled || !character.id}
            aria-pressed={selectedId === character.id} onClick={() => {
              if (character.id) { onSelect(character.id, character.name || '이름 없는 인물'); setOpen(false); }
            }}>
            <strong>{character.name || '이름 없는 인물'}</strong>
            <span>{character.representativeAttributeValue || (character.firstAppearanceEpisodeNo != null
              ? `첫 등장 ${character.firstAppearanceEpisodeNo}화` : '등록된 인물')}</span>
          </button>)}
        </div>
        {(directory?.content?.length ?? 0) === 0 && <p>등록된 인물이 없어요. 캐릭터 설정을 먼저 확인해 주세요.</p>}
        <PageNavigation page={page} totalPages={directory?.totalPages ?? 0} disabled={disabled || query.isFetching} onPageChange={setPage} />
      </>}
      {selectedId && <ActionButton variant="ghost" size="compact" disabled={disabled} onClick={() => onSelect('', '')}>연결을 보류하기</ActionButton>}
    </div>}
  </div>;
}
