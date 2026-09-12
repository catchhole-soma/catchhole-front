import { expect, test, type Page, type Route } from '@playwright/test';
import type { SettingCandidateResponse, WorldSettingCandidateResponse } from '../src/app/api/generated/types.gen';
import { computedContrastRatio } from './contrast';

const workId = '11111111-1111-4111-8111-111111111111';
const batchId = '22222222-2222-4222-8222-222222222222';
const member = { id: 1, email: 'automatic-pending@example.com', displayName: '격리 검증', role: 'AUTHOR', status: 'ACTIVE' };
const emptyCounts = { confirmedCandidateCount: 0, dismissedCandidateCount: 0, directReviewCandidateCount: 0, processingCandidateCount: 0 };

function success(route: Route, data: unknown) {
  return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data, error: null }) });
}
function pageOf(content: unknown[], page = 0, pages = 1) {
  return { content, page, size: 20, totalElements: pages > 1 ? 21 : content.length,
    totalPages: content.length ? pages : 0, hasNext: page + 1 < pages };
}
function character(index: number, overrides: Partial<SettingCandidateResponse> = {}): SettingCandidateResponse {
  return { id: `${index}3333333-3333-4333-8333-333333333333`, workId, episodeNo: 35,
    candidateKind: 'SETTING', entityType: 'CHARACTER', entityName: '비요른', rawEntityMention: '비요른',
    matchedCharacterId: '44444444-4444-4444-8444-444444444444', matchStatus: 'MATCHED',
    attributeName: 'profile.attribute', attributeValue: '끝까지 포기하지 않는다.', valueType: 'STRING',
    reviewStatus: 'PENDING_REVIEW', comparisonStatus: 'COMPLETED', suggestedOperation: 'ADD',
    proposedFactValue: '끝까지 포기하지 않는다.', automaticApplicationPending: true,
    evidenceSpans: [{ quote: '비요른은 끝까지 포기하지 않았다.' }], ...overrides };
}
function world(index: number, overrides: Partial<WorldSettingCandidateResponse> = {}): WorldSettingCandidateResponse {
  return { id: `${index}8888888-8888-4888-8888-888888888888`, workId, sourceEpisodeNo: 35,
    category: 'POWER_SYSTEM', subjectName: '정령술', settingName: '회복 시간', extractedValue: '10분',
    reviewStatus: 'PENDING_REVIEW', comparisonStatus: 'COMPLETED', suggestedOperation: 'ADD',
    consolidationStatus: 'SINGLE', analysisMode: 'ORDERED_PROVISIONAL', automaticApplicationPending: true,
    evidenceSpans: [{ quote: '정령은 10분을 쉰다.' }], ...overrides };
}
function characterGroup(candidates: SettingCandidateResponse[]) {
  return { groupKey: '비요른', entityName: '비요른', candidateCount: candidates.length,
    pendingCandidateCount: candidates.filter(row => row.reviewStatus === 'PENDING_REVIEW').length,
    evidenceEpisodeNos: [33, 35], candidates };
}
function worldGroup(candidates: WorldSettingCandidateResponse[]) {
  return { groupKey: 'POWER_SYSTEM|정령술', category: 'POWER_SYSTEM', subjectName: '정령술',
    changeCount: candidates.length, status: 'READY', addCount: candidates.length, candidates, evidenceEpisodeNos: [33, 35] };
}
async function open(page: Page, candidateType: 'character' | 'world', query = '') {
  await page.addInitScript(() => localStorage.setItem('accessToken', 'isolated-automatic-pending'));
  await page.goto(`/setting-review?workId=${workId}&batchId=${batchId}&candidateType=${candidateType}${query}`);
}
async function expectCounts(page: Page, direct: number, processing: number, confirmed = 0) {
  const summary = page.getByRole('region', { name: '설정 후보 검토 요약' });
  await expect(summary.locator('.is-confirmed strong')).toHaveText(`${confirmed}개`);
  await expect(summary.locator('.is-direct strong')).toHaveText(`${direct}개`);
  if (processing) await expect(summary.getByRole('status')).toContainText(`분석 중 ${processing}개`);
  else await expect(summary.getByRole('status')).toHaveCount(0);
}

for (const width of [1280, 320]) {
  for (const candidateType of ['character', 'world'] as const) {
    test(`자동 반영 전 ${candidateType} 후보만 잠그고 이전 회차 보류는 직접 확인한다 (${width}px)`, async ({ page }) => {
      await page.setViewportSize({ width, height: 1000 });
      let mutations = 0;
      const chars = [character(1), character(2, { episodeNo: 33, attributeName: 'profile.eye_color', attributeValue: '갈색',
        comparisonStatus: 'FAILED', suggestedOperation: undefined, automaticApplicationPending: false, manualReviewAvailable: true })];
      const worlds = [world(1), world(2, { sourceEpisodeNo: 33, settingName: '소환 지속 시간', extractedValue: '5분',
        comparisonStatus: 'FAILED', suggestedOperation: undefined, automaticApplicationPending: false, manualReviewAvailable: true })];
      await page.route('**/api/v1/**', route => {
        const path = new URL(route.request().url()).pathname;
        if (route.request().method() !== 'GET') mutations += 1;
        if (path.endsWith('/auth/me')) return success(route, member);
        const counts = { ...emptyCounts, episodeStartNo: 33, episodeEndNo: 35, episodeCount: 3, totalCandidateCount: 2, reviewedCandidateCount: 0,
          pendingCandidateCount: 2, directReviewCandidateCount: 1, processingCandidateCount: 1 };
        if (path.endsWith('/setting-candidates')) return success(route, { batchId, ...counts, groups: pageOf([characterGroup(chars)]) });
        if (path.endsWith('/world-setting-candidates')) return success(route, { batchId, ...counts,
          pendingComparisonCount: 0, processingComparisonCount: 0, activeComparisonJobCount: 0,
          failedComparisonCount: 1, groups: pageOf([worldGroup(worlds)]) });
        return success(route, []);
      });
      await open(page, candidateType);
      await expectCounts(page, 2, 2);
      for (const label of ['캐릭터 후보', '세계관 후보']) {
        const tab = page.getByRole('button', { name: new RegExp(`^${label}`) });
        await expect(tab).toContainText('직접 확인 1개');
        await expect(tab).toContainText('분석 중 1개');
      }
      const group = page.locator(candidateType === 'character' ? '.candidate-group-card' : '.world-candidate-group-card');
      await expect(group).toContainText('직접 확인 1개');
      await expect(group).toContainText('분석 중 1개');
      await group.click();
      const rows = page.locator(candidateType === 'character' ? '.setting-candidate-detail' : '.world-setting-diff-row');
      const pendingRow = rows.first();
      const earlierRow = rows.nth(1);
      const notice = pendingRow.locator('.automatic-application-notice');
      await expect(notice).toContainText('이 회차의 설정을 자동으로 반영하고 있습니다.');
      await expect(pendingRow.getByRole('button', { name: '수정', exact: true })).toBeDisabled();
      await expect(pendingRow.getByRole('button', { name: /제외/, exact: false })).toBeDisabled();
      if (candidateType === 'character') {
        await expect(pendingRow.getByRole('button', { name: '기존 캐릭터 변경' })).toBeDisabled();
        await expect(pendingRow.getByRole('button', { name: '새 캐릭터로 등록' })).toBeDisabled();
        await expect(pendingRow.getByRole('button', { name: /^AI 제안대로/ })).toBeDisabled();
        await expect(page.getByRole('button', { name: '캐릭터 일괄 연결' })).toBeDisabled();
        await expect(page.getByRole('button', { name: /설정 모두 확정/ })).toBeDisabled();
      } else {
        await expect(page.getByRole('button', { name: '분류·대상 일괄 수정', exact: true })).toBeDisabled();
        await expect(page.getByRole('button', { name: '모두 확정', exact: true })).toBeDisabled();
      }
      await expect(earlierRow.getByRole('button', { name: '직접 확인해서 반영', exact: true })).toBeEnabled();
      await expect(earlierRow.getByRole('button', { name: /제외/ })).toBeEnabled();
      expect(await computedContrastRatio(notice.locator('p'), notice)).toBeGreaterThanOrEqual(4.5);
      if (width === 320) {
        const back = page.getByRole('button', { name: candidateType === 'character' ? '후보 목록으로' : '대상 목록으로', exact: true });
        expect(await computedContrastRatio(back, back)).toBeGreaterThanOrEqual(4.5);
        const appearance = await back.evaluate(button => ({
          background: getComputedStyle(button).backgroundColor,
          fontSize: getComputedStyle(button).fontSize,
          height: button.getBoundingClientRect().height,
        }));
        expect(appearance.background).toBe('rgb(255, 255, 255)');
        expect(appearance.height).toBeGreaterThanOrEqual(44);
        expect(appearance.fontSize).toBe('13px');
      }
      await expect(page.locator('.app-route-layer')).toHaveCSS('opacity', '1');
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBeTruthy();
      await page.screenshot({ path: `docs/screens/gh180-auto-pending-${candidateType}-${width}.png`, fullPage: true });
      await earlierRow.getByRole('button', { name: '직접 확인해서 반영', exact: true }).click();
      await expect(page.locator('.review-modal').getByRole('button', { name: candidateType === 'character' ? '확인한 값 저장' : '수정안 적용' })).toBeEnabled();
      expect(mutations).toBe(0);
    });
  }
}

for (const candidateType of ['character', 'world'] as const) {
  test(`${candidateType} 필터·다른 페이지에서도 자동 반영 완료까지 갱신하고 이후에는 멈춘다`, async ({ page }) => {
    await page.clock.install();
    let applied = false;
    let reads = 0;
    const olderChar = character(2, { episodeNo: 33, automaticApplicationPending: false, manualReviewAvailable: true, comparisonStatus: 'FAILED' });
    const olderWorld = world(2, { sourceEpisodeNo: 33, automaticApplicationPending: false, manualReviewAvailable: true, comparisonStatus: 'FAILED' });
    await page.route('**/api/v1/**', route => {
      const url = new URL(route.request().url());
      const path = url.pathname;
      if (path.endsWith('/auth/me')) return success(route, member);
      if (path.endsWith('/setting-candidates') || path.endsWith('/world-setting-candidates')) {
        const isCurrent = path.endsWith(candidateType === 'character' ? '/setting-candidates' : '/world-setting-candidates');
        if (isCurrent) reads += 1;
        return success(route, { batchId, ...emptyCounts, totalCandidateCount: isCurrent ? 2 : 0,
          reviewedCandidateCount: isCurrent && applied ? 1 : 0, pendingCandidateCount: isCurrent ? applied ? 1 : 2 : 0,
          confirmedCandidateCount: isCurrent && applied ? 1 : 0,
          directReviewCandidateCount: isCurrent ? 1 : 0, processingCandidateCount: isCurrent && !applied ? 1 : 0,
          pendingComparisonCount: 0, processingComparisonCount: 0, activeComparisonJobCount: 0,
          groups: pageOf(isCurrent ? [candidateType === 'character' ? characterGroup([olderChar]) : worldGroup([olderWorld])] : [],
            Number(url.searchParams.get('page') ?? 0), 2) });
      }
      return success(route, []);
    });
    const filter = candidateType === 'character' ? '&matchStatus=CONNECTED' : '&worldCategory=POWER_SYSTEM';
    await open(page, candidateType, `${filter}&page=2`);
    await expectCounts(page, 1, 1);
    applied = true;
    await page.clock.runFor(2200);
    await expectCounts(page, 1, 0, 1);
    const url = new URL(page.url());
    expect(url.searchParams.get('page')).toBe('2');
    expect(url.searchParams.get(candidateType === 'character' ? 'matchStatus' : 'worldCategory')).toBe(candidateType === 'character' ? 'CONNECTED' : 'POWER_SYSTEM');
    await expect(page.locator(candidateType === 'character' ? '.candidate-group-card.is-selected' : '.world-candidate-group-card.is-selected')).toHaveCount(1);
    const readsAtCompletion = reads;
    await page.clock.runFor(6500);
    expect(reads).toBe(readsAtCompletion);
  });
}

for (const candidateType of ['character', 'world'] as const) {
  test(`${candidateType} 수정 창을 연 뒤 자동 반영 대기가 감지되면 입력은 보존하고 저장을 잠근다`, async ({ page }) => {
    await page.clock.install();
    let automaticPending = false;
    let writes = 0;
    await page.route('**/api/v1/**', route => {
      const path = new URL(route.request().url()).pathname;
      if (route.request().method() !== 'GET') writes += 1;
      if (path.endsWith('/auth/me')) return success(route, member);
      if (path.endsWith('/setting-candidates') || path.endsWith('/world-setting-candidates')) {
        const isCurrent = path.endsWith(candidateType === 'character' ? '/setting-candidates' : '/world-setting-candidates');
        // Another candidate on another page keeps the summary polling even before this candidate changes state.
        const group = candidateType === 'character'
          ? characterGroup([character(1, { automaticApplicationPending: automaticPending })])
          : worldGroup([world(1, { automaticApplicationPending: automaticPending })]);
        return success(route, { batchId, ...emptyCounts, totalCandidateCount: isCurrent ? 2 : 0,
          reviewedCandidateCount: 0, pendingCandidateCount: isCurrent ? 2 : 0,
          directReviewCandidateCount: isCurrent && !automaticPending ? 1 : 0,
          processingCandidateCount: isCurrent ? automaticPending ? 2 : 1 : 0,
          activeComparisonJobCount: 0, groups: pageOf(isCurrent ? [group] : []) });
      }
      return success(route, []);
    });
    await open(page, candidateType);
    const rows = page.locator(candidateType === 'character' ? '.setting-candidate-detail' : '.world-setting-diff-row');
    await rows.getByRole('button', { name: '수정', exact: true }).click();
    const modal = page.locator('.review-modal');
    const input = modal.getByRole('textbox', { name: candidateType === 'character' ? '설정값' : '최종 설정값', exact: true });
    await input.fill('작가가 확인 중인 내용');
    automaticPending = true;
    await page.clock.runFor(2200);
    await expect(modal.locator('.automatic-application-notice')).toBeVisible();
    await expect(input).toHaveValue('작가가 확인 중인 내용');
    await expect(input).toBeFocused();
    await expect(modal.getByRole('button', { name: candidateType === 'character' ? '저장' : '수정안 적용', exact: true })).toBeDisabled();
    // Even a form submission already queued before the repaint must not send a mutation with the stale candidate.
    await modal.evaluate(node => {
      const form = node.tagName === 'FORM' ? node : node.querySelector('form');
      form?.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    });
    expect(writes).toBe(0);
    await modal.getByRole('button', { name: '취소', exact: true }).click();
    await expect(modal).toHaveCount(0);
  });
}

test('자동 반영 대기의 개별 비교 실패·재비교 대기·연결 대기를 직접 검토나 자동 재시도로 처리하지 않는다', async ({ page }) => {
  let writes = 0;
  const candidates = [world(1, { comparisonStatus: 'FAILED', suggestedOperation: undefined }),
    world(2, { comparisonStatus: 'RECOMPARISON_REQUIRED', settingName: '소환 시간' }),
    world(3, { comparisonStatus: 'PENDING', settingName: '소환 횟수' })];
  await page.route('**/api/v1/**', route => {
    const path = new URL(route.request().url()).pathname;
    if (route.request().method() !== 'GET') writes += 1;
    if (path.endsWith('/auth/me')) return success(route, member);
    if (path.endsWith('/world-setting-candidates')) return success(route, { batchId, ...emptyCounts,
      totalCandidateCount: 3, reviewedCandidateCount: 0, pendingCandidateCount: 3, processingCandidateCount: 3,
      activeComparisonJobCount: 0, failedComparisonCount: 1, recomparisonRequiredCount: 1,
      groups: pageOf([{ ...worldGroup(candidates), status: 'FAILED' }]) });
    if (path.endsWith('/setting-candidates')) return success(route, { batchId, ...emptyCounts,
      totalCandidateCount: 1, pendingCandidateCount: 1, processingCandidateCount: 1,
      groups: pageOf([characterGroup([character(1, { comparisonStatus: 'WAITING_FOR_CHARACTER_MATCH', matchStatus: 'AMBIGUOUS' })])]) });
    return success(route, []);
  });
  await open(page, 'world');
  await expectCounts(page, 0, 4);
  await expect(page.locator('.world-candidate-group-card')).toContainText('분석 중 3개');
  await expect(page.getByRole('button', { name: '다시 비교', exact: true })).toHaveCount(0);
  await expect(page.locator('.automatic-application-notice')).toHaveCount(3);
  await expect(page.getByRole('button', { name: '모두 확정', exact: true })).toBeDisabled();
  await page.getByRole('button', { name: /^캐릭터 후보/ }).click();
  await expect(page.locator('.candidate-group-card')).toContainText('분석 중 1개');
  await expect(page.locator('.candidate-group-card')).not.toContainText('직접 확인');
  await expect(page.getByRole('button', { name: '기존 캐릭터에 연결', exact: true })).toBeDisabled();
  expect(writes).toBe(0);
});

test('새 대기 필드가 없는 이전 응답의 수동 후보는 계속 직접 확인할 수 있다', async ({ page }) => {
  await page.route('**/api/v1/**', route => {
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith('/auth/me')) return success(route, member);
    const isCharacter = path.endsWith('/setting-candidates');
    if (isCharacter || path.endsWith('/world-setting-candidates')) return success(route, { batchId, ...emptyCounts,
      totalCandidateCount: 1, reviewedCandidateCount: 0, pendingCandidateCount: 1, directReviewCandidateCount: 1,
      activeComparisonJobCount: 0, groups: pageOf([isCharacter
        ? characterGroup([character(1, { automaticApplicationPending: undefined })])
        : worldGroup([world(1, { automaticApplicationPending: undefined })])]) });
    return success(route, []);
  });
  await open(page, 'character');
  await expectCounts(page, 2, 0);
  await expect(page.getByRole('button', { name: /설정 모두 확정/ })).toBeEnabled();
  await page.getByRole('button', { name: /^세계관 후보/ }).click();
  await expect(page.getByRole('button', { name: '모두 확정', exact: true })).toBeEnabled();
  await expect(page.locator('.automatic-application-notice')).toHaveCount(0);
});

for (const candidateType of ['character', 'world'] as const) {
  test(`${candidateType} 저장 직전 자동 반영이 시작되어 거절되면 최신 상태를 조회하고 재전송을 막는다`, async ({ page }) => {
    let rejected = false;
    let writes = 0;
    await page.route('**/api/v1/**', route => {
      const path = new URL(route.request().url()).pathname;
      if (path.endsWith('/auth/me')) return success(route, member);
      if (route.request().method() !== 'GET') {
        rejected = true;
        writes += 1;
        return route.fulfill({ status: 409, contentType: 'application/json', body: JSON.stringify({
          success: false, data: null, message: '이 회차의 설정을 자동으로 반영하고 있습니다. 완료된 뒤 다시 시도해 주세요.',
          error: { code: 'ANALYSIS_AUTOMATIC_APPLICATION_PENDING', status: 409 },
        }) });
      }
      if (path.endsWith('/setting-candidates') || path.endsWith('/world-setting-candidates')) {
        const isCurrent = path.endsWith(candidateType === 'character' ? '/setting-candidates' : '/world-setting-candidates');
        const group = candidateType === 'character'
          ? characterGroup([character(1, { automaticApplicationPending: rejected })])
          : worldGroup([world(1, { automaticApplicationPending: rejected })]);
        return success(route, { batchId, ...emptyCounts, totalCandidateCount: isCurrent ? 1 : 0,
          reviewedCandidateCount: 0, pendingCandidateCount: isCurrent ? 1 : 0,
          directReviewCandidateCount: isCurrent && !rejected ? 1 : 0,
          processingCandidateCount: isCurrent && rejected ? 1 : 0,
          activeComparisonJobCount: 0, groups: pageOf(isCurrent ? [group] : []) });
      }
      return success(route, []);
    });
    await open(page, candidateType);
    const rows = page.locator(candidateType === 'character' ? '.setting-candidate-detail' : '.world-setting-diff-row');
    await rows.getByRole('button', { name: '수정', exact: true }).click();
    const modal = page.locator('.review-modal');
    const input = modal.getByRole('textbox', { name: candidateType === 'character' ? '설정값' : '최종 설정값', exact: true });
    await input.fill('계속 검토할 입력');
    const save = modal.getByRole('button', { name: candidateType === 'character' ? '저장' : '수정안 적용', exact: true });
    await save.click();
    await expect(modal.locator('.automatic-application-notice')).toBeVisible();
    await expect(input).toHaveValue('계속 검토할 입력');
    await expect(save).toBeDisabled();
    await expectCounts(page, 0, 1);
    expect(writes).toBe(1);
  });
}
