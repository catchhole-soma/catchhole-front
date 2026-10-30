import { Link } from 'react-router';
import { ReviewNotice } from '../review-ui/ReviewPrimitives';
import type { AdmissionBlock } from './validation-admission';
import {
  NEXT_EPISODE_BLOCKED_COPY,
  VALIDATION_STAGE_SUMMARY,
  validationReportUrl,
  type ReviewStage,
} from './validation-report-labels';
import '../../../../styles/validation-entry.css';

/** 미완료 검수 동안의 다음 회차 등록 차단 안내. 업로드 방식과 무관하게 같은 문구와 리포트 이동을 제공한다. */
export function NextEpisodeBlockedNotice({ workId, block, inputPreserved = false }: { workId: string; block: AdmissionBlock; inputPreserved?: boolean }) {
  const stage = block.reviewStage ? VALIDATION_STAGE_SUMMARY[block.reviewStage].label : null;
  return (
    <div className="validation-entry-notice" data-testid="next-episode-blocked">
      <ReviewNotice tone="warning" title={block.message || NEXT_EPISODE_BLOCKED_COPY}
        action={block.reportId ? (
          <Link className="ch-action ch-action--secondary ch-action--compact validation-entry-link" to={validationReportUrl(workId, block.reportId)}>
            현재 리포트로 이동
          </Link>
        ) : undefined}>
        <p>{[block.episodeNo != null ? `검토 중인 회차: ${block.episodeNo}화` : '검토 중인 회차가 있어요.', stage].filter(Boolean).join(' · ')}</p>
        <p>{inputPreserved ? '입력한 내용은 그대로 두었어요. ' : ''}리포트에서 검토와 설정 확정을 마치면 이 화면에서 이어서 올릴 수 있어요.</p>
      </ReviewNotice>
    </div>
  );
}

/** 원고 목록 행의 검수 단계 배지. 색과 함께 글자로 단계를 표시한다. */
export function ValidationStageBadge({ stage }: { stage: ReviewStage }) {
  const view = VALIDATION_STAGE_SUMMARY[stage];
  return <span className={`validation-stage-badge is-${view.tone}`}>{view.label}</span>;
}
