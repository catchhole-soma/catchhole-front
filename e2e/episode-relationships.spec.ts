import { expect, test, type BrowserContext, type Route } from '@playwright/test';

test.skip(process.env.VITE_RELATIONSHIP_WORKSPACE_ENABLED === 'false', '관계 화면 비공개 실행');
const workId = '11111111-1111-4111-8111-111111111111';
const prefix = `/api/v1/works/${workId}`;
const workspace = `/dashboard?workId=${workId}&nav=graph&relationMode=people`;
const episodes = [{ id: 'ep1', episodeNo: 1, title: '함께 걷는 길' }, { id: 'ep2', episodeNo: 2, title: '알게 된 이름' }];
function success(route: Route, data: unknown) { return route.fulfill({ contentType: 'application/json', body: JSON.stringify({ success: true, data, error: null }) }); }
async function setup(context: BrowserContext) {
  const calls = { graphs: [] as string[], profiles: 0, family: 0, writes: [] as unknown[] };
  let fail = false, conflict = false, deleted = false, summary: string | null = null, version = 1;
  let hold: { wait: Promise<void>; received: () => void } | null = null;
  const nodes = (episode: number) => [
    { id: 'p1', name: episode === 1 ? '가면을 쓴 사람' : '라온', description: null, profileRegistered: true },
    { id: 'p2', name: '세린', description: null, profileRegistered: true },
    { id: 'p3', name: '산장 주인', description: null, profileRegistered: false },
  ];
  const edges = (episode: number) => deleted ? [] : [
    { id: 'r1', sourceNodeId: 'p2', targetNodeId: 'p1', axis: 'ATTITUDE', kind: 'TRUST', label: '신뢰', summary: summary ?? (episode === 1 ? '세린은 가면을 쓴 사람의 안내를 믿고 따른다.' : '세린은 라온을 믿지만, 라온은 아직 거리를 둔다.'), direction: 'DIRECTED', status: 'ACTIVE', version, evidenceCount: 1 },
    ...(episode === 2 ? [{ id: 'r2', sourceNodeId: 'p1', targetNodeId: 'p3', axis: 'INTERACTION', kind: 'HELP', label: '도움', summary: '라온은 산장 주인에게 길을 안내받았다.', direction: 'UNDIRECTED', status: 'ACTIVE', version: 1, evidenceCount: 1 }] : []),
  ];
  await context.addInitScript(() => { localStorage.setItem('accessToken', 'synthetic-episode-graph'); localStorage.removeItem('catchhole_demo_mode'); });
  await context.route('**/api/v1/**', async route => {
    const request = route.request(); const url = new URL(request.url()); const path = url.pathname;
    if (path.endsWith('/auth/me')) return success(route, { id: 1, email: 'graph@example.test', displayName: '관계도 검증', role: 'AUTHOR', status: 'ACTIVE' });
    if (path === '/api/v1/works') return success(route, [{ id: workId, title: '관계의 변화', genre: '판타지', episodeCount: 2 }]);
    if (path === prefix) return success(route, { id: workId, title: '관계의 변화', genre: '판타지', lifecycleStatus: 'ACTIVE' });
    if (path.startsWith(`${prefix}/characters`)) { calls.profiles++; return success(route, { name: '미래의 황제 라온' }); }
    if (/family-tree|relationship-candidates|relationship-processing/.test(path)) calls.family++;
    if (path === `${prefix}/relationship-graph`) {
      calls.graphs.push(url.searchParams.get('episodeNo') ?? 'latest');
      const waiting = hold; hold = null;
      if (waiting) { waiting.received(); await waiting.wait; }
      if (fail) return route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ success: false, error: { code: 'COMMON_ERROR', status: 503 } }) });
      const episode = Number(url.searchParams.get('episodeNo') ?? 2);
      return success(route, { selectedEpisode: episodes[episode - 1], availableEpisodes: episodes, revision: String(version),
        nodes: nodes(episode), edges: edges(episode), truncated: false, totalEdgeCount: edges(episode).length });
    }
    if (path.startsWith(`${prefix}/relationship-graph/edges/`)) {
      if (request.method() !== 'GET') {
        calls.writes.push(request.method() === 'DELETE' ? { expectedVersion: Number(url.searchParams.get('expectedVersion')) } : request.postDataJSON());
        if (conflict) { conflict = false; version++; summary = '다른 화면에서 수정한 설명'; return route.fulfill({ status: 409, contentType: 'application/json', body: JSON.stringify({ success: false, error: { code: 'CONFLICT', status: 409 } }) }); }
        if (request.method() === 'DELETE') deleted = true;
        else { summary = request.postDataJSON().summary; version++; }
      }
      const episode = Number(url.searchParams.get('episodeNo') ?? 2);
      return success(route, { edge: edges(episode)[0], sourceNode: nodes(episode)[1], targetNode: nodes(episode)[0], version,
        evidence: [{ episodeId: `ep${episode}`, episodeNo: episode, episodeTitle: episodes[episode - 1].title,
          quote: episode === 1 ? '세린은 가면을 쓴 사람을 믿고 그 뒤를 따라갔다.' : '세린은 라온을 믿었다. 라온은 여전히 거리를 두었다.', startOffset: 0, endOffset: 35 }] });
    }
    return success(route, []);
  });
  return { calls, fail(value: boolean) { fail = value; }, conflict() { conflict = true; }, empty() { deleted = true; },
    hold(wait: Promise<void>, received: () => void) { hold = { wait, received }; } };
}

test('latest default, historical names/evidence, and URL back navigation stay within the selected episode', async ({ context, page }) => {
  const fixture = await setup(context);
  await page.goto(workspace);
  await expect(page.getByText('2화까지 확인된 관계')).toBeVisible();
  await expect(page.getByRole('tab', { name: '인물 관계도' })).toHaveAttribute('aria-selected', 'true');
  await page.getByLabel('관계도 회차').selectOption('1');
  await expect(page).toHaveURL(/relationEpisode=1/);
  await expect(page.getByText('1화까지 확인된 관계')).toBeVisible();
  await expect(page.getByText('라온', { exact: true })).toHaveCount(0);
  await page.getByRole('list', { name: '이 회차의 관계 목록' }).getByRole('button').first().click();
  await expect(page.getByRole('article', { name: '선택한 인물 관계' })).toContainText('세린은 가면을 쓴 사람을 믿고 그 뒤를 따라갔다.');
  await expect(page.getByRole('button', { name: '원문 근거 1' })).toHaveCount(0);
  expect(fixture.calls.profiles).toBe(0); expect(fixture.calls.family).toBe(0);
  await page.getByRole('button', { name: '닫기', exact: true }).click();
  await page.getByLabel('관계도 회차').selectOption('2');
  await expect(page.getByText('2화까지 확인된 관계')).toBeVisible();
  await page.goBack();
  await expect(page.getByLabel('관계도 회차')).toHaveValue('1');
  await expect(page.getByText('라온', { exact: true })).toHaveCount(0);
});

test('a delayed newer-episode response never flashes future names in an older view', async ({ context, page }) => {
  const fixture = await setup(context);
  let release!: () => void, received!: () => void;
  const wait = new Promise<void>(resolve => { release = resolve; });
  const started = new Promise<void>(resolve => { received = resolve; });
  fixture.hold(wait, received);
  await page.goto(workspace); await started;
  await page.goto(`${workspace}&relationEpisode=1`);
  await expect(page.getByText('1화까지 확인된 관계')).toBeVisible();
  release();
  await expect(page.getByText('가면을 쓴 사람', { exact: true }).first()).toBeVisible();
  await expect(page.getByText('라온', { exact: true })).toHaveCount(0);
});

test('selected person is highlighted without fetching current profiles or requiring review', async ({ context, page }) => {
  const fixture = await setup(context); await page.goto(`${workspace}&modal=char-detail&charId=p1`);
  await page.getByLabel('관계도 인물 검색').fill('산장');
  await page.locator('.episode-relationship-results').getByRole('button', { name: '산장 주인 중심으로 보기', exact: true }).click();
  await expect(page).toHaveURL(/relationFocus=p3/);
  await expect(page.locator('.episode-person.is-focused')).toContainText('산장 주인');
  await expect(page.getByText('확인·연결')).toHaveCount(0);
  await page.getByRole('button', { name: '전체 인물 보기' }).click();
  await page.locator('.episode-person').getByRole('button', { name: '산장 주인 중심으로 보기', exact: true }).click();
  await expect(page).toHaveURL(/relationFocus=p3/);
  await expect(page.locator('.episode-person.is-focused')).toContainText('산장 주인');
  expect(fixture.calls.profiles).toBe(0); expect(fixture.calls.family).toBe(0);
});


test('changing account session clears the old graph and evidence while the new read is pending', async ({ context, page }) => {
  const fixture = await setup(context); await page.goto(`${workspace}&relationEdge=r1`);
  await expect(page.getByText('라온', { exact: true }).first()).toBeVisible();
  let release!: () => void;
  const pending = new Promise<void>(resolve => { release = resolve; });
  fixture.hold(pending, () => {});
  await page.evaluate(() => window.dispatchEvent(new StorageEvent('storage', { key: 'accessToken', oldValue: 'previous-account', newValue: 'new-account' })));
  await expect(page.getByText('이 회차의 관계도를 불러오고 있어요.')).toBeVisible();
  await expect(page.getByText('라온', { exact: true })).toHaveCount(0);
  await expect(page.getByRole('article', { name: '선택한 인물 관계' })).toHaveCount(0);
  release();
  await expect(page.getByText('2화까지 확인된 관계')).toBeVisible();
});

test('summary correction preserves draft on version conflict and requires explicit adoption', async ({ context, page }) => {
  const fixture = await setup(context); await page.goto(`${workspace}&relationEpisode=1&relationEdge=r1`);
  await page.getByRole('button', { name: '설명 수정' }).click();
  await page.getByLabel('관계 설명').fill('세린만 상대의 안내를 믿는다.'); fixture.conflict();
  await page.getByRole('button', { name: '변경사항 저장' }).click();
  await expect(page.getByRole('alert')).toContainText('다른 곳에서');
  await expect(page.getByLabel('관계 설명')).toHaveValue('세린만 상대의 안내를 믿는다.');
  await expect(page.getByRole('button', { name: '변경사항 저장' })).toBeDisabled();
  await page.getByRole('button', { name: '변경 내용 확인' }).click();
  await page.getByRole('button', { name: '변경사항 저장' }).click();
  await expect(page.getByLabel('관계 설명')).toHaveCount(0);
  expect(fixture.calls.writes).toEqual([{ expectedVersion: 1, summary: '세린만 상대의 안내를 믿는다.' }, { expectedVersion: 2, summary: '세린만 상대의 안내를 믿는다.' }]);
});

test('delete explains cross-episode correction and hides the selected connection after success', async ({ context, page }) => {
  const fixture = await setup(context); await page.goto(`${workspace}&relationEdge=r1`);
  await page.getByRole('button', { name: '이 연결 삭제' }).click();
  await expect(page.getByText('이 연결을 모든 회차의 관계도에서 삭제할까요? 인물과 원문은 유지돼요.')).toBeVisible();
  await page.getByRole('button', { name: '삭제하기', exact: true }).click();
  await expect(page.getByText('아직 표시할 인물 관계가 없어요.')).toBeVisible();
  expect(fixture.calls.writes).toEqual([{ expectedVersion: 1 }]);
});

test('query failure provides retry, with no stale graph or false review state', async ({ context, page }) => {
  const fixture = await setup(context); fixture.fail(true); await page.goto(workspace);
  await expect(page.getByText('이 회차의 관계도를 불러오지 못했어요.')).toBeVisible();
  expect(await page.locator('.episode-relationship-canvas').count()).toBe(0);
  fixture.fail(false); await page.getByRole('button', { name: '다시 불러오기' }).click();
  await expect(page.getByText('2화까지 확인된 관계')).toBeVisible();
});

test('desktop and 320px expose both participants and the source quote without page overflow', async ({ context, page }) => {
  await setup(context); await page.setViewportSize({ width: 1366, height: 1000 });
  await page.goto(`${workspace}&relationEdge=r1`);
  await expect(page.getByRole('article', { name: '선택한 인물 관계' })).toContainText('세린');
  await expect(page.getByRole('article', { name: '선택한 인물 관계' })).toContainText('라온');
  await expect(page.locator('.episode-person')).toHaveCount(3);
  const contrast = await page.locator('.episode-person').first().evaluate(node => {
    function luminance(value: string) {
      const rgb = (value.match(/[\d.]+/g) ?? []).slice(0, 3).map(Number).map(channel => {
        const normalized = channel / 255;
        return normalized <= 0.04045 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4;
      });
      return 0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2];
    }
    const background = luminance(getComputedStyle(node).backgroundColor);
    const foreground = luminance(getComputedStyle(node.querySelector('strong')!).color);
    return (Math.max(background, foreground) + 0.05) / (Math.min(background, foreground) + 0.05);
  });
  expect(contrast).toBeGreaterThanOrEqual(4.5);
  await page.screenshot({ path: 'docs/screens/gh323/episode-relationships-desktop.png', fullPage: true });
  await page.setViewportSize({ width: 320, height: 850 });
  await expect(page.getByLabel('관계도 회차')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await expect.poll(async () => {
    const canvas = await page.locator('.episode-relationship-canvas').boundingBox();
    const cards = await page.locator('.episode-person').evaluateAll(elements => elements.map(element => { const rect = element.getBoundingClientRect(); return { left: rect.left, right: rect.right }; }));
    return Boolean(canvas && cards.every(card => card.left >= canvas.x && card.right <= canvas.x + canvas.width));
  }).toBe(true);
  await page.screenshot({ path: 'docs/screens/gh323/episode-relationships-mobile-320.png', fullPage: true });
  await page.getByRole('article', { name: '선택한 인물 관계' }).screenshot({ path: 'docs/screens/gh323/episode-relationships-evidence-mobile-320.png' });
});


test('mutual and one-sided ended relationships between the same people remain distinct', async ({ context, page }) => {
  await setup(context);
  await context.route(`**${prefix}/relationship-graph`, route => success(route, {
    selectedEpisode: episodes[1], availableEpisodes: episodes, revision: '1', analysisStatus: 'COMPLETED', partial: false,
    nodes: [{ id: 'p1', name: '라온', profileRegistered: true }, { id: 'p2', name: '세린', profileRegistered: true }],
    edges: [
      { id: 'friendship', sourceNodeId: 'p1', targetNodeId: 'p2', axis: 'SOCIAL', kind: 'FRIENDSHIP', label: '친구', summary: '서로 친구로 여긴다.', direction: 'MUTUAL', status: 'ACTIVE', version: 1, evidenceCount: 1 },
      { id: 'distrust', sourceNodeId: 'p2', targetNodeId: 'p1', axis: 'ATTITUDE', kind: 'DISTRUST', label: '경계', summary: '세린의 경계가 사라졌다.', direction: 'DIRECTED', status: 'ENDED', version: 1, evidenceCount: 1 },
    ], truncated: false, totalEdgeCount: 2,
  }));
  await page.goto(workspace);
  const friendship = page.locator('[data-id="friendship"] .react-flow__edge-path');
  const distrust = page.locator('[data-id="distrust"] .react-flow__edge-path');
  await expect(friendship).toHaveAttribute('marker-start', /url/);
  await expect(friendship).toHaveAttribute('marker-end', /url/);
  await expect(distrust).not.toHaveAttribute('marker-start', /url/);
  await expect(distrust).toHaveClass(/is-ended/);
  await expect(page.getByRole('list', { name: '이 회차의 관계 목록' })).toContainText('종료된 관계');
  const labels = await page.locator('.episode-connection-label').evaluateAll(elements => elements.map(element => { const r = element.getBoundingClientRect(); return { top: r.top, bottom: r.bottom }; }));
  expect(labels).toHaveLength(2);
  expect(labels[0].bottom <= labels[1].top || labels[1].bottom <= labels[0].top).toBe(true);
});
