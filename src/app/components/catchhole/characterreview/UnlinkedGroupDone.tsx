import { useId } from 'react';
import { AlertCircle, Check, Loader2 } from 'lucide-react';
import type { UnlinkedLinkSummary } from '../../../lib/setting-review-groups';

type MovedPerson = UnlinkedLinkSummary['people'][number];

/**
 * 미연결(`미상`·이름 없음) 묶음 자리에 보이는 상태. 화면은 그 묶음 자리에 머문다.
 * - `done`: 모두 정리했다. 이번 화면에서 옮긴 설정을 인물 묶음별로 모아 `보기`로 이동하게 한다. 새로고침 뒤에는 옮긴 기록이
 *   없으므로 왼쪽 목록을 안내한다.
 * - `checking`: 다른 페이지로 밀렸는지 찾는 중이다.
 * - `lookupFailed`: 다른 페이지를 읽지 못했거나 설정이 여러 페이지에 나뉘어 표시되어 남은 후보 위치를 모른다.
 *   `다시 시도`로 같은 탐색을 다시 한다.
 */
export function UnlinkedGroupDone({
  status, lookupReason, summary, restored, canOpenNext, findingNext, nextMissed, onOpenPerson, onOpenNext, onRetryLookup,
}: {
  status: 'done' | 'checking' | 'lookupFailed';
  /** 찾지 못한 이유. `partialList`는 설정이 여러 페이지에 나뉘어 표시되어(구버전 목록) 모두 확인했다고 볼 수 없는 경우다. */
  lookupReason?: 'readFailed' | 'partialList';
  summary: UnlinkedLinkSummary;
  restored: boolean;
  canOpenNext: boolean;
  findingNext: boolean;
  nextMissed: boolean;
  onOpenPerson: (person: MovedPerson) => void;
  onOpenNext: () => void;
  onRetryLookup: () => void;
}) {
  const titleId = useId();
  if (status !== 'done') {
    const failed = status === 'lookupFailed';
    return (
      <section className="review-unlinked-done" aria-labelledby={titleId} data-testid="unlinked-group-lookup"
        role={failed ? 'alert' : 'status'}>
        <h2 id={titleId} className="review-unlinked-done__title">
          {failed ? <AlertCircle size={18} aria-hidden="true" className="is-warning" /> : <Loader2 size={18} aria-hidden="true" className="spin" />}
          {failed ? '남은 미연결 후보 위치를 확인하지 못했어요.' : '남은 미연결 후보 위치를 확인하고 있어요.'}
        </h2>
        <p className="review-unlinked-done__text">
          {!failed ? '새로 생긴 인물 묶음 때문에 다음 페이지로 밀렸는지 찾고 있어요.'
            : lookupReason === 'partialList'
              ? '설정이 여러 페이지에 나뉘어 표시되어 남은 미연결 후보가 있는지 모두 확인하지 못했어요. 다시 시도하거나 왼쪽 목록에서 볼 묶음을 골라 주세요.'
              : '다른 페이지의 목록을 읽지 못했어요. 다시 시도하거나 왼쪽 목록에서 볼 묶음을 골라 주세요.'}
        </p>
        {failed && (
          <div className="review-unlinked-done__actions">
            <button type="button" className="review-cb-primary" onClick={onRetryLookup}>다시 시도</button>
          </div>
        )}
      </section>
    );
  }
  const hasPeople = summary.people.length > 0;
  return (
    <section className="review-unlinked-done" aria-labelledby={titleId} data-testid="unlinked-group-done">
      <h2 id={titleId} className="review-unlinked-done__title" data-review-done-title tabIndex={-1}>
        <Check size={18} aria-hidden="true" />미연결 후보를 모두 정리했어요.
      </h2>
      {hasPeople ? (
        <>
          <p className="review-unlinked-done__text">
            {`이번에 옮긴 설정 ${summary.settingCount}개 · ${summary.people.length}명이에요. 인물 묶음에서 이어서 검토해 주세요.`}
          </p>
          <ul className="review-unlinked-done__list" aria-label="옮긴 인물 묶음">
            {summary.people.map(person => (
              <li key={person.key} className="review-unlinked-done__item">
                <span className="review-unlinked-done__person">
                  <strong>{person.name}</strong>
                  <span>{`옮긴 설정 ${person.count}개`}</span>
                </span>
                <button type="button" className="review-cb-secondary" aria-label={`${person.name} 묶음 보기`}
                  onClick={() => onOpenPerson(person)}>보기</button>
              </li>
            ))}
          </ul>
          {summary.untracked > 0 && (
            <p className="review-unlinked-done__text">
              {`옮긴 묶음을 확인하지 못한 설정 ${summary.untracked}개는 왼쪽 목록의 인물 묶음에서 확인할 수 있어요.`}
            </p>
          )}
        </>
      ) : (restored || summary.untracked > 0) && (
        <p className="review-unlinked-done__text">옮겨 간 설정은 왼쪽 목록의 인물 묶음에서 확인할 수 있어요.</p>
      )}
      {canOpenNext && (
        <div className="review-unlinked-done__actions">
          <button type="button" className="review-cb-primary" disabled={findingNext} onClick={onOpenNext}>
            {findingNext ? '다음 묶음을 찾는 중…' : '다음 미처리 묶음'}
          </button>
        </div>
      )}
      {nextMissed && (
        <p className="review-unlinked-done__text is-warning" role="alert">
          다음 미처리 묶음을 찾지 못했어요. 다시 누르거나 왼쪽 목록에서 골라 주세요.
        </p>
      )}
    </section>
  );
}
