import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { expect } from '@playwright/test';
import { test } from './local-live-fixture';
import type { RelationshipCandidateResponse, RelationshipProcessingResponse, RelationshipResponse, RelationshipSourceResponse } from '../src/app/api/generated/types.gen';

test.skip(process.env.VITE_RELATIONSHIP_WORKSPACE_ENABLED === 'false', '관계 화면을 명시적으로 비활성화한 실행에서는 건너뜁니다.');

const execute = promisify(execFile);

test('실제 현재 설정 저장 → 자동 관계·검토 후보 → 수정·확정·근거 변경·제외·철회', async ({ page, request, liveAccount }, testInfo) => {
  test.setTimeout(120_000);
  const login = await request.post(`${liveAccount.api}/api/v1/auth/login`, { data: { email: liveAccount.email, password: liveAccount.password } });
  expect(login.ok()).toBeTruthy();
  const token = (await login.json()).data.accessToken as string;
  const headers = { Authorization: `Bearer ${token}` };
  const created = await request.post(`${liveAccount.api}/api/v1/works`, { headers,
    data: { title: '가족 관계 실제 연동 검증', genre: '판타지', description: '현재 프로필 기반 관계 검토 테스트' } });
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
  await profile('서준', '배우자: 민지');
  await profile('민지', '아버지: 미등록인물');
  await expect.poll(async () => (await read<RelationshipProcessingResponse>('/relationship-processing')).state, { timeout: 20000 }).toBe('SUCCEEDED');
  const relations = await read<{content: RelationshipResponse[]}>('/relationships');
  expect(relations.content).toEqual(expect.arrayContaining([expect.objectContaining({ kind: 'SPOUSE', validity: 'VALID' })]));
  const pending = await read<{content: RelationshipCandidateResponse[]; totalElements: number}>('/relationship-candidates?status=PENDING');
  expect(pending.totalElements).toBe(1);
  expect(pending.content[0]).toMatchObject({ objectMention: '미등록인물', status: 'PENDING', origin: 'CURRENT_SETTING_RULE' });
  await page.addInitScript(accessToken => { localStorage.setItem('accessToken', accessToken); localStorage.removeItem('catchhole_demo_mode'); }, token);
  await page.goto(`/dashboard?workId=${workId}&nav=graph&relationView=list`);
  await expect(page.getByRole('button', { name: '관계도', exact: true })).toHaveClass(/is-active/);
  await expect(page.getByRole('button', { name: '현재 설정에서 관계 찾기', exact: true })).toHaveCount(0);
  await expect(page.locator('.family-relation-row').filter({ hasText: '서준' }).filter({ hasText: '민지' })).toBeVisible();
  await page.getByRole('button', { name: '관계 근거 보기' }).click();
  await expect(page.getByText('배우자: 민지', { exact: true })).toBeVisible();
  await expect(page.getByText('직접 수정한 설정', { exact: true })).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('family-relationships-desktop.png'), fullPage: true });
  await page.getByRole('button', { name: '확인·연결 1', exact: true }).click();
  await page.getByRole('button', { name: '민지 가족 미등록인물 프로필 연결' }).click();
  await page.getByRole('button', { name: '미등록인물 프로필 선택' }).click();
  await page.getByRole('button', { name: '도윤 등록된 인물', exact: true }).click();
  await page.getByRole('button', { name: '프로필 연결하기', exact: true }).click();
  await expect(page.getByText('확인이 필요한 가족 관계가 없어요.', { exact: true })).toBeVisible();
  const confirmed = await read<RelationshipCandidateResponse>(`/relationship-candidates/${pending.content[0].id}`);
  expect(confirmed).toMatchObject({ status: 'CONFIRMED', objectCharacterId: people['도윤'], automaticallyConfirmed: false });
  const parent = await read<RelationshipResponse>(`/relationships/${confirmed.confirmedRelationshipId}`);
  expect(parent).toMatchObject({ kind: 'PARENT_OF', subjectCharacterId: people['도윤'], objectCharacterId: people['민지'], validity: 'VALID' });
  await profile('민지', '아버지: 다른미등록인물');
  await expect.poll(async () => (await read<RelationshipProcessingResponse>('/relationship-processing')).state, { timeout: 20000 }).toBe('SUCCEEDED');
  expect(await read<RelationshipResponse>(`/relationships/${parent.id}`)).toMatchObject({ validity: 'REVIEW_REQUIRED', visibleInFamilyTree: false });
  await page.reload();
  await page.getByRole('button', { name: '민지 가족 다른미등록인물 프로필 연결' }).click();
  await page.getByRole('button', { name: '판단 변경', exact: true }).click();
  await page.getByRole('button').filter({ has: page.getByText('가족이 아니에요', { exact: true }) }).click();
  await page.getByRole('button', { name: '판단 저장', exact: true }).click();
  await expect(page.getByText('확인이 필요한 가족 관계가 없어요.', { exact: true })).toBeVisible();
  // 일반 상태의 재처리 버튼은 노출하지 않는다. 제외 보존 검증을 위한 서버 재실행만 요청한다.
  const reprocess = await request.post(`${prefix}/relationship-processing`, { headers });
  expect(reprocess.ok()).toBeTruthy();
  await expect.poll(async () => (await read<RelationshipProcessingResponse>('/relationship-processing')).state, { timeout: 20000 }).toBe('SUCCEEDED');
  expect((await read<{totalElements: number}>('/relationship-candidates?status=PENDING')).totalElements).toBe(0);
  await expect(page.getByText('최근 가족 관계 정리 결과', { exact: true })).toHaveCount(0);
  await expect(page.getByText('현재 설정의 가족 관계를 정리했어요.', { exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: '가족 관계 목록', exact: true }).click();
  const parentCard = page.getByRole('article').filter({ has: page.locator(`.family-relation-row[data-relationship-id="${parent.id}"]`) });
  await parentCard.getByRole('button', { name: '관계 근거 보기' }).click();
  await parentCard.getByRole('button', { name: '이 연결 삭제' }).click();
  await parentCard.getByRole('button', { name: '삭제하기', exact: true }).click();
  await expect(parentCard.getByText('삭제된 연결', { exact: true })).toBeVisible();
  expect(await read<RelationshipResponse>(`/relationships/${parent.id}`)).toMatchObject({ validity: 'WITHDRAWN' });
  const spouseCard = page.getByRole('article').filter({ has: page.locator('.family-relation-row').filter({ hasText: '서준' }).filter({ hasText: '민지' }) });
  await expect(spouseCard.getByText('반영됨', { exact: true })).toBeVisible();
  // Reopening an old candidate reads the current fact without silently adopting its new token.
  await profile('도윤', '아버지: 미등록부모');
  await expect.poll(async () => (await read<RelationshipProcessingResponse>('/relationship-processing')).state, { timeout: 20_000 }).toBe('SUCCEEDED');
  const sourceCandidate = (await read<{ content: RelationshipCandidateResponse[] }>('/relationship-candidates?status=PENDING')).content
    .find(candidate => candidate.subjectCharacterId === people['도윤'] && candidate.objectMention === '미등록부모')!;
  expect(sourceCandidate).toBeTruthy();
  const sourceCandidatePath = `/relationship-candidates/${sourceCandidate.id}`;
  const writes: string[] = [];
  page.on('request', incoming => {
    if (incoming.method() !== 'GET' && new URL(incoming.url()).pathname.startsWith(`/api/v1/works/${workId}`)) {
      writes.push(`${incoming.method()} ${new URL(incoming.url()).pathname}`);
    }
  });
  await page.goto(`/dashboard?workId=${workId}&nav=graph&relationView=review&relationshipCandidate=${sourceCandidate.id}`);
  await page.getByText('관계 내용 수정', { exact: true }).click();
  await page.getByLabel('시점 설명', { exact: true }).fill('자동 조회 중 보존할 시점');
  await expect(page.getByRole('button', { name: '변경사항 저장', exact: true })).toBeEnabled();
  await expect(page.getByRole('button', { name: '최신 설정 불러오기', exact: true })).toHaveCount(0);
  await expect(page.getByRole('checkbox')).toHaveCount(0);
  await profile('도윤', '친아버지: 미등록부모');
  await expect.poll(async () => (await read<RelationshipProcessingResponse>('/relationship-processing')).state, { timeout: 20_000 }).toBe('SUCCEEDED');
  await expect(page.getByRole('checkbox')).toBeVisible({ timeout: 10_000 });
  await expect(page.getByRole('checkbox')).not.toBeChecked();
  await expect(page.getByLabel('시점 설명', { exact: true })).toHaveValue('자동 조회 중 보존할 시점');
  await expect(page.getByRole('button', { name: '변경사항 저장', exact: true })).toBeDisabled();
  expect((await read<RelationshipCandidateResponse>(sourceCandidatePath)).evidence?.map(source => source.sourceToken))
    .toEqual(sourceCandidate.evidence?.map(source => source.sourceToken));
  expect(writes).toEqual([]);
  await page.reload();
  await page.getByText('관계 내용 수정', { exact: true }).click();
  await expect(page.getByRole('checkbox')).not.toBeChecked();
  await page.getByLabel('시점 설명', { exact: true }).fill('현재 근거를 읽고 저장한 시점');
  const currentSources = await read<RelationshipSourceResponse[]>(`/relationship-sources?characterId=${people['도윤']}`);
  expect(currentSources).toHaveLength(1);
  expect(currentSources[0].contextToken).not.toBe(sourceCandidate.evidence?.[0].sourceToken);
  expect(currentSources[0].factId).not.toBe(sourceCandidate.evidence?.[0].sourceFactId);
  await page.getByRole('checkbox').check();
  await expect(page.getByRole('button', { name: '변경사항 저장', exact: true })).toBeDisabled();
  expect(writes).toEqual([]);
  await page.getByRole('button', { name: '기존 근거 제거', exact: true }).click();
  await expect(page.getByRole('button', { name: '변경사항 저장', exact: true })).toBeEnabled();
  await page.getByRole('button', { name: '변경사항 저장', exact: true }).click();
  await expect(page.getByText('수정한 내용을 저장했어요.', { exact: false })).toBeVisible();
  const savedCurrent = await read<RelationshipCandidateResponse>(sourceCandidatePath);
  expect(savedCurrent).toMatchObject({ status: 'PENDING', version: sourceCandidate.version! + 1, timeLabel: '현재 근거를 읽고 저장한 시점' });
  expect(savedCurrent.evidence).toEqual([expect.objectContaining({ sourceFactId: currentSources[0].factId, sourceToken: currentSources[0].contextToken, current: true })]);
  expect(writes).toEqual([`PUT /api/v1/works/${workId}${sourceCandidatePath}`]);
  await page.getByRole('region', { name: '가족 관계 후보 검토', exact: true }).screenshot({ path: testInfo.outputPath('family-current-source-live.png') });
  await page.getByRole('button', { name: '가족 관계 목록', exact: true }).click();
  await page.setViewportSize({ width: 320, height: 844 });
  await page.screenshot({ path: testInfo.outputPath('family-relationships-mobile.png'), fullPage: true });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBeTruthy();
});
