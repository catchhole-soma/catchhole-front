import { expect, test, type Page } from '@playwright/test';
import {
  characterId, listPath, reviewUrl, routeCharacterLinkMock, settingCandidate, type CharacterLinkMockOptions, type MockCandidate,
  type MockCharacter,
} from './fixtures/character-link-mock';

// #211 후속(운영 피드백): 미연결(미상) 묶음에서 연결·제외해도 화면은 그 묶음에 머물고, 묶음이 비면 그 자리에 완료 상태와
// 옮겨 간 인물 묶음을 보여 준다. 이름 있는 묶음은 기존처럼 다음 미처리 묶음으로 간다. 인물·설정은 모두 합성 데이터다.
const characters: MockCharacter[] = [
  { id: characterId(1), name: '아리아', roleLabel: '주인공', firstAppearanceEpisodeNo: 1 },
  { id: characterId(2), name: '베른', roleLabel: '조력자', firstAppearanceEpisodeNo: 2 },
];

/** 목록 순서: 아리아(기존 연결) → 레온(이름만) → 미상. 서버처럼 미연결 묶음을 맨 뒤에 둔다. */
function candidates(unknownCount = 3): MockCandidate[] {
  const unknown = [
    settingCandidate('c1', { episodeNo: 1, attributeName: 'profile.occupation', attributeDisplayName: '직업', attributeValue: '견습 기사' }),
    settingCandidate('c2', { episodeNo: 2, attributeName: 'profile.affiliation', attributeDisplayName: '소속', attributeValue: '은빛 기사단' }),
    settingCandidate('c3', { episodeNo: 3, attributeName: 'profile.species', attributeDisplayName: '종족', attributeValue: '인간' }),
  ].slice(0, unknownCount);
  return [
    settingCandidate('a1', { entityName: '아리아', rawEntityMention: '아리아', matchedCharacterId: characterId(1), matchStatus: 'MATCHED',
      attributeName: 'profile.eye_color', attributeDisplayName: '눈 색깔', attributeValue: '회색' }),
    settingCandidate('n1', { entityName: '레온', rawEntityMention: '레온', attributeName: 'profile.occupation', attributeDisplayName: '직업', attributeValue: '용병' }),
    ...unknown,
  ];
}

const groupParam = (page: Page) => new URL(page.url()).searchParams.get('group');
const doneTitle = (page: Page) => page.getByRole('heading', { name: '미연결 후보를 모두 정리했어요.' });
const linkNotice = (page: Page) => page.getByRole('status').filter({ hasText: '연결했어요.' });

async function openUnknownGroup(page: Page, options: Partial<CharacterLinkMockOptions> = {}, unknownCount = 3) {
  const state = await routeCharacterLinkMock(page, { candidates: candidates(unknownCount), characters, ...options });
  await page.goto(reviewUrl({ group: '미상' }));
  await expect(page.getByRole('heading', { name: new RegExp(`인물 미확인${unknownCount}개 설정`) })).toBeVisible();
  return state;
}

/** 후보의 `캐릭터 연결 변경`에서 기존 인물에 연결한다. */
async function linkTo(page: Page, setting: string, name: string) {
  await page.getByRole('region', { name: `${setting} 설정 후보`, exact: true }).getByRole('button', { name: '캐릭터 연결 변경' }).click();
  const dialog = page.getByRole('dialog', { name: '캐릭터 연결 확인' });
  await dialog.getByRole('button', { name: new RegExp(`^${name}`) }).click();
  await dialog.getByRole('button', { name: '선택한 캐릭터에 연결', exact: true }).click();
  return dialog;
}

/** 후보의 `캐릭터 연결 변경`에서 새 인물로 등록한다(CREATE_NEW). */
async function linkToNew(page: Page, setting: string, name: string) {
  await page.getByRole('region', { name: `${setting} 설정 후보`, exact: true }).getByRole('button', { name: '캐릭터 연결 변경' }).click();
  const dialog = page.getByRole('dialog', { name: '캐릭터 연결 확인' });
  await dialog.getByRole('button', { name: '새 캐릭터로 등록', exact: true }).first().click();
  await dialog.getByLabel('새 캐릭터 이름').fill(name);
  await dialog.locator('button[type="submit"]').click();
  await expect(dialog).toHaveCount(0);
}

test('미상 묶음에서 하나씩 연결해도 그 묶음에 머물며 누적 안내를 보이고, 마지막 연결 뒤 그 자리에 완료 상태와 옮긴 묶음을 보여 준다', async ({ page }) => {
  const state = await openUnknownGroup(page);
  await linkTo(page, '직업', '아리아');
  await expect(linkNotice(page)).toContainText('‘직업’ 설정을 ‘아리아’에 연결했어요. (이번에 연결 1개 · 1명)');
  await expect(linkNotice(page)).toContainText('이 묶음에서 계속 연결할 수 있어요. 옮긴 설정은 미연결 후보를 모두 정리한 뒤 인물별로 모아 볼 수 있어요.');
  await expect(page.getByRole('heading', { name: /인물 미확인2개 설정/ })).toBeVisible();
  expect(groupParam(page)).toBe('미상');

  // 묶음이 없던 인물(베른)에 연결하면 새 인물 묶음이 생기지만 화면은 미상 묶음에 남는다.
  await linkTo(page, '소속', '베른');
  await expect(linkNotice(page)).toContainText('‘소속’ 설정을 ‘베른’에 연결했어요. (이번에 연결 2개 · 2명)');
  await expect(page.getByRole('heading', { name: /인물 미확인1개 설정/ })).toBeVisible();
  await expect(linkNotice(page).getByRole('button', { name: '연결한 묶음 보기', exact: true })).toBeVisible();
  expect(groupParam(page)).toBe('미상');

  // 마지막 후보를 새 인물로 등록해 묶음이 비어도 다른 묶음을 열지 않는다.
  await linkToNew(page, '종족', '세렌');
  await expect(doneTitle(page)).toBeFocused();
  const done = page.getByTestId('unlinked-group-done');
  await expect(done).toContainText('이번에 옮긴 설정 3개 · 3명이에요. 인물 묶음에서 이어서 검토해 주세요.');
  const moved = done.getByRole('list', { name: '옮긴 인물 묶음' }).getByRole('listitem');
  await expect(moved).toHaveText(['아리아옮긴 설정 1개보기', '베른옮긴 설정 1개보기', '세렌옮긴 설정 1개보기']);
  await expect(done.getByRole('button', { name: '다음 미처리 묶음', exact: true })).toBeVisible();
  await expect(linkNotice(page)).toHaveCount(0);
  expect(groupParam(page)).toBe('미상');
  expect(state.writes.map(write => write.path)).toEqual(['c1', 'c2', 'c3'].map(id => `${listPath}/${id}/character-match`));
  await page.waitForTimeout(300);
  expect(groupParam(page)).toBe('미상');

  // `보기`는 기존 연결한 묶음 보기와 같이 후보 ID로 실제 묶음·페이지를 찾는다(새 인물 등록 예정 묶음 포함).
  await done.getByRole('button', { name: '세렌 묶음 보기', exact: true }).click();
  await expect(page.getByRole('heading', { name: '세렌1개 설정' })).toBeVisible();
  await expect.poll(() => groupParam(page)).toBe('세렌');
  await expect(doneTitle(page)).toHaveCount(0);
});

test('완료 상태의 다음 미처리 묶음은 새로 생긴 인물 묶음보다 직전 목록의 앞쪽 묶음으로 돌아가 제목에 초점을 둔다', async ({ page }) => {
  await openUnknownGroup(page, {}, 1);
  await linkTo(page, '직업', '베른');
  await expect(doneTitle(page)).toBeFocused();
  await expect(page.getByTestId('unlinked-group-done').getByRole('listitem')).toHaveText(['베른옮긴 설정 1개보기']);
  await page.getByRole('button', { name: '다음 미처리 묶음', exact: true }).click();
  await expect.poll(() => groupParam(page)).toBe(`existing:${characterId(1)}`);
  await expect(page.getByRole('heading', { name: '아리아1개 설정' })).toBeFocused();
});

test('미상 묶음의 마지막 설정을 제외해도 그 자리에 완료 상태를 보이고, 새로고침 뒤에는 옮긴 묶음 대신 왼쪽 목록을 안내한다', async ({ page }) => {
  await openUnknownGroup(page, {}, 2);
  await linkTo(page, '직업', '베른');
  await expect(linkNotice(page)).toContainText('(이번에 연결 1개 · 1명)');
  await page.getByRole('region', { name: '소속 설정 후보', exact: true }).getByRole('button', { name: '제외', exact: true }).click();
  await expect(doneTitle(page)).toBeFocused();
  await expect(page.getByTestId('unlinked-group-done').getByRole('listitem')).toHaveText(['베른옮긴 설정 1개보기']);
  expect(groupParam(page)).toBe('미상');

  await page.reload();
  await expect(doneTitle(page)).toBeVisible();
  const done = page.getByTestId('unlinked-group-done');
  await expect(done).toContainText('옮겨 간 설정은 왼쪽 목록의 인물 묶음에서 확인할 수 있어요.');
  await expect(done.getByRole('list')).toHaveCount(0);
  // 새로고침 뒤 복원은 읽던 초점을 빼앗지 않는다.
  await expect(doneTitle(page)).not.toBeFocused();
  expect(groupParam(page)).toBe('미상');
  await done.getByRole('button', { name: '다음 미처리 묶음', exact: true }).click();
  await expect.poll(() => groupParam(page)).toBe(`existing:${characterId(1)}`);
});

test('연결로 생긴 인물 묶음이 앞에 끼어 미상 묶음이 다음 페이지로 밀리면 그 페이지로 따라가 같은 묶음을 유지한다', async ({ page }) => {
  // 한 페이지 2묶음: [레온, 미상] → 첫 미상 후보를 베른에 연결하면 [베른, 레온 | 미상]이 된다.
  const state = await routeCharacterLinkMock(page, {
    candidates: candidates(2).filter(candidate => candidate.id !== 'a1').sort((first, second) => (first.id === 'n1' ? 1 : 0) - (second.id === 'n1' ? 1 : 0)),
    characters, groupPageSize: 2,
  });
  await page.goto(reviewUrl({ group: '미상' }));
  await expect(page.getByRole('heading', { name: /인물 미확인2개 설정/ })).toBeVisible();
  await linkTo(page, '직업', '베른');
  await expect.poll(() => new URL(page.url()).searchParams.get('page')).toBe('2');
  expect(groupParam(page)).toBe('미상');
  await expect(page.getByRole('heading', { name: /인물 미확인1개 설정/ })).toBeVisible();
  await expect(page.getByRole('region', { name: '소속 설정 후보', exact: true })).toBeVisible();
  await expect(linkNotice(page)).toContainText('(이번에 연결 1개 · 1명)');
  expect(state.writes).toHaveLength(1);
});

test('이름이 빈 미연결 묶음에서 첫 설정을 연결해도 묶음 key가 바뀌지 않아 그 묶음에 머문다', async ({ page }) => {
  const blank = (id: string, setting: string, value: string) => settingCandidate(id, { entityName: '', rawEntityMention: '', attributeDisplayName: setting, attributeValue: value });
  await routeCharacterLinkMock(page, { candidates: [candidates(0)[1], blank('b1', '직업', '견습 기사'), blank('b2', '소속', '은빛 기사단')], characters });
  await page.goto(reviewUrl());
  await page.locator('.candidate-group-card', { hasText: '미연결 후보' }).click();
  await expect(page.getByRole('heading', { name: /인물 미확인2개 설정/ })).toBeVisible();
  const blankKey = groupParam(page);
  expect(blankKey).toBe('__unnamed__:blank');
  await linkTo(page, '직업', '베른');
  await expect(linkNotice(page)).toContainText('‘직업’ 설정을 ‘베른’에 연결했어요. (이번에 연결 1개 · 1명)');
  await expect(page.getByRole('heading', { name: /인물 미확인1개 설정/ })).toBeVisible();
  expect(groupParam(page)).toBe(blankKey);
  await linkTo(page, '소속', '아리아');
  await expect(doneTitle(page)).toBeFocused();
  expect(groupParam(page)).toBe(blankKey);
});

test('이름 있는 묶음은 남은 설정을 모두 선택 연결하면 기존처럼 다음 미처리 묶음을 연다', async ({ page }) => {
  await routeCharacterLinkMock(page, { candidates: candidates(1), characters });
  await page.goto(reviewUrl({ group: '레온' }));
  await expect(page.getByRole('heading', { name: /레온1개 설정/ })).toBeVisible();
  await page.getByRole('checkbox', { name: '모두 선택(1)' }).check();
  await page.getByRole('region', { name: '선택한 설정' }).getByRole('button', { name: '선택 항목 연결', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: '선택 항목 연결' });
  await dialog.getByRole('button', { name: /^베른/ }).click();
  await dialog.getByRole('button', { name: '선택한 캐릭터에 연결', exact: true }).click();
  await expect.poll(() => groupParam(page)).toBe('미상');
  await expect(page.getByRole('heading', { name: '인물 미확인1개 설정' })).toBeFocused();
  await expect(doneTitle(page)).toHaveCount(0);
});

/** 단건 연결을 서버에 반영한 뒤 응답만 끊는다(매번). `holdReads`가 있으면 그 후보의 확인 조회를 붙잡아 둔다. */
async function loseSingleLink(page: Page, state: { candidates: MockCandidate[] }, candidateId: string, holdReads?: Promise<void>) {
  const control = { attempts: 0 };
  await page.route(url => url.pathname === `${listPath}/${candidateId}/character-match`, async route => {
    const body = route.request().postDataJSON() as { matchedCharacterId: string };
    const candidate = state.candidates.find(item => item.id === candidateId)!;
    Object.assign(candidate, { matchedCharacterId: body.matchedCharacterId, matchStatus: 'MATCHED',
      entityName: characters.find(character => character.id === body.matchedCharacterId)?.name ?? '' });
    control.attempts += 1;
    await route.abort('connectionreset');
  });
  if (holdReads) {
    await page.route(url => url.pathname === `${listPath}/${candidateId}`, async route => {
      if (control.attempts > 0) await holdReads;
      await route.fallback();
    });
  }
  return control;
}

test('응답을 잃은 미상 마지막 연결도 다시 읽어 확인하면 정상 응답과 같이 그 자리에 완료 상태를 보인다', async ({ page }) => {
  const state = await openUnknownGroup(page, {}, 1);
  const control = await loseSingleLink(page, state, 'c1');
  await linkTo(page, '직업', '베른');
  await expect(doneTitle(page)).toBeFocused();
  await expect(page.getByTestId('unlinked-group-done').getByRole('listitem')).toHaveText(['베른옮긴 설정 1개보기']);
  expect(groupParam(page)).toBe('미상');
  // 다시 읽어 저장을 확인했으므로 같은 요청을 다시 보내지 않는다.
  expect(control.attempts).toBe(1);
});

test('응답을 잃은 미상 마지막 연결의 확인이 끝나기 전에 다른 묶음으로 옮기면 확인 뒤에도 그 묶음에 남고 완료 상태를 띄우지 않는다', async ({ page }) => {
  const state = await openUnknownGroup(page, {}, 1);
  let release: () => void = () => undefined;
  const released = new Promise<void>(resolve => { release = resolve; });
  await loseSingleLink(page, state, 'c1', released);
  const dialog = await linkTo(page, '직업', '베른');
  await expect(dialog).toContainText('저장 결과를 확인하지 못했어요');
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await page.locator('.candidate-group-card', { hasText: '레온' }).click();
  await expect.poll(() => groupParam(page)).toBe('레온');
  release();
  // 늦게 끝난 확인이 연결을 확인하고 후속 처리를 마칠 때까지 기다린다.
  await expect(page.locator('.candidate-group-card', { hasText: '미연결 후보' })).toHaveCount(0);
  await page.waitForTimeout(500);
  expect(groupParam(page)).toBe('레온');
  await expect(page.getByRole('heading', { name: /레온1개 설정/ })).toBeVisible();
  await expect(doneTitle(page)).toHaveCount(0);
  await expect(linkNotice(page)).toHaveCount(0);
});

test('320px에서 완료 상태의 버튼을 44px 높이로 세로로 놓고 가로로 넘치지 않는다', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 320, height: 720 });
  await openUnknownGroup(page, {}, 2);
  await linkTo(page, '직업', '아리아');
  await expect(linkNotice(page)).toContainText('(이번에 연결 1개 · 1명)');
  await linkTo(page, '소속', '베른');
  await expect(doneTitle(page)).toBeFocused();
  const done = page.getByTestId('unlinked-group-done');
  const buttons = [done.getByRole('button', { name: '아리아 묶음 보기' }), done.getByRole('button', { name: '베른 묶음 보기' }),
    done.getByRole('button', { name: '다음 미처리 묶음' })];
  const boxes = await Promise.all(buttons.map(button => button.boundingBox()));
  const doneBox = (await done.boundingBox())!;
  for (const box of boxes) {
    expect(box!.height).toBeGreaterThanOrEqual(44);
    expect(box!.x + box!.width).toBeLessThanOrEqual(doneBox.x + doneBox.width);
  }
  // 이름 줄 아래에 버튼이 오고(세로 배치), 버튼끼리도 위아래로 놓인다.
  const firstName = (await done.getByRole('listitem').first().locator('strong').boundingBox())!;
  expect(boxes[0]!.y).toBeGreaterThanOrEqual(firstName.y + firstName.height - 1);
  expect(boxes[1]!.y).toBeGreaterThanOrEqual(boxes[0]!.y + boxes[0]!.height - 1);
  expect(boxes[2]!.y).toBeGreaterThanOrEqual(boxes[1]!.y + boxes[1]!.height - 1);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await done.screenshot({ path: testInfo.outputPath('unlinked-done-320.png') });
});

// PR #113 리뷰 반영: 전체 필터 복원, 다른 묶음에서 다시 연결한 기록, 다른 페이지 찾기 실패.

test('전체 상태 필터에서 마지막 대기 후보를 제외한 미연결 묶음은 새로고침 뒤에도 완료 상태로 복원한다', async ({ page }) => {
  // 이미 확정된 후보(c0)가 있어 `전체` 필터에서는 대기 후보가 없어도 미상 묶음이 목록에 남는다.
  const rows = [
    settingCandidate('n1', { entityName: '레온', rawEntityMention: '레온' }),
    settingCandidate('c0', { attributeName: 'profile.gender', attributeDisplayName: '성별', attributeValue: '여성', reviewStatus: 'CONFIRMED' }),
    settingCandidate('c1', { attributeDisplayName: '직업' }),
  ];
  await routeCharacterLinkMock(page, { candidates: rows, characters });
  await page.goto(reviewUrl({ group: '미상', reviewStatus: 'ALL' }));
  await page.getByRole('region', { name: '직업 설정 후보', exact: true }).getByRole('button', { name: '제외', exact: true }).click();
  await expect(doneTitle(page)).toBeFocused();
  for (const reopen of [() => page.reload(), async () => {
    const tabs = page.getByRole('navigation', { name: '설정 후보 종류' });
    await tabs.getByRole('button', { name: /세계관 후보/ }).click();
    await expect(page).toHaveURL(/candidateType=world/);
    await tabs.getByRole('button', { name: /캐릭터 후보/ }).click();
  }]) {
    await reopen();
    await expect(doneTitle(page)).toBeVisible();
    await expect(page.getByTestId('unlinked-group-done')).toContainText('옮겨 간 설정은 왼쪽 목록의 인물 묶음에서 확인할 수 있어요.');
    expect(groupParam(page)).toBe('미상');
    expect(new URL(page.url()).searchParams.get('reviewStatus')).toBe('ALL');
  }
});

test('미상에서 옮긴 설정을 인물 묶음에서 다시 연결하면 완료 목록과 보기가 새 대상을 따른다', async ({ page }) => {
  await openUnknownGroup(page);
  await linkTo(page, '직업', '아리아');
  await expect(linkNotice(page)).toContainText('(이번에 연결 1개 · 1명)');
  await linkTo(page, '소속', '아리아');
  await expect(linkNotice(page)).toContainText('(이번에 연결 2개 · 1명)');
  // 아리아 묶음으로 가서 옮긴 직업 설정을 베른에 다시 연결한다(이름 있는 묶음의 단건 연결).
  await linkNotice(page).getByRole('button', { name: '연결한 묶음 보기', exact: true }).click();
  await expect(page.getByRole('heading', { name: /^아리아3개 설정/ })).toBeVisible();
  await linkTo(page, '직업', '베른');
  await expect(page.getByRole('heading', { name: /^아리아2개 설정/ })).toBeVisible();
  // 미상 묶음으로 돌아와 남은 설정을 마친다.
  await page.locator('.candidate-group-card', { hasText: '미연결 후보' }).click();
  await expect(page.getByRole('heading', { name: /인물 미확인1개 설정/ })).toBeVisible();
  await linkTo(page, '종족', '아리아');
  const done = page.getByTestId('unlinked-group-done');
  await expect(doneTitle(page)).toBeFocused();
  await expect(done.getByRole('listitem')).toHaveText(['베른옮긴 설정 1개보기', '아리아옮긴 설정 2개보기']);
  await expect(done).toContainText('이번에 옮긴 설정 3개 · 2명이에요.');
  // 아리아의 보기는 다시 연결해 베른으로 간 후보가 아니라 아리아에 남은 묶음을 연다.
  await done.getByRole('button', { name: '아리아 묶음 보기', exact: true }).click();
  await expect.poll(() => groupParam(page)).toBe(`existing:${characterId(1)}`);
  await expect(page.getByRole('heading', { name: /^아리아3개 설정/ })).toBeVisible();
});

/** 지정한 페이지(0부터)의 목록 요청을 실패시킨다. `fail`을 false로 바꾸면 다시 통과시킨다. */
async function failListPage(page: Page, pageIndex: number) {
  const control = { fail: true, failures: 0 };
  await page.route(url => url.pathname === listPath && url.searchParams.get('page') === String(pageIndex)
    && url.searchParams.get('size') !== '1', async route => {
    if (!control.fail) return route.fallback();
    control.failures += 1;
    return route.fulfill({ status: 500, contentType: 'application/json',
      body: JSON.stringify({ success: false, message: '잠시 후 다시 시도해 주세요.', data: null, error: { code: 'INTERNAL_SERVER_ERROR', status: 500 } }) });
  });
  return control;
}

/** 한 페이지 2묶음 [레온, 미상(직업·소속)]. 직업을 베른에 연결하면 [베른, 레온 | 미상]으로 미상 묶음이 2페이지로 밀린다. */
async function routePushedUnknownGroup(page: Page) {
  return routeCharacterLinkMock(page, {
    candidates: candidates(2).filter(candidate => candidate.id !== 'a1').sort((first, second) => (first.id === 'n1' ? 1 : 0) - (second.id === 'n1' ? 1 : 0)),
    characters, groupPageSize: 2,
  });
}

const lookupFailed = (page: Page) => page.getByRole('heading', { name: '남은 미연결 후보 위치를 확인하지 못했어요.' });

test('다음 페이지로 밀린 미상 묶음을 찾지 못하면 선택을 붙잡고 다시 시도로 같은 묶음을 찾는다', async ({ page }) => {
  test.setTimeout(60_000);
  await routePushedUnknownGroup(page);
  await page.goto(reviewUrl({ group: '미상' }));
  await expect(page.getByRole('heading', { name: /인물 미확인2개 설정/ })).toBeVisible();
  const control = await failListPage(page, 1);
  await linkTo(page, '직업', '베른');
  await expect(lookupFailed(page)).toBeVisible({ timeout: 20_000 });
  expect(groupParam(page)).toBe('미상');
  expect(new URL(page.url()).searchParams.get('page')).toBeNull();
  await page.waitForTimeout(300);
  expect(groupParam(page)).toBe('미상');
  control.fail = false;
  await page.getByRole('button', { name: '다시 시도', exact: true }).click();
  await expect.poll(() => new URL(page.url()).searchParams.get('page')).toBe('2');
  expect(groupParam(page)).toBe('미상');
  await expect(page.getByRole('heading', { name: /인물 미확인1개 설정/ })).toBeVisible();
  await expect(lookupFailed(page)).toHaveCount(0);
});

test('새로고침 뒤 미상 묶음을 다른 페이지에서 찾지 못해도 첫 묶음으로 바꾸지 않고, 작가가 고른 묶음은 따른다', async ({ page }) => {
  test.setTimeout(60_000);
  await routePushedUnknownGroup(page);
  await page.goto(reviewUrl({ group: '미상' }));
  await linkTo(page, '직업', '베른');
  await expect.poll(() => new URL(page.url()).searchParams.get('page')).toBe('2');
  // 1페이지 URL로 다시 열면(공유·탭 기록) 미상 묶음은 2페이지에 있다. 그 페이지를 읽지 못하는 경우다.
  const control = await failListPage(page, 1);
  await page.goto(reviewUrl({ group: '미상', page: '1' }));
  await expect(lookupFailed(page)).toBeVisible({ timeout: 20_000 });
  expect(groupParam(page)).toBe('미상');
  expect(control.failures).toBeGreaterThan(0);
  await page.locator('.candidate-group-card', { hasText: '레온' }).click();
  await expect.poll(() => groupParam(page)).toBe('레온');
  await expect(lookupFailed(page)).toHaveCount(0);
  await expect(page.getByRole('heading', { name: /레온1개 설정/ })).toBeVisible();
});
