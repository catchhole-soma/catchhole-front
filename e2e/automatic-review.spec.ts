import { expect, test, type Page, type Route } from '@playwright/test';

const workId = '11111111-1111-4111-8111-111111111111';
const batchId = '22222222-2222-4222-8222-222222222222';
const candidateId = '33333333-3333-4333-8333-333333333333';
const characterId = '44444444-4444-4444-8444-444444444444';

function success(route: Route, data: unknown) {
  return route.fulfill({ status: 200, contentType: 'application/json',
    body: JSON.stringify({ success: true, data, error: null }) });
}

function pageOf(content: unknown[]) {
  return { content, page: 0, size: 20, totalElements: content.length,
    totalPages: content.length ? 1 : 0, hasNext: false };
}

async function authenticate(page: Page) {
  await page.goto('/login');
  await page.evaluate(() => {
    localStorage.setItem('accessToken', 'isolated-automatic-review-test');
    localStorage.removeItem('catchhole_demo_mode');
  });
}

const member = { id: 1, email: 'automatic-review@example.com', displayName: '검토 테스트',
  role: 'AUTHOR', status: 'ACTIVE', phoneVerified: false };

test('자동 검토 후보와 기존 실패 후보가 섞여 있으면 기존 후보만 재비교한다', async ({ page }) => {
  let retriedId: string | undefined;
  const shared = { workId, sourceEpisodeNo: 11, category: 'RACE', subjectName: '설인',
    extractedValue: '북부 설원', comparisonStatus: 'FAILED', reviewStatus: 'PENDING_REVIEW',
    evidenceSpans: [], consolidationStatus: 'SINGLE' };
  const candidates = [
    { ...shared, id: candidateId, settingName: '서식지', manualReviewAvailable: true },
    { ...shared, id: characterId, settingName: '거주지', manualReviewAvailable: false },
  ];
  await page.route('**/api/v1/**', route => {
    const pathname = new URL(route.request().url()).pathname;
    if (pathname.endsWith('/auth/me')) return success(route, member);
    if (pathname.endsWith('/recompare')) {
      retriedId = pathname.split('/').at(-2);
      return success(route, candidates[1]);
    }
    if (pathname.endsWith('/world-setting-candidates')) return success(route, { batchId,
      totalCandidateCount: 2, reviewedCandidateCount: 0, pendingCandidateCount: 2, failedComparisonCount: 2,
      activeComparisonJobCount: 0, groups: pageOf([{ groupKey: 'RACE|설인', category: 'RACE', subjectName: '설인',
        changeCount: 2, status: 'FAILED', candidates, evidenceEpisodeNos: [11] }]) });
    if (pathname.endsWith('/setting-candidates')) return success(route, { batchId, totalCandidateCount: 0,
      reviewedCandidateCount: 0, pendingCandidateCount: 0, matchRequiredCandidateCount: 0, groups: pageOf([]) });
    return success(route, []);
  });
  await authenticate(page);
  await page.goto(`/setting-review?workId=${workId}&batchId=${batchId}&candidateType=world`);
  await expect(page.locator('.world-candidate-group-card')).toContainText('비교 실패');
  await expect(page.locator('.world-setting-diff-row').first()).toContainText('검토 필요');
  await expect(page.locator('.world-setting-diff-row').last()).toContainText('비교 실패');
  await page.getByRole('button', { name: '다시 비교', exact: true }).click();
  await expect.poll(() => retriedId).toBe(characterId);
});

for (const scenario of [
  { status: 'FAILED', width: 1280, value: '갈색' },
  { status: 'RECOMPARISON_REQUIRED', width: 1280, value: '청색' },
  { status: 'FAILED', width: 320, value: '갈색' },
  { status: 'FAILED', width: 1280, value: '갈색', invalid: true },
  { status: 'FAILED', width: 320, value: '갈색', invalid: true },
]) {
  test(`자동 분석 캐릭터 ${scenario.status} 후보는 ${scenario.invalid ? '수정 불가 값이면 제외를 안내한다' : '직접 확인 후 반영한다'} (${scenario.width}px)`, async ({ page }) => {
    await page.setViewportSize({ width: scenario.width, height: 800 });
    let candidate = {
      id: candidateId, workId, episodeNo: 11, candidateKind: 'SETTING', entityType: 'CHARACTER',
      entityName: '수아', rawEntityMention: '수아', matchedCharacterId: characterId, matchStatus: 'MATCHED',
      attributeName: 'profile.eye_color', attributeValue: '갈색', valueType: scenario.invalid ? 'UNKNOWN' : 'STRING',
      valueValidation: scenario.invalid ? { status: 'INVALID', repairable: false,
        message: '이 설정에 맞는 형식으로 내용을 입력해 주세요.' } : undefined,
      evidenceSpans: [{ quote: '수아의 눈동자는 짙은 갈색으로 빛났다.' }], confidence: 0.9,
      reviewStatus: 'PENDING_REVIEW', comparisonStatus: scenario.status,
      automaticReviewHoldReason: scenario.status === 'FAILED' ? 'SUBJECT_RESOLUTION_FAILED' : 'COMPARISON_INPUT_TOO_LARGE',
      manualReviewAvailable: true,
    };
    let updateBody: unknown;
    let confirmBody: unknown;
    let comparisonRequests = 0;
    const listPath = `/api/v1/works/${workId}/setting-candidates`;
    await page.route('**/api/v1/**', route => {
      const request = route.request();
      const pathname = new URL(request.url()).pathname;
      if (pathname.endsWith('/auth/me')) return success(route, member);
      if (pathname.endsWith('/recompare')) comparisonRequests += 1;
      if (pathname === `${listPath}/${candidateId}` && request.method() === 'PATCH') {
        updateBody = request.postDataJSON();
        candidate = { ...candidate, attributeValue: (updateBody as { attributeValue: string }).attributeValue,
          comparisonStatus: 'RECOMPARISON_REQUIRED' };
        return success(route, candidate);
      }
      if (pathname === `${listPath}/group-confirm`) {
        confirmBody = request.postDataJSON();
        candidate = { ...candidate, reviewStatus: 'CONFIRMED', manualReviewAvailable: false };
        return success(route, { groupKey: '수아', candidates: [candidate] });
      }
      if (pathname === listPath) {
        const pending = candidate.reviewStatus === 'PENDING_REVIEW';
        return success(route, { batchId, episodeStartNo: 11, episodeEndNo: 11, episodeCount: 1,
          totalCandidateCount: 1, reviewedCandidateCount: pending ? 0 : 1, pendingCandidateCount: pending ? 1 : 0,
          matchRequiredCandidateCount: 0, groups: pageOf(pending ? [{ groupKey: '수아', entityName: '수아',
            candidateCount: 1, pendingCandidateCount: 1, evidenceEpisodeNos: [11], candidates: [candidate] }] : []) });
      }
      if (pathname.endsWith('/world-setting-candidates')) {
        return success(route, { batchId, totalCandidateCount: 0, reviewedCandidateCount: 0,
          pendingCandidateCount: 0, failedComparisonCount: 0, groups: pageOf([]) });
      }
      if (pathname === `${listPath}/${candidateId}`) return success(route, candidate);
      return success(route, []);
    });
    await authenticate(page);
    await page.goto(`/setting-review?workId=${workId}&batchId=${batchId}&group=${encodeURIComponent('수아')}`);
    const confirm = page.getByRole('button', { name: /설정 모두 확정/ }).last();
    await expect(page.getByText(scenario.status === 'FAILED' ? '연결할 대상 확인' : '비교할 내용 확인', { exact: true })).toBeVisible();
    if (scenario.status === 'FAILED') {
      const detail = page.locator('.setting-candidate-detail');
      await expect(detail).toContainText('검토 필요');
      await expect(detail).toContainText(scenario.invalid ? '자동 비교를 마치지 못했습니다.' : '자동 비교를 마치지 못해 대상과 내용을 확인해 주세요.');
      await expect(detail).not.toContainText('비교 실패');
      expect(candidate.comparisonStatus).toBe('FAILED');
    }
    await expect(confirm).toBeDisabled();
    if (scenario.invalid) {
      const detail = page.locator('.setting-candidate-detail');
      await expect(page.getByRole('button', { name: '직접 확인해서 반영', exact: true })).toBeDisabled();
      await expect(detail.getByRole('button', { name: '제외', exact: true })).toBeEnabled();
      await expect(detail.getByRole('status')).toContainText('이 항목은 지금 직접 수정할 수 없습니다.');
      await expect(detail.getByRole('status')).toContainText('이 후보를 제외하면 나머지 설정을 검토할 수 있습니다.');
      await expect(detail.getByRole('alert')).toContainText('설정값의 형식을 확인해야 합니다.');
      await expect(detail).not.toContainText('입력해 주세요.');
      await expect(detail).not.toContainText('눌러 값을 저장해 주세요.');
      expect(comparisonRequests).toBe(0);
      expect(updateBody).toBeUndefined();
      expect(confirmBody).toBeUndefined();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBeTruthy();
      return;
    }
    await page.getByRole('button', { name: '직접 확인해서 반영', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: '설정 직접 확인' });
    await expect(dialog.getByRole('note')).toContainText('뒤 회차를 분석 중이라면 해당 분석이 중단');
    await dialog.getByLabel('설정값', { exact: true }).fill(scenario.value);
    await dialog.getByRole('button', { name: '확인한 값 저장' }).click();
    await expect.poll(() => updateBody).toEqual({ attributeName: 'profile.eye_color', attributeValue: scenario.value });
    await expect(page.getByText('확인한 값을 저장했습니다.', { exact: false })).toBeVisible();
    await expect(confirm).toBeEnabled();
    await expect(page.getByRole('button', { name: '다시 비교', exact: true })).toHaveCount(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBeTruthy();
    await confirm.click();
    await expect.poll(() => confirmBody).toEqual({ batchId, candidates: [{ candidateId,
      applicationMode: 'APPLY_PROPOSAL', baseSnapshotVersion: null, applyEditedValue: true }] });
    expect(comparisonRequests).toBe(0);
  });
}

for (const { status, width } of [
  { status: 'FAILED', width: 1280 },
  { status: 'RECOMPARISON_REQUIRED', width: 1280 },
  { status: 'FAILED', width: 320 },
]) {
  test(`자동 분석 세계관 ${status} 후보는 직접 저장한 반영안으로만 확정한다 (${width}px)`, async ({ page }) => {
    await page.setViewportSize({ width, height: 800 });
    let candidate: Record<string, unknown> = {
      id: candidateId, workId, sourceEpisodeNo: 11, category: 'RACE', subjectName: '설인',
      settingName: '서식지', extractedValue: '북부 설원', evidenceSpans: [{ quote: '설인은 북부 설원에서 산다.' }],
      comparisonStatus: status, reviewStatus: 'PENDING_REVIEW', manualReviewAvailable: true,
      userModified: false, analysisMode: 'ORDERED_PROVISIONAL', consolidationStatus: 'SINGLE',
    };
    let draftBody: unknown;
    let confirmBody: unknown;
    let comparisonRequests = 0;
    const listPath = `/api/v1/works/${workId}/world-setting-candidates`;
    await page.route('**/api/v1/**', route => {
      const request = route.request();
      const pathname = new URL(request.url()).pathname;
      if (pathname.endsWith('/auth/me')) return success(route, member);
      if (pathname.endsWith('/recompare')) comparisonRequests += 1;
      if (pathname === `${listPath}/decisions` && request.method() === 'PATCH') {
        draftBody = request.postDataJSON();
        const decision = (draftBody as { candidates: Record<string, unknown>[] }).candidates[0];
        candidate = { ...candidate, userModified: true, finalOperation: decision.operation,
          finalCategory: decision.category, finalSubjectName: decision.subjectName,
          finalScopeName: decision.scopeName, finalSettingName: decision.settingName, finalValue: decision.value };
        return success(route, { groupKey: 'RACE|설인', candidates: [candidate] });
      }
      if (pathname === `${listPath}/group-confirm`) {
        confirmBody = request.postDataJSON();
        candidate = { ...candidate, reviewStatus: 'CONFIRMED', manualReviewAvailable: false };
        return success(route, { candidates: [candidate] });
      }
      if (pathname === listPath) {
        const pending = candidate.reviewStatus === 'PENDING_REVIEW';
        return success(route, { batchId, episodeStartNo: 11, episodeEndNo: 11, episodeCount: 1,
          totalCandidateCount: 1, reviewedCandidateCount: pending ? 0 : 1, pendingCandidateCount: pending ? 1 : 0,
          pendingComparisonCount: 0, processingComparisonCount: 0, failedComparisonCount: pending ? 1 : 0,
          activeComparisonJobCount: 0, groups: pageOf(pending ? [{ groupKey: 'RACE|설인', category: 'RACE',
            subjectName: '설인', changeCount: 1, status, candidates: [candidate], evidenceEpisodeNos: [11] }] : []) });
      }
      if (pathname.endsWith('/setting-candidates')) return success(route, { batchId, totalCandidateCount: 0,
        reviewedCandidateCount: 0, pendingCandidateCount: 0, matchRequiredCandidateCount: 0, groups: pageOf([]) });
      return success(route, []);
    });
    await authenticate(page);
    await page.goto(`/setting-review?workId=${workId}&batchId=${batchId}&candidateType=world&group=${encodeURIComponent('RACE|설인')}`);
    const confirm = page.getByRole('button', { name: '모두 확정', exact: true });
    await expect(confirm).toBeDisabled();
    await expect(page.getByRole('button', { name: '다시 비교', exact: true })).toHaveCount(0);
    await page.getByRole('button', { name: '직접 확인해서 반영', exact: true }).click();
    const dialog = page.locator('.review-modal');
    await dialog.getByLabel('반영 방식').selectOption('ADD');
    await dialog.getByRole('button', { name: '수정안 적용', exact: true }).click();
    await expect.poll(() => draftBody).toEqual({ batchId, candidates: [{ candidateId,
      operation: 'ADD', category: 'RACE', subjectName: '설인', settingName: '서식지', value: '북부 설원' }] });
    await expect(page.getByText('직접 확인한 내용을 저장했습니다.', { exact: false })).toBeVisible();
    expect(candidate.comparisonStatus).toBe(status);
    await expect(confirm).toBeEnabled();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBeTruthy();
    await confirm.click();
    await expect.poll(() => confirmBody).toEqual(draftBody);
    expect(comparisonRequests).toBe(0);
  });
}
