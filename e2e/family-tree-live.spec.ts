import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { expect } from '@playwright/test';
import { test } from './local-live-fixture';
import type { FamilyTreeResponse, RelationshipCandidateResponse, RelationshipProcessingResponse, RelationshipResponse } from '../src/app/api/generated/types.gen';

test.skip(process.env.VITE_RELATIONSHIP_WORKSPACE_ENABLED !== 'true', '가계도 미리보기 전용 live 테스트입니다.');

const execute = promisify(execFile);

test('격리된 실제 프로필에서 가계도·과거 관계·근거·철회·인물 보관과 복구를 확인한다', async ({ page, request, liveAccount }, testInfo) => {
  test.setTimeout(150_000);
  page.setDefaultTimeout(15_000);
  const login = await request.post(`${liveAccount.api}/api/v1/auth/login`, { data: { email: liveAccount.email, password: liveAccount.password } });
  expect(login.ok()).toBeTruthy();
  const token = (await login.json()).data.accessToken as string;
  const headers = { Authorization: `Bearer ${token}` };
  const created = await request.post(`${liveAccount.api}/api/v1/works`, { headers,
    data: { title: '가계도 실제 연동 검증', genre: '판타지', description: '현재 프로필 기반 합성 가족 세 명의 가계도 검증' } });
  expect(created.ok()).toBeTruthy();
  const workId = (await created.json()).data.id as string;
  const prefix = `${liveAccount.api}/api/v1/works/${workId}`;
  const seeded = await execute(process.env.CATCHHOLE_E2E_PYTHON ?? 'python3', ['scripts/local-family-relationship-fixture.py',
    '--work-id', workId, '--member-id', String(liveAccount.memberId), '--email', liveAccount.email]);
  const people = JSON.parse(seeded.stdout) as Record<string, string>;
  const read = async <T,>(path: string): Promise<T> => {
    const response = await request.get(prefix + path, { headers });
    expect(response.ok(), `GET ${path} status=${response.status()}`).toBeTruthy();
    return (await response.json()).data as T;
  };
  const profile = async (name: string, value: string) => {
    const response = await request.patch(`${prefix}/characters/${people[name]}`, { headers, data: {
      name, profile: [{ key: 'profile.family', value, valueType: 'STRING', properties: [] }], stats: [], skills: [], items: [], statuses: [],
    } });
    expect(response.ok(), `Profile save status=${response.status()}`).toBeTruthy();
  };
  const waitForProcessing = async () => {
    await expect.poll(async () => (await read<RelationshipProcessingResponse>('/relationship-processing')).state, { timeout: 20_000 }).toBe('SUCCEEDED');
  };
  const graphPath = '/family-tree?includeHistorical=false&limit=100';
  const tree = () => read<FamilyTreeResponse>(graphPath);
  await profile('서준', '배우자: 민지; 아들: 도윤');
  await profile('민지', '아들: 도윤');
  await profile('도윤', '아버지: 서준');
  await waitForProcessing();
  await expect.poll(async () => (await tree()).edges?.length, { timeout: 20_000 }).toBe(3);
  const initial = await tree();
  expect(initial.nodes?.map(person => person.id).sort()).toEqual(Object.values(people).sort());
  expect(initial).toMatchObject({ totalEdgeCount: 3, totalNodeCount: 3, truncated: false, includeHistorical: false });
  const spouse = initial.edges!.find(edge => edge.kind === 'SPOUSE')!;
  const parents = initial.edges!.filter(edge => edge.kind === 'PARENT_OF');
  expect(parents).toEqual(expect.arrayContaining([
    expect.objectContaining({ subjectCharacterId: people['서준'], objectCharacterId: people['도윤'], subjectRole: 'FATHER', objectRole: 'SON' }),
    expect.objectContaining({ subjectCharacterId: people['민지'], objectCharacterId: people['도윤'], subjectRole: 'PARENT', objectRole: 'SON' }),
  ]));
  const graphRequests: string[] = [];
  const unintendedWrites: string[] = [];
  page.on('request', incoming => {
    const path = new URL(incoming.url()).pathname;
    if (path.endsWith('/family-tree')) graphRequests.push(incoming.url());
    if (incoming.method() !== 'GET' && /analysis-jobs|relationship-processing/.test(path)) unintendedWrites.push(path);
  });
  await page.addInitScript(accessToken => { localStorage.setItem('accessToken', accessToken); localStorage.removeItem('catchhole_demo_mode'); }, token);
  await page.goto(`/dashboard?workId=${workId}&nav=graph`);
  const canvas = page.getByRole('region', { name: '가계도', exact: true });
  const representedRelationCount = () => canvas.locator('[data-connection-id]').evaluateAll(controls =>
    controls.flatMap(control => JSON.parse(control.getAttribute('data-relationship-ids') ?? '[]') as string[]).length);
  await expect(canvas.locator('[data-character-id]')).toHaveCount(3);
  await expect.poll(() => representedRelationCount()).toBe(3);
  await expect(canvas.locator(`[data-endpoint-person-id="${people['서준']}"][data-endpoint-role="FATHER"]`)).toBeVisible();
  await expect(canvas.locator(`[data-endpoint-person-id="${people['도윤']}"][data-endpoint-role="SON"]`)).toBeVisible();
  await expect.poll(() => canvas.evaluate(region => {
    const bounds = region.getBoundingClientRect();
    return [...region.querySelectorAll('[data-character-id], [data-connection-id]')].every(element => {
      const box = element.getBoundingClientRect();
      return box.left >= bounds.left && box.right <= bounds.right && box.top >= bounds.top && box.bottom <= bounds.bottom;
    });
  }), { message: '처음 열린 실제 가계도의 인물과 관계가 모두 canvas 안에 보여야 합니다.' }).toBeTruthy();
  await page.getByRole('button', { name: '도윤 프로필 열기', exact: true }).click();
  await expect(page.getByRole('dialog')).toContainText('아버지: 서준');
  expect(new URL(page.url()).searchParams.get('charId')).toBe(people['도윤']);
  await page.keyboard.press('Escape');
  await canvas.locator(`[data-relationship-id="${spouse.id}"]`).click();
  await expect(page.getByText('배우자: 민지; 아들: 도윤', { exact: true })).toBeVisible();
  await expect(page.getByText('직접 수정한 설정', { exact: true })).toBeVisible();
  await expect(page.getByText('조회할 수 있는 원문 근거가 없어요.', { exact: true })).toBeVisible();
  await canvas.screenshot({ path: testInfo.outputPath('family-tree-live-desktop.png') });
  await profile('서준', '전 배우자: 민지');
  await waitForProcessing();
  await expect.poll(async () => (await tree()).edges?.length, { timeout: 20_000 }).toBe(2);
  expect(await read<RelationshipResponse>(`/relationships/${spouse.id}`)).toMatchObject({ validity: 'REVIEW_REQUIRED' });
  await expect.poll(() => representedRelationCount(), { timeout: 10_000 }).toBe(2);
  await page.getByRole('button', { name: '과거 관계 포함', exact: true }).click();
  await expect(page.getByRole('button', { name: '과거 관계 포함', exact: true })).toHaveAttribute('aria-pressed', 'true');
  const withHistory = await read<FamilyTreeResponse>('/family-tree?includeHistorical=true&limit=100');
  const formerSpouse = withHistory.edges!.find(edge => edge.kind === 'SPOUSE' && edge.temporalScope === 'HISTORICAL')!;
  expect(formerSpouse).toBeTruthy();
  await expect.poll(() => representedRelationCount()).toBe(3);
  await canvas.locator(`[data-relationship-id="${formerSpouse.id}"]`).click();
  await expect(page.getByText('전 배우자: 민지', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: '이 연결 삭제', exact: true }).click();
  await page.getByRole('button', { name: '삭제하기', exact: true }).click();
  await expect(canvas.locator(`[data-relationship-id="${formerSpouse.id}"]`)).toHaveCount(0, { timeout: 10_000 });
  expect(await read<RelationshipResponse>(`/relationships/${formerSpouse.id}`)).toMatchObject({ validity: 'WITHDRAWN' });
  const archived = await request.delete(`${prefix}/characters/${people['민지']}`, { headers });
  expect(archived.ok()).toBeTruthy();
  await expect.poll(async () => (await tree()).edges?.length, { timeout: 20_000 }).toBe(1);
  await expect.poll(() => representedRelationCount(), { timeout: 10_000 }).toBe(1);
  const restored = await request.patch(`${prefix}/characters/${people['민지']}/restore`, { headers });
  expect(restored.ok()).toBeTruthy();
  await waitForProcessing();
  await expect.poll(async () => (await tree()).edges?.length, { timeout: 20_000 }).toBe(2);
  await expect.poll(() => representedRelationCount(), { timeout: 10_000 }).toBe(2);
  await page.setViewportSize({ width: 320, height: 740 });
  await canvas.getByRole('button', { name: '전체 보기', exact: true }).click();
  await canvas.scrollIntoViewIfNeeded();
  await page.screenshot({ path: testInfo.outputPath('family-tree-live-mobile-320.png'), fullPage: true });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBeTruthy();
  expect(graphRequests.length).toBeGreaterThan(0);
  expect(unintendedWrites).toEqual([]);
});

test('등록되지 않은 얀델의 가족 판단을 보류·재판단하고 나중에 등록된 인물에 직접 연결한다', async ({ page, request, liveAccount }, testInfo) => {
  test.setTimeout(150_000);
  page.setDefaultTimeout(15_000);
  const login = await request.post(`${liveAccount.api}/api/v1/auth/login`, { data: { email: liveAccount.email, password: liveAccount.password } });
  expect(login.ok()).toBeTruthy();
  const token = (await login.json()).data.accessToken as string;
  const headers = { Authorization: `Bearer ${token}` };
  const created = await request.post(`${liveAccount.api}/api/v1/works`, { headers,
    data: { title: '미등록 가족 이름 실제 연동 검증', genre: '판타지', description: '합성 현재 프로필과 직접 인물 연결 검증' } });
  expect(created.ok()).toBeTruthy();
  const workId = (await created.json()).data.id as string;
  const prefix = `${liveAccount.api}/api/v1/works/${workId}`;
  const seeded = await execute(process.env.CATCHHOLE_E2E_PYTHON ?? 'python3', ['scripts/local-family-relationship-fixture.py',
    '--work-id', workId, '--member-id', String(liveAccount.memberId), '--email', liveAccount.email]);
  const people = JSON.parse(seeded.stdout) as Record<string, string>;
  const read = async <T,>(path: string): Promise<T> => {
    const response = await request.get(prefix + path, { headers });
    expect(response.ok(), `GET ${path} status=${response.status()}`).toBeTruthy();
    return (await response.json()).data as T;
  };
  const profile = async (id: string, name: string, family?: string) => {
    const response = await request.patch(`${prefix}/characters/${id}`, { headers, data: {
      name, profile: family ? [{ key: 'profile.family', value: family, valueType: 'STRING', properties: [] }] : [],
      stats: [], skills: [], items: [], statuses: [],
    } });
    expect(response.ok()).toBeTruthy();
  };
  const tree = () => read<FamilyTreeResponse>('/family-tree?limit=100');
  const characters = () => read<{ content: Array<{ id: string; name: string }>; totalElements: number }>('/characters?page=0&size=12');
  await profile(people['서준'], '비요른', '얀델의 아들');
  await expect.poll(async () => (await tree()).optionalLinkCount, { timeout: 20_000 }).toBe(1);
  const initial = await tree();
  const mention = initial.nodes!.find(node => node.nodeType === 'MENTION')!;
  expect(mention).toMatchObject({ name: '얀델', characterId: null });
  expect(initial.edges).toEqual([expect.objectContaining({ sourceType: 'MENTION', subjectNodeId: mention.id,
    objectNodeId: people['서준'], kind: 'PARENT_OF', relationshipId: null, subjectRole: 'PARENT', objectRole: 'SON' })]);
  expect((await characters()).content.some(character => character.name === '얀델')).toBeFalsy();
  expect((await characters()).totalElements).toBe(3);
  const candidatePath = `/relationship-candidates/${mention.candidateId}`;
  const candidate = await read<RelationshipCandidateResponse>(candidatePath);
  expect(candidate).toMatchObject({ status: 'PENDING', objectCharacterId: null, displayableAsMention: true });
  expect(candidate.evidence?.length).toBeGreaterThan(0);

  const unexpectedRequests: string[] = [];
  const judgmentWrites: Array<{ method: string; path: string }> = [];
  page.on('request', incoming => {
    const path = new URL(incoming.url()).pathname;
    if (incoming.method() !== 'GET' && path.includes(candidatePath)) judgmentWrites.push({ method: incoming.method(), path });
    if ((incoming.method() !== 'GET' && /analysis-jobs|relationship-processing/.test(path))
      || (incoming.method() === 'POST' && path.endsWith('/characters'))
      || path.includes(`/characters/${encodeURIComponent(mention.id!)}`)) unexpectedRequests.push(path);
  });
  await page.addInitScript(accessToken => { localStorage.setItem('accessToken', accessToken); localStorage.removeItem('catchhole_demo_mode'); }, token);
  await page.goto(`/dashboard?workId=${workId}&nav=graph`);
  const canvas = page.getByRole('region', { name: '가계도', exact: true });
  const mentionButton = canvas.getByRole('button', { name: '얀델 설정 근거 보기', exact: true });
  await expect(mentionButton).toBeVisible();
  await expect(canvas.locator(`[data-endpoint-person-id="${mention.id}"][data-endpoint-role="PARENT"]`)).toBeVisible();
  const sonRole = canvas.locator(`[data-endpoint-person-id="${people['서준']}"][data-endpoint-role="SON"]`);
  await expect(sonRole).toBeVisible();
  await sonRole.click();
  await expect(page.getByText('얀델의 아들', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: '인물 근거 닫기', exact: true }).click();
  await canvas.screenshot({ path: testInfo.outputPath('family-mention-tree-live-desktop.png') });
  await mentionButton.click();
  await expect(page.getByText('얀델의 아들', { exact: true })).toBeVisible();
  await expect(page.getByText('얀델의 아들', { exact: true })).toBeInViewport();
  expect(new URL(page.url()).searchParams.get('modal')).not.toBe('char-detail');
  expect(new URL(page.url()).searchParams.get('relationshipCandidate')).toBe(mention.candidateId);
  await page.screenshot({ path: testInfo.outputPath('family-mention-live-desktop.png'), fullPage: true });
  await page.setViewportSize({ width: 320, height: 740 });
  await canvas.getByRole('button', { name: '전체 보기', exact: true }).click();
  await canvas.scrollIntoViewIfNeeded();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBeTruthy();
  await canvas.screenshot({ path: testInfo.outputPath('family-mention-tree-live-mobile-320.png') });
  await page.screenshot({ path: testInfo.outputPath('family-mention-live-mobile-320.png'), fullPage: true });
  await page.setViewportSize({ width: 1280, height: 900 });

  // A saved unknown judgment must remove only this connection, while its fact and profile stay intact.
  await page.getByRole('button', { name: '프로필 연결', exact: true }).click();
  await page.getByRole('button', { name: '판단 변경', exact: true }).click();
  await page.getByRole('button').filter({ has: page.getByText('아직 모르겠어요', { exact: true }) }).click();
  expect(judgmentWrites).toEqual([]);
  await page.getByRole('button', { name: '판단 저장', exact: true }).click();
  await expect.poll(async () => (await read<RelationshipCandidateResponse>(candidatePath)).assertion).toBe('UNCERTAIN');
  const deferred = await read<RelationshipCandidateResponse>(candidatePath);
  expect(deferred).toMatchObject({ status: 'PENDING', objectCharacterId: null, displayableAsMention: false });
  expect(deferred.evidence).toEqual(candidate.evidence);
  expect(deferred.version).toBe(candidate.version! + 1);
  expect((await tree()).nodes?.some(node => node.id === mention.id)).toBeFalsy();
  expect((await tree()).edges?.some(edge => edge.candidateId === mention.candidateId)).toBeFalsy();
  await expect(mentionButton).toHaveCount(0);
  expect(judgmentWrites).toEqual([{ method: 'PUT', path: `/api/v1/works/${workId}${candidatePath}` }]);

  await page.goto(`/dashboard?workId=${workId}&nav=graph&relationView=review&relationshipCandidate=${mention.candidateId}`);
  await page.getByRole('button').filter({ has: page.getByText('실제 가족이에요', { exact: true }) }).click();
  expect(judgmentWrites).toHaveLength(1);
  await page.getByRole('button', { name: '판단 저장', exact: true }).click();
  await expect(page.getByText('가족 관계예요', { exact: true })).toBeVisible();
  const restoredCandidate = await read<RelationshipCandidateResponse>(candidatePath);
  expect(restoredCandidate).toMatchObject({ assertion: 'ASSERTED', status: 'PENDING', objectCharacterId: null, displayableAsMention: true });
  expect(restoredCandidate.evidence).toEqual(candidate.evidence);
  expect(restoredCandidate.version).toBe(deferred.version! + 1);
  expect(judgmentWrites).toHaveLength(2);
  expect(judgmentWrites[1]).toEqual({ method: 'PUT', path: `/api/v1/works/${workId}${candidatePath}` });
  expect((await tree()).nodes!.find(node => node.nodeType === 'MENTION')!.id).toBe(mention.id);
  await page.goto(`/dashboard?workId=${workId}&nav=graph`);
  await expect(mentionButton).toBeVisible();
  await mentionButton.click();
  await expect(page.getByText('얀델의 아들', { exact: true })).toBeVisible();

  // Make the exact-name target available later via the public profile API. Its identity stays distinct.
  await profile(people['민지'], '얀델');
  await expect.poll(async () => (await read<RelationshipProcessingResponse>('/relationship-processing')).state, { timeout: 20_000 }).toBe('SUCCEEDED');
  expect((await tree()).nodes!.find(node => node.nodeType === 'MENTION')!.id).toBe(mention.id);
  expect(await read<RelationshipCandidateResponse>(candidatePath)).toMatchObject({ status: 'PENDING', objectCharacterId: null });
  await page.getByRole('button', { name: '프로필 연결', exact: true }).click();
  await page.getByRole('button', { name: '얀델 프로필 선택', exact: true }).click();
  await page.locator('.relationship-character-choices').getByRole('button', { name: /얀델/ }).click();
  await page.getByRole('button', { name: '프로필 연결하기', exact: true }).click();
  await expect.poll(async () => (await tree()).optionalLinkCount).toBe(0);
  await expect.poll(async () => (await read<RelationshipCandidateResponse>(candidatePath)).status).toBe('CONFIRMED');
  const linked = await tree();
  expect(linked.nodes?.some(node => node.nodeType === 'MENTION')).toBeFalsy();
  expect(linked.edges).toEqual([expect.objectContaining({ sourceType: 'RELATIONSHIP', subjectCharacterId: people['민지'],
    objectCharacterId: people['서준'], kind: 'PARENT_OF', subjectRole: 'PARENT', objectRole: 'SON' })]);
  await expect(canvas.getByRole('button', { name: '얀델 프로필 열기', exact: true })).toBeVisible();
  await expect(mentionButton).toHaveCount(0);
  expect((await characters()).totalElements).toBe(3);
  expect(unexpectedRequests).toEqual([]);
  await page.screenshot({ path: testInfo.outputPath('family-mention-linked-live-desktop.png'), fullPage: true });
});
