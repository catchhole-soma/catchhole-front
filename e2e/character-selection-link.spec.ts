import { expect, test, type Page } from '@playwright/test';
import {
  batchId, characterId, listPath, reviewUrl, routeCharacterLinkMock, settingCandidate,
  type CharacterLinkMockOptions, type MockCharacter,
} from './fixtures/character-link-mock';

// 인물·설정은 모두 합성 데이터다. 미연결 묶음의 서로 다른 설정을 골라 연결하는 요청과 화면만 확인한다.
const characters: MockCharacter[] = [
  { id: characterId(1), name: '아리아', roleLabel: '주인공', firstAppearanceEpisodeNo: 3,
    profile: [{ key: 'profile.occupation', displayName: '직업', value: '기사' }] },
  { id: characterId(2), name: '베른', roleLabel: '조력자', firstAppearanceEpisodeNo: 1 },
];

function unlinkedCandidates() {
  return [
    settingCandidate('c1', { episodeNo: 1, attributeName: 'profile.occupation', attributeDisplayName: '직업', attributeValue: '견습 기사' }),
    settingCandidate('c2', { episodeNo: 2, attributeName: 'profile.affiliation', attributeDisplayName: '소속', attributeValue: '은빛 기사단' }),
    settingCandidate('c3', { episodeNo: 2, attributeName: 'profile.species', attributeDisplayName: '종족', attributeValue: '인간' }),
    settingCandidate('c4', { episodeNo: 3, attributeName: 'profile.eye_color', attributeDisplayName: '눈 색깔', attributeValue: '회색', matchStatus: 'AMBIGUOUS' }),
    settingCandidate('n1', { entityName: '레온', rawEntityMention: '레온', episodeNo: 1, attributeName: 'profile.occupation', attributeDisplayName: '직업', attributeValue: '용병' }),
  ];
}

async function openUnlinkedGroup(page: Page, params: Record<string, string> = {}, options: Partial<CharacterLinkMockOptions> = {}) {
  const state = await routeCharacterLinkMock(page, { candidates: unlinkedCandidates(), characters, ...options });
  await page.goto(reviewUrl({ group: '미상', ...params }));
  await expect(page.getByRole('heading', { name: /인물 미확인/ })).toBeVisible();
  return state;
}

async function linkSelectionTo(page: Page, name: string) {
  await page.getByRole('region', { name: '선택한 설정' }).getByRole('button', { name: '선택 항목 연결', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: '선택 항목 연결' });
  await dialog.getByLabel('작품 전체에서 인물 검색').fill(name);
  await dialog.getByRole('button', { name: new RegExp(`^${name}`) }).click();
  await dialog.getByRole('button', { name: '선택한 캐릭터에 연결', exact: true }).click();
  return dialog;
}

test('미연결 묶음에서 체크한 설정만 같은 인물에 연결하고 읽던 묶음에 남는다', async ({ page }) => {
  const state = await openUnlinkedGroup(page);
  // 서로 다른 인물일 수 있는 미연결 묶음에는 묶음 전체 연결을 두지 않는다.
  await expect(page.getByRole('button', { name: '캐릭터 일괄 연결' })).toHaveCount(0);
  await page.getByRole('checkbox', { name: '선택: 직업' }).check();
  await page.getByRole('checkbox', { name: '선택: 소속' }).check();
  const bar = page.getByRole('region', { name: '선택한 설정' });
  await expect(bar).toContainText('2개 선택 · 회차 1, 2');
  await expect(bar).not.toContainText('필터로 숨은 후보');

  await bar.getByRole('button', { name: '선택 항목 연결', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: '선택 항목 연결' });
  const summary = dialog.getByRole('group', { name: '연결할 설정' });
  await expect(summary).toContainText('선택 2개');
  await expect(summary).toContainText('회차 1, 2');
  await expect(summary).toContainText('적용: 연결만(내용과 반영 방식은 각 설정에서 결정해요)');
  await dialog.getByLabel('작품 전체에서 인물 검색').fill('아리아');
  await dialog.getByRole('button', { name: /^아리아/ }).click();
  const existing = dialog.getByRole('region', { name: '이 설정의 기존값' });
  await expect(existing).toContainText('직업 · 1화기사');
  await expect(existing).toContainText('소속 · 2화기존값 없음');
  await dialog.getByRole('button', { name: '선택한 캐릭터에 연결', exact: true }).click();

  await expect(dialog).toHaveCount(0);
  expect(state.writes).toEqual([{ path: `${listPath}/selected-character-match`,
    body: { batchId, candidateIds: ['c1', 'c2'], resolutionType: 'MATCH_EXISTING', matchedCharacterId: characterId(1) } }]);
  await expect(page.getByRole('status').filter({ hasText: '2개를 ‘아리아’에 연결했어요.' })).toBeVisible();
  expect(new URL(page.url()).searchParams.get('group')).toBe('미상');
  await expect(page.getByRole('region', { name: '종족 설정 후보', exact: true })).toBeVisible();
  await expect(page.getByRole('region', { name: '눈 색깔 설정 후보', exact: true })).toBeVisible();
  await expect(page.getByRole('region', { name: '직업 설정 후보', exact: true })).toHaveCount(0);
  await expect(page.getByRole('region', { name: '선택한 설정' })).toHaveCount(0);
});

test('필터로 숨은 후보는 모두 선택과 연결 요청에 넣지 않는다', async ({ page }) => {
  const state = await openUnlinkedGroup(page, { matchStatus: 'UNRESOLVED' });
  await page.getByRole('checkbox', { name: '모두 선택(3)' }).check();
  const bar = page.getByRole('region', { name: '선택한 설정' });
  await expect(bar).toContainText('3개 선택 · 회차 1, 2');
  await expect(bar).toContainText('필터로 숨은 후보는 포함되지 않아요.');
  await linkSelectionTo(page, '베른');
  await expect.poll(() => state.writes.length).toBe(1);
  expect(state.writes[0].body.candidateIds).toEqual(['c1', 'c2', 'c3']);
});

test('서버가 특정 후보 때문에 거절하면 그 카드만 표시하고 선택을 유지한다', async ({ page }) => {
  await openUnlinkedGroup(page, {}, { selectedMatchError: {
    status: 409, code: 'SETTING_CANDIDATE_REVIEW_STATUS_CONFLICT', message: '검토 대기 상태가 아닌 설정이 있습니다.', candidateIds: ['c2'],
  } });
  await page.getByRole('checkbox', { name: '선택: 직업' }).check();
  await page.getByRole('checkbox', { name: '선택: 소속' }).check();
  const dialog = await linkSelectionTo(page, '아리아');
  await expect(dialog.getByRole('alert')).toHaveText('검토 대기 상태가 아닌 설정이 있습니다.');
  await expect(dialog.getByLabel('작품 전체에서 인물 검색')).toHaveValue('아리아');
  await dialog.getByRole('button', { name: '취소', exact: true }).click();

  const rejected = page.getByRole('region', { name: '소속 설정 후보', exact: true });
  await expect(rejected).toHaveAttribute('aria-invalid', 'true');
  await expect(rejected).toContainText('이 설정 때문에 선택 연결을 하지 못했어요');
  await expect(page.getByRole('region', { name: '직업 설정 후보', exact: true })).not.toHaveAttribute('aria-invalid', 'true');
  await expect(page.getByRole('checkbox', { name: '선택: 직업' })).toBeChecked();
  await expect(page.getByRole('checkbox', { name: '선택: 소속' })).toBeChecked();
  await expect(page.getByRole('region', { name: '선택한 설정' })).toContainText('2개 선택');
});

test('체크한 설정을 이름을 입력한 새 인물로 등록 예정 연결한다', async ({ page }) => {
  const state = await openUnlinkedGroup(page);
  await page.getByRole('checkbox', { name: '선택: 직업' }).check();
  await page.getByRole('checkbox', { name: '선택: 종족' }).check();
  await page.getByRole('region', { name: '선택한 설정' }).getByRole('button', { name: '선택 항목 연결', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: '선택 항목 연결' });
  await dialog.getByRole('button', { name: '새 캐릭터로 등록', exact: true }).first().click();
  await expect(dialog.getByLabel('새 캐릭터 이름')).toHaveValue('');
  await dialog.getByRole('button', { name: '새 캐릭터로 등록', exact: true }).last().click();
  await expect(dialog.getByRole('alert')).toHaveText('새 캐릭터 이름을 입력해 주세요.');
  await dialog.getByLabel('새 캐릭터 이름').fill('세렌');
  await dialog.getByRole('button', { name: '새 캐릭터로 등록', exact: true }).last().click();
  await expect(dialog).toHaveCount(0);
  expect(state.writes).toEqual([{ path: `${listPath}/selected-character-match`,
    body: { batchId, candidateIds: ['c1', 'c3'], resolutionType: 'CREATE_NEW', entityName: '세렌' } }]);
});

test('이름 있는 묶음은 묶음 전체 연결과 체크한 설정 연결을 함께 제공한다', async ({ page }) => {
  await routeCharacterLinkMock(page, { candidates: unlinkedCandidates(), characters });
  await page.goto(reviewUrl({ group: '레온' }));
  await expect(page.getByRole('heading', { name: /레온/ })).toBeVisible();
  await expect(page.getByRole('button', { name: '캐릭터 일괄 연결', exact: true })).toBeEnabled();
  await expect(page.getByRole('checkbox', { name: '선택: 직업' })).toBeVisible();
  await expect(page.getByText('‘캐릭터 일괄 연결’은 이 이름 묶음 전체를, ‘선택 항목 연결’은 체크한 설정만 연결해요.')).toBeVisible();
});

test('미연결 묶음의 남은 설정을 모두 선택 연결해도 다른 묶음을 열지 않고 그 자리에 완료 상태를 보인다', async ({ page }) => {
  const state = await openUnlinkedGroup(page);
  await page.getByRole('checkbox', { name: '모두 선택(4)' }).check();
  await linkSelectionTo(page, '아리아');
  const done = page.getByTestId('unlinked-group-done');
  await expect(done.getByRole('heading', { name: '미연결 후보를 모두 정리했어요.' })).toBeFocused();
  await expect(done.getByRole('listitem')).toHaveText(['아리아옮긴 설정 4개보기']);
  expect(new URL(page.url()).searchParams.get('group')).toBe('미상');
  expect(state.writes[0].body.candidateIds).toEqual(['c1', 'c2', 'c3', 'c4']);
  // 이름 있는 묶음(레온)이 남아 있으므로 다음 미처리 묶음으로 이어 갈 수 있다.
  await done.getByRole('button', { name: '다음 미처리 묶음', exact: true }).click();
  await expect.poll(() => new URL(page.url()).searchParams.get('group')).toBe('레온');
});

test('선택 연결 응답을 잃어도 다시 읽어 저장을 확인하고 같은 요청을 다시 보내지 않는다', async ({ page }) => {
  const state = await openUnlinkedGroup(page, {}, { loseSelectedMatchResponse: true });
  await page.getByRole('checkbox', { name: '선택: 직업' }).check();
  await page.getByRole('checkbox', { name: '선택: 소속' }).check();
  const dialog = await linkSelectionTo(page, '아리아');
  await expect(dialog).toHaveCount(0);
  await expect(page.getByRole('status').filter({ hasText: '2개를 ‘아리아’에 연결했어요.' })).toBeVisible();
  expect(state.writes).toHaveLength(1);
  await expect(page.getByRole('region', { name: '선택한 설정' })).toHaveCount(0);
});
