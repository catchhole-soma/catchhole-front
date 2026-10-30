import { expect, test, type Page } from '@playwright/test';

const workId = '11111111-1111-4111-8111-111111111111';
const batchId = '22222222-2222-4222-8222-222222222222';
const sourceId = '33333333-3333-4333-8333-333333333333';
const targetId = '44444444-4444-4444-8444-444444444444';
const listPath = `/api/v1/works/${workId}/setting-candidates`;
const pageOf = (content: unknown[], page = 0, totalPages = 1) => ({ content, page, size: 1, totalElements: totalPages, totalPages });

async function fixture(page: Page) {
  const candidates = ['소속', '직업'].map((name, i) => ({
    id: `candidate-${i}`, workId, entityName: '아리아', rawEntityMention: '나',
    matchedCharacterId: sourceId, matchStatus: 'MATCHED', candidateKind: 'SETTING', entityType: 'CHARACTER',
    attributeName: name, attributeValue: `원래 ${name}`, valueType: 'STRING', episodeNo: 1,
    comparisonStatus: 'COMPLETED', suggestedOperation: 'REVIEW_REQUIRED', reviewStatus: 'PENDING_REVIEW',
    manualReviewAvailable: true, reviewedApplicationMode: null as string | null, analysisMode: 'ORDERED_PROVISIONAL', updatedAt: '2026-10-01T00:00:00Z',
  }));
  const writes: { path: string; body: Record<string, unknown> }[] = [];
  let detailGate: Promise<void> | undefined;
  let releaseDetails: (() => void) | undefined;
  await page.route('**/api/v1/**', async route => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname;
    const success = (data: unknown) => route.fulfill({ contentType: 'application/json', body: JSON.stringify({ success: true, data }) });
    if (path.endsWith('/auth/me')) return success({ id: 1, email: 'scope@example.com', displayName: '테스트', role: 'AUTHOR', status: 'ACTIVE' });
    if (path.endsWith('/characters')) return success(pageOf([{ id: sourceId, name: '아리아' }, { id: targetId, name: '베른' }]));
    if (path.includes('/characters/')) return success({ id: path.split('/').pop(), name: path.endsWith(sourceId) ? '아리아' : '베른', profile: [], stats: [], skills: [], items: [], statuses: [] });
    if (request.method() !== 'GET') {
      const body = request.postDataJSON();
      writes.push({ path, body });
      const edited = candidates.find(candidate => path === `${listPath}/${candidate.id}`);
      if (edited && request.method() === 'PATCH') {
        edited.reviewedApplicationMode = body.reviewedApplicationMode;
        return success(edited);
      }
      if (path.endsWith('/character-match') || path.endsWith('/group-character-match')) {
        const selected = path.endsWith('/group-character-match')
          ? candidates.filter(candidate => body.candidateIds.includes(candidate.id))
          : candidates.filter(candidate => path === `${listPath}/${candidate.id}/character-match`);
        const matchedId = body.matchedCharacterId ?? targetId;
        selected.forEach(candidate => { candidate.matchedCharacterId = matchedId; candidate.entityName = matchedId === sourceId ? '아리아' : '베른'; });
        return success(path.endsWith('/group-character-match') ? { groupKey: `existing:${matchedId}`, candidates: selected } : selected[0]);
      }
    }
    if (path === listPath) {
      // A destination on another server page catches name-key guesses and first-group fallbacks.
      const allGroups = [sourceId, targetId].flatMap(id => {
        const rows = candidates.filter(candidate => candidate.matchedCharacterId === id);
        return rows.length ? [{ groupKey: `existing:${id}`, entityName: id === sourceId ? '아리아' : '베른', candidateCount: rows.length, evidenceEpisodeNos: [1], candidates: rows }] : [];
      });
      const index = Number(url.searchParams.get('page') ?? 0);
      return success({ batchId, totalCandidateCount: 2, pendingCandidateCount: 2, directReviewCandidateCount: 2,
        confirmedCandidateCount: 0, dismissedCandidateCount: 0, processingCandidateCount: 0,
        groups: pageOf(allGroups.slice(index, index + 1), index, allGroups.length) });
    }
    if (path.startsWith(`${listPath}/`)) {
      await detailGate;
      return success(candidates.find(candidate => path.endsWith(candidate.id)));
    }
    if (/\/world-setting-candidates(?:\/summary)?$/.test(path)) return success({ batchId, totalCandidateCount: 0, directReviewCandidateCount: 0,
      confirmedCandidateCount: 0, dismissedCandidateCount: 0, processingCandidateCount: 0, groups: pageOf([]) });
    return success({});
  });
  await page.goto('/login');
  await page.evaluate(() => localStorage.setItem('accessToken', 'character-match-scope-test'));
  await page.goto(`/setting-review?workId=${workId}&batchId=${batchId}&group=existing%3A${sourceId}&size=1`);
  return { writes, candidate: candidates[0], holdDetails: () => { detailGate = new Promise<void>(resolve => { releaseDetails = resolve; }); }, releaseDetails: () => releaseDetails?.() };
}

async function linkFirstSettingTo(page: Page, name: RegExp) {
  await page.getByRole('region', { name: '소속 설정 후보', exact: true }).getByRole('button', { name: '캐릭터 연결 변경' }).click();
  const dialog = page.getByRole('dialog', { name: '캐릭터 연결 확인' });
  await dialog.getByRole('button', { name }).click();
  await dialog.getByRole('button', { name: '선택한 캐릭터에 연결' }).click();
  await expect(dialog).toHaveCount(0);
}

test('단건 연결은 현재 묶음을 유지하고 연결한 묶음 이동은 안내의 버튼으로 고른다', async ({ page }) => {
  const { writes } = await fixture(page);
  const main = page.locator('.setting-review-main');
  await linkFirstSettingTo(page, /^베른/);
  const notice = page.getByRole('status').filter({ hasText: '‘소속’ 설정을 ‘베른’에 연결했어요.' });
  await expect(notice).toContainText('이 묶음에서는 더 이상 보이지 않아요.');
  // 화면은 출발 묶음·페이지에 남고, 이동한 설정만 빠진다.
  await expect(page.getByRole('heading', { name: '아리아1개 설정' })).toBeVisible();
  await expect(page.getByRole('region', { name: '소속 설정 후보', exact: true })).toHaveCount(0);
  await expect(page.getByRole('region', { name: '직업 설정 후보', exact: true })).toContainText('캐릭터 · 아리아');
  await expect(page).toHaveURL(new RegExp(`group=existing%3A${sourceId}`));
  expect(new URL(page.url()).searchParams.get('candidate')).toBeNull();
  expect(writes).toEqual([{ path: `${listPath}/candidate-0/character-match`, body: { resolutionType: 'MATCH_EXISTING', matchedCharacterId: targetId } }]);
  await notice.getByRole('button', { name: '연결한 묶음 보기', exact: true }).click();
  await expect(page.getByRole('heading', { name: '베른1개 설정' })).toBeVisible();
  await expect(page.getByRole('region', { name: '소속 설정 후보', exact: true })).toContainText('캐릭터 · 베른');
  await expect(page).toHaveURL(new RegExp(`group=existing%3A${targetId}`));
  await expect(page).toHaveURL(/[?&]page=2(?:&|$)/);
  await expect(page.getByRole('status').filter({ hasText: '연결했어요.' })).toHaveCount(0);
  await page.reload();
  await expect(page.getByRole('heading', { name: '베른1개 설정' })).toBeVisible();
  await page.getByRole('region', { name: '소속 설정 후보', exact: true }).getByRole('button', { name: /이력에만 저장/ }).click();
  await expect(page.getByText('저장했어요 · 확정 전까지 바꿀 수 있어요', { exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: '베른1개 설정' })).toBeVisible();
  await expect(page).toHaveURL(new RegExp(`group=existing%3A${targetId}`));
  await page.getByRole('button', { name: '이전 페이지', exact: true }).click();
  await expect(page.getByRole('heading', { name: '아리아1개 설정' })).toBeVisible();
  await expect(page.getByRole('region', { name: '직업 설정 후보', exact: true })).toContainText('캐릭터 · 아리아');
  expect(await main.evaluate(el => el.scrollWidth <= el.clientWidth + 1)).toBe(true);
});

test('같은 대상을 다시 고르면 묶음에 남은 설정만 갱신하고 안내하지 않는다', async ({ page }) => {
  const { writes } = await fixture(page);
  await linkFirstSettingTo(page, /^아리아/);
  await expect.poll(() => writes.length).toBe(1);
  await expect(page.getByRole('heading', { name: '아리아2개 설정' })).toBeVisible();
  await expect(page.getByRole('region', { name: '소속 설정 후보', exact: true })).toContainText('캐릭터 · 아리아');
  await expect(page.getByRole('status').filter({ hasText: '연결했어요.' })).toHaveCount(0);
  await expect(page).toHaveURL(new RegExp(`group=existing%3A${sourceId}`));
});

test('일괄 연결에서만 묶음의 모든 대기 설정을 함께 변경한다', async ({ page }) => {
  const { writes } = await fixture(page);
  await page.getByRole('button', { name: '캐릭터 일괄 연결', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('button', { name: /^베른/ }).click();
  await dialog.getByRole('button', { name: '선택한 캐릭터에 연결' }).click();
  await expect(page.getByRole('heading', { name: '베른2개 설정' })).toBeVisible();
  await expect(page.getByRole('region', { name: '소속 설정 후보', exact: true })).toContainText('캐릭터 · 베른');
  await expect(page.getByRole('region', { name: '직업 설정 후보', exact: true })).toContainText('캐릭터 · 베른');
  expect(writes).toEqual([{ path: `${listPath}/group-character-match`, body: { batchId, candidateIds: ['candidate-0', 'candidate-1'], resolutionType: 'MATCH_EXISTING', matchedCharacterId: targetId } }]);
});

test('연결한 묶음으로 이동할 때 상세 재조회가 늦어도 옛 캐시로 검토 필터를 바꾸지 않는다', async ({ page }) => {
  const state = await fixture(page);
  await page.getByRole('region', { name: '소속 설정 후보', exact: true }).waitFor();
  await page.evaluate(async ({ workId, batchId, candidate }) => {
    const queryModule = '/src/app/lib/query-client.ts';
    const optionsModule = '/src/app/api/generated/@tanstack/react-query.gen.ts';
    const { queryClient } = await import(queryModule);
    const { getSettingCandidateOptions } = await import(optionsModule);
    queryClient.setQueryData(getSettingCandidateOptions({ path: { workId, candidateId: candidate.id }, query: { batchId } }).queryKey,
      { success: true, data: { ...candidate, reviewStatus: 'CONFIRMED' } });
  }, { workId, batchId, candidate: state.candidate });
  state.holdDetails();
  try {
    await linkFirstSettingTo(page, /^베른/);
    await page.getByRole('button', { name: '연결한 묶음 보기', exact: true }).click();
    await expect(page.getByRole('heading', { name: '베른1개 설정' })).toBeVisible();
    expect(new URL(page.url()).searchParams.get('reviewStatus')).toBeNull();
  } finally {
    state.releaseDetails();
  }
});
