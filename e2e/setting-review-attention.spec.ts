import { expect, test, type Page, type Route } from '@playwright/test';
import type { SettingCandidateResponse } from '../src/app/api/generated/types.gen';
import { computedContrastRatio } from './contrast';

const workId = '11111111-1111-4111-8111-111111111111';
const batchId = '22222222-2222-4222-8222-222222222222';
const member = { id: 1, email: 'review-progress@example.com', displayName: '검토 집계', role: 'AUTHOR', status: 'ACTIVE' };
const zeroCounts = { confirmedCandidateCount: 0, dismissedCandidateCount: 0, directReviewCandidateCount: 0, processingCandidateCount: 0 };

function success(route: Route, data: unknown) {
  return route.fulfill({ status: 200, contentType: 'application/json',
    body: JSON.stringify({ success: true, data, error: null }) });
}

function candidate(index: number, overrides: Partial<SettingCandidateResponse> = {}): SettingCandidateResponse {
  return {
    id: `${index}3333333-3333-4333-8333-333333333333`, workId, episodeNo: 28,
    candidateKind: 'SETTING', entityType: 'CHARACTER', entityName: '비요른', rawEntityMention: '비요른',
    matchedCharacterId: '44444444-4444-4444-8444-444444444444', matchStatus: 'MATCHED',
    attributeName: 'profile.attribute', attributeValue: '끝까지 포기하지 않는다.', valueType: 'STRING',
    reviewStatus: 'PENDING_REVIEW', comparisonStatus: 'FAILED', manualReviewAvailable: true,
    evidenceSpans: [{ quote: '비요른은 끝까지 포기하지 않았다.' }], ...overrides,
  };
}

function group(name: string, candidates: SettingCandidateResponse[]) {
  return { groupKey: name, entityName: name, candidateCount: candidates.length,
    pendingCandidateCount: candidates.filter(row => row.reviewStatus === 'PENDING_REVIEW').length,
    evidenceEpisodeNos: [28], candidates };
}

function pageOf(content: unknown[], page = 0, pages = 1) {
  return { content, page, size: 20, totalElements: pages > 1 ? 21 : content.length,
    totalPages: content.length ? pages : 0, hasNext: page + 1 < pages };
}

async function authenticateAndOpen(page: Page, query = '') {
  await page.addInitScript(() => localStorage.setItem('accessToken', 'isolated-review-progress-test'));
  await page.goto(`/setting-review?workId=${workId}&batchId=${batchId}${query}`);
}

async function expectProgress(page: Page, counts: { confirmed: number; dismissed: number; direct: number; processing?: number }) {
  const summary = page.getByRole('region', { name: '설정 후보 검토 요약' });
  for (const [label, count] of [['반영됨', counts.confirmed], ['제외됨', counts.dismissed], ['직접 확인', counts.direct]] as const) {
    await expect(summary.locator('.setting-review-summary__item').filter({ hasText: label }).locator('strong')).toHaveText(`${count}개`);
  }
  if (counts.processing) await expect(summary.getByRole('status')).toContainText(`분석 중 ${counts.processing}개`);
  else await expect(summary.getByRole('status')).toHaveCount(0);
  const buttonText = [counts.direct ? `직접 확인 ${counts.direct}개` : null,
    counts.processing ? `분석 중 ${counts.processing}개` : null].filter(Boolean).join(' · ');
  if (buttonText) await expect(page.getByRole('button', { name: buttonText, exact: true })).toBeDisabled();
}

for (const width of [1280, 320]) {
  test(`모든 보류를 직접 확인에 포함하고 탭·필터·페이지에 관계없이 합계를 유지한다 (${width}px)`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 });
    let mutations = 0;
    const bjorn = group('비요른', [candidate(3), candidate(5, { attributeName: 'profile.description' })]);
    const unknown = group('미상', [candidate(6, { entityName: '미상', matchedCharacterId: null,
      matchStatus: 'AMBIGUOUS', comparisonStatus: 'NOT_REQUIRED' })]);
    await page.route('**/api/v1/**', route => {
      const url = new URL(route.request().url());
      if (route.request().method() !== 'GET') mutations += 1;
      if (url.pathname.endsWith('/auth/me')) return success(route, member);
      if (url.pathname.endsWith('/setting-candidates')) {
        const pageNumber = Number(url.searchParams.get('page') ?? 0);
        const filtered = url.searchParams.has('matchStatuses');
        return success(route, {
          batchId, episodeStartNo: 23, episodeEndNo: 28, episodeCount: 6,
          totalCandidateCount: 10, reviewedCandidateCount: 7, pendingCandidateCount: 3,
          matchRequiredCandidateCount: 1, attentionRequiredCandidateCount: 3,
          ...zeroCounts, confirmedCandidateCount: 7, directReviewCandidateCount: 3,
          groups: pageOf(filtered ? [bjorn] : pageNumber ? [unknown] : [bjorn], pageNumber, filtered ? 1 : 2),
        });
      }
      if (url.pathname.endsWith('/world-setting-candidates')) return success(route, {
        batchId, episodeStartNo: 23, episodeEndNo: 28, episodeCount: 6,
        totalCandidateCount: 119, reviewedCandidateCount: 118, pendingCandidateCount: 1,
        ...zeroCounts, confirmedCandidateCount: 113, dismissedCandidateCount: 5, directReviewCandidateCount: 1,
        pendingComparisonCount: 0, processingComparisonCount: 0, failedComparisonCount: 0,
        recomparisonRequiredCount: 0, conflictCandidateCount: 0,
        groups: pageOf([{ groupKey: 'POWER_SYSTEM|정령술', category: 'POWER_SYSTEM', subjectName: '정령술',
          changeCount: 1, status: 'COMPLETED', reviewRequiredCount: 0, candidates: [{
            id: '88888888-8888-4888-8888-888888888888', workId, sourceEpisodeNo: 28,
            category: 'POWER_SYSTEM', subjectName: '정령술', settingName: '회복 시간', extractedValue: '10분',
            reviewStatus: 'PENDING_REVIEW', comparisonStatus: 'COMPLETED', suggestedOperation: 'ADD',
            automaticReviewHoldReason: 'SUBJECT_CONFIRMATION_REQUIRED', evidenceSpans: [{ quote: '정령은 10분을 쉰다.' }],
          }] }]),
      });
      return success(route, []);
    });
    await authenticateAndOpen(page);
    await expectProgress(page, { confirmed: 120, dismissed: 5, direct: 4 });
    await expect(page.locator('.candidate-group-card')).toContainText('직접 확인 2개');
    await expect(page.getByRole('button', { name: /^캐릭터 후보/ })).toContainText('직접 확인 3개');
    await expect(page.getByRole('button', { name: /세계관 후보/ })).toContainText('직접 확인 1개');
    const summary = page.getByRole('region', { name: '설정 후보 검토 요약' });
    const directMetric = summary.locator('.is-direct');
    expect(await computedContrastRatio(directMetric.locator('strong'), directMetric)).toBeGreaterThanOrEqual(4.5);
    await expect(page.locator('.app-route-layer')).toHaveCSS('opacity', '1');
    const geometry = await summary.locator('.setting-review-summary__item').evaluateAll(items => items.map(item => {
      const box = item.getBoundingClientRect();
      const value = item.querySelector('strong')!.getBoundingClientRect();
      return { y: box.y, width: box.width, containsValue: value.left >= box.left && value.right <= box.right };
    }));
    expect(geometry.every(item => item.containsValue)).toBeTruthy();
    expect(Math.max(...geometry.map(item => item.y)) - Math.min(...geometry.map(item => item.y))).toBeLessThanOrEqual(1);
    await page.screenshot({ path: `docs/screens/gh180-direct-review-${width}.png`, fullPage: true });
    await page.locator('.candidate-group-card').click();
    await expect(page.getByText('특징', { exact: true })).toBeVisible();
    await expect(page.locator('.setting-candidate-detail').first()).toContainText('검토 필요');
    await expect(page.locator('.setting-candidate-detail').first()).toContainText('자동 비교를 마치지 못해 대상과 내용을 확인해 주세요.');
    await expect(page.locator('.setting-candidate-detail').first()).not.toContainText('비교 실패');
    await expect(page.getByText('attribute', { exact: true })).toHaveCount(0);
    await expect(page.getByText('끝까지 포기하지 않는다.', { exact: true }).first()).toBeVisible();
    if (width === 320) await page.getByRole('button', { name: '후보 목록으로', exact: true }).click();
    await page.getByRole('button', { name: '다음 페이지' }).click();
    await expect(page.locator('.candidate-group-card')).toContainText('미상');
    await expect(page.locator('.candidate-group-card')).toContainText('직접 확인 1개');
    await expectProgress(page, { confirmed: 120, dismissed: 5, direct: 4 });
    const connectionFilter = page.getByRole('group', { name: '캐릭터 연결 상태', exact: true });
    if (width === 320) await connectionFilter.getByRole('combobox').selectOption('CONNECTED');
    else await connectionFilter.getByRole('button', { name: '연결됨', exact: true }).click();
    await expect(page.locator('.candidate-group-card')).toContainText('비요른');
    await expectProgress(page, { confirmed: 120, dismissed: 5, direct: 4 });
    await page.getByRole('button', { name: /세계관 후보/ }).click();
    await expectProgress(page, { confirmed: 120, dismissed: 5, direct: 4 });
    await expect(page.locator('.world-candidate-group-card')).toContainText('직접 확인 1개');
    await page.locator('.world-candidate-group-card').click();
    await expect(page.locator('.world-setting-diff-row__header')).toContainText('같은 대상인지 확인');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBeTruthy();
    expect(mutations).toBe(0);
  });
}

test('확정·제외는 직접 확인에서 빠지고 겹친 사유·수정 저장·비교 대기를 서로 중복 없이 표시한다', async ({ page }) => {
  const candidates = [
    candidate(3, { matchStatus: 'AMBIGUOUS', automaticReviewHoldReason: 'SUBJECT_CONFIRMATION_REQUIRED' }),
    candidate(4, { comparisonStatus: 'RECOMPARISON_REQUIRED' }),
    candidate(5, { reviewStatus: 'CONFIRMED' }),
    candidate(6, { reviewStatus: 'DISMISSED', matchStatus: 'AMBIGUOUS' }),
    candidate(7, { matchStatus: 'UNRESOLVED', matchedCharacterId: null, comparisonStatus: 'NOT_REQUIRED' }),
    candidate(8, { comparisonStatus: 'COMPLETED', userModified: true, attributeName: 'profile.description' }),
    candidate(9, { comparisonStatus: 'PROCESSING' }),
    candidate(1, { comparisonStatus: 'PENDING', matchStatus: 'AMBIGUOUS' }),
  ];
  await page.route('**/api/v1/**', route => {
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith('/auth/me')) return success(route, member);
    if (path.endsWith('/setting-candidates')) return success(route, {
      batchId, totalCandidateCount: 8, reviewedCandidateCount: 2, pendingCandidateCount: 6,
      matchRequiredCandidateCount: 2, attentionRequiredCandidateCount: 3,
      confirmedCandidateCount: 1, dismissedCandidateCount: 1, directReviewCandidateCount: 4, processingCandidateCount: 2,
      groups: pageOf([group('비요른', candidates)]),
    });
    if (path.endsWith('/world-setting-candidates')) return success(route, {
      batchId, totalCandidateCount: 0, reviewedCandidateCount: 0, pendingCandidateCount: 0, ...zeroCounts, groups: pageOf([]),
    });
    return success(route, []);
  });
  await authenticateAndOpen(page, '&reviewStatus=ALL');
  await expect(page.locator('.candidate-group-card')).toContainText('직접 확인 4개');
  await expect(page.locator('.candidate-group-card')).toContainText('분석 중 2개');
  await expectProgress(page, { confirmed: 1, dismissed: 1, direct: 4, processing: 2 });
  await expect(page.locator('.setting-candidate-detail').first()).toContainText('같은 대상인지 확인');
});

test('이전 서버가 새 집계를 보내지 않으면 반영·제외·직접 확인 개수를 추측하지 않는다', async ({ page }) => {
  await page.route('**/api/v1/**', route => {
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith('/auth/me')) return success(route, member);
    if (path.endsWith('/setting-candidates')) return success(route, {
      batchId, totalCandidateCount: 1, reviewedCandidateCount: 0, pendingCandidateCount: 1,
      matchRequiredCandidateCount: 1, groups: pageOf([group('미상', [candidate(3, {
        entityName: '미상', matchStatus: 'AMBIGUOUS', comparisonStatus: 'NOT_REQUIRED',
      })])]),
    });
    if (path.endsWith('/world-setting-candidates')) return success(route, {
      batchId, totalCandidateCount: 0, reviewedCandidateCount: 0, pendingCandidateCount: 0, groups: pageOf([]),
    });
    return success(route, []);
  });
  await authenticateAndOpen(page);
  const summary = page.getByRole('region', { name: '설정 후보 검토 요약' });
  await expect(summary.locator('.setting-review-summary__item strong')).toHaveText(['—', '—', '—']);
  await expect(page.getByRole('button', { name: '남은 설정을 확인해 주세요', exact: true })).toBeDisabled();
});

for (const activeTab of ['character', 'world']) {
  test(`보이지 않는 페이지의 비교도 전체 집계로 갱신하고 완료되면 멈춘다 (${activeTab})`, async ({ page }) => {
    await page.clock.install();
    let finished = false;
    let characterReads = 0;
    await page.route('**/api/v1/**', route => {
      const path = new URL(route.request().url()).pathname;
      if (path.endsWith('/auth/me')) return success(route, member);
      if (path.endsWith('/setting-candidates')) {
        characterReads += 1;
        return success(route, { batchId, totalCandidateCount: 3,
          reviewedCandidateCount: finished ? 2 : 0, pendingCandidateCount: finished ? 1 : 3,
          ...zeroCounts, confirmedCandidateCount: finished ? 2 : 0,
          directReviewCandidateCount: 1, processingCandidateCount: finished ? 0 : 2,
          groups: pageOf([group('비요른', [candidate(3)])]),
        });
      }
      if (path.endsWith('/world-setting-candidates')) return success(route, {
        batchId, totalCandidateCount: 0, reviewedCandidateCount: 0, pendingCandidateCount: 0,
        ...zeroCounts, groups: pageOf([]),
      });
      return success(route, []);
    });
    await authenticateAndOpen(page, activeTab === 'world' ? '&candidateType=world' : '');
    await expectProgress(page, { confirmed: 0, dismissed: 0, direct: 1, processing: 2 });
    finished = true;
    await page.clock.runFor(2200);
    await expectProgress(page, { confirmed: 2, dismissed: 0, direct: 1 });
    const readsAtCompletion = characterReads;
    await page.clock.runFor(6500);
    expect(characterReads).toBe(readsAtCompletion);
  });
}
