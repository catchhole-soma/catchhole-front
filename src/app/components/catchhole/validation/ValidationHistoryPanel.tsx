import { Link } from 'react-router';
import type { PageResponseValidationReportHistoryResponse, ValidationReportHistoryResponse } from '../../../api/generated/types.gen';
import { PageNavigation } from '../PageNavigation';
import { ReviewNotice } from '../review-ui/ReviewPrimitives';
import { EXECUTION_LABELS, formatDateTime, REVIEW_STAGE_LABELS } from './validation-report-labels';

function historyFacts(row: ValidationReportHistoryResponse) {
  const facts = [
    row.executionStatus ? EXECUTION_LABELS[row.executionStatus] : null,
    row.counts ? `설정 충돌 ${row.counts.settingFindings ?? 0}건 · 오탈자 ${row.counts.typoFindings ?? 0}건` : null,
    row.mode === 'DIAGNOSTIC_ONLY' ? '결과 전용 재검수' : null,
    row.completion ? `검토 종료 ${row.completion.trigger === 'AUTOMATIC' ? '(자동)' : '(직접)'} ${formatDateTime(row.completion.completedAt) ?? ''}`.trim() : null,
    row.application ? `${row.application.status === 'APPLIED' ? '확정 완료' : '확정 보류'} ${formatDateTime(row.application.appliedAt) ?? ''}`.trim() : null,
    row.releaseHold ? '자동 설정 추출 보류' : null,
    row.invalidatedAt ? `무효 ${formatDateTime(row.invalidatedAt) ?? ''}`.trim() : null,
  ];
  return facts.filter((fact): fact is string => Boolean(fact));
}

/** R7 이전 검수 요약. 당시 집계만 보여 주며 인용·판단 목록은 요청하지 않는다. */
export function ValidationHistoryPanel({ history, loading, error, onRetry, viewingReportId, reportUrl, linkState, page, onPageChange }: {
  history?: PageResponseValidationReportHistoryResponse;
  loading: boolean;
  error: boolean;
  onRetry: () => void;
  viewingReportId: string;
  reportUrl: (reportId: string) => string;
  /** 이전 결과에서 "최신 결과로 돌아가기"가 보던 목록·선택을 복원할 수 있게 현재 주소를 전달한다. */
  linkState: unknown;
  page: number;
  onPageChange: (page: number) => void;
}) {
  const rows = history?.content ?? [];
  return (
    <section id="validation-report-history" className="vr-card" aria-labelledby="validation-report-history-title">
      <div className="vr-history-head">
        <h2 id="validation-report-history-title">검사 이력</h2>
        <span className="vr-muted">당시 집계만 보여 줘요. 이전 결과의 인용과 판단 목록은 제공하지 않아요.</span>
      </div>
      {error ? (
        <ReviewNotice tone="warning" title="검사 이력을 불러오지 못했어요."
          action={<button type="button" className="vr-link-button" onClick={onRetry}>다시 불러오기</button>}>
          <p>현재 결과는 그대로 확인할 수 있어요.</p>
        </ReviewNotice>
      ) : loading && rows.length === 0 ? (
        <p className="vr-muted" role="status">검사 이력을 불러오고 있어요.</p>
      ) : rows.length === 0 ? (
        <p className="vr-muted">이 회차의 첫 검수예요.</p>
      ) : (
        <ol className="vr-history-rows">
          {rows.map(row => (
            <li key={row.reportId} className={`vr-history-row${row.reportId === viewingReportId ? ' is-viewing' : ''}`}>
              <div className="vr-history-row__top">
                <strong>{`${row.revision ?? '—'}번째 검수`}</strong>
                <span className="vr-muted">{formatDateTime(row.requestedAt) ?? '접수 시각 확인 불가'}</span>
                {row.reviewStage && <span className="vr-chip">{REVIEW_STAGE_LABELS[row.reviewStage]}</span>}
                {row.current && <span className="vr-chip is-primary">현재 결과</span>}
                {row.reportId === viewingReportId && <span className="vr-chip is-primary">보고 있는 결과</span>}
              </div>
              <span className="vr-muted">{historyFacts(row).join(' · ')}</span>
              {row.reportId && row.reportId !== viewingReportId && (
                <Link className="vr-link-button" to={reportUrl(row.reportId)} state={linkState}>{row.current ? '현재 결과 보기' : '이 검수 요약 보기'}</Link>
              )}
            </li>
          ))}
        </ol>
      )}
      <PageNavigation page={page} totalPages={history?.totalPages ?? 0} disabled={loading} onPageChange={onPageChange} />
    </section>
  );
}
