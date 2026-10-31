import { useId } from 'react';
import { Check } from 'lucide-react';
import type { UnlinkedLinkSummary } from '../../../lib/setting-review-groups';

type MovedPerson = UnlinkedLinkSummary['people'][number];

/**
 * 미연결(`미상`·이름 없음) 묶음을 모두 정리한 자리에 보이는 완료 상태. 화면은 그 묶음 자리에 머물고, 이번 화면에서 옮긴
 * 설정을 인물 묶음별로 모아 `보기`로 이동하게 한다. 새로고침 뒤에는 옮긴 기록이 없으므로 왼쪽 목록을 안내한다.
 */
export function UnlinkedGroupDone({ summary, restored, canOpenNext, findingNext, onOpenPerson, onOpenNext }: {
  summary: UnlinkedLinkSummary;
  restored: boolean;
  canOpenNext: boolean;
  findingNext: boolean;
  onOpenPerson: (person: MovedPerson) => void;
  onOpenNext: () => void;
}) {
  const titleId = useId();
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
    </section>
  );
}
