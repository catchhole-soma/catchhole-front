import { RefreshCw } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router';
import type { EpisodeResponse, ValidationStagingResponse } from '../../../api/generated/types.gen';
import type { useEpisodeValidationReport } from '../../../hooks/useEpisodeValidationReport';
import { ReviewNotice } from '../review-ui/ReviewPrimitives';
import { ActionButton } from '../ui-v2/ActionButton';
import { useValidationRecheck } from './useValidationRecheck';
import { formatDateTime, validationReportUrl } from './validation-report-labels';

/** 확인창에 보여 줄 변경 요약. 원고 revision이 검사 당시보다 커졌을 때만 원고 교체로 표시한다. */
function changeSummary(staging: ValidationStagingResponse | undefined, episode: EpisodeResponse | undefined, stage?: string) {
  const replaced = episode?.contentRevision != null && staging?.targetRevision != null && episode.contentRevision > staging.targetRevision;
  if (replaced) {
    const changedAt = formatDateTime(episode?.contentUpdatedAt);
    return `원고 파일을 바꿨어요${changedAt ? ` (${changedAt})` : ''}. 바꾼 원고로 다시 검사해요.`;
  }
  if (stage === 'INVALIDATED') return '검사에 쓴 설정이 바뀌었어요. 지금 저장된 설정을 기준으로 다시 검사해요.';
  return '원고는 그대로예요. 확정한 설정을 기준으로 검사 결과만 다시 만들어요.';
}

/**
 * A11 `수정 내용으로 재검수`. 별도 다단계 확인창 없이 대상 회차·적용할 변경·새 결과의 시작 상태를 한 번에 보여 준다.
 * 실행 가능 여부는 useValidationRecheck가 서버 응답으로만 정한다.
 */
export function ValidationRecheckPanel({ workId, reportId, report, onRetry }: {
  workId: string;
  reportId: string;
  report: ReturnType<typeof useEpisodeValidationReport>;
  onRetry: () => void;
}) {
  const navigate = useNavigate();
  const location = useLocation();
  // 성공하면 새 report로 주소를 바꾼다. 이전 report는 검사 이력에서 다시 열 수 있다.
  const recheck = useValidationRecheck({
    workId, reportId, report,
    onRechecked: nextReportId => navigate(validationReportUrl(workId, nextReportId), { replace: true, state: location.state }),
  });
  const { staging, summary } = report;
  const stage = summary?.reviewStage ?? staging?.reviewStage;
  const retryAllowed = summary?.allowedActions?.includes('RETRY') === true;
  const episodeLabel = [report.episode?.episodeNo != null ? `${report.episode.episodeNo}화` : '이 회차', report.episode?.title]
    .filter(Boolean).join(' ');
  if (!recheck.listed) return null;
  const notice = recheck.notice ? (
    <ReviewNotice tone={recheck.notice.tone} title={recheck.notice.text}
      action={recheck.notice.suggestRetry && retryAllowed
        ? <ActionButton variant="secondary" size="compact" onClick={onRetry}>중단된 검사 다시 시도</ActionButton>
        : undefined} />
  ) : null;

  if (!recheck.open) {
    return (
      <div className="vr-actions vr-recheck-entry">
        <ActionButton onClick={recheck.openConfirmation} disabled={!recheck.canRecheck} aria-describedby={recheck.lockReason ? 'validation-recheck-lock' : undefined}>
          수정 내용으로 재검수
        </ActionButton>
        {recheck.lockReason && <span id="validation-recheck-lock" className="vr-muted">{recheck.lockReason}</span>}
        {recheck.eligibilityError && (
          <ActionButton variant="secondary" size="compact" icon={<RefreshCw size={14} aria-hidden="true" />} onClick={recheck.reloadEligibility}>다시 확인</ActionButton>
        )}
        {notice && <div className="vr-actions__note">{notice}</div>}
      </div>
    );
  }

  return (
    <section className="vr-recheck" aria-labelledby="validation-recheck-title" data-testid="validation-recheck-confirm">
      <h2 id="validation-recheck-title">수정 내용으로 재검수할까요?</h2>
      <dl className="vr-facts">
        <div><dt>대상 회차</dt><dd>{`${episodeLabel} · 이 회차 한 편만 다시 검사해요.`}</dd></div>
        <div>
          <dt>적용할 변경</dt>
          <dd>{recheck.episodeLoading ? '현재 원고를 확인하고 있어요.'
            : recheck.episodeError ? '현재 원고를 확인하지 못했어요.'
              : changeSummary(staging, recheck.episode, stage)}</dd>
        </div>
      </dl>
      <ul className="vr-hold-list">
        <li>새 결과는 모두 검토 필요로 시작해요. 이전 판단은 이어지지 않아요.</li>
        <li>{recheck.diagnostic
          ? '이전 원고의 설정은 확정했어요. 이번 재검수는 검사 결과만 제공해요.'
          : '오류 검토를 마친 뒤 이번 회차의 설정을 추출해요.'}</li>
        <li>이전 결과는 검사 이력에 요약으로 남아요.</li>
      </ul>
      {recheck.episodeError && (
        <ReviewNotice tone="warning" title="현재 원고 정보를 불러오지 못했어요."
          action={<ActionButton variant="secondary" size="compact" onClick={recheck.reloadEpisode}>다시 불러오기</ActionButton>} />
      )}
      {notice}
      <div className="vr-actions">
        <ActionButton onClick={() => void recheck.submit()} disabled={!recheck.canRecheck || recheck.pending || recheck.episodeLoading}>
          {recheck.pending ? '재검수를 요청하고 있어요…' : '재검수 시작'}
        </ActionButton>
        <ActionButton variant="secondary" onClick={recheck.closeConfirmation} disabled={recheck.pending}>취소</ActionButton>
      </div>
    </section>
  );
}
