import { useState, type ReactNode } from 'react';
import { Link } from 'react-router';
import { History, RefreshCw } from 'lucide-react';
import type {
  ValidationReviewSummaryResponse,
  ValidationStagingResponse,
} from '../../../api/generated/types.gen';
import type { ValidationResultsView } from '../../../hooks/useEpisodeValidationReport';
import { ReviewNotice } from '../review-ui/ReviewPrimitives';
import { ActionButton } from '../ui-v2/ActionButton';
import {
  applicationHoldLines,
  branchStatusLabel,
  EXECUTION_LABELS,
  formatDateTime,
  HOLD_REASON_COPY,
  REVIEW_STAGE_LABELS,
} from './validation-report-labels';

type Tone = 'info' | 'warning' | 'danger' | 'success';
type StageCopy = { tone: Tone; title: string; lines: string[] };

const ACTIVE_EXECUTION = new Set(['QUEUED', 'RUNNING']);

function findingTotal(summary?: ValidationReviewSummaryResponse) {
  const counts = summary?.counts;
  if (!counts || counts.settingTotal == null || counts.typoTotal == null) return null;
  return counts.settingTotal + counts.typoTotal;
}

/** R1 단계 문구. errorReviewStatus가 아니라 서버가 계산한 reviewStage를 기준으로 고른다. */
function stageCopy(staging?: ValidationStagingResponse, summary?: ValidationReviewSummaryResponse): StageCopy {
  const stage = summary?.reviewStage ?? staging?.reviewStage;
  const execution = summary?.executionStatus ?? staging?.executionStatus;
  const mode = summary?.mode ?? staging?.mode;
  const total = findingTotal(summary);
  if (staging?.current === false) return {
    tone: 'info', title: '이전 검수 결과예요.', lines: ['당시 집계만 보여 줘요. 인용과 판단 목록은 이전 결과에서 제공하지 않아요.'],
  };
  if (stage === 'INVALIDATED') return {
    tone: 'warning',
    title: '원고 또는 비교한 설정이 바뀌었어요. 수정 내용을 반영해 다시 검수해 주세요.',
    lines: ['원문이 변경되거나 삭제되어 당시 근거를 볼 수 없어요.'],
  };
  if (stage === 'HELD_INCOMPLETE') return { tone: 'warning', title: '비교할 기준을 준비하지 못했어요.', lines: ['오류 검토가 끝나지 않아 설정 추출을 보류했어요.'] };
  if (stage === 'PREPARING_BASELINE' || stage === 'VALIDATING') return {
    tone: 'info',
    title: '설정 충돌을 확인하고 있어요.',
    lines: [
      stage === 'PREPARING_BASELINE' ? '비교할 기준을 준비하고 있어요.' : '발견한 항목은 검사가 끝날 때까지 읽기만 할 수 있어요.',
      ...(mode === 'DIAGNOSTIC_ONLY' ? ['이전 원고의 설정은 확정했어요. 이번 재검수는 검사 결과만 제공해요.'] : ['오류 검토를 마친 뒤 이번 회차의 설정을 추출해요.']),
    ],
  };
  if (stage === 'REVIEW_COMPLETED') return {
    tone: 'info',
    title: total === 0 ? '확인한 범위에서 충돌 의심 항목과 오탈자 제안을 찾지 못했어요.' : '검토를 마쳤어요.',
    lines: [summary?.extractionState === 'SUCCEEDED'
      ? '설정 추출을 마쳤어요. 설정 확정 결과를 확인하고 있어요.'
      : '이번 회차의 설정을 추출하고 있어요.'],
  };
  if (stage === 'EXTRACTION_FAILED') return {
    tone: 'danger', title: '설정 추출을 마치지 못했어요.', lines: ['검사와 검토 결과는 그대로 남아 있어요. 분석 목록에서 추출 상태를 확인해 주세요.'],
  };
  if (stage === 'APPLICATION_HELD') return {
    tone: 'warning', title: '설정 확정을 보류했어요.', lines: ['이번 시도에서는 어떤 설정도 반영하지 않았어요. 아래 사유를 확인해 주세요.'],
  };
  if (stage === 'APPLIED') {
    const appliedAt = formatDateTime(summary?.application?.appliedAt);
    return {
      tone: 'success',
      title: total === 0 ? '확인한 범위에서 충돌 의심 항목과 오탈자 제안을 찾지 못했어요.' : '검토를 마쳤어요.',
      lines: [appliedAt ? `이번 회차의 설정을 확정했어요. (${appliedAt})` : '이번 회차의 설정을 확정했어요.'],
    };
  }
  if (!summary) return { tone: 'info', title: '검사 상태를 확인하고 있어요.', lines: [] };
  if (mode === 'DIAGNOSTIC_ONLY') return { tone: 'info', title: '이전 원고의 설정은 확정했어요. 이번 재검수는 검사 결과만 제공해요.', lines: [] };
  if (execution === 'FAILED') return { tone: 'danger', title: '검사를 마치지 못했어요.', lines: ['오류 검토가 끝나지 않아 설정 추출을 보류했어요.'] };
  if (execution === 'CANCELED') return { tone: 'warning', title: '검사가 취소됐어요.', lines: ['오류 검토가 끝나지 않아 설정 추출을 보류했어요.'] };
  if (execution === 'PARTIAL') return {
    tone: 'warning',
    title: '일부 구간의 검사를 마치지 못했어요.',
    lines: [
      summary.counts?.settingTotal === 0
        ? '확인한 구간에서는 설정 검사 항목이 없지만, 아직 검사하지 못한 구간이 있어요.'
        : '완료된 구간에서 찾은 항목은 지금 검토할 수 있어요.',
      '오류 검토가 끝나지 않아 설정 추출을 보류했어요.',
    ],
  };
  if (total === 0 && summary.holdReasons?.includes('RELEASE_HELD')) return {
    tone: 'warning',
    title: '확인한 범위에서 충돌 의심 항목과 오탈자 제안을 찾지 못했어요.',
    lines: [HOLD_REASON_COPY.RELEASE_HELD],
  };
  if (summary.completionMode === 'EXPLICIT_REQUIRED') return {
    tone: 'info', title: '모든 항목의 판단을 마쳤어요.', lines: ['검토 완료 후 설정 추출을 누르면 이번 회차의 설정을 추출해요.'],
  };
  return { tone: 'warning', title: '확인이 필요한 내용이 있어 설정 추출을 보류했어요.', lines: [] };
}

function executionTone(execution?: string) {
  if (execution === 'COMPLETED') return 'is-success';
  if (execution === 'FAILED') return 'is-danger';
  if (execution === 'PARTIAL' || execution === 'CANCELED') return 'is-warning';
  return 'is-primary';
}

export function ReportStatusCard({
  staging, summary, title, subtitle, historyOpen, onToggleHistory, onComplete, completing, onApply, applying,
  candidateReviewUrl, message, children,
}: {
  staging?: ValidationStagingResponse;
  summary?: ValidationReviewSummaryResponse;
  title: string;
  subtitle: string;
  historyOpen: boolean;
  onToggleHistory: () => void;
  onComplete: () => void;
  completing: boolean;
  onApply: () => void;
  applying: boolean;
  candidateReviewUrl?: string;
  message?: ReactNode;
  children?: ReactNode;
}) {
  const stage = summary?.reviewStage ?? staging?.reviewStage;
  const execution = summary?.executionStatus ?? staging?.executionStatus;
  const mode = summary?.mode ?? staging?.mode;
  const copy = stageCopy(staging, summary);
  const validity = staging?.current === false ? { label: '이전 결과', tone: 'is-neutral' }
    : stage === 'INVALIDATED' ? { label: '재검수 필요', tone: 'is-warning' }
      : staging ? { label: '현재 결과', tone: 'is-primary' } : null;
  const reviewOpen = stage === 'AWAITING_REVIEW' && mode !== 'DIAGNOSTIC_ONLY' && staging?.current !== false;
  const holdReasons = (summary?.holdReasons ?? []).filter(reason => reason !== 'RELEASE_HELD' && reason !== 'DIAGNOSTIC_ONLY');
  const applicationHeld = summary?.application?.status === 'HELD_REVIEW' && stage === 'APPLICATION_HELD';
  const holdLines = applicationHoldLines(summary?.application?.holdReasons);

  return (
    <section className="vr-card vr-status" aria-labelledby="validation-report-title">
      <div className="vr-status__top">
        <div className="vr-status__identity">
          <small>{subtitle}</small>
          <h1 id="validation-report-title">{title}</h1>
          <div className="vr-status__chips">
            {execution && <span className={`vr-chip ${executionTone(execution)}`}>{EXECUTION_LABELS[execution]}</span>}
            {stage && <span className="vr-chip">{REVIEW_STAGE_LABELS[stage]}</span>}
            {validity && <span className={`vr-chip ${validity.tone}`}>{validity.label}</span>}
          </div>
        </div>
        <ActionButton variant="secondary" size="compact" icon={<History size={15} aria-hidden="true" />}
          aria-expanded={historyOpen} aria-controls={historyOpen ? 'validation-report-history' : undefined} onClick={onToggleHistory}>
          검사 이력
        </ActionButton>
      </div>
      <ReviewNotice tone={copy.tone} title={copy.title} action={reviewOpen ? (
        <ActionButton onClick={onComplete} disabled={summary?.canCompleteReview !== true || completing}>
          {completing ? '검토 완료를 요청하고 있어요…' : '검토 완료 후 설정 추출'}
        </ActionButton>
      ) : undefined}>
        {copy.lines.map(line => <p key={line}>{line}</p>)}
        {reviewOpen && summary?.canCompleteReview !== true && holdReasons.length > 0 && (
          <ul className="vr-hold-list" aria-label="설정 추출 보류 사유">
            {holdReasons.map(reason => <li key={reason}>{HOLD_REASON_COPY[reason]}</li>)}
          </ul>
        )}
      </ReviewNotice>

      {applicationHeld && (
        <div className="vr-actions" data-testid="application-held">
          <div className="vr-muted vr-actions__note">
            {summary?.application?.attempt ? `확정 시도 ${summary.application.attempt}회 · ` : ''}확정 보류 사유
            <ul className="vr-hold-list">
              {holdLines.length > 0
                ? holdLines.map(line => <li key={line.label}>{line.label}{line.count > 1 ? ` (${line.count}건)` : ''}</li>)
                : <li>확정할 수 없는 후보가 있어요.</li>}
            </ul>
          </div>
          <ActionButton onClick={onApply} disabled={!summary?.allowedActions?.includes('APPLY_SETTINGS') || applying}>
            {applying ? '설정 확정을 요청하고 있어요…' : '설정 확정 다시 시도'}
          </ActionButton>
          {candidateReviewUrl && <Link className="vr-link-button" to={candidateReviewUrl}>설정 후보 확인</Link>}
        </div>
      )}
      {message}
      {children}
    </section>
  );
}

function baselineLabel(status?: string) {
  if (status === 'READY') return '준비됨';
  if (status === 'PENDING' || status === 'NOT_STARTED') return '준비 중';
  if (status === 'FAILED') return '준비하지 못함';
  if (status === 'INVALIDATED') return '무효';
  return '확인 중';
}

export function ReportBasisCard({ staging, summary, results, resultsUnavailable, onReloadResults, onRetry, retrying, message }: {
  staging?: ValidationStagingResponse;
  summary?: ValidationReviewSummaryResponse;
  results: ValidationResultsView | null;
  resultsUnavailable: boolean;
  onReloadResults: () => void;
  onRetry: () => void;
  retrying: boolean;
  message?: ReactNode;
}) {
  const execution = summary?.executionStatus ?? staging?.executionStatus;
  const stage = summary?.reviewStage ?? staging?.reviewStage;
  const mode = summary?.mode ?? staging?.mode;
  const checking = (execution && ACTIVE_EXECUTION.has(execution)) || stage === 'VALIDATING' || stage === 'PREPARING_BASELINE';
  const basis = mode === 'DIAGNOSTIC_ONLY'
    ? '이전 원고의 설정은 확정했어요. 이번 재검수는 검사 결과만 제공해요.'
    : checking ? '오류 검토를 마친 뒤 이번 회차의 설정을 추출해요.' : '기존 확정 설정과 비교해 이번 회차를 검사했어요.';
  const fingerprint = staging?.baselineFingerprint?.slice(0, 8);
  const coverage = results?.coverage;
  const incomplete = results != null && results.status !== 'COMPLETED' && results.status !== 'NOT_STARTED' && !checking;
  const retryAllowed = summary?.allowedActions?.includes('RETRY') === true;

  const [expanded, setExpanded] = useState(false);
  const settingStatus = resultsUnavailable ? '—' : branchStatusLabel(results?.settingStatus ?? (results?.status === 'NOT_STARTED' ? 'NOT_STARTED' : undefined));
  const typoStatus = resultsUnavailable ? '—' : branchStatusLabel(results?.typoStatus ?? (results?.status === 'NOT_STARTED' ? 'NOT_STARTED' : undefined));

  return (
    <section className="vr-card vr-basis" aria-labelledby="validation-report-basis">
      <div className="vr-basis__row">
        <div className="vr-basis__lead">
          <h2 id="validation-report-basis">검사 기준과 범위</h2>
          <p className="vr-muted vr-lead">{basis}</p>
        </div>
        <ul className="vr-basis__status" aria-label="검사 범위 요약">
          <li><span>비교 기준</span><strong>{baselineLabel(staging?.baselineStatus)}</strong></li>
          <li><span>설정 충돌 검사</span><strong>{settingStatus}</strong></li>
          <li><span>오탈자 검사</span><strong>{typoStatus}</strong></li>
        </ul>
        <button type="button" className="vr-link-button" aria-expanded={expanded} aria-controls="validation-report-basis-detail"
          onClick={() => setExpanded(value => !value)}>
          {expanded ? '검사 기준 접기' : '검사 기준 보기'}
        </button>
      </div>
      <div id="validation-report-basis-detail" hidden={!expanded}>
        <dl className="vr-facts">
          <div><dt>기준 시점</dt><dd>{fingerprint ? `검수 접수 때 고정한 기준 · ${fingerprint}` : '검수 접수 때 고정한 기준'}</dd></div>
          {results?.totalChecks != null && (
            <div><dt>확인한 설정 질문</dt><dd>{`${results.completedChecks ?? 0} / ${results.totalChecks}개`}</dd></div>
          )}
          {coverage?.gridReady && coverage.requiredStages != null && (
            <div><dt>필수 검사 단위</dt><dd>{`${coverage.completedStages ?? 0} / ${coverage.requiredStages}개 완료`}</dd></div>
          )}
        </dl>
        <p className="vr-muted vr-lead">검사에 사용한 값은 현재 설정 관리의 값과 다를 수 있어요. 비교 기준을 현재값으로 덮어쓰지 않아요.</p>
      </div>
      {resultsUnavailable && (
        <ReviewNotice tone="warning" title="검사 범위를 불러오지 못했어요."
          action={<ActionButton variant="secondary" size="compact" icon={<RefreshCw size={14} aria-hidden="true" />} onClick={onReloadResults}>다시 불러오기</ActionButton>} />
      )}
      {incomplete && (
        <ReviewNotice tone="warning" title="아직 검사하지 못한 범위가 있어요.">
          <p>검사하지 못한 범위를 특정할 수 없어요.</p>
          {coverage?.gridReady && coverage.requiredStages != null && coverage.completedStages != null
            && <p>{`필수 검사 단위 ${coverage.requiredStages}개 중 ${coverage.requiredStages - coverage.completedStages}개를 마치지 못했어요.`}</p>}
        </ReviewNotice>
      )}
      {retryAllowed && (
        <div className="vr-actions">
          <ActionButton variant="secondary" onClick={onRetry} disabled={retrying}>
            {retrying ? '다시 시도를 요청하고 있어요…' : '중단된 검사 다시 시도'}
          </ActionButton>
        </div>
      )}
      {message}
    </section>
  );
}
