import { expect, test, type Page, type Route } from '@playwright/test';

// 합성 작품·인물만 사용한다.
const workId = '11111111-1111-4111-8111-111111111111';
const batchId = '22222222-2222-4222-8222-222222222222';
const listPath = `/api/v1/works/${workId}/setting-candidates`;
const worldListPath = `/api/v1/works/${workId}/world-setting-candidates`;
const member = { id: 1, email: 'position@example.invalid', displayName: '위치 확인', role: 'AUTHOR', status: 'ACTIVE' };
const pageOf = (content: unknown[], page = 0, totalPages = content.length ? 1 : 0) => ({
  content, page, size: 20, totalElements: content.length, totalPages, hasNext: page + 1 < totalPages,
});
const success = (route: Route, data: unknown) => route.fulfill({ contentType: 'application/json', body: JSON.stringify({ success: true, data, error: null }) });
const characters = [
  { id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', name: '아린' },
  { id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', name: '도윤' },
  { id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc', name: '세라' },
];
const groupKey = (index: number) => `existing:${characters[index].id}`;

type Candidate = Record<string, unknown> & { id: string; matchedCharacterId: string; reviewStatus: string; entityName: string };

function candidate(id: string, owner: number, setting: number, reviewed = true): Candidate {
  return {
    id, workId, episodeNo: 7, entityName: characters[owner].name, rawEntityMention: characters[owner].name,
    candidateKind: 'SETTING', entityType: 'CHARACTER', matchedCharacterId: characters[owner].id, matchStatus: 'MATCHED',
    attributeName: `status.condition_${setting}`, attributeDisplayName: `상태 ${setting}`,
    attributeValue: `합성 상태 ${setting}을 길게 설명하는 문장입니다. 원문 근거와 함께 확인합니다.`, valueType: 'STRING',
    reviewStatus: 'PENDING_REVIEW', comparisonStatus: 'COMPLETED', suggestedOperation: 'REVIEW_REQUIRED',
    manualReviewAvailable: true, analysisMode: 'ORDERED_PROVISIONAL', reviewedApplicationMode: reviewed ? 'HISTORY_ONLY' : null,
    updatedAt: '2026-10-30T02:00:00Z', evidenceSpans: [{ quote: '합성 원문 문장.' }],
  };
}

async function characterFixture(page: Page, candidates: Candidate[]) {
  const writes: string[] = [];
  await page.route('**/api/v1/**', async route => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    const method = request.method();
    if (path.endsWith('/auth/me')) return success(route, member);
    if (path.endsWith('/characters')) return success(route, pageOf(characters.map((character, index) => ({ ...character, firstAppearanceEpisodeNo: index + 1 }))));
    if (method !== 'GET') writes.push(`${method} ${path}`);
    if (method === 'PATCH' && path.endsWith('/character-match')) {
      const body = request.postDataJSON();
      const target = candidates.find(item => path === `${listPath}/${item.id}/character-match`)!;
      Object.assign(target, { matchedCharacterId: body.matchedCharacterId,
        entityName: characters.find(character => character.id === body.matchedCharacterId)?.name });
      return success(route, target);
    }
    if (method === 'POST' && path.endsWith('/group-confirm')) {
      const ids = new Set((request.postDataJSON().candidates as Array<{ candidateId: string }>).map(item => item.candidateId));
      candidates.forEach(item => { if (ids.has(item.id)) item.reviewStatus = 'CONFIRMED'; });
      return success(route, { candidates: candidates.filter(item => ids.has(item.id)) });
    }
    if (method === 'GET' && path === listPath) {
      const pending = candidates.filter(item => item.reviewStatus === 'PENDING_REVIEW');
      const groups = characters.flatMap(character => {
        const rows = pending.filter(item => item.matchedCharacterId === character.id);
        return rows.length ? [{ groupKey: `existing:${character.id}`, entityName: character.name, candidateCount: rows.length,
          pendingCandidateCount: rows.length, evidenceEpisodeNos: [7], candidates: rows }] : [];
      });
      return success(route, { batchId, totalCandidateCount: candidates.length, pendingCandidateCount: pending.length,
        directReviewCandidateCount: pending.length, confirmedCandidateCount: candidates.length - pending.length,
        dismissedCandidateCount: 0, processingCandidateCount: 0, groups: pageOf(groups) });
    }
    if (method === 'GET' && path.startsWith(`${listPath}/`)) return success(route, candidates.find(item => path === `${listPath}/${item.id}`));
    if (/\/world-setting-candidates(?:\/summary)?$/.test(path)) return success(route, { batchId, totalCandidateCount: 1,
      pendingCandidateCount: 1, directReviewCandidateCount: 1, confirmedCandidateCount: 0, dismissedCandidateCount: 0,
      processingCandidateCount: 0, groups: pageOf([]) });
    if (path.endsWith('/world-settings')) return success(route, { worldSettings: pageOf([]) });
    return success(route, []);
  });
  await page.addInitScript(() => localStorage.setItem('accessToken', 'position-restore-test'));
  return { writes };
}

const main = (page: Page) => page.locator('.setting-review-main');
const reviewUrl = (group: string) => `/setting-review?workId=${workId}&batchId=${batchId}&group=${encodeURIComponent(group)}`;

test('확정 뒤 직전 목록의 바로 다음 그룹을 열고 제목에 초점을 두며 맨 위에서 읽게 한다', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 640 });
  const { writes } = await characterFixture(page, [
    candidate('a-1', 0, 1),
    ...Array.from({ length: 5 }, (_, index) => candidate(`b-${index}`, 1, index)),
    candidate('c-1', 2, 1),
  ]);
  await page.goto(reviewUrl(groupKey(1)));
  await expect(page.getByRole('heading', { name: '도윤5개 설정' })).toBeVisible();
  await main(page).evaluate(element => { element.scrollTop = 300; });
  await expect.poll(() => main(page).evaluate(element => element.scrollTop)).toBeGreaterThan(200);
  await page.getByRole('button', { name: '5개 설정 모두 확정' }).click();
  await expect(page).toHaveURL(new RegExp(`group=${encodeURIComponent(groupKey(2))}`));
  const heading = page.getByRole('heading', { name: '세라1개 설정' });
  await expect(heading).toBeFocused();
  await expect.poll(() => main(page).evaluate(element => element.scrollTop)).toBe(0);
  expect(writes.filter(write => write.endsWith('/group-confirm'))).toHaveLength(1);
});

test('마지막 설정을 연결해 묶음이 비면 다음 묶음을 열고 연결 안내를 유지한다', async ({ page }) => {
  await characterFixture(page, [candidate('a-1', 0, 1, false), candidate('b-1', 1, 1), candidate('c-1', 2, 1)]);
  await page.goto(reviewUrl(groupKey(0)));
  await page.locator('[data-candidate-id="a-1"]').getByRole('button', { name: '캐릭터 연결 변경' }).click();
  const dialog = page.getByRole('dialog', { name: '캐릭터 연결 확인' });
  await dialog.getByRole('button', { name: /^세라/ }).click();
  await dialog.getByRole('button', { name: '선택한 캐릭터에 연결' }).click();
  await expect(page).toHaveURL(new RegExp(`group=${encodeURIComponent(groupKey(1))}`));
  await expect(page.getByRole('heading', { name: '도윤1개 설정' })).toBeFocused();
  const notice = page.getByRole('status').filter({ hasText: '‘상태 1’ 설정을 ‘세라’에 연결했어요.' });
  await expect(notice).toContainText('원래 묶음에 남은 설정이 없어 다음 묶음을 열었어요.');
  await notice.getByRole('button', { name: '연결한 묶음 보기', exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`group=${encodeURIComponent(groupKey(2))}`));
  await expect(page.getByRole('heading', { name: '세라2개 설정' })).toBeVisible();
});

test('320px에서 연결 안내의 버튼을 세로로 놓고 가로로 넘치지 않는다', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 320, height: 720 });
  await characterFixture(page, [candidate('a-1', 0, 1, false), candidate('a-2', 0, 2), candidate('c-1', 2, 1)]);
  await page.goto(reviewUrl(groupKey(0)));
  await page.locator('[data-candidate-id="a-1"]').getByRole('button', { name: '캐릭터 연결 변경' }).click();
  const dialog = page.getByRole('dialog', { name: '캐릭터 연결 확인' });
  await dialog.getByRole('button', { name: /^세라/ }).click();
  await dialog.getByRole('button', { name: '선택한 캐릭터에 연결' }).click();
  const notice = page.getByRole('status').filter({ hasText: '‘상태 1’ 설정을 ‘세라’에 연결했어요.' });
  await expect(notice).toContainText('이 묶음에서는 더 이상 보이지 않아요.');
  const [open, close] = [notice.getByRole('button', { name: '연결한 묶음 보기' }), notice.getByRole('button', { name: '닫기' })];
  const [openBox, closeBox] = [await open.boundingBox(), await close.boundingBox()];
  expect(openBox && closeBox && closeBox.y >= openBox.y + openBox.height - 1).toBe(true);
  expect(openBox!.height).toBeGreaterThanOrEqual(44);
  const noticeBox = await notice.boundingBox();
  expect(openBox!.x + openBox!.width).toBeLessThanOrEqual(noticeBox!.x + noticeBox!.width);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await notice.screenshot({ path: testInfo.outputPath('link-notice-320.png') });
});

async function scrollAndFocusCandidate(page: Page) {
  await expect(page.getByRole('heading', { name: '아린8개 설정' })).toBeVisible();
  // 초점 이동은 요소를 화면으로 끌어오므로 초점을 둔 뒤 읽던 위치로 스크롤한다.
  await page.locator('[data-candidate-id="a-5"]').focus();
  await expect(page.locator('[data-candidate-id="a-5"]')).toBeFocused();
  await main(page).evaluate(element => { element.scrollTop = 400; });
  await expect.poll(() => main(page).evaluate(element => element.scrollTop)).toBe(400);
  // 화면은 scroll 이벤트로 위치를 기억한다. 이벤트가 전달되는 다음 프레임까지 기다린 뒤 탭을 바꾼다.
  await main(page).evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
}

test('탭을 오가도 캐릭터 검토의 스크롤과 초점 후보를 복원한다', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await characterFixture(page, Array.from({ length: 8 }, (_, index) => candidate(`a-${index}`, 0, index)));
  await page.goto(reviewUrl(groupKey(0)));
  await scrollAndFocusCandidate(page);
  const tabs = page.getByRole('navigation', { name: '설정 후보 종류' });
  // 탭은 스크롤 영역 위쪽에 있다. 클릭 전 자동 스크롤 없이 읽던 위치에서 탭을 누른 경우를 재현한다.
  await tabs.getByRole('button', { name: /세계관 후보/ }).dispatchEvent('click');
  await expect(page).toHaveURL(/candidateType=world/);
  await expect.poll(() => main(page).evaluate(element => element.scrollTop)).toBe(0);
  await tabs.getByRole('button', { name: /캐릭터 후보/ }).click();
  await expect(page.getByRole('heading', { name: '아린8개 설정' })).toBeVisible();
  await expect.poll(async () => Math.abs(await main(page).evaluate(element => element.scrollTop) - 400)).toBeLessThanOrEqual(8);
  await expect(page.locator('[data-candidate-id="a-5"]')).toBeFocused();
});

test('새로고침 뒤에도 같은 그룹이면 스크롤과 초점 후보를 복원한다', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await characterFixture(page, Array.from({ length: 8 }, (_, index) => candidate(`a-${index}`, 0, index)));
  await page.goto(reviewUrl(groupKey(0)));
  await scrollAndFocusCandidate(page);
  await page.reload();
  await expect(page.getByRole('heading', { name: '아린8개 설정' })).toBeVisible();
  await expect.poll(async () => Math.abs(await main(page).evaluate(element => element.scrollTop) - 400)).toBeLessThanOrEqual(8);
  await expect(page.locator('[data-candidate-id="a-5"]')).toBeFocused();
});

test('세계관 2페이지 그룹에서 결정을 저장해도 읽던 페이지를 유지한다', async ({ page }) => {
  const make = (index: number) => ({
    id: `7777777${index}-7777-4777-8777-777777777777`, workId, sourceEpisodeNo: 7, category: 'LOCATION',
    subjectName: `합성 장소 ${index}`, targetSubjectName: `합성 장소 ${index}`, settingName: '출입 규칙',
    extractedValue: '해가 지면 문을 닫는다.', comparisonStatus: 'COMPLETED', suggestedOperation: 'REVIEW_REQUIRED',
    comparisonReviewReason: 'GENERAL_UNCERTAINTY', beforeValue: null, proposedValue: '해가 지면 문을 닫는다.',
    consolidationStatus: 'SINGLE', reviewStatus: 'PENDING_REVIEW', evidenceSpans: [{ quote: '합성 원문 문장.' }],
    manualReviewAvailable: true,
  } as Record<string, unknown>);
  const rows = [make(1), make(2)];
  const saves: unknown[] = [];
  await page.route('**/api/v1/**', route => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname;
    if (path.endsWith('/auth/me')) return success(route, member);
    if (path.endsWith('/world-setting-candidates/decisions')) {
      const body = request.postDataJSON() as { candidates: Array<Record<string, unknown>> };
      saves.push(body);
      for (const draft of body.candidates) {
        const row = rows.find(item => item.id === draft.candidateId)!;
        Object.assign(row, { userModified: true, finalOperation: draft.operation, finalCategory: draft.category,
          finalSubjectName: draft.subjectName, finalScopeName: draft.scopeName ?? null, finalSettingName: draft.settingName, finalValue: draft.value });
      }
      const saved = rows.find(item => item.id === body.candidates[0].candidateId)!;
      return success(route, { groupKey: `LOCATION|${saved.subjectName}` });
    }
    if (request.method() === 'GET' && path === worldListPath) {
      const index = Number(url.searchParams.get('page') ?? 0);
      const row = rows[index];
      return success(route, { batchId, episodeCount: 1, episodeStartNo: 7, episodeEndNo: 7, totalCandidateCount: 2,
        pendingCandidateCount: 2, directReviewCandidateCount: 2, confirmedCandidateCount: 0, dismissedCandidateCount: 0,
        processingCandidateCount: 0, pendingComparisonCount: 0, processingComparisonCount: 0, failedComparisonCount: 0,
        recomparisonRequiredCount: 0, activeComparisonJobCount: 0,
        groups: { ...pageOf(row ? [{ groupKey: `LOCATION|${row.subjectName}`, category: 'LOCATION', subjectName: row.subjectName,
          changeCount: 1, status: 'REVIEW_REQUIRED', candidates: [row], evidenceEpisodeNos: [7] }] : [], index, 2), size: 1 } });
    }
    if (path.endsWith('/setting-candidates')) return success(route, { batchId, totalCandidateCount: 0, pendingCandidateCount: 0,
      directReviewCandidateCount: 0, processingCandidateCount: 0, groups: pageOf([]) });
    if (path.endsWith('/world-settings')) return success(route, { worldSettings: pageOf([]) });
    return success(route, []);
  });
  await page.addInitScript(() => localStorage.setItem('accessToken', 'world-page-test'));
  await page.goto(`/setting-review?workId=${workId}&batchId=${batchId}&candidateType=world&page=2&size=1&group=${encodeURIComponent('LOCATION|합성 장소 2')}`);
  const row = page.locator('.world-setting-diff-row');
  await row.getByRole('button', { name: /내용·저장 위치 수정/ }).click();
  await row.getByLabel('최종 내용', { exact: true }).fill('해가 지면 문을 닫고 등불을 켠다.');
  await row.getByRole('button', { name: '이 내용으로 검토 완료' }).click();
  await expect(row.locator('.review-cb-heading')).toContainText('검토 완료');
  expect(saves).toHaveLength(1);
  expect(new URL(page.url()).searchParams.get('page')).toBe('2');
  expect(new URL(page.url()).searchParams.get('group')).toBe('LOCATION|합성 장소 2');
});
