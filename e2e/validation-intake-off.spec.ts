import { expect, test, type Page } from '@playwright/test';
import results from './fixtures/validation/validation-results-v1.json' with { type: 'json' };
import { authenticate, mockValidationReport, type ReportScenario } from './fixtures/validation/report-mock';

test.skip(process.env.VITE_EPISODE_VALIDATION_INTAKE_ENABLED !== 'false',
  'VITE_EPISODE_VALIDATION_INTAKE_ENABLED=false(운영 기본)인 빌드만 검증합니다.');

const PAUSED = '오류 리포트(신규 회차 검수)는 점검 중이라 새 검수 접수와 재검수를 잠시 막아 두었어요. 기존 리포트는 계속 볼 수 있어요.';

async function open(page: Page, scenario: ReportScenario = {}) {
  const mock = await mockValidationReport(page, scenario);
  await authenticate(page);
  await page.goto(mock.url(''));
  await expect(page.locator('#validation-report-title')).toBeVisible();
  return mock;
}

test('접수 OFF 빌드는 기존 리포트를 읽게 두되 중단 검사 재시도·재검수 진입점 대신 점검 안내만 보여 준다', async ({ page }) => {
  const mock = await open(page, {
    staging: { executionStatus: 'PARTIAL' },
    summary: { holdReasons: ['EXECUTION_NOT_COMPLETED', 'PENDING_JUDGMENTS'], allowedActions: ['SAVE_JUDGMENT', 'RETRY'] },
    results: { ...results.completed, status: 'PARTIAL', settingStatus: 'PARTIAL', completedChecks: 2,
      coverage: { ...results.completed.coverage, requiredStages: 8, completedStages: 5 } },
  });
  // 리포트 본문과 미검사 범위 안내는 그대로 읽을 수 있다.
  await expect(page.getByText('필수 검사 단위 8개 중 3개를 마치지 못했어요.')).toBeVisible();
  // 서버가 RETRY를 허용해도 접수가 막힌 빌드는 재시도·재검수 버튼을 내지 않고 점검 안내만 보여 준다.
  await expect(page.getByRole('button', { name: '중단된 검사 다시 시도' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: '수정 내용으로 재검수' })).toHaveCount(0);
  await expect(page.getByText(PAUSED).first()).toBeVisible();
  expect(mock.state.requests.filter(request => request.method === 'POST')).toHaveLength(0);
});
