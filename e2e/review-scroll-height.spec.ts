import { expect, test } from '@playwright/test';

const workId = '11111111-1111-4111-8111-111111111111';
const batchId = '22222222-2222-4222-8222-222222222222';
const pageOf = (content: unknown[]) => ({ content, page: 0, size: 20, totalElements: content.length, totalPages: 1 });

for (const kind of ['character', 'world'] as const) {
 for (const viewportHeight of [1100, 1440]) {
  test(`${kind}: 긴 상세에서 짧은 상세로 바꿔도 브라우저가 맨 위로 끌어올리지 않는다 (${viewportHeight}px)`, async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: viewportHeight });
    let listReads = 0;
    const groups = Array.from({ length: 3 }, (_, i) => {
      const name = `검토 대상 ${i + 1}`;
      const candidates = Array.from({ length: i === 2 ? 2 : 1 }, (_, j) => ({
        id: `candidate-${i}-${j}`, workId, entityName: name, rawEntityMention: name,
        entityType: 'CHARACTER', candidateKind: 'SETTING', matchStatus: 'MATCHED', matchedCharacterId: `character-${i}`,
        attributeName: `status.injury${j}`, attributeValue: i === 0 ? '부상을 입고 쓰러졌다. '.repeat(180) : '부상을 입고 쓰러졌다.', valueType: 'STRING',
        episodeNo: 38, sourceEpisodeNo: 38, category: 'LOCATION', subjectName: name,
        settingName: `위험 기준 ${j}`, extractedValue: i === 0 ? '몬스터를 만나면 돌아간다. '.repeat(180) : '몬스터를 만나면 돌아간다.',
        proposedValue: i === 0 ? '몬스터를 만나면 돌아간다. '.repeat(180) : '몬스터를 만나면 돌아간다.', consolidationStatus: 'SINGLE',
        comparisonStatus: 'COMPLETED', suggestedOperation: i === 0 ? 'REVIEW_REQUIRED' : 'ADD',
        comparisonReviewReason: 'CONTENT_REVIEW_REQUIRED', reviewStatus: 'PENDING_REVIEW',
        manualReviewAvailable: i === 0, analysisMode: 'ORDERED_PROVISIONAL', evidenceSpans: [],
      }));
      return { groupKey: kind === 'world' ? `LOCATION|${name}` : name, entityName: name, subjectName: name,
        category: 'LOCATION', candidateCount: candidates.length, changeCount: candidates.length,
        pendingCandidateCount: candidates.length, evidenceEpisodeNos: [38], status: 'REVIEW_REQUIRED', candidates };
    });
    await page.route('**/api/v1/**', route => {
      const path = new URL(route.request().url()).pathname;
      const ownList = path.endsWith(kind === 'world' ? '/world-setting-candidates' : '/setting-candidates');
      let data: unknown = {};
      if (path.endsWith('/auth/me')) data = { id: 1, email: 'scroll@example.com', displayName: '검증', role: 'AUTHOR', status: 'ACTIVE' };
      else if (path.endsWith('/setting-candidates') || path.endsWith('/world-setting-candidates')) {
        if (ownList) listReads++;
        data = { batchId, episodeStartNo: 38, episodeEndNo: 38, episodeCount: 1,
          totalCandidateCount: ownList ? 4 : 0, pendingCandidateCount: ownList ? 4 : 0,
          directReviewCandidateCount: ownList ? 4 : 0, confirmedCandidateCount: 0, dismissedCandidateCount: 0,
          processingCandidateCount: 0, groups: pageOf(ownList ? groups : []) };
      } else if (path.endsWith('/characters')) data = pageOf([]);
      else if (path.endsWith('/world-settings')) data = { worldSettings: pageOf([]) };
      return route.fulfill({ contentType: 'application/json', body: JSON.stringify({ success: true, data }) });
    });
    await page.goto('/login');
    await page.evaluate(() => localStorage.setItem('accessToken', 'scroll-test'));
    await page.goto(`/setting-review?workId=${workId}&batchId=${batchId}${kind === 'world' ? '&candidateType=world' : ''}`);
    const cards = page.locator(kind === 'world' ? '.world-candidate-group-card' : '.candidate-group-card');
    const main = page.locator('.setting-review-main');
    await expect(cards).toHaveCount(3);
    await expect(cards.first()).toHaveClass(/is-selected/);
    await page.evaluate(() => document.fonts.ready);
    const node = await main.elementHandle();
    await main.evaluate(el => { el.scrollTop = 550; });
    const before = await main.evaluate(el => el.scrollTop);
    const readsBefore = listReads;
    const second = await cards.nth(1).boundingBox();
    expect(second).not.toBeNull();
    const x = second!.x + second!.width / 2;
    const y = second!.y + second!.height / 2;
    expect(y).toBeGreaterThan(0);
    expect(y).toBeLessThan(viewportHeight);
    await page.mouse.click(x, y);
    await expect(cards.nth(1)).toHaveClass(/is-selected/);
    const sameNode = await main.evaluate((el, old) => el === old, node);
    expect(sameNode).toBe(true);
    expect(listReads).toBe(readsBefore);
    expect(before).toBe(550);
    expect(await main.evaluate(el => el.scrollTop)).toBe(before);
    expect((await cards.nth(1).boundingBox())?.y).toBe(second!.y);

    const content = page.locator(kind === 'world' ? '.world-setting-review-content' : '.setting-review-content');
    const reservedHeight = await content.evaluate(el => Number.parseFloat(el.style.minHeight));
    await main.evaluate(el => { el.scrollTop = 200; });
    await expect.poll(() => content.evaluate(el => Number.parseFloat(el.style.minHeight))).toBe(reservedHeight - 350);
    await main.evaluate(el => { el.scrollTop = 0; });
    await expect.poll(() => content.evaluate(el => el.style.minHeight)).toBe('');

    // A new viewport must be free to reflow; no stale desktop-sized spacer on mobile.
    await cards.first().click();
    await main.evaluate(el => { el.scrollTop = 550; });
    await cards.nth(1).click();
    await page.setViewportSize({ width: 390, height: 844 });
    await expect.poll(() => content.evaluate(el => el.style.minHeight)).toBe('');
  });
}
}
