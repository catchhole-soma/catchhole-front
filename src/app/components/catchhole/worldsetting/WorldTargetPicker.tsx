import type { ReactNode } from 'react';
import { ReviewChoiceCards, ReviewNotice } from '../review-ui/ReviewPrimitives';
import { WorldSubjectImage } from './WorldSubjectImage';
import type { WorldTargetSearch } from './useWorldTargetSearch';

/** 새 대상으로 등록하는 카드. 기존 대상 카드와 같은 목록 끝에 둔다. */
export const NEW_WORLD_TARGET_ID = 'new-target';

/**
 * 실제 등록된 세계관 대상을 검색해 카드로 고르는 피커. 행의 결정 패널과 묶음의 선택 연결이 같은 검색 UI를 쓴다.
 * 시안의 예시 이름이나 추천 목록을 만들지 않고 GET /world-settings 결과만 보여 준다.
 */
export function WorldTargetPicker({ search, label, categoryLabel, value, disabled, pagerDisabled = disabled, help, searchLabel = '기존 세계관 대상 검색',
  newTarget, controls, onChange, children, footer }: {
  search: WorldTargetSearch;
  label: ReactNode;
  categoryLabel: string;
  value: string | null;
  disabled: boolean;
  /** 페이지 이동만 잠글 조건. 기본은 카드 선택과 같다. */
  pagerDisabled?: boolean;
  help?: ReactNode;
  /** 검색 입력의 접근성 이름. 한 화면에 피커가 여럿이면 서로 구분한다. */
  searchLabel?: string;
  newTarget?: { title: string; description: string; footnote: string };
  /** 검색 입력 앞에 둘 추가 조건(예: 분류 선택). */
  controls?: ReactNode;
  onChange: (id: string) => void;
  /** 카드 목록 바로 아래(페이지 이동 앞)에 둘 내용. */
  children?: ReactNode;
  /** 페이지 이동 아래에 둘 내용. */
  footer?: ReactNode;
}) {
  const { targetsQuery, targets, query, page } = search;
  return <div className="review-cb-target-search">
    <ReviewChoiceCards label={label} value={value} disabled={disabled}
      choices={[
        ...(targets?.content ?? []).flatMap(target => target.id && target.subjectName ? [{ id: target.id,
          title: target.subjectName, description: `설정 ${target.propertyCount ?? 0}개`,
          image: <WorldSubjectImage category={target.category} path={target.image?.thumbnailUrl} vaultId={target.image?.vaultId} />,
          footnote: '이 대상에 연결' }] : []),
        ...(newTarget ? [{ id: NEW_WORLD_TARGET_ID, ...newTarget }] : []),
      ]}
      onChange={onChange}>
      <div className="review-cb-target-search__controls">
        {help && <p className="review-cb-help">{help}</p>}
        {controls}
        <label>기존 {categoryLabel} 검색<input aria-label={searchLabel} placeholder="기존 대상 이름으로 검색" value={query}
          onChange={event => search.setQuery(event.target.value)} /></label>
        {targetsQuery.isPending && <p className="review-cb-help" role="status">기존 {categoryLabel} 목록을 불러오고 있어요.</p>}
        {targetsQuery.isError && <ReviewNotice tone="warning" action={<button type="button" className="review-cb-secondary" onClick={() => void targetsQuery.refetch()}>다시 불러오기</button>}>기존 {categoryLabel} 목록을 불러오지 못했어요. 등록된 대상이 없는지 아직 확인할 수 없어요.</ReviewNotice>}
        {targetsQuery.isSuccess && targets?.content?.length === 0 && <p className="review-cb-help" role="status">{query
          ? `‘${query}’ 검색 결과가 없어요. 다른 이름으로 검색하거나 새로 등록할지 선택해 주세요.`
          : page > 0 ? `이 페이지에 표시할 ${categoryLabel} 항목이 없어요. 이전 페이지를 확인해 주세요.`
            : `등록된 ${categoryLabel} 항목이 없어요. 새로 등록할지 직접 선택해 주세요.`}</p>}
      </div>
    </ReviewChoiceCards>
    {children}
    {(page > 0 || targets?.hasNext) && <div className="review-cb-actions">
      <button type="button" className="review-cb-secondary" disabled={page === 0 || pagerDisabled} onClick={() => search.setPage(page - 1)}>이전 대상</button>
      <button type="button" className="review-cb-secondary" disabled={!targets?.hasNext || pagerDisabled} onClick={() => search.setPage(page + 1)}>다음 대상</button>
    </div>}
    {footer}
  </div>;
}
