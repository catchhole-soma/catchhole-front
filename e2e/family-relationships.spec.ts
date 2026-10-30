import { expect, test, type BrowserContext, type Page, type Route } from '@playwright/test';
import type { RelationshipCandidateResponse, RelationshipResponse } from '../src/app/api/generated/types.gen';

test.skip(process.env.VITE_RELATIONSHIP_WORKSPACE_ENABLED === 'false', '관계 화면을 명시적으로 비활성화한 실행에서는 건너뜁니다.');

const workId = '11111111-1111-4111-8111-111111111111';
const subjectId = '22222222-2222-4222-8222-222222222222';
const targetId = '33333333-3333-4333-8333-333333333333';
const candidateId = '44444444-4444-4444-8444-444444444444';
const relationId = '55555555-5555-4555-8555-555555555555';
const factId = '66666666-6666-4666-8666-666666666666';
const prefix = `/api/v1/works/${workId}`;
const settings = `/dashboard?workId=${workId}&nav=settingDB&tab=characters`;
const legacyWorkspace = `/dashboard?workId=${workId}&nav=settingDB&tab=relations`;
const treeWorkspace = `/dashboard?workId=${workId}&nav=graph`;
const workspace = `${treeWorkspace}&relationView=list`;
const editor = `${treeWorkspace}&relationView=review&relationshipCandidate=${candidateId}`;
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
  let originalContent = '도윤은 아버지 현우의 손을 잡았다.';
  let originalQuote = '아버지 현우';
  let sourceAvailable = true;
  let extraSource: { characterId: string; factId: string; contextToken: string; currentValue: { factValue: string } } | null = null;
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
  let precedingRelations: RelationshipResponse[] = [];
  let precedingCandidates: RelationshipCandidateResponse[] = [];
  let relationAvailable = true;
  let state = 'SUCCEEDED';
  let inputVersion = 1;
  let failSave = 0;
  let failDismiss = 0;
  let failConfirm = 0;
  let allowMentionAfterSave = false;
  let savedReviewReasons: RelationshipCandidateResponse['reviewReasons'] | undefined;
  let failSources = 0;
  const unavailableSourceCharacters = new Set<string>();
  let failProcessing = 0;
  let failCandidateReads = false;
  let failRelationshipReads = false;
  let originalReads = 0;
  let failOriginalReads = false;
  let charactersPage = 0;
  let chosenProfileName = '현우';
  const calls = { saves: [] as Array<Record<string, unknown>>, confirmVersions: [] as number[], confirms: 0, dismisses: 0, processing: 0, analyses: 0, withdraws: 0, refreshes: 0, processingReads: 0, candidateReads: 0, sourceReads: [] as string[], mutations: [] as string[] };
  const expired = new Set<string>();
  const held = new Map<string, { started: () => void; gate: Promise<void>; skip: number }>();
  const requestKey = (method: string, suffix: string) => `${method} ${suffix.startsWith('/api/v1/') ? suffix : `${prefix}/${suffix}`}`;
  await context.addInitScript(() => { localStorage.setItem('accessToken', 'synthetic-family-token'); localStorage.removeItem('catchhole_demo_mode'); });
  await context.route('**/api/v1/**', async route => {
    const req = route.request(); const url = new URL(req.url()); const path = url.pathname;
    if (req.method() !== 'GET') calls.mutations.push(`${req.method()} ${path}`);
    const candidateAtRequest = candidate;
    const candidateReadFailed = failCandidateReads;
    const sourceAvailableAtRequest = sourceAvailable;
    const sourceAtRequest = { factId, characterId: subjectId, factKey: 'profile.family', contextToken: sourceToken,
      currentValue: { factValue: sourceText }, hasEvidence: true };
    if (req.method() === 'GET' && path === `${prefix}/relationship-candidates/${candidateId}`) calls.candidateReads++;
    if (req.method() === 'GET' && path === `${prefix}/relationship-sources`) calls.sourceReads.push(url.searchParams.get('characterId') ?? '');
    const key = `${req.method()} ${path}`;
    if (expired.delete(key)) return failure(route, 401, '토큰을 갱신해 주세요.', 'AUTH_UNAUTHORIZED');
    const waiting = held.get(key);
    if (waiting && waiting.skip-- <= 0) { held.delete(key); waiting.started(); await waiting.gate; }
    if (path.endsWith('/auth/refresh')) { calls.refreshes++; return success(route, { accessToken: `rotated-family-token-${calls.refreshes}` }); }
    if (path.endsWith('/auth/me')) return success(route, { id: 1, email: 'family@example.test', role: 'AUTHOR', status: 'ACTIVE', displayName: '관계 검토' });
    if (path === '/api/v1/works') return success(route, [{ id: workId, title: '가족 관계 검증', genre: '판타지', episodeCount: 0 }]);
    if (path === prefix) return success(route, { id: workId, title: '가족 관계 검증', lifecycleStatus: 'ACTIVE' });
    if (path.endsWith('/analysis-jobs') && req.method() !== 'GET') { calls.analyses++; return failure(route, 500, '분석 요청은 허용하지 않음'); }
    if (path === `${prefix}/relationship-processing`) {
      if (req.method() === 'GET') calls.processingReads++;
      if (req.method() === 'POST') {
        calls.processing++;
        if (failProcessing-- > 0) return failure(route, 503, '관계 정리 요청 결과를 확인하지 못했어요.', 'COMMON_ERROR');
        state = 'PENDING';
      }
      return success(route, { state, inputVersion, processedVersion: state === 'PENDING' ? 0 : inputVersion,
        autoConfirmedCount: 1, reviewRequiredCount: 9, unsupportedSourceCount: 0, lastProcessedAt: '2026-10-17T12:00:00',
        retryAt: state === 'FAILED' ? '2026-10-17T13:00:00' : null });
    }
    if (path === `${prefix}/family-tree`) return success(route, {
      nodes: [{ id: targetId, name: '현우' }, { id: subjectId, name: '도윤' }],
      edges: relationAvailable && relation.validity === 'VALID' ? [relation] : [],
      totalNodeCount: 2, totalEdgeCount: relationAvailable && relation.validity === 'VALID' ? 1 : 0,
      pendingCandidateCount: candidate.status === 'PENDING' ? 1 : 0, truncated: false, limit: 100,
      includeHistorical: false, focusCharacterId: null, revision: String(inputVersion),
    });
    if (path === `${prefix}/relationships`) {
      const page = Number(url.searchParams.get('page') ?? 0);
      const size = Number(url.searchParams.get('size') ?? 20);
      const rows = [...precedingRelations, ...(relationAvailable ? [relation] : [])];
      return success(route, paginated(rows.slice(page * size, (page + 1) * size), rows.length, page, size));
    }
    if (path === `${prefix}/relationships/${relationId}`) {
      if (failRelationshipReads) return failure(route, 503, '관계 근거 조회가 지연되고 있어요.', 'COMMON_ERROR');
      return success(route, relation);
    }
    if (path === `${prefix}/relationships/${relationId}/withdraw`) {
      expect(req.postDataJSON().expectedVersion).toBe(relation.version);
      calls.withdraws++; relation = { ...relation, version: relation.version! + 1, validity: 'WITHDRAWN', visibleInFamilyTree: false };
      return success(route, relation);
    }
    if (path === `${prefix}/relationship-candidates`) {
      expect(url.searchParams.get('status')).toBe('PENDING');
      const page = Number(url.searchParams.get('page') ?? 0);
      const size = Number(url.searchParams.get('size') ?? 20);
      const rows = [...precedingCandidates, ...(candidate.status === 'PENDING' ? [candidate] : [])];
      return success(route, paginated(rows.slice(page * size, (page + 1) * size), rows.length, page, size));
    }
    if (path === `${prefix}/relationship-candidates/${candidateId}`) {
      if (req.method() === 'GET') {
        if (candidateReadFailed) return failure(route, 503, '후속 후보 조회가 지연되고 있어요.', 'COMMON_ERROR');
        return success(route, candidateAtRequest);
      }
      if (req.method() === 'PUT') {
        const body = req.postDataJSON() as Record<string, unknown>; calls.saves.push(body);
        if (failSave-- > 0) return failure(route, 503, '일시적으로 저장하지 못했어요.', 'COMMON_ERROR');
        if (body.expectedVersion !== candidate.version) return failure(route, 409, '다른 창에서 후보를 수정했어요.', 'RELATIONSHIP_STALE_VERSION');
        if ((body.evidence as Array<{ sourceFactId: string; sourceToken: string }>).some(source => source.sourceToken !== (source.sourceFactId === extraSource?.factId ? extraSource.contextToken : sourceToken))) return failure(route, 409, '현재 설정이 바뀌었어요. 근거를 다시 확인해 주세요.');
        candidate = { ...candidate, ...body, generationGap: body.generationGap as number | undefined,
          version: candidate.version! + 1, objectCharacterName: body.objectCharacterId === targetId ? chosenProfileName : undefined,
          evidence: (body.evidence as Array<{ sourceFactId: string; sourceToken: string }>).map(item => item.sourceFactId === extraSource?.factId
            ? { ...item, characterId: extraSource.characterId, current: true, hasEvidence: true, factKey: 'profile.family', currentValue: extraSource.currentValue }
            : { ...candidate.evidence![0], ...item, sourceToken, current: true, currentValue: { factValue: sourceText } }),
          reviewReasons: savedReviewReasons ?? (body.objectCharacterId && body.assertion === 'ASSERTED' ? []
            : body.assertion === 'ASSERTED' ? [allowMentionAfterSave ? 'UNRESOLVED_TARGET' : 'AMBIGUOUS_TARGET'] : ['UNCERTAIN']),
          displayableAsMention: allowMentionAfterSave && !body.objectCharacterId && body.assertion === 'ASSERTED' };
      }
      return success(route, candidate);
    }
    if (path === `${prefix}/relationship-candidates/${candidateId}/confirm`) {
      calls.confirms++; expect(req.postDataJSON().expectedVersion).toBe(candidate.version);
      calls.confirmVersions.push(req.postDataJSON().expectedVersion);
      if (failConfirm-- > 0) return failure(route, 503, '가계도 반영을 완료하지 못했어요.', 'COMMON_ERROR');
      relationAvailable = true;
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
      if (unavailableSourceCharacters.has(url.searchParams.get('characterId') ?? '')) return failure(route, 404, '인물의 현재 설정을 찾을 수 없어요.', 'CHARACTER_NOT_FOUND');
      if (failSources-- > 0) return failure(route, 503, '현재 프로필을 불러오지 못했어요.', 'COMMON_ERROR');
      return success(route, url.searchParams.get('characterId') === extraSource?.characterId ? [{ ...extraSource, factKey: 'profile.family', hasEvidence: true }]
        : sourceAvailableAtRequest && url.searchParams.get('characterId') === subjectId ? [sourceAtRequest] : []);
    }
    if (path === `${prefix}/characters`) {
      charactersPage = Number(url.searchParams.get('page'));
      return success(route, paginated(charactersPage === 0 ? [{ id: '77777777-7777-4777-8777-777777777777', name: '현우', firstAppearanceEpisodeNo: 6, representativeAttributeLabel: '레벨', representativeAttributeValue: '6' }]
        : [{ id: targetId, name: chosenProfileName, firstAppearanceEpisodeNo: null, representativeAttributeLabel: '가족 관계', representativeAttributeValue: '도윤의 아버지' }], 13, charactersPage, 12));
    }
    if (path.includes(`/character-facts/${factId}/evidence`)) {
      originalReads++;
      if (failOriginalReads) return failure(route, 503, '원문을 불러오지 못했어요.', 'COMMON_ERROR');
      const startOffset = originalContent == null ? -1 : Array.from(originalContent.slice(0, originalContent.indexOf(originalQuote))).length;
      return success(route, { content: originalContent, evidenceSpans: [{ quote: originalQuote, startOffset, endOffset: startOffset + Array.from(originalQuote).length }],
        episode: { episodeNo: 1, title: '가족' } });
    }
    return success(route, []);
  });
  return { calls,
    pair(overrides: Partial<RelationshipCandidateResponse>) { candidate = { ...candidate, ...overrides }; },
    relation(overrides: Partial<RelationshipResponse>) { relation = { ...relation, ...overrides }; },
    familyText(text: string) {
      sourceText = text; originalContent = text; originalQuote = text;
      candidate = { ...candidate, evidence: candidate.evidence?.map(source => ({ ...source, currentValue: { factValue: text } })) };
      relation = { ...relation, evidence: relation.evidence?.map(source => ({ ...source, currentValue: { factValue: text } })) };
    },
    candidateRows(rows: RelationshipCandidateResponse[]) { precedingCandidates = rows; },
    namedProfile(name: string) { chosenProfileName = name; },
    expireNext(method: string, suffix: string) { expired.add(requestKey(method, suffix)); },
    holdNext(method: string, suffix: string, skip = 0) {
      let release!: () => void;
      let started!: () => void;
      const gate = new Promise<void>(resolve => { release = resolve; });
      const received = new Promise<void>(resolve => { started = resolve; });
      held.set(requestKey(method, suffix), { started, gate, skip });
      return { release, received };
    },
    additionalSource(source: NonNullable<typeof extraSource>) { extraSource = source; },
    failSourceReads(characterId: string, unavailable: boolean) { if (unavailable) unavailableSourceCharacters.add(characterId); else unavailableSourceCharacters.delete(characterId); },
    failConfirm() { failConfirm = 1; },
    allowMention() { allowMentionAfterSave = true; },
    holdAfterSave(reasons: NonNullable<RelationshipCandidateResponse['reviewReasons']>) { savedReviewReasons = reasons; },
    sourceChanged() { sourceAvailable = true; sourceToken = newToken; sourceText = '도윤의 친아버지는 현우이다.'; },
    conflictingValues() { candidate = { ...candidate, reviewReasons: ['CURRENT_VALUE_CONFLICT', 'UNSUPPORTED_STRUCTURED_CONTEXT'], evidence: [{ ...candidate.evidence![0], currentValue: { factValue: '아버지: 현우', valueJson: { value: '아버지: 준서', name: '추정 가족관계', certainty: '확인되지 않은 소문' } } }] }; },
    sourceInvalidated() { sourceAvailable = false; inputVersion++; candidate = { ...candidate, reviewReasons: ['SOURCE_CHANGED'], evidence: [{ ...candidate.evidence![0], current: false, currentValue: undefined }] }; },
    otherChanged() { candidate = { ...candidate, version: candidate.version! + 1 }; },
    ready() { candidate = { ...candidate, objectCharacterId: targetId, objectCharacterName: '현우', assertion: 'ASSERTED', reviewReasons: [] }; },
    held() { candidate = { ...candidate, objectCharacterId: targetId, objectCharacterName: '현우', assertion: 'ASSERTED', reviewReasons: ['PREVIOUSLY_WITHDRAWN'] }; },
    sourceRemoved() { relation = { ...relation, validity: 'REVIEW_REQUIRED', evidence: [{ ...relation.evidence![0], current: false, currentValue: undefined }] }; },
    waitForRelationshipConfirmation() { relationAvailable = false; },
    failProcessing() { failProcessing = 1; },
    failCandidateReads(value: boolean) { failCandidateReads = value; },
    failRelationshipReads(value: boolean) { failRelationshipReads = value; },
    failOriginalReads(value: boolean) { failOriginalReads = value; },
    offPageRelationship() {
      precedingRelations = Array.from({ length: 20 }, (_, index) => ({ ...relation,
        id: `80000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`,
        subjectCharacterId: `81000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`,
        objectCharacterId: `82000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`,
        subjectCharacterName: `목록 부모 ${index + 1}`, objectCharacterName: `목록 자녀 ${index + 1}`,
      }));
      relation = { ...relation, version: 7, subtype: 'ADOPTIVE', temporalScope: 'HISTORICAL', timeLabel: '10년 전',
        validity: 'ARCHIVED_ENDPOINT', visibleInFamilyTree: false };
    },
    pendingSecondPage() {
      precedingCandidates = Array.from({ length: 20 }, (_, index) => ({ ...candidate,
        id: `90000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`,
        objectMention: `남은 상대 ${index + 1}`,
      }));
    },
    processingState(next: 'NEVER_PROCESSED' | 'PENDING' | 'SUCCEEDED' | 'FAILED') { state = next; },
    failed() { state = 'FAILED'; }, failSave() { failSave = 1; }, failDismiss() { failDismiss = 1; }, failSources() { failSources = 1; },
    originalReads: () => originalReads, charactersPage: () => charactersPage };
}

async function editDetails(page: Page) {
  if (!await page.getByLabel('시점 설명', { exact: true }).isVisible()) {
    await page.getByText('관계 내용 수정', { exact: true }).click();
  }
}
async function chooseJudgment(page: Page, name: '실제 가족이에요' | '가족이 아니에요' | '아직 모르겠어요') {
  const choice = page.getByRole('button').filter({ has: page.getByText(name, { exact: true }) });
  if (!await choice.isVisible()) await page.getByRole('button', { name: '판단 변경', exact: true }).click();
  await choice.click();
}
async function chooseExclusion(page: Page) {
  await expect(page.getByRole('region', { name: '가족 관계 후보 검토' })).toBeVisible();
  await chooseJudgment(page, '가족이 아니에요');
}
async function openEvidence(page: Page) {
  if (!await page.getByRole('button', { name: '원문 근거 1', exact: true }).isVisible()) {
    await page.getByText('원문 근거 1개 보기', { exact: true }).click();
  }
}

test('자동 반영 목록·별도 대기 개수·이전 원문 근거·철회', async ({ page, context }, testInfo) => {
  const fixture = await setup(context); fixture.sourceRemoved();
  await page.goto(workspace);
  await expect(page.getByRole('button', { name: '확인·연결 1', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: '현재 설정에서 관계 찾기', exact: true })).toHaveCount(0);
  await expect(page.getByText('현재 설정 확인 필요', { exact: true })).toBeVisible();
  expect(fixture.originalReads()).toBe(0);
  await page.getByRole('button', { name: '관계 근거 보기' }).click();
  await expect(page.getByText('이전 설정 근거', { exact: true })).toBeVisible();
  await expect(page.getByText('도윤의 가족 설정', { exact: true })).toBeVisible();
  await expect(page.getByRole('blockquote')).toContainText('아버지 현우');
  expect(fixture.originalReads()).toBe(1);
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
  expect(fixture.originalReads()).toBeGreaterThanOrEqual(1);
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: '이 연결 삭제' }).click();
  expect(fixture.calls.withdraws).toBe(0); expect(fixture.calls.mutations).toEqual([]);
  await expect(page.getByText('이 연결을 삭제할까요?', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: '취소', exact: true }).click();
  expect(fixture.calls.withdraws).toBe(0); expect(fixture.calls.mutations).toEqual([]);
  await expect(page.getByRole('button', { name: '삭제하기', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: '이 연결 삭제', exact: true }).click();
  expect(fixture.calls.withdraws).toBe(0);
  await page.getByRole('button', { name: '삭제하기', exact: true }).click();
  await expect(page.getByText('삭제된 연결', { exact: true })).toBeVisible();
  expect(fixture.calls.mutations).toEqual([`POST ${prefix}/relationships/${relationId}/withdraw`]);
  expect(fixture.calls.analyses).toBe(0);
});

test('가족 관계 근거도 위치가 없는 인용은 숨기고 정상 인용과 설정을 유지한다', async ({ page, context }) => {
  await setup(context);
  let includeValid = true;
  await page.route(`**/api/v1/works/${workId}/character-facts/${factId}/evidence`, route => success(route, {
    content: '도윤의 아버지 현우', episode: { episodeNo: 1, title: '가족' },
    evidenceSpans: [
      ...(includeValid ? [{ quote: '아버지 현우', startOffset: 4, endOffset: 10 }] : []),
      { quote: '원문에 없는 가족 인용' },
      { quote: '길이가 같은 오류 인용', startOffset: 0, endOffset: 12 },
    ],
  }));
  await page.goto(workspace);
  await page.getByRole('button', { name: '관계 근거 보기', exact: true }).click();
  await expect(page.getByText('도윤의 가족 설정', { exact: true })).toBeVisible();
  await expect(page.getByRole('blockquote')).toHaveText('아버지 현우');
  await expect(page.locator('.family-evidence-original')).not.toContainText('원문에 없는 가족 인용');
  await expect(page.locator('.family-evidence-original')).not.toContainText('길이가 같은 오류 인용');
  includeValid = false;
  await page.reload();
  await expect(page.getByText('도윤의 가족 설정', { exact: true })).toBeVisible();
  await expect(page.locator('.family-evidence-original')).toContainText('표시할 원문 근거가 없습니다.');
  await expect(page.getByRole('blockquote')).toHaveCount(0);
  await expect(page.getByRole('button', { name: '원문 근거 1', exact: true })).toHaveCount(0);
});

test('열린 확정 관계의 근거 재조회가 실패해도 행을 유지하고 다시 불러온 뒤 근거를 확인한다', async ({ page, context }) => {
  const fixture = await setup(context);
  fixture.relation({ temporalScope: 'UNKNOWN', timeLabel: '회상에서 언급된 시점' });
  await page.clock.install();
  await page.goto(workspace);
  const row = page.locator(`.family-relation-row[data-relationship-id="${relationId}"]`);
  await expect(row).toContainText('시점 확인 필요');
  await expect(row).toContainText('회상에서 언급된 시점');
  await row.click();
  await expect(page.getByRole('button', { name: '원문 근거 1', exact: true })).toBeVisible();
  fixture.failRelationshipReads(true);
  await page.clock.runFor(6500);
  const failure = page.getByRole('alert').filter({ hasText: '관계 근거를 불러오지 못했어요.' });
  await expect(failure).toBeVisible();
  await expect(row).toHaveAttribute('aria-expanded', 'true');
  await expect(row.getByText('현우', { exact: true })).toBeVisible();
  await expect(row.getByText('도윤', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: '원문 근거 1', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: '이 연결 삭제', exact: true })).toHaveCount(0);
  fixture.failRelationshipReads(false);
  await failure.getByRole('button', { name: '다시 불러오기', exact: true }).click();
  await expect(page.getByRole('button', { name: '원문 근거 1', exact: true })).toBeVisible();
  await expect(failure).toHaveCount(0);
  expect(new URL(page.url()).searchParams.get('relationshipId')).toBe(relationId);
  expect(fixture.calls.withdraws).toBe(0); expect(fixture.calls.analyses).toBe(0);
});

test('펼친 관계의 원문 인용 조회가 실패하면 설정은 유지하고 인용만 다시 불러온다', async ({ page, context }) => {
  const fixture = await setup(context); fixture.failOriginalReads(true);
  await page.goto(workspace);
  expect(fixture.originalReads()).toBe(0);
  await page.getByRole('button', { name: '관계 근거 보기', exact: true }).click();
  const detail = page.locator('.relationship-detail');
  const error = detail.getByRole('alert');
  await expect(error).toContainText('불러오지 못했어요');
  await expect(detail.getByText('도윤의 아버지는 현우이다.', { exact: true })).toBeVisible();
  await expect(detail.getByRole('blockquote')).toHaveCount(0);
  await expect(detail.getByRole('button', { name: '원문 근거 1', exact: true })).toHaveCount(0);
  fixture.failOriginalReads(false);
  await error.getByRole('button', { name: '인용문 다시 불러오기', exact: true }).click();
  await expect(detail.getByRole('blockquote')).toContainText('아버지 현우');
  await expect(error).toHaveCount(0);
  await expect(page.getByRole('button', { name: '관계 근거 접기', exact: true })).toHaveAttribute('aria-expanded', 'true');
  expect(new URL(page.url()).searchParams.get('relationshipId')).toBe(relationId);
  expect(fixture.calls.saves).toHaveLength(0); expect(fixture.calls.confirms).toBe(0); expect(fixture.calls.withdraws).toBe(0);
});

test('가족 판단을 저장한 뒤 상대를 직접 골라 별도로 프로필을 연결한다', async ({ page, context }, testInfo) => {
  const fixture = await setup(context);
  await page.setViewportSize({ width: 1280, height: 1440 });
  await page.goto(editor);
  await expect(page.locator('.family-review-source-caption').getByText('도윤의 아버지는 현우이다.', { exact: true })).toBeVisible();
  await expect(page.getByLabel('시점 설명')).not.toBeVisible();
  expect(fixture.originalReads()).toBe(0);
  await openEvidence(page);
  await expect(page.getByRole('blockquote')).toContainText('아버지 현우');
  await expect(page.getByText('도윤의 아버지는 현우이다.', { exact: true })).toHaveCount(1);
  expect(fixture.originalReads()).toBe(1);
  await page.getByRole('region', { name: '가족 관계 후보 검토' }).screenshot({ path: testInfo.outputPath('family-review-action-first-desktop.png') });
  await page.getByRole('button').filter({ has: page.getByText('실제 가족이에요', { exact: true }) }).click();
  expect(fixture.calls.saves).toHaveLength(0); expect(fixture.calls.confirms).toBe(0);
  await page.getByRole('button', { name: '판단 저장', exact: true }).click();
  await expect.poll(() => fixture.calls.saves.length).toBe(1);
  expect(fixture.calls.saves[0]).toMatchObject({ assertion: 'ASSERTED', expectedVersion: 0 });
  expect(fixture.calls.saves[0].objectCharacterId).toBeUndefined();
  expect(fixture.calls.confirms).toBe(0);
  await page.getByRole('button', { name: '현우 프로필 선택' }).click();
  await page.getByRole('button', { name: '다음 페이지' }).click();
  await page.getByRole('button', { name: '현우 첫 등장 회차 미확인', exact: true }).click();
  expect(fixture.charactersPage()).toBe(1);
  await editDetails(page);
  await expect(page.getByRole('combobox', { name: '서술의 의미', exact: true })).toHaveCount(0);
  await page.getByLabel('관계 시점').selectOption('HISTORICAL');
  await page.getByLabel('시점 설명').fill('10년 전');
  await expect(page.getByRole('button', { name: '가계도에 반영하기' })).toBeEnabled();
  expect(fixture.calls.saves).toHaveLength(1);
  expect(fixture.calls.confirms).toBe(0);
  await page.getByRole('button', { name: '가계도에 반영하기' }).click();
  await expect(page.getByText('확인이 필요한 가족 관계가 없어요.', { exact: true })).toBeVisible();
  expect(fixture.calls.saves).toHaveLength(2);
  expect(fixture.calls.saves[1]).toMatchObject({ objectCharacterId: targetId, assertion: 'ASSERTED', temporalScope: 'HISTORICAL', timeLabel: '10년 전', expectedVersion: 1,
    evidence: [{ sourceFactId: factId, sourceToken: oldToken }] });
  expect(fixture.calls.confirmVersions).toEqual([2]);
  expect(fixture.calls.confirms).toBe(1); expect(fixture.calls.analyses).toBe(0);
});

for (const kind of ['ANCESTOR_OF', 'DESCENDANT_OF'] as const) {
  test(`${kind} 조상과 후손은 두 인물만 표시하고 대손 수와 원문을 보존한다`, async ({ page, context }) => {
    const fixture = await setup(context);
    const ancestor = kind === 'DESCENDANT_OF' ? '현우' : '도윤';
    const descendant = kind === 'DESCENDANT_OF' ? '도윤' : '현우';
    const familyText = `${descendant}은 ${ancestor}의 5대손이다.`;
    fixture.pair({ kind, generationGap: 5, assertion: 'ASSERTED', displayableAsMention: true, reviewReasons: ['UNRESOLVED_TARGET'] });
    fixture.relation({ kind, generationGap: 5, subjectCharacterId: subjectId, subjectCharacterName: '도윤',
      objectCharacterId: targetId, objectCharacterName: '현우' });
    fixture.familyText(familyText);
    await page.setViewportSize({ width: 320, height: 720 });
    await page.goto(workspace);
    const confirmed = page.locator(`.family-relation-row[data-relationship-id="${relationId}"]`);
    await expect(confirmed.locator('[data-role="ancestor"]')).toContainText(ancestor);
    await expect(confirmed.locator('[data-role="descendant"]')).toContainText(descendant);
    await expect(confirmed).toContainText('5대손');
    await expect(confirmed).toContainText('중간 계보 생략');
    await expect(confirmed).not.toContainText('부모');
    await expect(confirmed).not.toContainText('자녀');
    await page.goto(`${treeWorkspace}&relationView=review`);
    const row = page.getByRole('button', { name: '도윤 가족 현우 프로필 연결', exact: true });
    await expect(row).toContainText(`도윤의 ${kind === 'DESCENDANT_OF' ? '조상' : '후손'}`);
    await expect(row).toContainText('5대손');
    await row.click();
    const diagram = page.locator('.relationship-pair-preview');
    await expect(diagram.locator('.relationship-pair-preview__person')).toHaveCount(2);
    const upper = diagram.locator('[data-role="ancestor"]');
    const lower = diagram.locator('[data-role="descendant"]');
    await expect(upper).toContainText(ancestor);
    await expect(lower).toContainText(descendant);
    await expect(diagram).toContainText('5대손');
    await expect(diagram).toContainText('중간 계보 생략');
    await expect(diagram).not.toContainText('부모');
    await expect(diagram).not.toContainText('자녀');
    const upperBox = (await upper.boundingBox())!;
    const lowerBox = (await lower.boundingBox())!;
    expect(upperBox.y + upperBox.height).toBeLessThan(lowerBox.y);
    await expect(page.getByText(familyText, { exact: true })).toBeVisible();
    await page.getByText('원문 근거 1개 보기', { exact: true }).click();
    await expect(page.getByRole('blockquote')).toContainText(familyText);
    await editDetails(page);
    await expect(page.getByRole('combobox', { name: '관계', exact: true }).locator('option:checked'))
      .toHaveText(kind === 'DESCENDANT_OF' ? '조상' : '후손');
    await expect(page.getByRole('spinbutton', { name: '대손 수', exact: true })).toHaveValue('5');
    await expect(page.getByRole('combobox', { name: '세부 관계', exact: true }).locator('option')).toHaveText(['알 수 없음', '혈연']);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
    await diagram.screenshot({ path: `/tmp/catchhole-${kind.toLowerCase()}-preview.png` });
    expect(fixture.calls.mutations).toEqual([]);
  });
}

test('조상·후손 세대 차이의 외부 변경은 읽기만으로 덮어쓰지 않고 관계 종류와 함께 확인한다', async ({ page, context }) => {
  const fixture = await setup(context); fixture.ready();
  fixture.pair({ kind: 'DESCENDANT_OF', generationGap: 5 });
  await page.goto(editor);
  await editDetails(page);
  const kind = page.getByRole('combobox', { name: '관계', exact: true });
  const subtype = page.getByRole('combobox', { name: '세부 관계', exact: true });
  const gap = page.getByRole('spinbutton', { name: '대손 수', exact: true });
  const save = page.getByRole('button', { name: '변경사항 저장', exact: true });
  await subtype.selectOption('UNSPECIFIED');
  fixture.pair({ generationGap: 8 }); fixture.otherChanged();
  await save.click();
  await expect(page.getByLabel('최신 관계 변경 내용', { exact: true })).toContainText('8대손');
  await expect(gap).toHaveValue('5');
  await expect(save).toBeDisabled();
  await page.getByRole('button', { name: '변경 내용 확인', exact: true }).click();
  await expect(gap).toHaveValue('8');
  await expect(subtype).toHaveValue('UNSPECIFIED');
  await save.click();
  await expect.poll(() => fixture.calls.saves.length).toBe(2);
  expect(fixture.calls.saves[1]).toMatchObject({ kind: 'DESCENDANT_OF', generationGap: 8, subtype: 'UNSPECIFIED', expectedVersion: 1 });
  await expect(save).toBeDisabled();
  await gap.fill('9');
  fixture.pair({ kind: 'CHILD_OF', generationGap: undefined }); fixture.otherChanged();
  await save.click();
  await expect(page.getByRole('button', { name: '변경 내용 확인', exact: true })).toBeVisible();
  await page.getByRole('button', { name: '변경 내용 확인', exact: true }).click();
  await expect(kind).toHaveValue('DESCENDANT_OF');
  await expect(gap).toHaveValue('9');
  await save.click();
  await expect.poll(() => fixture.calls.saves.length).toBe(4);
  expect(fixture.calls.saves[3]).toMatchObject({ kind: 'DESCENDANT_OF', generationGap: 9, expectedVersion: 3 });
  expect(fixture.calls.confirms).toBe(0);
});

test('조상·후손 세대 차이 수정은 판단 저장과 분리하고 미상·다른 관계로 바꾸면 수치를 지운다', async ({ page, context }) => {
  const fixture = await setup(context); fixture.ready();
  fixture.pair({ kind: 'DESCENDANT_OF', generationGap: 5 });
  fixture.familyText('도윤은 현우의 5대손이다.');
  await page.goto(editor);
  await editDetails(page);
  const gap = page.getByRole('spinbutton', { name: '대손 수', exact: true });
  const save = page.getByRole('button', { name: '변경사항 저장', exact: true });
  await gap.fill('0');
  await expect(save).toBeDisabled();
  await expect(page.getByRole('alert')).toContainText('대손 수는 1 이상의 정수');
  await gap.fill('2.5');
  await expect(save).toBeDisabled();
  await gap.fill('7');
  await chooseJudgment(page, '아직 모르겠어요');
  await page.getByRole('button', { name: '판단 저장', exact: true }).click();
  await expect(page.getByText('아직 모르는 관계예요', { exact: true })).toBeVisible();
  expect(fixture.calls.saves[0]).toMatchObject({ kind: 'DESCENDANT_OF', generationGap: 5, assertion: 'UNCERTAIN' });
  await expect(gap).toHaveValue('7');
  await chooseJudgment(page, '실제 가족이에요');
  await page.getByRole('button', { name: '판단 저장', exact: true }).click();
  await expect(page.getByText('가족 관계예요', { exact: true })).toBeVisible();
  expect(fixture.calls.saves[1]).toMatchObject({ generationGap: 5, assertion: 'ASSERTED' });
  await expect(gap).toHaveValue('7');
  await save.click();
  await expect.poll(() => fixture.calls.saves.length).toBe(3);
  expect(fixture.calls.saves[2]).toMatchObject({ kind: 'DESCENDANT_OF', generationGap: 7 });
  await expect(save).toBeDisabled();
  await gap.fill('');
  await expect(page.locator('.relationship-pair-preview')).toContainText('세대 차이 미상');
  await save.click();
  await expect.poll(() => fixture.calls.saves.length).toBe(4);
  expect(fixture.calls.saves[3].generationGap).toBeUndefined();
  await page.reload();
  await editDetails(page);
  await expect(gap).toHaveValue('');
  await gap.fill('5');
  await page.getByRole('combobox', { name: '관계', exact: true }).selectOption('CHILD_OF');
  await expect(gap).toHaveCount(0);
  await save.click();
  await expect.poll(() => fixture.calls.saves.length).toBe(5);
  expect(fixture.calls.saves[4]).toMatchObject({ kind: 'CHILD_OF' });
  expect(fixture.calls.saves[4].generationGap).toBeUndefined();
  expect(fixture.calls.confirms).toBe(0);
});

for (const kind of ['CHILD_OF', 'PARENT_OF', 'SPOUSE', 'SIBLING'] as const) {
  test(`${kind} 확정 목록과 미니 관계도는 두 인물의 방향과 프로필 미등록 대상을 구분한다`, async ({ page, context }) => {
    const fixture = await setup(context);
    fixture.pair({ kind, assertion: 'ASSERTED', displayableAsMention: true, reviewReasons: ['UNRESOLVED_TARGET'] });
    fixture.relation({ kind, subjectCharacterId: subjectId, subjectCharacterName: '도윤', objectCharacterId: targetId, objectCharacterName: '현우' });
    const objectRole = { CHILD_OF: '부모', PARENT_OF: '자녀', SPOUSE: '배우자', SIBLING: '형제자매' }[kind];
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(workspace);
    const confirmedRow = page.locator(`.family-relation-row[data-relationship-id="${relationId}"]`);
    await expect(confirmedRow).toHaveAccessibleName('관계 근거 보기');
    const pair = confirmedRow.locator('.family-relation-summary__pair');
    const subjectPerson = pair.locator('[data-person="subject"]');
    const objectPerson = pair.locator('[data-person="object"]');
    await expect(subjectPerson.getByText('도윤', { exact: true })).toBeVisible();
    await expect(objectPerson.getByText('현우', { exact: true })).toBeVisible();
    await expect(confirmedRow).toHaveAccessibleDescription(/현우/);
    await expect(confirmedRow).toHaveAccessibleDescription(/도윤/);
    await expect(confirmedRow).toHaveAccessibleDescription(/반영됨/);
    const nameStyles = await pair.locator('.family-relation-summary__name').evaluateAll(names => names.map(name => ({
      size: getComputedStyle(name).fontSize, weight: getComputedStyle(name).fontWeight,
    })));
    expect(nameStyles).toHaveLength(2);
    expect(nameStyles[0]).toEqual(nameStyles[1]);
    const ancestry = kind === 'CHILD_OF' || kind === 'PARENT_OF';
    if (ancestry) {
      const parent = pair.locator('[data-role="parent"]'); const child = pair.locator('[data-role="child"]');
      await expect(parent).toContainText(kind === 'CHILD_OF' ? '현우' : '도윤');
      await expect(child).toContainText(kind === 'CHILD_OF' ? '도윤' : '현우');
      await expect(parent).toContainText('부모'); await expect(child).toContainText('자녀');
      const left = (await parent.boundingBox())!; const right = (await child.boundingBox())!;
      expect(left.x + left.width).toBeLessThan(right.x);
    } else {
      await expect(pair.locator('[data-role="peer"]')).toHaveCount(2);
      await expect(pair).toContainText(objectRole);
    }
    await expect(confirmedRow).not.toContainText('현재 관계');
    await expect(confirmedRow).not.toContainText('·');
    await expect(confirmedRow.locator('button, a, input, select, textarea, summary')).toHaveCount(0);
    await expect(confirmedRow).toHaveAttribute('aria-expanded', 'false');
    await confirmedRow.focus(); await page.keyboard.press('Enter');
    await expect(confirmedRow).toHaveAttribute('aria-expanded', 'true');
    await expect(confirmedRow).toHaveAccessibleName('관계 근거 접기');
    await expect(page).toHaveURL(new RegExp(`relationshipId=${relationId}`));
    const detailId = await confirmedRow.getAttribute('aria-controls');
    expect(detailId).toBeTruthy();
    const detail = page.locator(`[id="${detailId}"]`);
    await expect(detail.getByRole('button', { name: '원문 근거 1', exact: true })).toBeVisible();
    await expect(detail.getByText('도윤의 아버지는 현우이다.', { exact: true })).toBeVisible();
    await expect(detail.getByRole('blockquote')).toContainText('아버지 현우');
    await expect(detail.locator('button button, button a, details')).toHaveCount(0);
    expect(fixture.originalReads()).toBe(1);
    await confirmedRow.focus(); await page.keyboard.press('Space');
    await expect(confirmedRow).toHaveAttribute('aria-expanded', 'false');
    await expect(confirmedRow).toBeFocused();
    await expect(detail).toHaveCount(0);
    expect(new URL(page.url()).searchParams.has('relationshipId')).toBe(false);
    expect(fixture.calls.withdraws).toBe(0);
    await page.goto(`${treeWorkspace}&relationView=review`);
    const queue = page.getByRole('region', { name: '선택적 프로필 연결', exact: true });
    await expect(queue.getByRole('heading', { name: '가족 프로필 연결', exact: true })).toBeVisible();
    await expect(queue.getByText('선택 사항', { exact: true })).toBeVisible();
    const row = queue.getByRole('button', { name: '도윤 가족 현우 프로필 연결', exact: true });
    await expect(row).toContainText('현우');
    await expect(row.getByText(`도윤의 ${objectRole}`, { exact: true })).toBeVisible();
    await expect(row).toHaveAccessibleDescription(new RegExp(`도윤의 ${objectRole}`));
    await expect(row).not.toContainText('현재 관계');
    await expect(row).not.toContainText('·');
    await expect(row.locator('button')).toHaveCount(0);
    await row.focus(); await page.keyboard.press('Enter');
    await expect(page).toHaveURL(new RegExp(`relationshipCandidate=${candidateId}`));
    const diagram = page.locator('.relationship-pair-preview');
    const subject = diagram.locator('[data-person="subject"]');
    const object = diagram.getByRole('button', { name: '현우 프로필 선택', exact: true });
    await expect(diagram).toHaveAttribute('data-uncertain', 'false');
    await expect(subject).toContainText('도윤');
    await expect(subject).not.toContainText('프로필 미등록');
    await expect(object).toContainText('프로필 미등록');
    await expect(diagram.locator('figcaption')).toHaveCount(0);
    await expect(subject.getByText('캐릭터를 연결하려면 클릭', { exact: true })).toHaveCount(0);
    const hint = diagram.getByText('캐릭터를 연결하려면 클릭', { exact: true }).filter({ visible: true });
    await expect(hint).toHaveCount(1);
    const from = (await subject.boundingBox())!;
    const to = (await object.boundingBox())!;
    const hintBox = (await hint.boundingBox())!;
    const hintArrow = object.locator('.relationship-pair-preview__action-arrow');
    if (kind === 'CHILD_OF' || kind === 'PARENT_OF') {
      await expect(hintArrow).toBeVisible();
      expect(hintBox.x).toBeGreaterThan(to.x + to.width);
      expect(Math.abs((hintBox.y + hintBox.height / 2) - (to.y + to.height / 2))).toBeLessThan(2);
    } else {
      await expect(hintArrow).toBeHidden();
      expect(hintBox.x).toBeGreaterThanOrEqual(to.x);
      expect(hintBox.x + hintBox.width).toBeLessThanOrEqual(to.x + to.width);
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
    if (kind === 'CHILD_OF') expect(to.y + to.height).toBeLessThan(from.y);
    else if (kind === 'PARENT_OF') expect(from.y + from.height).toBeLessThan(to.y);
    else expect(Math.abs((from.y + from.height / 2) - (to.y + to.height / 2))).toBeLessThan(2);
    await expect(page.getByRole('button').filter({ has: page.getByText('실제 가족이에요', { exact: true }) })).toHaveCount(0);
    await expect(page.getByText('같은 인물의 프로필이 있나요?', { exact: true })).toHaveCount(0);
    await expect(page.getByText('상대 인물 · 아직 연결되지 않았어요', { exact: true })).toHaveCount(0);
    await editDetails(page);
    await expect(page.getByText('도윤에게 어떤 가족인가요?', { exact: true })).toBeVisible();
    const kindPicker = page.getByRole('combobox', { name: '관계', exact: true });
    await expect(kindPicker).toHaveValue(kind);
    await expect(kindPicker.locator('option:checked')).toHaveText(objectRole);
    const reversedKind = kind === 'CHILD_OF' ? 'PARENT_OF' : kind === 'PARENT_OF' ? 'CHILD_OF' : 'CHILD_OF';
    await kindPicker.selectOption(reversedKind);
    const updatedParent = diagram.locator('[data-role="parent"]');
    await expect(updatedParent).toContainText(reversedKind === 'CHILD_OF' ? '현우' : '도윤');
    expect(fixture.calls.saves).toHaveLength(0); expect(fixture.calls.confirms).toBe(0);
    await page.getByRole('button', { name: '후보 목록', exact: true }).click();
    await expect(row).toBeFocused();
    expect(fixture.calls.saves).toHaveLength(0);
    expect(fixture.calls.confirms).toBe(0);
  });
}

test('후보 목록은 미확인 관계를 단정하지 않고 과거·미상 시점과 검토 이유를 유지한다', async ({ page, context }) => {
  const fixture = await setup(context);
  fixture.pair({ temporalScope: 'UNKNOWN', reviewReasons: ['UNCERTAIN', 'UNKNOWN_TEMPORAL_SCOPE'] });
  const historicalId = '44444444-4444-4444-8444-444444444445';
  fixture.candidateRows([{
    id: historicalId, status: 'PENDING', subjectCharacterId: subjectId, subjectCharacterName: '도윤',
    objectMention: '서연', kind: 'SPOUSE', temporalScope: 'HISTORICAL', timeLabel: '10년 전', assertion: 'ASSERTED',
    displayableAsMention: true, reviewReasons: ['UNRESOLVED_TARGET'],
  }]);
  await page.goto(`${treeWorkspace}&relationView=review`);
  const required = page.getByRole('region', { name: '확인이 필요한 관계', exact: true });
  const unknown = required.getByRole('button', { name: '도윤 가족 현우 관계 확인', exact: true });
  await expect(unknown.getByText('도윤의 부모 관계 확인', { exact: true })).toBeVisible();
  await expect(unknown.getByText('도윤의 부모', { exact: true })).toHaveCount(0);
  await expect(unknown).toContainText('시점 확인 필요');
  await expect(unknown).toContainText('가족 관계인지 확실한지 확인해 주세요.');
  await expect(unknown).toHaveAccessibleDescription(/도윤의 부모 관계 확인.*시점 확인 필요.*혈연.*가족 관계인지 확실한지 확인해 주세요/);
  const historical = page.getByRole('region', { name: '선택적 프로필 연결', exact: true })
    .getByRole('button', { name: '도윤 가족 서연 프로필 연결', exact: true });
  await expect(historical).toContainText('과거 관계');
  await expect(historical).toContainText('10년 전');
  await expect(historical).toContainText('도윤의 배우자');
  await expect(historical).toHaveAccessibleDescription(/도윤의 배우자.*과거 관계.*10년 전/);
  await expect(historical).not.toContainText('·');
  expect(fixture.calls.saves).toHaveLength(0); expect(fixture.calls.confirms).toBe(0); expect(fixture.calls.dismisses).toBe(0);
});

test('320px에서 마지막 후보를 제외하면 지연된 목록 갱신 뒤 보이는 보기 선택으로 초점이 돌아온다', async ({ page, context }) => {
  const fixture = await setup(context);
  await page.setViewportSize({ width: 320, height: 740 });
  await page.goto(`${treeWorkspace}&relationView=review`);
  const row = page.getByRole('button', { name: '도윤 가족 현우 관계 확인', exact: true });
  await row.click();
  await chooseExclusion(page);
  let release!: () => void;
  let received!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  const started = new Promise<void>(resolve => { received = resolve; });
  await context.route('**/relationship-candidates?*', async route => {
    if (route.request().method() === 'GET' && new URL(route.request().url()).searchParams.get('size') === '20') {
      received(); await gate;
    }
    await route.fallback();
  });
  await page.getByRole('button', { name: '판단 저장', exact: true }).click();
  await started;
  try {
    await expect.poll(() => new URL(page.url()).searchParams.has('relationshipCandidate')).toBe(false);
    await expect(row).toBeVisible();
    expect(fixture.calls.dismisses).toBe(1);
  } finally { release(); }
  await expect(page.getByText('확인이 필요한 가족 관계가 없어요.', { exact: true })).toBeVisible();
  await expect(row).toHaveCount(0);
  const view = page.getByRole('combobox', { name: '가족 관계 보기', exact: true });
  await expect(view).toBeVisible();
  await expect(view).toBeFocused();
  expect(fixture.calls.saves).toHaveLength(0); expect(fixture.calls.confirms).toBe(0);
});

test('관계가 불확실한 그림은 확인 필요를 표시하고 인물 선택과 가족 판단을 별도로 유지한다', async ({ page, context }) => {
  const fixture = await setup(context);
  await page.goto(editor);
  const diagram = page.locator('.relationship-pair-preview');
  await expect(diagram).toHaveAttribute('data-uncertain', 'true');
  await expect(diagram).toContainText('확인 필요');
  expect(await diagram.locator('.relationship-pair-preview__connector').evaluate(element => getComputedStyle(element, '::before').borderLeftStyle)).toBe('dashed');
  const card = diagram.getByRole('button', { name: '현우 프로필 선택', exact: true });
  await expect(card).toBeEnabled();
  await card.click();
  await expect(page.getByRole('button', { name: '현우 첫 등장 6화', exact: true })).toBeVisible();
  await page.getByRole('button', { name: '선택 닫기', exact: true }).click();
  await expect(page.getByRole('button').filter({ has: page.getByText('실제 가족이에요', { exact: true }) })).toHaveAttribute('aria-pressed', 'false');
  await expect(page.getByRole('button').filter({ has: page.getByText('실제 가족이에요', { exact: true }) })).toBeVisible();
  await expect(page.getByRole('button').filter({ has: page.getByText('가족이 아니에요', { exact: true }) })).toBeVisible();
  await expect(page.getByRole('button').filter({ has: page.getByText('아직 모르겠어요', { exact: true }) })).toBeVisible();
  await page.getByRole('button').filter({ has: page.getByText('실제 가족이에요', { exact: true }) }).click();
  await expect(diagram).toHaveAttribute('data-uncertain', 'false');
  await expect(diagram.locator('figcaption')).toHaveText('저장 전');
  await expect(diagram.getByRole('button', { name: '현우 프로필 선택', exact: true })).toBeEnabled();
  await page.getByRole('button').filter({ has: page.getByText('가족이 아니에요', { exact: true }) }).click();
  await expect(diagram).toHaveAttribute('data-uncertain', 'true');
  await expect(diagram.locator('figcaption')).toHaveText('검토할 관계 · 저장 전');
  await expect(card).toBeDisabled();
  await expect(diagram.getByText('캐릭터를 연결하려면 클릭', { exact: true }).filter({ visible: true })).toHaveCount(0);
  await page.getByRole('button').filter({ has: page.getByText('아직 모르겠어요', { exact: true }) }).click();
  await expect(card).toBeEnabled();
  await expect(diagram.getByText('캐릭터를 연결하려면 클릭', { exact: true }).filter({ visible: true })).toHaveCount(1);
  await expect(diagram).toHaveAttribute('data-uncertain', 'true');
  expect(await diagram.locator('.relationship-pair-preview__connector').evaluate(element => getComputedStyle(element, '::before').borderLeftStyle)).toBe('dashed');
  expect(fixture.calls.saves).toHaveLength(0); expect(fixture.calls.confirms).toBe(0);
});

test('인물 카드에서 키보드로 프로필을 선택하고 돌아오며 선택한 이름과 원문 이름을 구분한다', async ({ page, context }) => {
  const fixture = await setup(context);
  fixture.pair({ assertion: 'ASSERTED', displayableAsMention: true, reviewReasons: ['UNRESOLVED_TARGET'] });
  fixture.namedProfile('현우의 본명');
  await page.goto(editor);
  const card = page.getByRole('button', { name: '현우 프로필 선택', exact: true });
  await card.focus(); await page.keyboard.press('Enter');
  await expect(card).toHaveAttribute('aria-expanded', 'true');
  await expect(page.getByRole('button', { name: '현우 첫 등장 6화', exact: true })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(card).toHaveAttribute('aria-expanded', 'false'); await expect(card).toBeFocused();
  await page.keyboard.press('Enter');
  await page.getByRole('button', { name: '다음 페이지' }).click();
  await page.getByRole('button', { name: '현우의 본명 첫 등장 회차 미확인', exact: true }).click();
  const selected = page.getByRole('button', { name: '현우의 본명 프로필 선택', exact: true });
  await expect(selected).toBeFocused();
  await expect(selected).toContainText('저장 전');
  await expect(selected).not.toContainText('프로필 미등록');
  await expect(page.locator('.relationship-pair-preview').getByText('연결할 캐릭터를 바꾸려면 클릭', { exact: true }).filter({ visible: true })).toHaveCount(1);
  await expect(page.locator('.relationship-pair-preview').getByText('캐릭터를 연결하려면 클릭', { exact: true })).toHaveCount(0);
  await expect(page.locator('.relationship-pair-preview figcaption')).toHaveText('저장 전');
  await expect(page.locator('.family-review-source-caption')).toContainText('도윤의 아버지는 현우이다.');
  await expect(page.getByRole('button', { name: '프로필 연결하기', exact: true })).toBeEnabled();
  expect(fixture.calls.saves).toHaveLength(0); expect(fixture.calls.confirms).toBe(0);
  await page.reload();
  await expect(card).toContainText('프로필 미등록');
  await expect(page.getByRole('button', { name: '현우의 본명 프로필 선택', exact: true })).toHaveCount(0);
});

test('기존 프로필 선택을 해제하면 같은 인물 카드에 미등록 상태를 표시하고 자동 저장하지 않는다', async ({ page, context }) => {
  const fixture = await setup(context); fixture.ready();
  await page.goto(editor);
  const card = page.getByRole('button', { name: '현우 프로필 선택', exact: true });
  await expect(card).toContainText('프로필 등록됨');
  await expect(page.locator('.relationship-pair-preview').getByText('연결할 캐릭터를 바꾸려면 클릭', { exact: true }).filter({ visible: true })).toHaveCount(1);
  await card.click();
  await page.getByRole('button', { name: '프로필 선택 해제', exact: true }).click();
  await expect(card).toBeFocused();
  await expect(card).toContainText('프로필 미등록');
  await expect(card).not.toContainText('연결할 프로필');
  await expect(page.locator('.relationship-pair-preview').getByText('캐릭터를 연결하려면 클릭', { exact: true }).filter({ visible: true })).toHaveCount(1);
  await expect(page.locator('.relationship-pair-preview').getByText('연결할 캐릭터를 바꾸려면 클릭', { exact: true })).toHaveCount(0);
  await editDetails(page);
  await expect(page.getByRole('button', { name: '변경사항 저장', exact: true })).toBeEnabled();
  expect(fixture.calls.saves).toHaveLength(0); expect(fixture.calls.confirms).toBe(0);
});

test('저장 후 상대를 바꿨다가 원래 프로필로 돌아오면 그 사이 바뀐 근거를 새로 읽는다', async ({ page, context }) => {
  const fixture = await setup(context); fixture.ready();
  await page.goto(editor);
  await editDetails(page);
  await page.getByLabel('시점 설명').fill('프로필을 다시 고르기 전 저장');
  await page.getByRole('button', { name: '변경사항 저장', exact: true }).click();
  await expect(page.getByText('수정한 내용을 저장했어요.', { exact: false })).toBeVisible();
  const card = page.getByRole('button', { name: '현우 프로필 선택', exact: true });
  await card.click();
  await page.getByRole('button', { name: '현우 첫 등장 6화', exact: true }).click();
  await expect(page.getByRole('button', { name: '변경사항 저장', exact: true })).toBeEnabled();
  const readsWithOther = fixture.calls.sourceReads.length;
  fixture.sourceChanged();
  await card.click();
  await page.getByRole('button', { name: '다음 페이지', exact: true }).click();
  await page.getByRole('button', { name: '현우 첫 등장 회차 미확인', exact: true }).click();
  await expect(page.getByRole('checkbox')).toBeVisible();
  await expect(page.getByRole('checkbox')).not.toBeChecked();
  await expect(page.getByRole('group', { name: '현재 설정 중 사용할 근거', exact: true })).toContainText('도윤의 친아버지는 현우이다.');
  await expect(page.getByRole('button', { name: '가계도에 반영하기', exact: true })).toBeDisabled();
  expect(fixture.calls.sourceReads.length).toBeGreaterThan(readsWithOther);
  expect(fixture.calls.saves).toHaveLength(1); expect(fixture.calls.confirms).toBe(0);
  expect(fixture.calls.saves[0]).toMatchObject({ objectCharacterId: targetId, expectedVersion: 0, evidence: [{ sourceFactId: factId, sourceToken: oldToken }] });
});

for (const kind of ['CHILD_OF', 'SIBLING'] as const) {
  test(`320px ${kind} 그림에서 긴 이름이 가로로 넘치지 않고 인물 선택을 열 수 있다`, async ({ page, context }, testInfo) => {
    const fixture = await setup(context);
    const longName = '드자르위 클랜에서 처음 언급된 아주 긴 이름의 인물';
    fixture.pair({ kind, assertion: 'ASSERTED', subjectCharacterName: '비요른 얀델의 아주 긴 등록된 이름', objectMention: longName,
      displayableAsMention: true, reviewReasons: ['UNRESOLVED_TARGET'] });
    fixture.relation({ kind, subjectCharacterName: '비요른 얀델의 아주 긴 등록된 이름', objectCharacterName: longName,
      temporalScope: 'HISTORICAL', timeLabel: '첫 대륙 전쟁이 끝난 후 아주 오래된 시점', subtype: 'ADOPTIVE' });
    await page.setViewportSize({ width: 320, height: 740 });
    await page.goto(workspace);
    const confirmedRow = page.locator(`.family-relation-row[data-relationship-id="${relationId}"]`);
    await expect(confirmedRow.getByText(longName, { exact: true })).toBeVisible();
    await expect(confirmedRow.getByText('비요른 얀델의 아주 긴 등록된 이름', { exact: true })).toBeVisible();
    const pair = confirmedRow.locator('.family-relation-summary__pair');
    const names = pair.locator('.family-relation-summary__name');
    await expect(names).toHaveCount(2);
    const nameStyles = await names.evaluateAll(elements => elements.map(element => getComputedStyle(element).fontSize));
    expect(nameStyles[0]).toEqual(nameStyles[1]);
    if (kind === 'CHILD_OF') {
      await expect(pair.locator('[data-role="parent"]')).toContainText(longName);
      await expect(pair.locator('[data-role="child"]')).toContainText('비요른 얀델의 아주 긴 등록된 이름');
    } else await expect(pair).toContainText('형제자매');
    await expect(confirmedRow).toContainText('과거 관계');
    await expect(confirmedRow).toContainText('첫 대륙 전쟁이 끝난 후 아주 오래된 시점');
    expect((await confirmedRow.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    expect(await confirmedRow.evaluate(element => element.scrollWidth <= element.clientWidth + 1)).toBe(true);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
    await confirmedRow.screenshot({ path: testInfo.outputPath(`family-confirmed-${kind.toLowerCase()}-mobile-320.png`) });
    await confirmedRow.click();
    await expect(page.getByRole('button', { name: '원문 근거 1', exact: true })).toBeVisible();
    await confirmedRow.click();
    expect(fixture.calls.withdraws).toBe(0);
    await page.goto(`${treeWorkspace}&relationView=review`);
    const row = page.getByRole('button', { name: `비요른 얀델의 아주 긴 등록된 이름 가족 ${longName} 프로필 연결`, exact: true });
    await expect(row).toBeVisible();
    expect((await row.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    expect(await row.evaluate(element => element.scrollWidth <= element.clientWidth + 1)).toBe(true);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
    await row.screenshot({ path: testInfo.outputPath(`family-queue-${kind.toLowerCase()}-mobile-320.png`) });
    await row.click();
    const diagram = page.locator('.relationship-pair-preview');
    const card = diagram.getByRole('button', { name: `${longName} 프로필 선택`, exact: true });
    await card.scrollIntoViewIfNeeded();
    await expect(card).toBeVisible();
    await expect(card.getByText('캐릭터를 연결하려면 클릭', { exact: true })).toBeVisible();
    await expect(diagram.getByText('캐릭터를 연결하려면 클릭', { exact: true }).filter({ visible: true })).toHaveCount(1);
    await expect(diagram.locator('figcaption')).toHaveCount(0);
    await expect(card.locator('.relationship-pair-preview__action-arrow')).toBeHidden();
    const cardBox = (await card.boundingBox())!;
    const hintBox = (await card.getByText('캐릭터를 연결하려면 클릭', { exact: true }).boundingBox())!;
    expect(hintBox.x).toBeGreaterThanOrEqual(cardBox.x);
    expect(hintBox.x + hintBox.width).toBeLessThanOrEqual(cardBox.x + cardBox.width);
    expect((await card.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
    const overflowing = await diagram.evaluate(element => [...element.querySelectorAll('[data-person]')]
      .some(card => card.scrollWidth > card.clientWidth + 1));
    expect(overflowing).toBe(false);
    await diagram.screenshot({ path: testInfo.outputPath(`family-pair-${kind.toLowerCase()}-mobile-320.png`) });
    await card.click();
    await expect(page.getByRole('button', { name: '현우 첫 등장 6화', exact: true })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
    expect(fixture.calls.saves).toHaveLength(0); expect(fixture.calls.confirms).toBe(0);
  });
}

test('프로필 상대를 고르지 않고도 가족 판단만 저장하며 서버가 보류하면 표시 완료로 안내하지 않는다', async ({ page, context }) => {
  const fixture = await setup(context);
  await page.goto(editor);
  await page.getByRole('button').filter({ has: page.getByText('실제 가족이에요', { exact: true }) }).click();
  await expect(page.getByRole('button', { name: '판단 저장', exact: true })).toBeEnabled();
  expect(fixture.calls.saves).toHaveLength(0);
  await page.getByRole('button', { name: '판단 저장', exact: true }).click();
  await expect(page.getByText('가족 관계예요', { exact: true })).toBeVisible();
  expect(fixture.calls.saves).toHaveLength(1);
  expect(fixture.calls.saves[0]).toMatchObject({ assertion: 'ASSERTED', expectedVersion: 0 });
  expect(fixture.calls.saves[0].objectCharacterId).toBeUndefined();
  expect(fixture.calls.confirms).toBe(0);
  await expect(page.getByText('가계도에 표시 중', { exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: '확인·연결 1', exact: true })).toBeVisible();
});

test('가족 판단 선택만 바꾸고 목록으로 돌아가면 기존 후보를 유지한다', async ({ page, context }) => {
  const fixture = await setup(context);
  await page.goto(editor);
  await page.getByRole('button').filter({ has: page.getByText('실제 가족이에요', { exact: true }) }).click();
  await page.getByRole('button').filter({ has: page.getByText('가족이 아니에요', { exact: true }) }).click();
  await expect(page.getByRole('button', { name: '판단 저장', exact: true })).toBeEnabled();
  await expect(page.getByRole('button', { name: '변경사항 저장', exact: true })).toBeHidden();
  await page.getByRole('button').filter({ has: page.getByText('아직 모르겠어요', { exact: true }) }).click();
  await expect(page.getByRole('button', { name: '변경사항 저장', exact: true })).toBeHidden();
  expect(fixture.calls.saves).toHaveLength(0); expect(fixture.calls.dismisses).toBe(0); expect(fixture.calls.confirms).toBe(0);
  await page.getByRole('button', { name: '후보 목록', exact: true }).click();
  await expect(page.getByRole('button', { name: '도윤 가족 현우 관계 확인', exact: true })).toBeVisible();
  expect(new URL(page.url()).searchParams.has('relationshipCandidate')).toBe(false);
  expect(fixture.calls.saves).toHaveLength(0); expect(fixture.calls.dismisses).toBe(0); expect(fixture.calls.confirms).toBe(0);
  await page.getByRole('button', { name: '도윤 가족 현우 관계 확인', exact: true }).click();
  await expect(page.getByRole('button').filter({ has: page.getByText('실제 가족이에요', { exact: true }) })).toHaveAttribute('aria-pressed', 'false');
});

test('서버가 프로필 없는 표시를 허용하면 가족 판단 저장 뒤 연결은 선택으로 남긴다', async ({ page, context }) => {
  const fixture = await setup(context); fixture.allowMention();
  await page.goto(editor);
  await page.getByRole('button').filter({ has: page.getByText('실제 가족이에요', { exact: true }) }).click();
  await page.getByRole('button', { name: '판단 저장', exact: true }).click();
  await expect(page.getByText('가족 관계예요', { exact: true })).toBeVisible();
  await expect(page.getByText('프로필 없이도 가계도에 표시할 수 있어요.', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: '후보 목록', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: '판단 저장', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: '후보 목록', exact: true }).click();
  await expect(page.getByRole('button', { name: '도윤 가족 현우 프로필 연결', exact: true })).toBeVisible();
  expect(fixture.calls.saves).toHaveLength(1); expect(fixture.calls.confirms).toBe(0); expect(fixture.calls.dismisses).toBe(0);
});

test('미저장 판단은 일반 저장으로 우회할 수 없고 실패 후 재시도도 다른 편집 초안을 함께 저장하지 않는다', async ({ page, context }) => {
  const fixture = await setup(context); fixture.ready(); fixture.failSave();
  await page.goto(editor);
  const selectedProfile = page.getByRole('button', { name: '현우 프로필 선택', exact: true });
  await selectedProfile.click();
  await page.getByRole('button', { name: '현우 첫 등장 6화', exact: true }).click();
  await expect(selectedProfile).toContainText('연결할 프로필 · 저장 전');
  await editDetails(page);
  await page.getByLabel('시점 설명').fill('아직 저장하지 않은 시점');
  await page.getByRole('combobox', { name: '관계', exact: true }).selectOption('SPOUSE');
  await chooseJudgment(page, '아직 모르겠어요');
  await expect(page.getByRole('button', { name: '변경사항 저장', exact: true })).toBeDisabled();
  await expect(page.getByRole('button', { name: '가계도에 반영하기', exact: true })).toBeDisabled();
  await page.getByLabel('시점 설명').press('Enter');
  expect(fixture.calls.mutations).toEqual([]);
  await page.getByRole('button', { name: '판단 저장', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('일시적으로 저장하지 못했어요.');
  await expect(page.getByRole('button').filter({ has: page.getByText('아직 모르겠어요', { exact: true }) })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByLabel('시점 설명')).toHaveValue('아직 저장하지 않은 시점');
  await expect(page.getByRole('combobox', { name: '관계', exact: true })).toHaveValue('SPOUSE');
  await expect(selectedProfile).toContainText('연결할 프로필 · 저장 전');
  expect(fixture.calls.confirms).toBe(0); expect(fixture.calls.dismisses).toBe(0);
  await page.getByRole('button', { name: '판단 저장', exact: true }).click();
  await expect(page.getByText('아직 모르는 관계예요', { exact: true })).toBeVisible();
  expect(fixture.calls.saves).toHaveLength(2);
  for (const body of fixture.calls.saves) {
    expect(body).toMatchObject({ assertion: 'UNCERTAIN', objectCharacterId: targetId, kind: 'CHILD_OF', subtype: 'BIOLOGICAL',
      temporalScope: 'CURRENT', expectedVersion: 0, evidence: [{ sourceFactId: factId, sourceToken: oldToken }] });
    expect(body.timeLabel).toBeUndefined();
  }
  await expect(page.getByLabel('시점 설명')).toHaveValue('아직 저장하지 않은 시점');
  await expect(page.getByRole('combobox', { name: '관계', exact: true })).toHaveValue('SPOUSE');
  await expect(selectedProfile).toContainText('연결할 프로필 · 저장 전');
  await page.reload();
  await expect(page.getByRole('button').filter({ has: page.getByText('아직 모르겠어요', { exact: true }) })).toBeVisible();
  await editDetails(page);
  await expect(page.getByLabel('시점 설명')).toHaveValue('');
  await expect(page.getByRole('combobox', { name: '관계', exact: true })).toHaveValue('CHILD_OF');
  await expect(selectedProfile).toContainText('프로필 등록됨');
  expect(fixture.calls.confirms).toBe(0); expect(fixture.calls.dismisses).toBe(0);
});

test('저장은 성공했지만 확정이 실패하면 저장된 버전으로 확정만 다시 요청한다', async ({ page, context }) => {
  const fixture = await setup(context); fixture.ready(); fixture.failConfirm();
  await page.goto(editor);
  await editDetails(page);
  await page.getByLabel('시점 설명').fill('저장 후 확정 실패');
  await page.getByRole('button', { name: '가계도에 반영하기', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('가계도 반영을 완료하지 못했어요.');
  await expect(page.getByLabel('시점 설명')).toHaveValue('저장 후 확정 실패');
  expect(fixture.calls.saves).toHaveLength(1);
  expect(fixture.calls.confirmVersions).toEqual([1]);
  await page.getByRole('button', { name: '가계도에 반영하기', exact: true }).click();
  await expect(page.getByText('확인이 필요한 가족 관계가 없어요.', { exact: true })).toBeVisible();
  expect(fixture.calls.saves).toHaveLength(1);
  expect(fixture.calls.confirmVersions).toEqual([1, 1]);
});

test('저장 응답에 확인 사유가 남으면 선택한 상대가 있어도 이어서 확정하지 않는다', async ({ page, context }) => {
  const fixture = await setup(context); fixture.ready(); fixture.holdAfterSave(['CURRENT_VALUE_CONFLICT']);
  await page.goto(editor);
  await editDetails(page);
  await page.getByLabel('시점 설명').fill('충돌을 다시 확인할 관계');
  await page.getByRole('button', { name: '가계도에 반영하기', exact: true }).click();
  await expect(page.getByRole('region', { name: '가족 관계 후보 검토' })).toContainText('설정');
  await expect.poll(() => fixture.calls.saves.length).toBe(1);
  await expect(page.getByRole('button', { name: '가계도에 반영하기', exact: true })).toBeDisabled();
  expect(fixture.calls.confirms).toBe(0);
  await expect(page.getByLabel('시점 설명')).toHaveValue('충돌을 다시 확인할 관계');
});

for (const action of ['변경사항 저장', '판단 저장'] as const) {
for (const conflict of ['version', 'source'] as const) {
test(`${action}은 ${conflict} 409 뒤 자동으로 최신 근거를 확인하고 초안·옛 토큰을 명시 선택 전까지 보존한다`, async ({ page, context }) => {
  const fixture = await setup(context); fixture.ready();
  await page.goto(editor);
  await editDetails(page);
  await page.getByLabel('시점 설명').fill('가족 회의 이후');
  if (action === '판단 저장') await chooseJudgment(page, '아직 모르겠어요');
  await expect(page.getByRole('button', { name: action, exact: true })).toBeEnabled();
  fixture.sourceChanged();
  if (conflict === 'version') fixture.otherChanged();
  fixture.failSources();
  await page.getByRole('button', { name: action, exact: true }).click();
  await expect(page.getByRole('button', { name: '다시 시도', exact: true })).toBeVisible();
  await expect(page.getByLabel('시점 설명')).toHaveValue('가족 회의 이후');
  expect(fixture.calls.saves).toHaveLength(1);
  expect(fixture.calls.saves[0]).toMatchObject({ expectedVersion: 0, evidence: [{ sourceFactId: factId, sourceToken: oldToken }] });
  await expect(page.getByRole('button', { name: action, exact: true })).toBeDisabled();
  await page.getByRole('button', { name: '다시 시도', exact: true }).click();
  await expect(page.getByRole('checkbox')).not.toBeChecked();
  if (conflict === 'version') {
    await expect(page.getByLabel('최신 관계 변경 내용', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: '변경 내용 확인', exact: true }).click();
  }
  await expect(page.getByLabel('시점 설명')).toHaveValue('가족 회의 이후');
  await expect(page.getByRole('button', { name: action, exact: true })).toBeDisabled();
  expect(fixture.calls.saves).toHaveLength(1);
  await page.getByRole('checkbox').check();
  await expect(page.getByRole('checkbox')).toBeChecked();
  await page.getByRole('button', { name: action, exact: true }).click();
  if (action === '판단 저장') await expect(page.getByText('아직 모르는 관계예요', { exact: true })).toBeVisible();
  else await expect(page.getByRole('button', { name: '가계도에 반영하기' })).toBeEnabled();
  expect(fixture.calls.saves[1]).toMatchObject({ expectedVersion: conflict === 'version' ? 1 : 0,
    assertion: action === '판단 저장' ? 'UNCERTAIN' : 'ASSERTED', evidence: [{ sourceFactId: factId, sourceToken: newToken }] });
  expect(fixture.calls.saves[1].timeLabel).toBe(action === '판단 저장' ? undefined : '가족 회의 이후');
  await expect(page.getByRole('checkbox')).toHaveCount(0);
  expect(fixture.calls.confirms).toBe(0);
});
}
}

test('최신 근거 자동 조회 실패는 초안을 유지하고 명시 재시도로만 복구하며 같은 상태의 polling은 재요청하지 않는다', async ({ page, context }) => {
  const fixture = await setup(context); fixture.ready(); fixture.failSourceReads(subjectId, true);
  await page.clock.install();
  await page.goto(editor);
  await expect(page.getByRole('button', { name: '다시 시도', exact: true })).toBeVisible();
  await editDetails(page);
  await page.getByLabel('시점 설명').fill('조회 실패에도 남을 초안');
  await expect(page.getByRole('button', { name: '변경사항 저장', exact: true })).toBeDisabled();
  await expect(page.getByRole('button', { name: '최신 설정 불러오기', exact: true })).toHaveCount(0);
  const failedReads = fixture.calls.sourceReads.length;
  await page.clock.runFor(31000);
  expect(fixture.calls.sourceReads).toHaveLength(failedReads);
  expect(fixture.calls.mutations).toEqual([]);
  fixture.failSourceReads(subjectId, false);
  await page.getByRole('button', { name: '다시 시도', exact: true }).click();
  await expect(page.getByRole('button', { name: '변경사항 저장', exact: true })).toBeEnabled();
  await expect(page.getByLabel('시점 설명')).toHaveValue('조회 실패에도 남을 초안');
  await expect(page.getByRole('checkbox')).toHaveCount(0);
  await expect(page.getByRole('button', { name: '다시 시도', exact: true })).toHaveCount(0);
  expect(fixture.calls.sourceReads.length - failedReads).toBe(2);
  const recoveredReads = fixture.calls.sourceReads.length;
  await page.clock.runFor(31000);
  expect(fixture.calls.sourceReads).toHaveLength(recoveredReads);
  await page.getByRole('button', { name: '변경사항 저장', exact: true }).click();
  await expect(page.getByText('수정한 내용을 저장했어요.', { exact: false })).toBeVisible();
  expect(fixture.calls.saves[0]).toMatchObject({ expectedVersion: 0, timeLabel: '조회 실패에도 남을 초안', evidence: [{ sourceFactId: factId, sourceToken: oldToken }] });
});

test('보관된 기존 상대 조회가 실패해도 새 상대의 근거로 일반 수정하며 그 근거를 이전 관계의 판단에 섞지 않는다', async ({ page, context }) => {
  const fixture = await setup(context); fixture.ready(); fixture.failSourceReads(targetId, true);
  const newProfileId = '77777777-7777-4777-8777-777777777777';
  const newFactId = '88888888-8888-4888-8888-888888888888';
  const newProfileToken = 'c'.repeat(64);
  fixture.additionalSource({ characterId: newProfileId, factId: newFactId, contextToken: newProfileToken,
    currentValue: { factValue: '경비병 프로필에 기록된 가족' } });
  await page.goto(editor);
  await expect(page.getByRole('button', { name: '다시 시도', exact: true })).toBeVisible();
  fixture.sourceInvalidated();
  await page.getByRole('button', { name: '현우 프로필 선택', exact: true }).click();
  await page.getByRole('button', { name: '현우 첫 등장 6화', exact: true }).click();
  await editDetails(page);
  await page.getByLabel('시점 설명').fill('보관된 상대를 바꾸는 수정');
  await expect(page.getByRole('button', { name: '변경사항 저장', exact: true })).toBeDisabled();
  await expect(page.getByRole('button', { name: '근거 선택', exact: true })).toHaveCount(0);
  await expect(page.getByRole('checkbox')).not.toBeChecked();
  await page.getByRole('button', { name: '기존 근거 제거', exact: true }).click();
  await expect(page.getByRole('checkbox')).toBeVisible();
  await page.locator('.relationship-source-choice').filter({ hasText: '경비병 프로필에 기록된 가족' }).getByRole('checkbox').check();
  await expect(page.getByRole('checkbox')).toBeChecked();
  await chooseJudgment(page, '아직 모르겠어요');
  await expect(page.getByRole('button', { name: '판단 저장', exact: true })).toBeDisabled();
  await page.getByRole('button', { name: '선택 취소', exact: true }).click();
  expect(fixture.calls.mutations).toEqual([]);
  await page.getByRole('button', { name: '변경사항 저장', exact: true }).click();
  await expect(page.getByText('수정한 내용을 저장했어요.', { exact: false })).toBeVisible();
  expect(fixture.calls.saves).toEqual([expect.objectContaining({ objectCharacterId: newProfileId, expectedVersion: 0,
    timeLabel: '보관된 상대를 바꾸는 수정', evidence: [{ sourceFactId: newFactId, sourceToken: newProfileToken }] })]);
  await expect(page.getByRole('checkbox')).toHaveCount(0);
  expect(fixture.calls.confirms).toBe(0);
});

test('저장·제외 네트워크 실패 재시도와 처리 실패 재요청은 AI 분석을 만들지 않는다', async ({ page, context }) => {
  const fixture = await setup(context); fixture.ready(); fixture.failSave(); fixture.failDismiss(); fixture.failed();
  await page.goto(editor);
  await editDetails(page);
  await page.getByLabel('시점 설명').fill('재시도할 입력');
  await page.getByRole('button', { name: '변경사항 저장' }).click();
  await expect(page.getByRole('alert')).toContainText('일시적으로 저장하지 못했어요.');
  await expect(page.getByLabel('시점 설명')).toHaveValue('재시도할 입력');
  await page.getByRole('button', { name: '변경사항 저장' }).click();
  await expect(page.getByText('수정한 내용을 저장했어요.', { exact: false })).toBeVisible();
  await chooseExclusion(page);
  await page.getByRole('button', { name: '판단 저장' }).click();
  await expect(page.getByRole('alert')).toContainText('제외 요청을 완료하지 못했어요.');
  await page.getByRole('button', { name: '선택 취소', exact: true }).click();
  await editDetails(page);
  await expect(page.getByLabel('시점 설명')).toHaveValue('재시도할 입력');
  await chooseExclusion(page);
  await page.getByRole('button', { name: '판단 저장' }).click();
  await expect(page.getByText('확인이 필요한 가족 관계가 없어요.', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: '관계 정리 다시 시도' }).click();
  await expect(page.getByText('가족 관계를 정리하고 있어요.', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: '관계 정리 다시 시도', exact: true })).toHaveCount(0);
  expect(fixture.calls.processing).toBe(1); expect(fixture.calls.analyses).toBe(0);
});

test('320px 모바일 수정 버튼은 대비·키보드·링크를 유지하고 최신 근거를 자동으로 확인한다', async ({ page, context }, testInfo) => {
  const fixture = await setup(context); await page.setViewportSize({ width: 320, height: 740 });
  await page.goto(settings);
  await expect(page.getByRole('combobox', { name: '작품 설정', exact: true }).getByRole('option', { name: '가족 관계', exact: true })).toHaveCount(0);
  await expect(page.getByRole('combobox', { name: '작품 설정', exact: true }).getByRole('option', { name: '관계도 · 업데이트 예정', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: '메뉴 열기', exact: true }).click();
  const drawer = page.getByRole('dialog', { name: '워크스페이스 메뉴' });
  await drawer.getByRole('button', { name: '관계도', exact: true }).click();
  await expect(drawer).toHaveCount(0);
  await expect.poll(() => new URL(page.url()).searchParams.get('nav')).toBe('graph');
  await expect(page.getByRole('tab', { name: '인물 관계도', exact: true })).toHaveAttribute('aria-selected', 'true');
  await page.getByRole('tab', { name: '가계도', exact: true }).click();
  await page.getByLabel('가족 관계 보기', { exact: true }).selectOption('review');
  await page.getByRole('button', { name: '도윤 가족 현우 관계 확인' }).click();
  await expect(page.getByRole('heading', { name: '도윤의 가족 관계 확인' })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('heading', { name: '도윤의 가족 관계 확인' })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBeTruthy();
  const familyChoice = page.getByRole('button').filter({ has: page.getByText('실제 가족이에요', { exact: true }) });
  expect((await familyChoice.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  const contrasts = await familyChoice.evaluate(element => {
    const luminance = (color: string) => {
      const values = (color.match(/[\d.]+/g) ?? []).slice(0, 3).map(Number).map(value => { const n = value / 255; return n <= .04045 ? n / 12.92 : ((n + .055) / 1.055) ** 2.4; });
      return .2126 * values[0] + .7152 * values[1] + .0722 * values[2];
    };
    const background = luminance(getComputedStyle(element).backgroundColor);
    return [...element.querySelectorAll('.review-cb-choice__identity > strong, .review-cb-choice__identity > span')].map(text => {
      const foreground = luminance(getComputedStyle(text).color);
      return (Math.max(background, foreground) + .05) / (Math.min(background, foreground) + .05);
    });
  });
  expect(contrasts).toHaveLength(2);
  for (const contrast of contrasts) expect(contrast).toBeGreaterThanOrEqual(4.5);
  await chooseExclusion(page);
  await page.getByRole('button', { name: '판단 저장' }).scrollIntoViewIfNeeded();
  expect((await page.getByRole('button', { name: '판단 저장' }).boundingBox())!.height).toBeGreaterThanOrEqual(44);
  await page.getByRole('button', { name: '판단 저장' }).focus();
  await expect(page.getByRole('button', { name: '판단 저장' })).toBeFocused();
  await page.screenshot({ path: testInfo.outputPath('family-review-mobile-actions-320.png'), fullPage: true });
  await page.getByRole('heading', { name: '도윤의 가족 관계 확인' }).scrollIntoViewIfNeeded();
  await page.screenshot({ path: testInfo.outputPath('family-review-mobile-320.png'), fullPage: true });
  await page.getByRole('button', { name: '후보 목록', exact: true }).click();
  await page.goBack();
  await expect(page.getByRole('heading', { name: '도윤의 가족 관계 확인' })).toBeVisible();

  await page.getByRole('button', { name: '선택 취소', exact: true }).click();
  await editDetails(page);
  await page.getByLabel('시점 설명').fill('모바일에서 작성한 시점');
  const save = page.getByRole('button', { name: '변경사항 저장', exact: true });
  await expect(save).toBeEnabled();
  await expect(page.getByRole('button', { name: '최신 설정 불러오기', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: '다시 시도', exact: true })).toHaveCount(0);
  await expect(page.getByRole('checkbox')).toHaveCount(0);
  await expect(page.getByText('설정이 바뀌었나요?', { exact: true })).toHaveCount(0);
  for (const button of [save]) {
    await button.scrollIntoViewIfNeeded();
    await expect(button).toBeVisible();
    const bounds = (await button.boundingBox())!;
    expect(bounds.height).toBeGreaterThanOrEqual(44);
    expect(bounds.x).toBeGreaterThanOrEqual(0);
    expect(bounds.x + bounds.width).toBeLessThanOrEqual(320);
    await expect.poll(() => button.evaluate(element => {
      const channels = (color: string) => (color.match(/[\d.]+/g) ?? []).map(Number);
      const luminance = (values: number[]) => {
        const rgb = values.slice(0, 3).map(value => { const n = value / 255; return n <= .04045 ? n / 12.92 : ((n + .055) / 1.055) ** 2.4; });
        return .2126 * rgb[0] + .7152 * rgb[1] + .0722 * rgb[2];
      };
      let ancestor: Element | null = element;
      let background = [255, 255, 255];
      while (ancestor) {
        const value = channels(getComputedStyle(ancestor).backgroundColor);
        if (value.length === 3 || value[3] === 1) { background = value; break; }
        ancestor = ancestor.parentElement;
      }
      const foreground = luminance(channels(getComputedStyle(element).color));
      const backdrop = luminance(background);
      return (Math.max(foreground, backdrop) + .05) / (Math.min(foreground, backdrop) + .05);
    }), { message: '활성 버튼의 색상 전환 후 글자 대비가 4.5:1 이상이어야 합니다.' }).toBeGreaterThanOrEqual(4.5);
  }
  await page.getByLabel('시점 설명').focus();
  await page.keyboard.press('Tab');
  await expect(save).toBeFocused();
  await page.screenshot({ path: testInfo.outputPath('family-edit-actions-mobile-320.png'), fullPage: true });
  await expect(page.getByRole('button', { name: '근거 선택', exact: true })).toHaveCount(0);
  await expect(page.getByRole('checkbox')).toHaveCount(0);
  await expect(page.getByLabel('시점 설명')).toHaveValue('모바일에서 작성한 시점');
  expect(fixture.calls.mutations).toEqual([]);
  await save.focus();
  await page.keyboard.press('Enter');
  await expect(page.getByText('수정한 내용을 저장했어요.', { exact: false })).toBeVisible();
  expect(fixture.calls.saves).toEqual([expect.objectContaining({ timeLabel: '모바일에서 작성한 시점', assertion: 'UNCERTAIN', expectedVersion: 0 })]);
  expect(fixture.calls.mutations).toEqual([`PUT ${prefix}/relationship-candidates/${candidateId}`]);
  expect(fixture.calls.confirms).toBe(0); expect(fixture.calls.processing).toBe(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBeTruthy();
});

test('이전에 철회한 동일 내용은 명시 반영 한 번으로 다시 검토·확정하고 줄어든 페이지를 복구한다', async ({ page, context }) => {
  const fixture = await setup(context); fixture.held();
  await page.goto(`${editor}&relationPage=9`);
  await expect(page).toHaveURL(/relationPage=1/);
  await expect(page.getByRole('button', { name: '가계도에 반영하기' })).toBeEnabled();
  await expect(page.getByText('이전에 삭제한 연결이에요.', { exact: false })).toBeVisible();
  await page.getByRole('button', { name: '가계도에 반영하기' }).click();
  await expect(page.getByText('확인이 필요한 가족 관계가 없어요.', { exact: true })).toBeVisible();
  expect(fixture.calls.saves[0]).toMatchObject({ expectedVersion: 0, evidence: [{ sourceFactId: factId, sourceToken: oldToken }] });
  expect(fixture.calls.confirmVersions).toEqual([1]);
});

test('처리 버전이 바뀌면 열린 후보의 근거 현재성을 갱신하되 편집 입력은 보존한다', async ({ page, context }) => {
  const fixture = await setup(context); fixture.ready();
  await page.clock.install();
  await page.goto(editor);
  await expect(page.getByRole('button', { name: '가계도에 반영하기' })).toBeEnabled();
  fixture.sourceInvalidated();
  await page.clock.runFor(31000);
  await openEvidence(page);
  await expect(page.getByText('현재 설정이 바뀌었거나 인물이 보관되었어요. 이전 근거를 확인할 수 있어요.', { exact: true })).toBeVisible();
  await expect(page.getByRole('blockquote')).toContainText('아버지 현우');
  await expect(page.getByRole('button', { name: '가계도에 반영하기' })).toBeDisabled();
  await editDetails(page);
  await page.getByLabel('시점 설명').fill('보존할 초안');
  await page.clock.runFor(31000);
  await expect(page.getByLabel('시점 설명')).toHaveValue('보존할 초안');
  await expect(page.getByRole('button', { name: '원문 근거 1' })).toBeEnabled();
});

test('서로 다른 현재 표시값·세부값과 추가 속성을 숨기지 않고 확인할 수 있다', async ({ page, context }) => {
  const fixture = await setup(context); fixture.ready(); fixture.conflictingValues();
  await page.goto(editor);
  const source = page.locator('.family-review-source-caption');
  await expect(source.getByText('표시된 설정', { exact: true })).toBeVisible();
  await expect(source.getByText('세부 설정', { exact: true })).toBeVisible();
  await expect(source.getByText('아버지: 현우', { exact: false })).toBeVisible();
  await expect(source.getByText('아버지: 준서', { exact: false })).toBeVisible();
  await source.getByText('설정의 추가 속성 확인', { exact: true }).click();
  await expect(source.getByText('확인되지 않은 소문', { exact: false })).toBeVisible();
  await expect(source.getByText('추정 가족관계', { exact: false })).toBeVisible();
  await expect(page.getByRole('button', { name: '가계도에 반영하기' })).toBeDisabled();
});

test('정상 인증 갱신 뒤 현재 근거 조회·수정 저장·확정의 성공 결과를 반영한다', async ({ page, context }) => {
  const fixture = await setup(context); fixture.ready(); fixture.sourceChanged();
  fixture.expireNext('GET', 'relationship-sources');
  await page.goto(editor);
  await editDetails(page);
  await page.getByLabel('시점 설명').fill('갱신 중에도 보존할 입력');
  await expect(page.getByRole('checkbox')).toBeVisible();
  await expect(page.getByRole('checkbox')).not.toBeChecked();
  await expect(page.getByLabel('시점 설명')).toHaveValue('갱신 중에도 보존할 입력');
  await page.getByRole('checkbox').check();
  fixture.expireNext('PUT', `relationship-candidates/${candidateId}`);
  await page.getByRole('button', { name: '변경사항 저장' }).click();
  await expect(page.getByRole('button', { name: '가계도에 반영하기' })).toBeEnabled();
  expect(fixture.calls.saves[0]).toMatchObject({ expectedVersion: 0, timeLabel: '갱신 중에도 보존할 입력', evidence: [{ sourceFactId: factId, sourceToken: newToken }] });
  fixture.expireNext('POST', `relationship-candidates/${candidateId}/confirm`);
  await page.getByRole('button', { name: '가계도에 반영하기' }).click();
  await expect(page.getByText('확인이 필요한 가족 관계가 없어요.', { exact: true })).toBeVisible();
  expect(fixture.calls.refreshes).toBe(3);
  expect(fixture.calls.confirms).toBe(1);
  expect(await page.evaluate(() => localStorage.getItem('accessToken'))).toBe('rotated-family-token-3');
});

for (const action of ['관계 정리', '철회', '제외'] as const) {
  test(`정상 인증 갱신 뒤 ${action} 성공 결과와 목록을 반영한다`, async ({ page, context }) => {
    const fixture = await setup(context);
    if (action === '관계 정리') fixture.failed();
    await page.goto(action === '제외' ? editor : workspace);
    if (action === '관계 정리') {
      fixture.expireNext('POST', 'relationship-processing');
      await page.getByRole('button', { name: '관계 정리 다시 시도' }).click();
      await expect(page.getByText('가족 관계를 정리하고 있어요.', { exact: true })).toBeVisible();
      expect(fixture.calls.processing).toBe(1);
    } else if (action === '철회') {
      await page.getByRole('button', { name: '관계 근거 보기' }).click();
      await page.getByRole('button', { name: '이 연결 삭제' }).click();
      fixture.expireNext('POST', `relationships/${relationId}/withdraw`);
      await page.getByRole('button', { name: '삭제하기', exact: true }).click();
      await expect(page.getByText('삭제된 연결', { exact: true })).toBeVisible();
      expect(fixture.calls.withdraws).toBe(1);
    } else {
      fixture.expireNext('POST', `relationship-candidates/${candidateId}/dismiss`);
      await chooseExclusion(page);
      await page.getByRole('button', { name: '판단 저장' }).click();
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

for (const boundary of ['로그아웃 대기', '새 로그인 세션', '작품 화면 이탈', '다른 메뉴 이동'] as const) {
  test(`${boundary} 뒤 늦은 관계 정리 응답이 캐시와 화면을 복원하지 않는다`, async ({ page, context }) => {
    const fixture = await setup(context); fixture.failed();
    await page.goto(workspace);
    await expect(page.getByText('가족 관계 정리를 마치지 못했어요.', { exact: true })).toBeVisible();
    const waiting = fixture.holdNext('POST', 'relationship-processing');
    await page.getByRole('button', { name: '관계 정리 다시 시도' }).click();
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
    } else if (boundary === '작품 화면 이탈') {
      await page.getByRole('button', { name: '작품 선택으로 이동' }).click();
      await expect(page).toHaveURL(/\/works$/);
    } else {
      await page.getByRole('button', { name: '작품 설정', exact: true }).click();
      await expect.poll(() => new URL(page.url()).searchParams.get('nav')).toBe('settingDB');
      await expect(page.getByRole('heading', { name: '캐릭터 설정', exact: true })).toBeVisible();
    }
    const completed = page.waitForResponse(response => new URL(response.url()).pathname === `${prefix}/relationship-processing` && response.request().method() === 'POST');
    waiting.release();
    await completed;
    await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
    expect(await cachedProcessingState(page)).toBe(boundary === '작품 화면 이탈' || boundary === '다른 메뉴 이동' ? 'FAILED' : undefined);
    await expect(page.getByText('가족 관계를 정리하고 있어요.', { exact: true })).toHaveCount(0);
    if (logout) { logout.release(); await expect(page).toHaveURL(/\/landing$/); }
  });
}

test('처리 상태가 같아도 다른 창의 후보 수정을 감지하고 초안·근거를 보존한 채 재검토한다', async ({ page, context }) => {
  const fixture = await setup(context); fixture.ready();
  await page.clock.install();
  await page.goto(editor);
  await editDetails(page);
  await page.getByLabel('시점 설명').fill('이 창에서 작성한 초안');
  const other = await context.newPage();
  await other.goto(editor);
  await editDetails(other);
  await other.getByLabel('시점 설명').fill('다른 창에서 저장한 값');
  await other.getByRole('combobox', { name: '관계', exact: true }).selectOption('SPOUSE');
  await other.getByLabel('관계 시점').selectOption('HISTORICAL');
  await other.getByRole('button', { name: '변경사항 저장' }).click();
  await expect(other.getByText('수정한 내용을 저장했어요.', { exact: false })).toBeVisible();
  await page.bringToFront();
  await page.clock.runFor(6000);
  await expect(page.getByLabel('최신 관계 변경 내용', { exact: true })).toBeVisible();
  await expect(page.getByLabel('시점 설명')).toHaveValue('이 창에서 작성한 초안');
  await expect(page.getByRole('button', { name: '변경사항 저장' })).toBeDisabled();
  await expect(page.getByRole('button', { name: '가계도에 반영하기' })).toBeDisabled();
  await expect(page.getByRole('button', { name: '판단 변경', exact: true })).toBeDisabled();
  expect(fixture.calls.processing).toBe(0);
  await expect(page.getByLabel('최신 관계 변경 내용', { exact: true })).toContainText('다른 창에서 저장한 값');
  await expect(page.getByText('최신 관계와 근거를 확인하고 있어요.', { exact: true })).toHaveCount(0);
  const readsBeforeAccept = { candidates: fixture.calls.candidateReads, sources: fixture.calls.sourceReads.length };
  await page.getByRole('button', { name: '변경 내용 확인', exact: true }).click();
  await expect(page.getByLabel('시점 설명')).toHaveValue('이 창에서 작성한 초안');
  await expect(page.getByRole('combobox', { name: '관계', exact: true })).toHaveValue('SPOUSE');
  await expect(page.getByLabel('관계 시점')).toHaveValue('HISTORICAL');
  expect({ candidates: fixture.calls.candidateReads, sources: fixture.calls.sourceReads.length }).toEqual(readsBeforeAccept);
  await expect(page.getByRole('button', { name: '근거 선택', exact: true })).toHaveCount(0);
  await expect(page.getByRole('checkbox')).toHaveCount(0);
  await page.getByRole('button', { name: '변경사항 저장' }).click();
  await expect(page.getByRole('button', { name: '가계도에 반영하기' })).toBeEnabled();
  expect(fixture.calls.saves[1]).toMatchObject({ expectedVersion: 1, kind: 'SPOUSE', subtype: 'UNSPECIFIED', temporalScope: 'HISTORICAL', timeLabel: '이 창에서 작성한 초안', evidence: [{ sourceFactId: factId, sourceToken: oldToken }] });
  await other.close();
});

test('처리 상태가 같아도 다른 창의 후보 확정을 감지해 중복 결정을 잠근다', async ({ page, context }) => {
  const fixture = await setup(context); fixture.ready();
  await page.clock.install();
  await page.goto(editor);
  await expect(page.getByRole('button', { name: '가계도에 반영하기' })).toBeEnabled();
  const other = await context.newPage();
  await other.goto(editor);
  await other.getByRole('button', { name: '가계도에 반영하기' }).click();
  await expect(other.getByText('확인이 필요한 가족 관계가 없어요.', { exact: true })).toBeVisible();
  await page.bringToFront();
  await page.clock.runFor(6000);
  await expect(page.getByLabel('최신 관계 변경 내용', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: '가계도에 반영하기' })).toBeDisabled();
  await page.getByRole('button', { name: '변경 내용 확인', exact: true }).click();
  await expect(page.getByText('이미 반영된 후보예요.', { exact: false })).toBeVisible();
  expect(fixture.calls.confirms).toBe(1);
  expect(fixture.calls.processing).toBe(0);
  await other.close();
});

test('숨겨진 창은 후보 주기 조회를 멈추고 돌아오면 즉시 외부 변경을 확인한다', async ({ page, context }) => {
  const fixture = await setup(context); fixture.ready();
  await page.clock.install();
  await page.goto(editor);
  await editDetails(page);
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
  await expect(page.getByLabel('최신 관계 변경 내용', { exact: true })).toBeVisible();
  await expect(page.getByLabel('시점 설명')).toHaveValue('창 복귀 후에도 남을 초안');
  await expect(page.getByRole('button', { name: '변경사항 저장' })).toBeDisabled();
});

test('사이드바 관계도에서 가계도를 선택해 현재 가족 관계와 후보를 연다', async ({ page, context }) => {
  await setup(context);
  await page.goto(settings);
  await expect(page.getByRole('heading', { name: '캐릭터 설정', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: '가족 관계', exact: true })).toHaveCount(0);
  await expect(page.locator('.dashboard-tabs').getByRole('button', { name: /^관계도/ })).toHaveCount(0);
  const navigation = page.getByRole('button', { name: '관계도', exact: true });
  await expect(navigation).toBeVisible();
  await expect(navigation).not.toContainText('업데이트 예정');
  await navigation.click();
  await expect.poll(() => new URL(page.url()).searchParams.get('nav')).toBe('graph');
  expect(new URL(page.url()).searchParams.has('tab')).toBeFalsy();
  await expect(navigation).toHaveClass(/is-active/);
  await expect(page.getByRole('tab', { name: '인물 관계도', exact: true })).toHaveAttribute('aria-selected', 'true');
  await page.getByRole('tab', { name: '가계도', exact: true }).click();
  await expect(page.getByRole('button', { name: '가족 관계 목록', exact: true })).toBeVisible();
  await page.getByRole('button', { name: '확인·연결 1', exact: true }).click();
  await page.getByRole('button', { name: '도윤 가족 현우 관계 확인', exact: true }).click();
  await expect(page.getByRole('heading', { name: '도윤의 가족 관계 확인', exact: true })).toBeVisible();
  expect(new URL(page.url()).searchParams.get('relationshipCandidate')).toBe(candidateId);
});

for (const selection of ['후보', '관계'] as const) {
  test(`기존 가족 관계 링크의 ${selection}·페이지·원문 선택을 관계도로 옮기고 이전 기록을 대체한다`, async ({ page, context }) => {
    await setup(context);
    await page.goto('/works');
    await expect(page.getByRole('button', { name: '사용자 메뉴 열기' })).toBeVisible();
    const selected = selection === '후보'
      ? `relationView=review&relationshipCandidate=${candidateId}`
      : `relationView=list&relationshipId=${relationId}`;
    await page.goto(`${legacyWorkspace}&${selected}&relationPage=1&relationshipFactId=${factId}`);
    await expect.poll(() => new URL(page.url()).searchParams.get('nav')).toBe('graph');
    const params = new URL(page.url()).searchParams;
    expect(params.get('workId')).toBe(workId);
    expect(params.has('tab')).toBeFalsy();
    expect(params.get('relationView')).toBe(selection === '후보' ? 'review' : 'list');
    expect(params.get(selection === '후보' ? 'relationshipCandidate' : 'relationshipId')).toBe(selection === '후보' ? candidateId : relationId);
    expect(params.get('relationPage')).toBe('1');
    expect(params.get('relationshipFactId')).toBe(factId);
    await expect(page.getByRole('dialog')).toContainText('아버지 현우');
    await page.keyboard.press('Escape');
    if (selection === '후보') await expect(page.getByRole('heading', { name: '도윤의 가족 관계 확인', exact: true })).toBeVisible();
    else await expect(page.getByRole('button', { name: '관계 근거 접기', exact: true })).toBeVisible();
    await page.reload();
    await expect.poll(() => new URL(page.url()).searchParams.get('nav')).toBe('graph');
    expect(new URL(page.url()).searchParams.get(selection === '후보' ? 'relationshipCandidate' : 'relationshipId')).toBe(selection === '후보' ? candidateId : relationId);
    await page.goBack();
    await expect(page).toHaveURL(/\/works$/);
  });
}

test('후보 초안 저장 중 다른 메뉴로 이동하면 늦은 성공이 검토 화면과 선택을 복원하지 않는다', async ({ page, context }) => {
  const fixture = await setup(context); fixture.ready();
  await page.goto(editor);
  await editDetails(page);
  await page.getByLabel('시점 설명').fill('이전 검토 화면에서 작성한 초안');
  const waiting = fixture.holdNext('PUT', `relationship-candidates/${candidateId}`);
  await page.getByRole('button', { name: '변경사항 저장' }).click();
  await waiting.received;
  await page.getByRole('button', { name: '작품 설정', exact: true }).click();
  await expect(page.getByRole('heading', { name: '캐릭터 설정', exact: true })).toBeVisible();
  await expect.poll(() => new URL(page.url()).searchParams.get('nav')).toBe('settingDB');
  expect(new URL(page.url()).searchParams.has('relationshipCandidate')).toBeFalsy();
  const completed = page.waitForResponse(response => new URL(response.url()).pathname === `${prefix}/relationship-candidates/${candidateId}` && response.request().method() === 'PUT');
  waiting.release();
  await completed;
  await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
  expect(new URL(page.url()).searchParams.get('nav')).toBe('settingDB');
  await expect(page.getByLabel('시점 설명')).toHaveCount(0);
  await expect(page.getByText('수정한 내용을 저장했어요.', { exact: false })).toHaveCount(0);
  expect(fixture.calls.saves[0]).toMatchObject({ timeLabel: '이전 검토 화면에서 작성한 초안', expectedVersion: 0 });
  await page.getByRole('button', { name: '관계도', exact: true }).click();
  await expect.poll(() => new URL(page.url()).searchParams.get('nav')).toBe('graph');
  expect(new URL(page.url()).searchParams.has('relationshipCandidate')).toBeFalsy();
  await expect(page.getByRole('heading', { name: '도윤의 가족 관계 확인', exact: true })).toHaveCount(0);
});

test('새 로그인 세션 뒤 늦은 판단 저장 응답은 이전 후보 캐시와 성공 안내를 복원하지 않는다', async ({ page, context }) => {
  const fixture = await setup(context); fixture.ready();
  await page.clock.install();
  await page.goto(editor);
  await chooseJudgment(page, '아직 모르겠어요');
  const waiting = fixture.holdNext('PUT', `relationship-candidates/${candidateId}`);
  await page.getByRole('button', { name: '판단 저장', exact: true }).click();
  await waiting.received;
  await page.evaluate(async () => {
    const { saveAuthToken } = await import('/src/app/lib/auth.ts');
    const { queryClient } = await import('/src/app/lib/query-client.ts');
    saveAuthToken({ success: true, data: { accessToken: 'synthetic-family-token' } });
    queryClient.clear();
  });
  const saved = page.waitForResponse(response => response.request().method() === 'PUT'
    && new URL(response.url()).pathname === `${prefix}/relationship-candidates/${candidateId}`);
  waiting.release(); await saved;
  await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
  const cached = await page.evaluate(async ({ workId, candidateId }) => {
    const { queryClient } = await import('/src/app/lib/query-client.ts');
    const { getRelationshipCandidateQueryKey } = await import('/src/app/api/generated/@tanstack/react-query.gen.ts');
    return queryClient.getQueryData(getRelationshipCandidateQueryKey({ path: { workId, candidateId } }));
  }, { workId, candidateId });
  expect(cached).toBeUndefined();
  await expect(page.getByText('판단을 보류했어요.', { exact: false })).toHaveCount(0);
  expect(fixture.calls.saves).toHaveLength(1); expect(fixture.calls.confirms).toBe(0); expect(fixture.calls.dismisses).toBe(0);
});

test('한 번에 반영하는 중 저장 응답 전에 화면을 떠나면 뒤늦게 관계 확정을 실행하지 않는다', async ({ page, context }) => {
  const fixture = await setup(context); fixture.ready();
  await page.goto(editor);
  await editDetails(page);
  await page.getByLabel('시점 설명').fill('화면을 떠나기 전에 선택한 값');
  const waiting = fixture.holdNext('PUT', `relationship-candidates/${candidateId}`);
  await page.getByRole('button', { name: '가계도에 반영하기', exact: true }).click();
  await waiting.received;
  await page.getByRole('button', { name: '작품 설정', exact: true }).click();
  await expect(page.getByRole('heading', { name: '캐릭터 설정', exact: true })).toBeVisible();
  const completed = page.waitForResponse(response => new URL(response.url()).pathname === `${prefix}/relationship-candidates/${candidateId}` && response.request().method() === 'PUT');
  waiting.release();
  await completed;
  await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
  expect(fixture.calls.saves).toHaveLength(1); expect(fixture.calls.confirms).toBe(0);
  expect(new URL(page.url()).searchParams.get('nav')).toBe('settingDB');
  expect(new URL(page.url()).searchParams.has('relationshipCandidate')).toBe(false);
  await expect(page.getByRole('heading', { name: '도윤의 가족 관계 확인', exact: true })).toHaveCount(0);
});

for (const state of ['NEVER_PROCESSED', 'PENDING', 'SUCCEEDED'] as const) {
  test(`미리보기의 ${state} 상태는 일반 관계 찾기나 재시도 버튼을 노출하지 않는다`, async ({ page, context }) => {
    const fixture = await setup(context); fixture.processingState(state);
    await page.goto(workspace);
    await expect(page.getByRole('tablist', { name: '관계도 종류', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: '확인·연결 1', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: '현재 설정에서 관계 찾기', exact: true })).toHaveCount(0);
    await expect(page.getByRole('button', { name: '관계 정리 다시 시도', exact: true })).toHaveCount(0);
    expect(fixture.calls.processing).toBe(0);
    expect(fixture.calls.analyses).toBe(0);
    expect(fixture.calls.processingReads).toBeGreaterThan(0);
    if (state === 'SUCCEEDED') {
      await expect(page.getByText('최근 가족 관계 정리 결과', { exact: true })).toHaveCount(0);
      await expect(page.getByText('현재 설정의 가족 관계를 정리했어요.', { exact: true })).toHaveCount(0);
    }
  });
}

test('현재 20개 목록 밖의 직접 연결 관계도 인물·종류·시점·상태를 확인한 뒤 철회한다', async ({ page, context }, testInfo) => {
  const fixture = await setup(context); fixture.offPageRelationship();
  await page.goto(`${workspace}&relationshipId=${relationId}`);
  await expect(page.getByRole('button', { name: '관계 근거 보기', exact: true })).toHaveCount(20);
  const selected = page.getByRole('article').filter({ has: page.getByRole('button', { name: '원문 근거 1', exact: true }) });
  await expect(selected.getByRole('button', { name: '원문 근거 1', exact: true })).toBeVisible();
  await expect(selected.getByRole('heading', { name: /현우.*도윤/ })).toBeVisible();
  for (const text of ['부모', '자녀', '입양', '과거 관계', '10년 전']) {
    await expect(selected.getByText(text, { exact: true })).toBeVisible();
  }
  await expect(selected.getByText('보관된 인물 포함', { exact: true })).toBeVisible();
  const identified = page.getByRole('article').filter({ has: page.getByRole('heading', { name: /현우.*도윤/ }) });
  await identified.screenshot({ path: testInfo.outputPath('off-page-relationship-summary.png') });
  await identified.getByRole('button', { name: '이 연결 삭제', exact: true }).click();
  await identified.getByRole('button', { name: '삭제하기', exact: true }).click();
  await expect(identified.getByText('삭제된 연결', { exact: true })).toBeVisible();
  expect(fixture.calls.withdraws).toBe(1);
});

for (const decision of ['확정', '제외'] as const) {
  test(`자동 처리 상태가 같아도 다른 창의 ${decision} 후 검토 목록과 현재 대기 개수가 함께 갱신된다`, async ({ page, context }) => {
    const fixture = await setup(context); fixture.ready();
    await page.clock.install();
    await page.goto(`${treeWorkspace}&relationView=review`);
    await expect(page.getByRole('button', { name: '확인·연결 1', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: '도윤 가족 현우 관계 확인', exact: true })).toBeVisible();
    const other = await context.newPage();
    await other.goto(editor);
    if (decision === '제외') await chooseExclusion(other);
    await other.getByRole('button', { name: decision === '확정' ? '가계도에 반영하기' : '판단 저장', exact: true }).click();
    await expect(other.getByText('확인이 필요한 가족 관계가 없어요.', { exact: true })).toBeVisible();
    await page.bringToFront();
    await page.clock.runFor(6000);
    await expect(page.getByRole('button', { name: '확인·연결 0', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: '도윤 가족 현우 관계 확인', exact: true })).toHaveCount(0);
    await expect(page.getByText('확인이 필요한 가족 관계가 없어요.', { exact: true })).toBeVisible();
    expect(fixture.calls.processing).toBe(0);
    expect(fixture.calls.confirms).toBe(decision === '확정' ? 1 : 0);
    expect(fixture.calls.dismisses).toBe(decision === '제외' ? 1 : 0);
    await other.close();
  });
}

test('관계 목록을 보면서도 다른 창의 후보 제외를 대기 개수에 반영하며 숨겨진 검토 목록은 조회하지 않는다', async ({ page, context }) => {
  const fixture = await setup(context);
  let reviewListReads = 0;
  page.on('request', request => {
    const url = new URL(request.url());
    if (url.pathname === `${prefix}/relationship-candidates` && url.searchParams.get('size') === '20') reviewListReads++;
  });
  await page.clock.install();
  await page.goto(workspace);
  await expect(page.getByRole('button', { name: '확인·연결 1', exact: true })).toBeVisible();
  const other = await context.newPage();
  await other.goto(editor);
  await chooseExclusion(other);
  await other.getByRole('button', { name: '판단 저장', exact: true }).click();
  await expect(other.getByText('확인이 필요한 가족 관계가 없어요.', { exact: true })).toBeVisible();
  await page.bringToFront();
  await page.clock.runFor(6000);
  await expect(page.getByRole('button', { name: '확인·연결 0', exact: true })).toBeVisible();
  expect(reviewListReads).toBe(0);
  expect(fixture.calls.processing).toBe(0);
  await other.close();
});

test('숨겨진 검토 목록은 조회를 쉬고 창 복귀 때 다른 창의 제외와 줄어든 마지막 페이지를 복구한다', async ({ page, context }) => {
  const fixture = await setup(context); fixture.pendingSecondPage();
  let candidateListReads = 0;
  page.on('request', request => {
    if (new URL(request.url()).pathname === `${prefix}/relationship-candidates`) candidateListReads++;
  });
  await page.clock.install();
  await page.goto(`${treeWorkspace}&relationView=review&relationPage=2`);
  await expect(page.getByRole('button', { name: '확인·연결 21', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: '도윤 가족 현우 관계 확인', exact: true })).toBeVisible();
  await page.evaluate(() => {
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' });
    window.dispatchEvent(new Event('visibilitychange'));
  });
  const other = await context.newPage();
  await other.goto(editor);
  await chooseExclusion(other);
  await other.getByRole('button', { name: '판단 저장', exact: true }).click();
  await expect(other.getByRole('button', { name: '확인·연결 20', exact: true })).toBeVisible();
  const readsWhileHidden = candidateListReads;
  await page.clock.runFor(6000);
  expect(candidateListReads).toBe(readsWhileHidden);
  expect(new URL(page.url()).searchParams.get('relationPage')).toBe('2');
  await expect(page.getByRole('button', { name: '확인·연결 21', exact: true })).toBeVisible();
  await page.bringToFront();
  const refetched = page.waitForResponse(response => {
    const url = new URL(response.url());
    return url.pathname === `${prefix}/relationship-candidates` && url.searchParams.get('size') === '20';
  }, { timeout: 1500 });
  await page.evaluate(() => {
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'visible' });
    window.dispatchEvent(new Event('visibilitychange'));
  });
  await refetched;
  await expect(page.getByRole('button', { name: '확인·연결 20', exact: true })).toBeVisible();
  await expect.poll(() => new URL(page.url()).searchParams.get('relationPage')).toBe('1');
  await expect(page.getByRole('region', { name: '확인이 필요한 관계', exact: true }).getByRole('listitem')).toHaveCount(20);
  await expect(page.getByRole('button', { name: '도윤 가족 남은 상대 1 관계 확인', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: '도윤 가족 현우 관계 확인', exact: true })).toHaveCount(0);
  expect(fixture.calls.processing).toBe(0);
  await other.close();
});

test('다른 창의 확정과 철회가 관계 목록과 열린 상세에 반영되어 낡은 철회 액션이 사라진다', async ({ page, context }) => {
  const fixture = await setup(context); fixture.ready(); fixture.waitForRelationshipConfirmation();
  await page.clock.install();
  await page.goto(workspace);
  await expect(page.getByText('아직 반영된 가족 관계가 없어요.', { exact: true })).toBeVisible();
  const other = await context.newPage();
  await other.goto(editor);
  await other.getByRole('button', { name: '가계도에 반영하기', exact: true }).click();
  await expect(other.getByText('확인이 필요한 가족 관계가 없어요.', { exact: true })).toBeVisible();
  await page.bringToFront();
  await page.clock.runFor(6000);
  await expect(page.locator(`.family-relation-row[data-relationship-id="${relationId}"]`).getByText('도윤', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: '관계 근거 보기', exact: true }).click();
  await expect(page.getByRole('button', { name: '이 연결 삭제', exact: true })).toBeVisible();
  await other.getByRole('button', { name: '가족 관계 목록', exact: true }).click();
  await other.getByRole('button', { name: '관계 근거 보기', exact: true }).click();
  await other.getByRole('button', { name: '이 연결 삭제', exact: true }).click();
  await other.getByRole('button', { name: '삭제하기', exact: true }).click();
  await expect(other.getByText('삭제된 연결', { exact: true })).toBeVisible();
  await page.bringToFront();
  await page.clock.runFor(6000);
  await expect(page.getByText('삭제된 연결', { exact: true })).toBeVisible();
  await expect(page.getByText('삭제된 연결이에요.', { exact: false })).toBeVisible();
  await expect(page.getByRole('button', { name: '이 연결 삭제', exact: true })).toHaveCount(0);
  expect(fixture.calls.processing).toBe(0);
  expect(fixture.calls.withdraws).toBe(1);
  await other.close();
});

test('목록 밖 열린 관계도 창 복귀 시 다른 창의 철회를 확인하고 상태와 액션을 함께 갱신한다', async ({ page, context }) => {
  const fixture = await setup(context); fixture.offPageRelationship();
  const link = `${workspace}&relationshipId=${relationId}`;
  const relationReads: string[] = [];
  page.on('request', request => {
    const path = new URL(request.url()).pathname;
    if (request.method() === 'GET' && (path === `${prefix}/relationships` || path === `${prefix}/relationships/${relationId}`)) relationReads.push(path);
  });
  await page.clock.install();
  await page.goto(link);
  await expect(page.getByRole('button', { name: '이 연결 삭제', exact: true })).toBeVisible();
  await page.evaluate(() => {
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' });
    window.dispatchEvent(new Event('visibilitychange'));
  });
  const other = await context.newPage();
  await other.goto(link);
  await other.getByRole('button', { name: '이 연결 삭제', exact: true }).click();
  await other.getByRole('button', { name: '삭제하기', exact: true }).click();
  await expect(other.getByText('삭제된 연결', { exact: true })).toBeVisible();
  const hiddenReads = relationReads.length;
  await page.clock.runFor(6000);
  expect(relationReads).toHaveLength(hiddenReads);
  await expect(page.getByText('보관된 인물 포함', { exact: true })).toBeVisible();
  await page.bringToFront();
  const refetched = page.waitForResponse(response => new URL(response.url()).pathname === `${prefix}/relationships/${relationId}`, { timeout: 1500 });
  await page.evaluate(() => {
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'visible' });
    window.dispatchEvent(new Event('visibilitychange'));
  });
  await refetched;
  const selected = page.getByRole('article').filter({ has: page.getByRole('heading', { name: /현우.*도윤/ }) });
  await expect(selected.getByText('삭제된 연결', { exact: true })).toBeVisible();
  await expect(selected.getByRole('button', { name: '이 연결 삭제', exact: true })).toHaveCount(0);
  await expect(selected.getByRole('button', { name: '원문 근거 1', exact: true })).toBeEnabled();
  expect(fixture.calls.processing).toBe(0);
  await other.close();
});

test('자기 저장 성공은 후속 조회 실패나 늦은 구버전 GET으로 잠기지 않고 실제 새 버전 변경은 감지한다', async ({ page, context }) => {
  const fixture = await setup(context); fixture.ready();
  await page.clock.install();
  await page.goto(editor);
  await expect(page.getByRole('button', { name: '가계도에 반영하기', exact: true })).toBeEnabled();
  const oldRead = fixture.holdNext('GET', `relationship-candidates/${candidateId}`);
  await page.clock.runFor(5100);
  await oldRead.received;
  fixture.failCandidateReads(true);
  await editDetails(page);
  await page.getByLabel('시점 설명').fill('저장한 현재 초안');
  await page.getByRole('button', { name: '변경사항 저장', exact: true }).click();
  await expect(page.getByText('수정한 내용을 저장했어요.', { exact: false })).toBeVisible();
  await expect(page.getByRole('button', { name: '가계도에 반영하기', exact: true })).toBeEnabled();
  await expect(page.getByLabel('시점 설명')).toBeEnabled();
  await expect(page.getByLabel('최신 관계 변경 내용', { exact: true })).toHaveCount(0);
  await page.clock.runFor(1500);
  await expect(page.getByText('확인할 관계를 불러오지 못했어요.', { exact: true })).toBeVisible();
  oldRead.release();
  await page.clock.runFor(100);
  await expect(page.getByRole('button', { name: '가계도에 반영하기', exact: true })).toBeEnabled();
  await editDetails(page);
  await page.getByLabel('시점 설명').fill('이어서 작성한 초안');
  fixture.failCandidateReads(false); fixture.otherChanged();
  await page.clock.runFor(6000);
  await expect(page.getByLabel('최신 관계 변경 내용', { exact: true })).toBeVisible();
  await expect(page.getByLabel('시점 설명')).toHaveValue('이어서 작성한 초안');
  await expect(page.getByRole('button', { name: '변경사항 저장', exact: true })).toBeDisabled();
});

test('자동 조회한 변경 내용을 확인할 때 다음 상세 GET을 기다리지 않고 초안과 선택 근거를 유지한다', async ({ page, context }) => {
  const fixture = await setup(context); fixture.ready();
  await page.clock.install();
  await page.goto(editor);
  await expect(page.getByRole('button', { name: '가계도에 반영하기', exact: true })).toBeEnabled();
  await editDetails(page);
  await page.getByLabel('시점 설명').fill('재확인 중 보존할 초안');
  fixture.otherChanged();
  await page.clock.runFor(5100);
  await expect(page.getByRole('button', { name: '변경 내용 확인', exact: true })).toBeVisible();
  await expect(page.getByText('최신 관계와 근거를 확인하고 있어요.', { exact: true })).toHaveCount(0);
  const followup = fixture.holdNext('GET', `relationship-candidates/${candidateId}`);
  await page.clock.runFor(5100);
  await followup.received;
  const readsBeforeAccept = { candidates: fixture.calls.candidateReads, sources: fixture.calls.sourceReads.length };
  await page.getByRole('button', { name: '변경 내용 확인', exact: true }).click();
  await expect(page.getByLabel('시점 설명')).toBeEnabled();
  await expect(page.getByLabel('시점 설명')).toHaveValue('재확인 중 보존할 초안');
  await expect(page.getByRole('button', { name: '변경사항 저장', exact: true })).toBeEnabled();
  await expect(page.getByLabel('최신 관계 변경 내용', { exact: true })).toHaveCount(0);
  expect({ candidates: fixture.calls.candidateReads, sources: fixture.calls.sourceReads.length }).toEqual(readsBeforeAccept);
  expect(fixture.calls.mutations).toEqual([]);
  followup.release();
  await page.getByRole('button', { name: '변경사항 저장', exact: true }).click();
  await expect(page.getByRole('button', { name: '가계도에 반영하기', exact: true })).toBeEnabled();
  expect(fixture.calls.saves[0]).toMatchObject({ expectedVersion: 1, timeLabel: '재확인 중 보존할 초안', evidence: [{ sourceFactId: factId, sourceToken: oldToken }] });
});

test('느린 이전 자동 조회는 더 높은 후보 버전과 근거를 덮지 않고 최신 변경 확인 뒤에만 저장한다', async ({ page, context }) => {
  const fixture = await setup(context); fixture.ready();
  await page.clock.install();
  await page.goto(editor);
  await expect(page.getByRole('button', { name: '가계도에 반영하기', exact: true })).toBeEnabled();
  await editDetails(page);
  await page.getByLabel('시점 설명').fill('내가 작성한 시점');
  fixture.pair({ timeLabel: '먼저 변경한 값' }); fixture.otherChanged();
  const older = fixture.holdNext('GET', `relationship-candidates/${candidateId}`, 1);
  await page.clock.runFor(5100); await older.received;
  fixture.pair({ timeLabel: '가장 최근에 변경한 값' }); fixture.otherChanged();
  await page.clock.runFor(5100);
  const changes = page.getByLabel('최신 관계 변경 내용', { exact: true });
  await expect(changes).toContainText('가장 최근에 변경한 값');
  await expect(page.getByText('최신 관계와 근거를 확인하고 있어요.', { exact: true })).toHaveCount(0);
  older.release(); await page.clock.runFor(100);
  await expect(changes).toContainText('가장 최근에 변경한 값');
  await expect(page.getByRole('button', { name: '변경사항 저장', exact: true })).toBeDisabled();
  expect(fixture.calls.mutations).toEqual([]);
  await page.getByRole('button', { name: '변경 내용 확인', exact: true }).click();
  await expect(page.getByLabel('시점 설명')).toHaveValue('내가 작성한 시점');
  await page.getByRole('button', { name: '변경사항 저장', exact: true }).click();
  await expect(page.getByText('수정한 내용을 저장했어요.', { exact: false })).toBeVisible();
  expect(fixture.calls.saves[0]).toMatchObject({ expectedVersion: 2, timeLabel: '내가 작성한 시점', evidence: [{ sourceFactId: factId, sourceToken: oldToken }] });
});

test('다른 창의 가족 판단을 채택해도 명시적으로 고른 모름 판단과 내 초안은 유지한다', async ({ page, context }) => {
  const fixture = await setup(context);
  await page.clock.install();
  await page.goto(editor);
  await chooseJudgment(page, '아직 모르겠어요');
  await editDetails(page);
  await page.getByLabel('시점 설명').fill('내가 아직 판단하지 않은 관계');
  fixture.ready(); fixture.otherChanged();
  await page.clock.runFor(5100);
  await page.getByRole('button', { name: '변경 내용 확인', exact: true }).click();
  await expect(page.getByRole('button').filter({ has: page.getByText('아직 모르겠어요', { exact: true }) })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('combobox', { name: '서술의 의미', exact: true })).toHaveCount(0);
  await expect(page.locator('.relationship-pair-preview')).toHaveAttribute('data-uncertain', 'true');
  await expect(page.getByLabel('시점 설명')).toHaveValue('내가 아직 판단하지 않은 관계');
  await expect(page.getByRole('button', { name: '가계도에 반영하기', exact: true })).toBeDisabled();
  expect(fixture.calls.saves).toHaveLength(0); expect(fixture.calls.confirms).toBe(0);
  await page.getByRole('button', { name: '판단 저장', exact: true }).click();
  await expect(page.getByText('아직 모르는 관계예요', { exact: true })).toBeVisible();
  expect(fixture.calls.saves[0]).toMatchObject({ expectedVersion: 1, assertion: 'UNCERTAIN', evidence: [{ sourceFactId: factId, sourceToken: oldToken }] });
});

test('재시도 요청 오류는 FAILED 조회 때 유지하고 이후 PENDING 또는 SUCCEEDED 확인으로 해소된다', async ({ page, context }) => {
  const fixture = await setup(context); fixture.failed(); fixture.failProcessing();
  await page.clock.install();
  await page.goto(workspace);
  const failureMessage = page.getByText('관계 정리 요청 결과를 확인하지 못했어요.', { exact: true });
  const finishProcessing = async (milliseconds: number) => {
    fixture.processingState('SUCCEEDED');
    const response = page.waitForResponse(result => result.request().method() === 'GET'
      && new URL(result.url()).pathname === `${prefix}/relationship-processing`);
    await page.clock.runFor(milliseconds);
    expect((await (await response).json()).data.state).toBe('SUCCEEDED');
    await expect(page.getByText('최근 가족 관계 정리 결과', { exact: true })).toHaveCount(0);
    await expect(page.getByText('현재 설정의 가족 관계를 정리했어요.', { exact: true })).toHaveCount(0);
    await expect(page.getByText('가족 관계를 정리하고 있어요.', { exact: true })).toHaveCount(0);
  };
  await page.getByRole('button', { name: '관계 정리 다시 시도', exact: true }).click();
  await expect(failureMessage).toBeVisible();
  await page.clock.runFor(31000);
  await expect(failureMessage).toBeVisible();
  fixture.processingState('PENDING');
  await page.clock.runFor(31000);
  await expect(page.getByText('가족 관계를 정리하고 있어요.', { exact: true })).toBeVisible();
  await expect(failureMessage).toHaveCount(0);
  await finishProcessing(3100);
  fixture.failed(); fixture.failProcessing();
  await page.clock.runFor(31000);
  await page.getByRole('button', { name: '관계 정리 다시 시도', exact: true }).click();
  await expect(failureMessage).toBeVisible();
  await finishProcessing(31000);
  await expect(failureMessage).toHaveCount(0);
  fixture.failed(); fixture.failProcessing();
  await page.clock.runFor(31000);
  const lateFailure = fixture.holdNext('POST', 'relationship-processing');
  await page.getByRole('button', { name: '관계 정리 다시 시도', exact: true }).click();
  await lateFailure.received;
  await finishProcessing(31000);
  const failedResponse = page.waitForResponse(response => response.request().method() === 'POST' && new URL(response.url()).pathname === `${prefix}/relationship-processing`);
  lateFailure.release();
  await failedResponse;
  await page.clock.runFor(100);
  await expect(failureMessage).toHaveCount(0);
  expect(fixture.calls.processing).toBe(3);
});
