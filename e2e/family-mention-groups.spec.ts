import { expect, test, type BrowserContext, type Page, type Route } from '@playwright/test';
import type { RelationshipCandidateResponse, RelationshipMentionGroupResponse } from '../src/app/api/generated/types.gen';

test.skip(process.env.VITE_RELATIONSHIP_WORKSPACE_ENABLED === 'false', '관계 화면을 명시적으로 비활성화한 실행에서는 건너뜁니다.');
const workId = '11111111-1111-4111-8111-111111111111';
const first = '30000000-0000-4000-8000-000000000001';
const second = '30000000-0000-4000-8000-000000000002';
const third = '30000000-0000-4000-8000-000000000003';
const groupId = '60000000-0000-4000-8000-000000000001';
const prefix = `/api/v1/works/${workId}`;
const workspace = `/dashboard?workId=${workId}&nav=graph&relationMode=family`;
const panel = (page: Page) => page.getByRole('article', { name: '언급된 인물 근거' });
const groupPanel = (page: Page) => panel(page).getByRole('region', { name: '같은 인물 묶음' });
function success(route: Route, data: unknown) {
  return route.fulfill({ contentType: 'application/json', body: JSON.stringify({ success: true, data, error: null }) });
}
function conflict(route: Route) {
  return route.fulfill({ status: 409, contentType: 'application/json',
    body: JSON.stringify({ success: false, message: '선택한 관계가 바뀌었어요.', error: { code: 'CONFLICT', status: 409 } }) });
}

async function setup(context: BrowserContext, options: { grouped?: boolean; unavailable?: boolean; conflictOnce?: boolean; loseResponse?: boolean; reviewReasons?: string[] } = {}) {
  let group: RelationshipMentionGroupResponse | null = options.grouped
    ? { id: groupId, name: '태조', version: 0, active: true, candidateIds: [first, second], reviewReasons: options.reviewReasons ?? [] } : null;
  const candidates: RelationshipCandidateResponse[] = [first, second, ...(options.unavailable ? [third] : [])].map((id, index) => ({
    id, version: index + 2, status: 'PENDING', origin: 'CURRENT_SETTING_RULE', kind: 'DESCENDANT_OF', subtype: 'BIOLOGICAL',
    temporalScope: 'CURRENT', assertion: 'ASSERTED', subjectCharacterId: `20000000-0000-4000-8000-00000000000${index + 1}`,
    subjectCharacterName: ['이성계', '이방원', '다른 후손'][index], objectMention: '태조', generationGap: [5, 6, 8][index],
    displayableAsMention: true, reviewReasons: ['UNRESOLVED_TARGET'],
    mentionGroupId: options.grouped && index < 2 ? groupId : index === 2 ? '60000000-0000-4000-8000-000000000002' : undefined,
    evidence: [{ sourceFactId: `50000000-0000-4000-8000-00000000000${index + 1}`, sourceToken: String(index + 1).repeat(64),
      characterId: `20000000-0000-4000-8000-00000000000${index + 1}`, current: true, hasEvidence: true, factKey: 'profile.family',
      currentValue: { factValue: `태조의 ${[5, 6, 8][index]}대손 ${['이성계', '이방원', '다른 후손'][index]}` } }],
  }));
  const calls = { bodies: [] as Array<{ requestId: string; name: string; candidates: Array<{ candidateId: string; expectedVersion: number }> }>,
    ungroup: [] as Array<{ expectedVersion: number }>, mutations: [] as string[], candidateReads: [] as string[] };
  let attemptedConflict = false, lostResponse = false;
  const graph = () => {
    const grouped = group?.active === true;
    const nodes = candidates.filter(item => item.id !== third).flatMap(item => [
      { id: item.subjectCharacterId, characterId: item.subjectCharacterId, name: item.subjectCharacterName, nodeType: 'CHARACTER' },
      ...(!grouped ? [{ id: `mention:${item.id}`, name: item.objectMention, nodeType: 'MENTION', candidateId: item.id, candidateIds: [item.id] }] : []),
    ]);
    if (grouped) nodes.push({ id: `mention-group:${groupId}`, name: '태조', nodeType: 'MENTION',
      candidateIds: [first, second], mentionGroupId: groupId, mentionGroupVersion: group!.version } as typeof nodes[number]);
    const edges = candidates.filter(item => item.id !== third).map(item => ({ id: `mention:${item.id}`, sourceType: 'MENTION',
      candidateId: item.id, subjectNodeId: grouped ? `mention-group:${groupId}` : `mention:${item.id}`,
      objectNodeId: item.subjectCharacterId, objectCharacterId: item.subjectCharacterId, kind: 'ANCESTOR_OF',
      generationGap: item.generationGap, subtype: 'BIOLOGICAL', temporalScope: 'CURRENT' }));
    return { nodes, edges, totalNodeCount: nodes.length, totalEdgeCount: edges.length, pendingCandidateCount: 2,
      optionalLinkCount: 2, truncated: false, limit: 100, revision: `${group?.version}:${grouped}` };
  };
  await context.addInitScript(() => localStorage.setItem('accessToken', 'synthetic-mention-group-token'));
  await context.route('**/api/v1/**', async route => {
    const request = route.request(), url = new URL(request.url()), path = url.pathname;
    if (request.method() !== 'GET') calls.mutations.push(`${request.method()} ${path}`);
    if (path.endsWith('/auth/me')) return success(route, { id: 1, email: 'group@example.test', displayName: '묶음 검증', role: 'AUTHOR', status: 'ACTIVE' });
    if (path === '/api/v1/works') return success(route, [{ id: workId, title: '묶음 검증 작품', genre: '판타지' }]);
    if (path === prefix) return success(route, { id: workId, title: '묶음 검증 작품', genre: '판타지', lifecycleStatus: 'ACTIVE' });
    if (path === `${prefix}/family-tree`) return success(route, graph());
    if (path === `${prefix}/relationship-processing`) return success(route, { state: 'SUCCEEDED', inputVersion: 1, processedVersion: 1, reviewRequiredCount: 2 });
    if (path === `${prefix}/relationship-candidates`) return success(route, { content: candidates, totalElements: candidates.length, totalPages: 1, page: 0, size: 20 });
    if (path.startsWith(`${prefix}/relationship-candidates/`)) {
      const candidate = candidates.find(item => path.endsWith(item.id!));
      if (candidate) { calls.candidateReads.push(candidate.id!); return success(route, candidate); }
    }
    if (path === `${prefix}/relationship-mention-groups` && request.method() === 'POST') {
      const body = request.postDataJSON(); calls.bodies.push(body);
      if (options.conflictOnce && !attemptedConflict) {
        attemptedConflict = true;
        candidates[1] = { ...candidates[1], version: candidates[1].version! + 1, evidence: [{
          ...candidates[1].evidence![0], sourceToken: 'd'.repeat(64), currentValue: { factValue: '태조의 6대손 이방원 · 최신 근거' },
        }] };
        return conflict(route);
      }
      group = { id: groupId, name: body.name, version: 0, active: true, candidateIds: body.candidates.map((item: { candidateId: string }) => item.candidateId), reviewReasons: [] };
      for (const candidate of candidates) if (group.candidateIds!.includes(candidate.id!)) candidate.mentionGroupId = groupId;
      if (options.loseResponse && !lostResponse) { lostResponse = true; return route.abort('failed'); }
      return success(route, group);
    }
    if (path === `${prefix}/relationship-mention-groups/${groupId}/ungroup`) {
      const body = request.postDataJSON(); calls.ungroup.push(body);
      expect(body.expectedVersion).toBe(group?.version);
      group = { ...group!, version: group!.version! + 1, active: false };
      for (const candidate of candidates) if (candidate.mentionGroupId === groupId) candidate.mentionGroupId = undefined;
      return success(route, group);
    }
    if (path === `${prefix}/relationship-mention-groups/${groupId}`) return success(route, group);
    if (path === `${prefix}/characters`) return success(route, { content: [], totalPages: 0, totalElements: 0 });
    if (path.includes('/character-facts/') && path.endsWith('/evidence')) {
      return success(route, { content: '태조의 후손이라는 원문', evidenceSpans: [{ quote: '태조의 후손이라는 원문', startOffset: 0, endOffset: 12 }], episode: { episodeNo: 1, title: '가문의 기록' } });
    }
    return success(route, []);
  });
  return { calls, candidates, group: () => group };
}

async function chooseSecond(page: Page) {
  await panel(page).getByRole('button', { name: '같은 인물로 묶기', exact: true }).click();
  await expect(groupPanel(page).getByRole('heading', { name: '같은 인물로 묶을 관계 선택' })).toBeFocused();
  await groupPanel(page).getByRole('checkbox', { name: '태조 이방원의 조상 · 6대손' }).check();
  await expect(groupPanel(page).getByRole('button', { name: '선택한 2개 관계 묶기' })).toBeEnabled();
}

test('동명이인을 자동 선택하지 않고 두 관계·근거 확인 후 묶기, 전환, 해제가 가능하다', async ({ page, context }) => {
  const api = await setup(context, { unavailable: true });
  await page.goto(workspace);
  const mentions = page.getByRole('button', { name: '태조 설정 근거 보기', exact: true });
  await expect(mentions).toHaveCount(2);
  await mentions.first().click();
  await chooseSecond(page);
  await expect(groupPanel(page).getByRole('checkbox', { name: /다른 후손의 조상/ })).toBeDisabled();
  await expect(groupPanel(page).getByRole('button', { name: '선택한 근거 다시 확인' })).toHaveCount(0);
  const preview = groupPanel(page).locator('[aria-label="선택한 관계와 근거"]');
  await expect(preview).toContainText('이성계의 조상 태조');
  await expect(preview).toContainText('태조의 5대손 이성계');
  await expect(preview).toContainText('이방원의 조상 태조');
  await expect(preview).toContainText('태조의 6대손 이방원');
  expect(api.calls.mutations).toEqual([]);
  await groupPanel(page).getByRole('button', { name: '선택한 2개 관계 묶기' }).click();
  await expect(mentions).toHaveCount(1);
  await expect(groupPanel(page).getByRole('heading', { name: '태조의 관계 2개' })).toBeVisible();
  expect(api.calls.bodies).toHaveLength(1);
  expect(api.calls.bodies[0]).toEqual({ requestId: expect.any(String), name: '태조',
    candidates: [{ candidateId: first, expectedVersion: 2 }, { candidateId: second, expectedVersion: 3 }] });
  await groupPanel(page).getByRole('button', { name: /이방원의 조상 태조/ }).click();
  await expect(page).toHaveURL(new RegExp(`relationshipCandidate=${second}`));
  await expect(panel(page).locator('[aria-label="관계의 바탕이 된 설정"]')).toContainText('태조의 6대손 이방원');
  await expect(groupPanel(page).getByRole('button', { name: /이방원의 조상 태조/ })).toHaveAttribute('aria-pressed', 'true');
  await groupPanel(page).getByRole('button', { name: '묶기 해제', exact: true }).click();
  await expect(mentions).toHaveCount(2);
  expect(api.calls.ungroup).toEqual([{ expectedVersion: 0 }]);
  expect(api.calls.mutations).toEqual([`POST ${prefix}/relationship-mention-groups`, `POST ${prefix}/relationship-mention-groups/${groupId}/ungroup`]);
  expect(api.candidates.map(item => item.evidence?.[0]?.currentValue)).toEqual([
    { factValue: '태조의 5대손 이성계' }, { factValue: '태조의 6대손 이방원' }, { factValue: '태조의 8대손 다른 후손' },
  ]);
});

test('묶기 충돌은 선택과 근거를 보존하며 최신 근거를 확인한 다음 버전으로 다시 보낸다', async ({ page, context }) => {
  const api = await setup(context, { conflictOnce: true });
  await page.goto(`${workspace}&relationshipCandidate=${first}`);
  await chooseSecond(page);
  const save = groupPanel(page).getByRole('button', { name: '선택한 2개 관계 묶기' });
  await save.click();
  await expect(groupPanel(page).getByRole('alert')).toContainText('선택한 관계가 바뀌었어요.');
  await expect(save).toBeDisabled();
  await expect(groupPanel(page).getByRole('checkbox', { name: '태조 이방원의 조상 · 6대손' })).toBeChecked();
  await expect(groupPanel(page)).not.toContainText('최신 근거');
  await groupPanel(page).getByRole('button', { name: '선택한 근거 다시 확인' }).click();
  await expect(groupPanel(page)).toContainText('태조의 6대손 이방원 · 최신 근거');
  await expect(save).toBeEnabled();
  await save.click();
  await expect(groupPanel(page).getByRole('heading', { name: '태조의 관계 2개' })).toBeVisible();
  expect(api.calls.bodies[0].candidates[1].expectedVersion).toBe(3);
  expect(api.calls.bodies[1].candidates[1].expectedVersion).toBe(4);
  expect(api.calls.bodies[0].requestId).not.toBe(api.calls.bodies[1].requestId);
});

test('응답이 유실돼도 같은 선택의 재시도는 같은 requestId를 사용한다', async ({ page, context }) => {
  const api = await setup(context, { loseResponse: true });
  await page.goto(`${workspace}&relationshipCandidate=${first}`);
  await chooseSecond(page);
  const save = groupPanel(page).getByRole('button', { name: '선택한 2개 관계 묶기' });
  await save.click();
  await expect(groupPanel(page).getByRole('alert')).toBeVisible();
  await save.click();
  await expect(groupPanel(page).getByRole('heading', { name: '태조의 관계 2개' })).toBeVisible();
  expect(api.calls.bodies).toHaveLength(2);
  expect(api.calls.bodies[1]).toEqual(api.calls.bodies[0]);
});

test('응답 유실 뒤 조회로 묶기가 확인되면 이전 선택 폼을 닫는다', async ({ page, context }) => {
  const api = await setup(context, { loseResponse: true });
  await page.goto(`${workspace}&relationshipCandidate=${first}`);
  await chooseSecond(page);
  await groupPanel(page).getByRole('button', { name: '선택한 2개 관계 묶기' }).click();
  await expect(groupPanel(page).getByRole('alert')).toBeVisible();
  await page.evaluate(() => window.dispatchEvent(new Event('visibilitychange')));
  await expect(groupPanel(page).getByRole('heading', { name: '태조의 관계 2개' })).toBeVisible();
  await expect(groupPanel(page).getByRole('heading', { name: '같은 인물로 묶을 관계 선택' })).toHaveCount(0);
  expect(api.calls.bodies).toHaveLength(1);
});

test('이미 묶인 노드에서 개별 수정 안내와 320px 선택 화면·취소 초점을 유지한다', async ({ page, context }, testInfo) => {
  await setup(context, { grouped: true });
  await page.setViewportSize({ width: 320, height: 780 });
  await page.goto(workspace);
  await page.getByRole('button', { name: '태조 설정 근거 보기', exact: true }).click();
  await expect(groupPanel(page).getByRole('heading', { name: '태조의 관계 2개' })).toBeVisible();
  await panel(page).getByRole('button', { name: '관계 내용 수정', exact: true }).click();
  await expect(panel(page)).toContainText('이 관계는 같은 인물 묶음에서 빠져요.');
  await panel(page).getByRole('button', { name: '근거로 돌아가기', exact: true }).click();
  await groupPanel(page).getByRole('button', { name: '묶기 해제', exact: true }).click();
  await chooseSecond(page);
  await expect(page.locator('html')).toHaveJSProperty('scrollWidth', 320);
  await groupPanel(page).getByRole('button', { name: '선택한 2개 관계 묶기' }).scrollIntoViewIfNeeded();
  await page.screenshot({ path: testInfo.outputPath('mention-group-mobile.png') });
  await groupPanel(page).getByRole('button', { name: '취소', exact: true }).click();
  await expect(groupPanel(page).getByRole('button', { name: '같은 인물로 묶기', exact: true })).toBeFocused();
});

test('충돌한 묶음은 숨김 사유를 보여 주며 해제할 수 있다', async ({ page, context }) => {
  const api = await setup(context, { grouped: true, reviewReasons: ['GENERATION_GAP_CONFLICT'] });
  await page.goto(`${workspace}&relationshipCandidate=${first}`);
  await expect(groupPanel(page)).toContainText('묶인 관계가 현재 설정과 맞지 않아 가계도에서 숨겨졌어요.');
  await groupPanel(page).getByRole('button', { name: '묶기 해제', exact: true }).click();
  await expect(groupPanel(page).getByRole('button', { name: '같은 인물로 묶기', exact: true })).toBeVisible();
  expect(api.calls.ungroup).toEqual([{ expectedVersion: 0 }]);
});
