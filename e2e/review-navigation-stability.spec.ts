import { expect, test } from '@playwright/test';

const workId = '11111111-1111-4111-8111-111111111111';
const batchId = '22222222-2222-4222-8222-222222222222';
const pageOf = (content: unknown[]) => ({ content, page: 0, size: 20, totalElements: content.length, totalPages: 1 });

for (const kind of ['character', 'world'] as const) {
  test(`${kind}: 같은 페이지의 다른 대상을 선택해도 목록과 스크롤 위치를 유지한다`, async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    let listReads = 0;
    const groups = Array.from({ length: 8 }, (_, i) => {
      const name = `검토 대상 ${i + 1}`;
      const candidates = Array.from({ length: i === 0 ? 4 : 1 }, (_, j) => ({
        id: `candidate-${i}-${j}`, workId, entityName: name, rawEntityMention: name,
        entityType: 'CHARACTER', candidateKind: 'SETTING', matchStatus: 'MATCHED', matchedCharacterId: `character-${i}`,
        attributeName: `status.injury${j}`, attributeValue: '부상을 입고 쓰러졌다.', valueType: 'STRING',
        episodeNo: 38, sourceEpisodeNo: 38, category: 'LOCATION', subjectName: name,
        settingName: `위험 기준 ${j}`, extractedValue: '몬스터를 만나면 돌아간다.',
        proposedValue: '몬스터를 만나면 돌아간다.', consolidationStatus: 'SINGLE',
        comparisonStatus: 'COMPLETED', suggestedOperation: 'REVIEW_REQUIRED',
        comparisonReviewReason: 'CONTENT_REVIEW_REQUIRED', reviewStatus: 'PENDING_REVIEW',
        manualReviewAvailable: true, analysisMode: 'ORDERED_PROVISIONAL', evidenceSpans: [],
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
          totalCandidateCount: ownList ? 11 : 0, pendingCandidateCount: ownList ? 11 : 0,
          directReviewCandidateCount: ownList ? 11 : 0, confirmedCandidateCount: 0, dismissedCandidateCount: 0,
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
    await expect(cards).toHaveCount(8);
    await expect(cards.first()).toHaveClass(/is-selected/);
    await page.evaluate(() => document.fonts.ready);
    const node = await main.elementHandle();
    await main.evaluate(el => { el.scrollTop = 480; });
    const before = await main.evaluate(el => el.scrollTop);
    const readsBefore = listReads;
    // Both target buttons are already on screen, so clicking does not scroll them into view.
    await expect(cards.first()).toBeInViewport({ ratio: 1 });
    await expect(cards.nth(1)).toBeInViewport({ ratio: 1 });
    await cards.nth(1).click();
    await expect(cards.nth(1)).toHaveClass(/is-selected/);
    expect(await main.evaluate((el, old) => el === old, node)).toBe(true);
    expect(listReads).toBe(readsBefore);
    expect(await main.evaluate(el => el.scrollTop)).toBe(before);
    await cards.first().click();
    await expect(cards.first()).toHaveClass(/is-selected/);
    expect(await main.evaluate(el => el.scrollTop)).toBe(before);
  });
}

for (const mode of ['APPLY_PROPOSAL', 'HISTORY_ONLY']) {
  test(`기존 캐릭터의 ${mode} 선택 저장 후 같은 그룹과 읽던 위치를 유지한다`, async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    const selectedKey = 'existing:character-1';
    const groups = Array.from({ length: 2 }, (_, index) => ({
      groupKey: `existing:character-${index}`, entityName: `인물 ${index}`, candidateCount: 5, pendingCandidateCount: 5,
      candidates: Array.from({ length: 5 }, (_, n) => ({
        id: `candidate-${index}-${n}`, workId, entityName: `인물 ${index}`, candidateKind: 'SETTING', entityType: 'CHARACTER',
        matchedCharacterId: `character-${index}`, matchStatus: 'MATCHED', attributeName: `status.wound${n}`, attributeDisplayName: `부상 ${n}`,
        attributeValue: '부상을 입었다.', valueType: 'STRING', episodeNo: 3, reviewStatus: 'PENDING_REVIEW',
        comparisonStatus: 'COMPLETED', suggestedOperation: 'REVIEW_REQUIRED', manualReviewAvailable: true,
        analysisMode: 'ORDERED_PROVISIONAL', reviewedApplicationMode: null as string | null,
        updatedAt: '2026-10-06T00:00:00', evidenceSpans: [],
      })),
    }));
    await page.route('**/api/v1/**', async route => {
      const request = route.request();
      const path = new URL(request.url()).pathname;
      let data: unknown = [];
      if (request.method() === 'PATCH') {
        const candidate = groups.flatMap(group => group.candidates).find(item => path.endsWith(item.id))!;
        Object.assign(candidate, request.postDataJSON(), { updatedAt: '2026-10-06T00:01:00' });
        return route.fulfill({ contentType: 'application/json', body: JSON.stringify({ success: true, data: candidate }) });
      }
      if (path.endsWith('/auth/me')) data = { id: 1, email: 'scroll@example.invalid', displayName: '검증', role: 'AUTHOR', status: 'ACTIVE' };
      else if (path.endsWith('/setting-candidates')) data = { batchId, totalCandidateCount: 10, pendingCandidateCount: 10, directReviewCandidateCount: 10, processingCandidateCount: 0, groups: pageOf(groups) };
      else if (path.endsWith('/world-setting-candidates')) data = { batchId, totalCandidateCount: 0, pendingCandidateCount: 0, processingCandidateCount: 0, groups: pageOf([]) };
      return route.fulfill({ contentType: 'application/json', body: JSON.stringify({ success: true, data }) });
    });
    await page.addInitScript(() => localStorage.setItem('accessToken', 'scroll-save-fixture'));
    await page.goto(`/setting-review?workId=${workId}&batchId=${batchId}&group=${encodeURIComponent(selectedKey)}`);
    const detail = page.locator('.setting-candidate-detail').nth(3);
    const choice = detail.getByRole('button', { name: mode === 'APPLY_PROPOSAL' ? /현재 설정에 반영/ : /이력에만 저장/ });
    await choice.scrollIntoViewIfNeeded();
    const main = page.locator('.setting-review-main');
    const before = await main.evaluate(el => el.scrollTop);
    expect(before).toBeGreaterThan(300);
    await choice.click();
    await expect(choice).toHaveAttribute('aria-pressed', 'true');
    await expect.poll(() => new URL(page.url()).searchParams.get('group')).toBe(selectedKey);
    await expect.poll(() => main.evaluate(el => el.scrollTop)).toBe(before);
    await expect(page.locator('.candidate-group-card.is-selected')).toContainText('인물 1');
  });
}
