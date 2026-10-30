import { useState } from 'react';
import type { ValidationFindingDetailResponse } from '../../../api/generated/types.gen';
import type { useEpisodeValidationReport } from '../../../hooks/useEpisodeValidationReport';
import { toApiError } from '../../../lib/api-errors';
import { JUDGMENT_LABELS, type Judgment } from './validation-report-labels';

export type ReportNotice = { tone: 'info' | 'warning' | 'danger' | 'success'; text: string } | null;
export type ReportActionArea = 'completion' | 'retry' | 'application';
type ReportData = ReturnType<typeof useEpisodeValidationReport>;

const JUDGMENT_CONFLICT_COPY: Record<string, string> = {
  VALIDATION_JUDGMENT_VERSION_CONFLICT: '다른 곳에서 판단이 바뀌었어요. 최신 판단을 확인한 뒤 다시 선택해 주세요.',
  VALIDATION_JUDGMENT_STALE: '새 근거로 다시 확인한 항목이 있어 이 판단을 저장하지 않았어요. 최신 내용을 확인해 주세요.',
  VALIDATION_JUDGMENT_LOCKED: '지금은 판단을 저장할 수 없어요. 최신 검사 상태를 확인해 주세요.',
};
const ACTION_PROGRESS: Record<ReportActionArea, string> = {
  completion: '검토 완료를 요청하고 있어요.',
  retry: '중단된 검사 다시 시도를 요청하고 있어요.',
  application: '설정 확정을 요청하고 있어요.',
};

function savedJudgmentText(judgment: Judgment) {
  if (judgment === 'PENDING') return '검토 필요로 되돌렸어요.';
  return `${JUDGMENT_LABELS[judgment]}${judgment === 'KEEP_ORIGINAL' ? '로' : '으로'} 표시했어요.`;
}

function actionErrorText(error: unknown) {
  const api = toApiError(error);
  if (!api || api.status === 0 || api.status >= 500) return '요청 결과를 확인하지 못했어요. 최신 상태를 다시 불러왔어요. 필요하면 다시 눌러 주세요.';
  if (api.code === 'VALIDATION_REPORT_VERSION_CONFLICT') return '다른 곳에서 검토 내용이 바뀌었어요. 최신 상태를 확인한 뒤 다시 눌러 주세요.';
  return api.message || '요청을 처리하지 못했어요.';
}

/**
 * 판단 저장(A6~A8·A16~A18)과 A12·A15·명시 반영 요청. 결과는 화면 안내와 aria-live로 함께 알리고,
 * 성공·실패 모두 서버 상태를 다시 읽는다. 충돌을 자동으로 덮어쓰지 않는다.
 */
export function useValidationReportActions({ workId, reportId, report }: { workId: string; reportId: string; report: ReportData }) {
  const [announcement, setAnnouncement] = useState('');
  const [judgmentNotice, setJudgmentNotice] = useState<ReportNotice>(null);
  const [actionNotice, setActionNotice] = useState<(NonNullable<ReportNotice> & { area: ReportActionArea }) | null>(null);

  const saveJudgment = (detail: ValidationFindingDetailResponse, judgment: Judgment) => {
    if (!detail.findingId || report.saveJudgment.isPending) return;
    // 이미 선택된 판단은 다시 저장하지 않는다.
    if ((detail.judgment?.value ?? 'PENDING') === judgment) return;
    setJudgmentNotice(null);
    setAnnouncement('판단을 저장하고 있어요.');
    report.saveJudgment.mutate({
      path: { workId, reportId, findingId: detail.findingId },
      body: {
        judgment,
        expectedJudgmentVersion: detail.judgment?.version ?? 0,
        expectedCheckRevision: detail.branch === 'SETTING' ? detail.checkRevision : undefined,
      },
    }, {
      onSuccess: response => {
        if (response.data) report.applySavedJudgment(response.data);
        const text = savedJudgmentText(judgment);
        setJudgmentNotice({ tone: 'success', text });
        setAnnouncement(text);
        void report.refreshReport();
      },
      onError: error => {
        const api = toApiError(error);
        const text = (api?.code && JUDGMENT_CONFLICT_COPY[api.code]) || '판단을 저장하지 못했어요. 기존 판단은 그대로예요. 잠시 후 다시 시도해 주세요.';
        setJudgmentNotice({ tone: api?.status === 409 ? 'warning' : 'danger', text });
        setAnnouncement(text);
        void report.refreshReport();
      },
    });
  };

  const requestAction = (area: ReportActionArea) => {
    const version = report.summary?.reportVersion;
    if (version == null) return;
    const keys = { completion: report.completionKey, retry: report.retryKey, application: report.applicationKey }[area];
    const body = { expectedReportVersion: version, idempotencyKey: keys.take(version) };
    setActionNotice(null);
    setAnnouncement(ACTION_PROGRESS[area]);
    const onError = (error: unknown) => {
      const api = toApiError(error);
      // 결과가 확정된 거절은 새 요청으로 다시 시작하고, 응답을 받지 못한 경우는 같은 키로 재시도해 중복 실행을 막는다.
      if (api && api.status >= 400 && api.status < 500) keys.reset();
      const text = actionErrorText(error);
      setActionNotice({ area, tone: 'danger', text });
      setAnnouncement(text);
      void report.refreshReport();
    };
    const onSuccess = (text: string) => {
      keys.reset();
      setActionNotice({ area, tone: 'success', text });
      setAnnouncement(text);
      void report.refreshReport();
    };
    const path = { workId, reportId };
    if (area === 'completion') report.completion.mutate({ path, body }, {
      onSuccess: () => onSuccess('검토를 마쳤어요. 이번 회차의 설정을 추출하고 있어요.'), onError,
    });
    else if (area === 'retry') report.retry.mutate({ path, body }, {
      onSuccess: () => onSuccess('중단된 검사를 다시 시작했어요. 검사가 끝날 때까지 판단은 잠겨요.'), onError,
    });
    else report.application.mutate({ path, body }, {
      onSuccess: response => onSuccess(response.data?.status === 'APPLIED'
        ? '이번 회차의 설정을 확정했어요.' : '설정 확정을 다시 보류했어요. 보류 사유를 확인해 주세요.'),
      onError,
    });
  };

  return {
    announcement,
    judgmentNotice,
    clearJudgmentNotice: () => setJudgmentNotice(null),
    actionNotice,
    saveJudgment,
    requestAction,
  };
}
