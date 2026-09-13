import { Loader2 } from 'lucide-react';
import { AUTOMATIC_APPLICATION_PENDING_MESSAGE } from '../../lib/setting-review-progress';

export function AutomaticApplicationNotice() {
  return (
    <div className="automatic-application-notice" role="status">
      <Loader2 size={16} className="spin" aria-hidden="true" />
      <div><strong>분석 중</strong><p>{AUTOMATIC_APPLICATION_PENDING_MESSAGE}</p></div>
    </div>
  );
}
