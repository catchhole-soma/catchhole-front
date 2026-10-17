import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { expect } from '@playwright/test';
import { test } from './local-live-fixture';
import type { RelationshipCandidateResponse, RelationshipProcessingResponse, RelationshipResponse } from '../src/app/api/generated/types.gen';

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
  await page.goto(`/dashboard?workId=${workId}&nav=settingDB&tab=relations`);
  await expect(page.getByRole('heading', { name: /서준.*민지|민지.*서준/ })).toBeVisible();
  await page.getByRole('button', { name: '관계 근거 보기' }).click();
  await expect(page.getByText('배우자: 민지', { exact: true })).toBeVisible();
  await expect(page.getByText('직접 수정한 설정', { exact: true })).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('family-relationships-desktop.png'), fullPage: true });
  await page.getByRole('button', { name: '확인 필요 1', exact: true }).click();
  await page.getByRole('button', { name: '민지 · 미등록인물 관계 확인' }).click();
  await page.getByRole('button', { name: '상대 인물 선택' }).click();
  await page.getByRole('button', { name: '도윤 등록된 인물', exact: true }).click();
  await page.getByRole('button', { name: '수정 저장' }).click();
  await expect(page.getByRole('button', { name: '관계에 반영' })).toBeEnabled();
  await page.getByRole('button', { name: '관계에 반영' }).click();
  await expect(page.getByText('확인이 필요한 가족 관계가 없어요.', { exact: true })).toBeVisible();
  const confirmed = await read<RelationshipCandidateResponse>(`/relationship-candidates/${pending.content[0].id}`);
  expect(confirmed).toMatchObject({ status: 'CONFIRMED', objectCharacterId: people['도윤'], automaticallyConfirmed: false });
  const parent = await read<RelationshipResponse>(`/relationships/${confirmed.confirmedRelationshipId}`);
  expect(parent).toMatchObject({ kind: 'PARENT_OF', subjectCharacterId: people['도윤'], objectCharacterId: people['민지'], validity: 'VALID' });
  await profile('민지', '아버지: 다른미등록인물');
  await expect.poll(async () => (await read<RelationshipProcessingResponse>('/relationship-processing')).state, { timeout: 20000 }).toBe('SUCCEEDED');
  expect(await read<RelationshipResponse>(`/relationships/${parent.id}`)).toMatchObject({ validity: 'REVIEW_REQUIRED', visibleInFamilyTree: false });
  await page.reload();
  await page.getByRole('button', { name: '민지 · 다른미등록인물 관계 확인' }).click();
  await page.getByRole('button', { name: '후보 제외' }).click();
  await expect(page.getByText('확인이 필요한 가족 관계가 없어요.', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: '현재 설정에서 관계 찾기' }).click();
  await expect.poll(async () => (await read<RelationshipProcessingResponse>('/relationship-processing')).state, { timeout: 20000 }).toBe('SUCCEEDED');
  expect((await read<{totalElements: number}>('/relationship-candidates?status=PENDING')).totalElements).toBe(0);
  await expect(page.getByText('현재 설정의 가족 관계를 정리했어요.', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: '가족 관계 목록', exact: true }).click();
  const parentCard = page.getByRole('article').filter({ has: page.getByRole('heading', { name: '도윤 → 민지' }) });
  await parentCard.getByRole('button', { name: '관계 근거 보기' }).click();
  await parentCard.getByRole('button', { name: '잘못된 관계 철회' }).click();
  await parentCard.getByRole('button', { name: '관계 철회', exact: true }).click();
  await expect(parentCard.getByText('철회된 관계', { exact: true })).toBeVisible();
  expect(await read<RelationshipResponse>(`/relationships/${parent.id}`)).toMatchObject({ validity: 'WITHDRAWN' });
  const spouseCard = page.getByRole('article').filter({ has: page.getByRole('heading', { name: /서준.*민지|민지.*서준/ }) });
  await expect(spouseCard.getByText('반영됨', { exact: true })).toBeVisible();
  await page.setViewportSize({ width: 320, height: 844 });
  await page.screenshot({ path: testInfo.outputPath('family-relationships-mobile.png'), fullPage: true });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBeTruthy();
});
