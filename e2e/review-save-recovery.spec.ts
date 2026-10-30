import { expect, test, type Page, type Route } from '@playwright/test';

// 합성 작품·인물만 사용한다. 응답 유실은 서버 목이 상태를 바꾼 뒤(또는 바꾸지 않고) 요청을 끊어 재현한다.
const workId = '11111111-1111-4111-8111-111111111111';
const batchId = '22222222-2222-4222-8222-222222222222';
const firstCharacterId = '44444444-4444-4444-8444-444444444444';
const secondCharacterId = '55555555-5555-4555-8555-555555555555';
const listPath = `/api/v1/works/${workId}/setting-candidates`;
const worldListPath = `/api/v1/works/${workId}/world-setting-candidates`;
const savedText = '저장했어요 · 확정 전까지 바꿀 수 있어요';
const unverifiedText = '저장 결과를 확인하지 못했어요.';
const member = { id: 1, email: 'save-recovery@example.invalid', displayName: '저장 확인', role: 'AUTHOR', status: 'ACTIVE' };
const pageOf = (content: unknown[]) => ({ content, page: 0, size: 20, totalElements: content.length, totalPages: content.length ? 1 : 0, hasNext: false });
const success = (route: Route, data: unknown) => route.fulfill({ contentType: 'application/json', body: JSON.stringify({ success: true, data, error: null }) });

type Candidate = Record<string, unknown> & { id: string; matchedCharacterId: string | null; reviewStatus: string };
type LossMode = 'saved' | 'unsaved' | null;

function manualCandidate(id: string, attributeName: string, characterId: string, name: string, overrides: Record<string, unknown> = {}): Candidate {
  return {
    id, workId, episodeNo: 4, entityName: name, rawEntityMention: name, candidateKind: 'SETTING', entityType: 'CHARACTER',
    matchedCharacterId: characterId, matchStatus: 'MATCHED', attributeName, attributeValue: `${name}의 ${attributeName}`,
    valueType: 'STRING', reviewStatus: 'PENDING_REVIEW', comparisonStatus: 'COMPLETED', suggestedOperation: 'REVIEW_REQUIRED',
    manualReviewAvailable: true, analysisMode: 'ORDERED_PROVISIONAL', reviewedApplicationMode: null,
    updatedAt: '2026-10-30T01:00:00Z', evidenceSpans: [{ quote: '합성 원문 문장.' }], ...overrides,
  };
}

async function characterFixture(page: Page, candidates: Candidate[], groupKeyOf: (candidate: Candidate) => string) {
  const state = {
    patches: [] as Record<string, unknown>[], matches: [] as Record<string, unknown>[], confirms: [] as Record<string, unknown>[],
    detailReads: 0, losePatch: null as LossMode, loseMatch: null as LossMode, loseConfirm: null as LossMode,
    detailGate: null as Promise<void> | null,
  };
  let releaseDetail = () => {};
  await page.route('**/api/v1/**', async route => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    const method = request.method();
    if (path.endsWith('/auth/me')) return success(route, member);
    if (path.endsWith('/characters')) return success(route, pageOf([
      { id: firstCharacterId, name: '아린', firstAppearanceEpisodeNo: 1 },
      { id: secondCharacterId, name: '도윤', firstAppearanceEpisodeNo: 2 },
    ]));
    if (method === 'PATCH' && path.endsWith('/character-match')) {
      const body = request.postDataJSON();
      state.matches.push(body);
      const candidate = candidates.find(item => path === `${listPath}/${item.id}/character-match`)!;
      if (state.loseMatch !== 'unsaved') Object.assign(candidate, { matchedCharacterId: body.matchedCharacterId,
        entityName: body.matchedCharacterId === firstCharacterId ? '아린' : '도윤', updatedAt: '2026-10-30T01:05:00Z' });
      if (state.loseMatch) { state.loseMatch = null; return route.abort('failed'); }
      return success(route, candidate);
    }
    if (method === 'PATCH' && path.startsWith(`${listPath}/`)) {
      const body = request.postDataJSON();
      state.patches.push(body);
      const candidate = candidates.find(item => path === `${listPath}/${item.id}`)!;
      if (state.losePatch !== 'unsaved') Object.assign(candidate, { attributeValue: body.attributeValue,
        reviewedApplicationMode: body.reviewedApplicationMode ?? null, userModified: true, updatedAt: '2026-10-30T01:10:00Z' });
      if (state.losePatch) {
        // 첫 요청만 끊고, 미저장 시나리오는 이후 재전송을 정상 처리한다.
        if (state.losePatch === 'saved' || state.patches.length === 1) {
          const lost = state.losePatch;
          if (lost === 'saved') state.losePatch = null;
          return route.abort('failed');
        }
        state.losePatch = null;
        Object.assign(candidate, { attributeValue: body.attributeValue, reviewedApplicationMode: body.reviewedApplicationMode ?? null,
          userModified: true, updatedAt: '2026-10-30T01:10:00Z' });
      }
      return success(route, candidate);
    }
    if (method === 'POST' && path.endsWith('/group-confirm')) {
      const body = request.postDataJSON();
      state.confirms.push(body);
      const ids = new Set((body.candidates as Array<{ candidateId: string }>).map(item => item.candidateId));
      if (state.loseConfirm !== 'unsaved') candidates.forEach(candidate => { if (ids.has(candidate.id)) candidate.reviewStatus = 'CONFIRMED'; });
      if (state.loseConfirm) { state.loseConfirm = null; return route.abort('failed'); }
      return success(route, { candidates: candidates.filter(candidate => ids.has(candidate.id)) });
    }
    if (method === 'GET' && path === listPath) {
      const pending = candidates.filter(candidate => candidate.reviewStatus === 'PENDING_REVIEW');
      const keys = [...new Set(pending.map(groupKeyOf))];
      return success(route, { batchId, totalCandidateCount: candidates.length, pendingCandidateCount: pending.length,
        directReviewCandidateCount: pending.length, confirmedCandidateCount: candidates.length - pending.length,
        dismissedCandidateCount: 0, processingCandidateCount: 0,
        groups: pageOf(keys.map(key => {
          const rows = pending.filter(candidate => groupKeyOf(candidate) === key);
          return { groupKey: key, entityName: rows[0].entityName, candidateCount: rows.length, pendingCandidateCount: rows.length,
            evidenceEpisodeNos: [4], candidates: rows };
        })) });
    }
    if (method === 'GET' && path.startsWith(`${listPath}/`)) {
      state.detailReads += 1;
      if (state.detailGate) await state.detailGate;
      return success(route, candidates.find(candidate => path === `${listPath}/${candidate.id}`));
    }
    if (/\/world-setting-candidates(?:\/summary)?$/.test(path)) return success(route, { batchId, totalCandidateCount: 0,
      pendingCandidateCount: 0, directReviewCandidateCount: 0, processingCandidateCount: 0, groups: pageOf([]) });
    return success(route, []);
  });
  await page.addInitScript(() => localStorage.setItem('accessToken', 'save-recovery-test'));
  return {
    state,
    holdDetail: () => { state.detailGate = new Promise<void>(resolve => { releaseDetail = resolve; }); },
    releaseDetail: () => { state.detailGate = null; releaseDetail(); },
  };
}

const existingKey = (candidate: Candidate) => `existing:${candidate.matchedCharacterId}`;

test('반영 방식 저장 응답을 잃어도 서버에 저장됐으면 재전송 없이 저장 완료로 바뀐다', async ({ page }) => {
  const candidates = [manualCandidate('c-1', 'profile.affiliation', firstCharacterId, '아린')];
  const { state, holdDetail, releaseDetail } = await characterFixture(page, candidates, existingKey);
  await page.goto(`/setting-review?workId=${workId}&batchId=${batchId}&group=${encodeURIComponent(`existing:${firstCharacterId}`)}`);
  const card = page.locator('[data-candidate-id="c-1"]');
  state.losePatch = 'saved';
  holdDetail();
  await card.getByRole('radio', { name: /이력에만 저장/ }).click();
  await expect(card.getByRole('status').filter({ hasText: unverifiedText })).toBeVisible();
  await expect(card.getByText(savedText, { exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: /^(모두 확정|확정하고 다음)$/ })).toBeDisabled();
  releaseDetail();
  await expect(card.getByText(savedText, { exact: true })).toBeVisible();
  await expect(card.getByRole('status').filter({ hasText: unverifiedText })).toHaveCount(0);
  await expect(page.getByRole('button', { name: /^(모두 확정|확정하고 다음)$/ })).toBeEnabled();
  expect(state.patches).toHaveLength(1);
});

test('저장되지 않은 반영 방식은 세 번 다시 확인한 뒤 다시 시도로 한 번만 재전송한다', async ({ page }) => {
  test.setTimeout(60_000);
  const candidates = [manualCandidate('c-1', 'profile.affiliation', firstCharacterId, '아린')];
  const { state } = await characterFixture(page, candidates, existingKey);
  await page.goto(`/setting-review?workId=${workId}&batchId=${batchId}&group=${encodeURIComponent(`existing:${firstCharacterId}`)}`);
  const card = page.locator('[data-candidate-id="c-1"]');
  state.losePatch = 'unsaved';
  await card.getByRole('radio', { name: /이력에만 저장/ }).click();
  await expect(card.getByRole('status').filter({ hasText: /최신 상태를 확인하는 중이에요\(1\/3\)/ })).toBeVisible({ timeout: 5_000 });
  const retry = card.getByRole('button', { name: '다시 시도', exact: true });
  await expect(retry).toBeVisible({ timeout: 20_000 });
  await expect(card.getByRole('button', { name: '최신 상태 확인', exact: true })).toBeVisible();
  // 바로 한 번, 1·3·8초 뒤 세 번 다시 읽는다.
  expect(state.detailReads).toBe(4);
  expect(state.patches).toHaveLength(1);
  await retry.click();
  await expect(card.getByText(savedText, { exact: true })).toBeVisible();
  expect(state.patches).toHaveLength(2);
  expect(state.patches[1]).toMatchObject({ reviewedApplicationMode: 'HISTORY_ONLY', expectedUpdatedAt: '2026-10-30T01:00:00Z' });
});

test('캐릭터 연결 응답을 잃어도 다시 읽어 연결을 확인하면 안내를 보여 주고 재전송하지 않는다', async ({ page }) => {
  const candidates = [
    manualCandidate('c-1', 'profile.affiliation', firstCharacterId, '아린'),
    manualCandidate('c-2', 'profile.occupation', firstCharacterId, '아린'),
  ];
  const { state } = await characterFixture(page, candidates, existingKey);
  await page.goto(`/setting-review?workId=${workId}&batchId=${batchId}&group=${encodeURIComponent(`existing:${firstCharacterId}`)}`);
  state.loseMatch = 'saved';
  await page.locator('[data-candidate-id="c-1"]').getByRole('button', { name: '캐릭터 연결 변경' }).click();
  const dialog = page.getByRole('dialog', { name: '캐릭터 연결 확인' });
  await dialog.getByRole('button', { name: /^도윤/ }).click();
  await dialog.getByRole('button', { name: '선택한 캐릭터에 연결' }).click();
  await expect(dialog).toHaveCount(0);
  await expect(page.getByRole('status').filter({ hasText: '‘소속’ 설정을 ‘도윤’에 연결했어요.' })).toBeVisible();
  await expect(page.locator('[data-candidate-id="c-1"]')).toHaveCount(0);
  await expect(page).toHaveURL(new RegExp(`group=existing%3A${firstCharacterId}`));
  expect(state.matches).toHaveLength(1);
});

test('그룹 확정 응답을 잃어도 재조회에서 그룹이 사라지면 성공으로 처리하고 다음 그룹을 연다', async ({ page }) => {
  const reviewed = { reviewedApplicationMode: 'HISTORY_ONLY' };
  const candidates = [
    manualCandidate('c-1', 'profile.affiliation', firstCharacterId, '아린', reviewed),
    manualCandidate('c-2', 'profile.occupation', secondCharacterId, '도윤', reviewed),
  ];
  const { state } = await characterFixture(page, candidates, existingKey);
  await page.goto(`/setting-review?workId=${workId}&batchId=${batchId}&group=${encodeURIComponent(`existing:${firstCharacterId}`)}`);
  state.loseConfirm = 'saved';
  await page.getByRole('button', { name: /^(모두 확정|확정하고 다음)$/ }).click();
  await expect(page).toHaveURL(new RegExp(`group=existing%3A${secondCharacterId}`));
  await expect(page.getByRole('heading', { name: '도윤1개 설정' })).toBeVisible();
  await expect(page.getByRole('heading', { name: '도윤1개 설정' })).toBeFocused();
  await expect(page.getByText('캐릭터 설정 묶음을 확정하지 못했습니다.', { exact: false })).toHaveCount(0);
  expect(state.confirms).toHaveLength(1);
});

test('로컬 선택은 저장 완료가 아니라 확정 때 적용할 선택으로 표시한다', async ({ page }) => {
  const candidates = [manualCandidate('c-1', 'profile.affiliation', firstCharacterId, '아린', {
    manualReviewAvailable: false, suggestedOperation: 'ADD', analysisMode: 'CONFIRMED_ONLY', comparisonRevision: 'revision-1',
    proposedFactValue: '왕립 학회', attributeValue: '왕립 학회', snapshotChanges: [],
  })];
  const { state } = await characterFixture(page, candidates, existingKey);
  await page.goto(`/setting-review?workId=${workId}&batchId=${batchId}&group=${encodeURIComponent(`existing:${firstCharacterId}`)}`);
  const card = page.locator('[data-candidate-id="c-1"]');
  await card.getByRole('radio', { name: /이력에만 저장/ }).click();
  await expect(card.getByRole('radio', { name: /이력에만 저장/ })).toHaveAttribute('aria-checked', 'true');
  await expect(card.getByText('선택됨 · 확정할 때 적용', { exact: true })).toBeVisible();
  await expect(card.getByText(savedText, { exact: true })).toHaveCount(0);
  expect(state.patches).toHaveLength(0);
});

test('세계관 결정 저장 응답을 잃고 확인 조회도 실패하면 1·3·8초 뒤 자동으로 다시 확인해 저장 완료로 접는다', async ({ page }) => {
  test.setTimeout(60_000);
  const candidateId = '66666666-6666-4666-8666-666666666666';
  let candidate: Record<string, unknown> = {
    id: candidateId, workId, sourceEpisodeNo: 4, category: 'LOCATION', subjectName: '안개 항구', targetSubjectName: '안개 항구',
    settingName: '입항 규칙', extractedValue: '밤에는 배가 들어오지 않는다.', comparisonStatus: 'COMPLETED',
    suggestedOperation: 'REVIEW_REQUIRED', comparisonReviewReason: 'GENERAL_UNCERTAINTY', beforeValue: null,
    proposedValue: '밤에는 배가 들어오지 않는다.', consolidationStatus: 'SINGLE', reviewStatus: 'PENDING_REVIEW',
    evidenceSpans: [{ quote: '합성 원문 문장.' }], manualReviewAvailable: true,
  };
  const saves: unknown[] = [];
  let listReadsAfterSave = 0;
  let failedReads = 0;
  await page.route('**/api/v1/**', async route => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    if (path.endsWith('/auth/me')) return success(route, member);
    if (path.endsWith('/world-setting-candidates/decisions')) {
      const body = request.postDataJSON() as { candidates: Array<Record<string, unknown>> };
      saves.push(body);
      const draft = body.candidates[0];
      candidate = { ...candidate, userModified: true, finalOperation: draft.operation, finalCategory: draft.category,
        finalSubjectName: draft.subjectName, finalScopeName: draft.scopeName ?? null, finalSettingName: draft.settingName, finalValue: draft.value };
      return route.abort('failed');
    }
    if (request.method() === 'GET' && path === worldListPath) {
      if (saves.length) {
        listReadsAfterSave += 1;
        if (failedReads < 3) { failedReads += 1; return route.abort('failed'); }
      }
      return success(route, { batchId, episodeCount: 1, episodeStartNo: 4, episodeEndNo: 4, totalCandidateCount: 1,
        pendingCandidateCount: 1, directReviewCandidateCount: 1, confirmedCandidateCount: 0, dismissedCandidateCount: 0,
        processingCandidateCount: 0, pendingComparisonCount: 0, processingComparisonCount: 0, failedComparisonCount: 0,
        recomparisonRequiredCount: 0, activeComparisonJobCount: 0,
        groups: pageOf([{ groupKey: 'LOCATION|안개 항구', category: 'LOCATION', subjectName: '안개 항구', changeCount: 1,
          status: 'REVIEW_REQUIRED', candidates: [candidate], evidenceEpisodeNos: [4] }]) });
    }
    if (path.endsWith('/setting-candidates')) return success(route, { batchId, totalCandidateCount: 0, pendingCandidateCount: 0,
      directReviewCandidateCount: 0, processingCandidateCount: 0, groups: pageOf([]) });
    if (path.endsWith('/world-settings')) return success(route, { worldSettings: pageOf([]) });
    return success(route, []);
  });
  await page.addInitScript(() => localStorage.setItem('accessToken', 'world-save-recovery-test'));
  await page.goto(`/setting-review?workId=${workId}&batchId=${batchId}&candidateType=world&group=${encodeURIComponent('LOCATION|안개 항구')}`);
  const row = page.locator('.world-setting-diff-row');
  await row.getByRole('radio', { name: /내용·저장 위치 수정/ }).click();
  await row.getByLabel('최종 내용', { exact: true }).fill('밤에는 등불을 단 배만 들어온다.');
  await row.getByRole('button', { name: '이 내용으로 검토 완료' }).click();
  await expect(page.getByText('저장 결과를 아직 확인하지 못했어요.', { exact: false })).toBeVisible();
  await expect(row.getByRole('status').filter({ hasText: '저장 결과를 확인하고 있어요' })).toBeVisible();
  await expect(page.getByText(/잠시 후 자동으로 다시 확인해요\(\d\/3\)/)).toBeVisible();
  await expect(row.locator('.review-cb-heading')).toContainText('검토 완료', { timeout: 20_000 });
  await expect(page.getByText('저장 결과를 아직 확인하지 못했어요.', { exact: false })).toHaveCount(0);
  await expect(page.getByText('서비스에 연결할 수 없습니다.', { exact: false })).toHaveCount(0);
  expect(failedReads).toBe(3);
  expect(listReadsAfterSave).toBeGreaterThanOrEqual(4);
  expect(saves).toHaveLength(1);
});
