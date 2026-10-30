import { useEffect, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Loader2, Search } from 'lucide-react';
import { getCharactersOptions } from '../../../api/generated/@tanstack/react-query.gen';
import type { CharacterSummaryResponse, SettingCandidateResponse } from '../../../api/generated/types.gen';
import { AutomaticApplicationNotice } from '../AutomaticApplicationNotice';
import { OrderedReviewImpactNotice } from '../OrderedReviewImpactNotice';
import { C } from '../constants';
import { PageNavigation } from '../PageNavigation';
import { REVIEW_TEXT } from '../review-v2-colors';
import { errorMessage, modalInputStyle } from './characterReviewFormat';
import { ActionButton, ModalLayer } from './ReviewModalControls';

export type MatchResolution = 'MATCH_EXISTING' | 'CREATE_NEW';

export function CharacterMatchModal({
  workId,
  candidate,
  initialResolution,
  pending,
  automaticPending = false,
  readOnly = false,
  error,
  groupCandidateCount,
  onClose,
  onSubmit,
}: {
  workId: string;
  candidate: SettingCandidateResponse;
  initialResolution: MatchResolution;
  pending: boolean;
  automaticPending?: boolean;
  readOnly?: boolean;
  error: string | null;
  groupCandidateCount?: number;
  onClose: () => void;
  onSubmit: (resolution: MatchResolution, value: string) => void;
}) {
  const [resolution, setResolution] = useState(initialResolution);
  const [page, setPage] = useState(0);
  const [search, setSearch] = useState('');
  const [selectedCharacterId, setSelectedCharacterId] = useState('');
  const [newCharacterName, setNewCharacterName] = useState(candidate.entityName ?? '');
  const [validationError, setValidationError] = useState<string | null>(null);
  const charactersQuery = useQuery({
    ...getCharactersOptions({ path: { workId }, query: { page, size: 8 } }),
    enabled: resolution === 'MATCH_EXISTING',
  });
  const characterPage = charactersQuery.data?.data;
  useEffect(() => {
    const matchedCharacterId = candidate.matchedCharacterId;
    if (!matchedCharacterId
      || !characterPage?.content?.some(character => character.id === matchedCharacterId)) {
      return;
    }
    setSelectedCharacterId(current => current || matchedCharacterId);
  }, [candidate.matchedCharacterId, characterPage?.content]);
  const characters = useMemo(() => {
    const keyword = search.trim().toLocaleLowerCase();
    const content = characterPage?.content ?? [];
    if (!keyword) return content;
    return content.filter(character => character.name?.toLocaleLowerCase().includes(keyword));
  }, [characterPage?.content, search]);
  const selectedCharacterVisible = characters.some(character => character.id === selectedCharacterId);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (pending || automaticPending || readOnly) return;
    if (resolution === 'MATCH_EXISTING' && !selectedCharacterVisible) {
      setValidationError('현재 목록에서 연결할 캐릭터를 선택해 주세요.');
      return;
    }
    const value = resolution === 'MATCH_EXISTING'
      ? selectedCharacterId
      : newCharacterName.trim();
    if (!value) {
      setValidationError(
        resolution === 'MATCH_EXISTING'
          ? '연결할 기존 캐릭터를 선택해 주세요.'
          : '새 캐릭터 이름을 입력해 주세요.',
      );
      return;
    }
    setValidationError(null);
    onSubmit(resolution, value);
  };

  return (
    <ModalLayer
      title={groupCandidateCount ? '캐릭터 일괄 연결' : '캐릭터 연결 확인'}
      description={groupCandidateCount
        ? `“${candidate.entityName || '이름 없음'}”의 검토 대기 설정 ${groupCandidateCount}개에 같은 연결 결정을 적용합니다.`
        : `“${candidate.rawEntityMention || candidate.entityName || '이름 없음'}” 후보가 누구인지 선택해 주세요.`}
      pending={pending}
      onClose={onClose}
    >
      <form className="review-modal__form" onSubmit={submit} noValidate>
        {readOnly && <p role="status">이전 분석 기록은 수정할 수 없습니다. 입력한 내용은 유지됩니다.</p>}
        {automaticPending && <AutomaticApplicationNotice source={candidate.source} />}
        {!automaticPending && candidate.manualReviewAvailable && <OrderedReviewImpactNotice />}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 7, marginTop: 20 }}>
          {([
            ['MATCH_EXISTING', '기존 캐릭터에 연결'],
            ['CREATE_NEW', '새 캐릭터로 등록'],
          ] as const).map(([value, label]) => (
            <ActionButton
              key={value}
              disabled={pending}
              tone={resolution === value ? C.primary : C.t3}
              ariaPressed={resolution === value}
              onClick={() => {
                setResolution(value);
                setValidationError(null);
              }}
            >
              {label}
            </ActionButton>
          ))}
        </div>

        {resolution === 'MATCH_EXISTING' ? (
          <div style={{ marginTop: 18 }}>
            <label htmlFor="character-page-search" style={{ color: REVIEW_TEXT.text, fontSize: 12 }}>
              현재 페이지에서 검색
            </label>
            <div style={{ position: 'relative', marginTop: 7 }}>
              <Search
                size={14}
                color={C.t3}
                style={{ position: 'absolute', left: 12, top: 13 }}
              />
              <input
                id="character-page-search"
                value={search}
                disabled={pending}
                onChange={event => {
                  setSearch(event.target.value);
                  setSelectedCharacterId('');
                  setValidationError(null);
                }}
                style={{ ...modalInputStyle, paddingLeft: 34 }}
              />
            </div>

            <div style={{
              minHeight: 180, maxHeight: 260, overflowY: 'auto',
              display: 'flex', flexDirection: 'column', gap: 7, marginTop: 12,
            }}>
              {charactersQuery.isPending ? (
                <div style={{ color: REVIEW_TEXT.muted, fontSize: 12, padding: 20, textAlign: 'center' }}>
                  <Loader2 size={15} className="spin" /> 캐릭터를 불러오는 중입니다.
                </div>
              ) : charactersQuery.isError ? (
                <div role="alert" style={{ color: REVIEW_TEXT.danger, fontSize: 12, padding: 20, textAlign: 'center' }}>
                  <div>{errorMessage(charactersQuery.error, '캐릭터 목록을 불러오지 못했습니다.')}</div>
                  <div style={{ marginTop: 10 }}>
                    <ActionButton
                      disabled={charactersQuery.isFetching}
                      tone={C.danger}
                      onClick={() => void charactersQuery.refetch()}
                    >
                      다시 불러오기
                    </ActionButton>
                  </div>
                </div>
              ) : characters.length === 0 ? (
                <div style={{ color: REVIEW_TEXT.muted, fontSize: 12, padding: 20, textAlign: 'center' }}>
                  현재 페이지에 조건과 맞는 캐릭터가 없습니다.
                </div>
              ) : characters.map((character: CharacterSummaryResponse) => (
                <button
                  key={character.id}
                  type="button"
                  className={`review-modal__choice${selectedCharacterId === character.id ? ' is-selected' : ''}`}
                  disabled={pending || !character.id}
                  aria-pressed={selectedCharacterId === character.id}
                  onClick={() => setSelectedCharacterId(character.id ?? '')}
                  style={{
                    minHeight: 48, borderRadius: 7, padding: '9px 12px',
                    border: `1px solid ${selectedCharacterId === character.id ? C.primary : C.border}`,
                    background: selectedCharacterId === character.id ? `${C.primary}14` : C.bg,
                    color: REVIEW_TEXT.ink, textAlign: 'left', fontFamily: 'inherit',
                    cursor: pending ? 'default' : 'pointer',
                  }}
                >
                  <strong style={{ fontSize: 13 }}>{character.name || '이름 없음'}</strong>
                  <span style={{ color: REVIEW_TEXT.muted, fontSize: 11, marginLeft: 8 }}>
                    {character.representativeAttributeLabel && character.representativeAttributeValue
                      ? `${character.representativeAttributeLabel} · ${character.representativeAttributeValue}`
                      : character.firstAppearanceEpisodeNo == null
                        ? '대표 정보 없음'
                        : `${character.firstAppearanceEpisodeNo}화 첫 등장`}
                  </span>
                </button>
              ))}
            </div>
            <PageNavigation
              page={characterPage?.page ?? page}
              totalPages={characterPage?.totalPages ?? 0}
              disabled={pending || charactersQuery.isFetching}
              onPageChange={nextPage => {
                setPage(nextPage);
                setSearch('');
                setSelectedCharacterId('');
              }}
            />
          </div>
        ) : (
          <div style={{ marginTop: 18 }}>
            <label htmlFor="new-character-name" style={{ color: REVIEW_TEXT.text, fontSize: 12 }}>
              새 캐릭터 이름
            </label>
            <input
              id="new-character-name"
              value={newCharacterName}
              disabled={pending}
              onChange={event => setNewCharacterName(event.target.value)}
              style={{ ...modalInputStyle, marginTop: 7 }}
            />
          </div>
        )}

        {(validationError || error) && (
          <div role="alert" style={{
            marginTop: 14, padding: '10px 12px', borderRadius: 7,
            border: `1px solid ${C.danger}55`, background: `${C.danger}12`,
            color: REVIEW_TEXT.danger, fontSize: 12,
          }}>
            {validationError ?? error}
          </div>
        )}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 22 }}>
          <ActionButton disabled={pending} onClick={onClose}>취소</ActionButton>
          <ActionButton type="submit" disabled={pending || automaticPending || readOnly} tone={C.primary}>
            {pending ? '연결 중…' : resolution === 'MATCH_EXISTING' ? '선택한 캐릭터에 연결' : '새 캐릭터로 등록'}
          </ActionButton>
        </div>
      </form>
    </ModalLayer>
  );
}
