import { expect, test, type Page } from '@playwright/test';

const workId = '11111111-1111-4111-8111-111111111111';
const batchId = '22222222-2222-4222-8222-222222222222';
type Kind = 'character' | 'world';
const label = (kind: Kind) => kind === 'character' ? '캐릭터' : '세계관';
async function fixture(page: Page, kind: Kind, options: { filtered?: boolean; bothDone?: boolean } = {}) {
  const writes: string[] = [];
  await page.route('**/api/v1/**', route => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    if (request.method() !== 'GET') writes.push(path);
    let data: unknown = {};
    if (path.endsWith('/auth/me')) data = { id: 1, email: 'type-complete@example.com', displayName: '검증', role: 'AUTHOR', status: 'ACTIVE' };
    else if (path.endsWith('/setting-candidates') || path.endsWith('/world-setting-candidates')) {
      const target: Kind = path.endsWith('/world-setting-candidates') ? 'world' : 'character';
      const current = target === kind;
      const pending = options.bothDone ? 0 : current ? options.filtered ? 1 : 0 : 1;
      data = { batchId, episodeStartNo: 1, episodeEndNo: 1, episodeCount: 1,
        totalCandidateCount: current ? 6 : 1, pendingCandidateCount: pending,
        confirmedCandidateCount: (current ? 6 : 1) - pending, dismissedCandidateCount: 0,
        directReviewCandidateCount: pending, processingCandidateCount: 0,
        groups: { content: [], page: 0, size: 20, totalElements: 0, totalPages: 0 } };
    }
    return route.fulfill({ contentType: 'application/json', body: JSON.stringify({ success: true, data }) });
  });
  await page.goto('/demo');
  await page.evaluate(() => localStorage.setItem('accessToken', 'type-complete-fixture'));
  const savedOtherFilter = kind === 'world' ? '&characterReviewStatus=CONFIRMED&characterMatchStatus=MATCHED&characterPage=4'
    : '&worldReviewStatus=CONFIRMED&worldCategoryFilter=FACTION&worldOperation=EXCLUDE&worldPage=4';
  const activeFilter = options.filtered ? kind === 'world' ? '&worldCategory=MONSTER' : '&matchStatus=AMBIGUOUS' : '';
  await page.goto(`/setting-review?workId=${workId}&batchId=${batchId}${kind === 'world' ? '&candidateType=world' : ''}${savedOtherFilter}${activeFilter}`);
  await expect(page.locator('.setting-review-summary')).toContainText('전체 7개 설정');
  return writes;
}

for (const kind of ['character', 'world'] as const) {
  for (const width of [1280, 320]) {
    test(`${kind}: 이 종류 검토 완료 뒤 남은 다른 종류로 바로 이동한다 (${width}px)`, async ({ page }) => {
      await page.setViewportSize({ width, height: 1000 });
      const writes = await fixture(page, kind);
      const other = kind === 'world' ? 'character' : 'world';
      await expect(page.getByText(`${label(kind)} 검토를 마쳤어요`, { exact: true }).first()).toBeVisible();
      await expect(page.getByText(kind === 'world' ? '세계관 대상을 선택해 주세요.' : '캐릭터 후보 묶음을 선택해 주세요.', { exact: true })).toHaveCount(0);
      await expect(page.getByText('필터 초기화', { exact: true })).toHaveCount(0);
      const next = page.getByRole('button', { name: `${label(other)} 후보 검토로`, exact: true });
      await expect(next).toHaveCount(1);
      await expect(next).toBeEnabled();
      await next.click();
      await expect.poll(() => new URL(page.url()).searchParams.get('candidateType')).toBe(other === 'world' ? 'world' : null);
      const params = new URL(page.url()).searchParams;
      expect(params.get('reviewStatus')).toBeNull();
      expect(params.get('matchStatus')).toBeNull();
      expect(params.get('worldCategory')).toBeNull();
      expect(params.get('operation')).toBeNull();
      expect(params.get('page')).not.toBe('4');
      expect(writes).toEqual([]);
    });
  }

  test(`${kind}: 필터 때문에 비어 있어도 실제 미처리가 남으면 완료라고 하지 않는다`, async ({ page }) => {
    await fixture(page, kind, { filtered: true });
    await expect(page.getByText(`${label(kind)} 검토를 마쳤어요`, { exact: true })).toHaveCount(0);
    await expect(page.getByRole('button', { name: /후보 검토로$/ })).toHaveCount(0);
    await expect(page.getByText(kind === 'world' ? '조건에 맞는 세계관 대상이 없습니다.' : '조건에 맞는 캐릭터 후보가 없습니다.', { exact: true }).last()).toBeVisible();
    await expect(page.getByText(kind === 'world' ? '세계관 대상을 선택해 주세요.' : '캐릭터 후보 묶음을 선택해 주세요.', { exact: true })).toHaveCount(0);
  });

  test(`${kind}: 두 종류가 모두 끝나면 남은 후보 이동 대신 원고 목록으로 마친다`, async ({ page }) => {
    await fixture(page, kind, { bothDone: true });
    await expect(page.getByText(`${label(kind)} 검토를 마쳤어요`, { exact: true }).first()).toBeVisible();
    await expect(page.getByRole('button', { name: /후보 검토로$/ })).toHaveCount(0);
    await expect(page.getByRole('button', { name: '원고 목록으로', exact: true })).toBeEnabled();
  });
}
