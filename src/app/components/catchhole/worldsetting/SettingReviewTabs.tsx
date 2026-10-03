import { Globe2, Users } from 'lucide-react';
import { useLocation, useSearchParams } from 'react-router';

type SettingCandidateType = 'character' | 'world';

interface CandidateTabCount {
  directReview?: number;
  processing?: number;
  total?: number;
  unavailable?: boolean;
}

interface SettingReviewTabsProps {
  active: SettingCandidateType;
  character: CandidateTabCount;
  world: CandidateTabCount;
  disabled?: boolean;
}

const SAVED_PARAMS = {
  character: {
    selection: 'characterGroup',
    legacySelection: 'characterCandidate',
    reviewStatus: 'characterReviewStatus',
    page: 'characterPage',
    matchStatus: 'characterMatchStatus',
  },
  world: {
    selection: 'worldGroup',
    legacySelection: 'worldCandidate',
    reviewStatus: 'worldReviewStatus',
    page: 'worldPage',
    category: 'worldCategoryFilter',
    operation: 'worldOperation',
  },
} as const;

function copyOptional(
  params: URLSearchParams,
  source: string,
  target: string,
) {
  const value = params.get(source);
  if (value == null) params.delete(target);
  else params.set(target, value);
}

/**
 * 활성 탭의 URL 상태를 보관하고 대상 탭의 마지막 상태를 복원한다.
 * 두 탭 모두 `group`을 선택 식별자로 사용하고 `candidate`는 구형 딥링크에만 사용한다.
 */
function switchSettingCandidateType(
  params: URLSearchParams,
  current: SettingCandidateType,
  target: SettingCandidateType,
): URLSearchParams {
  if (current === target) return params;

  const next = new URLSearchParams(params);

  if (current === 'character') {
    const currentSaved = SAVED_PARAMS.character;
    copyOptional(next, 'reviewStatus', currentSaved.reviewStatus);
    copyOptional(next, 'page', currentSaved.page);
    copyOptional(next, 'group', currentSaved.selection);
    copyOptional(next, 'candidate', currentSaved.legacySelection);
    copyOptional(next, 'matchStatus', currentSaved.matchStatus);
  } else {
    const currentSaved = SAVED_PARAMS.world;
    copyOptional(next, 'reviewStatus', currentSaved.reviewStatus);
    copyOptional(next, 'page', currentSaved.page);
    copyOptional(next, 'group', currentSaved.selection);
    copyOptional(next, 'candidate', currentSaved.legacySelection);
    copyOptional(next, 'worldCategory', currentSaved.category);
    copyOptional(next, 'operation', currentSaved.operation);
  }

  next.delete('candidate');
  next.delete('group');
  next.delete('matchStatus');
  next.delete('worldCategory');
  next.delete('operation');

  if (target === 'character') {
    const targetSaved = SAVED_PARAMS.character;
    copyOptional(next, targetSaved.reviewStatus, 'reviewStatus');
    copyOptional(next, targetSaved.page, 'page');
    copyOptional(next, targetSaved.selection, 'group');
    if (!next.has('group')) copyOptional(next, targetSaved.legacySelection, 'candidate');
    copyOptional(next, targetSaved.matchStatus, 'matchStatus');
    next.delete('candidateType');
  } else {
    const targetSaved = SAVED_PARAMS.world;
    copyOptional(next, targetSaved.reviewStatus, 'reviewStatus');
    copyOptional(next, targetSaved.page, 'page');
    copyOptional(next, targetSaved.selection, 'group');
    if (!next.has('group')) copyOptional(next, targetSaved.legacySelection, 'candidate');
    copyOptional(next, targetSaved.category, 'worldCategory');
    copyOptional(next, targetSaved.operation, 'operation');
    next.set('candidateType', 'world');
  }
  return next;
}

export function SettingReviewTabs({
  active,
  character,
  world,
  disabled = false,
}: SettingReviewTabsProps) {
  const location = useLocation();
  const [, setSearchParams] = useSearchParams();
  const tabs = [
    { type: 'character' as const, label: '캐릭터 후보', icon: Users, count: character },
    { type: 'world' as const, label: '세계관 후보', icon: Globe2, count: world },
  ];

  return (
    <nav
      aria-label="설정 후보 종류"
      className="setting-review-tabs"
    >
      {tabs.map(tab => {
        const selected = active === tab.type;
        const Icon = tab.icon;
        return (
          <button
            key={tab.type}
            type="button"
            aria-current={selected ? 'page' : undefined}
            disabled={disabled}
            className={`setting-review-tabs__button${selected ? ' is-active' : ''}`}
            onClick={() => setSearchParams(
              previous => switchSettingCandidateType(previous, active, tab.type),
              { replace: true, state: location.state },
            )}
          >
            <Icon size={16} />
            <span>{tab.label}</span>
            <span className="setting-review-tabs__count">
              {tab.count.directReview == null && tab.count.total == null
                ? tab.count.unavailable ? '확인 불가' : '불러오는 중'
                : [
                tab.count.directReview != null ? `직접 확인 ${tab.count.directReview}개` : `전체 ${tab.count.total}개`,
                (tab.count.processing ?? 0) > 0 ? `분석 중 ${tab.count.processing}개` : null,
              ].filter(Boolean).join(' · ')}
            </span>
          </button>
        );
      })}
    </nav>
  );
}

/** Continue with the remaining review queue, regardless of the other tab's last filter. */
export function OtherSettingReviewAction({ current }: { current: SettingCandidateType }) {
  const location = useLocation();
  const [, setSearchParams] = useSearchParams();
  const target = current === 'world' ? 'character' : 'world';
  return <button type="button" className="review-cb-primary" onClick={() => setSearchParams(previous => {
    const next = switchSettingCandidateType(previous, current, target);
    for (const key of ['reviewStatus', 'page', 'group', 'candidate', 'matchStatus', 'worldCategory', 'operation']) next.delete(key);
    return next;
  }, { replace: true, state: location.state })}>{target === 'character' ? '캐릭터' : '세계관'} 후보 검토로</button>;
}
