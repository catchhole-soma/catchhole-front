import { expect, test, type Route } from '@playwright/test';

const work = '11111111-1111-4111-8111-111111111111';
const batch = '22222222-2222-4222-8222-222222222222';
const job = '33333333-3333-4333-8333-333333333333';
const character = '44444444-4444-4444-8444-444444444444';
const first = '55555555-5555-4555-8555-555555555555';
const second = '66666666-6666-4666-8666-666666666666';
const third = '77777777-7777-4777-8777-777777777777';
const path = `/api/v1/works/${work}/setting-candidates`;
const ok = (route: Route, data: unknown) => route.fulfill({ contentType: 'application/json', body: JSON.stringify({ success: true, data }) });
const pageOf = (content: unknown[]) => ({ content, page: 0, size: 20, totalElements: content.length, totalPages: content.length ? 1 : 0, hasNext: false });

test('같은 회차에서 수정·제외 후 다른 선택을 유지하고 최종 결과를 타임스탬프와 함께 확정한다', async ({ page }) => {
  let candidates = [first, second, third].map((id, i) => ({
    id, workId: work, episodeNo: 6, analysisJobId: job, entityName: '루안', rawEntityMention: '루안',
    candidateKind: 'SETTING', entityType: 'CHARACTER', matchedCharacterId: character, matchStatus: 'MATCHED',
    attributeName: ['profile.affiliation', 'profile.duty', 'profile.title'][i], attributeNameEditable: false,
    attributeValue: ['기사단', '정찰 임무', '신참'][i], valueType: 'STRING', valueValidation: { status: 'VALID', repairable: false },
    reviewStatus: 'PENDING_REVIEW', comparisonStatus: 'COMPLETED', suggestedOperation: 'ADD',
    comparisonRevision: 'revision-1' as string | null, proposedFactValue: ['기사단', '기사단 소속이며 정찰 임무를 맡는다.', '신참'][i],
    comparisonBaseSnapshotVersion: 0, analysisMode: 'CONFIRMED_ONLY', automaticApplicationPending: false,
    manualReviewAvailable: false, reviewedApplicationMode: null as string | null, userModified: false,
    updatedAt: '2026-10-03T01:00:00', snapshotChanges: [],
  }));
  const requests: { method: string; path: string; body: Record<string, unknown> }[] = [];
  await page.route('**/api/v1/**', async route => {
    const req = route.request();
    const currentPath = new URL(req.url()).pathname;
    if (req.method() !== 'GET') requests.push({ method: req.method(), path: currentPath, body: req.postData() ? req.postDataJSON() : {} });
    if (currentPath.endsWith('/auth/me')) return ok(route, { id: 1, email: 'manual@example.test', displayName: '검토 테스트', role: 'AUTHOR', status: 'ACTIVE' });
    if (currentPath.endsWith('/characters')) return ok(route, pageOf([{ id: character, name: '루안' }]));
    if (currentPath.includes('/characters/')) return ok(route, { id: character, name: '루안', profile: [], stats: [], skills: [], items: [], statuses: [] });
    if (currentPath === `${path}/${first}` && req.method() === 'PATCH') {
      candidates = candidates.map(c => c.id !== first ? c : { ...c, ...req.postDataJSON(), userModified: true,
        manualReviewAvailable: true, reviewedApplicationMode: req.postDataJSON().reviewedApplicationMode ?? 'APPLY_PROPOSAL',
        comparisonStatus: 'NOT_REQUIRED', comparisonRevision: null, updatedAt: '2026-10-03T01:01:00' });
      return ok(route, candidates[0]);
    }
    if (currentPath === `${path}/${third}/dismiss`) {
      candidates = candidates.filter(c => c.id !== third);
      return ok(route, { candidateId: third, reviewStatus: 'DISMISSED' });
    }
    if (currentPath.endsWith('/group-confirm')) { candidates = []; return ok(route, { candidates: [] }); }
    if (currentPath === path) return ok(route, { batchId: batch, totalCandidateCount: 3, pendingCandidateCount: candidates.length,
      confirmedCandidateCount: candidates.length ? 0 : 2, dismissedCandidateCount: candidates.length === 3 ? 0 : 1,
      directReviewCandidateCount: candidates.length, processingCandidateCount: 0,
      groups: pageOf(candidates.length ? [{ groupKey: '루안', entityName: '루안', candidateCount: candidates.length,
        pendingCandidateCount: candidates.length, evidenceEpisodeNos: [6], candidates }] : []) });
    if (currentPath.endsWith('/world-setting-candidates')) return ok(route, { totalCandidateCount: 0, pendingCandidateCount: 0,
      confirmedCandidateCount: 0, dismissedCandidateCount: 0, directReviewCandidateCount: 0, processingCandidateCount: 0, groups: pageOf([]) });
    return ok(route, []);
  });
  await page.goto('/login');
  await page.evaluate(() => localStorage.setItem('accessToken', 'manual-final-review-test'));
  await page.goto(`/setting-review?workId=${work}&batchId=${batch}&group=루안`);
  const regions = page.getByRole('region').filter({ has: page.locator('.review-cb-heading') });
  const firstCard = regions.filter({ hasText: '소속' }).first();
  const secondCard = regions.filter({ hasText: '정찰 임무' }).last();
  await secondCard.getByRole('button', { name: /이력에만 저장/ }).click();
  await firstCard.getByRole('button', { name: '수정', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('설정값', { exact: true }).fill('작가가 정한 소속');
  await dialog.getByRole('button', { name: /수정 저장|저장/ }).click();
  await expect(dialog).toHaveCount(0);
  await expect(secondCard.getByRole('button', { name: /이력에만 저장/ })).toHaveAttribute('aria-pressed', 'true');
  await regions.filter({ hasText: '신참' }).last().getByRole('button', { name: '제외', exact: true }).click();
  await expect(page.getByText('설정을 비교하고 있어요', { exact: true })).toHaveCount(0);
  await expect(firstCard.getByRole('button', { name: /현재 설정에 반영/ })).toHaveAttribute('aria-pressed', 'true');
  await expect(secondCard.getByRole('button', { name: /이력에만 저장/ })).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: '2개 설정 모두 확정', exact: true }).click();
  await expect.poll(() => requests.some(r => r.path.endsWith('/group-confirm'))).toBe(true);
  const submitted = requests.find(r => r.path.endsWith('/group-confirm'))!.body;
  expect(submitted).toMatchObject({ acceptDisplayedResults: true, candidates: [
    { candidateId: first, applicationMode: 'APPLY_PROPOSAL', applyEditedValue: true, expectedUpdatedAt: '2026-10-03T01:01:00' },
    { candidateId: second, applicationMode: 'HISTORY_ONLY', expectedUpdatedAt: '2026-10-03T01:00:00' },
  ] });
  expect(requests.some(r => r.path.endsWith('/recompare'))).toBe(false);
  expect(requests.find(r => r.method === 'PATCH')!.body.expectedUpdatedAt).toBe('2026-10-03T01:00:00');
});
