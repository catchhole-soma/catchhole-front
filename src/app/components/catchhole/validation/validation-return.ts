import { validationReportUrl } from './validation-report-labels';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ENUM = /^[A-Z_]{1,40}$/;
const PAGE = /^[1-9]\d{0,4}$/;

const REPORT_RETURN_VALUE = 'validation-report';

/**
 * 리포트 URL의 선택·필터 키와 복귀 문맥 키. 원고 목록의 `page`와 겹치지 않도록 `report` 접두사를 붙인다.
 * 인용·근거·원문·설정값은 넣지 않고 식별자와 필터 값만 옮긴다.
 */
const RETURN_PAIRS = [
  ['findingId', 'reportFindingId', (value: string) => UUID.test(value)],
  ['branch', 'reportBranch', (value: string) => value === 'SETTING' || value === 'TYPO'],
  ['judgment', 'reportJudgment', (value: string) => ENUM.test(value)],
  ['outcome', 'reportOutcome', (value: string) => ENUM.test(value)],
  ['page', 'reportPage', (value: string) => PAGE.test(value)],
] as const;

export type ReportReturn = { reportId: string; url: string };

function returnQuery(reportId: string, reportParams: URLSearchParams) {
  const params = new URLSearchParams({ returnTo: REPORT_RETURN_VALUE, reportId });
  for (const [source, target, valid] of RETURN_PAIRS) {
    const value = reportParams.get(source);
    if (value && valid(value)) params.set(target, value);
  }
  return params.toString();
}

/** A9: 같은 episodeId의 기존 파일 교체 모달을 리포트 복귀 문맥과 함께 연다. 회차 번호·제목으로 대상을 고르지 않는다. */
function episodeReplaceUrl(workId: string, episodeId: string, reportId: string, reportParams: URLSearchParams) {
  return `/dashboard?workId=${encodeURIComponent(workId)}&nav=manuscripts&modal=episode-replace`
    + `&episodeId=${encodeURIComponent(episodeId)}&${returnQuery(reportId, reportParams)}`;
}

/** A10: 기존 설정 관리로 이동한다. 공개 계약에 대상·기준 항목 식별자가 없어 특정 캐릭터·세계관을 열지 않는다. */
function settingCorrectionUrl(workId: string, reportId: string, reportParams: URLSearchParams) {
  return `/dashboard?workId=${encodeURIComponent(workId)}&nav=settingDB&tab=characters&${returnQuery(reportId, reportParams)}`;
}

/** A9·A10은 현재 결과에서만 기존 수정 화면으로 보낸다. 무효·이전 결과는 episodeId 없이 호출한다. */
export function reportFixLinks(workId: string, reportId: string, episodeId: string | undefined, reportParams: URLSearchParams) {
  return episodeId
    ? { replace: episodeReplaceUrl(workId, episodeId, reportId, reportParams), correct: settingCorrectionUrl(workId, reportId, reportParams) }
    : undefined;
}

/** 대시보드 URL의 복귀 문맥을 검증해 리포트 주소로 되돌린다. 형식이 맞지 않는 값은 버린다. */
export function readReportReturn(params: URLSearchParams, workId: string): ReportReturn | null {
  if (params.get('returnTo') !== REPORT_RETURN_VALUE) return null;
  const reportId = params.get('reportId') ?? '';
  if (!UUID.test(reportId) || !UUID.test(workId)) return null;
  const extra = new URLSearchParams();
  for (const [source, target, valid] of RETURN_PAIRS) {
    const value = params.get(target);
    if (value && valid(value)) extra.set(source, value);
  }
  const query = extra.toString();
  return { reportId, url: validationReportUrl(workId, reportId, query ? `&${query}` : '') };
}
