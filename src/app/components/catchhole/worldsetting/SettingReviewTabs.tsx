import { Globe2, Users } from 'lucide-react';
import { useLocation, useSearchParams } from 'react-router';
import { C } from '../constants';

export type SettingCandidateType = 'character' | 'world';

interface CandidateTabCount {
  reviewed: number;
  total: number;
}

interface SettingReviewTabsProps {
  active: SettingCandidateType;
  character: CandidateTabCount;
  world: CandidateTabCount;
  disabled?: boolean;
}

const SAVED_PARAMS = {
  character: {
    candidate: 'characterCandidate',
    reviewStatus: 'characterReviewStatus',
    page: 'characterPage',
  },
  world: {
    candidate: 'worldCandidate',
    reviewStatus: 'worldReviewStatus',
    page: 'worldPage',
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
 * 활성 탭의 공통 URL 상태를 보관하고 대상 탭의 마지막 상태를 복원한다.
 * `candidate`, `reviewStatus`, `page`는 활성 탭의 딥링크 계약으로 계속 유지한다.
 */
function switchSettingCandidateType(
  params: URLSearchParams,
  current: SettingCandidateType,
  target: SettingCandidateType,
): URLSearchParams {
  if (current === target) return params;

  const next = new URLSearchParams(params);
  const currentSaved = SAVED_PARAMS[current];
  copyOptional(next, 'candidate', currentSaved.candidate);
  copyOptional(next, 'reviewStatus', currentSaved.reviewStatus);
  copyOptional(next, 'page', currentSaved.page);

  if (current === 'character') copyOptional(next, 'matchStatus', 'characterMatchStatus');

  const targetSaved = SAVED_PARAMS[target];
  copyOptional(next, targetSaved.candidate, 'candidate');
  copyOptional(next, targetSaved.reviewStatus, 'reviewStatus');
  copyOptional(next, targetSaved.page, 'page');

  if (target === 'character') {
    next.delete('candidateType');
    copyOptional(next, 'characterMatchStatus', 'matchStatus');
  } else {
    next.set('candidateType', 'world');
    next.delete('matchStatus');
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
      style={{
        display: 'flex', alignItems: 'stretch', marginTop: 18,
        border: `1px solid ${C.border}`, borderRadius: 10,
        background: C.surface, overflow: 'hidden',
      }}
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
            onClick={() => setSearchParams(
              previous => switchSettingCandidateType(previous, active, tab.type),
              { replace: true, state: location.state },
            )}
            style={{
              position: 'relative', minHeight: 58, padding: '0 30px',
              display: 'flex', alignItems: 'center', gap: 9,
              border: 'none', background: selected ? `${C.primary}0D` : 'transparent',
              color: selected ? C.primary : C.t2,
              fontFamily: 'inherit', fontSize: 13, fontWeight: selected ? 700 : 550,
              cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.58 : 1,
            }}
          >
            <Icon size={16} />
            <span>{tab.label}</span>
            <span style={{
              minWidth: 26, padding: '2px 7px', borderRadius: 10,
              background: selected ? `${C.primary}20` : C.bg,
              color: selected ? C.primary : C.t3,
              border: `1px solid ${selected ? `${C.primary}55` : C.border}`,
              fontSize: 10, fontWeight: 750,
            }}>
              {tab.count.reviewed}/{tab.count.total}
            </span>
            {selected && (
              <span style={{
                position: 'absolute', left: 0, right: 0, bottom: 0,
                height: 2, background: C.primary,
              }} />
            )}
          </button>
        );
      })}
    </nav>
  );
}
