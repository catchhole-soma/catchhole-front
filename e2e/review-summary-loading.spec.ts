import { expect, test, type Page } from '@playwright/test';

const workId = '11111111-1111-4111-8111-111111111111';
const batchId = '22222222-2222-4222-8222-222222222222';
type Kind = 'character' | 'world';
const deferred = () => {
  let release!: () => void;
  const promise = new Promise<void>(resolve => { release = resolve; });
  return { promise, release };
};
async function fixture(page: Page, kind: Kind, empty = false) {
  const gates = { character: deferred(), world: deferred() };
  const failures = { character: false, world: false };
  const reads = { character: 0, world: 0 };
  await page.route('**/api/v1/**', async route => {
    const path = new URL(route.request().url()).pathname;
    let data: unknown = {};
    if (path.endsWith('/auth/me')) data = { id: 1, email: 'summary-test@example.com', displayName: '검증', role: 'AUTHOR', status: 'ACTIVE' };
    else if (path.endsWith('/setting-candidates') || path.endsWith('/world-setting-candidates')) {
      const target: Kind = path.endsWith('/world-setting-candidates') ? 'world' : 'character';
      reads[target]++;
      await gates[target].promise;
      if (failures[target]) return route.fulfill({ status: 404, contentType: 'application/json', body: JSON.stringify({ success: false, message: '후보 집계를 불러오지 못했습니다.', error: { code: 'CANDIDATE_NOT_FOUND', status: 404 } }) });
      const count = empty ? 0 : target === 'character' ? 3 : 2;
      data = { batchId, episodeStartNo: empty ? undefined : 5, episodeEndNo: empty ? undefined : 5, episodeCount: empty ? 0 : 1,
        totalCandidateCount: count, pendingCandidateCount: count, directReviewCandidateCount: count,
        confirmedCandidateCount: 0, dismissedCandidateCount: 0, processingCandidateCount: 0,
        groups: { content: [], page: 0, size: 20, totalElements: 0, totalPages: 0 } };
    }
    return route.fulfill({ contentType: 'application/json', body: JSON.stringify({ success: true, data }) });
  });
  await page.goto('/demo');
  await page.evaluate(() => localStorage.setItem('accessToken', 'isolated-summary-fixture'));
  await page.goto(`/setting-review?workId=${workId}&batchId=${batchId}${kind === 'world' ? '&candidateType=world' : ''}`);
  return { gates, failures, reads };
}
const summary = (page: Page) => page.getByRole('region', { name: '설정 후보 검토 요약' });
const tabs = (page: Page) => page.getByRole('navigation', { name: '설정 후보 종류' });

for (const kind of ['character', 'world'] as const) {
  test(`${kind}: 초기 조회와 한쪽 집계만 도착한 동안 0건으로 단정하지 않는다`, async ({ page }) => {
    const { gates } = await fixture(page, kind);
    await expect(summary(page)).toContainText('회차 정보 확인 중');
    await expect(summary(page)).toContainText('설정 개수 확인 중');
    await expect(summary(page)).not.toContainText('0개');
    await expect(summary(page)).not.toContainText('대상 회차 없음');
    await expect(tabs(page).getByText('불러오는 중', { exact: true })).toHaveCount(2);
    gates[kind].release();
    await expect(summary(page)).toContainText('5화');
    await expect(summary(page)).toContainText('설정 개수 확인 중');
    await expect(tabs(page).getByText('불러오는 중', { exact: true })).toHaveCount(1);
    gates[kind === 'character' ? 'world' : 'character'].release();
    await expect(summary(page)).toContainText('전체 5개 설정');
    await expect(summary(page)).toHaveAttribute('aria-busy', 'false');
  });

  test(`${kind}: 최초 조회 실패는 0건이 아니라 확인 불가로 표시한다`, async ({ page }) => {
    const first = await fixture(page, kind);
    first.failures.character = true; first.failures.world = true;
    first.gates.character.release(); first.gates.world.release();
    await expect(summary(page)).toContainText('설정 개수 확인 불가');
    await expect(summary(page)).toContainText('회차 정보 확인 불가');
    await expect(summary(page)).not.toContainText('0개');
    await expect(tabs(page).getByText('확인 불가', { exact: true })).toHaveCount(2);
    await expect(summary(page)).toHaveAttribute('aria-busy', 'false');
  });

  test(`${kind}: 정상 조회된 빈 결과는 0건으로 표시한다`, async ({ page }) => {
    const { gates } = await fixture(page, kind, true);
    gates.character.release(); gates.world.release();
    await expect(summary(page)).toContainText('전체 0개 설정');
    await expect(summary(page)).toContainText('대상 회차 없음');
    await expect(tabs(page).getByText('직접 확인 0개', { exact: true })).toHaveCount(2);
  });

  test(`${kind}: 배경 재조회와 실패 중에도 받은 집계는 유지한다`, async ({ page }) => {
    const state = await fixture(page, kind);
    state.gates.character.release(); state.gates.world.release();
    await expect(summary(page)).toContainText('전체 5개 설정');
    state.gates.character = deferred(); state.gates.world = deferred();
    await page.evaluate(async () => {
      const { queryClient } = await import('/src/app/lib/query-client.ts');
      void queryClient.invalidateQueries({ predicate: query => ['getSettingCandidates', 'getWorldSettingCandidates'].includes((query.queryKey[0] as { _id?: string })._id ?? '') });
    });
    await expect.poll(() => state.reads.character).toBeGreaterThan(1);
    await expect.poll(() => state.reads.world).toBeGreaterThan(1);
    await expect(summary(page)).toContainText('전체 5개 설정');
    await expect(tabs(page)).not.toContainText('불러오는 중');
    state.failures.character = true; state.failures.world = true;
    state.gates.character.release(); state.gates.world.release();
    await expect(page.getByRole('alert').first()).toBeVisible();
    await expect(summary(page)).toContainText('전체 5개 설정');
    await expect(tabs(page)).not.toContainText('확인 불가');
  });
}
