import { Loader2 } from 'lucide-react';
import type { SettingReviewProgress } from '../../lib/setting-review-progress';

export function SettingReviewSummary({ episodeRange, progress }: {
  episodeRange: string;
  progress: SettingReviewProgress;
}) {
  const items = [
    { label: '반영됨', count: progress.confirmed, tone: 'confirmed' },
    { label: '제외됨', count: progress.dismissed, tone: 'dismissed' },
    { label: '직접 확인', count: progress.directReview, tone: 'direct' },
  ];
  return (
    <section className="setting-review-summary setting-review-summary--decisions" aria-label="설정 후보 검토 요약">
      <div className="setting-review-summary__heading">
        <strong>{episodeRange}</strong>
        <span>전체 {progress.total}개 설정</span>
      </div>
      <div className="setting-review-summary__metrics">
        {items.map(item => (
          <div className={`setting-review-summary__item is-${item.tone}`} key={item.label}>
            <div>{item.label}</div>
            <strong>{item.count == null ? '—' : `${item.count}개`}</strong>
          </div>
        ))}
      </div>
      {(progress.processing ?? 0) > 0 && (
        <div className="setting-review-summary__processing" role="status">
          <Loader2 size={15} className="spin" aria-hidden="true" />
          <strong>분석 중 {progress.processing}개</strong>
          <span>분석이 끝나면 결과를 확인할 수 있습니다.</span>
        </div>
      )}
      <p className="setting-review-summary__helper">
        반영된 내용은 작품 설정과 이력에서 볼 수 있습니다. 직접 확인할 설정은 검토 후 확정하거나 제외해 주세요.
      </p>
    </section>
  );
}
