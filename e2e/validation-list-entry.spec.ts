import { expect, test, type Page, type Route } from '@playwright/test';
import review from './fixtures/validation/validation-review-v1.json' with { type: 'json' };

/**
 * GH314 F2 목록 진입: 분석 목록 카드·원고 목록 행·최근 배치 배너는 배치 요약의 reviewStage만으로 표시하고
 * 모든 단계에서 같은 오류 리포트를 연다. 카드마다 상세·검수 조회를 보태지 않는다.
 */
const workId = '11111111-1111-4111-8111-111111111111';
const batchId = '22222222-2222-4222-8222-222222222222';
const releaseJobId = '33333333-3333-4333-8333-333333333333';
const validation = review.responses.batchValidationReport;

function validationBatch(reviewStage: string, extra: Record<string, unknown> = {}) {
  return {
    batchId, uploadType: 'SINGLE_EPISODE', status: 'ERROR_REVIEW_PENDING', episodeStatus: 'ERROR_REVIEW_PENDING',
    episodeStartNo: 101, episodeEndNo: 101, episodeCount: 1, jobGroups: [], episodeJobGroups: [], settingBooks: [],
    lastActivityAt: '2026-10-30T11:00:00', validationReports: [{ ...validation, reviewStage }], ...extra,
  };
}

async function setup(page: Page, batches: () => unknown[], episodes: unknown[] = []) {
  const calls: string[] = [];
  await page.addInitScript(() => localStorage.setItem('accessToken', 'validation-list-entry'));
  await page.route('**/api/v1/**', (route: Route) => {
    const url = new URL(route.request().url());
    calls.push(url.pathname);
    const data = url.pathname.endsWith('/auth/me') ? { id: 1, email: 'list@example.test', displayName: '목록', role: 'AUTHOR', status: 'ACTIVE' }
      : url.pathname.endsWith('/analysis-jobs/batches') ? { content: batches(), page: 0, size: 10, totalPages: 1, totalElements: 1 }
        : url.pathname === `/api/v1/works/${workId}` ? { id: workId, title: '돌아온 검', genre: '판타지', lifecycleStatus: 'ACTIVE' }
          : url.pathname === '/api/v1/works' ? [{ id: workId, title: '돌아온 검', episodeCount: 101 }]
            : url.pathname.endsWith('/episodes') ? episodes
              : [];
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data, error: null }) });
  });
  return calls;
}

const reportPath = `/episode-validation-report?workId=${workId}&reportId=${validation.reportId}`;
// 목록은 배치 요약만 읽는다. 검수 단건·결과·회차·Job 상세를 카드 보완용으로 호출하지 않는다.
const extraReads = (calls: string[]) => calls.filter(path => /\/(episode-validations|episodes|setting-candidates|world-setting-candidates)(\/|$)/.test(path)
  || /\/analysis-jobs(?:$|\/(?!batches$))/.test(path));

const STAGES: Array<[string, string]> = [
  ['VALIDATING', '오류 검사 중'],
  ['AWAITING_REVIEW', '오류 검토'],
  ['APPLICATION_HELD', '확정 보류'],
  ['APPLIED', '확정 완료'],
  ['INVALIDATED', '재검수 필요'],
];

for (const [stage, label] of STAGES) {
  test(`분석 목록의 검수 배치는 ${stage} 단계를 표시하고 오류 리포트를 연다`, async ({ page }) => {
    // 배치 status는 S1~S3 의미를 유지하므로 APPLIED여도 ERROR_REVIEW_PENDING이다. 화면은 reviewStage를 따른다.
    const calls = await setup(page, () => [validationBatch(stage)]);
    await page.goto(`/dashboard?workId=${workId}&nav=analyses`);
    const card = page.getByTestId('validation-analysis-card');
    await expect(card).toContainText('101화');
    await expect(card).toContainText('신규 회차 검수');
    await expect(card.locator('.analysis-status')).toHaveText(label);
    await expect(card.getByRole('button', { name: /결과 보기|진행 보기|실패 확인/ })).toHaveCount(0);
    expect(extraReads(calls)).toEqual([]);
    await card.getByRole('button', { name: '오류 리포트 보기', exact: true }).click();
    await expect(page).toHaveURL(new RegExp(reportPath.replace(/[?]/g, '\\?')));
    expect(await page.evaluate(() => window.history.state?.usr?.returnToAnalysisList)).toBe(`/dashboard?workId=${workId}&nav=analyses`);
  });
}

test('설정 추출 실패 단계는 리포트와 함께 추출 상태 보기를 제공하고 검사 중에는 요약만 10초마다 다시 읽는다', async ({ page }) => {
  await page.clock.install();
  let stage = 'VALIDATING';
  const failedGroup = { jobType: 'SETTING_EXTRACTION', status: 'FAILED', totalJobCount: 1, succeededJobCount: 0, failedJobCount: 1,
    pendingJobCount: 0, runningJobCount: 0, canceledJobCount: 0, currentAnalysisJobIds: [releaseJobId] };
  const calls = await setup(page, () => [validationBatch(stage, stage === 'EXTRACTION_FAILED' ? { episodeJobGroups: [failedGroup], jobGroups: [failedGroup] } : {})]);
  await page.goto(`/dashboard?workId=${workId}&nav=analyses`);
  const card = page.getByTestId('validation-analysis-card');
  await expect(card.locator('.analysis-status')).toHaveText('오류 검사 중');
  await expect.poll(() => calls.filter(path => path.endsWith('/batches')).length).toBe(1);
  stage = 'EXTRACTION_FAILED';
  await page.clock.fastForward(10_050);
  await expect(card.locator('.analysis-status')).toHaveText('설정 추출 실패');
  await expect(card).toContainText('검사와 검토 결과는 그대로 남아 있어요.');
  expect(extraReads(calls)).toEqual([]);
  await card.getByRole('button', { name: '추출 상태 보기', exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`currentAnalysisJobIds=${releaseJobId}`));
});

test('원고 목록 행은 검수 단계 배지로 리포트를 열고 최근 검수 배치 배너도 리포트로 보낸다', async ({ page }) => {
  await setup(page, () => [validationBatch('AWAITING_REVIEW')], [
    { id: validation.episodeId, episodeNo: 101, title: '성문 앞에서', charCount: 5200, status: 'UPLOADED', batchId,
      analysisStatus: 'ERROR_REVIEW_PENDING', validationReportId: validation.reportId, validationReviewStage: 'AWAITING_REVIEW' },
    // reviewStage가 없는 구응답은 analysisStatus를 표시용으로만 쓴다.
    { id: '44444444-4444-4444-8444-444444444444', episodeNo: 100, title: '이전 회차', charCount: 5000, status: 'ANALYZED', batchId,
      analysisStatus: 'ERROR_REVIEW_INVALIDATED', validationReportId: '55555555-5555-4555-8555-555555555555', validationReviewStage: null },
    { id: '66666666-6666-4666-8666-666666666666', episodeNo: 99, title: '일반 회차', charCount: 5000, status: 'ANALYZED', analysisStatus: 'COMPLETED' },
  ]);
  await page.goto(`/dashboard?workId=${workId}&nav=manuscripts`);
  const banner = page.getByTestId('latest-validation-notice');
  await expect(banner).toContainText('101화 신규 회차 검수 · 오류 검토');
  await expect(banner).toContainText('오류 리포트에서 검사 결과를 확인하고 판단을 남겨 주세요.');
  await expect(page.getByText('검토할 설정 후보가 있습니다.')).toHaveCount(0);
  const current = page.getByRole('link', { name: '101화 오류 리포트 보기 · 오류 검토' });
  await expect(current).toHaveAttribute('href', reportPath);
  await expect(page.getByRole('link', { name: '100화 오류 리포트 보기 · 재검수 필요' })).toBeVisible();
  await expect(page.locator('.manuscript-row').filter({ hasText: '일반 회차' }).locator('.manuscript-status')).toHaveText('분석 완료');
  await expect(page.locator('.manuscript-row').filter({ hasText: '성문 앞에서' }).getByRole('button', { name: '재분석', exact: true })).toHaveCount(0);
  await banner.getByRole('button', { name: '오류 리포트 보기', exact: true }).click();
  await expect(page).toHaveURL(new RegExp(reportPath.replace(/[?]/g, '\\?')));
});
