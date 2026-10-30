import { AlertCircle, Loader2 } from 'lucide-react';
import { ReviewNotice } from '../review-ui/ReviewPrimitives';
import { ActionButton } from '../ui-v2/ActionButton';
import { AnalysisProgressHero } from '../UploadLayout';
import { NextEpisodeBlockedNotice } from './ValidationEntryNotices';
import type { ValidationIntake } from './useValidationIntake';

function title(intake: ValidationIntake) {
  if (intake.phase === 'starting') return '검수를 접수하고 있어요';
  if (intake.phase === 'recovering') return '검수 접수 결과를 확인하고 있어요';
  switch (intake.failure?.kind) {
    case 'unconfirmed': return '검수 접수 결과를 확인하지 못했어요';
    case 'not-started': return '원고는 저장했지만 검수를 아직 접수하지 못했어요';
    case 'blocked':
    case 'refused': return '원고는 저장했지만 이 회차는 검수를 시작할 수 없어요';
    default: return '원고는 저장했지만 검수를 시작하지 못했어요';
  }
}

/** 업로드 직후 신규 회차 검수 접수 상태. 설정 추출 Job을 만들지 않고 접수 결과에 따라 리포트로 이동한다. */
export function ValidationIntakeStatus({ workId, workTitle, intake, onStart, onRecover, onFallback, fallbackPending, onManuscripts }: {
  workId: string;
  workTitle: string;
  intake: ValidationIntake;
  onStart: () => void;
  onRecover: () => void;
  onFallback: () => void;
  fallbackPending: boolean;
  onManuscripts: () => void;
}) {
  const busy = intake.phase !== 'failed';
  const failure = intake.failure;
  return (
    <div className="validation-intake" data-testid="validation-intake" aria-busy={busy}>
      <AnalysisProgressHero
        icon={busy
          ? <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 12 }}><Loader2 size={46} className="spin" aria-hidden="true" /></div>
          : <AlertCircle size={52} style={{ marginBottom: 12, color: 'var(--ch-warning)' }} aria-hidden="true" />}
        title={<span role="status">{title(intake)}</span>}
        description={`${workTitle} · 신규 회차 검수`}
      />
      {busy && (
        <p className="episode-processing__background-note">
          검수가 접수되면 오류 리포트로 이동해요. 설정 추출은 오류 검토를 마친 뒤에 시작해요.
        </p>
      )}
      {failure?.kind === 'unconfirmed' && (
        <ReviewNotice tone="warning" title="요청이 서버에 닿았는지 확인하지 못했어요.">
          <p>다시 확인해도 검수를 새로 만들지 않아요. 이미 접수됐다면 그 리포트로 이동해요.</p>
        </ReviewNotice>
      )}
      {failure?.kind === 'not-started' && (
        <ReviewNotice tone="warning" title="이 회차의 검수 기록이 아직 없어요.">
          <p>다시 시도하면 저장한 원고 그대로 검수를 접수해요. 원고를 다시 올릴 필요는 없어요.</p>
        </ReviewNotice>
      )}
      {failure?.kind === 'retryable' && <ReviewNotice tone="warning" title={failure.message} />}
      {failure?.kind === 'refused' && (
        <ReviewNotice tone="warning" title={failure.message}>
          {failure.detail && <p>{failure.detail}</p>}
          <p>저장한 원고는 원고 목록에 그대로 있어요.</p>
        </ReviewNotice>
      )}
      {failure?.kind === 'blocked' && <NextEpisodeBlockedNotice workId={workId} block={failure.block} />}
      {!busy && (
        <div className="validation-intake__actions">
          {failure?.kind === 'unconfirmed' && <ActionButton onClick={onRecover}>접수 결과 다시 확인</ActionButton>}
          {(failure?.kind === 'not-started' || failure?.kind === 'retryable') && <ActionButton onClick={onStart}>검수 접수 다시 시도</ActionButton>}
          {failure?.kind === 'refused' && failure.fallback && (
            <ActionButton onClick={onFallback} disabled={fallbackPending}>
              {fallbackPending ? '분석을 요청하고 있어요…' : '기존 설정 구축으로 분석 시작'}
            </ActionButton>
          )}
          <ActionButton variant="secondary" onClick={onManuscripts}>원고 목록에서 확인</ActionButton>
        </div>
      )}
    </div>
  );
}
