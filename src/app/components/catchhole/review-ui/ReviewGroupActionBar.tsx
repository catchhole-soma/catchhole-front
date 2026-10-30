import { useId, type ReactNode } from 'react';

const REVIEW_ACTION_TEXT = {
  next: '확정하고 다음',
  all: '모두 확정',
  pending: '확정 중…',
  jump: '다음 미결정 항목',
} as const;

/**
 * 캐릭터·세계관 묶음의 고정 확정 영역.
 *
 * 상세 스크롤 영역 하단에 붙어(`position: sticky`) 긴 묶음을 읽는 동안에도 보인다. 확정 가능·이력 저장·제외 예정·
 * 결정 필요 수를 보여 주고, 막는 후보가 있으면 주 버튼을 잠근 채 `다음 미결정 항목`으로 그 후보로 옮겨 간다.
 * 주 버튼은 같은 탭에 다음 묶음이 있으면 `확정하고 다음`, 마지막 묶음이면 `모두 확정`이다. 확정 요청은 기존 그룹
 * 확정 그대로이고 다음 묶음 이동은 화면이 직전 목록 순서로 처리한다. 잠긴 주 버튼도 초점을 받을 수 있게
 * `aria-disabled`를 쓰고 이유를 `aria-describedby`로 잇는다. 선택 바(`children`)는 같은 영역의 맨 위에 쌓는다.
 */
export function ReviewGroupActionBar({
  readyCount, historyOnlyCount = 0, excludeCount = 0, blockingCount, reason, describedBy,
  hasNextGroup, pending, disabled, onConfirm, onJumpToBlocking, secondaryActions, status, shortcuts, children,
}: {
  /** 현재 설정에 반영할 후보 수. */
  readyCount: number;
  historyOnlyCount?: number;
  excludeCount?: number;
  /** 결정이 필요해 확정을 막는 후보 수. */
  blockingCount: number;
  /** 확정을 막는 이유. 같은 문장의 안내가 화면에 이미 있으면 null로 두고 `describedBy`로 잇는다. */
  reason: string | null;
  describedBy?: string[];
  hasNextGroup: boolean;
  /** 확정 요청 중이거나 응답을 잃은 확정의 결과를 확인하는 중. */
  pending: boolean;
  disabled: boolean;
  onConfirm: () => void;
  onJumpToBlocking: () => void;
  secondaryActions?: ReactNode;
  /** 확정 오류·결과 미확인 같은 상태 줄. 버튼 줄 아래에 둔다. */
  status?: ReactNode;
  /** 버튼 줄 끝의 단축키 안내. */
  shortcuts?: ReactNode;
  /** 선택 바처럼 함께 고정할 보조 영역. 버튼 줄 위에 둔다. */
  children?: ReactNode;
}) {
  const reasonId = useId();
  const counts = [
    readyCount > 0 ? `확정 가능 ${readyCount}` : null,
    historyOnlyCount > 0 ? `이력 저장 ${historyOnlyCount}` : null,
    excludeCount > 0 ? `제외 ${excludeCount}` : null,
  ].filter((part): part is string => Boolean(part));
  const describedByIds = [reason ? reasonId : null, ...(describedBy ?? [])].filter(Boolean).join(' ') || undefined;
  const locked = disabled || pending;
  return <footer className="review-action-bar" role="region" aria-label="묶음 확정">
    {children}
    <div className="review-action-bar__row">
      <div className="review-action-bar__summary">
        {(counts.length > 0 || blockingCount > 0) && <p className="review-action-bar__counts">
          {counts.join(' · ')}
          {counts.length > 0 && blockingCount > 0 && ' · '}
          {blockingCount > 0 && <span className="is-blocking">결정 필요 {blockingCount}</span>}
        </p>}
        {reason && <p id={reasonId} className="review-action-bar__reason">{reason}</p>}
      </div>
      <div className="review-action-bar__actions">
        {secondaryActions}
        {blockingCount > 0 && <button type="button" className="review-cb-secondary review-action-bar__jump" onClick={onJumpToBlocking}>
          {REVIEW_ACTION_TEXT.jump}
        </button>}
        <button type="button" className="review-action-bar__primary" data-review-primary-action
          aria-disabled={locked} aria-describedby={describedByIds}
          onClick={() => { if (!locked) onConfirm(); }}>
          {pending ? REVIEW_ACTION_TEXT.pending : hasNextGroup ? REVIEW_ACTION_TEXT.next : REVIEW_ACTION_TEXT.all}
        </button>
        {shortcuts}
      </div>
    </div>
    {status}
  </footer>;
}
