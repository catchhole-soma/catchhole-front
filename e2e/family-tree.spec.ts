import { expect, test, type BrowserContext, type Locator, type Page, type Route } from '@playwright/test';
import type { RelationshipResponse, WorldSettingImageResponse } from '../src/app/api/generated/types.gen';
import { createLargeFamilyFixture, familyTreeFixtures, type FamilyTreeFixture } from './fixtures/family-tree-fixtures';

test.skip(process.env.VITE_RELATIONSHIP_WORKSPACE_ENABLED !== 'true', '가계도 미리보기 전용 테스트입니다.');

const workId = '11111111-1111-4111-8111-111111111111';
const factId = '66666666-6666-4666-8666-666666666666';
const prefix = `/api/v1/works/${workId}`;
const workspace = `/dashboard?workId=${workId}&nav=graph`;
const uuid = (index: number, group = 2) => `${group}0000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`;
type Edge = Required<Pick<RelationshipResponse, 'id' | 'subjectCharacterId' | 'objectCharacterId' | 'kind' | 'subtype' | 'temporalScope'>> & { version: number; timeLabel?: string };
type Person = { id: string; name: string; image?: WorldSettingImageResponse | null; nodeType?: 'CHARACTER' | 'MENTION'; candidateId?: string };

function apiFixture(fixture: FamilyTreeFixture) {
  const ids = new Map(fixture.nodes.map((node, index) => [node.id, uuid(index)]));
  return {
    nodes: fixture.nodes.map((node): Person => ({ id: ids.get(node.id)!, name: node.name })),
    edges: fixture.edges.map((edge, index) => ({ ...edge, id: uuid(index, 3), version: 1,
      subjectCharacterId: ids.get(edge.subjectCharacterId)!, objectCharacterId: ids.get(edge.objectCharacterId)!,
    })) as Edge[],
  };
}
function success(route: Route, data: unknown) {
  return route.fulfill({ contentType: 'application/json', body: JSON.stringify({ success: true, data, error: null }) });
}
function failure(route: Route, status = 503) {
  return route.fulfill({ status, contentType: 'application/json', body: JSON.stringify({ success: false, data: null,
    message: '가계도를 불러오지 못했어요. 다시 시도해 주세요.', error: { code: 'COMMON_ERROR', status } }) });
}

async function setup(context: BrowserContext, family: ReturnType<typeof apiFixture> = apiFixture(familyTreeFixtures[0])) {
  let nodes = family.nodes;
  let edges = family.edges;
  const allRelations = new Map(edges.map(edge => [edge.id, edge]));
  const withdrawn = new Set<string>();
  let revision = 1;
  let pendingCount = 2;
  let broken = false;
  let forceTruncated = false;
  let directoryTotal = 1;
  let directoryPaged = false;
  let expired = false;
  let held: { gate: Promise<void>; received: () => void } | null = null;
  const calls = { graphs: [] as Array<Record<string, string>>, mutations: [] as string[], profiles: [] as string[], quotes: 0, refreshes: 0, directories: 0 };
  const outsidePerson = { id: uuid(999), name: '목록 밖 먼 가족' };
  const relation = (edge: Edge): RelationshipResponse => ({ ...edge,
    subjectCharacterName: nodes.find(node => node.id === edge.subjectCharacterId)?.name,
    objectCharacterName: nodes.find(node => node.id === edge.objectCharacterId)?.name,
    validity: withdrawn.has(edge.id) ? 'WITHDRAWN' : 'VALID', visibleInFamilyTree: !withdrawn.has(edge.id) && edge.temporalScope === 'CURRENT',
    evidence: [{ sourceFactId: factId, characterId: edge.subjectCharacterId, sourceToken: 'a'.repeat(64), current: true,
      hasEvidence: true, manuallyEdited: false, factKey: 'profile.family', currentValue: { factValue: '가족 관계가 원문에 명시되어 있다.' } }],
  });
  await context.addInitScript(() => {
    localStorage.setItem('accessToken', 'synthetic-family-tree-token');
    localStorage.removeItem('catchhole_demo_mode');
  });
  await context.route('**/api/v1/**', async route => {
    const request = route.request(); const url = new URL(request.url()); const path = url.pathname;
    if (request.method() !== 'GET' && !path.endsWith('/auth/refresh')) calls.mutations.push(`${request.method()} ${path}`);
    if (path.endsWith('/auth/refresh')) { calls.refreshes++; return success(route, { accessToken: 'rotated-family-tree-token' }); }
    if (path.endsWith('/auth/me')) return success(route, { id: 1, email: 'tree@example.test', displayName: '가계도 검증', role: 'AUTHOR', status: 'ACTIVE' });
    if (path === '/api/v1/works') return success(route, [{ id: workId, title: '가계도 검증 작품', genre: '판타지', episodeCount: 0 }]);
    if (path === prefix) return success(route, { id: workId, title: '가계도 검증 작품', genre: '판타지', lifecycleStatus: 'ACTIVE' });
    if (path === `${prefix}/family-tree`) {
      calls.graphs.push(Object.fromEntries(url.searchParams));
      if (expired) { expired = false; return failure(route, 401); }
      if (broken) return failure(route);
      const includeHistorical = url.searchParams.get('includeHistorical') === 'true';
      const focusCharacterId = url.searchParams.get('focusCharacterId');
      const limit = Number(url.searchParams.get('limit') ?? 100);
      let selectedEdges = edges.filter(edge => !withdrawn.has(edge.id) && (includeHistorical || edge.temporalScope === 'CURRENT'));
      let selectedNodes = nodes;
      if (focusCharacterId) {
        const connected = new Set([focusCharacterId]);
        let changed = true;
        while (changed) {
          changed = false;
          for (const edge of selectedEdges) {
            if (!connected.has(edge.subjectCharacterId) && !connected.has(edge.objectCharacterId)) continue;
            for (const id of [edge.subjectCharacterId, edge.objectCharacterId]) if (!connected.has(id)) { connected.add(id); changed = true; }
          }
        }
        selectedEdges = selectedEdges.filter(edge => connected.has(edge.subjectCharacterId));
        selectedNodes = [...nodes, outsidePerson].filter(node => connected.has(node.id));
      }
      const totalEdgeCount = forceTruncated && !focusCharacterId ? 250 : selectedEdges.length;
      const totalNodeCount = forceTruncated && !focusCharacterId ? 180 : selectedNodes.length;
      const payload = { nodes: selectedNodes, edges: selectedEdges.slice(0, limit), totalNodeCount, totalEdgeCount,
        pendingCandidateCount: pendingCount, truncated: forceTruncated && !focusCharacterId || selectedEdges.length > limit,
        limit, includeHistorical, focusCharacterId, revision: String(revision) };
      const waiting = held; held = null;
      if (waiting) { waiting.received(); await waiting.gate; }
      return success(route, payload);
    }
    if (path === `${prefix}/relationship-processing`) return success(route, { state: 'SUCCEEDED', inputVersion: 1, processedVersion: 1,
      autoConfirmedCount: edges.length, reviewRequiredCount: pendingCount, unsupportedSourceCount: 0, lastProcessedAt: '2026-10-19T10:00:00' });
    if (path === `${prefix}/relationship-candidates`) return success(route, { content: [], totalElements: pendingCount, totalPages: 1, page: 0, size: 20, hasNext: false });
    if (path === `${prefix}/relationships`) return success(route, { content: edges.slice(0, 20).map(relation), totalElements: edges.length,
      totalPages: Math.ceil(edges.length / 20), page: 0, size: 20, hasNext: edges.length > 20 });
    const related = path.match(/\/relationships\/([^/]+)(\/withdraw)?$/);
    if (related) {
      const edge = allRelations.get(related[1]);
      if (!edge) return failure(route, 404);
      if (related[2]) { expect(request.postDataJSON().expectedVersion).toBe(edge.version); withdrawn.add(edge.id); revision++; }
      return success(route, relation(edge));
    }
    if (path === `${prefix}/characters`) {
      calls.directories++;
      const page = Number(url.searchParams.get('page') ?? 0);
      return success(route, { content: page * 12 >= directoryTotal ? [] : directoryPaged && page === 0 ? [nodes[0]] : [outsidePerson],
        totalElements: directoryTotal, totalPages: Math.ceil(directoryTotal / 12), page, size: 12, hasNext: (page + 1) * 12 < directoryTotal });
    }
    const character = path.match(/\/characters\/([^/]+)$/);
    if (character) {
      const person = [...nodes, outsidePerson].find(node => node.id === character[1]);
      calls.profiles.push(character[1]);
      return success(route, { ...person, profile: [{ key: 'profile.family', displayName: '가족 관계', value: '확정된 가족 설정', valueType: 'STRING', properties: [] }], stats: [], skills: [], items: [], statuses: [] });
    }
    if (path.endsWith(`/character-facts/${factId}/evidence`)) {
      calls.quotes++;
      return success(route, { content: '지훈은 자녀 도윤과 함께 수연을 기다렸다.', evidenceSpans: [{ quote: '자녀 도윤', paragraphIndex: 0 }], episode: { episodeNo: 1, title: '가족의 시작' } });
    }
    return success(route, []);
  });
  return { calls, outsidePerson, nodes, edges,
    fail(value = true) { broken = value; }, truncate() { forceTruncated = true; }, expire() { expired = true; },
    change(next: ReturnType<typeof apiFixture>) { nodes = next.nodes; edges = next.edges; revision++; for (const edge of edges) allRelations.set(edge.id, edge); },
    remove(id: string) { withdrawn.add(id); revision++; }, setPending(value: number) { pendingCount = value; revision++; },
    // Image metadata is display data: a photo-only response change need not change the family revision.
    setImage(id: string, image: WorldSettingImageResponse | null) { nodes = nodes.map(node => node.id === id ? { ...node, image } : node); },
    paginatedDirectory() { directoryPaged = true; directoryTotal = 13; }, shrinkDirectory() { directoryTotal = 1; },
    holdNext() {
      let release!: () => void; let received!: () => void;
      const gate = new Promise<void>(resolve => { release = resolve; });
      const started = new Promise<void>(resolve => { received = resolve; });
      held = { gate, received }; return { release, received: started };
    },
  };
}

async function mockTreeImages(context: BrowserContext) {
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jM5kAAAAASUVORK5CYII=', 'base64');
  const publicPath = `/api/v1/world-image-assets/${'a'.repeat(64)}.webp`;
  const replacementPath = `/api/v1/world-image-assets/${'b'.repeat(64)}.webp`;
  const brokenPath = `/api/v1/world-image-assets/${'c'.repeat(64)}.webp`;
  const privateId = uuid(0, 8), corruptPrivateId = uuid(1, 8);
  const privatePath = `${prefix}/private-world-images/${privateId}/thumbnail`;
  const corruptPrivatePath = `${prefix}/private-world-images/${corruptPrivateId}/thumbnail`;
  const calls: Array<{ path: string; authenticated: boolean }> = [];
  await context.route('**/api/v1/world-image-assets/**', route => {
    const path = new URL(route.request().url()).pathname;
    calls.push({ path, authenticated: false });
    return route.fulfill(path === brokenPath ? { status: 404 } : {
      contentType: 'image/webp', path: new URL('../src/assets/landing/rien-fire-mage.webp', import.meta.url).pathname,
    });
  });
  await context.route('**/api/v1/works/*/private-world-images/*/thumbnail', route => {
    const path = new URL(route.request().url()).pathname;
    calls.push({ path, authenticated: /^Bearer \S+$/.test(route.request().headers().authorization ?? '') });
    return route.fulfill({ contentType: 'image/png', body: path === corruptPrivatePath ? Buffer.from('invalid-image') : png });
  });
  return { calls, publicPath, replacementPath, brokenPath, privatePath, corruptPrivatePath,
    publicImage: { source: 'MANUAL', thumbnailUrl: publicPath, version: 1 } as WorldSettingImageResponse,
    privateImage: { source: 'PRIVATE', privateImageId: privateId, thumbnailUrl: privatePath, version: 1 } as WorldSettingImageResponse,
    corruptPrivateImage: { source: 'PRIVATE', privateImageId: corruptPrivateId, thumbnailUrl: corruptPrivatePath, version: 1 } as WorldSettingImageResponse,
  };
}

const graph = (page: Page) => page.getByRole('region', { name: '가계도', exact: true });
const node = (page: Page, id: string) => graph(page).locator(`[data-character-id="${id}"]`);
const edge = (page: Page, id: string) => page.locator(`[data-relationship-id="${id}"]:not([data-endpoint-label-id])`);
const connection = (page: Page, relationshipId: string) => graph(page).locator(`[data-connection-id][data-relationship-ids*="${relationshipId}"]`);
const connectionPanel = (page: Page) => page.getByRole('region', { name: '선택한 가족 연결', exact: true });
const representedRelations = (page: Page) => graph(page).locator('[data-connection-id]').evaluateAll(controls =>
  controls.flatMap(control => JSON.parse(control.getAttribute('data-relationship-ids') ?? '[]') as string[]).sort());
async function expectRepresentedRelations(page: Page, relations: Array<{ id: string }>) {
  await expect.poll(() => representedRelations(page)).toEqual(relations.map(relation => relation.id).sort());
}
async function expectAllRelationshipActions(page: Page, relations: Array<{ id: string }>) {
  await expectRepresentedRelations(page, relations);
  const controls = graph(page).locator('[data-connection-id], [data-endpoint-label-id]');
  const encountered: string[] = [];
  for (let index = 0; index < await controls.count(); index++) {
    const control = controls.nth(index);
    const ids = JSON.parse((await control.getAttribute('data-endpoint-relationship-ids')) ?? (await control.getAttribute('data-relationship-ids'))!) as string[];
    if (ids.length === 1) {
      await expect(control).toHaveAttribute('data-relationship-id', ids[0]);
      encountered.push(ids[0]);
    } else {
      await control.click();
      await expect(connectionPanel(page)).toBeFocused();
      await expect(connectionPanel(page).locator('[data-relationship-id]')).toHaveCount(ids.length);
      for (const id of ids) {
        await expect(connectionPanel(page).locator(`[data-relationship-id="${id}"]`)).toBeVisible();
        encountered.push(id);
      }
      await page.getByRole('button', { name: '가족 연결 닫기', exact: true }).click();
      await expect(connectionPanel(page)).toHaveCount(0);
      await expect(control).toBeFocused();
    }
  }
  expect([...new Set(encountered)].sort()).toEqual(relations.map(relation => relation.id).sort());
}

const viewport = (page: Page) => graph(page).locator('.react-flow__viewport');
async function expectWholeTreeInView(page: Page) {
  await expect(graph(page).locator('[data-character-id]')).not.toHaveCount(0);
  await expect.poll(() => graph(page).evaluate(region => {
    const bounds = region.getBoundingClientRect();
    return [...region.querySelectorAll('[data-character-id], [data-connection-id], [data-endpoint-label-id]')].filter(element => {
      const box = element.getBoundingClientRect();
      return box.left < bounds.left - 1 || box.right > bounds.right + 1 || box.top < bounds.top - 1 || box.bottom > bounds.bottom + 1;
    }).map(element => element.getAttribute('data-character-id') || element.getAttribute('data-connection-id'));
  }), { message: '전체 보기에서 인물과 관계 이름이 canvas 경계 안에 보여야 합니다.' }).toEqual([]);
}

async function tabToControl(page: Page, control: Locator) {
  await control.evaluate(target => {
    const stops = [...document.querySelectorAll<HTMLElement>('button, a[href], input, select, textarea, summary, [tabindex]')]
      .filter(element => element.tabIndex >= 0 && !element.matches(':disabled') && element.getClientRects().length > 0);
    stops[stops.indexOf(target as HTMLElement) - 1]?.focus({ preventScroll: true });
  });
  await page.keyboard.press('Tab');
  await expect(control).toBeFocused();
}
async function panControlOutside(page: Page, control: Locator) {
  await graph(page).scrollIntoViewIfNeeded();
  const pane = await graph(page).locator('.react-flow__pane').boundingBox();
  await page.mouse.move(pane!.x + 15, pane!.y + 15);
  await page.mouse.down();
  await page.mouse.move(pane!.x + pane!.width - 15, pane!.y + pane!.height - 15, { steps: 5 });
  await page.mouse.up();
  await expect.poll(() => control.evaluate(element => {
    const bounds = element.closest('.family-tree-canvas')!.getBoundingClientRect();
    const box = element.getBoundingClientRect();
    return box.left < bounds.left || box.right > bounds.right || box.top < bounds.top || box.bottom > bounds.bottom;
  })).toBeTruthy();
}
async function expectFocusedControlInView(control: Locator) {
  await expect.poll(() => control.evaluate(element => {
    const bounds = element.closest('.family-tree-canvas')!.getBoundingClientRect();
    const box = element.getBoundingClientRect();
    return box.left >= bounds.left && box.right <= bounds.right && box.top >= bounds.top && box.bottom <= bounds.bottom;
  })).toBeTruthy();
}
const zoom = (page: Page) => viewport(page).evaluate(element => (element as HTMLElement).style.transform.match(/scale\(([^)]+)\)/)?.[1]);

async function ordinaryReadability(page: Page) {
  return graph(page).evaluate(region => {
    const factor = Number((region.querySelector('.react-flow__viewport') as HTMLElement).style.transform.match(/scale\(([^)]+)\)/)?.[1] ?? 1);
    const luminance = (color: string) => {
      const values = color.match(/[\d.]+/g)!.slice(0, 3).map(value => {
        const channel = Number(value) / 255;
        return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
      });
      return values[0] * 0.2126 + values[1] * 0.7152 + values[2] * 0.0722;
    };
    const background = luminance(getComputedStyle(region).backgroundColor);
    const label = getComputedStyle(region.querySelector('[data-connection-id]')!);
    const foreground = luminance(label.color);
    return {
      namePixels: parseFloat(getComputedStyle(region.querySelector('[data-character-id] strong')!).fontSize) * factor,
      relationPixels: parseFloat(label.fontSize) * factor,
      relationContrast: (Math.max(background, foreground) + 0.05) / (Math.min(background, foreground) + 0.05),
    };
  });
}

test('관계도 기본 진입은 전체 가계도를 보여 주며 20번째 이후 관계도 빠짐없이 연결한다', async ({ page, context }, testInfo) => {
  const family = apiFixture(createLargeFamilyFixture(28));
  const fixture = await setup(context, family);
  await page.goto(workspace);
  await expect(graph(page)).toBeVisible();
  await expect(graph(page).locator('[data-character-id]')).toHaveCount(28);
  await expectRepresentedRelations(page, family.edges);
  await expect(connection(page, family.edges[26].id)).toBeAttached();
  await expectWholeTreeInView(page);
  expect(fixture.calls.graphs[0]).toMatchObject({ includeHistorical: 'false', limit: '100' });
  expect(fixture.calls.mutations).toEqual([]);
  await graph(page).screenshot({ path: testInfo.outputPath('family-tree-large-desktop.png') });
});

for (const width of [1280, 320]) {
  test(`${width}px 조상 연결은 중간 인물을 만들지 않고 세대 수와 생략 기호를 표시한다`, async ({ page, context }, testInfo) => {
    const family = apiFixture(familyTreeFixtures.find(item => item.id === 'explicit-ancestry')!);
    const fixture = await setup(context, family);
    await page.setViewportSize({ width, height: 800 });
    await page.goto(workspace);
    await expectWholeTreeInView(page);
    await expect(graph(page).locator('[data-character-id]')).toHaveCount(3);
    await expectRepresentedRelations(page, fixture.edges);
    await expect(graph(page).locator('[data-lineage-break]')).toHaveCount(2);
    const numbered = connection(page, fixture.edges[0].id);
    const unknown = connection(page, fixture.edges[1].id);
    await expect(numbered).toContainText('5대손');
    await expect(numbered).toContainText('중간 계보 생략');
    await expect(unknown).toContainText('세대 미상');
    await expect(graph(page).locator('[data-endpoint-label-id]').filter({ hasText: /^조상$/ })).toHaveCount(1);
    await expect(graph(page).locator('[data-endpoint-label-id]').filter({ hasText: /^후손$/ })).toHaveCount(2);
    const ancestor = await node(page, fixture.nodes[0].id).boundingBox();
    expect((await node(page, fixture.nodes[1].id).boundingBox())!.y).toBeGreaterThan(ancestor!.y + ancestor!.height);
    const unknownPerson = (await node(page, fixture.nodes[2].id).boundingBox())!;
    const uncertainRegion = graph(page).locator('.family-tree-generation-region');
    await expect(uncertainRegion).toContainText('세대 미상');
    const unknownBounds = (await uncertainRegion.boundingBox())!;
    expect(unknownPerson.x).toBeGreaterThan(unknownBounds.x);
    expect(unknownPerson.x + unknownPerson.width).toBeLessThan(unknownBounds.x + unknownBounds.width);
    expect(unknownBounds.x + unknownBounds.width).toBeLessThan(ancestor!.x);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBeTruthy();
    await graph(page).screenshot({ path: testInfo.outputPath(`ancestry-${width}.png`) });
    await graph(page).locator('[data-endpoint-label-id]').filter({ hasText: /^조상$/ }).click();
    await expect(connectionPanel(page).locator('[data-relationship-id]')).toHaveCount(2);
    await expect(connectionPanel(page).locator('header p')).toContainText('에린');
    await expect(connectionPanel(page)).toContainText('5대손');
    await expect(connectionPanel(page)).toContainText('세대 미상');
    await page.getByRole('button', { name: '가족 연결 닫기', exact: true }).click();
    await numbered.click();
    await expect(page.getByRole('article', { name: '선택한 관계 근거', exact: true })).toContainText('5대손');
    expect(fixture.calls.mutations).toEqual([]);
  });
}

test('가계도는 프로필 사진을 요약 응답에서 표시하고 사진만 갱신돼도 확대·이동한 화면을 유지한다', async ({ page, context }, testInfo) => {
  const fixture = await setup(context);
  const photos = await mockTreeImages(context);
  const [publicPerson, privatePerson, defaultPerson, brokenPerson] = fixture.nodes;
  fixture.setImage(publicPerson.id, photos.publicImage);
  fixture.setImage(privatePerson.id, photos.privateImage);
  fixture.setImage(defaultPerson.id, { ...photos.publicImage, source: 'DEFAULT' });
  fixture.setImage(brokenPerson.id, { ...photos.publicImage, thumbnailUrl: photos.brokenPath });
  await page.clock.install();
  await page.goto(workspace);
  await expectWholeTreeInView(page);
  const photo = (id: string) => node(page, id).locator('.family-tree-avatar img');
  await expect(photo(publicPerson.id)).toHaveAttribute('src', new RegExp(`${photos.publicPath}$`));
  await expect(photo(privatePerson.id)).toHaveAttribute('src', /^blob:/);
  for (const person of [publicPerson, privatePerson]) {
    await expect.poll(() => photo(person.id).evaluate(image => (image as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
  }
  for (const person of [defaultPerson, brokenPerson]) {
    await expect(photo(person.id)).toHaveCount(0);
    await expect(node(page, person.id).locator('.family-tree-avatar svg')).toBeVisible();
  }
  expect(photos.calls.filter(call => call.path === photos.privatePath)).toEqual([{ path: photos.privatePath, authenticated: true }]);
  expect(fixture.calls.profiles).toEqual([]);
  await graph(page).screenshot({ path: testInfo.outputPath('family-tree-profile-photos-desktop.png') });

  const stablePerson = (await node(page, publicPerson.id).elementHandle())!;
  await graph(page).getByRole('button', { name: '확대', exact: true }).click();
  const pane = await graph(page).locator('.react-flow__pane').boundingBox();
  await page.mouse.move(pane!.x + 15, pane!.y + pane!.height - 15);
  await page.mouse.down(); await page.mouse.move(pane!.x + 75, pane!.y + pane!.height - 45, { steps: 5 }); await page.mouse.up();
  const position = await viewport(page).evaluate(element => (element as HTMLElement).style.transform);
  const reads = fixture.calls.graphs.length;
  fixture.setImage(publicPerson.id, { ...photos.publicImage, thumbnailUrl: photos.replacementPath, version: 2 });
  fixture.setImage(privatePerson.id, photos.corruptPrivateImage);
  await page.clock.runFor(6000);
  await expect.poll(() => fixture.calls.graphs.length).toBeGreaterThan(reads);
  await expect(photo(publicPerson.id)).toHaveAttribute('src', new RegExp(`${photos.replacementPath}$`));
  await expect.poll(() => photo(publicPerson.id).evaluate(image => (image as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
  await expect(photo(privatePerson.id)).toHaveCount(0);
  await expect(node(page, privatePerson.id).locator('.family-tree-avatar svg')).toBeVisible();
  expect(photos.calls.filter(call => call.path === photos.corruptPrivatePath)).toEqual([{ path: photos.corruptPrivatePath, authenticated: true }]);
  expect(await node(page, publicPerson.id).evaluate((current, previous) => current === previous, stablePerson)).toBeTruthy();
  expect(await viewport(page).evaluate(element => (element as HTMLElement).style.transform)).toBe(position);
  expect(fixture.calls.profiles).toEqual([]);
  expect(fixture.calls.mutations).toEqual([]);
});

test('사진이 없거나 경로가 유효하지 않은 인물·이전 개인 이미지·언급 인물은 기본 아이콘을 유지한다', async ({ page, context }) => {
  const family = apiFixture(familyTreeFixtures[0]);
  const fixture = await setup(context, family);
  const photos = await mockTreeImages(context);
  const [missing, invalid, legacy, mention] = family.nodes;
  missing.image = null;
  invalid.image = { source: 'MANUAL', thumbnailUrl: 'https://untrusted.example.test/avatar.png', version: 1 };
  legacy.image = { ...photos.privateImage, vaultId: uuid(0, 9) };
  mention.nodeType = 'MENTION'; mention.candidateId = uuid(9, 3); mention.image = photos.publicImage;
  const externalRequests: string[] = [];
  await context.route('https://untrusted.example.test/**', route => { externalRequests.push(route.request().url()); return route.abort(); });
  await page.goto(workspace);
  await expect(graph(page).locator('[data-node-id]')).toHaveCount(4);
  for (const person of family.nodes) {
    const avatar = graph(page).locator(`[data-node-id="${person.id}"] .family-tree-avatar`);
    await expect(avatar.locator('img')).toHaveCount(0);
    await expect(avatar.locator('svg')).toBeVisible();
  }
  await expect(page.getByRole('button', { name: `${mention.name} 설정 근거 보기`, exact: true })).toBeVisible();
  expect(photos.calls).toEqual([]);
  expect(externalRequests).toEqual([]);
  expect(fixture.calls.profiles).toEqual([]);
  expect(fixture.calls.mutations).toEqual([]);
});

test('복합 가족·친생 입양·부모 미상·순환은 실제 인물과 관계만 각각 한 번 표시한다', async ({ page, context }, testInfo) => {
  const fixture = await setup(context);
  for (const example of familyTreeFixtures) {
    const family = apiFixture(example); fixture.change(family);
    await page.goto(`${workspace}&familyHistory=true`);
    await expect(graph(page).locator('[data-character-id]'), example.label).toHaveCount(family.nodes.length);
    await expectRepresentedRelations(page, family.edges);
    for (const person of family.nodes) await expect(node(page, person.id), `${example.label}: ${person.name}`).toHaveCount(1);
    await expectAllRelationshipActions(page, family.edges);
    if (example.id === 'ordinary') {
      await expect(graph(page).locator('[data-connection-id]')).toHaveCount(2);
      await expect(graph(page).locator('.family-tree-label-leader')).toHaveCount(0);
      const parent = await node(page, family.nodes[0].id).boundingBox();
      const child = await node(page, family.nodes[2].id).boundingBox();
      expect(parent!.y + parent!.height).toBeLessThan(child!.y);
      const readability = await ordinaryReadability(page);
      expect(readability.namePixels).toBeGreaterThanOrEqual(16);
      expect(readability.relationPixels).toBeGreaterThanOrEqual(12);
      expect(readability.relationContrast).toBeGreaterThanOrEqual(4.5);
      await testInfo.attach('ordinary-readability.json', { body: JSON.stringify(readability), contentType: 'application/json' });
    }
    if (['ordinary', 'remarried', 'biological-adoptive'].includes(example.id)) {
      await graph(page).getByRole('button', { name: '전체 보기', exact: true }).click();
      await expectWholeTreeInView(page);
      await graph(page).screenshot({ path: testInfo.outputPath(`revised-family-tree-${example.id}-desktop.png`) });
    }
  }
  expect(fixture.calls.mutations).toEqual([]);
});

test('자녀와 먼 후손의 높이를 구분하고 세대 미상 영역과 각 근거를 유지한다', async ({ page, context }, testInfo) => {
  const family = apiFixture(familyTreeFixtures.find(item => item.id === 'mixed-ancestry')!);
  const fixture = await setup(context, family);
  for (const width of [1280, 320]) {
    await page.setViewportSize({ width, height: 800 });
    await page.goto(workspace);
    await expectRepresentedRelations(page, family.edges);
    await expectWholeTreeInView(page);
    const boxes = await Promise.all(family.nodes.map(person => node(page, person.id).boundingBox()));
    expect(boxes[0]!.y + boxes[0]!.height).toBeLessThan(boxes[1]!.y);
    expect(boxes[1]!.y).toBeCloseTo(boxes[2]!.y, 1);
    expect(boxes[1]!.y + boxes[1]!.height).toBeLessThan(boxes[3]!.y);
    expect(boxes[3]!.y + boxes[3]!.height).toBeLessThan(boxes[4]!.y);
    const region = graph(page).locator('.family-tree-generation-region');
    await expect(region).toContainText('세대 미상');
    const bounds = (await region.boundingBox())!;
    expect(boxes[5]!.x).toBeGreaterThan(bounds.x);
    expect(boxes[5]!.x + boxes[5]!.width).toBeLessThan(bounds.x + bounds.width);
    expect(boxes[5]!.y).toBeGreaterThan(bounds.y);
    expect(boxes[5]!.y + boxes[5]!.height).toBeLessThan(bounds.y + bounds.height);
    await expectAllRelationshipActions(page, family.edges);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBeTruthy();
    await graph(page).screenshot({ path: testInfo.outputPath(`mixed-ancestry-${width}.png`) });
  }
  expect(fixture.calls.mutations).toEqual([]);
});

test('인물 프로필과 관계·원문 근거를 기존 모달로 열고 URL·뒤로가기·키보드 초점을 보존한다', async ({ page, context }) => {
  const fixture = await setup(context);
  await page.goto(workspace);
  const person = fixture.nodes[0];
  const personButton = page.getByRole('button', { name: `${person.name} 프로필 열기`, exact: true });
  await expectWholeTreeInView(page);
  for (let step = 0; step < 3; step++) await graph(page).getByRole('button', { name: '확대', exact: true }).click();
  const currentZoom = await zoom(page);
  await panControlOutside(page, personButton);
  await tabToControl(page, personButton);
  await expectFocusedControlInView(personButton);
  expect(await zoom(page)).toBe(currentZoom);
  const profilePosition = await viewport(page).evaluate(element => (element as HTMLElement).style.transform);
  await page.keyboard.press('Enter');
  await expect(page.getByRole('dialog')).toContainText('확정된 가족 설정');
  expect(new URL(page.url()).searchParams.get('charId')).toBe(person.id);
  expect(new URL(page.url()).searchParams.get('modal')).toBe('char-detail');
  expect(new URL(page.url()).searchParams.get('nav')).toBe('graph');
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(personButton).toBeFocused();
  expect(await viewport(page).evaluate(element => (element as HTMLElement).style.transform)).toBe(profilePosition);
  const selected = fixture.edges.find(relation => relation.kind === 'PARENT_OF')!;
  const familyConnection = connection(page, selected.id);
  await panControlOutside(page, familyConnection);
  await tabToControl(page, familyConnection);
  await expectFocusedControlInView(familyConnection);
  await expect(familyConnection).toBeFocused();
  expect(await zoom(page)).toBe(currentZoom);
  const evidencePosition = await viewport(page).evaluate(element => (element as HTMLElement).style.transform);
  await page.keyboard.press('Enter');
  await expect(connectionPanel(page)).toBeFocused();
  await edge(page, selected.id).click();
  await expect(page.getByRole('article', { name: '선택한 관계 근거' })).toBeFocused();
  await expect(page.getByRole('article', { name: '선택한 관계 근거' })).toBeInViewport();
  await expect(page.getByText('가족 관계가 원문에 명시되어 있다.', { exact: true })).toBeVisible();
  expect(new URL(page.url()).searchParams.get('relationshipId')).toBe(selected.id);
  await page.getByRole('button', { name: '관계 근거 닫기', exact: true }).click();
  await expect(page.getByRole('article', { name: '선택한 관계 근거' })).toHaveCount(0);
  await expect.poll(() => new URL(page.url()).searchParams.get('relationshipId')).toBeNull();
  await expect(edge(page, selected.id)).toBeFocused();
  await expect(edge(page, selected.id)).toBeInViewport();
  expect(await viewport(page).evaluate(element => (element as HTMLElement).style.transform)).toBe(evidencePosition);
  await page.keyboard.press('Enter');
  await page.getByRole('button', { name: '원문 근거 1', exact: true }).click();
  await expect(page.getByRole('dialog', { name: '가족 관계의 원문 근거' })).toContainText('자녀 도윤');
  expect(new URL(page.url()).searchParams.get('relationshipFactId')).toBe(factId);
  await page.reload();
  await expect(page.getByRole('dialog', { name: '가족 관계의 원문 근거' })).toContainText('자녀 도윤');
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  expect(new URL(page.url()).searchParams.get('relationshipId')).toBe(selected.id);
  await page.goBack();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(graph(page)).toBeVisible();
  expect(new URL(page.url()).searchParams.get('relationshipId')).toBe(selected.id);
  expect(fixture.calls.quotes).toBeGreaterThan(0);
});

test('빈 가계도와 조회 실패를 구분하고 재시도 성공 뒤 원래 관계를 표시한다', async ({ page, context }) => {
  const fixture = await setup(context); fixture.fail();
  await page.goto(workspace);
  await expect(page.getByRole('alert')).toContainText('가계도');
  await expect(graph(page).locator('[data-character-id]')).toHaveCount(0);
  fixture.fail(false);
  await page.getByRole('button', { name: '다시 불러오기', exact: true }).click();
  await expect(graph(page).locator('[data-character-id]')).toHaveCount(fixture.nodes.length);
  await expectWholeTreeInView(page);
  await graph(page).getByRole('button', { name: '확대', exact: true }).click();
  const position = await viewport(page).evaluate(element => (element as HTMLElement).style.transform);
  fixture.fail();
  await page.evaluate(() => {
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' });
    window.dispatchEvent(new Event('visibilitychange'));
  });
  await page.evaluate(() => {
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'visible' });
    window.dispatchEvent(new Event('visibilitychange'));
  });
  await expect(page.getByRole('alert')).toContainText('가계도');
  await expect(graph(page)).toHaveCount(0);
  await expect(page.getByRole('button', { name: `${fixture.nodes[0].name} 프로필 열기`, exact: true })).toHaveCount(0);
  fixture.fail(false);
  await page.getByRole('button', { name: '다시 불러오기', exact: true }).click();
  await expect(graph(page).locator('[data-character-id]')).toHaveCount(fixture.nodes.length);
  expect(await viewport(page).evaluate(element => (element as HTMLElement).style.transform)).toBe(position);
  fixture.change({ nodes: [], edges: [] });
  await page.reload();
  await expect(graph(page).locator('[data-character-id]')).toHaveCount(0);
  await expect(page.getByRole('alert')).toHaveCount(0);
  await expect(page.getByRole('button', { name: '확인·연결 2', exact: true })).toBeVisible();
  expect(fixture.calls.mutations).toEqual([]);
});

test('과거 포함과 인물 중심 보기를 URL에 보존하고 다시 열어도 연결 가족 전체를 조회한다', async ({ page, context }) => {
  const fixture = await setup(context, apiFixture(familyTreeFixtures.find(item => item.id === 'remarried')!));
  await page.goto(workspace);
  await expectRepresentedRelations(page, fixture.edges.filter(edge => edge.temporalScope === 'CURRENT'));
  const historyToggle = page.getByRole('button', { name: '과거 관계 포함', exact: true });
  await expect(historyToggle).toHaveAttribute('aria-pressed', 'false');
  await historyToggle.click();
  await expect(historyToggle).toHaveAttribute('aria-pressed', 'true');
  await expectRepresentedRelations(page, fixture.edges);
  expect(new URL(page.url()).searchParams.get('familyHistory')).toBe('true');
  const person = fixture.nodes[3];
  const position = await viewport(page).getAttribute('style');
  await page.getByLabel('가계도 인물 검색', { exact: true }).fill(person.name);
  await expect(node(page, person.id)).toHaveAttribute('data-highlight', 'search');
  await expect(node(page, person.id).getByRole('button')).toContainText('검색 결과');
  await expect(node(page, person.id).getByRole('button')).toHaveCSS('background-color', 'rgb(0, 90, 175)');
  await expect(node(page, person.id).getByRole('button')).toHaveCSS('color', 'rgb(255, 255, 255)');
  expect(await viewport(page).getAttribute('style')).toBe(position);
  await page.getByLabel('가계도 인물 검색', { exact: true }).fill(' ');
  await expect(graph(page).locator('[data-highlight]')).toHaveCount(0);
  await page.getByLabel('가계도 인물 검색', { exact: true }).fill(person.name);
  await page.getByRole('button', { name: new RegExp(`${person.name}.*중심`) }).click();
  await expect.poll(() => new URL(page.url()).searchParams.get('familyFocus')).toBe(person.id);
  await expect.poll(() => fixture.calls.graphs.at(-1)).toMatchObject({ focusCharacterId: person.id, includeHistorical: 'true' });
  await expect(graph(page).locator('[data-character-id]')).toHaveCount(fixture.nodes.length);
  await expect(node(page, person.id)).toHaveAttribute('data-highlight', 'focus');
  await expect(node(page, person.id).getByRole('button')).toContainText('중심 인물');
  await page.reload();
  await expect(historyToggle).toHaveAttribute('aria-pressed', 'true');
  await expectRepresentedRelations(page, fixture.edges);
  expect(new URL(page.url()).searchParams.get('familyFocus')).toBe(person.id);
  await expect(node(page, person.id)).toHaveAttribute('data-highlight', 'focus');
  await historyToggle.focus();
  await page.keyboard.press('Space');
  await expect(historyToggle).toHaveAttribute('aria-pressed', 'false');
  await expectRepresentedRelations(page, fixture.edges.filter(edge => edge.temporalScope === 'CURRENT'));
  await page.getByRole('button', { name: '작품 전체 보기', exact: true }).click();
  await expect(graph(page).locator('[data-highlight]')).toHaveCount(0);
});

test('서버가 일부 관계만 반환하면 제한을 알리고 응답 밖 인물도 디렉터리에서 찾아 볼 수 있다', async ({ page, context }) => {
  const fixture = await setup(context); fixture.truncate(); fixture.paginatedDirectory();
  await page.goto(workspace);
  await expect(page.getByRole('status').filter({ hasText: '전체 관계 250개' })).toContainText('일부 가족 연결이 생략될 수 있어요.');
  await expectRepresentedRelations(page, fixture.edges);
  await page.getByRole('button', { name: '특정 인물 중심으로 보기', exact: true }).click();
  await page.getByRole('button', { name: '다음 페이지', exact: true }).click();
  await page.getByRole('button', { name: new RegExp(fixture.outsidePerson.name) }).click();
  await expect.poll(() => new URL(page.url()).searchParams.get('familyFocus')).toBe(fixture.outsidePerson.id);
  await expect(graph(page).locator('[data-character-id]')).toHaveCount(1);
  await expect(page.getByRole('button', { name: `${fixture.outsidePerson.name} 프로필 열기`, exact: true })).toBeVisible();
  await expect(node(page, fixture.outsidePerson.id)).toHaveAttribute('data-highlight', 'focus');
  expect(fixture.calls.directories).toBeGreaterThan(0);
  expect(fixture.calls.graphs.at(-1)).toMatchObject({ focusCharacterId: fixture.outsidePerson.id });
  await page.getByRole('button', { name: '특정 인물 중심으로 보기', exact: true }).click();
  await expect(page.getByRole('button', { name: `${fixture.outsidePerson.name} 중심으로 보기`, exact: true })).toBeVisible();
  await page.getByRole('button', { name: '인물 목록 닫기', exact: true }).click();
  fixture.shrinkDirectory();
  await page.getByRole('button', { name: '특정 인물 중심으로 보기', exact: true }).click();
  await expect(page.getByRole('button', { name: `${fixture.nodes[0].name} 중심으로 보기`, exact: true })).toBeVisible();
  await expect(page.getByText('등록된 인물이 없어요.', { exact: true })).toHaveCount(0);
  expect(fixture.calls.mutations).toEqual([]);
});

test('다른 창의 관계 철회를 반영하면서 확대·이동한 화면 위치를 보존하고 숨겨진 창은 조회를 쉰다', async ({ page, context }) => {
  const fixture = await setup(context);
  await page.clock.install();
  await page.goto(workspace);
  const selected = fixture.edges[0];
  await expect(graph(page).locator('[data-character-id]')).toHaveCount(fixture.nodes.length);
  await page.clock.runFor(100);
  await expectWholeTreeInView(page);
  const stablePerson = (await node(page, fixture.nodes[0].id).elementHandle())!;
  const stableEdge = (await connection(page, selected.id).elementHandle())!;
  await edge(page, selected.id).click();
  await expect(page.getByText('가족 관계가 원문에 명시되어 있다.', { exact: true })).toBeVisible();
  fixture.setPending(3);
  await page.clock.runFor(6000);
  await expect(page.getByRole('button', { name: '확인·연결 3', exact: true })).toBeVisible();
  expect(await node(page, fixture.nodes[0].id).evaluate((current, previous) => current === previous, stablePerson)).toBeTruthy();
  expect(await connection(page, selected.id).evaluate((current, previous) => current === previous, stableEdge)).toBeTruthy();
  await graph(page).getByRole('button', { name: '확대', exact: true }).click();
  await page.clock.runFor(400);
  const pane = await graph(page).locator('.react-flow__pane').boundingBox();
  await page.mouse.move(pane!.x + 15, pane!.y + pane!.height - 15);
  await page.mouse.down(); await page.mouse.move(pane!.x + 75, pane!.y + pane!.height - 45, { steps: 5 }); await page.mouse.up();
  const position = await viewport(page).evaluate(element => (element as HTMLElement).style.transform);
  const other = await context.newPage();
  await other.goto(`${workspace}&relationView=list&relationshipId=${selected.id}`);
  await other.getByRole('button', { name: '이 연결 삭제', exact: true }).click();
  await other.getByRole('button', { name: '삭제하기', exact: true }).click();
  await expect(other.getByText('삭제된 연결', { exact: true })).toBeVisible();
  await page.bringToFront(); await page.clock.runFor(6000);
  await expect(connection(page, selected.id)).toHaveCount(0);
  await expect(page.getByText('삭제된 연결이에요.', { exact: false })).toBeVisible();
  await expect(page.getByRole('button', { name: '이 연결 삭제', exact: true })).toHaveCount(0);
  expect(await viewport(page).evaluate(element => (element as HTMLElement).style.transform)).toBe(position);
  await page.evaluate(() => {
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' });
    window.dispatchEvent(new Event('visibilitychange'));
  });
  const reads = fixture.calls.graphs.length;
  fixture.remove(fixture.edges[1].id);
  await page.clock.runFor(6000);
  expect(fixture.calls.graphs).toHaveLength(reads);
  await page.evaluate(() => {
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'visible' });
    window.dispatchEvent(new Event('visibilitychange'));
  });
  await expect(connection(page, fixture.edges[1].id)).toHaveCount(0);
  expect(await viewport(page).evaluate(element => (element as HTMLElement).style.transform)).toBe(position);
  await other.close();
});

test('320px 가계도의 주요 조작과 인물 프로필·근거에 접근하고 페이지가 가로로 넘치지 않는다', async ({ page, context }, testInfo) => {
  const fixture = await setup(context);
  const photos = await mockTreeImages(context);
  fixture.setImage(fixture.nodes[0].id, photos.publicImage);
  await page.setViewportSize({ width: 320, height: 740 });
  await page.goto(workspace);
  await expect(graph(page)).toBeVisible();
  await expect(page.getByLabel('가족 관계 보기', { exact: true })).toHaveValue('tree');
  await expectWholeTreeInView(page);
  const readability = await ordinaryReadability(page);
  expect(readability.namePixels).toBeGreaterThanOrEqual(12);
  expect(readability.relationPixels).toBeGreaterThanOrEqual(10);
  expect(readability.relationContrast).toBeGreaterThanOrEqual(4.5);
  const portrait = node(page, fixture.nodes[0].id).locator('.family-tree-avatar img');
  await expect(portrait).toBeVisible();
  await expect.poll(() => portrait.evaluate(image => (image as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
  const portraitBox = await portrait.boundingBox();
  expect(portraitBox!.width).toBeGreaterThanOrEqual(18);
  expect(portraitBox!.width).toBeLessThanOrEqual(36);
  expect(portraitBox!.height).toBeCloseTo(portraitBox!.width, 1);
  expect(fixture.calls.profiles).toEqual([]);
  for (const person of fixture.nodes) {
    expect((await page.getByRole('button', { name: `${person.name} 프로필 열기`, exact: true }).boundingBox())!.height).toBeGreaterThanOrEqual(44);
  }
  await testInfo.attach('mobile-readability.json', { body: JSON.stringify(readability), contentType: 'application/json' });
  for (const name of ['확대', '축소', '전체 보기']) {
    const control = graph(page).getByRole('button', { name, exact: true });
    await control.scrollIntoViewIfNeeded();
    expect((await control.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    await control.click();
  }
  await expectWholeTreeInView(page);
  await page.getByLabel('가계도 인물 검색', { exact: true }).fill(fixture.nodes[0].name);
  await expect(node(page, fixture.nodes[0].id).getByText('검색 결과', { exact: true })).toBeVisible();
  await expect(node(page, fixture.nodes[0].id).getByRole('button')).toHaveCSS('color', 'rgb(255, 255, 255)');
  await page.getByLabel('가계도 인물 검색', { exact: true }).fill('');
  await graph(page).scrollIntoViewIfNeeded();
  await page.screenshot({ path: testInfo.outputPath('revised-family-tree-mobile-320.png'), fullPage: true });
  await graph(page).screenshot({ path: testInfo.outputPath('revised-family-tree-mobile-canvas-320.png') });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBeTruthy();
  await page.getByRole('button', { name: `${fixture.nodes[0].name} 프로필 열기`, exact: true }).click();
  await expect(page.getByRole('dialog')).toContainText('확정된 가족 설정');
  await page.keyboard.press('Escape');
  await edge(page, fixture.edges[0].id).click();
  await page.getByRole('button', { name: '원문 근거 1', exact: true }).scrollIntoViewIfNeeded();
  await page.getByRole('button', { name: '원문 근거 1', exact: true }).click();
  await expect(page.getByRole('dialog')).toContainText('자녀 도윤');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBeTruthy();
  await page.keyboard.press('Escape');
  await page.setViewportSize({ width: 1280, height: 800 });
  await expectWholeTreeInView(page);
  await expect.poll(async () => (await node(page, fixture.nodes[0].id).boundingBox())!.width).toBeGreaterThanOrEqual(190);
  const desktopReadability = await ordinaryReadability(page);
  expect(desktopReadability.namePixels).toBeGreaterThanOrEqual(16);
  expect(desktopReadability.relationPixels).toBeGreaterThanOrEqual(12);
  await expectRepresentedRelations(page, fixture.edges);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBeTruthy();
});

test('정상 인증 갱신 뒤 가계도를 표시하고 이탈 뒤 늦은 조회로 이전 작품을 복원하지 않는다', async ({ page, context }) => {
  const fixture = await setup(context); fixture.expire();
  await page.clock.install();
  await page.goto(workspace);
  await expect(graph(page).locator('[data-character-id]')).toHaveCount(fixture.nodes.length);
  expect(fixture.calls.refreshes).toBe(1);
  const waiting = fixture.holdNext();
  await page.clock.runFor(6000); await waiting.received;
  await page.getByRole('button', { name: '작품 설정', exact: true }).click();
  await expect(page.getByRole('heading', { name: '캐릭터 설정', exact: true })).toBeVisible();
  waiting.release();
  await page.clock.runFor(100);
  await expect(graph(page)).toHaveCount(0);
  expect(new URL(page.url()).searchParams.get('nav')).toBe('settingDB');
  expect(fixture.calls.mutations).toEqual([]);
});


test('양끝의 명시 호칭은 각 인물의 관계 근거만 열고 닫으면 그 호칭으로 초점이 돌아온다', async ({ page, context }) => {
  const fixture = await setup(context);
  await page.goto(workspace);
  const father = page.getByRole('button', { name: '지훈 · 아버지 관계 2개 근거 보기', exact: true });
  const mother = page.getByRole('button', { name: '수연 · 어머니 관계 2개 근거 보기', exact: true });
  const son = page.getByRole('button', { name: '도윤 · 아들 관계 2개 근거 보기', exact: true });
  const daughter = page.getByRole('button', { name: '서윤 · 딸 관계 2개 근거 보기', exact: true });
  for (const control of [father, mother, son, daughter]) await expect(control).toBeVisible();
  await father.focus(); await page.keyboard.press('Enter');
  await expect(connectionPanel(page).locator('[data-relationship-id]')).toHaveCount(2);
  await expect(connectionPanel(page)).toContainText('지훈 → 도윤'); await expect(connectionPanel(page)).toContainText('지훈 → 서윤');
  await expect(connectionPanel(page)).not.toContainText('수연 →');
  await page.getByRole('button', { name: '가족 연결 닫기' }).click(); await expect(father).toBeFocused();
  await son.click(); await expect(connectionPanel(page).locator('[data-relationship-id]')).toHaveCount(2);
  await expect(connectionPanel(page)).toContainText('지훈 → 도윤'); await expect(connectionPanel(page)).toContainText('수연 → 도윤');
  await expect(connectionPanel(page)).not.toContainText('→ 서윤');
  await page.getByRole('button', { name: '가족 연결 닫기' }).click(); await expect(son).toBeFocused();
  const one = apiFixture({ id: 'roles', label: '부모와 자녀', nodes: [{ id: 'p', name: '아버지인물' }, { id: 'c', name: '자녀인물' }],
    edges: [{ id: 'r', subjectCharacterId: 'p', objectCharacterId: 'c', kind: 'PARENT_OF', subjectRole: 'FATHER', objectRole: 'CHILD', temporalScope: 'CURRENT' }] });
  fixture.change(one); await page.goto(workspace);
  await expect(graph(page).getByText('자녀 1명', { exact: true })).toHaveCount(0);
  for (const name of ['아버지인물 · 아버지 관계 근거 보기', '자녀인물 · 자녀 관계 근거 보기']) {
    const control = page.getByRole('button', { name, exact: true });
    await control.focus(); await page.keyboard.press('Enter');
    await expect(page.getByRole('article', { name: '선택한 관계 근거' })).toBeVisible();
    await page.getByRole('button', { name: '관계 근거 닫기', exact: true }).click(); await expect(control).toBeFocused();
  }
  expect(fixture.calls.mutations).toEqual([]);
});

test('친생과 입양 자녀를 함께 둔 부모의 호칭은 한 번만 보이고 자기 관계 근거를 모두 연다', async ({ page, context }) => {
  const family: FamilyTreeFixture = {
    id: 'shared-parent-roles', label: '친생 자녀와 입양 자녀',
    nodes: [{ id: 'mother', name: '루미' }, { id: 'father', name: '카일' },
      { id: 'son', name: '비칼' }, { id: 'daughter', name: '에린' }, { id: 'adopted', name: '루카' }],
    edges: [
      { id: 'spouse', subjectCharacterId: 'mother', objectCharacterId: 'father', kind: 'SPOUSE', temporalScope: 'CURRENT' },
      ...(['mother', 'father'] as const).flatMap(parent => (['son', 'daughter', 'adopted'] as const).map(child => ({
        id: `${parent}-${child}`, subjectCharacterId: parent, objectCharacterId: child,
        kind: 'PARENT_OF' as const, temporalScope: 'CURRENT',
        subtype: child === 'adopted' ? 'ADOPTIVE' : 'BIOLOGICAL',
        subjectRole: parent === 'mother' ? 'MOTHER' as const : 'FATHER' as const,
        objectRole: child === 'daughter' ? 'DAUGHTER' as const : 'SON' as const,
      }))),
    ],
  };
  const fixture = await setup(context, apiFixture(family));
  await page.goto(workspace);
  await expectWholeTreeInView(page);
  await expectRepresentedRelations(page, fixture.edges);

  for (const [index, role, name, title] of [
    [0, 'MOTHER', '루미', '어머니'], [1, 'FATHER', '카일', '아버지'],
  ] as const) {
    const parentId = fixture.nodes[index].id;
    const control = graph(page).locator(`[data-endpoint-person-id="${parentId}"][data-endpoint-role="${role}"]`);
    const ownIds = fixture.edges.filter(relation => relation.kind === 'PARENT_OF' && relation.subjectCharacterId === parentId)
      .map(relation => relation.id).sort();
    await expect(control).toHaveCount(1);
    await expect(control).toHaveText(title);
    await expect(control).toHaveAccessibleName(`${name} · ${title} 관계 3개 근거 보기`);
    expect(JSON.parse((await control.getAttribute('data-endpoint-relationship-ids'))!)).toEqual(ownIds);
    await control.click();
    await expect(connectionPanel(page)).toBeFocused();
    expect((await connectionPanel(page).locator('[data-relationship-id]').evaluateAll(controls =>
      controls.map(button => button.getAttribute('data-relationship-id')))).sort()).toEqual(ownIds);
    await expect(connectionPanel(page)).toContainText(`${name} → 비칼`);
    await expect(connectionPanel(page)).toContainText(`${name} → 에린`);
    await expect(connectionPanel(page)).toContainText(`${name} → 루카`);
    await page.getByRole('button', { name: '가족 연결 닫기', exact: true }).click();
    await expect(control).toBeFocused();
  }

  const adopted = fixture.edges.filter(relation => relation.subtype === 'ADOPTIVE');
  const adoptionControl = connection(page, adopted[0].id);
  await expect(adoptionControl).toHaveCount(1);
  await expect(adoptionControl).toHaveText('입양');
  await expect(graph(page).locator('.family-tree-line--adoptive')).not.toHaveCount(0);
  await adoptionControl.click();
  expect((await connectionPanel(page).locator('[data-relationship-id]').evaluateAll(controls =>
    controls.map(button => button.getAttribute('data-relationship-id')))).sort()).toEqual(adopted.map(relation => relation.id).sort());
  await expect(connectionPanel(page)).toContainText('루미 → 루카');
  await expect(connectionPanel(page)).toContainText('카일 → 루카');
  expect(fixture.calls.mutations).toEqual([]);
});
