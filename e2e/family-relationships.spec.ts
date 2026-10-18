import { expect, test, type BrowserContext, type Page, type Route } from '@playwright/test';
import type { RelationshipCandidateResponse, RelationshipResponse } from '../src/app/api/generated/types.gen';

const workId = '11111111-1111-4111-8111-111111111111';
const subjectId = '22222222-2222-4222-8222-222222222222';
const targetId = '33333333-3333-4333-8333-333333333333';
const candidateId = '44444444-4444-4444-8444-444444444444';
const relationId = '55555555-5555-4555-8555-555555555555';
const factId = '66666666-6666-4666-8666-666666666666';
const prefix = `/api/v1/works/${workId}`;
const workspace = `/dashboard?workId=${workId}&nav=settingDB&tab=relations`;
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
  let state = 'SUCCEEDED';
  let inputVersion = 1;
  let failSave = 0;
  let failDismiss = 0;
  let failSources = 0;
  let originalReads = 0;
  let charactersPage = 0;
  const calls = { saves: [] as Array<Record<string, unknown>>, confirms: 0, dismisses: 0, processing: 0, analyses: 0, withdraws: 0, refreshes: 0 };
  const expired = new Set<string>();
  const held = new Map<string, { started: () => void; gate: Promise<void> }>();
  const requestKey = (method: string, suffix: string) => `${method} ${suffix.startsWith('/api/v1/') ? suffix : `${prefix}/${suffix}`}`;
  await context.addInitScript(() => { localStorage.setItem('accessToken', 'synthetic-family-token'); localStorage.removeItem('catchhole_demo_mode'); });
  await context.route('**/api/v1/**', async route => {
    const req = route.request(); const url = new URL(req.url()); const path = url.pathname;
    const key = `${req.method()} ${path}`;
    if (expired.delete(key)) return failure(route, 401, '토큰을 갱신해 주세요.', 'AUTH_UNAUTHORIZED');
    const waiting = held.get(key);
    if (waiting) { held.delete(key); waiting.started(); await waiting.gate; }
    if (path.endsWith('/auth/refresh')) { calls.refreshes++; return success(route, { accessToken: `rotated-family-token-${calls.refreshes}` }); }
    if (path.endsWith('/auth/me')) return success(route, { id: 1, email: 'family@example.test', role: 'AUTHOR', status: 'ACTIVE', displayName: '관계 검토' });
    if (path === '/api/v1/works') return success(route, [{ id: workId, title: '가족 관계 검증', genre: '판타지', episodeCount: 0 }]);
    if (path === prefix) return success(route, { id: workId, title: '가족 관계 검증', lifecycleStatus: 'ACTIVE' });
    if (path.endsWith('/analysis-jobs') && req.method() !== 'GET') { calls.analyses++; return failure(route, 500, '분석 요청은 허용하지 않음'); }
    if (path === `${prefix}/relationship-processing`) {
      if (req.method() === 'POST') { calls.processing++; state = 'PENDING'; }
      return success(route, { state, inputVersion, processedVersion: state === 'PENDING' ? 0 : inputVersion,
        autoConfirmedCount: 1, reviewRequiredCount: 9, unsupportedSourceCount: 0, lastProcessedAt: '2026-10-17T12:00:00',
        retryAt: state === 'FAILED' ? '2026-10-17T13:00:00' : null });
    }
    if (path === `${prefix}/relationships`) return success(route, paginated([relation]));
    if (path === `${prefix}/relationships/${relationId}`) return success(route, relation);
    if (path === `${prefix}/relationships/${relationId}/withdraw`) {
      calls.withdraws++; relation = { ...relation, version: relation.version! + 1, validity: 'WITHDRAWN', visibleInFamilyTree: false };
      return success(route, relation);
    }
    if (path === `${prefix}/relationship-candidates`) {
      expect(url.searchParams.get('status')).toBe('PENDING');
      return success(route, paginated(candidate.status === 'PENDING' ? [candidate] : [], candidate.status === 'PENDING' ? 1 : 0));
    }
    if (path === `${prefix}/relationship-candidates/${candidateId}`) {
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
    holdNext(method: string, suffix: string) {
      let release!: () => void;
      let started!: () => void;
      const gate = new Promise<void>(resolve => { release = resolve; });
      const received = new Promise<void>(resolve => { started = resolve; });
      held.set(requestKey(method, suffix), { started, gate });
      return { release, received };
    },
    sourceChanged() { sourceToken = newToken; sourceText = '도윤의 친아버지는 현우이다.'; },
    conflictingValues() { candidate = { ...candidate, reviewReasons: ['CURRENT_VALUE_CONFLICT', 'UNSUPPORTED_STRUCTURED_CONTEXT'], evidence: [{ ...candidate.evidence![0], currentValue: { factValue: '아버지: 현우', valueJson: { value: '아버지: 준서', name: '추정 가족관계', certainty: '확인되지 않은 소문' } } }] }; },
    sourceInvalidated() { inputVersion++; candidate = { ...candidate, reviewReasons: ['SOURCE_CHANGED'], evidence: [{ ...candidate.evidence![0], current: false, currentValue: undefined }] }; },
    otherChanged() { candidate = { ...candidate, version: candidate.version! + 1 }; },
    ready() { candidate = { ...candidate, objectCharacterId: targetId, objectCharacterName: '현우', assertion: 'ASSERTED', reviewReasons: [] }; },
    held() { candidate = { ...candidate, objectCharacterId: targetId, objectCharacterName: '현우', assertion: 'ASSERTED', reviewReasons: ['PREVIOUSLY_WITHDRAWN'] }; },
    sourceRemoved() { relation = { ...relation, validity: 'REVIEW_REQUIRED', evidence: [{ ...relation.evidence![0], current: false, currentValue: undefined }] }; },
    failed() { state = 'FAILED'; }, failSave() { failSave = 1; }, failDismiss() { failDismiss = 1; }, failSources() { failSources = 1; },
    originalReads: () => originalReads, charactersPage: () => charactersPage };
}

test('자동 반영 목록·별도 대기 개수·이전 원문 근거·철회', async ({ page, context }, testInfo) => {
  const fixture = await setup(context); fixture.sourceRemoved();
  await page.goto(workspace);
  await expect(page.getByRole('button', { name: '확인 필요 1', exact: true })).toBeVisible();
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
  expect(fixture.calls.processing).toBe(1); expect(fixture.calls.analyses).toBe(0);
});

test('320px 모바일에서 직접 링크·새로고침·뒤로가기를 유지하고 가로 넘침이 없다', async ({ page, context }, testInfo) => {
  await setup(context); await page.setViewportSize({ width: 320, height: 740 });
  await page.goto(workspace);
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
    await page.goto(action === '제외' ? editor : workspace);
    if (action === '관계 정리') {
      fixture.expireNext('POST', 'relationship-processing');
      await page.getByRole('button', { name: '현재 설정에서 관계 찾기' }).click();
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

for (const boundary of ['로그아웃 대기', '새 로그인 세션', '작품 화면 이탈'] as const) {
  test(`${boundary} 뒤 늦은 관계 정리 응답이 캐시와 화면을 복원하지 않는다`, async ({ page, context }) => {
    const fixture = await setup(context);
    await page.goto(workspace);
    await expect(page.getByText('현재 설정의 가족 관계를 정리했어요.', { exact: true })).toBeVisible();
    const waiting = fixture.holdNext('POST', 'relationship-processing');
    await page.getByRole('button', { name: '현재 설정에서 관계 찾기' }).click();
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
    } else {
      await page.getByRole('button', { name: '작품 선택으로 이동' }).click();
      await expect(page).toHaveURL(/\/works$/);
    }
    const completed = page.waitForResponse(response => new URL(response.url()).pathname === `${prefix}/relationship-processing` && response.request().method() === 'POST');
    waiting.release();
    await completed;
    await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
    expect(await cachedProcessingState(page)).toBe(boundary === '작품 화면 이탈' ? 'SUCCEEDED' : undefined);
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
