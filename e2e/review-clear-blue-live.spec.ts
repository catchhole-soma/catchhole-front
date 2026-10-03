import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';

// Opt-in: ReviewUxHttpRuntimeTest creates this disposable local H2 fixture.
// It is deliberately separate from request-mocked UI regression coverage.
const fixturePath = process.env.CATCHHOLE_REVIEW_LIVE_FIXTURE;
test.skip(!fixturePath, 'Requires the isolated GH215 Spring HTTP fixture');

test('실제 서버에서 세계관 병합·캐릭터 결정 저장→재조회→확정이 일치한다', async ({ page }) => {
  test.setTimeout(90_000);
  const fixture = JSON.parse(readFileSync(fixturePath!, 'utf8')) as {
    apiUrl: string; workId: string; batchId: string; accessToken: string;
  };
  const apiOrigin = new URL(fixture.apiUrl);
  expect(['localhost', '127.0.0.1']).toContain(apiOrigin.hostname);
  const origin = process.env.CATCHHOLE_REVIEW_LIVE_FRONT ?? 'http://localhost:3100';
  expect(['localhost', '127.0.0.1']).toContain(new URL(origin).hostname);
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  const headers = { Authorization: `Bearer ${fixture.accessToken}` };
  const base = `${fixture.apiUrl}/api/v1/works/${fixture.workId}`;
  const query = `?batchId=${fixture.batchId}&includeLegacyCandidates=false&size=20`;
  const candidates = async (kind: 'setting' | 'world-setting') => {
    const response = await page.request.get(`${base}/${kind}-candidates${query}`, { headers });
    expect(response.status()).toBe(200);
    const result = await response.json();
    return result.data.groups.content.flatMap((group: { candidates: Record<string, unknown>[] }) => group.candidates) as Record<string, unknown>[];
  };
  await page.setViewportSize({ width: 1440, height: 1080 });
  await page.addInitScript(token => localStorage.setItem('accessToken', token), fixture.accessToken);
  const worldBefore = (await candidates('world-setting')).find(row => row.subjectName === '별빛 미궁' && row.reviewStatus === 'PENDING_REVIEW')!;
  expect(worldBefore.reviewStatus).toBe('PENDING_REVIEW');
  await page.goto(`${origin}/setting-review?workId=${fixture.workId}&batchId=${fixture.batchId}&candidateType=world`);
  const worldRow = page.locator('.world-setting-diff-row');
  await expect(worldRow.getByText('위험 기준', { exact: true })).toBeVisible();
  await worldRow.screenshot({ path: 'docs/screens/gh215/world-scope-choice.png' });
  const worldPatch = page.waitForResponse(response => response.url().endsWith('/world-setting-candidates/decisions') && response.request().method() === 'PATCH');
  await worldRow.getByRole('button', { name: /예, 포함된 내용이에요/ }).click();
  expect((await worldPatch).status()).toBe(200);
  const worldDraft = (await candidates('world-setting')).find(row => row.id === worldBefore.id)!;
  expect(worldDraft.finalOperation).toBe('MERGE');
  expect(worldDraft.finalValue).toBe(`${worldBefore.beforeValue}\n${worldBefore.extractedValue}`);
  await page.reload();
  await expect(page.getByRole('button', { name: '모두 확정', exact: true })).toBeEnabled();
  const worldConfirm = page.waitForResponse(response => response.url().endsWith('/world-setting-candidates/group-confirm') && response.request().method() === 'POST');
  await page.getByRole('button', { name: '모두 확정', exact: true }).click();
  expect((await worldConfirm).status()).toBe(200);
  const worldRead = await page.request.get(`${base}/world-settings/${worldBefore.targetWorldSettingId}`, { headers });
  expect(worldRead.status()).toBe(200);
  const property = (await worldRead.json()).data.properties.find((entry: { settingName: string }) => entry.settingName === '귀환 조건');
  expect(property.value).toBe(worldDraft.finalValue);

  await page.getByRole('button', { name: /^캐릭터 후보/ }).click();
  const row = page.locator('.setting-candidate-detail');
  await expect(row.getByText('소속', { exact: true })).toBeVisible();
  const characterBefore = (await candidates('setting')).find(candidate => candidate.entityName === '루안 베른' && candidate.reviewStatus === 'PENDING_REVIEW')!;
  await row.screenshot({ path: 'docs/screens/gh215/character-semantic-choice.png' });
  for (const [title, mode] of [['현재 설정에 반영', 'APPLY_PROPOSAL'], ['이력에만 저장', 'HISTORY_ONLY'], ['현재 설정에 반영', 'APPLY_PROPOSAL']] as const) {
    const patch = page.waitForResponse(response => response.url().endsWith(`/setting-candidates/${characterBefore.id}`) && response.request().method() === 'PATCH');
    await row.getByRole('button', { name: new RegExp(`^${title}`) }).click();
    expect((await patch).status()).toBe(200);
    const saved = (await candidates('setting')).find(candidate => candidate.id === characterBefore.id)!;
    expect(saved.reviewedApplicationMode).toBe(mode);
    expect(saved.temporalScope).toBe(characterBefore.temporalScope);
    await page.reload();
    await expect(row.getByRole('button', { name: new RegExp(`^${title}`) })).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByRole('button', { name: /1개 설정 모두 확정/ })).toBeEnabled();
  }
  const stale = await page.request.patch(`${base}/setting-candidates/${characterBefore.id}`, { headers, data: {
    attributeName: characterBefore.attributeName, attributeValue: characterBefore.attributeValue,
    reviewedApplicationMode: 'HISTORY_ONLY', expectedUpdatedAt: characterBefore.updatedAt,
  } });
  expect(stale.status()).toBe(409);
  const characterConfirm = page.waitForResponse(response => response.url().endsWith('/setting-candidates/group-confirm') && response.request().method() === 'POST');
  await page.getByRole('button', { name: /1개 설정 모두 확정/ }).click();
  const confirmedResponse = await characterConfirm;
  expect(confirmedResponse.status()).toBe(200);
  const confirmed = (await candidates('setting')).find(candidate => candidate.id === characterBefore.id)!;
  expect(confirmed.reviewStatus).toBe('CONFIRMED');
  expect(confirmed.historyOnly).toBe(false);
  const characterRead = await page.request.get(`${base}/characters/${characterBefore.matchedCharacterId}`, { headers });
  expect(characterRead.status()).toBe(200);
  expect(JSON.stringify((await characterRead.json()).data)).toContain('왕실 기사단');

  await page.locator('.candidate-group-card').filter({ hasText: '인물 미상' }).click();
  await expect(row.getByText('누구에 관한 내용인가요?', { exact: true })).toBeVisible();
  await row.screenshot({ path: 'docs/screens/gh215/character-target-choice.png' });
  await page.setViewportSize({ width: 320, height: 700 });
  if (!await row.isVisible()) await page.locator('.candidate-group-card').filter({ hasText: '인물 미상' }).click();
  await expect(row).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await row.screenshot({ path: 'docs/screens/gh215/character-mobile.png' });
  expect(errors).toEqual([]);
});
