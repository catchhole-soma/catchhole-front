import { useEffect, useState } from 'react';
import type { FormEvent, ReactNode } from 'react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { Search } from 'lucide-react';
import { getCharactersOptions } from '../../../api/generated/@tanstack/react-query.gen';
import type { CharacterSummaryResponse, SettingCandidateResponse } from '../../../api/generated/types.gen';
import { isUnidentifiedCharacterName, normalizeCharacterGroupName } from '../../../lib/setting-review-groups';
import { AutomaticApplicationNotice } from '../AutomaticApplicationNotice';
import { OrderedReviewImpactNotice } from '../OrderedReviewImpactNotice';
import { C } from '../constants';
import { PageNavigation } from '../PageNavigation';
import { REVIEW_TEXT } from '../review-v2-colors';
import { analysisSourceLabel } from '../../../lib/analysis-source';
import { useCharacterSettingLabels } from '../character/CharacterSettingLabelProvider';
import { CHARACTER_SEARCH_MAX_LENGTH as SEARCH_MAX_LENGTH, candidateEpisodesLabel, errorMessage, modalInputStyle, toSettingDisplay } from './characterReviewFormat';
import { CharacterLinkPreview } from './CharacterLinkPreview';
import { ActionButton, ModalLayer } from './ReviewModalControls';

export type MatchResolution = 'MATCH_EXISTING' | 'CREATE_NEW';

/** 서버 검색 요청은 입력이 멈춘 뒤 한 번만 보낸다. */
const SEARCH_DEBOUNCE_MS = 300;
const SEARCH_PAGE_SIZE = 8;

/** 검색어와 일치한 이름 부분을 표시한다. 일치 위치를 찾지 못하면 이름을 그대로 쓴다. */
function highlightedName(name: string, keyword: string): ReactNode {
  if (!keyword) return name;
  const index = name.toLocaleLowerCase().indexOf(keyword.toLocaleLowerCase());
  if (index < 0) return name;
  return <>{name.slice(0, index)}<mark>{name.slice(index, index + keyword.length)}</mark>{name.slice(index + keyword.length)}</>;
}

/** 결과 행의 구분 정보. 서버가 주지 않은 값은 만들지 않고, 첫 등장이 없을 때만 그 사실을 문장으로 남긴다. */
function characterFacts(character: CharacterSummaryResponse): string[] {
  return [
    character.firstAppearanceEpisodeNo == null ? '첫 등장 정보 없음' : `첫 등장 ${character.firstAppearanceEpisodeNo}화`,
    character.roleLabel?.trim() || null,
    character.representativeAttributeLabel && character.representativeAttributeValue
      ? `${character.representativeAttributeLabel} ${character.representativeAttributeValue}` : null,
  ].filter((fact): fact is string => Boolean(fact));
}

/** 무엇을 연결하는지 모달 맨 위에서 다시 보여 준다. 카드로 돌아가지 않고 대상과 대조하기 위함이다. */
function LinkSubjectSummary({ candidates, grouped, selection }: { candidates: SettingCandidateResponse[]; grouped: boolean; selection: boolean }) {
  const labels = useCharacterSettingLabels();
  const first = candidates[0];
  if (!first) return null;
  if (selection) {
    return <div className="review-match-summary" role="group" aria-label="연결할 설정">
      <strong>선택 {candidates.length}개</strong>
      {candidateEpisodesLabel(candidates) && <span>{candidateEpisodesLabel(candidates)}</span>}
      <span>적용: 연결만(내용과 반영 방식은 각 설정에서 결정해요)</span>
    </div>;
  }
  if (grouped) {
    return <div className="review-match-summary" role="group" aria-label="연결할 설정">
      <strong>설정 {candidates.length}개</strong>
      {candidateEpisodesLabel(candidates) && <span>{candidateEpisodesLabel(candidates)}</span>}
    </div>;
  }
  const discovery = first.candidateKind === 'CHARACTER_DISCOVERY';
  return <div className="review-match-summary" role="group" aria-label="연결할 설정">
    <strong>{discovery ? '인물 후보' : toSettingDisplay(first.attributeName, first.attributeDisplayName, labels).nameLabel}</strong>
    <span className="review-match-summary__value">{discovery ? `‘${first.rawEntityMention || first.entityName || '이름 없음'}’` : first.attributeValue || '값 없음'}</span>
    <span>{analysisSourceLabel(first.source, first.episodeNo)}</span>
  </div>;
}

export function CharacterMatchModal({
  workId,
  candidate,
  candidates,
  initialResolution,
  initialSearch = '',
  pending,
  checking = false,
  automaticPending = false,
  readOnly = false,
  error,
  groupCandidateCount,
  selection = false,
  onClose,
  onSubmit,
}: {
  workId: string;
  candidate: SettingCandidateResponse;
  /** 이 결정으로 연결이 바뀌는 후보 전체. 요약과 미리보기에 쓴다. 생략하면 `candidate` 하나다. */
  candidates?: SettingCandidateResponse[];
  initialResolution: MatchResolution;
  /** 처음 열 때 넣어 둘 검색어. 디바운스 없이 바로 검색한다. */
  initialSearch?: string;
  pending: boolean;
  /** 응답을 잃은 연결(또는 함께 바뀌는 후보의 저장) 결과를 확인하는 중. 입력·연결을 잠그되 닫기는 허용한다. */
  checking?: boolean;
  automaticPending?: boolean;
  readOnly?: boolean;
  error: string | null;
  groupCandidateCount?: number;
  /** 체크한 후보만 연결한다(selected-character-match). 묶음 전체 연결과 문구를 구분한다. */
  selection?: boolean;
  onClose: () => void;
  onSubmit: (resolution: MatchResolution, value: string) => void;
}) {
  const [resolution, setResolution] = useState(initialResolution);
  const [search, setSearch] = useState(initialSearch);
  // 서버에 보낸 검색어와 페이지. 검색어가 바뀌면 첫 페이지부터 다시 찾는다.
  const [request, setRequest] = useState(() => ({ keyword: initialSearch.trim(), page: 0 }));
  const [selectedCharacterId, setSelectedCharacterId] = useState('');
  const [newCharacterName, setNewCharacterName] = useState(
    isUnidentifiedCharacterName(candidate.entityName) ? '' : candidate.entityName ?? '',
  );
  const [validationError, setValidationError] = useState<string | null>(null);
  const linkedCandidates = candidates ?? [candidate];

  useEffect(() => {
    const keyword = search.trim();
    if (keyword === request.keyword) return;
    const timer = window.setTimeout(() => setRequest({ keyword, page: 0 }), SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [request.keyword, search]);

  const charactersQuery = useQuery({
    ...getCharactersOptions({ path: { workId }, query: {
      query: request.keyword || undefined, page: request.page, size: SEARCH_PAGE_SIZE,
    } }),
    enabled: resolution === 'MATCH_EXISTING',
    // 다음 검색 결과가 올 때까지 직전 목록을 흐리게 남겨 입력 중 목록이 사라졌다 나타나지 않게 한다.
    placeholderData: keepPreviousData,
  });
  const characterPage = charactersQuery.data?.data;
  const searching = charactersQuery.isPlaceholderData || search.trim() !== request.keyword;
  const characters = characterPage?.content ?? [];
  useEffect(() => {
    const matchedCharacterId = candidate.matchedCharacterId;
    if (!matchedCharacterId || charactersQuery.isPlaceholderData
      || !characterPage?.content?.some(character => character.id === matchedCharacterId)) {
      return;
    }
    setSelectedCharacterId(current => current || matchedCharacterId);
  }, [candidate.matchedCharacterId, characterPage?.content, charactersQuery.isPlaceholderData]);
  const nameCounts = new Map<string, number>();
  characters.forEach(character => {
    const key = normalizeCharacterGroupName(character.name);
    if (key) nameCounts.set(key, (nameCounts.get(key) ?? 0) + 1);
  });
  // 화면에 보이는 행에서 고른 인물만 보낸다. 다음 검색 결과에 그 인물이 없으면 다시 고르게 한다.
  const selectedCharacterVisible = characters.some(character => character.id === selectedCharacterId);

  const locked = pending || checking;
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (locked || automaticPending || readOnly) return;
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
  const switchToNewCharacter = () => {
    setResolution('CREATE_NEW');
    setValidationError(null);
    setNewCharacterName(current => current.trim() ? current : request.keyword);
  };

  return (
    <ModalLayer
      title={selection ? '선택 항목 연결' : groupCandidateCount ? '캐릭터 일괄 연결' : '캐릭터 연결 확인'}
      description={selection
        ? `체크한 설정 ${linkedCandidates.length}개를 같은 인물에 연결합니다. 체크하지 않은 설정은 바뀌지 않아요.`
        : groupCandidateCount
        ? `“${candidate.entityName || '이름 없음'}”의 검토 대기 설정 ${groupCandidateCount}개에 같은 연결 결정을 적용합니다.`
        : `“${candidate.rawEntityMention || candidate.entityName || '이름 없음'}” 후보가 누구인지 선택해 주세요.`}
      pending={pending}
      width={resolution === 'MATCH_EXISTING' ? 900 : 620}
      onClose={onClose}
    >
      <form className="review-modal__form" onSubmit={submit} noValidate>
        <LinkSubjectSummary candidates={linkedCandidates} grouped={Boolean(groupCandidateCount)} selection={selection} />
        {readOnly && <p role="status">이전 분석 기록은 수정할 수 없습니다. 입력한 내용은 유지됩니다.</p>}
        {automaticPending && <AutomaticApplicationNotice source={candidate.source} />}
        {!automaticPending && linkedCandidates.some(item => item.manualReviewAvailable) && <OrderedReviewImpactNotice />}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 7, marginTop: 20 }}>
          {([
            ['MATCH_EXISTING', '기존 캐릭터에 연결'],
            ['CREATE_NEW', '새 캐릭터로 등록'],
          ] as const).map(([value, label]) => (
            <ActionButton
              key={value}
              disabled={locked}
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
          <div className="review-match-layout">
            <div className="review-match-search">
              <label htmlFor="character-search" style={{ color: REVIEW_TEXT.text, fontSize: 12 }}>
                작품 전체에서 인물 검색
              </label>
              <div style={{ position: 'relative', marginTop: 7 }}>
                <Search
                  size={14}
                  color={C.t3}
                  aria-hidden="true"
                  style={{ position: 'absolute', left: 12, top: 13 }}
                />
                <input
                  id="character-search"
                  type="search"
                  value={search}
                  maxLength={SEARCH_MAX_LENGTH}
                  placeholder="인물 이름으로 찾기"
                  disabled={locked}
                  aria-describedby="character-search-help"
                  onChange={event => {
                    setSearch(event.target.value);
                    setSelectedCharacterId('');
                    setValidationError(null);
                  }}
                  style={{ ...modalInputStyle, paddingLeft: 34 }}
                />
              </div>
              <p id="character-search-help" className="review-match-search__help">
                {request.keyword ? '이름에 검색어가 들어간 인물을 이름순으로 보여 줘요.' : '최근 수정한 인물부터 보여 줘요.'}
              </p>

              <div className="review-match-results" aria-busy={charactersQuery.isFetching || searching}>
                {charactersQuery.isPending ? (
                  <div role="status" aria-label="인물을 찾고 있어요">
                    {[0, 1, 2].map(index => <div key={index} className="review-match-skeleton" aria-hidden="true" />)}
                  </div>
                ) : charactersQuery.isError && !charactersQuery.isPlaceholderData ? (
                  <div role="alert" className="review-match-state is-error">
                    <strong>인물을 검색하지 못했어요</strong>
                    <span>{errorMessage(charactersQuery.error, '잠시 후 다시 시도해 주세요.')} 입력한 검색어는 그대로예요.</span>
                    <ActionButton
                      disabled={charactersQuery.isFetching}
                      tone={C.danger}
                      onClick={() => void charactersQuery.refetch()}
                    >
                      다시 시도
                    </ActionButton>
                  </div>
                ) : characters.length === 0 && !searching ? (
                  request.keyword ? (
                    <div role="status" className="review-match-state">
                      <strong>‘{request.keyword}’와 맞는 인물이 없어요.</strong>
                      <span>새 인물로 등록하거나 다른 이름으로 찾아보세요.</span>
                      <ActionButton disabled={locked} tone={C.primary} onClick={switchToNewCharacter}>새 인물로 등록</ActionButton>
                    </div>
                  ) : (
                    <div role="status" className="review-match-state">
                      <strong>등록된 캐릭터가 없어요.</strong>
                      <span>새 인물로 등록해 연결할 수 있어요.</span>
                    </div>
                  )
                ) : characters.map(character => {
                  const duplicateCount = nameCounts.get(normalizeCharacterGroupName(character.name)) ?? 0;
                  const selected = selectedCharacterId === character.id;
                  return (
                    <button
                      key={character.id}
                      type="button"
                      className={`review-modal__choice review-match-result${selected ? ' is-selected' : ''}`}
                      disabled={locked || !character.id}
                      aria-pressed={selected}
                      onClick={() => setSelectedCharacterId(character.id ?? '')}
                    >
                      <span className="review-match-result__name">
                        <strong>{highlightedName(character.name || '이름 없음', request.keyword)}</strong>
                        {duplicateCount > 1 && <span className="review-match-result__badge">같은 이름 {duplicateCount}명 — 첫 등장·역할로 구분</span>}
                      </span>
                      <span className="review-match-result__facts">{characterFacts(character).join(' · ')}</span>
                    </button>
                  );
                })}
              </div>
              <PageNavigation
                page={characterPage?.page ?? request.page}
                totalPages={characterPage?.totalPages ?? 0}
                disabled={locked || charactersQuery.isFetching || searching}
                onPageChange={nextPage => {
                  // 페이지를 넘겨도 검색어는 유지하고, 다른 페이지의 선택만 해제한다.
                  setRequest(current => ({ ...current, page: nextPage }));
                  setSelectedCharacterId('');
                }}
              />
            </div>
            <CharacterLinkPreview workId={workId} characterId={selectedCharacterVisible ? selectedCharacterId : null}
              candidates={linkedCandidates} />
          </div>
        ) : (
          <div style={{ marginTop: 18 }}>
            <label htmlFor="new-character-name" style={{ color: REVIEW_TEXT.text, fontSize: 12 }}>
              새 캐릭터 이름
            </label>
            <input
              id="new-character-name"
              value={newCharacterName}
              disabled={locked}
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
        {checking && !error && <p role="status" className="review-cb-help" style={{ marginTop: 14 }}>
          저장 결과를 확인하는 중이에요. 확인이 끝날 때까지 연결을 잠가요.
        </p>}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 22 }}>
          <ActionButton disabled={pending} onClick={onClose}>취소</ActionButton>
          <ActionButton type="submit" disabled={locked || automaticPending || readOnly} tone={C.primary}>
            {pending ? '연결 중…' : checking ? '확인 중…' : resolution === 'MATCH_EXISTING' ? '선택한 캐릭터에 연결' : '새 캐릭터로 등록'}
          </ActionButton>
        </div>
      </form>
    </ModalLayer>
  );
}
