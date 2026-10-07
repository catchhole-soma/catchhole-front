import { expect, test, type Page } from '@playwright/test';

const workId = '11111111-1111-4111-8111-111111111111';
const characterId = '22222222-2222-4222-8222-222222222222';
const batchId = '33333333-3333-4333-8333-333333333333';
const candidateId = '44444444-4444-4444-8444-444444444444';
const skillName = '월광 스킬'; // 작가가 붙인 이름은 분류 제목과 별개로 보존한다.

async function mockWork(page: Page, genre: string) {
  const setting = (prefix: string, name: string, value: string, valueType = 'JSON') => ({
    key: `${prefix}.${name}`, displayName: name, value, valueType, properties: [],
    attributeNameEditable: true, attributeNamePrefix: `${prefix}.`, displayNameEditable: true,
  });
  const character = {
    id: characterId, name: '검증 인물', profile: [],
    stats: [setting('stats', '집중력', '12', 'NUMBER')],
    skills: [setting('skill', skillName, '원고에서 명시한 기술')],
    items: [setting('item', '아이템 상자', '소유 중')], statuses: [],
  };
  const fact = {
    characterFactId: candidateId, characterId, characterName: character.name,
    factType: 'SKILL', factTypeLabel: '스킬', factKey: `skill.${skillName}`,
    displayName: skillName, factValue: '원고에서 명시한 기술', sourceType: 'MANUAL',
  };
  const candidate = {
    id: candidateId, workId, episodeNo: 1, entityType: 'CHARACTER', entityName: character.name,
    matchedCharacterId: characterId, matchStatus: 'MATCHED', candidateKind: 'SETTING',
    attributeName: `skill.${skillName}`, attributeDisplayName: skillName,
    attributeNameEditable: true, attributeNamePrefix: 'skill.', attributeValue: fact.factValue,
    valueType: 'JSON', evidenceSpans: [], reviewStatus: 'PENDING_REVIEW',
    comparisonStatus: 'COMPLETED', suggestedOperation: 'ADD', comparisonRevision: 'genre-review',
  };
  const work = { id: workId, title: '장르 검증 작품', genre, latestEpisodeNo: 1, lifecycleStatus: 'ACTIVE' };
  const pageOf = (content: unknown[]) => ({ content, page: 0, size: 20, totalElements: content.length, totalPages: 1, hasNext: false });
  await page.route('**/api/v1/**', route => {
    const path = new URL(route.request().url()).pathname;
    let data: unknown = [];
    if (path.endsWith('/auth/me')) data = { id: 1, email: 'genre@example.invalid', displayName: '검증', role: 'AUTHOR', status: 'ACTIVE' };
    else if (path === '/api/v1/works') data = [work];
    else if (path === `/api/v1/works/${workId}`) data = work;
    else if (path.endsWith('/characters')) data = pageOf([character]);
    else if (path.endsWith(`/characters/${characterId}`)) data = character;
    else if (path.endsWith('/character-facts/search')) data = pageOf([fact]);
    else if (path.endsWith(`/character-facts/${candidateId}`)) data = fact;
    else if (path.endsWith('/timeline/summary')) data = {
      totalFactCount: 1, filteredFactCount: 1, episodes: [], manualFactCount: 1,
      factTypeCounts: [{ factType: 'SKILL', factTypeLabel: '스킬', count: 1 }],
      factFacets: [{ factType: 'SKILL', factTypeLabel: '스킬', count: 1, factKeys: [] }],
    };
    else if (path.endsWith('/timeline')) data = { content: [fact], hasNext: false, nextCursor: null };
    else if (path.endsWith('/setting-candidates')) data = {
      batchId, episodeStartNo: 1, episodeEndNo: 1, episodeCount: 1,
      totalCandidateCount: 1, pendingCandidateCount: 1, reviewedCandidateCount: 0, matchRequiredCandidateCount: 0,
      groups: pageOf([{ groupKey: 'genre-character', entityName: character.name, candidateCount: 1, candidates: [candidate] }]),
    };
    else if (path.endsWith('/world-setting-candidates')) data = {
      batchId, totalCandidateCount: 0, pendingCandidateCount: 0, reviewedCandidateCount: 0,
      pendingComparisonCount: 0, processingComparisonCount: 0, groups: pageOf([]),
    };
    return route.fulfill({ contentType: 'application/json', body: JSON.stringify({ success: true, data }) });
  });
  await page.addInitScript(() => localStorage.setItem('accessToken', 'genre-fixture'));
}

const genres = [
  ['판타지', '스킬'], ['무협', '무공·기예'],
  ...['로맨스', '추리', '코미디', 'SF', '스포츠', '호러', '일상', '기타'].map(genre => [genre, '기술·특기']),
];

for (const [genre, skillLabel] of genres) {
  test(`${genre}: 편집·검색·이력·후보 수정의 분류명만 바꾸고 원래 설정명은 보존한다`, async ({ page }) => {
    await mockWork(page, genre);
    const dashboard = `/dashboard?workId=${workId}&nav=settingDB`;
    await page.goto(`${dashboard}&tab=characters&modal=char-detail&charId=${characterId}&mode=edit`);
    await expect(page.getByRole('textbox', { name: '스탯 이름', exact: true })).toHaveValue('집중력');
    await expect(page.getByRole('textbox', { name: `${skillLabel} 이름`, exact: true })).toHaveValue(skillName);
    await expect(page.getByRole('textbox', { name: '소지품 이름', exact: true })).toHaveValue('아이템 상자');
    await expect(page.getByRole('button', { name: `${skillLabel} 추가`, exact: true })).toBeVisible();

    if (!['판타지', '무협', '로맨스'].includes(genre)) return;
    await page.goto(`${dashboard}&tab=characters&modal=char-detail&charId=${characterId}&mode=timeline&timelineView=all`);
    const timeline = page.getByRole('dialog', { name: '캐릭터 설정 이력' });
    await expect(timeline.locator('.character-timeline-fact__copy > span')).toHaveText(skillLabel);
    await expect(timeline.getByText(skillName, { exact: true })).toBeVisible();

    await page.goto(`${dashboard}&tab=search`);
    const results = page.getByTestId('character-fact-results');
    await expect(results.getByText(skillLabel, { exact: true })).toBeVisible();
    await expect(results.getByText(skillName, { exact: true })).toBeVisible();

    await page.goto(`/setting-review?workId=${workId}&batchId=${batchId}`);
    const card = page.getByRole('region', { name: `${skillName} 설정 후보` });
    await card.getByRole('button', { name: '수정', exact: true }).click();
    const edit = page.getByRole('dialog', { name: '설정 후보 수정' });
    await expect(edit.getByText(skillLabel, { exact: true })).toBeVisible();
    await expect(edit.getByRole('textbox', { name: '설정명 뒷부분', exact: true })).toHaveValue(skillName);
  });
}
