import { expect, test, type Page } from '@playwright/test';
import { characterId, reviewUrl, routeCharacterLinkMock, settingCandidate, type CharacterLinkMockOptions, type MockCharacter } from './fixtures/character-link-mock';

// 인물·설정은 모두 합성 데이터다. 서버 검색 요청과 화면 상태만 확인한다.
const characters: MockCharacter[] = [
  { id: characterId(1), name: '아리아', roleLabel: '주인공', firstAppearanceEpisodeNo: 3, representativeAttributeLabel: '레벨', representativeAttributeValue: '12',
    currentAge: 19, currentLevel: 12,
    profile: [{ key: 'profile.affiliation', displayName: '소속', value: '은빛 기사단' }, { key: 'profile.occupation', displayName: '직업', value: '기사' },
      { key: 'profile.species', displayName: '종족', value: '인간' }, { key: 'profile.eye_color', displayName: '눈 색깔', value: '회색' }] },
  { id: characterId(2), name: 'Rin', roleLabel: '조력자', firstAppearanceEpisodeNo: 1 },
  { id: characterId(3), name: 'rin', roleLabel: '악역', firstAppearanceEpisodeNo: 7 },
  { id: characterId(4), name: '무명 행인' },
  ...Array.from({ length: 10 }, (_, index) => ({ id: characterId(10 + index), name: `시민${String(index + 1).padStart(2, '0')}`, firstAppearanceEpisodeNo: index + 1 })),
];

async function openMatchModal(page: Page, overrides: Record<string, unknown> = {}, options: Partial<CharacterLinkMockOptions> = {}) {
  const state = await routeCharacterLinkMock(page, {
    candidates: [settingCandidate('candidate-1', overrides)],
    characters,
    ...options,
  });
  await page.goto(reviewUrl());
  await page.getByRole('region', { name: '직업 설정 후보', exact: true }).getByRole('button', { name: '캐릭터 연결 변경' }).click();
  const dialog = page.getByRole('dialog', { name: '캐릭터 연결 확인' });
  await expect(dialog.getByRole('button', { name: /^무명 행인/ })).toBeVisible();
  return { state, dialog };
}

const searchRequests = (urls: URL[]) => urls.filter(url => url.searchParams.has('query'));

test('작품 전체 검색은 입력이 멈춘 뒤 한 번만 서버에 묻고 구분 정보를 보여 준다', async ({ page }) => {
  const { state, dialog } = await openMatchModal(page);
  const search = dialog.getByLabel('작품 전체에서 인물 검색');
  await search.pressSequentially('아리아', { delay: 60 });
  const result = dialog.getByRole('button', { name: /^아리아/ });
  await expect(result).toContainText('첫 등장 3화 · 주인공 · 레벨 12');
  await expect(result.locator('mark')).toHaveText('아리아');
  await page.waitForTimeout(400);
  const requests = searchRequests(state.searchRequests);
  expect(requests).toHaveLength(1);
  expect(Object.fromEntries(requests[0].searchParams)).toEqual({ query: '아리아', page: '0', size: '8' });
  await expect(dialog.getByRole('button', { name: /^무명 행인/ })).toHaveCount(0);

  await search.fill('rin');
  await expect(dialog.getByRole('button', { name: /^Rin/ })).toContainText('같은 이름 2명 — 첫 등장·역할로 구분');
  await expect(dialog.getByRole('button', { name: /^rin/ })).toContainText('첫 등장 7화 · 악역');
  await expect(dialog.getByRole('button', { name: /^rin/ })).toContainText('같은 이름 2명');
});

test('검색 결과가 없으면 새 인물 등록으로 바로 넘어갈 수 있다', async ({ page }) => {
  const { dialog } = await openMatchModal(page);
  await dialog.getByLabel('작품 전체에서 인물 검색').fill('세렌디');
  const empty = dialog.getByRole('status').filter({ hasText: '‘세렌디’와 맞는 인물이 없어요.' });
  await expect(empty).toContainText('새 인물로 등록하거나 다른 이름으로 찾아보세요.');
  await empty.getByRole('button', { name: '새 인물로 등록', exact: true }).click();
  await expect(dialog.getByLabel('새 캐릭터 이름')).toHaveValue('세렌디');
  await expect(dialog.getByRole('button', { name: '새 캐릭터로 등록', exact: true }).last()).toBeEnabled();
});

test('검색 실패는 결과 없음과 다른 경고로 보여 주고 입력을 유지한 채 다시 시도한다', async ({ page }) => {
  let failing = true;
  const { dialog } = await openMatchModal(page, {}, { failSearch: url => failing && url.searchParams.get('query') === '아리아' });
  const search = dialog.getByLabel('작품 전체에서 인물 검색');
  await search.fill('아리아');
  const alert = dialog.getByRole('alert');
  await expect(alert).toContainText('인물을 검색하지 못했어요');
  await expect(alert).toContainText('입력한 검색어는 그대로예요.');
  await expect(dialog.getByText('맞는 인물이 없어요', { exact: false })).toHaveCount(0);
  await expect(search).toHaveValue('아리아');
  failing = false;
  await alert.getByRole('button', { name: '다시 시도', exact: true }).click();
  await expect(dialog.getByRole('button', { name: /^아리아/ })).toBeVisible();
  await expect(dialog.getByRole('alert')).toHaveCount(0);
});

test('첫 등장·역할·대표 정보가 없는 인물은 첫 등장 정보 없음으로 표시한다', async ({ page }) => {
  const { dialog } = await openMatchModal(page);
  await expect(dialog.getByRole('button', { name: /^무명 행인/ })).toContainText('첫 등장 정보 없음');
});

test('검색 결과의 다음 페이지로 가도 검색어는 남고 선택만 해제한다', async ({ page }) => {
  const { state, dialog } = await openMatchModal(page);
  const search = dialog.getByLabel('작품 전체에서 인물 검색');
  await search.fill('시민');
  await expect(dialog.getByRole('button', { name: /^무명 행인/ })).toHaveCount(0);
  await dialog.getByRole('button', { name: /^시민01/ }).click();
  await expect(dialog.getByRole('button', { name: /^시민01/ })).toHaveAttribute('aria-pressed', 'true');
  await dialog.getByRole('button', { name: '다음 페이지', exact: true }).click();
  await expect(dialog.getByRole('button', { name: /^시민09/ })).toBeVisible();
  await expect(search).toHaveValue('시민');
  expect(Object.fromEntries(searchRequests(state.searchRequests).at(-1)!.searchParams)).toEqual({ query: '시민', page: '1', size: '8' });
  await dialog.getByRole('button', { name: '선택한 캐릭터에 연결', exact: true }).click();
  await expect(dialog.getByRole('alert')).toHaveText('현재 목록에서 연결할 캐릭터를 선택해 주세요.');
  expect(state.writes).toEqual([]);
});

test('다른 인물 찾기는 원문 표현을 검색어로 넣어 연다', async ({ page }) => {
  const state = await routeCharacterLinkMock(page, {
    candidates: [settingCandidate('candidate-1', { matchStatus: 'AMBIGUOUS', rawEntityMention: '아리', entityName: '아리' })],
    characters,
  });
  await page.goto(reviewUrl());
  await page.getByRole('button', { name: '다른 인물 찾기', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: '캐릭터 연결 확인' });
  await expect(dialog.getByLabel('작품 전체에서 인물 검색')).toHaveValue('아리');
  await expect(dialog.getByRole('button', { name: /^아리아/ })).toBeVisible();
  expect(searchRequests(state.searchRequests).map(url => url.searchParams.get('query'))).toEqual(['아리']);
});
