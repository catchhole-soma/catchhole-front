import { expect, test, type BrowserContext, type Route } from '@playwright/test';
import type { FamilyTreeEdgeResponse, FamilyTreeNodeResponse, RelationshipCandidateResponse } from '../src/app/api/generated/types.gen';

test.skip(process.env.VITE_RELATIONSHIP_WORKSPACE_ENABLED === 'false', '관계 화면을 명시적으로 비활성화한 실행에서는 건너뜁니다.');
const workId = '11111111-1111-4111-8111-111111111111';
const bjorn = '20000000-0000-4000-8000-000000000001';
const yandel = '20000000-0000-4000-8000-000000000002';
const mother = '20000000-0000-4000-8000-000000000003';
const otherChild = '20000000-0000-4000-8000-000000000004';
const candidateId = '30000000-0000-4000-8000-000000000001';
const secondCandidateId = '30000000-0000-4000-8000-000000000002';
const relationId = '40000000-0000-4000-8000-000000000001';
const motherRelationId = '40000000-0000-4000-8000-000000000002';
const factId = '50000000-0000-4000-8000-000000000001';
const mentionId = `mention:${candidateId}`;
const prefix = `/api/v1/works/${workId}`;
const workspace = `/dashboard?workId=${workId}&nav=graph&relationMode=family`;
const source = { sourceFactId: factId, characterId: bjorn, sourceToken: 'a'.repeat(64), current: true,
  hasEvidence: true, manuallyEdited: false, factKey: 'profile.family', currentValue: { factValue: '얀델의 아들 비요른' } };
function success(route: Route, data: unknown) { return route.fulfill({ contentType: 'application/json', body: JSON.stringify({ success: true, data, error: null }) }); }

async function setup(context: BrowserContext, options: { sharedParents?: boolean; duplicate?: boolean } = {}) {
  let registered = false, linked = false, failing = false;
  let candidate: RelationshipCandidateResponse = { id: candidateId, version: 0, status: 'PENDING', origin: 'CURRENT_SETTING_RULE',
    subjectCharacterId: bjorn, subjectCharacterName: '비요른', objectCharacterId: undefined, objectMention: '얀델', kind: 'CHILD_OF',
    subtype: 'BIOLOGICAL', temporalScope: 'CURRENT', assertion: 'ASSERTED', reviewReasons: ['UNRESOLVED_TARGET'],
    evidence: [source], displayableAsMention: true };
  const second = { ...candidate, id: secondCandidateId, subjectCharacterId: otherChild, subjectCharacterName: '다른 자녀' };
  const calls = { mutations: [] as string[], profiles: [] as string[], graphs: [] as URLSearchParams[], relations: [] as string[], quotes: 0, saves: [] as Array<Record<string, unknown>> };
  const character = (id: string, name: string): FamilyTreeNodeResponse => ({ id, characterId: id, name, nodeType: 'CHARACTER' });
  const graph = () => {
    const displayable = candidate.displayableAsMention === true;
    const nodes: FamilyTreeNodeResponse[] = [character(bjorn, '비요른'), ...(linked ? [character(yandel, '얀델')] : displayable ? [{ id: mentionId, name: '얀델', nodeType: 'MENTION' as const, candidateId }] : [])];
    const edges: FamilyTreeEdgeResponse[] = linked || displayable ? [{ id: linked ? relationId : mentionId, version: 1,
      sourceType: linked ? 'RELATIONSHIP' : 'MENTION', relationshipId: linked ? relationId : undefined, candidateId: linked ? undefined : candidateId,
      subjectNodeId: linked ? yandel : mentionId, objectNodeId: bjorn, subjectCharacterId: linked ? yandel : undefined, objectCharacterId: bjorn,
      kind: 'PARENT_OF', subjectRole: 'PARENT', objectRole: 'SON', subtype: 'BIOLOGICAL', temporalScope: 'CURRENT' }] : [];
    if (options.sharedParents) {
      nodes.push(character(mother, '어머니'));
      edges.push({ id: motherRelationId, sourceType: 'RELATIONSHIP', relationshipId: motherRelationId, subjectNodeId: mother, objectNodeId: bjorn,
        subjectCharacterId: mother, objectCharacterId: bjorn, kind: 'PARENT_OF', subtype: 'BIOLOGICAL', temporalScope: 'CURRENT' });
    }
    if (options.duplicate) {
      nodes.push(character(otherChild, '다른 자녀'), { id: `mention:${secondCandidateId}`, name: '얀델', nodeType: 'MENTION', candidateId: secondCandidateId });
      edges.push({ id: `mention:${secondCandidateId}`, sourceType: 'MENTION', candidateId: secondCandidateId, subjectNodeId: `mention:${secondCandidateId}`, objectNodeId: otherChild,
        objectCharacterId: otherChild, kind: 'PARENT_OF', subtype: 'BIOLOGICAL', temporalScope: 'CURRENT' });
    }
    return { nodes, edges, totalNodeCount: nodes.length, totalEdgeCount: edges.length, pendingCandidateCount: linked ? 0 : 1 + Number(!!options.duplicate),
      optionalLinkCount: linked || !displayable ? 0 : 1 + Number(!!options.duplicate), truncated: false, limit: 100, revision: `${candidate.version}:${registered}` };
  };
  await context.addInitScript(() => localStorage.setItem('accessToken', 'synthetic-family-mention-token'));
  await context.route('**/api/v1/**', async route => {
    const request = route.request(), url = new URL(request.url()), path = url.pathname;
    if (request.method() !== 'GET') calls.mutations.push(`${request.method()} ${path}`);
    if (path.endsWith('/auth/me')) return success(route, { id: 1, email: 'mention@example.test', displayName: '언급 인물 검증', role: 'AUTHOR', status: 'ACTIVE' });
    if (path === '/api/v1/works') return success(route, [{ id: workId, title: '언급 인물 검증 작품', genre: '판타지' }]);
    if (path === prefix) return success(route, { id: workId, title: '언급 인물 검증 작품', genre: '판타지', lifecycleStatus: 'ACTIVE' });
    if (path === `${prefix}/family-tree`) { calls.graphs.push(url.searchParams); return success(route, graph()); }
    if (path === `${prefix}/relationship-processing`) return success(route, { state: 'SUCCEEDED', inputVersion: 1, processedVersion: 1, autoConfirmedCount: 0, reviewRequiredCount: 1 });
    if (path === `${prefix}/relationship-candidates`) return success(route, { content: linked ? [] : [candidate, ...(options.duplicate ? [second] : [])], totalElements: linked ? 0 : 1 + Number(!!options.duplicate), totalPages: 1, page: 0, size: 20 });
    if (path === `${prefix}/relationship-candidates/${candidateId}` || path === `${prefix}/relationship-candidates/${secondCandidateId}`) {
      if (failing) return route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ success: false, error: { code: 'COMMON_ERROR', message: '근거 조회 실패' } }) });
      if (request.method() === 'PUT') {
        const body = request.postDataJSON(); calls.saves.push(body);
        expect(body.expectedVersion).toBe(candidate.version);
        if (body.objectCharacterId) expect(body.objectCharacterId).toBe(yandel);
        expect(body.evidence).toEqual([{ sourceFactId: factId, sourceToken: source.sourceToken }]);
        candidate = { ...candidate, ...body, objectCharacterName: body.objectCharacterId ? '얀델' : undefined, version: candidate.version! + 1,
          reviewReasons: body.assertion !== 'ASSERTED' ? ['UNCERTAIN'] : body.objectCharacterId ? [] : ['UNRESOLVED_TARGET'],
          displayableAsMention: body.assertion === 'ASSERTED' && !body.objectCharacterId };
      }
      return success(route, path.endsWith(secondCandidateId) ? second : candidate);
    }
    if (path === `${prefix}/relationship-candidates/${candidateId}/confirm`) {
      expect(request.postDataJSON().expectedVersion).toBe(candidate.version); expect(candidate.objectCharacterId).toBe(yandel);
      linked = true; candidate = { ...candidate, status: 'CONFIRMED', version: candidate.version! + 1 }; return success(route, candidate);
    }
    if (path === `${prefix}/relationship-sources`) return success(route, url.searchParams.get('characterId') === bjorn
      ? [{ factId, characterId: bjorn, factKey: 'profile.family', contextToken: source.sourceToken, currentValue: source.currentValue, hasEvidence: true }] : []);
    if (path === `${prefix}/characters`) return success(route, { content: [character(bjorn, '비요른'), ...(registered ? [character(yandel, '얀델')] : [])], totalElements: registered ? 2 : 1, totalPages: 1, page: 0, size: 12 });
    if (path.startsWith(`${prefix}/characters/`)) { calls.profiles.push(path); return success(route, { id: yandel, name: '얀델', profile: [], stats: [], skills: [], items: [], statuses: [] }); }
    if (path.startsWith(`${prefix}/relationships/`)) { calls.relations.push(path); return success(route, { id: motherRelationId, kind: 'PARENT_OF', subjectCharacterName: '어머니', objectCharacterName: '비요른', validity: 'VALID', evidence: [source] }); }
    if (path.endsWith(`/character-facts/${factId}/evidence`)) { calls.quotes++; return success(route, { content: '얀델의 아들 비요른이 문을 열었다.', evidenceSpans: [{ quote: '얀델의 아들 비요른', startOffset: 0, endOffset: 10 }], episode: { episodeNo: 1, title: '첫 등장' } }); }
    return success(route, []);
  });
  return { calls, candidate: () => candidate, register() { registered = true; }, fail(value: boolean) { failing = value; } };
}

const panel = (page: import('@playwright/test').Page) => page.getByRole('article', { name: '언급된 인물 근거' });

test('얀델은 등록 없이 근거로 표시하고 뒤늦게 등록돼도 직접 선택한 뒤 연결할 때만 저장·확정한다', async ({ page, context }, testInfo) => {
  const api = await setup(context);
  await page.goto(workspace);
  const mention = page.getByRole('button', { name: '얀델 설정 근거 보기', exact: true });
  await expect(mention).toBeVisible(); await expect(mention).toContainText('프로필 미등록');
  await expect(page.getByRole('button', { name: '얀델 · 부모 관계 근거 보기', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: '비요른 · 아들 관계 근거 보기', exact: true })).toBeVisible();
  await expect(page.getByText('자녀 1명', { exact: true })).toHaveCount(0);
  await page.getByRole('region', { name: '가계도', exact: true }).screenshot({ path: testInfo.outputPath('mention-tree-desktop.png') });
  const linkingHelp = page.getByText('작품 전체에서 인물 연결을 선택할 수 있는 관계는 1개예요.', { exact: true });
  await expect(linkingHelp).not.toBeVisible();
  await page.getByText('가계도 안내', { exact: true }).click();
  await expect(linkingHelp).toHaveCount(0);
  await page.getByText('가계도 안내', { exact: true }).click();
  await mention.focus(); await page.keyboard.press('Enter');
  await expect(panel(page)).toBeVisible(); await expect(panel(page)).toBeFocused();
  await expect(panel(page).getByText('얀델의 아들 비요른', { exact: true })).toBeInViewport();
  await expect(panel(page)).toContainText('얀델의 아들 비요른'); expect(api.calls.profiles).toEqual([]);
  expect(api.calls.quotes).toBe(0);
  const evidence = panel(page).getByText('원문 근거 1개 확인', { exact: true });
  await evidence.click();
  await expect(panel(page).getByRole('blockquote')).toHaveText('얀델의 아들 비요른');
  expect(api.calls.quotes).toBe(1);
  await expect(panel(page).locator('.review-cb-evidence__body .relationship-current-setting')).toHaveCount(0);
  expect(api.calls.mutations).toEqual([]);
  await panel(page).screenshot({ path: testInfo.outputPath('mention-evidence-desktop.png') });
  await evidence.click();
  await expect(panel(page).getByRole('blockquote')).toHaveCount(0);
  await page.getByRole('button', { name: '인물 근거 닫기' }).click(); await expect(mention).toBeFocused();
  await page.getByRole('textbox', { name: '가계도 인물 검색' }).focus();
  const line = page.getByRole('region', { name: '가계도', exact: true }).locator('.react-flow__edge-interaction').first();
  await line.scrollIntoViewIfNeeded();
  const point = await line.evaluate(element => {
    const path = element as SVGPathElement;
    const point = path.getPointAtLength(path.getTotalLength() / 4).matrixTransform(path.getScreenCTM()!);
    return { x: point.x, y: point.y };
  });
  await page.mouse.click(point.x, point.y);
  await expect(panel(page)).toBeVisible();
  await page.getByRole('button', { name: '인물 근거 닫기' }).click();
  await expect(page.getByRole('button', { name: '얀델 · 부모 관계 근거 보기', exact: true })).toBeFocused();
  await page.getByRole('textbox', { name: '가계도 인물 검색' }).fill('얀델');
  await page.getByRole('button', { name: '얀델 설정 근거 보기', exact: true }).first().click();
  expect(api.calls.graphs.every(query => !query.has('focusCharacterId'))).toBe(true);
  await page.getByRole('button', { name: '인물 근거 닫기' }).click();
  api.register(); await page.reload(); await expect(mention).toBeVisible(); expect(api.calls.mutations).toEqual([]);
  await mention.click(); await panel(page).getByRole('button', { name: '프로필 연결', exact: true }).click();
  await expect(page.getByRole('region', { name: '가족 관계 후보 검토' })).toBeFocused();
  await page.getByRole('button', { name: '근거로 돌아가기', exact: true }).click();
  await expect(panel(page).getByRole('button', { name: '프로필 연결', exact: true })).toBeFocused();
  await panel(page).getByRole('button', { name: '프로필 연결', exact: true }).click();
  await expect(page.getByRole('button', { name: '가계도에 반영하기', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button').filter({ has: page.getByText('실제 가족이에요', { exact: true }) })).toHaveCount(0);
  await expect(page.getByRole('button', { name: '근거로 돌아가기', exact: true })).toBeVisible();
  await page.getByRole('button', { name: '얀델 프로필 선택' }).click();
  await page.getByRole('button', { name: '얀델 첫 등장 회차 미확인' }).click();
  expect(api.calls.mutations).toEqual([]);
  await page.getByRole('button', { name: '프로필 연결하기', exact: true }).click();
  await expect(page.getByRole('button', { name: '얀델 프로필 열기', exact: true })).toBeVisible(); await expect(mention).toHaveCount(0);
  await expect(panel(page)).toHaveCount(0); expect(api.calls.profiles).toEqual([]);
  await expect(page.getByRole('textbox', { name: '가계도 인물 검색' })).toBeFocused();
  expect(api.calls.mutations).toEqual([`PUT ${prefix}/relationship-candidates/${candidateId}`, `POST ${prefix}/relationship-candidates/${candidateId}/confirm`]);
});

test('표시 중인 미등록 가족을 모름으로 저장하면 가계도에서 빠지고 재판단한 뒤에만 돌아온다', async ({ page, context }) => {
  const api = await setup(context);
  await page.goto(`${workspace}&relationshipCandidate=${candidateId}`);
  const mention = page.getByRole('button', { name: '얀델 설정 근거 보기', exact: true });
  await expect(mention).toBeVisible();
  await panel(page).getByRole('button', { name: '프로필 연결', exact: true }).click();
  await expect(page.getByText('가족 관계예요', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: '판단 변경', exact: true }).click();
  await page.getByRole('button').filter({ has: page.getByText('아직 모르겠어요', { exact: true }) }).click();
  expect(api.calls.mutations).toEqual([]);
  await page.getByRole('button', { name: '판단 저장', exact: true }).click();
  await expect(mention).toHaveCount(0);
  expect(api.candidate()).toMatchObject({ status: 'PENDING', assertion: 'UNCERTAIN', displayableAsMention: false });
  expect(api.calls.saves).toEqual([expect.objectContaining({ assertion: 'UNCERTAIN', expectedVersion: 0 })]);
  expect(api.calls.mutations).toEqual([`PUT ${prefix}/relationship-candidates/${candidateId}`]);
  await page.reload();
  await expect(mention).toHaveCount(0);
  await page.getByRole('button', { name: '확인·연결 1', exact: true }).click();
  await page.getByRole('button', { name: '비요른 가족 얀델 관계 확인', exact: true }).click();
  await expect(page.getByRole('button').filter({ has: page.getByText('아직 모르겠어요', { exact: true }) })).toBeVisible();
  await page.getByRole('button').filter({ has: page.getByText('실제 가족이에요', { exact: true }) }).click();
  await page.getByRole('button', { name: '판단 저장', exact: true }).click();
  await expect(page.getByText('가족 관계예요', { exact: true })).toBeVisible();
  expect(api.candidate()).toMatchObject({ status: 'PENDING', assertion: 'ASSERTED', displayableAsMention: true });
  expect(api.calls.saves[1]).toMatchObject({ assertion: 'ASSERTED', expectedVersion: 1 });
  expect(api.calls.mutations).toEqual([`PUT ${prefix}/relationship-candidates/${candidateId}`, `PUT ${prefix}/relationship-candidates/${candidateId}`]);
  await page.getByRole('button', { name: '가계도', exact: true }).click();
  await expect(mention).toBeVisible();
  expect(api.calls.profiles).toEqual([]);
});

test('같은 이름의 별도 언급은 합치지 않고 각 출처를 연다', async ({ page, context }) => {
  const api = await setup(context, { duplicate: true });
  await page.goto(workspace);
  const mentions = page.getByRole('button', { name: '얀델 설정 근거 보기', exact: true });
  await expect(mentions).toHaveCount(2);
  await page.getByRole('textbox', { name: '가계도 인물 검색' }).fill('얀델');
  await expect(page.locator('.family-tree-person.is-mention[data-highlight="search"]')).toHaveCount(2);
  expect(api.calls.graphs.every(query => !query.has('focusCharacterId'))).toBe(true);
  await page.getByRole('textbox', { name: '가계도 인물 검색' }).fill('');
  await expect(page.locator('.family-tree-person[data-highlight]')).toHaveCount(0);
  await mentions.nth(0).click(); await expect(page).toHaveURL(new RegExp(`relationshipCandidate=${candidateId}`));
  await page.getByRole('button', { name: '인물 근거 닫기' }).click();
  await mentions.nth(1).click(); await expect(page).toHaveURL(new RegExp(`relationshipCandidate=${secondCandidateId}`));
  await expect(panel(page)).toContainText('다른 자녀'); expect(api.calls.profiles).toEqual([]); expect(api.calls.mutations).toEqual([]);
});

test('공유 부모 연결에서도 언급 근거와 등록 관계 근거를 구분한다', async ({ page, context }) => {
  const api = await setup(context, { sharedParents: true });
  await page.goto(workspace);
  await page.getByRole('button', { name: '비요른 · 자녀 관계 2개 근거 보기', exact: true }).click();
  const group = page.getByRole('region', { name: '선택한 가족 연결' });
  await group.getByRole('button', { name: '얀델 → 비요른 관계 근거 보기' }).click();
  await expect(panel(page)).toContainText('얀델의 아들 비요른'); expect(api.calls.relations).toEqual([]);
  await page.getByRole('button', { name: '인물 근거 닫기' }).click();
  await expect(group.getByRole('button', { name: '얀델 → 비요른 관계 근거 보기' })).toBeFocused();
  await group.getByRole('button', { name: '어머니 → 비요른 관계 근거 보기' }).click();
  await expect(page.getByRole('article', { name: '선택한 관계 근거' })).toBeVisible();
  await expect.poll(() => api.calls.relations).toContain(`${prefix}/relationships/${motherRelationId}`); expect(api.calls.profiles).toEqual([]);
});

test('320px 언급 인물 근거와 수정은 넘치지 않고 조회 오류에 기존 근거를 노출하지 않는다', async ({ page, context }, testInfo) => {
  const api = await setup(context); await page.setViewportSize({ width: 320, height: 568 });
  await page.goto(`${workspace}&relationshipCandidate=${candidateId}`);
  await expect(page.getByRole('button', { name: '얀델 설정 근거 보기', exact: true })).toBeVisible();
  await page.getByRole('region', { name: '가계도', exact: true }).screenshot({ path: testInfo.outputPath('mention-tree-mobile-320.png') });
  const childBounds = await page.getByRole('button', { name: '비요른 프로필 열기', exact: true }).boundingBox();
  const controls = await page.getByRole('button', { name: '전체 보기', exact: true }).boundingBox();
  expect(childBounds!.y + childBounds!.height).toBeLessThan(controls!.y);
  await expect(panel(page)).toContainText('얀델의 아들 비요른');
  await panel(page).getByRole('button', { name: '관계 내용 수정', exact: true }).click();
  await expect(page.getByRole('region', { name: '가족 관계 후보 검토' })).toBeFocused();
  await page.getByRole('button', { name: '근거로 돌아가기', exact: true }).click();
  await expect(panel(page).getByRole('button', { name: '관계 내용 수정', exact: true })).toBeFocused();
  await panel(page).getByRole('button', { name: '관계 내용 수정', exact: true }).click();
  await page.getByRole('button', { name: '얀델 프로필 선택' }).click();
  await expect(page.getByRole('button', { name: '얀델 프로필 선택', exact: true })).toHaveAttribute('aria-expanded', 'true');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  await page.getByRole('textbox', { name: '시점 설명', exact: true }).fill('입력 유지 확인');
  api.fail(true); await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await expect(panel(page).getByRole('alert')).toBeVisible({ timeout: 12000 });
  await expect(panel(page).getByText('얀델의 아들 비요른', { exact: true }).filter({ visible: true })).toHaveCount(0);
  api.fail(false); await panel(page).getByRole('button', { name: '다시 불러오기' }).click();
  await expect(panel(page)).toContainText('얀델의 아들 비요른');
  await expect(page.getByRole('textbox', { name: '시점 설명', exact: true })).toHaveValue('입력 유지 확인');
  expect(api.calls.profiles).toEqual([]);
});
