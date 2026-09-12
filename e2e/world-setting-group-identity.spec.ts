import { expect, test, type Route } from '@playwright/test';

const workId = '11111111-1111-4111-8111-111111111111';
const batchId = '22222222-2222-4222-8222-222222222222';
const groupKey = 'POWER_SYSTEM|캐릭터';

function success(route: Route, data: unknown) {
  return route.fulfill({ status: 200, contentType: 'application/json',
    body: JSON.stringify({ success: true, data, error: null }) });
}

for (const width of [1280, 320]) {
  for (const knownDistinctTargets of [false, true]) {
    test(`세계관 묶음은 분류·이름 기준이며 ${knownDistinctTargets ? '서로 다른 기존 연결만 명시한다' : '빈 연결이나 비교 기록으로 동일성을 추정하지 않는다'} (${width}px)`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      let mutationCount = 0;
      const candidates = [0, 1].map(index => ({
        id: `${index + 3}3333333-3333-4333-8333-333333333333`, workId, sourceEpisodeNo: 18,
        category: 'POWER_SYSTEM', subjectName: '캐릭터', canonicalSubjectName: '캐릭터',
        scopeName: null, settingName: index === 0 ? '아이템 레벨 변동' : '전투 지수 상승 수단',
        extractedValue: index === 0 ? '장비를 판매하면 아이템 레벨이 하락한다.' : '스톤으로 전투 지수를 높일 수 있다.',
        targetWorldSettingId: knownDistinctTargets ? `${index + 5}5555555-5555-4555-8555-555555555555` : null,
        comparisonBatchId: `${index + 7}7777777-7777-4777-8777-777777777777`,
        targetSubjectName: null, comparisonReviewReason: null, suggestedOperation: 'ADD',
        comparisonStatus: 'COMPLETED', reviewStatus: 'PENDING_REVIEW', userModified: false,
        manualReviewAvailable: true, consolidationStatus: 'SINGLE', analysisMode: 'ORDERED_PROVISIONAL',
        comparisonReason: '원문에 명시된 새 사실을 추가합니다.',
        // 과거 비교의 선택 기록은 현재의 대상 연결을 증명하지 않는다.
        comparisonDiagnostics: [{ attempt: 1, rule: 'COMPARISON_VALIDATION_FAILED', candidateRefs: [],
          selectedProperties: [{ targetWorldSettingId: `diagnostic-only-${index}`, propertyName: '이전 선택 기록' }] }],
      }));
      await page.route('**/api/v1/**', route => {
        const path = new URL(route.request().url()).pathname;
        if (route.request().method() !== 'GET') mutationCount += 1;
        if (path.endsWith('/auth/me')) return success(route, {
          id: 1, email: 'group-identity@example.com', displayName: '묶음 테스트', role: 'AUTHOR', status: 'ACTIVE',
        });
        if (path.endsWith('/world-setting-candidates')) return success(route, {
          batchId, episodeStartNo: 18, episodeEndNo: 18, episodeCount: 1,
          totalCandidateCount: 2, pendingCandidateCount: 2, reviewedCandidateCount: 0,
          pendingComparisonCount: 0, processingComparisonCount: 0, failedComparisonCount: 0,
          recomparisonRequiredCount: 0, activeComparisonJobCount: 0,
          groups: { page: 0, size: 20, totalElements: 1, totalPages: 1, hasNext: false,
            content: [{ groupKey, category: 'POWER_SYSTEM', subjectName: '캐릭터', changeCount: 2,
              status: 'READY', addCount: 2, candidates, evidenceEpisodeNos: [18] }] },
        });
        if (path.endsWith('/setting-candidates')) return success(route, {
          batchId, totalCandidateCount: 0, pendingCandidateCount: 0, reviewedCandidateCount: 0,
          matchRequiredCandidateCount: 0, groups: { content: [], page: 0, size: 20,
            totalElements: 0, totalPages: 0, hasNext: false },
        });
        return success(route, []);
      });
      await page.addInitScript(() => localStorage.setItem('accessToken', 'isolated-group-identity-test'));
      await page.goto(`/setting-review?workId=${workId}&batchId=${batchId}&candidateType=world&group=${encodeURIComponent(groupKey)}`);
      const description = page.locator('.world-setting-group-description');
      await expect(description).toContainText('같은 분류·이름으로 묶');
      if (knownDistinctTargets) {
        await expect(description).toContainText('서로 다른 기존 대상에 연결된 후보가 있습니다.');
      } else {
        await expect(description).toHaveText('같은 분류·이름으로 묶인 후보를 항목별로 검토합니다.');
        await expect(description).not.toContainText('서로 다른');
      }
      await expect(page.getByText('같은 대상에서 추출된 설정을 항목별로 검토합니다.', { exact: true })).toHaveCount(0);
      await expect(page.getByText('비교 실패', { exact: true })).toHaveCount(0);
      await expect(page.getByRole('button', { name: '모두 확정', exact: true })).toBeEnabled();
      await expect(page.getByRole('button', { name: '분류·대상 일괄 수정', exact: true })).toBeEnabled();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBeTruthy();
      expect(mutationCount).toBe(0);
    });
  }
}
