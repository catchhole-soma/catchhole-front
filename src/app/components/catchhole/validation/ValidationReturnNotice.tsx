import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { ReviewNotice } from '../review-ui/ReviewPrimitives';
import type { ReportReturn } from './validation-return';
import '../../../../styles/validation-entry.css';

/** 원고 교체·설정 정정 화면에서 리포트로 돌아가는 안내. 복귀만으로 새 검수를 시작하지 않는다. */
export function ReportReturnNotice({ reportReturn, tone = 'info', title, children, testId = 'validation-report-return' }: {
  reportReturn: ReportReturn;
  tone?: 'info' | 'success' | 'warning' | 'danger';
  title: string;
  children?: ReactNode;
  /** 상세 모달 안의 같은 안내는 화면 위 안내와 구분한다. */
  testId?: string;
}) {
  return (
    <div className="validation-entry-notice" data-testid={testId}>
      <ReviewNotice tone={tone} title={title}
        action={<Link className="ch-action ch-action--primary ch-action--compact validation-entry-link" to={reportReturn.url}>오류 리포트로 돌아가기</Link>}>
        {children}
      </ReviewNotice>
    </div>
  );
}
