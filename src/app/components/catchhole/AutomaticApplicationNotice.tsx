import { Loader2 } from 'lucide-react';
import { automaticApplicationPendingMessage } from '../../lib/setting-review-progress';
import type { AnalysisSourceResponse } from '../../api/generated/types.gen';

export function AutomaticApplicationNotice({ source }: { source?: AnalysisSourceResponse }) {
  return (
    <div className="automatic-application-notice" role="status">
      <Loader2 size={16} className="spin" aria-hidden="true" />
      <div><strong>분석 중</strong><p>{automaticApplicationPendingMessage(source)}</p></div>
    </div>
  );
}
