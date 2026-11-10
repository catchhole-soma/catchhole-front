import type { Graph } from '../src/app/api/generated/types.gen';
import { expect, test, type BrowserContext, type Page, type Route } from '@playwright/test';

test.skip(process.env.VITE_RELATIONSHIP_WORKSPACE_ENABLED === 'false', '관계 화면 비공개 실행');
const workId = '11111111-1111-4111-8111-111111111111';
const prefix = `/api/v1/works/${workId}`;
const defaultWorkspace = `/dashboard?workId=${workId}&nav=graph`;
const workspace = `${defaultWorkspace}&relationMode=people`;
const episodes = [{ id: 'ep1', episodeNo: 1, title: '함께 걷는 길' }, { id: 'ep2', episodeNo: 2, title: '알게 된 이름' }];
const graphFixtures = new Map<string, Graph>();
function success(route: Route, data: unknown) {
  const url = new URL(route.request().url());
  if (url.pathname.endsWith('/relationship-graph/explore/selection') && data && typeof data === 'object' && 'nodes' in data) {
    const graph = data as Graph;
    graphFixtures.set(`${url.pathname.split('/relationship-graph')[0]}:${url.searchParams.get('episodeNo') ?? 'latest'}`, graph);
    const focus = url.searchParams.get('focusNodeId');
    const page = Number(url.searchParams.get('page') ?? 0);
    const all = (graph.edges ?? []).filter(edge => !focus || edge.sourceNodeId === focus || edge.targetNodeId === focus);
    const selectedIds = url.searchParams.getAll('counterpartNodeIds').flatMap(value => value.split(','));
    const scope = selectedIds.length ? all.filter(edge => selectedIds.includes(edge.sourceNodeId === focus ? edge.targetNodeId! : edge.sourceNodeId!)) : all;
    const selectionRequired = !focus && ((graph.totalEdgeCount ?? 0) >= 300 || (graph.nodes?.length ?? 0) >= 100);
    const counterpartSelectionRequired = Boolean(focus && all.length >= 200 && !selectedIds.length);
    const size = focus ? 200 : 299;
    const edges = selectionRequired || counterpartSelectionRequired ? [] : scope.slice(page * size, (page + 1) * size);
    const ids = new Set(edges.flatMap(edge => [edge.sourceNodeId, edge.targetNodeId]));
    data = { graph: { ...graph, edges, nodes: selectionRequired ? [] : focus ? graph.nodes?.filter(node => node.id === focus || ids.has(node.id)) : graph.nodes },
      selectionRequired, counterpartSelectionRequired, totalNodeCount: graph.nodes?.length,
      selectedPeople: selectedIds.map(id => ({ node: graph.nodes?.find(n => n.id === id), edgeCount: all.filter(e => e.sourceNodeId === id || e.targetNodeId === id).length })),
      focusNode: graph.nodes?.find(node => node.id === focus), focusEdgeCount: all.length, maxSelectedPeople: 20, maxSelectedEdges: 200,
      page, pageSize: size, scopeEdgeCount: scope.length, hasNext: (page + 1) * size < scope.length && !counterpartSelectionRequired };
  }
  return route.fulfill({ contentType: 'application/json', body: JSON.stringify({ success: true, data, error: null }) });
}
async function setup(context: BrowserContext) {
  graphFixtures.clear();
  const calls = { graphs: [] as string[], profiles: 0, family: 0, writes: [] as unknown[] };
  let failureStatus = 0, conflict = false, deleted = false, summary: string | null = null, version = 1;
  let analysisStatus: 'COMPLETED' | 'PARTIAL' | 'FAILED' = 'COMPLETED', partial = false;
  let updateIncomplete: boolean | undefined = false, incompleteEpisodeNos: number[] = [], incompleteEdgeIds = ['r1'];
  let lastVerifiedEpisodeNo = 1;
  let hold: { wait: Promise<void>; received: () => void } | null = null;
  const nodes = (episode: number) => [
    { id: 'p1', name: episode === 1 ? '가면을 쓴 사람' : '라온', description: null, profileRegistered: true },
    { id: 'p2', name: '세린', description: null, profileRegistered: true },
    { id: 'p3', name: '산장 주인', description: null, profileRegistered: false },
  ];
  const edges = (episode: number) => (deleted ? [] : [
    { id: 'r1', sourceNodeId: 'p2', targetNodeId: 'p1', axis: 'ATTITUDE', kind: 'TRUST', label: '신뢰', summary: summary ?? (episode === 1 ? '세린은 가면을 쓴 사람의 안내를 믿고 따른다.' : '세린은 라온을 믿지만, 라온은 아직 거리를 둔다.'), direction: 'DIRECTED', status: 'ACTIVE', version, evidenceCount: 1 },
    ...(episode === 2 ? [{ id: 'r2', sourceNodeId: 'p1', targetNodeId: 'p3', axis: 'INTERACTION', kind: 'HELP', label: '도움', summary: '라온은 산장 주인에게 길을 안내받았다.', direction: 'UNDIRECTED', status: 'ACTIVE', version: 1, evidenceCount: 1 }] : []),
  ]).map(edge => {
    const incomplete = updateIncomplete && incompleteEpisodeNos.some(number => number <= episode) && incompleteEdgeIds.includes(edge.id);
    return { ...edge, summary: incomplete && edge.id === 'r1' ? summary ?? '세린은 가면을 쓴 사람의 안내를 믿고 따른다.' : edge.summary,
      updateIncomplete: updateIncomplete === undefined ? undefined : incomplete,
      lastVerifiedEpisodeNo: incomplete ? lastVerifiedEpisodeNo : episode };
  });
  await context.addInitScript(() => { localStorage.setItem('accessToken', 'synthetic-episode-graph'); localStorage.removeItem('catchhole_demo_mode'); });
  await context.route('**/api/v1/**', async route => {
    const request = route.request(); const url = new URL(request.url()); const path = url.pathname;
    if (path.endsWith('/auth/me')) return success(route, { id: 1, email: 'graph@example.test', displayName: '관계도 검증', role: 'AUTHOR', status: 'ACTIVE' });
    if (path === '/api/v1/works') return success(route, [{ id: workId, title: '관계의 변화', genre: '판타지', episodeCount: 2 }]);
    if (path === prefix) return success(route, { id: workId, title: '관계의 변화', genre: '판타지', lifecycleStatus: 'ACTIVE' });
    if (path.startsWith(`${prefix}/characters`)) { calls.profiles++; return success(route, { name: '미래의 황제 라온' }); }
    if (/family-tree|relationship-candidates|relationship-processing/.test(path)) calls.family++;
    if (path === `${prefix}/relationship-graph/people`) {
      const source = graphFixtures.get(`${prefix}:${url.searchParams.get('episodeNo') ?? 'latest'}`);
      const query = url.searchParams.get('query') ?? '';
      return success(route, { content: source?.nodes?.filter(node => node.name?.includes(query)).map(node => ({ node, neighborCount: 1 })) ?? [], page: 0, size: 20, hasNext: false });
    }
    if (path === `${prefix}/relationship-graph/explore/selection`) {
      calls.graphs.push(url.searchParams.get('episodeNo') ?? 'latest');
      const waiting = hold; hold = null;
      if (waiting) { waiting.received(); await waiting.wait; }
      if (failureStatus) return route.fulfill({ status: failureStatus, contentType: 'application/json', body: JSON.stringify({ success: false, error: { code: 'COMMON_ERROR', status: failureStatus } }) });
      const episode = Number(url.searchParams.get('episodeNo') ?? 2);
      return success(route, { selectedEpisode: episodes[episode - 1], availableEpisodes: episodes, revision: String(version),
        analysisStatus, partial, updateIncomplete: updateIncomplete === undefined ? undefined : updateIncomplete && incompleteEpisodeNos.some(number => number <= episode),
        incompleteEpisodeNos: incompleteEpisodeNos.filter(number => number <= episode),
        nodes: nodes(episode), edges: edges(episode), truncated: false, totalEdgeCount: edges(episode).length });
    }
    if (path.startsWith(`${prefix}/relationship-graph/edges/`) || path.startsWith(`${prefix}/relationship-graph/explore/edges/`)) {
      if (request.method() !== 'GET') {
        calls.writes.push(request.method() === 'DELETE' ? { expectedVersion: Number(url.searchParams.get('expectedVersion')) } : request.postDataJSON());
        if (conflict) { conflict = false; version++; summary = '다른 화면에서 수정한 설명'; return route.fulfill({ status: 409, contentType: 'application/json', body: JSON.stringify({ success: false, error: { code: 'CONFLICT', status: 409 } }) }); }
        if (request.method() === 'DELETE') deleted = true;
        else { summary = request.postDataJSON().summary; version++; }
      }
      const episode = Number(url.searchParams.get('episodeNo') ?? 2);
      const selected = edges(episode).find(edge => path.endsWith(`/${edge.id}`));
      const evidenceEpisode = selected?.updateIncomplete ? 1 : episode;
      return success(route, { edge: selected, sourceNode: nodes(episode).find(node => node.id === selected?.sourceNodeId),
        targetNode: nodes(episode).find(node => node.id === selected?.targetNodeId), version,
        evidence: [{ episodeId: `ep${evidenceEpisode}`, episodeNo: evidenceEpisode, episodeTitle: episodes[evidenceEpisode - 1].title,
          quote: evidenceEpisode === 1 ? '세린은 가면을 쓴 사람을 믿고 그 뒤를 따라갔다.' : '세린은 라온을 믿었다. 라온은 여전히 거리를 두었다.', startOffset: 0, endOffset: 35 }] });
    }
    return success(route, []);
  });
  return { calls, fail(value: boolean | number) { failureStatus = typeof value === 'number' ? value : value ? 503 : 0; },
    analysis(status: 'COMPLETED' | 'PARTIAL' | 'FAILED', incomplete: boolean) { analysisStatus = status; partial = incomplete; updateIncomplete = undefined; },
    coverage(incomplete: boolean, episodeNos = [2], edgeIds = ['r1'], verifiedEpisodeNo = 1) {
      updateIncomplete = incomplete; incompleteEpisodeNos = incomplete ? episodeNos : []; incompleteEdgeIds = edgeIds; lastVerifiedEpisodeNo = verifiedEpisodeNo;
    },
    conflict() { conflict = true; }, empty() { deleted = true; },
    hold(wait: Promise<void>, received: () => void) { hold = { wait, received }; } };
}

async function setupParallelRelations(context: BrowserContext, count: number) {
  const base = await setup(context);
  const people = [{ id: 'p1', name: '라온', profileRegistered: true }, { id: 'p2', name: '세린', profileRegistered: true }];
  const edges = [
    { id: 'parallel-1', sourceNodeId: 'p1', targetNodeId: 'p2', axis: 'SOCIAL', kind: 'COOPERATION', label: '서로 협력하면서 신중하게 거리를 둠', direction: 'MUTUAL', status: 'ACTIVE' },
    { id: 'parallel-2', sourceNodeId: 'p1', targetNodeId: 'p2', axis: 'ATTITUDE', kind: 'TRUST', label: '상대의 판단을 믿고 의지하는 마음', direction: 'DIRECTED', status: 'ACTIVE' },
    { id: 'parallel-3', sourceNodeId: 'p2', targetNodeId: 'p1', axis: 'ATTITUDE', kind: 'DISTRUST', label: '도움에 감사하지만 아직 남아 있는 경계', direction: 'DIRECTED', status: 'ACTIVE' },
    { id: 'parallel-4', sourceNodeId: 'p1', targetNodeId: 'p2', axis: 'INTERACTION', kind: 'HELP', label: '위험한 상황에서 주고받은 도움', direction: 'UNDIRECTED', status: 'ACTIVE' },
    { id: 'parallel-5', sourceNodeId: 'p2', targetNodeId: 'p1', axis: 'SOCIAL', kind: 'COMPANIONSHIP', label: '갈등 이후 끝난 임시 동행 관계', direction: 'MUTUAL', status: 'ENDED' },
  ].slice(0, count);
  let revision = 1, graphReads = 0;
  await context.route(`**${prefix}/relationship-graph**`, route => {
    const url = new URL(route.request().url());
    if (route.request().method() !== 'GET') base.calls.writes.push({ method: route.request().method(), path: url.pathname });
    const episode = Number(url.searchParams.get('episodeNo') ?? 2);
    if (url.pathname.endsWith('/people')) return route.fallback();
    const currentEdges = edges.map(edge => ({ ...edge, summary: `${edge.label}. 합성 설명 ${revision}.`, version: revision, evidenceCount: 1 }));
    if (url.pathname === `${prefix}/relationship-graph/explore/selection`) {
      graphReads++;
      return success(route, { selectedEpisode: episodes[episode - 1], availableEpisodes: episodes, revision: String(revision),
        analysisStatus: 'COMPLETED', partial: false, nodes: people, edges: currentEdges, truncated: false, totalEdgeCount: count });
    }
    const selected = currentEdges.find(edge => url.pathname.endsWith(`/${edge.id}`));
    return success(route, { edge: selected, version: revision,
      sourceNode: people.find(person => person.id === selected?.sourceNodeId),
      targetNode: people.find(person => person.id === selected?.targetNodeId),
      evidence: [{ episodeId: `ep${episode}`, episodeNo: episode, episodeTitle: episodes[episode - 1].title,
        quote: '라온과 세린은 서로의 생각을 확인하며 함께 걸었다.', startOffset: 0, endOffset: 29 }] });
  });
  return { ...base, edges, graphReads: () => graphReads, refresh() { revision++; } };
}

async function expectReadableParallelRelations(page: Page, count: number, withinViewport = true) {
  const canvas = page.locator('.episode-relationship-canvas');
  await expect(canvas.locator('.episode-person')).toHaveCount(2);
  await expect(canvas.locator('.episode-connection-label')).toHaveCount(count);
  await expect.poll(() => canvas.evaluate((element, includeBounds) => {
    const errors: string[] = [];
    const boundary = element.getBoundingClientRect();
    const items = [...element.querySelectorAll('.episode-person, .episode-connection-label')].map(item => ({
      text: item.textContent?.trim() ?? '', rect: item.getBoundingClientRect(),
    }));
    for (let index = 0; index < items.length; index++) {
      const { text, rect } = items[index];
      if (rect.width <= 1 || rect.height <= 1) errors.push(`not measured: ${text}`);
      if (includeBounds && (rect.left < boundary.left - 1 || rect.right > boundary.right + 1
        || rect.top < boundary.top - 1 || rect.bottom > boundary.bottom + 1)) errors.push(`outside canvas: ${text}`);
      for (const other of items.slice(index + 1)) {
        if (Math.min(rect.right, other.rect.right) - Math.max(rect.left, other.rect.left) > 1
          && Math.min(rect.bottom, other.rect.bottom) - Math.max(rect.top, other.rect.top) > 1) {
          errors.push(`overlap: ${text} / ${other.text}`);
        }
      }
    }
    return errors;
  }, withinViewport)).toEqual([]);
}

test('unqualified graph entry defaults to people, and historical names/evidence stay within the selected episode', async ({ context, page }) => {
  const fixture = await setup(context);
  await page.goto(defaultWorkspace);
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
  await page.getByRole('button', { name: '뒤로가기', exact: true }).click();
  await page.locator('.episode-person').getByRole('button', { name: '산장 주인 중심으로 보기', exact: true }).click();
  await expect(page).toHaveURL(/relationFocus=p3/);
  await expect(page.locator('.episode-person.is-focused')).toContainText('산장 주인');
  expect(fixture.calls.profiles).toBe(0); expect(fixture.calls.family).toBe(0);
});


test('changing account session clears the old graph and evidence while the new read is pending', async ({ context, page }) => {
  const fixture = await setup(context); await page.goto(`${workspace}&relationEdge=r1`);
  await expect(page.getByText('라온', { exact: true }).first()).toBeVisible();
  await page.getByRole('button', { name: '설명 수정' }).click();
  await page.getByLabel('관계 설명').fill('이전 계정에서만 작성한 초안');
  let release!: () => void;
  const pending = new Promise<void>(resolve => { release = resolve; });
  fixture.hold(pending, () => {});
  await page.evaluate(() => window.dispatchEvent(new StorageEvent('storage', { key: 'accessToken', oldValue: 'previous-account', newValue: 'new-account' })));
  await expect(page.getByText('이 회차의 관계도를 불러오고 있어요.')).toBeVisible();
  await expect(page.getByText('라온', { exact: true })).toHaveCount(0);
  await expect(page.getByRole('article', { name: '선택한 인물 관계' })).toHaveCount(0);
  release();
  await expect(page.getByText('2화까지 확인된 관계')).toBeVisible();
  await expect(page.getByRole('button', { name: '설명 수정' })).toBeVisible();
  await expect(page.getByLabel('관계 설명')).toHaveCount(0);
  await expect(page.getByText('이전 계정에서만 작성한 초안')).toHaveCount(0);
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

for (const conflict of [false, true]) test(`background graph failure and retry preserve the ${conflict ? '409 conflict' : 'unsaved'} draft`, async ({ context, page }) => {
  const fixture = await setup(context);
  await page.clock.install();
  await page.goto(`${workspace}&relationEdge=r1`);
  await page.getByRole('button', { name: '설명 수정' }).click();
  const draft = '세린의 신뢰와 라온의 거리감을 구분한다.';
  await page.getByLabel('관계 설명').fill(draft);
  if (conflict) {
    fixture.conflict();
    await page.getByRole('button', { name: '변경사항 저장' }).click();
    await expect(page.getByText('다른 곳에서 이 관계가 변경됐어요. 입력은 유지했어요.')).toBeVisible();
    await expect(page.getByText('현재 저장된 설명: 다른 화면에서 수정한 설명')).toBeVisible();
  }
  fixture.fail(true);
  await page.getByRole('button', { name: '관계 새로고침' }).click();
  await page.clock.runFor(12000);
  await expect(page.getByLabel('관계 설명')).toHaveValue(draft);
  await expect(page.getByText('관계도를 갱신하지 못했어요. 이전 내용을 표시하고 있어요.')).toBeVisible();
  await expect(page.locator('.episode-relationship-canvas')).toBeVisible();
  if (conflict) await expect(page.getByRole('button', { name: '변경사항 저장' })).toBeDisabled();
  fixture.fail(false);
  await page.getByRole('button', { name: '다시 불러오기' }).click();
  await expect(page.getByText('관계도를 갱신하지 못했어요. 이전 내용을 표시하고 있어요.')).toHaveCount(0);
  await expect(page.getByLabel('관계 설명')).toHaveValue(draft);
  if (conflict) {
    await expect(page.getByRole('button', { name: '변경사항 저장' })).toBeDisabled();
    await page.getByRole('button', { name: '변경 내용 확인' }).click();
  }
  await page.getByRole('button', { name: '변경사항 저장' }).click();
  await expect(page.getByLabel('관계 설명')).toHaveCount(0);
  expect(fixture.calls.writes.at(-1)).toEqual({ expectedVersion: conflict ? 2 : 1, summary: draft });
});

for (const status of [403, 404]) test(`background graph ${status} hides cached names, evidence and edits until access recovers`, async ({ context, page }) => {
  const fixture = await setup(context);
  await page.clock.install();
  await page.goto(`${workspace}&relationEdge=r1`);
  await page.getByRole('button', { name: '설명 수정' }).click();
  await page.getByLabel('관계 설명').fill('접근할 수 없어진 관계의 초안');
  fixture.fail(status);
  await page.getByRole('button', { name: '관계 새로고침' }).click();
  await page.clock.runFor(12000);
  await expect(page.getByText('이 회차의 관계도를 불러오지 못했어요.')).toBeVisible();
  await expect(page.locator('.episode-relationship-canvas')).toHaveCount(0);
  await expect(page.getByRole('article', { name: '선택한 인물 관계' })).toHaveCount(0);
  await expect(page.getByText('라온', { exact: true })).toHaveCount(0);
  await expect(page.getByLabel('관계 설명')).toHaveCount(0);
  expect(fixture.calls.writes).toEqual([]);
  fixture.fail(false);
  await page.getByRole('button', { name: '다시 불러오기' }).click();
  await expect(page.getByRole('button', { name: '설명 수정' })).toBeVisible();
  await expect(page.getByLabel('관계 설명')).toHaveCount(0);
});

test('changing episode after a refresh failure clears the newer graph and its draft while the older read is pending', async ({ context, page }) => {
  const fixture = await setup(context);
  await page.clock.install();
  await page.goto(`${workspace}&relationEdge=r1`);
  await page.getByRole('button', { name: '설명 수정' }).click();
  await page.getByLabel('관계 설명').fill('2화의 정체를 포함한 초안');
  fixture.fail(true);
  await page.getByRole('button', { name: '관계 새로고침' }).click();
  await page.clock.runFor(12000);
  await expect(page.getByLabel('관계 설명')).toHaveValue('2화의 정체를 포함한 초안');
  let release!: () => void;
  fixture.fail(false);
  fixture.hold(new Promise<void>(resolve => { release = resolve; }), () => {});
  await page.getByLabel('관계도 회차').selectOption('1');
  await expect(page.getByText('이 회차의 관계도를 불러오고 있어요.')).toBeVisible();
  await expect(page.getByText('라온', { exact: true })).toHaveCount(0);
  await expect(page.getByLabel('관계 설명')).toHaveCount(0);
  release();
  await expect(page.getByText('1화까지 확인된 관계')).toBeVisible();
  await page.getByRole('list', { name: '이 회차의 관계 목록' }).getByRole('button').first().click();
  await expect(page.getByRole('article', { name: '선택한 인물 관계' })).toContainText('가면을 쓴 사람');
  await expect(page.getByLabel('관계 설명')).toHaveCount(0);
  await expect(page.getByText('2화의 정체를 포함한 초안')).toHaveCount(0);
});

test('changing work does not reuse cached graph or edit state while the new work is pending', async ({ context, page }) => {
  await setup(context);
  const nextWorkId = '22222222-2222-4222-8222-222222222222';
  const nextPrefix = `/api/v1/works/${nextWorkId}`;
  await context.route(`**${nextPrefix}`, route => success(route, { id: nextWorkId, title: '다른 관계의 이야기', genre: '판타지', lifecycleStatus: 'ACTIVE' }));
  let release!: () => void;
  const pending = new Promise<void>(resolve => { release = resolve; });
  await context.route(`**${nextPrefix}/relationship-graph/explore/selection*`, async route => {
    await pending;
    return success(route, { selectedEpisode: episodes[1], availableEpisodes: episodes, revision: '1', analysisStatus: 'COMPLETED', partial: false,
      nodes: [], edges: [], truncated: false, totalEdgeCount: 0 });
  });
  await page.goto(`${workspace}&relationEdge=r1`);
  await page.getByRole('button', { name: '설명 수정' }).click();
  await page.getByLabel('관계 설명').fill('이전 작품에서 작성한 초안');
  await page.evaluate(next => { window.history.pushState({}, '', next); window.dispatchEvent(new PopStateEvent('popstate')); },
    `/dashboard?workId=${nextWorkId}&nav=graph&relationMode=people&relationEdge=r1`);
  await expect(page.getByText('이 회차의 관계도를 불러오고 있어요.')).toBeVisible();
  await expect(page.getByText('라온', { exact: true })).toHaveCount(0);
  await expect(page.getByRole('article', { name: '선택한 인물 관계' })).toHaveCount(0);
  release();
  await expect(page.getByText('아직 표시할 인물 관계가 없어요.')).toBeVisible();
  await page.goBack();
  await expect(page.getByRole('button', { name: '설명 수정' })).toBeVisible();
  await expect(page.getByLabel('관계 설명')).toHaveCount(0);
  await expect(page.getByText('이전 작품에서 작성한 초안')).toHaveCount(0);
});

for (const status of ['PARTIAL', 'COMPLETED'] as const) for (const empty of [false, true]) test(`${status} with partial=${status === 'COMPLETED'} explains incomplete analysis in an ${empty ? 'empty' : 'populated'} graph`, async ({ context, page }) => {
  const fixture = await setup(context);
  fixture.analysis(status, status === 'COMPLETED');
  if (empty) fixture.empty();
  await page.goto(workspace);
  await expect(page.getByRole('status').filter({ hasText: '관계 분석에 반영하지 못한 내용이 있어요.' })).toBeVisible();
  if (empty) {
    await expect(page.getByText('표시할 관계를 아직 확인하지 못했어요.')).toBeVisible();
    await expect(page.locator('.episode-relationship-canvas')).toHaveCount(0);
  } else {
    await expect(page.getByRole('list', { name: '이 회차의 관계 목록' }).getByRole('button')).toHaveCount(2);
  }
  await expect(page.getByText('확인·연결', { exact: true })).toHaveCount(0);
  expect(fixture.calls.family).toBe(0);
  expect(fixture.calls.writes).toEqual([]);
});

for (const empty of [false, true]) test(`semantic holds with complete updates do not warn or require review in an ${empty ? 'empty' : 'populated'} graph`, async ({ context, page }) => {
  const fixture = await setup(context);
  fixture.analysis('PARTIAL', true);
  fixture.coverage(false);
  if (empty) fixture.empty();
  await page.goto(workspace);
  await expect(page.getByText('2화까지 확인된 관계')).toBeVisible();
  await expect(page.getByText('일부 관계 업데이트 미완료', { exact: false })).toHaveCount(0);
  await expect(page.getByText('관계 분석에 반영하지 못한 내용이 있어요.')).toHaveCount(0);
  await expect(page.getByText('확인·연결', { exact: true })).toHaveCount(0);
  if (empty) await expect(page.getByText('아직 표시할 인물 관계가 없어요.')).toBeVisible();
  expect(fixture.calls.writes).toEqual([]);
  expect(fixture.calls.family).toBe(0);
});

for (const status of ['PARTIAL', 'FAILED'] as const) test(`${status} with no relationships does not claim that none exist`, async ({ context, page }) => {
  const fixture = await setup(context);
  fixture.analysis(status, true);
  fixture.coverage(true);
  fixture.empty();
  await page.goto(workspace);
  await expect(page.getByText('표시할 관계를 아직 확인하지 못했어요.')).toBeVisible();
  await expect(page.getByText('아직 표시할 인물 관계가 없어요.')).toHaveCount(0);
  await expect(page.getByText('2화까지 확인된 관계')).toHaveCount(0);
  if (status === 'FAILED') await expect(page.getByRole('status').filter({ hasText: '미완료 회차: 2화' })).toBeVisible();
  else await expect(page.getByText('일부 관계 업데이트 미완료', { exact: false })).toHaveCount(0);
  await expect(page.locator('.episode-relationship-canvas')).toHaveCount(0);
  expect(fixture.calls.writes).toEqual([]);
});

test('partial updates retain prior edges, disclose the gap and last verified episode, and isolate the older cutoff', async ({ context, page }) => {
  const fixture = await setup(context);
  fixture.analysis('PARTIAL', true);
  fixture.coverage(true);
  await page.setViewportSize({ width: 1366, height: 1000 });
  await page.goto(`${workspace}&relationEdge=r1`);
  const detail = page.getByRole('article', { name: '선택한 인물 관계' });
  await expect(page.getByText('일부 관계 업데이트 미완료', { exact: false })).toHaveCount(0);
  await expect(page.getByText('2화까지의 관계', { exact: true })).toBeVisible();
  await expect(page.getByText('2화까지 확인된 관계')).toHaveCount(0);
  await expect(page.getByRole('list', { name: '이 회차의 관계 목록' }).getByRole('button')).toHaveCount(2);
  await expect(detail).toContainText('마지막 확인: 1화. 이후 관계 업데이트를 마치지 못했어요.');
  await expect(detail.getByLabel('원문 근거')).toContainText('1화 · 함께 걷는 길');
  await expect(detail.getByLabel('원문 근거')).toContainText('세린은 가면을 쓴 사람을 믿고 그 뒤를 따라갔다.');
  await page.screenshot({ path: 'test-results/gh416-partial-desktop.png', fullPage: true });
  await page.setViewportSize({ width: 320, height: 850 });
  await expect(detail).toContainText('마지막 확인: 1화.');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await detail.screenshot({ path: 'test-results/gh416-partial-mobile-320.png' });
  await page.getByRole('button', { name: '닫기', exact: true }).click();
  await page.getByRole('list', { name: '이 회차의 관계 목록' }).getByRole('button').nth(1).click();
  await expect(detail).toContainText('도움');
  await expect(detail.getByText('마지막 확인:', { exact: false })).toHaveCount(0);
  await page.getByLabel('관계도 회차').selectOption('1');
  await expect(page.getByText('1화까지 확인된 관계')).toBeVisible();
  await expect(page.getByText('일부 관계 업데이트 미완료', { exact: false })).toHaveCount(0);
  await expect(page.getByText('라온', { exact: true })).toHaveCount(0);
  expect(fixture.calls.writes).toEqual([]);
  expect(fixture.calls.profiles).toBe(0);
  expect(fixture.calls.family).toBe(0);
});

test('polling updates verification of the open edge without discarding the correction draft', async ({ context, page }) => {
  const fixture = await setup(context);
  await page.clock.install();
  await page.goto(`${workspace}&relationEdge=r1`);
  await page.getByRole('button', { name: '설명 수정' }).click();
  await page.getByLabel('관계 설명').fill('읽던 관계의 수정 초안');
  fixture.coverage(true);
  await page.getByRole('button', { name: '관계 새로고침' }).click();
  await page.clock.runFor(10001);
  await expect(page.getByRole('article', { name: '선택한 인물 관계' })).toContainText('마지막 확인: 1화.');
  await expect(page.getByLabel('관계 설명')).toHaveValue('읽던 관계의 수정 초안');
  fixture.coverage(false);
  await page.getByRole('button', { name: '관계 새로고침' }).click();
  await page.clock.runFor(10001);
  await expect(page.getByText('일부 관계 업데이트 미완료', { exact: false })).toHaveCount(0);
  await expect(page.getByText('마지막 확인:', { exact: false })).toHaveCount(0);
  await expect(page.getByLabel('관계 설명')).toHaveValue('읽던 관계의 수정 초안');
  expect(fixture.calls.writes).toEqual([]);
});

test('a gap before the first verified episode never displays episode zero as confirmed', async ({ context, page }) => {
  const fixture = await setup(context);
  fixture.coverage(true, [1, 2], ['r1'], 0);
  await page.goto(`${workspace}&relationEdge=r1`);
  await expect(page.getByRole('article', { name: '선택한 인물 관계' })).toContainText('앞선 회차부터 관계 업데이트를 마치지 못했어요.');
  await expect(page.getByText('마지막 확인:', { exact: false })).toHaveCount(0);
  await expect(page.getByText('0화', { exact: false })).toHaveCount(0);
});

test('many incomplete episodes stay concise without horizontal overflow at 320px', async ({ context, page }) => {
  await setup(context);
  await context.route(`**${prefix}/relationship-graph/explore/selection*`, route => success(route, {
    selectedEpisode: { id: 'ep101', episodeNo: 101 }, availableEpisodes: [{ id: 'ep101', episodeNo: 101 }],
    analysisStatus: 'PARTIAL', partial: true, updateIncomplete: true,
    incompleteEpisodeNos: Array.from({ length: 100 }, (_, index) => index + 1), nodes: [], edges: [],
  }));
  await page.setViewportSize({ width: 320, height: 850 });
  await page.goto(workspace);
  await expect(page.getByText('일부 관계 업데이트 미완료', { exact: false })).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
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
  await page.screenshot({ path: 'test-results/gh416-relationships-desktop.png', fullPage: true });
  await page.setViewportSize({ width: 320, height: 850 });
  await expect(page.getByLabel('관계도 회차')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await expect.poll(async () => {
    const canvas = await page.locator('.episode-relationship-canvas').boundingBox();
    const cards = await page.locator('.episode-person').evaluateAll(elements => elements.map(element => { const rect = element.getBoundingClientRect(); return { left: rect.left, right: rect.right }; }));
    return Boolean(canvas && cards.every(card => card.left >= canvas.x && card.right <= canvas.x + canvas.width));
  }).toBe(true);
  await page.screenshot({ path: 'test-results/gh416-relationships-mobile-320.png', fullPage: true });
  await page.getByRole('article', { name: '선택한 인물 관계' }).screenshot({ path: 'test-results/gh416-relationships-evidence-mobile-320.png' });
});


test('mutual and one-sided ended relationships between the same people remain distinct', async ({ context, page }) => {
  await setup(context);
  await context.route(`**${prefix}/relationship-graph/explore/selection*`, route => success(route, {
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


for (const count of [3, 4, 5]) for (const width of [1366, 320]) test(`${count} mixed relations with long labels fit without card or label overlap at ${width}px`, async ({ context, page }, testInfo) => {
  const fixture = await setupParallelRelations(context, count);
  await page.setViewportSize({ width, height: 1000 });
  await page.goto(workspace);
  await expectReadableParallelRelations(page, count);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  for (const edge of fixture.edges) {
    const path = page.locator(`[data-id="${edge.id}"] .react-flow__edge-path`);
    if (edge.direction === 'MUTUAL') await expect(path).toHaveAttribute('marker-start', /url/);
    else await expect(path).not.toHaveAttribute('marker-start', /url/);
    if (edge.direction === 'UNDIRECTED') await expect(path).not.toHaveAttribute('marker-end', /url/);
    else await expect(path).toHaveAttribute('marker-end', /url/);
  }
  if (count === 5) {
    await expect(page.locator('[data-id="parallel-5"] .react-flow__edge-path')).toHaveClass(/is-ended/);
    await page.locator('.episode-relationship-canvas').screenshot({ path: testInfo.outputPath(`parallel-${count}-${width}.png`) });
  }
});

for (const direction of ['vertical', 'diagonal'] as const) test(`dragging a person ${direction} keeps distinct relations, survives selection and refresh, and resets explicitly`, async ({ context, page }, testInfo) => {
  const fixture = await setupParallelRelations(context, 5);
  await page.setViewportSize({ width: 1366, height: 1100 });
  await page.clock.install();
  await page.goto(workspace);
  await expectReadableParallelRelations(page, 5);
  const movedNode = page.locator('.react-flow__node[data-id="p2"]');
  const stationaryNode = page.locator('.react-flow__node[data-id="p1"]');
  const initialPosition = await movedNode.evaluate(element => (element as HTMLElement).style.transform);
  const paths = page.locator('.episode-relationship-canvas .react-flow__edge-path');
  const initialPaths = await paths.evaluateAll(elements => elements.map(element => element.getAttribute('d')));
  const source = await movedNode.boundingBox(), anchor = await stationaryNode.boundingBox();
  expect(source).not.toBeNull(); expect(anchor).not.toBeNull();
  const targetX = anchor!.x + anchor!.width / 2 + (direction === 'diagonal' ? 150 : 0);
  const targetY = anchor!.y + anchor!.height / 2 + 150;
  await page.mouse.move(source!.x + source!.width / 2, source!.y + source!.height / 2);
  await page.mouse.down();
  await page.mouse.move(targetX, targetY, { steps: 14 });
  await page.mouse.up();
  await expect.poll(() => movedNode.evaluate(element => (element as HTMLElement).style.transform)).not.toBe(initialPosition);
  await expect.poll(() => paths.evaluateAll(elements => elements.map(element => element.getAttribute('d')))).not.toEqual(initialPaths);
  expect(new URL(page.url()).searchParams.has('relationFocus')).toBe(false);
  await expect(page.locator('.episode-person.is-focused')).toHaveCount(0);
  await expectReadableParallelRelations(page, 5, false);
  const draggedPosition = await movedNode.evaluate(element => (element as HTMLElement).style.transform);
  await page.getByRole('button', { name: '전체 보기', exact: true }).click();
  await expectReadableParallelRelations(page, 5);
  await expect.poll(() => movedNode.evaluate(element => (element as HTMLElement).style.transform)).toBe(draggedPosition);
  await page.locator('.episode-connection-label').filter({ hasText: fixture.edges[2].label }).click();
  await expect(page.getByRole('article', { name: '선택한 인물 관계' })).toContainText(fixture.edges[2].label);
  await expect.poll(() => movedNode.evaluate(element => (element as HTMLElement).style.transform)).toBe(draggedPosition);
  const previousReads = fixture.graphReads();
  fixture.refresh();
  await page.clock.runFor(11000);
  expect(fixture.graphReads()).toBe(previousReads);
  await page.getByRole('button', { name: '관계 새로고침' }).click();
  await expect.poll(fixture.graphReads).toBeGreaterThan(previousReads);
  await expect.poll(() => movedNode.evaluate(element => (element as HTMLElement).style.transform)).toBe(draggedPosition);
  await page.getByRole('button', { name: '닫기', exact: true }).click();
  await page.locator('.episode-relationship-canvas').screenshot({ path: testInfo.outputPath(`parallel-drag-${direction}.png`) });
  await page.getByRole('button', { name: '배치 초기화', exact: true }).click();
  await expect.poll(() => movedNode.evaluate(element => (element as HTMLElement).style.transform)).toBe(initialPosition);
  await expectReadableParallelRelations(page, 5);
  expect(new URL(page.url()).searchParams.has('relationFocus')).toBe(false);
  expect(fixture.calls.writes).toEqual([]);
  const focusButton = movedNode.getByRole('button', { name: '세린 중심으로 보기', exact: true });
  await focusButton.focus();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/relationFocus=p2/);
});

type RenderedConnection = { id: string; sourceNodeId: string; targetNodeId: string; direction: string };

async function renderedConnectionState(page: Page, connections: RenderedConnection[]) {
  return page.locator('.episode-relationship-canvas').evaluate((canvas, expected) => {
    const errors: string[] = [];
    const paths = [...canvas.querySelectorAll<SVGPathElement>('.react-flow__edge-path')];
    const byId = new Map(paths.map(path => [path.closest('[data-id]')?.getAttribute('data-id'), path]));
    if (paths.length !== expected.length) errors.push(`path count ${paths.length}/${expected.length}`);
    const data: Record<string, string> = {};
    for (const connection of expected) {
      const path = byId.get(connection.id);
      if (!path) { errors.push(`${connection.id}: missing path`); continue; }
      const d = path.getAttribute('d') ?? '';
      data[connection.id] = d;
      if (!d.trim() || /NaN|Infinity|undefined/.test(d)) errors.push(`${connection.id}: invalid d ${d}`);
      const style = getComputedStyle(path);
      if (!style.stroke || style.stroke === 'none' || style.stroke === 'transparent'
        || /rgba\([^)]*,\s*0\)/.test(style.stroke) || Number(style.strokeWidth.replace('px', '')) <= 0
        || Number(style.strokeOpacity) <= 0) errors.push(`${connection.id}: invisible stroke`);
      for (let ancestor: Element | null = path; ancestor && ancestor !== canvas; ancestor = ancestor.parentElement) {
        const ancestorStyle = getComputedStyle(ancestor);
        if (ancestorStyle.display === 'none' || ancestorStyle.visibility === 'hidden'
          || ancestorStyle.visibility === 'collapse' || Number(ancestorStyle.opacity) <= 0) {
          errors.push(`${connection.id}: hidden by ${ancestor.tagName}.${ancestor.getAttribute('class')}`);
        }
      }
      const marker = (attribute: 'marker-start' | 'marker-end', required: boolean) => {
        const value = path.getAttribute(attribute) ?? '';
        const reference = value.startsWith('url(') ? value.slice(4, -1).replace(/^["']|["']$/g, '') : '';
        const id = reference.startsWith('#') ? reference.slice(1) : undefined;
        if (required && (!id || !document.getElementById(id)?.querySelector('path, polyline, polygon'))) {
          errors.push(`${connection.id}: missing ${attribute} definition`);
        }
        if (!required && value && value !== 'none') errors.push(`${connection.id}: unexpected ${attribute}`);
      };
      marker('marker-start', connection.direction === 'MUTUAL');
      marker('marker-end', connection.direction !== 'UNDIRECTED');
      try {
        const length = path.getTotalLength(), transform = path.getScreenCTM();
        if (!Number.isFinite(length) || length <= 1 || !transform) {
          errors.push(`${connection.id}: empty geometry`); continue;
        }
        for (const [distance, nodeId] of [[0, connection.sourceNodeId], [length, connection.targetNodeId]] as const) {
          const point = path.getPointAtLength(distance).matrixTransform(transform);
          const card = [...canvas.querySelectorAll('.react-flow__node')].find(node => node.getAttribute('data-id') === nodeId)?.getBoundingClientRect();
          if (!Number.isFinite(point.x) || !Number.isFinite(point.y) || !card
            || point.x < card.left - 2 || point.x > card.right + 2 || point.y < card.top - 2 || point.y > card.bottom + 2) {
            errors.push(`${connection.id}: endpoint detached from ${nodeId}`);
          }
        }
      } catch (error) { errors.push(`${connection.id}: invalid SVG geometry ${String(error)}`); }
    }
    return { errors, data, count: paths.length };
  }, connections);
}

test('dense overview keeps 50 people and 100 relations selectable and returns from a focused view', async ({ context, page }, testInfo) => {
  const reactFlowWarnings: string[] = [];
  page.on('console', message => {
    if (['warning', 'error'].includes(message.type()) && /\[React Flow\]|reactflow\.dev\/error#015/i.test(message.text())) {
      reactFlowWarnings.push(message.text());
    }
  });
  const fixture = await setup(context);
  const nodes = Array.from({ length: 50 }, (_, index) => ({ id: `dense-${index}`, name: `예시 인물 ${index}`, profileRegistered: false }));
  const edges = nodes.flatMap((node, index) => [1, 7].map(offset => ({
    id: `${node.id}-${offset}`, sourceNodeId: node.id, targetNodeId: nodes[(index + offset) % nodes.length].id,
    axis: 'ATTITUDE', kind: 'TRUST', label: offset === 1 ? '서로 쌓아 온 신뢰' : '아직 남아 있는 경계', summary: '',
    direction: offset === 1 ? 'MUTUAL' : 'DIRECTED', status: index % 11 === 0 ? 'ENDED' : 'ACTIVE', version: 1, evidenceCount: 0,
  })));
  await context.route(`**${prefix}/relationship-graph/explore/selection*`, route => success(route, {
    selectedEpisode: episodes[0], availableEpisodes: episodes, revision: 'dense-1', analysisStatus: 'COMPLETED', partial: false,
    nodes, edges, truncated: false, totalEdgeCount: edges.length,
  }));
  await page.setViewportSize({ width: 1366, height: 1000 });
  await page.goto(workspace);
  const canvas = page.locator('.episode-relationship-canvas');
  await expect(canvas.locator('.episode-person')).toHaveCount(50);
  await expect(canvas.locator('.episode-connection-label')).toHaveCount(100);
  const readZoom = () => canvas.locator('.react-flow__viewport').evaluate(element => new DOMMatrixReadOnly(getComputedStyle(element).transform).a);
  // This dense graph needs a smaller fit; the initial view keeps a readable exploration scale.
  await expect.poll(readZoom).toBeCloseTo(0.6, 4);
  const initialZoom = await readZoom();
  await page.getByRole('button', { name: '전체 보기', exact: true }).click();
  await expect.poll(readZoom).toBeLessThan(initialZoom);
  const fittedZoom = await readZoom();
  await expect.poll(() => canvas.evaluate(element => {
    const boundary = element.getBoundingClientRect();
    return [...element.querySelectorAll('.episode-person')].every(person => {
      const card = person.getBoundingClientRect();
      return card.left >= boundary.left - 1 && card.right <= boundary.right + 1
        && card.top >= boundary.top - 1 && card.bottom <= boundary.bottom + 1;
    });
  })).toBe(true);
  await expect.poll(() => canvas.evaluate(element => {
    const cards = [...element.querySelectorAll('.episode-person, .episode-connection-label')].map(item => item.getBoundingClientRect());
    return cards.every((card, index) => card.width > 1 && cards.slice(index + 1).every(other =>
      card.right <= other.left + 0.1 || card.left >= other.right - 0.1 || card.bottom <= other.top + 0.1 || card.top >= other.bottom - 0.1));
  })).toBe(true);
  const overviewScreenshot = testInfo.outputPath('dense-overview-desktop.png');
  await canvas.screenshot({ path: overviewScreenshot });
  await testInfo.attach('dense-overview-desktop', { path: overviewScreenshot, contentType: 'image/png' });
  const dragged = canvas.locator('.react-flow__node[data-id="dense-0"]');
  const initial = await dragged.getAttribute('style');
  await expect.poll(async () => (await renderedConnectionState(page, edges)).errors).toEqual([]);
  const beforeDrag = await renderedConnectionState(page, edges);
  const dragSamples = [{ phase: 'before', ...beforeDrag }];
  await canvas.evaluate(element => {
    const state = { minimumPathCount: element.querySelectorAll('.react-flow__edge-path').length, observedCounts: [] as number[] };
    const observer = new MutationObserver(() => {
      const count = element.querySelectorAll('.react-flow__edge-path').length;
      state.minimumPathCount = Math.min(state.minimumPathCount, count);
      if (state.observedCounts.at(-1) !== count) state.observedCounts.push(count);
    });
    observer.observe(element, { childList: true, subtree: true });
    Object.assign(element, { dragPathObservation: { state, observer } });
  });
  const box = (await dragged.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  try {
    for (const [index, [dx, dy]] of [[15, 12], [30, 24], [45, 35]].entries()) {
      const previousPosition = await dragged.getAttribute('style');
      await page.mouse.move(box.x + box.width / 2 + dx, box.y + box.height / 2 + dy, { steps: 4 });
      await expect(dragged).toHaveClass(/dragging/);
      await expect.poll(() => dragged.getAttribute('style')).not.toBe(previousPosition);
      const sample = await renderedConnectionState(page, edges);
      dragSamples.push({ phase: `moving-${index + 1}`, ...sample });
      expect.soft(sample.errors, `All 100 SVG strokes remain visible during move ${index + 1}`).toEqual([]);
      expect.soft(sample.data['dense-0-1'], 'The attached path follows the actual pointer drag').not.toBe(beforeDrag.data['dense-0-1']);
    }
  } finally { await page.mouse.up(); }
  await expect(dragged).not.toHaveClass(/dragging/);
  await expect.poll(() => dragged.getAttribute('style')).not.toBe(initial);
  const observation = await canvas.evaluate(element => {
    const { state, observer } = (element as unknown as Element & {
      dragPathObservation: { state: { minimumPathCount: number; observedCounts: number[] }; observer: MutationObserver };
    }).dragPathObservation;
    observer.disconnect();
    return state;
  });
  await testInfo.attach('dense-drag-path-mutations', { body: JSON.stringify(observation, null, 2), contentType: 'application/json' });
  expect.soft(observation.minimumPathCount, `SVG paths must not disappear between pointer moves: ${observation.observedCounts.join(' → ')}`).toBe(100);
  const afterDrag = await renderedConnectionState(page, edges);
  dragSamples.push({ phase: 'after', ...afterDrag });
  await testInfo.attach('dense-drag-rendered-paths', { body: JSON.stringify(dragSamples, null, 2), contentType: 'application/json' });
  expect(afterDrag.errors, 'All 100 SVG strokes remain visible after pointer release').toEqual([]);
  await expect(canvas.locator('.episode-connection-label')).toHaveCount(100);
  expect(new URL(page.url()).searchParams.has('relationFocus')).toBe(false);
  await page.getByRole('button', { name: '배치 초기화', exact: true }).click();
  await expect.poll(() => dragged.getAttribute('style')).toBe(initial);
  await expect.poll(readZoom).toBeCloseTo(0.6, 4);
  await testInfo.attach('dense-overview-viewport', {
    body: JSON.stringify({ initialZoom, fittedZoom, resetZoom: await readZoom() }, null, 2), contentType: 'application/json',
  });
  await page.getByLabel('관계도 인물 검색').fill('예시 인물 0');
  await page.getByRole('button', { name: '예시 인물 0 중심으로 보기', exact: true }).first().click();
  await expect(canvas.locator('.episode-person')).toHaveCount(5);
  await expect(canvas.locator('.episode-connection-label')).toHaveCount(4);
  await expect(canvas.locator('.episode-person.is-focused')).toContainText('예시 인물 0');
  await page.getByRole('button', { name: '뒤로가기', exact: true }).click();
  await expect(canvas.locator('.episode-person')).toHaveCount(50);
  await expect(canvas.locator('.episode-connection-label')).toHaveCount(100);
  await page.setViewportSize({ width: 320, height: 850 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  expect(fixture.calls.writes).toEqual([]);
  await testInfo.attach('dense-drag-react-flow-warnings', { body: JSON.stringify(reactFlowWarnings, null, 2), contentType: 'application/json' });
  expect(reactFlowWarnings, 'Dragging, resetting, focusing, and resizing must not warn about uninitialized React Flow nodes').toEqual([]);
});

async function setupLargeGraph(context: BrowserContext, count = 300, pairCounts: Record<number, number> = {}) {
  const fixture = await setup(context);
  const people = [{ id: 'center', name: '유비', profileRegistered: true }, ...Array.from({ length: count }, (_, index) => ({ id: `large-${index}`, name: index === 299 ? '공명' : `관계 인물 ${index}`, profileRegistered: true }))];
  const relations = people.slice(1).flatMap((node, index) => Array.from({ length: pairCounts[index] ?? 1 }, (_, relation) => ({ id: `large-edge-${index}-${relation}`, sourceNodeId: 'center', targetNodeId: node.id,
    axis: 'SOCIAL', kind: 'COMPANIONSHIP', label: '동료', summary: '함께 뜻을 모았다.', direction: 'MUTUAL', status: index === 299 ? 'ENDED' : 'ACTIVE', version: 1, evidenceCount: 1 })));
  const calls: string[] = [];
  await context.route(`**${prefix}/relationship-graph/explore/selection*`, route => {
    const url = new URL(route.request().url()); calls.push(url.search);
    return success(route, { selectedEpisode: episodes[1], availableEpisodes: episodes, revision: 'large', nodes: people, edges: relations,
      totalEdgeCount: relations.length, analysisStatus: 'COMPLETED', updateIncomplete: false });
  });
  await context.route(`**${prefix}/relationship-graph/people*`, route => {
    const url = new URL(route.request().url()); const query = url.searchParams.get('query') ?? '';
    calls.push(`search:${query}`);
    const focus = url.searchParams.get('focusNodeId');
    const all = people.filter(node => (!focus || node.id !== focus && relations.some(e => (e.sourceNodeId === focus && e.targetNodeId === node.id) || (e.targetNodeId === focus && e.sourceNodeId === node.id)))
      && (node.name.includes(query) || query === '제갈량' && node.name === '공명'))
      .map(node => ({ node, neighborCount: node.id === 'center' ? count : 1, edgeCount: relations.filter(edge => (edge.sourceNodeId === node.id || edge.targetNodeId === node.id) && (!focus || edge.sourceNodeId === focus || edge.targetNodeId === focus)).length }))
      .sort((a, b) => b.edgeCount - a.edgeCount);
    const page = Number(url.searchParams.get('page') ?? 0), size = Number(url.searchParams.get('size') ?? 24);
    return success(route, { content: all.slice(page * size, (page + 1) * size), page, size, totalElements: all.length,
      totalPages: Math.ceil(all.length / size), hasNext: (page + 1) * size < all.length });
  });
  return { ...fixture, explorerCalls: calls };
}

for (const width of [1366, 320]) test(`large graph starts with people and searches outside the initial subset at ${width}px`, async ({ context, page }, testInfo) => {
  const fixture = await setupLargeGraph(context);
  await page.setViewportSize({ width, height: 900 });
  await page.goto(workspace);
  await expect(page.getByRole('heading', { name: '어떤 인물의 관계를 살펴볼까요?' })).toBeVisible();
  await expect(page.locator('.episode-relationship-canvas')).toHaveCount(0);
  await expect(page.getByText('아직 표시할 인물 관계가 없어요.')).toHaveCount(0);
  await expect(page.getByLabel('관계도 인물 선택')).toContainText('유비');
  await page.screenshot({ path: testInfo.outputPath(`explorer-entry-${width}.png`), fullPage: true });
  const input = page.getByLabel('관계도 인물 검색');
  await input.dispatchEvent('compositionstart');
  await input.fill('제갈');
  await page.waitForTimeout(350);
  expect(fixture.explorerCalls.filter(call => call.startsWith('search:') && call !== 'search:')).toEqual([]);
  await input.fill('제갈량');
  await input.dispatchEvent('compositionend');
  await page.getByRole('button', { name: '공명 중심으로 보기', exact: true }).click();
  await expect(page).toHaveURL(/relationFocus=large-299/);
  await expect(page.getByRole('list', { name: '이 회차의 관계 목록' }).locator('li')).toHaveCount(1);
  await expect(page.getByRole('list', { name: '이 회차의 관계 목록' })).toContainText('종료된 관계');
  await expect(page.locator('.episode-person')).toHaveCount(2);
  expect(fixture.explorerCalls.some(call => call.includes('focusNodeId=large-299'))).toBe(true);
  await page.goBack();
  await expect(page.getByRole('heading', { name: '어떤 인물의 관계를 살펴볼까요?' })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

for (const counterpart of [false, true]) test(`native Korean composition stays intact in the ${counterpart ? 'counterpart' : 'people'} search`, async ({ context, page, browserName }) => {
  test.skip(browserName !== 'chromium', 'Native composition is driven through Chromium CDP.');
  const fixture = await setupLargeGraph(context);
  const searchKey = counterpart ? 'relationPeerSearch' : 'relationSearch';
  const pageKey = counterpart ? 'relationPeerListPage' : 'relationListPage';
  await page.goto(`${workspace}${counterpart ? '&relationFocus=center' : ''}&${pageKey}=1`);
  const directory = page.getByLabel(counterpart ? '연결 상대 선택' : '관계도 인물 선택', { exact: true });
  await expect(directory.locator('.episode-relationship-suggestions > *')).toHaveCount(24);
  const input = directory.getByRole('textbox');
  await input.focus();
  const originalInput = await input.elementHandle();
  const cdp = await context.newCDPSession(page);
  for (const [index, text] of ['ㅈ', '조', '조ㅈ', '조조'].entries()) {
    await cdp.send('Input.imeSetComposition', { text, selectionStart: text.length, selectionEnd: text.length });
    // Wait beyond the search debounce while the browser still owns composition.
    await page.waitForTimeout(index === 0 ? 350 : 50);
    await expect(input).toHaveValue(text);
    await expect(input).toBeFocused();
    expect(await originalInput!.evaluate(node => node.isConnected)).toBe(true);
    expect(new URL(page.url()).searchParams.has(searchKey)).toBe(false);
    expect(fixture.explorerCalls.filter(call => call.startsWith('search:') && call !== 'search:')).toEqual([]);
  }
  await cdp.send('Input.insertText', { text: '조조' });
  await expect(input).toHaveValue('조조');
  await expect.poll(() => new URL(page.url()).searchParams.get(searchKey)).toBe('조조');
  expect(new URL(page.url()).searchParams.has(pageKey)).toBe(false);
  await expect.poll(() => fixture.explorerCalls.filter(call => call.startsWith('search:') && call !== 'search:')).toEqual(['search:조조']);
  // Paste, clear and browser history restore the same input without leaving an IME lock.
  await input.fill('공명');
  await expect(directory.getByText('공명', { exact: true })).toBeVisible();
  await input.fill('');
  await expect(directory.locator('.episode-relationship-suggestions > *')).toHaveCount(24);
  await directory.getByRole('button', { name: '다음 인물', exact: true }).click();
  await input.fill('공명');
  await expect(directory.getByText('공명', { exact: true })).toBeVisible();
  await page.goBack();
  await expect(input).toHaveValue('');
  await expect(directory.locator('.episode-relationship-suggestions > *')).toHaveCount(24);
});

test('default entry applies multiple counterparts only on demand and restores them across reload and back', async ({ context, page }) => {
  const fixture = await setupLargeGraph(context);
  await page.goto(defaultWorkspace);
  await page.getByRole('button', { name: '유비 중심으로 보기', exact: true }).click();
  await expect(page.getByLabel('연결 상대 선택', { exact: true })).toBeVisible();
  await expect(page.locator('.episode-relationship-canvas')).toHaveCount(0);
  const before = fixture.explorerCalls.filter(c => !c.startsWith('search:')).length;
  await page.getByRole('checkbox', { name: '관계 인물 0 선택', exact: true }).check();
  await page.getByRole('button', { name: '다음 인물', exact: true }).click();
  await page.getByRole('checkbox', { name: '관계 인물 24 선택', exact: true }).check();
  await expect(page.getByLabel('선택한 상대')).toContainText('관계 인물 0');
  await expect(page.getByText('선택한 인물 2명 · 관계 2개')).toBeVisible();
  expect(fixture.explorerCalls.filter(c => !c.startsWith('search:')).length).toBe(before);
  await page.getByRole('button', { name: '관계 보기', exact: true }).click();
  await expect(page.getByRole('list', { name: '이 회차의 관계 목록' }).locator('li')).toHaveCount(2);
  await expect(page).toHaveURL(/relationPeers=/);
  await page.reload();
  await expect(page.locator('.episode-person')).toHaveCount(3);
  await page.getByRole('button', { name: '상대 선택 변경', exact: true }).click();
  await expect(page.getByText('선택한 인물 2명 · 관계 2개')).toBeVisible();
  await page.getByRole('button', { name: '취소', exact: true }).click();
  await expect(page.locator('.episode-person')).toHaveCount(3);
  await page.goBack();
  await expect(page.getByLabel('연결 상대 선택', { exact: true })).toBeVisible();
  expect(new URL(page.url()).searchParams.has('relationPage')).toBe(false);
});

for (const width of [1366, 320]) test(`relationship back button restores counterpart choices then the people search at ${width}px`, async ({ context, page }) => {
  await setupLargeGraph(context);
  await page.setViewportSize({ width, height: 900 });
  await page.goto(workspace);
  const directory = page.getByLabel('관계도 인물 선택', { exact: true });
  await directory.getByRole('textbox').fill('유비');
  await directory.getByRole('button', { name: '유비 중심으로 보기', exact: true }).click();
  await page.getByRole('checkbox', { name: '관계 인물 0 선택', exact: true }).check();
  await page.getByRole('checkbox', { name: '관계 인물 1 선택', exact: true }).check();
  await page.getByRole('button', { name: '관계 보기', exact: true }).click();
  await expect(page.getByRole('list', { name: '이 회차의 관계 목록' }).locator('li')).toHaveCount(2);
  const back = page.getByRole('button', { name: '뒤로가기', exact: true });
  await expect(back).toHaveAttribute('title', '연결 상대 선택으로 돌아가기');
  await back.click();
  await expect(page.getByText('선택한 인물 2명 · 관계 2개')).toBeVisible();
  await expect(page.getByRole('checkbox', { name: '관계 인물 0 선택', exact: true })).toBeChecked();
  await expect(page.getByRole('checkbox', { name: '관계 인물 1 선택', exact: true })).toBeChecked();
  await expect(page.locator('.episode-relationship-canvas')).toHaveCount(0);
  await expect(back).toHaveAttribute('title', '인물 선택으로 돌아가기');
  await back.click();
  await expect(directory.getByRole('textbox')).toHaveValue('유비');
  await expect(directory.getByRole('button', { name: '유비 중심으로 보기', exact: true })).toBeVisible();
  expect(new URL(page.url()).searchParams.has('relationFocus')).toBe(false);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test('server search hides failed results and ignores an older delayed response', async ({ context, page }) => {
  await setupLargeGraph(context);
  let release!: () => void, received!: () => void;
  const held = new Promise<void>(resolve => { release = resolve; });
  const started = new Promise<void>(resolve => { received = resolve; });
  let fail = true;
  await context.route(`**${prefix}/relationship-graph/people*`, async route => {
    const query = new URL(route.request().url()).searchParams.get('query');
    if (query === '제갈량') { received(); await held; }
    if (query === '실패' && fail) return route.fulfill({ status: 400, json: { success: false, error: { status: 400, code: 'TEST_SEARCH_ERROR' } } });
    const node = query === '제갈량' ? { id: 'large-299', name: '공명' } : { id: 'center', name: '유비' };
    await success(route, { content: [{ node, neighborCount: 1 }], page: 0, size: 20, hasNext: false }).catch(() => {});
  });
  await page.goto(workspace);
  const input = page.getByLabel('관계도 인물 검색');
  await input.fill('실패');
  const results = page.getByLabel('인물 검색 결과');
  await expect(results).toContainText('인물을 찾지 못했어요. 다시 시도해 주세요.');
  fail = false;
  await results.getByRole('button', { name: '다시 불러오기', exact: true }).click();
  await expect(results.getByRole('button', { name: '유비 중심으로 보기' })).toBeVisible();
  await input.fill('제갈량');
  await started;
  await input.fill('유비');
  await expect(results.getByRole('button', { name: '유비 중심으로 보기' })).toBeVisible();
  release();
  await expect(results.getByRole('button', { name: '공명 중심으로 보기' })).toHaveCount(0);
  await page.getByLabel('관계도 회차').selectOption('1');
  await expect(input).toHaveValue('');
  await expect(results).toBeVisible();
});


test('100 people start with selection even with fewer than 300 relationships', async ({ context, page }) => {
  await setupLargeGraph(context, 99);
  await page.goto(workspace);
  await expect(page.getByRole('heading', { name: '어떤 인물의 관계를 살펴볼까요?' })).toBeVisible();
  await expect(page.locator('.episode-relationship-caption')).toContainText('인물 100명 · 관계 99개');
  await expect(page.locator('.episode-relationship-canvas')).toHaveCount(0);
});

for (const count of [199, 200]) test(`${count} direct relationships choose the correct entry`, async ({ context, page }) => {
  await setupLargeGraph(context, count);
  await page.goto(`${workspace}&relationFocus=center`);
  if (count === 199) {
    await expect(page.getByRole('list', { name: '이 회차의 관계 목록' }).locator('li')).toHaveCount(199);
    await expect(page.getByLabel('연결 상대 선택', { exact: true })).toHaveCount(0);
  } else {
    await expect(page.getByLabel('연결 상대 선택', { exact: true })).toBeVisible();
    await expect(page.locator('.episode-relationship-canvas')).toHaveCount(0);
  }
});

test('20-person limit preserves selections across search and allows deselection at 320px', async ({ context, page }) => {
  await setupLargeGraph(context);
  await page.setViewportSize({ width: 320, height: 850 });
  await page.goto(`${workspace}&relationFocus=center`);
  const choices = page.getByRole('checkbox');
  await expect(choices).toHaveCount(24);
  for (let index = 0; index < 20; index++) await choices.nth(index).check();
  await expect(choices.nth(20)).toBeDisabled();
  await page.getByLabel('연결 상대 검색').fill('공명');
  await expect(page.getByRole('checkbox', { name: '공명 선택', exact: true })).toBeDisabled();
  await page.getByRole('button', { name: '관계 인물 0 선택 해제', exact: true }).click();
  await page.getByRole('checkbox', { name: '공명 선택', exact: true }).check();
  await expect(page.getByText('선택한 인물 20명 · 관계 20개')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.getByRole('button', { name: '관계 보기', exact: true }).click();
  await expect(page.getByRole('list', { name: '이 회차의 관계 목록' }).locator('li')).toHaveCount(20);
});

test('combined edge limit permits exactly 200 and blocks an overflowing counterpart', async ({ context, page }) => {
  await setupLargeGraph(context, 30, { 0: 120, 1: 80, 2: 81 });
  await page.goto(`${workspace}&relationFocus=center`);
  await page.getByRole('checkbox', { name: '관계 인물 0 선택', exact: true }).check();
  await expect(page.getByRole('checkbox', { name: '관계 인물 2 선택', exact: true })).toBeDisabled();
  await page.getByRole('checkbox', { name: '관계 인물 1 선택', exact: true }).check();
  await expect(page.getByText('선택한 인물 2명 · 관계 200개')).toBeVisible();
  await page.getByRole('button', { name: '관계 인물 0 선택 해제', exact: true }).click();
  await expect(page.getByRole('checkbox', { name: '관계 인물 2 선택', exact: true })).toBeEnabled();
});

test('one oversized pair remains selectable and paginates 200 plus one without losing URL scope', async ({ context, page }) => {
  await setupLargeGraph(context, 30, { 0: 201 });
  await page.goto(`${workspace}&relationFocus=center`);
  await page.getByRole('checkbox', { name: '관계 인물 0 선택', exact: true }).check();
  await expect(page.getByRole('checkbox', { name: '관계 인물 1 선택', exact: true })).toBeDisabled();
  await page.getByRole('button', { name: '관계 보기', exact: true }).click();
  const list = page.getByRole('list', { name: '이 회차의 관계 목록' });
  await expect(list.locator('li')).toHaveCount(200);
  await page.getByRole('button', { name: '다음 관계', exact: true }).click();
  await expect(list.locator('li')).toHaveCount(1);
  await page.reload();
  await expect(list.locator('li')).toHaveCount(1);
  await page.goBack();
  await expect(list.locator('li')).toHaveCount(200);
  expect(new URL(page.url()).searchParams.get('relationPeers')).toBe('large-0');
  await expect(page.getByRole('tab', { name: '인물 관계도' })).toHaveAttribute('aria-selected', 'true');
});

test('server rejected stale selection can return to counterparts without exposing a cached graph', async ({ context, page }) => {
  await setupLargeGraph(context);
  await context.route(`**${prefix}/relationship-graph/explore/selection*`, route => {
    if (!new URL(route.request().url()).searchParams.has('counterpartNodeIds')) return route.fallback();
    return route.fulfill({ status: 400, json: { success: false, error: { status: 400, code: 'RELATIONSHIP_SELECTION_LIMIT_EXCEEDED' } } });
  });
  await page.goto(`${workspace}&relationFocus=center&relationPeers=large-0,large-1`);
  await page.getByRole('button', { name: '상대 다시 선택', exact: true }).click();
  await expect(page.getByLabel('연결 상대 선택', { exact: true })).toBeVisible();
  await expect(page.locator('.episode-relationship-canvas')).toHaveCount(0);
  await expect(page.getByText('선택한 인물 0명 · 관계 0개')).toBeVisible();
});
