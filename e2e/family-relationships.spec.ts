import { expect, test, type BrowserContext, type Page, type Route } from '@playwright/test';
import type { RelationshipCandidateResponse, RelationshipResponse } from '../src/app/api/generated/types.gen';

test.skip(process.env.VITE_RELATIONSHIP_WORKSPACE_ENABLED !== 'true', '관계도 미리보기 전용 테스트입니다. VITE_RELATIONSHIP_WORKSPACE_ENABLED=true로 별도 실행합니다.');

const workId = '11111111-1111-4111-8111-111111111111';
const subjectId = '22222222-2222-4222-8222-222222222222';
const targetId = '33333333-3333-4333-8333-333333333333';
const candidateId = '44444444-4444-4444-8444-444444444444';
const relationId = '55555555-5555-4555-8555-555555555555';
const factId = '66666666-6666-4666-8666-666666666666';
const prefix = `/api/v1/works/${workId}`;
const settings = `/dashboard?workId=${workId}&nav=settingDB&tab=characters`;
const legacyWorkspace = `/dashboard?workId=${workId}&nav=settingDB&tab=relations`;
const workspace = `/dashboard?workId=${workId}&nav=graph`;
const editor = `${workspace}&relationView=review&relationshipCandidate=${candidateId}`;
const oldToken = 'a'.repeat(64);
const newToken = 'b'.repeat(64);

function success(route: Route, data: unknown) {
  return route.fulfill({ contentType: 'application/json', body: JSON.stringify({ success: true, data, error: null }) });
}
function failure(route: Route, status: number, message: string, code = 'RELATIONSHIP_STALE_SOURCE') {
  return route.fulfill({ status, contentType: 'application/json', body: JSON.stringify({ success: false, data: null, message, error: { code, status, details: [] } }) });
}
function paginated<T>(content: T[], total = content.length, page = 0, size = 20) {
  return { content, totalElements: total, totalPages: Math.ceil(total / size), page, size, hasNext: (page + 1) * size < total };
}
async function setup(context: BrowserContext) {
  let sourceToken = oldToken;
  let sourceText = '도윤의 아버지는 현우이다.';
  let candidate: RelationshipCandidateResponse = {
    id: candidateId, version: 0, status: 'PENDING', subjectCharacterId: subjectId, subjectCharacterName: '도윤',
    objectMention: '현우', kind: 'CHILD_OF', subtype: 'BIOLOGICAL', temporalScope: 'CURRENT', assertion: 'UNCERTAIN',
    reviewReasons: ['AMBIGUOUS_TARGET', 'UNCERTAIN'], origin: 'CURRENT_SETTING_RULE', automaticallyConfirmed: false,
    evidence: [{ sourceFactId: factId, characterId: subjectId, sourceToken: oldToken, current: true, hasEvidence: true,
      currentValue: { factValue: sourceText }, factKey: 'profile.family', manuallyEdited: false }],
  };
  let relation: RelationshipResponse = {
    id: relationId, version: 1, subjectCharacterId: targetId, subjectCharacterName: '현우', objectCharacterId: subjectId,
    objectCharacterName: '도윤', kind: 'PARENT_OF', subtype: 'BIOLOGICAL', temporalScope: 'CURRENT',
    validity: 'VALID', visibleInFamilyTree: true, evidence: candidate.evidence,
  };
  let precedingRelations: RelationshipResponse[] = [];
  let precedingCandidates: RelationshipCandidateResponse[] = [];
  let relationAvailable = true;
  let state = 'SUCCEEDED';
  let inputVersion = 1;
  let failSave = 0;
  let failDismiss = 0;
  let failSources = 0;
  let failProcessing = 0;
  let failCandidateReads = false;
  let originalReads = 0;
  let charactersPage = 0;
  const calls = { saves: [] as Array<Record<string, unknown>>, confirms: 0, dismisses: 0, processing: 0, analyses: 0, withdraws: 0, refreshes: 0 };
  const expired = new Set<string>();
  const held = new Map<string, { started: () => void; gate: Promise<void>; skip: number }>();
  const requestKey = (method: string, suffix: string) => `${method} ${suffix.startsWith('/api/v1/') ? suffix : `${prefix}/${suffix}`}`;
  await context.addInitScript(() => { localStorage.setItem('accessToken', 'synthetic-family-token'); localStorage.removeItem('catchhole_demo_mode'); });
  await context.route('**/api/v1/**', async route => {
    const req = route.request(); const url = new URL(req.url()); const path = url.pathname;
    const candidateAtRequest = candidate;
    const candidateReadFailed = failCandidateReads;
    const key = `${req.method()} ${path}`;
    if (expired.delete(key)) return failure(route, 401, '토큰을 갱신해 주세요.', 'AUTH_UNAUTHORIZED');
    const waiting = held.get(key);
    if (waiting && waiting.skip-- <= 0) { held.delete(key); waiting.started(); await waiting.gate; }
    if (path.endsWith('/auth/refresh')) { calls.refreshes++; return success(route, { accessToken: `rotated-family-token-${calls.refreshes}` }); }
    if (path.endsWith('/auth/me')) return success(route, { id: 1, email: 'family@example.test', role: 'AUTHOR', status: 'ACTIVE', displayName: '관계 검토' });
    if (path === '/api/v1/works') return success(route, [{ id: workId, title: '가족 관계 검증', genre: '판타지', episodeCount: 0 }]);
    if (path === prefix) return success(route, { id: workId, title: '가족 관계 검증', lifecycleStatus: 'ACTIVE' });
    if (path.endsWith('/analysis-jobs') && req.method() !== 'GET') { calls.analyses++; return failure(route, 500, '분석 요청은 허용하지 않음'); }
    if (path === `${prefix}/relationship-processing`) {
      if (req.method() === 'POST') {
        calls.processing++;
        if (failProcessing-- > 0) return failure(route, 503, '관계 정리 요청 결과를 확인하지 못했어요.', 'COMMON_ERROR');
        state = 'PENDING';
      }
      return success(route, { state, inputVersion, processedVersion: state === 'PENDING' ? 0 : inputVersion,
        autoConfirmedCount: 1, reviewRequiredCount: 9, unsupportedSourceCount: 0, lastProcessedAt: '2026-10-17T12:00:00',
        retryAt: state === 'FAILED' ? '2026-10-17T13:00:00' : null });
    }
    if (path === `${prefix}/relationships`) {
      const page = Number(url.searchParams.get('page') ?? 0);
      const size = Number(url.searchParams.get('size') ?? 20);
      const rows = [...precedingRelations, ...(relationAvailable ? [relation] : [])];
      return success(route, paginated(rows.slice(page * size, (page + 1) * size), rows.length, page, size));
    }
    if (path === `${prefix}/relationships/${relationId}`) return success(route, relation);
    if (path === `${prefix}/relationships/${relationId}/withdraw`) {
      expect(req.postDataJSON().expectedVersion).toBe(relation.version);
      calls.withdraws++; relation = { ...relation, version: relation.version! + 1, validity: 'WITHDRAWN', visibleInFamilyTree: false };
      return success(route, relation);
    }
    if (path === `${prefix}/relationship-candidates`) {
      expect(url.searchParams.get('status')).toBe('PENDING');
      const page = Number(url.searchParams.get('page') ?? 0);
      const size = Number(url.searchParams.get('size') ?? 20);
      const rows = [...precedingCandidates, ...(candidate.status === 'PENDING' ? [candidate] : [])];
      return success(route, paginated(rows.slice(page * size, (page + 1) * size), rows.length, page, size));
    }
    if (path === `${prefix}/relationship-candidates/${candidateId}`) {
      if (req.method() === 'GET') {
        if (candidateReadFailed) return failure(route, 503, '후속 후보 조회가 지연되고 있어요.', 'COMMON_ERROR');
        return success(route, candidateAtRequest);
      }
      if (req.method() === 'PUT') {
        const body = req.postDataJSON() as Record<string, unknown>; calls.saves.push(body);
        if (failSave-- > 0) return failure(route, 503, '일시적으로 저장하지 못했어요.', 'COMMON_ERROR');
        if (body.expectedVersion !== candidate.version) return failure(route, 409, '다른 창에서 후보를 수정했어요.', 'RELATIONSHIP_STALE_VERSION');
        if ((body.evidence as Array<{sourceToken: string}>).some(source => source.sourceToken !== sourceToken)) return failure(route, 409, '현재 설정이 바뀌었어요. 근거를 다시 확인해 주세요.');
        candidate = { ...candidate, ...body, version: candidate.version! + 1, objectCharacterName: body.objectCharacterId === targetId ? '현우' : undefined,
          evidence: [{ ...candidate.evidence![0], sourceToken, current: true, currentValue: { factValue: sourceText } }],
          reviewReasons: body.objectCharacterId && body.assertion === 'ASSERTED' ? [] : ['UNCERTAIN'] };
      }
      return success(route, candidate);
    }
    if (path === `${prefix}/relationship-candidates/${candidateId}/confirm`) {
      calls.confirms++; expect(req.postDataJSON().expectedVersion).toBe(candidate.version);
      relationAvailable = true;
      candidate = { ...candidate, status: 'CONFIRMED', version: candidate.version! + 1, confirmedRelationshipId: relationId };
      return success(route, candidate);
    }
    if (path === `${prefix}/relationship-candidates/${candidateId}/dismiss`) {
      calls.dismisses++;
      if (failDismiss-- > 0) return failure(route, 503, '제외 요청을 완료하지 못했어요.', 'COMMON_ERROR');
      candidate = { ...candidate, status: 'DISMISSED', version: candidate.version! + 1 };
      return success(route, candidate);
    }
    if (path === `${prefix}/relationship-sources`) {
      if (failSources-- > 0) return failure(route, 503, '현재 프로필을 불러오지 못했어요.', 'COMMON_ERROR');
      return success(route, url.searchParams.get('characterId') === subjectId ? [{ factId, characterId: subjectId, factKey: 'profile.family',
        contextToken: sourceToken, currentValue: { factValue: sourceText }, hasEvidence: true }] : []);
    }
    if (path === `${prefix}/characters`) {
      charactersPage = Number(url.searchParams.get('page'));
      return success(route, paginated(charactersPage === 0 ? [{ id: '77777777-7777-4777-8777-777777777777', name: '현우', representativeAttributeValue: '경비병' }]
        : [{ id: targetId, name: '현우', representativeAttributeValue: '도윤의 아버지' }], 13, charactersPage, 12));
    }
    if (path.includes(`/character-facts/${factId}/evidence`)) {
      originalReads++;
      return success(route, { content: '도윤은 아버지 현우의 손을 잡았다.', evidenceSpans: [{ quote: '아버지 현우', paragraphIndex: 0 }],
        episode: { episodeNo: 1, title: '가족' } });
    }
    return success(route, []);
  });
  return { calls,
    expireNext(method: string, suffix: string) { expired.add(requestKey(method, suffix)); },
    holdNext(method: string, suffix: string, skip = 0) {
      let release!: () => void;
      let started!: () => void;
      const gate = new Promise<void>(resolve => { release = resolve; });
      const received = new Promise<void>(resolve => { started = resolve; });
      held.set(requestKey(method, suffix), { started, gate, skip });
      return { release, received };
    },
    sourceChanged() { sourceToken = newToken; sourceText = '도윤의 친아버지는 현우이다.'; },
    conflictingValues() { candidate = { ...candidate, reviewReasons: ['CURRENT_VALUE_CONFLICT', 'UNSUPPORTED_STRUCTURED_CONTEXT'], evidence: [{ ...candidate.evidence![0], currentValue: { factValue: '아버지: 현우', valueJson: { value: '아버지: 준서', name: '추정 가족관계', certainty: '확인되지 않은 소문' } } }] }; },
    sourceInvalidated() { inputVersion++; candidate = { ...candidate, reviewReasons: ['SOURCE_CHANGED'], evidence: [{ ...candidate.evidence![0], current: false, currentValue: undefined }] }; },
    otherChanged() { candidate = { ...candidate, version: candidate.version! + 1 }; },
    ready() { candidate = { ...candidate, objectCharacterId: targetId, objectCharacterName: '현우', assertion: 'ASSERTED', reviewReasons: [] }; },
    held() { candidate = { ...candidate, objectCharacterId: targetId, objectCharacterName: '현우', assertion: 'ASSERTED', reviewReasons: ['PREVIOUSLY_WITHDRAWN'] }; },
    sourceRemoved() { relation = { ...relation, validity: 'REVIEW_REQUIRED', evidence: [{ ...relation.evidence![0], current: false, currentValue: undefined }] }; },
    waitForRelationshipConfirmation() { relationAvailable = false; },
    failProcessing() { failProcessing = 1; },
    failCandidateReads(value: boolean) { failCandidateReads = value; },
    offPageRelationship() {
      precedingRelations = Array.from({ length: 20 }, (_, index) => ({ ...relation,
        id: `80000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`,
        subjectCharacterId: `81000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`,
        objectCharacterId: `82000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`,
        subjectCharacterName: `목록 부모 ${index + 1}`, objectCharacterName: `목록 자녀 ${index + 1}`,
      }));
      relation = { ...relation, version: 7, subtype: 'ADOPTIVE', temporalScope: 'HISTORICAL', timeLabel: '10년 전',
        validity: 'ARCHIVED_ENDPOINT', visibleInFamilyTree: false };
    },
    pendingSecondPage() {
      precedingCandidates = Array.from({ length: 20 }, (_, index) => ({ ...candidate,
        id: `90000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`,
        objectMention: `남은 상대 ${index + 1}`,
      }));
    },
    processingState(next: 'NEVER_PROCESSED' | 'PENDING' | 'SUCCEEDED' | 'FAILED') { state = next; },
    failed() { state = 'FAILED'; }, failSave() { failSave = 1; }, failDismiss() { failDismiss = 1; }, failSources() { failSources = 1; },
    originalReads: () => originalReads, charactersPage: () => charactersPage };
}

test('자동 반영 목록·별도 대기 개수·이전 원문 근거·철회', async ({ page, context }, testInfo) => {
  const fixture = await setup(context); fixture.sourceRemoved();
  await page.goto(workspace);
  await expect(page.getByRole('button', { name: '확인 필요 1', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: '현재 설정에서 관계 찾기', exact: true })).toHaveCount(0);
  await expect(page.getByText('현재 설정 확인 필요', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: '관계 근거 보기' }).click();
  await expect(page.getByText('이전 설정 근거', { exact: true })).toBeVisible();
  expect(fixture.originalReads()).toBe(0);
  const contrast = await page.getByText('현재 설정 확인 필요', { exact: true }).evaluate(element => {
    const luminance = (color: string) => {
      const values = (color.match(/[\d.]+/g) ?? []).slice(0, 3).map(Number).map(value => { const n = value / 255; return n <= .04045 ? n / 12.92 : ((n + .055) / 1.055) ** 2.4; });
      return .2126 * values[0] + .7152 * values[1] + .0722 * values[2];
    };
    const front = luminance(getComputedStyle(element).color); const back = luminance(getComputedStyle(element).backgroundColor);
    return (Math.max(front, back) + .05) / (Math.min(front, back) + .05);
  });
  expect(contrast).toBeGreaterThanOrEqual(4.5);
  await page.screenshot({ path: testInfo.outputPath('family-relationships-desktop.png'), fullPage: true });
  await page.getByRole('button', { name: '원문 근거 1' }).click();
  await expect(page.getByRole('dialog')).toContainText('아버지 현우');
  expect(fixture.originalReads()).toBe(1);
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: '잘못된 관계 철회' }).click();
  expect(fixture.calls.withdraws).toBe(0);
  await page.getByRole('button', { name: '관계 철회', exact: true }).click();
  await expect(page.getByText('철회된 관계', { exact: true })).toBeVisible();
  expect(fixture.calls.analyses).toBe(0);
});

test('모호한 상대는 페이지로 직접 선택하고 수정 저장 뒤 확정한다', async ({ page, context }) => {
  const fixture = await setup(context);
  await page.goto(editor);
  await expect(page.getByRole('button', { name: '관계에 반영' })).toBeDisabled();
  await page.getByRole('button', { name: '상대 인물 선택' }).click();
  await page.getByRole('button', { name: '다음 페이지' }).click();
  await page.getByRole('button', { name: '현우 도윤의 아버지', exact: true }).click();
  expect(fixture.charactersPage()).toBe(1);
  await page.getByLabel('서술의 의미').selectOption('ASSERTED');
  await page.getByLabel('관계 시점').selectOption('HISTORICAL');
  await page.getByLabel('시점 설명').fill('10년 전');
  await expect(page.getByRole('button', { name: '관계에 반영' })).toBeDisabled();
  expect(fixture.calls.confirms).toBe(0);
  await page.getByRole('button', { name: '수정 저장' }).click();
  await expect(page.getByRole('button', { name: '관계에 반영' })).toBeEnabled();
  expect(fixture.calls.saves[0]).toMatchObject({ objectCharacterId: targetId, assertion: 'ASSERTED', temporalScope: 'HISTORICAL', timeLabel: '10년 전', expectedVersion: 0 });
  await page.getByRole('button', { name: '관계에 반영' }).click();
  await expect(page.getByText('확인이 필요한 가족 관계가 없어요.', { exact: true })).toBeVisible();
  expect(fixture.calls.confirms).toBe(1); expect(fixture.calls.analyses).toBe(0);
});

test('409 뒤 초안과 옛 근거를 보존하고 현재 내용을 명시적으로 다시 선택한다', async ({ page, context }) => {
  const fixture = await setup(context); fixture.ready();
  await page.goto(editor);
  await page.getByLabel('시점 설명').fill('가족 회의 이후');
  fixture.sourceChanged(); fixture.otherChanged();
  await page.getByRole('button', { name: '수정 저장' }).click();
  await expect(page.getByRole('alert')).toContainText('다른 창에서 후보를 수정했어요.');
  await expect(page.getByLabel('시점 설명')).toHaveValue('가족 회의 이후');
  fixture.failSources();
  await page.getByRole('button', { name: '현재 설정 다시 확인' }).click();
  await expect(page.getByRole('alert')).toContainText('일부 인물의 현재 프로필을 불러오지 못했어요.');
  await page.getByRole('button', { name: '현재 설정 다시 확인' }).click();
  await expect(page.getByLabel('시점 설명')).toHaveValue('가족 회의 이후');
  await expect(page.getByRole('checkbox')).not.toBeChecked();
  await page.getByRole('button', { name: '수정 저장' }).click();
  await expect(page.getByRole('alert')).toContainText('현재 설정이 바뀌었어요.');
  expect((fixture.calls.saves[1].evidence as Array<{sourceToken: string}>)[0].sourceToken).toBe(oldToken);
  await page.getByRole('checkbox').check();
  await page.getByRole('button', { name: '수정 저장' }).click();
  await expect(page.getByRole('button', { name: '관계에 반영' })).toBeEnabled();
  expect(fixture.calls.saves[2]).toMatchObject({ expectedVersion: 1, timeLabel: '가족 회의 이후', evidence: [{ sourceFactId: factId, sourceToken: newToken }] });
});

test('저장·제외 네트워크 실패 재시도와 처리 실패 재요청은 AI 분석을 만들지 않는다', async ({ page, context }) => {
  const fixture = await setup(context); fixture.failSave(); fixture.failDismiss(); fixture.failed();
  await page.goto(editor);
  await page.getByLabel('시점 설명').fill('재시도할 입력');
  await page.getByRole('button', { name: '수정 저장' }).click();
  await expect(page.getByRole('alert')).toContainText('일시적으로 저장하지 못했어요.');
  await expect(page.getByLabel('시점 설명')).toHaveValue('재시도할 입력');
  await page.getByRole('button', { name: '수정 저장' }).click();
  await expect(page.getByText('수정한 내용을 저장했어요.', { exact: false })).toBeVisible();
  await page.getByRole('button', { name: '후보 제외' }).click();
  await expect(page.getByRole('alert')).toContainText('제외 요청을 완료하지 못했어요.');
  await expect(page.getByLabel('시점 설명')).toHaveValue('재시도할 입력');
  await page.getByRole('button', { name: '후보 제외' }).click();
  await expect(page.getByText('확인이 필요한 가족 관계가 없어요.', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: '관계 정리 다시 시도' }).click();
  await expect(page.getByText('가족 관계를 정리하고 있어요.', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: '관계 정리 다시 시도', exact: true })).toHaveCount(0);
  expect(fixture.calls.processing).toBe(1); expect(fixture.calls.analyses).toBe(0);
});

test('320px 모바일 메뉴에서 관계도로 들어가 링크·새로고침·뒤로가기를 유지하고 가로 넘침이 없다', async ({ page, context }, testInfo) => {
  await setup(context); await page.setViewportSize({ width: 320, height: 740 });
  await page.goto(settings);
  await expect(page.getByRole('combobox', { name: '작품 설정', exact: true }).getByRole('option', { name: '가족 관계', exact: true })).toHaveCount(0);
  await expect(page.getByRole('combobox', { name: '작품 설정', exact: true }).getByRole('option', { name: '관계도 · 업데이트 예정', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: '메뉴 열기', exact: true }).click();
  const drawer = page.getByRole('dialog', { name: '워크스페이스 메뉴' });
  await drawer.getByRole('button', { name: '관계도', exact: true }).click();
  await expect(drawer).toHaveCount(0);
  await expect.poll(() => new URL(page.url()).searchParams.get('nav')).toBe('graph');
  await page.getByLabel('가족 관계 보기', { exact: true }).selectOption('review');
  await page.getByRole('button', { name: '도윤 · 현우 관계 확인' }).click();
  await expect(page.getByRole('heading', { name: '도윤의 가족 관계 확인' })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('heading', { name: '도윤의 가족 관계 확인' })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBeTruthy();
  await page.getByRole('button', { name: '후보 제외' }).scrollIntoViewIfNeeded();
  expect((await page.getByRole('button', { name: '후보 제외' }).boundingBox())!.height).toBeGreaterThanOrEqual(44);
  await page.getByRole('button', { name: '후보 제외' }).focus();
  await expect(page.getByRole('button', { name: '후보 제외' })).toBeFocused();
  await page.screenshot({ path: testInfo.outputPath('family-review-mobile-actions-320.png'), fullPage: true });
  await page.getByRole('heading', { name: '도윤의 가족 관계 확인' }).scrollIntoViewIfNeeded();
  await page.screenshot({ path: testInfo.outputPath('family-review-mobile-320.png'), fullPage: true });
  await page.getByRole('button', { name: '후보 목록', exact: true }).click();
  await page.goBack();
  await expect(page.getByRole('heading', { name: '도윤의 가족 관계 확인' })).toBeVisible();
});

 test('이전에 철회한 동일 내용은 명시 검토 저장 후 다시 확정하고 줄어든 페이지를 복구한다', async ({ page, context }) => {
  const fixture = await setup(context); fixture.held();
  await page.goto(`${editor}&relationPage=9`);
  await expect(page).toHaveURL(/relationPage=1/);
  await expect(page.getByRole('button', { name: '관계에 반영' })).toBeDisabled();
  await expect(page.getByText('이전에 철회한 관계예요.', { exact: false })).toBeVisible();
  await page.getByRole('button', { name: '검토 내용 저장' }).click();
  await expect(page.getByRole('button', { name: '관계에 반영' })).toBeEnabled();
  expect(fixture.calls.saves[0]).toMatchObject({ expectedVersion: 0, evidence: [{ sourceFactId: factId, sourceToken: oldToken }] });
});

test('처리 버전이 바뀌면 열린 후보의 근거 현재성을 갱신하되 편집 입력은 보존한다', async ({ page, context }) => {
  const fixture = await setup(context); fixture.ready();
  await page.clock.install();
  await page.goto(editor);
  await expect(page.getByRole('button', { name: '관계에 반영' })).toBeEnabled();
  fixture.sourceInvalidated();
  await page.clock.runFor(31000);
  await expect(page.getByText('이전 설정 근거', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: '관계에 반영' })).toBeDisabled();
  await page.getByLabel('시점 설명').fill('보존할 초안');
  await page.clock.runFor(31000);
  await expect(page.getByLabel('시점 설명')).toHaveValue('보존할 초안');
  await expect(page.getByRole('button', { name: '원문 근거 1' })).toBeEnabled();
});

test('서로 다른 현재 표시값·세부값과 추가 속성을 숨기지 않고 확인할 수 있다', async ({ page, context }) => {
  const fixture = await setup(context); fixture.ready(); fixture.conflictingValues();
  await page.goto(editor);
  await expect(page.getByText('표시된 설정', { exact: true })).toBeVisible();
  await expect(page.getByText('세부 설정', { exact: true })).toBeVisible();
  await expect(page.getByText('아버지: 현우', { exact: false })).toBeVisible();
  await expect(page.getByText('아버지: 준서', { exact: false })).toBeVisible();
  await page.getByText('설정의 추가 속성 확인', { exact: true }).click();
  await expect(page.getByText('확인되지 않은 소문', { exact: false })).toBeVisible();
  await expect(page.getByText('추정 가족관계', { exact: false })).toBeVisible();
  await expect(page.getByRole('button', { name: '관계에 반영' })).toBeDisabled();
});

test('정상 인증 갱신 뒤 현재 근거 조회·수정 저장·확정의 성공 결과를 반영한다', async ({ page, context }) => {
  const fixture = await setup(context); fixture.ready();
  await page.goto(editor);
  await page.getByLabel('시점 설명').fill('갱신 중에도 보존할 입력');
  fixture.sourceChanged();
  fixture.expireNext('GET', 'relationship-sources');
  await page.getByRole('button', { name: '현재 설정 다시 확인' }).click();
  await expect(page.getByRole('checkbox')).toBeVisible();
  await expect(page.getByRole('checkbox')).not.toBeChecked();
  await expect(page.getByLabel('시점 설명')).toHaveValue('갱신 중에도 보존할 입력');
  await page.getByRole('checkbox').check();
  fixture.expireNext('PUT', `relationship-candidates/${candidateId}`);
  await page.getByRole('button', { name: '수정 저장' }).click();
  await expect(page.getByRole('button', { name: '관계에 반영' })).toBeEnabled();
  expect(fixture.calls.saves[0]).toMatchObject({ expectedVersion: 0, timeLabel: '갱신 중에도 보존할 입력', evidence: [{ sourceFactId: factId, sourceToken: newToken }] });
  fixture.expireNext('POST', `relationship-candidates/${candidateId}/confirm`);
  await page.getByRole('button', { name: '관계에 반영' }).click();
  await expect(page.getByText('확인이 필요한 가족 관계가 없어요.', { exact: true })).toBeVisible();
  expect(fixture.calls.refreshes).toBe(3);
  expect(fixture.calls.confirms).toBe(1);
  expect(await page.evaluate(() => localStorage.getItem('accessToken'))).toBe('rotated-family-token-3');
});

for (const action of ['관계 정리', '철회', '제외'] as const) {
  test(`정상 인증 갱신 뒤 ${action} 성공 결과와 목록을 반영한다`, async ({ page, context }) => {
    const fixture = await setup(context);
    if (action === '관계 정리') fixture.failed();
    await page.goto(action === '제외' ? editor : workspace);
    if (action === '관계 정리') {
      fixture.expireNext('POST', 'relationship-processing');
      await page.getByRole('button', { name: '관계 정리 다시 시도' }).click();
      await expect(page.getByText('가족 관계를 정리하고 있어요.', { exact: true })).toBeVisible();
      expect(fixture.calls.processing).toBe(1);
    } else if (action === '철회') {
      await page.getByRole('button', { name: '관계 근거 보기' }).click();
      await page.getByRole('button', { name: '잘못된 관계 철회' }).click();
      fixture.expireNext('POST', `relationships/${relationId}/withdraw`);
      await page.getByRole('button', { name: '관계 철회', exact: true }).click();
      await expect(page.getByText('철회된 관계', { exact: true })).toBeVisible();
      expect(fixture.calls.withdraws).toBe(1);
    } else {
      fixture.expireNext('POST', `relationship-candidates/${candidateId}/dismiss`);
      await page.getByRole('button', { name: '후보 제외' }).click();
      await expect(page.getByText('확인이 필요한 가족 관계가 없어요.', { exact: true })).toBeVisible();
      expect(fixture.calls.dismisses).toBe(1);
    }
    expect(fixture.calls.refreshes).toBe(1);
    expect(fixture.calls.analyses).toBe(0);
  });
}

async function cachedProcessingState(page: Page) {
  return page.evaluate(async id => {
    const { queryClient } = await import('/src/app/lib/query-client.ts');
    const { getRelationshipProcessingQueryKey } = await import('/src/app/api/generated/@tanstack/react-query.gen.ts');
    return queryClient.getQueryData(getRelationshipProcessingQueryKey({ path: { workId: id } }))?.data?.state;
  }, workId);
}

for (const boundary of ['로그아웃 대기', '새 로그인 세션', '작품 화면 이탈', '다른 메뉴 이동'] as const) {
  test(`${boundary} 뒤 늦은 관계 정리 응답이 캐시와 화면을 복원하지 않는다`, async ({ page, context }) => {
    const fixture = await setup(context); fixture.failed();
    await page.goto(workspace);
    await expect(page.getByText('가족 관계 정리를 마치지 못했어요.', { exact: true })).toBeVisible();
    const waiting = fixture.holdNext('POST', 'relationship-processing');
    await page.getByRole('button', { name: '관계 정리 다시 시도' }).click();
    await waiting.received;
    const logout = boundary === '로그아웃 대기' ? fixture.holdNext('POST', '/api/v1/auth/logout') : null;
    if (logout) {
      await page.getByRole('button', { name: '사용자 메뉴 열기' }).click();
      await page.getByRole('menuitem', { name: '로그아웃' }).click();
      await logout.received;
      expect(await page.evaluate(() => localStorage.getItem('accessToken'))).toBeNull();
      expect(await cachedProcessingState(page)).toBeUndefined();
    } else if (boundary === '새 로그인 세션') {
      await page.evaluate(async () => {
        const { saveAuthToken } = await import('/src/app/lib/auth.ts');
        const { queryClient } = await import('/src/app/lib/query-client.ts');
        // 같은 사용자여도 새 로그인은 이전 요청을 이어받지 않는다.
        saveAuthToken({ success: true, data: { accessToken: 'synthetic-family-token' } });
        queryClient.clear();
      });
      expect(await cachedProcessingState(page)).toBeUndefined();
    } else if (boundary === '작품 화면 이탈') {
      await page.getByRole('button', { name: '작품 선택으로 이동' }).click();
      await expect(page).toHaveURL(/\/works$/);
    } else {
      await page.getByRole('button', { name: '작품 설정', exact: true }).click();
      await expect.poll(() => new URL(page.url()).searchParams.get('nav')).toBe('settingDB');
      await expect(page.getByRole('heading', { name: '캐릭터 설정', exact: true })).toBeVisible();
    }
    const completed = page.waitForResponse(response => new URL(response.url()).pathname === `${prefix}/relationship-processing` && response.request().method() === 'POST');
    waiting.release();
    await completed;
    await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
    expect(await cachedProcessingState(page)).toBe(boundary === '작품 화면 이탈' || boundary === '다른 메뉴 이동' ? 'FAILED' : undefined);
    await expect(page.getByText('가족 관계를 정리하고 있어요.', { exact: true })).toHaveCount(0);
    if (logout) { logout.release(); await expect(page).toHaveURL(/\/landing$/); }
  });
}

test('처리 상태가 같아도 다른 창의 후보 수정을 감지하고 초안·근거를 보존한 채 재검토한다', async ({ page, context }) => {
  const fixture = await setup(context); fixture.ready();
  await page.clock.install();
  await page.goto(editor);
  await page.getByLabel('시점 설명').fill('이 창에서 작성한 초안');
  const other = await context.newPage();
  await other.goto(editor);
  await other.getByLabel('시점 설명').fill('다른 창에서 저장한 값');
  await other.getByRole('button', { name: '수정 저장' }).click();
  await expect(other.getByText('수정한 내용을 저장했어요.', { exact: false })).toBeVisible();
  await page.bringToFront();
  await page.clock.runFor(6000);
  await expect(page.getByRole('alert')).toContainText('다른 곳에서 이 후보가 변경되었어요.');
  await expect(page.getByLabel('시점 설명')).toHaveValue('이 창에서 작성한 초안');
  await expect(page.getByRole('button', { name: '수정 저장' })).toBeDisabled();
  await expect(page.getByRole('button', { name: '관계에 반영' })).toBeDisabled();
  await expect(page.getByRole('button', { name: '후보 제외' })).toBeDisabled();
  expect(fixture.calls.processing).toBe(0);
  await page.getByRole('button', { name: '현재 설정 다시 확인' }).click();
  await expect(page.getByLabel('시점 설명')).toHaveValue('이 창에서 작성한 초안');
  await expect(page.getByRole('checkbox')).toBeChecked();
  await page.getByRole('button', { name: '수정 저장' }).click();
  await expect(page.getByRole('button', { name: '관계에 반영' })).toBeEnabled();
  expect(fixture.calls.saves[1]).toMatchObject({ expectedVersion: 1, timeLabel: '이 창에서 작성한 초안', evidence: [{ sourceFactId: factId, sourceToken: oldToken }] });
  await other.close();
});

test('처리 상태가 같아도 다른 창의 후보 확정을 감지해 중복 결정을 잠근다', async ({ page, context }) => {
  const fixture = await setup(context); fixture.ready();
  await page.clock.install();
  await page.goto(editor);
  await expect(page.getByRole('button', { name: '관계에 반영' })).toBeEnabled();
  const other = await context.newPage();
  await other.goto(editor);
  await other.getByRole('button', { name: '관계에 반영' }).click();
  await expect(other.getByText('확인이 필요한 가족 관계가 없어요.', { exact: true })).toBeVisible();
  await page.bringToFront();
  await page.clock.runFor(6000);
  await expect(page.getByRole('alert')).toContainText('다른 곳에서 이 후보가 변경되었어요.');
  await expect(page.getByRole('button', { name: '관계에 반영' })).toBeDisabled();
  await page.getByRole('button', { name: '현재 설정 다시 확인' }).click();
  await expect(page.getByText('이미 반영된 후보예요.', { exact: false })).toBeVisible();
  expect(fixture.calls.confirms).toBe(1);
  expect(fixture.calls.processing).toBe(0);
  await other.close();
});

test('숨겨진 창은 후보 주기 조회를 멈추고 돌아오면 즉시 외부 변경을 확인한다', async ({ page, context }) => {
  const fixture = await setup(context); fixture.ready();
  await page.clock.install();
  await page.goto(editor);
  await page.getByLabel('시점 설명').fill('창 복귀 후에도 남을 초안');
  await page.evaluate(() => {
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' });
    window.dispatchEvent(new Event('visibilitychange'));
  });
  fixture.otherChanged();
  await page.clock.runFor(6000);
  await expect(page.getByRole('alert')).toHaveCount(0);
  const refetched = page.waitForResponse(response => new URL(response.url()).pathname === `${prefix}/relationship-candidates/${candidateId}`, { timeout: 1500 });
  await page.evaluate(() => {
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'visible' });
    window.dispatchEvent(new Event('visibilitychange'));
  });
  await refetched;
  await expect(page.getByRole('alert')).toContainText('다른 곳에서 이 후보가 변경되었어요.');
  await expect(page.getByLabel('시점 설명')).toHaveValue('창 복귀 후에도 남을 초안');
  await expect(page.getByRole('button', { name: '수정 저장' })).toBeDisabled();
});

test('작품 설정의 가족 탭 대신 사이드바 관계도에서 현재 관계와 후보를 연다', async ({ page, context }) => {
  await setup(context);
  await page.goto(settings);
  await expect(page.getByRole('heading', { name: '캐릭터 설정', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: '가족 관계', exact: true })).toHaveCount(0);
  await expect(page.locator('.dashboard-tabs').getByRole('button', { name: /^관계도/ })).toHaveCount(0);
  const navigation = page.getByRole('button', { name: '관계도', exact: true });
  await expect(navigation).toBeVisible();
  await expect(navigation).not.toContainText('업데이트 예정');
  await navigation.click();
  await expect.poll(() => new URL(page.url()).searchParams.get('nav')).toBe('graph');
  expect(new URL(page.url()).searchParams.has('tab')).toBeFalsy();
  await expect(navigation).toHaveClass(/is-active/);
  await expect(page.getByRole('button', { name: '가족 관계 목록', exact: true })).toBeVisible();
  await page.getByRole('button', { name: '확인 필요 1', exact: true }).click();
  await page.getByRole('button', { name: '도윤 · 현우 관계 확인', exact: true }).click();
  await expect(page.getByRole('heading', { name: '도윤의 가족 관계 확인', exact: true })).toBeVisible();
  expect(new URL(page.url()).searchParams.get('relationshipCandidate')).toBe(candidateId);
});

for (const selection of ['후보', '관계'] as const) {
  test(`기존 가족 관계 링크의 ${selection}·페이지·원문 선택을 관계도로 옮기고 이전 기록을 대체한다`, async ({ page, context }) => {
    await setup(context);
    await page.goto('/works');
    await expect(page.getByRole('button', { name: '사용자 메뉴 열기' })).toBeVisible();
    const selected = selection === '후보'
      ? `relationView=review&relationshipCandidate=${candidateId}`
      : `relationView=list&relationshipId=${relationId}`;
    await page.goto(`${legacyWorkspace}&${selected}&relationPage=1&relationshipFactId=${factId}`);
    await expect.poll(() => new URL(page.url()).searchParams.get('nav')).toBe('graph');
    const params = new URL(page.url()).searchParams;
    expect(params.get('workId')).toBe(workId);
    expect(params.has('tab')).toBeFalsy();
    expect(params.get('relationView')).toBe(selection === '후보' ? 'review' : 'list');
    expect(params.get(selection === '후보' ? 'relationshipCandidate' : 'relationshipId')).toBe(selection === '후보' ? candidateId : relationId);
    expect(params.get('relationPage')).toBe('1');
    expect(params.get('relationshipFactId')).toBe(factId);
    await expect(page.getByRole('dialog')).toContainText('아버지 현우');
    await page.keyboard.press('Escape');
    if (selection === '후보') await expect(page.getByRole('heading', { name: '도윤의 가족 관계 확인', exact: true })).toBeVisible();
    else await expect(page.getByRole('button', { name: '관계 근거 접기', exact: true })).toBeVisible();
    await page.reload();
    await expect.poll(() => new URL(page.url()).searchParams.get('nav')).toBe('graph');
    expect(new URL(page.url()).searchParams.get(selection === '후보' ? 'relationshipCandidate' : 'relationshipId')).toBe(selection === '후보' ? candidateId : relationId);
    await page.goBack();
    await expect(page).toHaveURL(/\/works$/);
  });
}

test('후보 초안 저장 중 다른 메뉴로 이동하면 늦은 성공이 검토 화면과 선택을 복원하지 않는다', async ({ page, context }) => {
  const fixture = await setup(context); fixture.ready();
  await page.goto(editor);
  await page.getByLabel('시점 설명').fill('이전 검토 화면에서 작성한 초안');
  const waiting = fixture.holdNext('PUT', `relationship-candidates/${candidateId}`);
  await page.getByRole('button', { name: '수정 저장' }).click();
  await waiting.received;
  await page.getByRole('button', { name: '작품 설정', exact: true }).click();
  await expect(page.getByRole('heading', { name: '캐릭터 설정', exact: true })).toBeVisible();
  await expect.poll(() => new URL(page.url()).searchParams.get('nav')).toBe('settingDB');
  expect(new URL(page.url()).searchParams.has('relationshipCandidate')).toBeFalsy();
  const completed = page.waitForResponse(response => new URL(response.url()).pathname === `${prefix}/relationship-candidates/${candidateId}` && response.request().method() === 'PUT');
  waiting.release();
  await completed;
  await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
  expect(new URL(page.url()).searchParams.get('nav')).toBe('settingDB');
  await expect(page.getByLabel('시점 설명')).toHaveCount(0);
  await expect(page.getByText('수정한 내용을 저장했어요.', { exact: false })).toHaveCount(0);
  expect(fixture.calls.saves[0]).toMatchObject({ timeLabel: '이전 검토 화면에서 작성한 초안', expectedVersion: 0 });
  await page.getByRole('button', { name: '관계도', exact: true }).click();
  await expect.poll(() => new URL(page.url()).searchParams.get('nav')).toBe('graph');
  expect(new URL(page.url()).searchParams.has('relationshipCandidate')).toBeFalsy();
  await expect(page.getByRole('heading', { name: '도윤의 가족 관계 확인', exact: true })).toHaveCount(0);
});

for (const state of ['NEVER_PROCESSED', 'PENDING', 'SUCCEEDED'] as const) {
  test(`미리보기의 ${state} 상태는 일반 관계 찾기나 재시도 버튼을 노출하지 않는다`, async ({ page, context }) => {
    const fixture = await setup(context); fixture.processingState(state);
    await page.goto(workspace);
    await expect(page.getByRole('heading', { name: '관계도', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: '확인 필요 1', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: '현재 설정에서 관계 찾기', exact: true })).toHaveCount(0);
    await expect(page.getByRole('button', { name: '관계 정리 다시 시도', exact: true })).toHaveCount(0);
    expect(fixture.calls.processing).toBe(0);
    expect(fixture.calls.analyses).toBe(0);
  });
}

test('현재 20개 목록 밖의 직접 연결 관계도 인물·종류·시점·상태를 확인한 뒤 철회한다', async ({ page, context }, testInfo) => {
  const fixture = await setup(context); fixture.offPageRelationship();
  await page.goto(`${workspace}&relationshipId=${relationId}`);
  await expect(page.getByRole('button', { name: '관계 근거 보기', exact: true })).toHaveCount(20);
  const selected = page.getByRole('article').filter({ has: page.getByRole('button', { name: '원문 근거 1', exact: true }) });
  await expect(selected.getByRole('button', { name: '원문 근거 1', exact: true })).toBeVisible();
  await expect(selected.getByRole('heading', { name: '현우 → 도윤', exact: true })).toBeVisible();
  await expect(selected.getByText('부모 → 자녀 · 입양 · 과거 관계 · 10년 전', { exact: true })).toBeVisible();
  await expect(selected.getByText('보관된 인물 포함', { exact: true })).toBeVisible();
  const identified = page.getByRole('article').filter({ has: page.getByRole('heading', { name: '현우 → 도윤', exact: true }) });
  await identified.screenshot({ path: testInfo.outputPath('off-page-relationship-summary.png') });
  await identified.getByRole('button', { name: '잘못된 관계 철회', exact: true }).click();
  await identified.getByRole('button', { name: '관계 철회', exact: true }).click();
  await expect(identified.getByText('철회된 관계', { exact: true })).toBeVisible();
  expect(fixture.calls.withdraws).toBe(1);
});

for (const decision of ['확정', '제외'] as const) {
  test(`자동 처리 상태가 같아도 다른 창의 ${decision} 후 검토 목록과 현재 대기 개수가 함께 갱신된다`, async ({ page, context }) => {
    const fixture = await setup(context); fixture.ready();
    await page.clock.install();
    await page.goto(`${workspace}&relationView=review`);
    await expect(page.getByRole('button', { name: '확인 필요 1', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: '도윤 · 현우 관계 확인', exact: true })).toBeVisible();
    const other = await context.newPage();
    await other.goto(editor);
    await other.getByRole('button', { name: decision === '확정' ? '관계에 반영' : '후보 제외', exact: true }).click();
    await expect(other.getByText('확인이 필요한 가족 관계가 없어요.', { exact: true })).toBeVisible();
    await page.bringToFront();
    await page.clock.runFor(6000);
    await expect(page.getByRole('button', { name: '확인 필요 0', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: '도윤 · 현우 관계 확인', exact: true })).toHaveCount(0);
    await expect(page.getByText('확인이 필요한 가족 관계가 없어요.', { exact: true })).toBeVisible();
    expect(fixture.calls.processing).toBe(0);
    expect(fixture.calls.confirms).toBe(decision === '확정' ? 1 : 0);
    expect(fixture.calls.dismisses).toBe(decision === '제외' ? 1 : 0);
    await other.close();
  });
}

test('관계 목록을 보면서도 다른 창의 후보 제외를 대기 개수에 반영하며 숨겨진 검토 목록은 조회하지 않는다', async ({ page, context }) => {
  const fixture = await setup(context);
  let reviewListReads = 0;
  page.on('request', request => {
    const url = new URL(request.url());
    if (url.pathname === `${prefix}/relationship-candidates` && url.searchParams.get('size') === '20') reviewListReads++;
  });
  await page.clock.install();
  await page.goto(workspace);
  await expect(page.getByRole('button', { name: '확인 필요 1', exact: true })).toBeVisible();
  const other = await context.newPage();
  await other.goto(editor);
  await other.getByRole('button', { name: '후보 제외', exact: true }).click();
  await expect(other.getByText('확인이 필요한 가족 관계가 없어요.', { exact: true })).toBeVisible();
  await page.bringToFront();
  await page.clock.runFor(6000);
  await expect(page.getByRole('button', { name: '확인 필요 0', exact: true })).toBeVisible();
  expect(reviewListReads).toBe(0);
  expect(fixture.calls.processing).toBe(0);
  await other.close();
});

test('숨겨진 검토 목록은 조회를 쉬고 창 복귀 때 다른 창의 제외와 줄어든 마지막 페이지를 복구한다', async ({ page, context }) => {
  const fixture = await setup(context); fixture.pendingSecondPage();
  let candidateListReads = 0;
  page.on('request', request => {
    if (new URL(request.url()).pathname === `${prefix}/relationship-candidates`) candidateListReads++;
  });
  await page.clock.install();
  await page.goto(`${workspace}&relationView=review&relationPage=2`);
  await expect(page.getByRole('button', { name: '확인 필요 21', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: '도윤 · 현우 관계 확인', exact: true })).toBeVisible();
  await page.evaluate(() => {
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' });
    window.dispatchEvent(new Event('visibilitychange'));
  });
  const other = await context.newPage();
  await other.goto(editor);
  await other.getByRole('button', { name: '후보 제외', exact: true }).click();
  await expect(other.getByRole('button', { name: '확인 필요 20', exact: true })).toBeVisible();
  const readsWhileHidden = candidateListReads;
  await page.clock.runFor(6000);
  expect(candidateListReads).toBe(readsWhileHidden);
  expect(new URL(page.url()).searchParams.get('relationPage')).toBe('2');
  await expect(page.getByRole('button', { name: '확인 필요 21', exact: true })).toBeVisible();
  await page.bringToFront();
  const refetched = page.waitForResponse(response => {
    const url = new URL(response.url());
    return url.pathname === `${prefix}/relationship-candidates` && url.searchParams.get('size') === '20';
  }, { timeout: 1500 });
  await page.evaluate(() => {
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'visible' });
    window.dispatchEvent(new Event('visibilitychange'));
  });
  await refetched;
  await expect(page.getByRole('button', { name: '확인 필요 20', exact: true })).toBeVisible();
  await expect.poll(() => new URL(page.url()).searchParams.get('relationPage')).toBe('1');
  await expect(page.getByRole('article')).toHaveCount(20);
  await expect(page.getByRole('button', { name: '도윤 · 남은 상대 1 관계 확인', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: '도윤 · 현우 관계 확인', exact: true })).toHaveCount(0);
  expect(fixture.calls.processing).toBe(0);
  await other.close();
});

test('다른 창의 확정과 철회가 관계 목록과 열린 상세에 반영되어 낡은 철회 액션이 사라진다', async ({ page, context }) => {
  const fixture = await setup(context); fixture.ready(); fixture.waitForRelationshipConfirmation();
  await page.clock.install();
  await page.goto(workspace);
  await expect(page.getByText('아직 반영된 가족 관계가 없어요.', { exact: true })).toBeVisible();
  const other = await context.newPage();
  await other.goto(editor);
  await other.getByRole('button', { name: '관계에 반영', exact: true }).click();
  await expect(other.getByText('확인이 필요한 가족 관계가 없어요.', { exact: true })).toBeVisible();
  await page.bringToFront();
  await page.clock.runFor(6000);
  await expect(page.getByRole('heading', { name: '현우 → 도윤', exact: true })).toBeVisible();
  await page.getByRole('button', { name: '관계 근거 보기', exact: true }).click();
  await expect(page.getByRole('button', { name: '잘못된 관계 철회', exact: true })).toBeVisible();
  await other.getByRole('button', { name: '가족 관계 목록', exact: true }).click();
  await other.getByRole('button', { name: '관계 근거 보기', exact: true }).click();
  await other.getByRole('button', { name: '잘못된 관계 철회', exact: true }).click();
  await other.getByRole('button', { name: '관계 철회', exact: true }).click();
  await expect(other.getByText('철회된 관계', { exact: true })).toBeVisible();
  await page.bringToFront();
  await page.clock.runFor(6000);
  await expect(page.getByText('철회된 관계', { exact: true })).toBeVisible();
  await expect(page.getByText('철회된 관계예요.', { exact: false })).toBeVisible();
  await expect(page.getByRole('button', { name: '잘못된 관계 철회', exact: true })).toHaveCount(0);
  expect(fixture.calls.processing).toBe(0);
  expect(fixture.calls.withdraws).toBe(1);
  await other.close();
});

test('목록 밖 열린 관계도 창 복귀 시 다른 창의 철회를 확인하고 상태와 액션을 함께 갱신한다', async ({ page, context }) => {
  const fixture = await setup(context); fixture.offPageRelationship();
  const link = `${workspace}&relationshipId=${relationId}`;
  const relationReads: string[] = [];
  page.on('request', request => {
    const path = new URL(request.url()).pathname;
    if (request.method() === 'GET' && (path === `${prefix}/relationships` || path === `${prefix}/relationships/${relationId}`)) relationReads.push(path);
  });
  await page.clock.install();
  await page.goto(link);
  await expect(page.getByRole('button', { name: '잘못된 관계 철회', exact: true })).toBeVisible();
  await page.evaluate(() => {
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' });
    window.dispatchEvent(new Event('visibilitychange'));
  });
  const other = await context.newPage();
  await other.goto(link);
  await other.getByRole('button', { name: '잘못된 관계 철회', exact: true }).click();
  await other.getByRole('button', { name: '관계 철회', exact: true }).click();
  await expect(other.getByText('철회된 관계', { exact: true })).toBeVisible();
  const hiddenReads = relationReads.length;
  await page.clock.runFor(6000);
  expect(relationReads).toHaveLength(hiddenReads);
  await expect(page.getByText('보관된 인물 포함', { exact: true })).toBeVisible();
  await page.bringToFront();
  const refetched = page.waitForResponse(response => new URL(response.url()).pathname === `${prefix}/relationships/${relationId}`, { timeout: 1500 });
  await page.evaluate(() => {
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'visible' });
    window.dispatchEvent(new Event('visibilitychange'));
  });
  await refetched;
  const selected = page.getByRole('article').filter({ has: page.getByRole('heading', { name: '현우 → 도윤', exact: true }) });
  await expect(selected.getByText('철회된 관계', { exact: true })).toBeVisible();
  await expect(selected.getByRole('button', { name: '잘못된 관계 철회', exact: true })).toHaveCount(0);
  await expect(selected.getByRole('button', { name: '원문 근거 1', exact: true })).toBeEnabled();
  expect(fixture.calls.processing).toBe(0);
  await other.close();
});

test('자기 저장 성공은 후속 조회 실패나 늦은 구버전 GET으로 잠기지 않고 실제 새 버전 변경은 감지한다', async ({ page, context }) => {
  const fixture = await setup(context); fixture.ready();
  await page.clock.install();
  await page.goto(editor);
  await expect(page.getByRole('button', { name: '관계에 반영', exact: true })).toBeEnabled();
  const oldRead = fixture.holdNext('GET', `relationship-candidates/${candidateId}`);
  await page.clock.runFor(5100);
  await oldRead.received;
  fixture.failCandidateReads(true);
  await page.getByLabel('시점 설명').fill('저장한 현재 초안');
  await page.getByRole('button', { name: '수정 저장', exact: true }).click();
  await expect(page.getByText('수정한 내용을 저장했어요.', { exact: false })).toBeVisible();
  await expect(page.getByRole('button', { name: '관계에 반영', exact: true })).toBeEnabled();
  await expect(page.getByLabel('시점 설명')).toBeEnabled();
  await expect(page.getByText('다른 곳에서 이 후보가 변경되었어요.', { exact: false })).toHaveCount(0);
  await page.clock.runFor(1500);
  await expect(page.getByText('확인할 관계를 불러오지 못했어요.', { exact: true })).toBeVisible();
  oldRead.release();
  await page.clock.runFor(100);
  await expect(page.getByRole('button', { name: '관계에 반영', exact: true })).toBeEnabled();
  await page.getByLabel('시점 설명').fill('이어서 작성한 초안');
  fixture.failCandidateReads(false); fixture.otherChanged();
  await page.clock.runFor(6000);
  await expect(page.getByText('다른 곳에서 이 후보가 변경되었어요.', { exact: false })).toBeVisible();
  await expect(page.getByLabel('시점 설명')).toHaveValue('이어서 작성한 초안');
  await expect(page.getByRole('button', { name: '수정 저장', exact: true })).toBeDisabled();
});

test('현재 설정 재확인 성공은 뒤따르는 상세 GET을 기다리지 않고 초안과 선택 근거를 유지한다', async ({ page, context }) => {
  const fixture = await setup(context); fixture.ready();
  await page.clock.install();
  await page.goto(editor);
  await page.getByLabel('시점 설명').fill('재확인 중 보존할 초안');
  fixture.otherChanged();
  const followup = fixture.holdNext('GET', `relationship-candidates/${candidateId}`, 1);
  await page.getByRole('button', { name: '현재 설정 다시 확인', exact: true }).click();
  await followup.received;
  await expect(page.getByRole('checkbox')).toBeChecked();
  await expect(page.getByLabel('시점 설명')).toBeEnabled();
  await expect(page.getByLabel('시점 설명')).toHaveValue('재확인 중 보존할 초안');
  await expect(page.getByRole('button', { name: '수정 저장', exact: true })).toBeEnabled();
  await expect(page.getByText('다른 곳에서 이 후보가 변경되었어요.', { exact: false })).toHaveCount(0);
  followup.release();
  await page.getByRole('button', { name: '수정 저장', exact: true }).click();
  await expect(page.getByRole('button', { name: '관계에 반영', exact: true })).toBeEnabled();
  expect(fixture.calls.saves[0]).toMatchObject({ expectedVersion: 1, timeLabel: '재확인 중 보존할 초안', evidence: [{ sourceFactId: factId, sourceToken: oldToken }] });
});

test('재시도 요청 오류는 FAILED 조회 때 유지하고 이후 PENDING 또는 SUCCEEDED 확인으로 해소된다', async ({ page, context }) => {
  const fixture = await setup(context); fixture.failed(); fixture.failProcessing();
  await page.clock.install();
  await page.goto(workspace);
  const failureMessage = page.getByText('관계 정리 요청 결과를 확인하지 못했어요.', { exact: true });
  await page.getByRole('button', { name: '관계 정리 다시 시도', exact: true }).click();
  await expect(failureMessage).toBeVisible();
  await page.clock.runFor(31000);
  await expect(failureMessage).toBeVisible();
  fixture.processingState('PENDING');
  await page.clock.runFor(31000);
  await expect(page.getByText('가족 관계를 정리하고 있어요.', { exact: true })).toBeVisible();
  await expect(failureMessage).toHaveCount(0);
  fixture.processingState('SUCCEEDED');
  await page.clock.runFor(3100);
  await expect(page.getByText('현재 설정의 가족 관계를 정리했어요.', { exact: true })).toBeVisible();
  fixture.failed(); fixture.failProcessing();
  await page.clock.runFor(31000);
  await page.getByRole('button', { name: '관계 정리 다시 시도', exact: true }).click();
  await expect(failureMessage).toBeVisible();
  fixture.processingState('SUCCEEDED');
  await page.clock.runFor(31000);
  await expect(page.getByText('현재 설정의 가족 관계를 정리했어요.', { exact: true })).toBeVisible();
  await expect(failureMessage).toHaveCount(0);
  fixture.failed(); fixture.failProcessing();
  await page.clock.runFor(31000);
  const lateFailure = fixture.holdNext('POST', 'relationship-processing');
  await page.getByRole('button', { name: '관계 정리 다시 시도', exact: true }).click();
  await lateFailure.received;
  fixture.processingState('SUCCEEDED');
  await page.clock.runFor(31000);
  await expect(page.getByText('현재 설정의 가족 관계를 정리했어요.', { exact: true })).toBeVisible();
  const failedResponse = page.waitForResponse(response => response.request().method() === 'POST' && new URL(response.url()).pathname === `${prefix}/relationship-processing`);
  lateFailure.release();
  await failedResponse;
  await page.clock.runFor(100);
  await expect(failureMessage).toHaveCount(0);
  expect(fixture.calls.processing).toBe(3);
});
