import { expect, test, type Page, type Route } from '@playwright/test';
import type { SettingCandidateResponse, WorldSettingCandidateResponse } from '../src/app/api/generated/types.gen';
import publicPayload from './fixtures/pr1-conflict-policy-public.json' with { type: 'json' };

const workId = '11111111-1111-4111-8111-111111111111';
const batchId = '22222222-2222-4222-8222-222222222222';
const bookId = '33333333-3333-4333-8333-333333333333';
const revisionId = '44444444-4444-4444-8444-444444444444';
const jobId = '55555555-5555-4555-8555-555555555555';
const characterId = '66666666-6666-4666-8666-666666666666';
const worldId = '77777777-7777-4777-8777-777777777777';
const firstId = '88888888-8888-4888-8888-888888888888';
const secondId = '99999999-9999-4999-8999-999999999999';
const thirdId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const fourthId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const originalStamp = '2026-10-07T01:00:00';
const savedStamp = '2026-10-07T01:01:00';
const source = { sourceKind: 'SETTING_BOOK' as const, settingBookId: bookId,
  settingBookName: '항목형 설정집.txt', revisionId, revisionNo: 1, referenceTimeKind: 'WORK_START' as const };
const pageOf = (content: unknown[]) => ({ content, page: 0, size: 20, totalPages: content.length ? 1 : 0,
  totalElements: content.length, hasNext: false });
const ok = (route: Route, data: unknown) => route.fulfill({ status: 200, contentType: 'application/json',
  body: JSON.stringify({ success: true, data }) });
type Call = { method: string; path: string; scope: string | null; body: Record<string, unknown> };

async function setup(page: Page, { stale = false, superseded = false, future = false, missingVersion = false, retargeted = false, staleWorldComparison = false, bookDiscovery = false, bookRemove = false, bookRemoveEditedCurrent = false,
  publicCharacterCase, publicWorldCase, compatibleFixture = false }: { stale?: boolean; superseded?: boolean; future?: boolean; missingVersion?: boolean;
  retargeted?: boolean; staleWorldComparison?: boolean; bookDiscovery?: boolean; bookRemove?: boolean; bookRemoveEditedCurrent?: boolean; publicCharacterCase?: 'conflict' | 'merge'; publicWorldCase?: 'conflict' | 'uncertainty'; compatibleFixture?: boolean } = {}) {
  const calls: Call[] = [];
  let rejectOnce = stale || superseded;
  let latestRevisionId = revisionId;
  let characters: SettingCandidateResponse[] = [firstId, secondId, thirdId].map((id, index) => ({
    id, workId, analysisJobId: jobId, source, candidateKind: 'SETTING', entityType: 'CHARACTER',
    entityName: '한서린', rawEntityMention: '한서린', matchedCharacterId: characterId, matchStatus: 'MATCHED',
    attributeName: ['profile.occupation', 'profile.height', 'profile.affiliation'][index],
    attributeValue: ['기록관', '168cm', '서고'][index], valueType: 'STRING',
    valueValidation: { status: 'VALID', repairable: false }, attributeNameEditable: false,
    reviewStatus: 'PENDING_REVIEW', comparisonStatus: 'COMPLETED', suggestedOperation: index === 1 ? 'ADD' : 'UPDATE',
    temporalScope: future && index === 0 ? 'HYPOTHETICAL' : 'PRESENT',
    analysisMode: 'ORDERED_PROVISIONAL', automaticApplicationPending: false,
    manualReviewAvailable: index !== 1, userModified: false,
    automaticReviewHoldReason: index === 0 ? future ? 'SETTING_TIME_CONFIRMATION_REQUIRED' : 'HUMAN_CURRENT_SETTING_PROTECTED'
      : index === 2 ? 'SETTING_TIME_CONFIRMATION_REQUIRED' : undefined,
    reviewedApplicationMode: null, updatedAt: originalStamp, comparisonBaseSnapshotVersion: 2,
    currentSnapshotVersion: missingVersion ? null : 7, applyToCurrentAvailable: !missingVersion && index !== 1 && !(future && index === 0),
    proposedFactValue: ['기록관', '168cm', '서고'][index],
    snapshotChanges: index === 1 ? [] : [{ action: 'UPSERT', factType: 'PROFILE', factKey: index === 0 ? 'occupation' : 'affiliation',
      beforeFactValue: index === 0 ? '작가가 정한 직업' : '작가가 정한 소속', proposedFactValue: index === 0 ? '기록관' : '서고' }],
  }));
  let worlds: WorldSettingCandidateResponse[] = [firstId, secondId].map((id, index) => ({
    id, workId, analysisJobId: jobId, source, targetWorldSettingId: worldId, targetSubjectName: '고대 왕국',
    category: 'LOCATION', subjectName: '고대 왕국', settingName: index === 0 ? '기후' : '문자',
    extractedValue: index === 0 ? '춥다' : '상형문자', proposedValue: index === 0 ? '춥다' : '상형문자',
    proposedSettingName: index === 0 ? '기후' : '문자', matchedPropertyName: index === 0 ? '기후' : undefined,
    beforeValue: index === 0 ? staleWorldComparison ? '비교 때의 온화한 기후' : '작가가 정한 온화한 기후' : undefined,
    suggestedOperation: index === 0 ? 'UPDATE' : 'ADD', consolidationStatus: 'SINGLE',
    reviewStatus: 'PENDING_REVIEW', comparisonStatus: 'COMPLETED', analysisMode: 'ORDERED_PROVISIONAL',
    sourceAnalysisJobStatus: 'SUCCEEDED', sourceAnalysisJournalStatus: 'SEALED', automaticApplicationPending: false,
    manualReviewAvailable: index === 0, userModified: false,
    temporalScope: future && index === 0 ? 'HYPOTHETICAL' : 'PRESENT',
    automaticReviewHoldReason: index === 0 ? future ? 'SETTING_TIME_CONFIRMATION_REQUIRED' : 'HUMAN_CURRENT_SETTING_PROTECTED' : undefined,
    updatedAt: originalStamp, baseWorldSettingVersion: 1, currentWorldSettingVersion: missingVersion ? null : staleWorldComparison ? 10 : 9,
    applyToCurrentAvailable: !missingVersion && index === 0 && !future,
  }));
  if (bookRemove) characters = [{ ...characters[0], attributeName: 'status.wound', attributeDisplayName: '부상',
    attributeValue: '부상이 회복되어 멀쩡히 착지함', proposedFactValue: '부상이 회복되어 멀쩡히 착지함',
    suggestedOperation: 'REMOVE', applyToCurrentAvailable: false, manualReviewAvailable: true,
    snapshotChanges: [{ action: 'REMOVE', factType: 'STATUS', factKey: 'wound', beforeFactValue: '복부에 깊은 자상을 입은 상태' }] }];
  if (bookRemoveEditedCurrent) characters = [{ ...characters[0], userModified: true,
    reviewedApplicationMode: 'APPLY_PROPOSAL', updatedAt: savedStamp }];
  if (bookDiscovery) characters = [{ ...characters[0], candidateKind: 'CHARACTER_DISCOVERY',
    attributeName: null, attributeValue: null, comparisonStatus: 'NOT_REQUIRED', suggestedOperation: null,
    proposedFactValue: null, snapshotChanges: [], automaticReviewHoldReason: null,
    applyToCurrentAvailable: false, manualReviewAvailable: true, reviewedApplicationMode: 'APPLY_PROPOSAL' }];
  if (retargeted) worlds = [{ ...worlds[0], userModified: true, finalOperation: 'ADD', finalCategory: 'LOCATION',
    finalSubjectName: '새 고대 왕국', finalSettingName: '기후', finalValue: '춥다', automaticReviewHoldReason: undefined }];
  // Captured Java HTTP payloads: only routing IDs are normalized to this fixture.
  if (publicCharacterCase) characters = (publicCharacterCase === 'conflict'
    ? [publicPayload.character.first, publicPayload.character.conflict] : [publicPayload.characterMerge.merge])
    .map((candidate, index) => ({ ...candidate, id: index === 0 ? firstId : secondId, workId,
      analysisJobId: jobId, matchedCharacterId: characterId, source: { ...candidate.source, settingBookId: bookId, revisionId } }) as SettingCandidateResponse);
  if (publicWorldCase) {
    const candidate = publicWorldCase === 'conflict' ? publicPayload.worldConflict : publicPayload.worldUncertainty;
    worlds = [{ ...candidate, id: firstId, workId, analysisJobId: jobId, targetWorldSettingId: worldId,
      source: { ...candidate.source, settingBookId: bookId, revisionId } } as WorldSettingCandidateResponse];
  }
  // Separate API-mock UI fixture; food/job values are not Java-captured policy evidence.
  if (compatibleFixture) characters.push(...[
    { id: thirdId, key: 'favorite_food', label: '좋아하는 음식', value: '빵' },
    { id: fourthId, key: 'occupation', label: '직업', value: '기록관' },
  ].map(item => ({ ...characters[0], id: item.id, attributeName: `profile.${item.key}`, attributeDisplayName: item.label,
    attributeValue: item.value, valueType: 'STRING' as const, valueJson: { value: item.value },
    proposedFactValue: item.value, proposedValueJson: { value: item.value }, snapshotChanges: [],
    comparisonTargetFactKey: item.key, resolvedAttributeName: item.key, reviewStatus: 'CONFIRMED' as const,
    suggestedOperation: 'ADD' as const, manualReviewAvailable: false, automaticReviewHoldReason: null,
    evidenceSpans: [{ quote: item.value }] })));
  const characterName = characters[0].entityName;
  const totalCharacters = characters.length;
  const totalWorlds = worlds.length;
  const job = { id: jobId, workId, batchId, source, status: 'SUCCEEDED', jobType: 'SETTING_EXTRACTION',
    automaticAppliedAt: savedStamp, analysisRun: { mode: 'ORDERED_PROVISIONAL', journalStatus: 'SEALED' } };
  await page.addInitScript(() => localStorage.setItem('accessToken', 'synthetic-book-current-review'));
  await page.route('**/api/v1/**', async route => {
    const req = route.request(); const url = new URL(req.url()); const path = url.pathname;
    if (req.method() !== 'GET') calls.push({ method: req.method(), path, scope: url.searchParams.get('sourceAnalysisJobId'),
      body: req.postData() ? req.postDataJSON() : {} });
    if (path.endsWith('/auth/me')) return ok(route, { id: 1, email: 'book-current@example.test', displayName: '검토 테스트', role: 'AUTHOR', status: 'ACTIVE' });
    if (path.includes('/analysis-jobs/')) return ok(route, job);
    if (path.endsWith(`/setting-books/${bookId}`)) return ok(route, { id: bookId, workId, batchId,
      revisionId: latestRevisionId, latestAnalysisJob: latestRevisionId === revisionId ? job : { ...job, id: thirdId } });
    if (path === `/api/v1/works/${workId}`) return ok(route, { id: workId, title: '공개 응답 화면 검증', lifecycleStatus: 'ACTIVE' });
    if (path.endsWith('/characters')) return ok(route, pageOf([{ id: characterId, name: characterName }]));
    if (path.includes('/characters/')) return ok(route, publicCharacterCase
      ? { ...(publicCharacterCase === 'merge' ? publicPayload.characterMerge.currentDetail : publicPayload.character.currentDetail), id: characterId }
      : { id: characterId, name: characterName, profile: [], stats: [], skills: [], items: [], statuses: [] });
    if (path.endsWith('/world-settings')) return ok(route, { worldSettings: pageOf([{ id: worldId, category: 'LOCATION', subjectName: '고대 왕국' }]) });
    if (path.endsWith(`/world-settings/${worldId}`)) return ok(route, { id: worldId, category: 'LOCATION', subjectName: '고대 왕국', properties: [] });
    if (path.includes('/setting-candidates/') && req.method() === 'PATCH') {
      const id = path.split('/').at(-1); const body = req.postDataJSON();
      characters = characters.map(candidate => candidate.id !== id ? candidate : { ...candidate, ...body,
        userModified: true, reviewedApplicationMode: body.reviewedApplicationMode ?? 'APPLY_PROPOSAL',
        updatedAt: savedStamp, comparisonStatus: 'NOT_REQUIRED', automaticReviewHoldReason: undefined,
        applyToCurrentAvailable: !missingVersion && !bookRemove });
      return ok(route, characters.find(candidate => candidate.id === id));
    }
    if (path.endsWith('/world-setting-candidates/decisions')) {
      const decisions = req.postDataJSON().candidates;
      worlds = worlds.map(candidate => {
        const decision = decisions.find((item: { candidateId: string }) => item.candidateId === candidate.id);
        return decision ? { ...candidate, userModified: true, finalOperation: decision.operation,
          finalCategory: decision.category, finalSubjectName: decision.subjectName, finalScopeName: decision.scopeName,
          finalSettingName: decision.settingName, finalValue: decision.value, updatedAt: savedStamp,
          automaticReviewHoldReason: undefined,
          applyToCurrentAvailable: !missingVersion } : candidate;
      });
      return ok(route, { groupKey: 'LOCATION|고대 왕국', candidates: worlds });
    }
    if (path.endsWith('/group-confirm') || path.endsWith('/confirm-group')) {
      const world = path.includes('/world-setting-candidates/');
      if (rejectOnce) {
        rejectOnce = false;
        if (superseded) latestRevisionId = thirdId;
        characters = characters.map(candidate => ({ ...candidate, currentSnapshotVersion: 8 }));
        worlds = worlds.map(candidate => ({ ...candidate, currentWorldSettingVersion: 10 }));
        return route.fulfill({ status: 409, contentType: 'application/json', body: JSON.stringify({ success: false,
          message: '현재 설정이 바뀌었습니다. 선택한 내용을 다시 확인해 주세요.',
          error: { status: 409, code: superseded ? 'ANALYSIS_RUN_STATE_CONFLICT'
            : world ? 'WORLD_SETTING_VERSION_CONFLICT' : 'SETTING_CANDIDATE_COMPARISON_STALE' } }) });
      }
      if (world) worlds = worlds.map(candidate => ({ ...candidate, reviewStatus: 'CONFIRMED' }));
      else characters = characters.map(candidate => ({ ...candidate, reviewStatus: 'CONFIRMED',
        historyOnly: candidate.reviewedApplicationMode === 'HISTORY_ONLY' }));
      return ok(route, { candidates: [] });
    }
    if (path.endsWith('/setting-candidates') || path.endsWith('/world-setting-candidates')) {
      const world = path.endsWith('/world-setting-candidates'); const allCandidates = world ? worlds : characters;
      const reviewStatus = url.searchParams.get('reviewStatus');
      const candidates = allCandidates.filter(candidate => !reviewStatus || candidate.reviewStatus === reviewStatus);
      const subjectName = retargeted ? '새 고대 왕국' : worlds[0]?.subjectName ?? '고대 왕국';
      const category = worlds[0]?.category ?? 'LOCATION';
      const pendingCount = allCandidates.filter(candidate => candidate.reviewStatus === 'PENDING_REVIEW').length;
      const groups = candidates.length ? [world ? { groupKey: `${category}|${subjectName}`, category, subjectName,
        changeCount: candidates.length, status: 'READY', candidates } : { groupKey: '한서린', entityName: '한서린',
        candidateCount: candidates.length, pendingCandidateCount: candidates.length, candidates }] : [];
      if (!world && groups.length) Object.assign(groups[0], { groupKey: characterName, entityName: characterName });
      return ok(route, { batchId, source, totalCandidateCount: world ? totalWorlds : totalCharacters, pendingCandidateCount: pendingCount,
        confirmedCandidateCount: allCandidates.length - pendingCount, dismissedCandidateCount: 0,
        directReviewCandidateCount: pendingCount, processingCandidateCount: 0, groups: pageOf(groups) });
    }
    return ok(route, []);
  });
  return { calls };
}

const reviewUrl = (type: 'character' | 'world') => `/setting-review?workId=${workId}&batchId=${batchId}&sourceAnalysisJobId=${jobId}&settingBookId=${bookId}&candidateType=${type}`;
const characterCard = (page: Page, name: string) => page.getByRole('region', { name: `${name} 설정 후보`, exact: true });
const worldCard = (page: Page, id = firstId) => page.locator(`.world-setting-diff-row[data-candidate-id="${id}"]`);

test('실제 held MERGE의 before 168을 비교 당시 내용으로 표시하고 현재 유지값으로 단정하지 않는다', async ({ page }) => {
  const fixture = await setup(page, { publicCharacterCase: 'merge' });
  await page.goto(reviewUrl('character'));
  const row = characterCard(page, 'height');
  const before = row.locator('.review-cb-comparison__column.is-before');
  await expect(before).toContainText('비교 당시 내용');
  await expect(before).toContainText('168');
  const history = row.getByRole('button', { name: /이력에만 저장/ });
  await expect(history).toContainText('현재 설정을 바꾸지 않습니다.');
  await expect(history).not.toContainText('현재 설정 유지 · 168');
  await history.click();
  await expect(history).toHaveAttribute('aria-pressed', 'true');
  await expect(before).toContainText('비교 당시 내용');
  await expect(before).not.toContainText('유지되는 현재 설정');
  await expect(row.locator('.review-cb-comparison__column.is-after')).toContainText('이력에 남길 내용');
  expect(fixture.calls.find(call => call.method === 'PATCH')?.body.reviewedApplicationMode).toBe('HISTORY_ONLY');
  await page.goto(`/dashboard?workId=${workId}&nav=settingDB&tab=characters&modal=char-detail&charId=${characterId}`);
  await expect(page.getByRole('dialog')).toContainText('검정');
  await expect(page.getByRole('dialog')).not.toContainText('height');
  await expect(page.getByRole('dialog')).not.toContainText('168');
});

test('기존 height가 없는 실제 168·178 후보는 모두 미처리로 남고 원문 값을 보존한다', async ({ page }) => {
  const fixture = await setup(page, { publicCharacterCase: 'conflict' });
  await page.goto(reviewUrl('character'));
  const rows = characterCard(page, 'height');
  await expect(rows).toHaveCount(2);
  await expect(rows.nth(0).locator('.review-cb-heading')).toContainText('확인 필요');
  await expect(rows.nth(1).locator('.review-cb-heading')).toContainText('확인 필요');
  await expect(rows.nth(0).locator('.review-cb-inline-value')).toContainText('168');
  await expect(rows.nth(1).locator('.review-cb-inline-value')).toContainText('178');
  await expect(rows.locator('.review-cb-comparison__column.is-before')).toHaveCount(0);
  await expect(page.getByRole('button', { name: '2개 설정 모두 확정', exact: true })).toBeDisabled();
  expect(fixture.calls).toHaveLength(0);
  await page.goto(`/dashboard?workId=${workId}&nav=settingDB&tab=characters&modal=char-detail&charId=${characterId}`);
  await expect(page.getByRole('dialog')).toContainText('검정');
  await expect(page.getByRole('dialog')).not.toContainText('height');
});

test('별도 API 목의 음식·직업 확정 행은 height 검토와 분리해 처리 이력에서 복원한다', async ({ page }) => {
  await setup(page, { publicCharacterCase: 'conflict', compatibleFixture: true });
  await page.goto(reviewUrl('character'));
  await expect(characterCard(page, 'height')).toHaveCount(2);
  await expect(characterCard(page, '좋아하는 음식')).toHaveCount(0);
  await expect(characterCard(page, '직업')).toHaveCount(0);
  await page.getByRole('group', { name: '검토 상태' }).getByRole('button', { name: '전체', exact: true }).click();
  for (const name of ['좋아하는 음식', '직업']) {
    const row = characterCard(page, name);
    await expect(row.locator('.review-cb-heading')).toContainText('반영됨');
    await expect(row.getByRole('button', { name: /현재 설정에 반영|이력에만 저장/ })).toHaveCount(0);
  }
  await expect(characterCard(page, '좋아하는 음식')).toContainText('빵');
  await expect(characterCard(page, '직업')).toContainText('기록관');
  await page.reload();
  await expect(characterCard(page, 'height')).toHaveCount(2);
  await expect(characterCard(page, '직업')).toBeVisible();
});

for (const publicWorldCase of ['conflict', 'uncertainty'] as const) test(`실제 세계관 ${publicWorldCase} 응답은 GENERAL 사유와 충돌 상태를 구분한다`, async ({ page }) => {
  await setup(page, { publicWorldCase });
  await page.goto(reviewUrl('world'));
  const row = worldCard(page);
  await expect(row.locator('.review-cb-heading')).toContainText(publicWorldCase === 'conflict' ? '내용 확인 필요' : '대상·내용 확인 필요');
  await expect(row.locator('.review-cb-comparison__column.is-before').first()).toContainText('서식지');
  await expect(row.locator('.review-cb-comparison__column.is-before').first()).toContainText('북부');
  await expect(row.locator('.review-cb-comparison__column.is-after').first()).toContainText(publicWorldCase === 'conflict' ? '북부 / 남부' : '남부');
  await expect(page.getByRole('button', { name: '모두 확정', exact: true })).toBeDisabled();
});

test('실제 168·178 후보의 수동 CURRENT·HISTORY 확정 뒤 필터와 탭을 복원한다', async ({ page }) => {
  const fixture = await setup(page, { publicCharacterCase: 'conflict' });
  await page.goto(reviewUrl('character'));
  const rows = characterCard(page, 'height');
  await rows.nth(0).getByRole('button', { name: /현재 설정에 반영/ }).click();
  await expect(rows.nth(0).getByRole('button', { name: /현재 설정에 반영/ })).toHaveAttribute('aria-pressed', 'true');
  await rows.nth(1).getByRole('button', { name: /이력에만 저장/ }).click();
  await expect(rows.nth(1).getByRole('button', { name: /이력에만 저장/ })).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: '2개 설정 모두 확정', exact: true }).click();
  await expect(rows).toHaveCount(0);
  const confirmation = fixture.calls.find(call => call.path.endsWith('/group-confirm'))!;
  expect(confirmation.scope).toBe(jobId);
  expect(confirmation.body.candidates).toMatchObject([
    { candidateId: firstId, applicationMode: 'APPLY_PROPOSAL', applyToCurrent: true, baseSnapshotVersion: 1 },
    { candidateId: secondId, applicationMode: 'HISTORY_ONLY' },
  ]);
  const filter = page.getByRole('group', { name: '검토 상태' });
  await filter.getByRole('button', { name: '전체', exact: true }).click();
  await expect(rows).toHaveCount(2);
  await expect(rows.nth(0).locator('.review-cb-heading')).toContainText('반영됨');
  await expect(rows.nth(1)).toContainText('현재 설정은 유지하고, 이 설정집의 이력에 저장했습니다.');
  await page.getByRole('navigation', { name: '설정 후보 종류' }).getByRole('button', { name: /세계관 후보/ }).click();
  await page.getByRole('navigation', { name: '설정 후보 종류' }).getByRole('button', { name: /캐릭터 후보/ }).click();
  await expect(page).toHaveURL(/reviewStatus=ALL/);
  await page.reload();
  await expect(rows).toHaveCount(2);
  await expect(rows.nth(0).getByRole('button', { name: /현재 설정에 반영/ })).toHaveCount(0);
  await expect(rows.nth(1).getByRole('button', { name: /이력에만 저장/ })).toHaveCount(0);
});

test('현재 반영이 허용되지 않은 설정집 REMOVE도 이력 선택으로 확정하며 현재 권한을 보내지 않는다', async ({ page }) => {
  const fixture = await setup(page, { bookRemove: true });
  await page.goto(reviewUrl('character'));
  const row = characterCard(page, '부상');
  await expect(row).toContainText('복부에 깊은 자상을 입은 상태');
  await expect(row).toContainText('부상이 회복되어 멀쩡히 착지함');
  await expect(row.getByRole('button', { name: /현재 설정에 반영/ })).toHaveCount(0);
  await row.getByRole('button', { name: /이력에만 저장/ }).click();
  const confirm = page.getByRole('button', { name: '1개 설정 모두 확정', exact: true });
  await expect(confirm).toBeEnabled();
  await confirm.click();
  await expect.poll(() => fixture.calls.some(call => call.path.endsWith('/group-confirm'))).toBe(true);
  const confirmation = fixture.calls.find(call => call.path.endsWith('/group-confirm'))!;
  expect(confirmation.scope).toBe(jobId);
  const decisions = confirmation.body.candidates as Record<string, unknown>[];
  expect(decisions).toMatchObject([{ candidateId: firstId, applicationMode: 'HISTORY_ONLY' }]);
  expect(decisions[0].applyToCurrent).toBeUndefined();
  expect(decisions[0].baseSnapshotVersion).toBe(2);
  expect(fixture.calls.find(call => call.method === 'PATCH')?.body.reviewedApplicationMode).toBe('HISTORY_ONLY');
});

test('이전에 현재로 저장한 설정집 REMOVE는 편집창에서도 이력을 명시적으로 다시 저장해야 확정한다', async ({ page }) => {
  const fixture = await setup(page, { bookRemove: true, bookRemoveEditedCurrent: true });
  await page.goto(reviewUrl('character'));
  const row = characterCard(page, '부상');
  const confirm = page.getByRole('button', { name: '1개 설정 모두 확정', exact: true });
  await expect(confirm).toBeDisabled();
  await expect(row.getByRole('button', { name: /이력에만 저장/ })).toHaveAttribute('aria-pressed', 'false');
  await row.getByRole('button', { name: '수정', exact: true }).click();
  const editor = page.getByRole('dialog');
  await expect(editor.getByRole('button', { name: /현재 설정에 반영/ })).toHaveCount(0);
  await expect(editor.getByRole('button', { name: /이력에만 저장/ })).toHaveAttribute('aria-pressed', 'false');
  await editor.getByRole('button', { name: '취소', exact: true }).click();
  await expect(confirm).toBeDisabled();
  expect(fixture.calls).toHaveLength(0);
  await row.getByRole('button', { name: '수정', exact: true }).click();
  await expect(editor.getByRole('button', { name: /이력에만 저장/ })).toHaveAttribute('aria-pressed', 'false');
  await editor.getByRole('button', { name: /이력에만 저장/ }).click();
  await editor.getByRole('button', { name: '확인한 값 저장', exact: true }).click();
  await expect(editor).toHaveCount(0);
  const saved = fixture.calls.find(call => call.method === 'PATCH')!;
  expect(saved.scope).toBe(jobId);
  expect(saved.body).toMatchObject({ reviewedApplicationMode: 'HISTORY_ONLY', expectedUpdatedAt: savedStamp });
  expect(saved.body.applyToCurrent).toBeUndefined();
  await expect(confirm).toBeEnabled();
  await confirm.click();
  await expect.poll(() => fixture.calls.some(call => call.path.endsWith('/group-confirm'))).toBe(true);
  const decisions = fixture.calls.find(call => call.path.endsWith('/group-confirm'))!.body.candidates as Record<string, unknown>[];
  expect(decisions).toMatchObject([{ candidateId: firstId, applicationMode: 'HISTORY_ONLY', baseSnapshotVersion: 2, applyEditedValue: true }]);
  expect(decisions[0].applyToCurrent).toBeUndefined();
});

test('설정집의 기존 인물 등장 후보는 없는 현재 반영 선택 없이 연결을 확정한다', async ({ page }) => {
  const fixture = await setup(page, { bookDiscovery: true });
  await page.goto(reviewUrl('character'));
  const row = characterCard(page, '인물 연결');
  await expect(row.getByText('연결된 인물', { exact: true })).toBeVisible();
  await expect(row.getByRole('button', { name: /현재 설정에 반영/ })).toHaveCount(0);
  await expect(row.getByRole('button', { name: /이력에만 저장/ })).toHaveCount(0);
  const confirm = page.getByRole('button', { name: '1개 설정 모두 확정', exact: true });
  await expect(confirm).toBeEnabled();
  await confirm.click();
  await expect.poll(() => fixture.calls.some(call => call.path.endsWith('/group-confirm'))).toBe(true);
  const confirmation = fixture.calls.find(call => call.path.endsWith('/group-confirm'))!;
  expect(confirmation.scope).toBe(jobId);
  const decisions = confirmation.body.candidates as Record<string, unknown>[];
  expect(decisions).toMatchObject([{ candidateId: firstId, applicationMode: 'APPLY_PROPOSAL' }]);
  expect(decisions[0].applyToCurrent).toBeUndefined();
  expect(decisions[0].baseSnapshotVersion).toBe(2);
  expect(fixture.calls.some(call => call.path.endsWith('/recompare'))).toBe(false);
});

test('설정집 캐릭터의 명시 현재 선택만 실제 버전으로 확정하고 새 항목·이력 선택에는 전파하지 않는다', async ({ page }) => {
  const fixture = await setup(page);
  await page.goto(reviewUrl('character'));
  const occupation = characterCard(page, '직업');
  await occupation.getByRole('button', { name: /현재 설정에 반영/ }).click();
  await expect(occupation.getByRole('button', { name: /현재 설정에 반영/ })).toHaveAttribute('aria-pressed', 'true');
  await characterCard(page, '소속').getByRole('button', { name: /이력에만 저장/ }).click();
  await page.getByRole('button', { name: '3개 설정 모두 확정', exact: true }).click();
  await expect.poll(() => fixture.calls.filter(call => call.path.endsWith('/group-confirm')).length).toBe(1);
  const confirmation = fixture.calls.find(call => call.path.endsWith('/group-confirm'))!;
  expect(confirmation.scope).toBe(jobId);
  expect(confirmation.body.candidates).toMatchObject([
    { candidateId: firstId, applicationMode: 'APPLY_PROPOSAL', applyToCurrent: true,
      baseSnapshotVersion: 7, expectedUpdatedAt: savedStamp, applyEditedValue: true },
    { candidateId: secondId, applicationMode: 'APPLY_PROPOSAL' },
    { candidateId: thirdId, applicationMode: 'HISTORY_ONLY', applyEditedValue: true },
  ]);
  const decisions = confirmation.body.candidates as Record<string, unknown>[];
  expect(decisions.slice(1).some(decision => decision.applyToCurrent === true)).toBe(false);
  expect(fixture.calls.filter(call => call.method === 'PATCH').every(call => !('applyToCurrent' in call.body))).toBe(true);
});

test('설정집 세계관의 선택 경로만 실제 현재 버전·후보 시각으로 반영하고 같은 그룹 새 항목은 일반 확정한다', async ({ page }) => {
  const fixture = await setup(page);
  await page.goto(reviewUrl('world'));
  await worldCard(page).getByRole('button', { name: /현재 설정에 반영/ }).click();
  await page.getByRole('button', { name: '모두 확정', exact: true }).click();
  await expect.poll(() => fixture.calls.filter(call => call.path.endsWith('/world-setting-candidates/group-confirm')).length).toBe(1);
  const confirmation = fixture.calls.find(call => call.path.endsWith('/world-setting-candidates/group-confirm'))!;
  expect(confirmation.scope).toBe(jobId);
  expect(confirmation.body.candidates).toMatchObject([
    { candidateId: firstId, operation: 'UPDATE', settingName: '기후', value: '춥다', applyToCurrent: true,
      expectedWorldSettingVersion: 9, expectedUpdatedAt: originalStamp },
    { candidateId: secondId, operation: 'ADD', settingName: '문자', value: '상형문자' },
  ]);
  expect((confirmation.body.candidates as Record<string, unknown>[])[1].applyToCurrent).not.toBe(true);
  expect(fixture.calls.some(call => call.path.endsWith('/decisions'))).toBe(false);
});

async function chooseCurrent(page: Page, type: 'character' | 'world') {
  if (type === 'character') {
    const occupation = characterCard(page, '직업');
    await occupation.getByRole('button', { name: /현재 설정에 반영/ }).click();
    await expect(occupation.getByRole('button', { name: /현재 설정에 반영/ })).toHaveAttribute('aria-pressed', 'true');
    await characterCard(page, '소속').getByRole('button', { name: /이력에만 저장/ }).click();
    await expect(characterCard(page, '소속').getByRole('button', { name: /이력에만 저장/ })).toHaveAttribute('aria-pressed', 'true');
  } else await worldCard(page).getByRole('button', { name: /현재 설정에 반영/ }).click();
}

for (const type of ['character', 'world'] as const) test(`${type} 현재 버전 충돌은 선택을 풀고 제안을 보존하며 다시 고른 실제 버전을 보낸다`, async ({ page }) => {
  const fixture = await setup(page, { stale: true });
  await page.goto(reviewUrl(type));
  await chooseCurrent(page, type);
  const confirm = page.getByRole('button', { name: type === 'character' ? '3개 설정 모두 확정' : '모두 확정', exact: true });
  await confirm.click();
  await expect(page.getByRole('alert').filter({ hasText: '현재 설정이 바뀌었습니다.' }).first()).toBeVisible();
  const row = type === 'character' ? characterCard(page, '직업') : worldCard(page);
  const current = row.getByRole('button', { name: /현재 설정에 반영/ });
  await expect(current).toHaveAttribute('aria-pressed', 'false');
  await expect(confirm).toBeDisabled();
  await expect(row).toContainText(type === 'character' ? '기록관' : '춥다');
  await current.click();
  await expect(current).toHaveAttribute('aria-pressed', 'true');
  await confirm.click();
  const suffix = type === 'character' ? '/setting-candidates/group-confirm' : '/world-setting-candidates/group-confirm';
  await expect.poll(() => fixture.calls.filter(call => call.path.endsWith(suffix)).length).toBe(2);
  const decisions = fixture.calls.filter(call => call.path.endsWith(suffix))[1].body.candidates as Record<string, unknown>[];
  expect(decisions[0]).toMatchObject(type === 'character'
    ? { applyToCurrent: true, baseSnapshotVersion: 8, expectedUpdatedAt: savedStamp }
    : { applyToCurrent: true, expectedWorldSettingVersion: 10, expectedUpdatedAt: originalStamp });
  expect(decisions.slice(1).some(decision => decision.applyToCurrent === true)).toBe(false);
});

for (const type of ['character', 'world'] as const) test(`${type} 선택 뒤 설정집 리비전이 바뀌면 이전 제안을 보존하고 추가 제출을 잠근다`, async ({ page }) => {
  const fixture = await setup(page, { superseded: true });
  await page.goto(reviewUrl(type));
  await chooseCurrent(page, type);
  const confirm = page.getByRole('button', { name: type === 'character' ? '3개 설정 모두 확정' : '모두 확정', exact: true });
  await confirm.click();
  await expect(page.getByTestId('book-review-source-state')).toContainText('이전 분석 기록');
  await expect(confirm).toBeDisabled();
  const row = type === 'character' ? characterCard(page, '직업') : worldCard(page);
  await expect(row.getByRole('button', { name: /현재 설정에 반영/ })).toBeDisabled();
  await expect(row).toContainText(type === 'character' ? '기록관' : '춥다');
  expect(fixture.calls.filter(call => call.path.endsWith('/group-confirm'))).toHaveLength(1);
  expect(fixture.calls.every(call => call.scope === jobId)).toBe(true);
});

test('캐릭터 미래 제안은 현재 결정 초안 저장 후에만 명시 현재 확정에 연결하고 초안은 현재값을 바꾸지 않는다', async ({ page }) => {
  const fixture = await setup(page, { future: true });
  await page.goto(reviewUrl('character'));
  const occupation = characterCard(page, '직업');
  await expect(occupation).toContainText('설정 시점을 확인해 주세요');
  await chooseCurrent(page, 'character');
  const saved = fixture.calls.find(call => call.method === 'PATCH' && call.path.endsWith(firstId))!;
  expect(saved.body).toMatchObject({ attributeValue: '기록관', reviewedApplicationMode: 'APPLY_PROPOSAL', expectedUpdatedAt: originalStamp });
  expect(saved.body.applyToCurrent).toBeUndefined();
  expect(fixture.calls.some(call => call.method === 'POST')).toBe(false);
  await page.getByRole('button', { name: '3개 설정 모두 확정', exact: true }).click();
  await expect.poll(() => fixture.calls.some(call => call.path.endsWith('/group-confirm'))).toBe(true);
  expect((fixture.calls.find(call => call.path.endsWith('/group-confirm'))!.body.candidates as Record<string, unknown>[])[0])
    .toMatchObject({ applyToCurrent: true, baseSnapshotVersion: 7, expectedUpdatedAt: savedStamp, applyEditedValue: true });
});

test('세계관 미래 제안은 현재 반영을 먼저 열지 않고 저장된 작가 결정 후에만 현재 선택을 제공한다', async ({ page }) => {
  const fixture = await setup(page, { future: true });
  await page.goto(reviewUrl('world'));
  const row = worldCard(page);
  await expect(row).toContainText('설정 시점을 확인해 주세요');
  await expect(row.getByRole('button', { name: /현재 설정에 반영/ })).toHaveCount(0);
  await row.getByRole('button', { name: /이번 내용으로 바꾸기/ }).click();
  await expect(row.getByRole('button', { name: /현재 설정에 반영/ })).toBeVisible();
  await expect(row.getByRole('button', { name: /이력에만 저장/ })).toHaveCount(0);
  await expect(row.getByRole('button', { name: /검토한 내용 확정/ })).toBeVisible();
  const draft = fixture.calls.find(call => call.path.endsWith('/decisions'))!.body.candidates as Record<string, unknown>[];
  expect(draft[0]).toMatchObject({ candidateId: firstId, operation: 'UPDATE', settingName: '기후', value: '춥다' });
  expect(draft[0].applyToCurrent).toBeUndefined();
  expect(draft[0].expectedWorldSettingVersion).toBeUndefined();
  await row.getByRole('button', { name: /현재 설정에 반영/ }).click();
  await page.getByRole('button', { name: '모두 확정', exact: true }).click();
  await expect.poll(() => fixture.calls.some(call => call.path.endsWith('/group-confirm'))).toBe(true);
  expect((fixture.calls.find(call => call.path.endsWith('/group-confirm'))!.body.candidates as Record<string, unknown>[])[0])
    .toMatchObject({ applyToCurrent: true, expectedWorldSettingVersion: 9, expectedUpdatedAt: savedStamp });
});

test('현재 버전이 바뀐 설정집 세계관의 과거 비교값을 현재 유지값으로 약속하지 않는다', async ({ page }) => {
  const fixture = await setup(page, { staleWorldComparison: true });
  await page.goto(reviewUrl('world'));
  const row = worldCard(page);
  const before = row.locator('.review-cb-comparison__column.is-before');
  await expect(before).toContainText('비교 당시 내용');
  await expect(before).toContainText('비교 때의 온화한 기후');
  const history = row.getByRole('button', { name: /이력에만 저장/ });
  await expect(history).toContainText('현재 설정을 바꾸지 않습니다.');
  await expect(history).not.toContainText('현재 설정 유지 · 비교 때의 온화한 기후');
  await history.click();
  await expect(history).toHaveAttribute('aria-pressed', 'true');
  await expect(before).toContainText('비교 당시 내용');
  await expect(before).not.toContainText('유지되는 기존 설정');
  await page.getByRole('button', { name: '모두 확정', exact: true }).click();
  await expect.poll(() => fixture.calls.some(call => call.path.endsWith('/group-confirm'))).toBe(true);
  const confirmation = fixture.calls.find(call => call.path.endsWith('/group-confirm'))!;
  expect(confirmation.scope).toBe(jobId);
  for (const decision of confirmation.body.candidates as Record<string, unknown>[]) {
    expect(decision.applyToCurrent).toBeUndefined();
    expect(decision.expectedWorldSettingVersion).toBeUndefined();
    expect(decision.expectedUpdatedAt).toBeUndefined();
  }
});

test('설정집 세계관 인라인 편집도 과거 비교값을 현재 저장값이라고 표시하지 않는다', async ({ page }) => {
  const fixture = await setup(page, { staleWorldComparison: true });
  await page.goto(reviewUrl('world'));
  const row = worldCard(page);
  await row.getByRole('button', { name: '최종 내용 직접 다듬기', exact: true }).click();
  const editor = row.locator('.review-cb-inline-editor');
  const before = editor.locator('.review-cb-comparison__column.is-before');
  await expect(before).toContainText('비교 당시 내용');
  await expect(before).toContainText('비교 때의 온화한 기후');
  await expect(before).not.toContainText('현재 저장된 내용');
  await expect(editor.getByRole('textbox', { name: '최종 내용', exact: true })).toHaveValue('춥다');
  expect(fixture.calls).toHaveLength(0);
  await editor.getByRole('button', { name: '이 내용으로 검토 완료', exact: true }).click();
  await expect.poll(() => fixture.calls.some(call => call.path.endsWith('/decisions'))).toBe(true);
  const saved = fixture.calls.find(call => call.path.endsWith('/decisions'))!;
  expect(saved.scope).toBe(jobId);
  expect(saved.body).toMatchObject({ batchId, candidates: [{ candidateId: firstId, operation: 'UPDATE',
    category: 'LOCATION', subjectName: '고대 왕국', settingName: '기후', value: '춥다' }] });
  expect((saved.body.candidates as Record<string, unknown>[])[0].applyToCurrent).toBeUndefined();
  expect(fixture.calls.some(call => call.path.endsWith('/group-confirm'))).toBe(false);
});

test('세계관 이력 선택은 현재 반영 권한과 버전 파라미터를 보내지 않는다', async ({ page }) => {
  const fixture = await setup(page);
  await page.goto(reviewUrl('world'));
  await worldCard(page).getByRole('button', { name: /이력에만 저장/ }).click();
  await page.getByRole('button', { name: '모두 확정', exact: true }).click();
  await expect.poll(() => fixture.calls.some(call => call.path.endsWith('/group-confirm'))).toBe(true);
  const decisions = fixture.calls.find(call => call.path.endsWith('/group-confirm'))!.body.candidates as Record<string, unknown>[];
  for (const decision of decisions) {
    expect(decision.applyToCurrent).toBeUndefined();
    expect(decision.expectedWorldSettingVersion).toBeUndefined();
    expect(decision.expectedUpdatedAt).toBeUndefined();
  }
});

test('세계관 저장 후 보류 사유가 사라진 기본 확정은 이력이라고 약속하지 않으며 현재 override도 보내지 않는다', async ({ page }) => {
  const fixture = await setup(page);
  await page.goto(reviewUrl('world'));
  const row = worldCard(page);
  await row.getByRole('button', { name: /이번 내용으로 바꾸기/ }).click();
  await expect(row.getByRole('button', { name: /이력에만 저장/ })).toHaveCount(0);
  await row.getByRole('button', { name: /검토한 내용 확정/ }).click();
  await page.getByRole('button', { name: '모두 확정', exact: true }).click();
  await expect.poll(() => fixture.calls.some(call => call.path.endsWith('/group-confirm'))).toBe(true);
  expect((fixture.calls.find(call => call.path.endsWith('/group-confirm'))!.body.candidates as Record<string, unknown>[])[0].applyToCurrent).toBeUndefined();
});

test('세계관 실제 현재 버전이 없으면 override 선택과 가짜 version 0을 만들지 않는다', async ({ page }) => {
  const fixture = await setup(page, { missingVersion: true });
  await page.goto(reviewUrl('world'));
  const row = worldCard(page);
  await expect(row.getByRole('button', { name: /현재 설정에 반영/ })).toHaveCount(0);
  await row.getByRole('button', { name: /이번 내용으로 바꾸기/ }).click();
  await expect(page.getByRole('button', { name: '모두 확정', exact: true })).toBeEnabled();
  await page.getByRole('button', { name: '모두 확정', exact: true }).click();
  await expect.poll(() => fixture.calls.some(call => call.path.endsWith('/group-confirm'))).toBe(true);
  const decisions = fixture.calls.find(call => call.path.endsWith('/group-confirm'))!.body.candidates as Record<string, unknown>[];
  expect(decisions.some(decision => decision.applyToCurrent === true || decision.expectedWorldSettingVersion === 0)).toBe(false);
});

test('세계관 초안을 새 대상으로 바꾸면 이전 비교 대상의 현재값 버전을 사용하지 않고 일반 확정한다', async ({ page }) => {
  const fixture = await setup(page, { retargeted: true });
  await page.goto(reviewUrl('world'));
  await expect(worldCard(page).getByRole('button', { name: /현재 설정에 반영/ })).toHaveCount(0);
  await page.getByRole('button', { name: '모두 확정', exact: true }).click();
  await expect.poll(() => fixture.calls.some(call => call.path.endsWith('/group-confirm'))).toBe(true);
  const decision = (fixture.calls.find(call => call.path.endsWith('/group-confirm'))!.body.candidates as Record<string, unknown>[])[0];
  expect(decision).toMatchObject({ candidateId: firstId, operation: 'ADD', subjectName: '새 고대 왕국' });
  expect(decision.applyToCurrent).toBeUndefined();
  expect(decision.expectedWorldSettingVersion).toBeUndefined();
});
