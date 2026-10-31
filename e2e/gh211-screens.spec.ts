import { expect, test, type Locator, type Page } from '@playwright/test';
import { characterId, reviewUrl, routeCharacterLinkMock, settingCandidate, type MockCharacter } from './fixtures/character-link-mock';
import {
  characterCandidate, characterGroupKey, characterListPath, characterReviewUrl, routeCharacterReview,
  routeWorldReview, worldCandidate, worldListPath, worldReviewUrl, type MockWorldTarget,
} from './fixtures/review-group-mock';

// #211 후속 화면의 Pencil 동기화 기준 캡처. 명시적으로 켤 때만 실행한다(일반 e2e에서는 건너뛴다).
// 목 API와 합성 작품·인물·대상만 쓰며, 기존 e2e(character-search-link·character-selection-link·world-selection-target·
// review-action-bar·review-summary-cards·review-save-recovery·review-late-response·review-selection-limit·review-link-same-name)의
// 목과 조작을 그대로 따른다.
test.skip(process.env.CATCHHOLE_CAPTURE_GH211 !== '1', '명시적인 #211 화면 캡처에서만 실행');

const desktop = { width: 1440, height: 900 };
const mobile = { width: 390, height: 844 };
const card = (page: Page, id: string) => page.locator(`[data-candidate-id="${id}"]`);
const bar = (page: Page) => page.getByRole('region', { name: '묶음 확정', exact: true });
/** 캡처할 요소를 화면 가운데로 옮긴다(스크롤 영역이 문서든 상세 패널이든 같은 방식). */
const center = (target: Locator) => target.evaluate(element => element.scrollIntoView({ block: 'center' }));
const shot = async (page: Page, name: string) => {
  await page.waitForTimeout(250);
  await page.screenshot({ path: `docs/screens/gh211/${name}.png`, animations: 'disabled', caret: 'hide' });
};

test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
});

const linkCharacters: MockCharacter[] = [
  { id: characterId(1), name: '아리아', roleLabel: '주인공', firstAppearanceEpisodeNo: 3, representativeAttributeLabel: '레벨', representativeAttributeValue: '12',
    currentAge: 19, currentLevel: 12,
    profile: [{ key: 'profile.affiliation', displayName: '소속', value: '은빛 기사단' }, { key: 'profile.occupation', displayName: '직업', value: '기사' },
      { key: 'profile.species', displayName: '종족', value: '인간' }] },
  { id: characterId(2), name: '아리아', roleLabel: '악역', firstAppearanceEpisodeNo: 7, representativeAttributeLabel: '소속', representativeAttributeValue: '검은 탑' },
  { id: characterId(3), name: '베른', roleLabel: '조력자', firstAppearanceEpisodeNo: 1 },
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

test.describe('캐릭터 데스크톱', () => {
  test.use({ viewport: desktop });

  test('단건 연결 뒤 묶음 유지 안내', async ({ page }) => {
    await routeCharacterReview(page, [
      characterCandidate('a-1', 0, '직업', { reviewedApplicationMode: null }),
      characterCandidate('a-2', 0, '소속', { reviewedApplicationMode: null }),
      characterCandidate('a-3', 0, '거처', { reviewedApplicationMode: null }),
      characterCandidate('b-1', 1, '직업'),
    ]);
    await page.goto(characterReviewUrl(characterGroupKey(0)));
    await card(page, 'a-2').getByRole('button', { name: '캐릭터 연결 변경' }).click();
    const dialog = page.getByRole('dialog', { name: '캐릭터 연결 확인' });
    await dialog.getByRole('button', { name: /^도윤/ }).click();
    await dialog.getByRole('button', { name: '선택한 캐릭터에 연결', exact: true }).click();
    await expect(dialog).toHaveCount(0);
    const notice = page.getByRole('status').filter({ hasText: '‘소속’ 설정을 ‘도윤’에 연결했어요.' });
    await expect(notice.getByRole('button', { name: '연결한 묶음 보기', exact: true })).toBeVisible();
    await expect(notice.getByRole('button', { name: '닫기', exact: true })).toBeVisible();
    await center(notice);
    await shot(page, 'character-link-notice-desktop');
  });

  test('미연결 후보 묶음의 체크박스 선택과 선택 바, 선택 연결 모달', async ({ page }) => {
    await routeCharacterLinkMock(page, { candidates: unlinkedCandidates(), characters: linkCharacters });
    await page.goto(reviewUrl({ group: '미상' }));
    await expect(page.getByRole('heading', { name: /인물 미확인/ })).toBeVisible();
    await page.getByRole('checkbox', { name: '선택: 직업' }).check();
    await page.getByRole('checkbox', { name: '선택: 소속' }).check();
    const selection = page.getByRole('region', { name: '선택한 설정' });
    await expect(selection).toContainText('2개 선택 · 회차 1, 2');
    await center(page.getByRole('heading', { name: /인물 미확인/ }));
    await shot(page, 'character-unlinked-selection-desktop');

    await selection.getByRole('button', { name: '선택 항목 연결', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: '선택 항목 연결' });
    await dialog.getByLabel('작품 전체에서 인물 검색').fill('아리아');
    const first = dialog.getByRole('button', { name: /^아리아/ }).first();
    await expect(first).toContainText('같은 이름 2명 — 첫 등장·역할로 구분');
    await first.click();
    await expect(dialog.getByRole('region', { name: '이 설정의 기존값' })).toContainText('직업 · 1화기사');
    await shot(page, 'character-link-modal-desktop');
  });

  test('고정 확정 영역과 결정 완료 요약 카드', async ({ page }) => {
    await routeCharacterReview(page, [
      characterCandidate('saved-1', 0, '직업'),
      characterCandidate('history', 0, '거처', { reviewedApplicationMode: 'HISTORY_ONLY', attributeValue: '북쪽 성채' }),
      characterCandidate('ambiguous', 0, '소속', { matchStatus: 'AMBIGUOUS', comparisonStatus: 'WAITING_FOR_CHARACTER_MATCH',
        suggestedOperation: null, manualReviewAvailable: false, reviewedApplicationMode: null }),
      characterCandidate('saved-2', 0, '나이'),
      characterCandidate('review', 0, '별명', { manualReviewAvailable: false, reviewedApplicationMode: null }),
      characterCandidate('exclude', 0, '말버릇', { suggestedOperation: 'EXCLUDE', manualReviewAvailable: false, reviewedApplicationMode: null }),
      characterCandidate('other', 1, '직업'),
    ], { worldPending: 2 });
    await page.goto(characterReviewUrl(characterGroupKey(0)));
    await expect(bar(page)).toContainText('확정 가능 2 · 이력 저장 1 · 제외 1 · 결정 필요 2');
    await expect(bar(page).locator('[data-review-primary-action]')).toHaveText('확정하고 다음');
    await shot(page, 'character-action-bar-desktop');
  });

  test('결과 미확인 카드: 자동 확인 중과 최신 상태 확인·다시 시도', async ({ page }) => {
    test.setTimeout(60_000);
    await routeCharacterReview(page, [characterCandidate('a-1', 0, '직업'), characterCandidate('a-2', 0, '소속'),
      characterCandidate('a-3', 0, '거처', { reviewedApplicationMode: null }), characterCandidate('b-1', 1, '직업')]);
    // review-save-recovery의 반영 방식 저장 응답 유실: 서버에 저장되지 않은 채 응답을 잃는다.
    await page.route(`**${characterListPath}/a-3`, async route => {
      if (route.request().method() === 'PATCH') return route.abort('failed');
      return route.fallback();
    });
    await page.goto(characterReviewUrl(characterGroupKey(0)));
    await card(page, 'a-3').getByRole('radio', { name: /이력에만 저장/ }).click();
    await expect(card(page, 'a-3').getByRole('status').filter({ hasText: /최신 상태를 확인하는 중이에요\(\d\/3\)|잠시 후 자동으로 다시 확인해요/ })).toBeVisible();
    await shot(page, 'character-unverified-checking-desktop');
    await expect(card(page, 'a-3').getByRole('button', { name: '다시 시도', exact: true })).toBeVisible({ timeout: 30_000 });
    await shot(page, 'character-unverified-final-desktop');
  });

  test('확인하지 못한 연결 요청', async ({ page }) => {
    test.setTimeout(90_000);
    const candidates = [characterCandidate('a-1', 0, '직업', { reviewedApplicationMode: null }), characterCandidate('a-2', 0, '소속'),
      characterCandidate('b-1', 1, '직업')];
    await routeCharacterReview(page, candidates);
    // review-late-response의 선택 연결 응답 유실: 서버는 연결했지만 응답을 잃고, a-1 다시 읽기가 실패한다.
    await page.route(`**${characterListPath}/selected-character-match*`, async route => {
      const body = route.request().postDataJSON() as { candidateIds: string[]; matchedCharacterId: string };
      candidates.filter(item => body.candidateIds.includes(item.id)).forEach(item => Object.assign(item, {
        matchedCharacterId: body.matchedCharacterId, entityName: '세라', matchStatus: 'MATCHED' }));
      await route.abort('connectionreset');
    });
    await page.route(`**${characterListPath}/a-1*`, async route => {
      if (route.request().method() === 'GET') {
        return route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ success: false, data: null, message: '일시적인 오류' }) });
      }
      return route.fallback();
    });
    await page.goto(characterReviewUrl(characterGroupKey(0)));
    await page.getByRole('checkbox', { name: '선택: 직업' }).check();
    await page.getByRole('region', { name: '선택한 설정' }).getByRole('button', { name: '선택 항목 연결', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: '선택 항목 연결' });
    await dialog.getByRole('button', { name: /^세라/ }).click();
    await dialog.getByRole('button', { name: '선택한 캐릭터에 연결', exact: true }).click();
    await expect(dialog).toContainText('저장 결과를 확인하지 못했어요');
    await page.keyboard.press('Escape');
    await expect(dialog).toHaveCount(0);
    await page.locator('.candidate-group-card', { hasText: '도윤' }).click();
    await expect.poll(() => new URL(page.url()).searchParams.get('group')).toBe(characterGroupKey(1));
    await page.locator('.candidate-group-card', { hasText: '아린' }).click();
    await expect.poll(() => new URL(page.url()).searchParams.get('group')).toBe(characterGroupKey(0));
    const linkRequest = bar(page).getByRole('status').filter({ hasText: '확인하지 못한 연결 요청(설정 1개)' });
    await expect(linkRequest).toBeVisible();
    await expect(linkRequest.getByRole('button', { name: '최신 상태 확인', exact: true })).toBeVisible({ timeout: 30_000 });
    await expect(card(page, 'a-1').getByText('함께 보낸 연결 요청의 결과를', { exact: false })).toBeVisible();
    await shot(page, 'character-unverified-link-request-desktop');
  });

  test('선택 100개 초과 안내', async ({ page }) => {
    await routeCharacterReview(page, Array.from({ length: 101 }, (_, index) => characterCandidate(`c-${index}`, 0, `상태 ${index}`)));
    await page.goto(characterReviewUrl(characterGroupKey(0)));
    await page.getByRole('checkbox', { name: '모두 선택(101)' }).check();
    const selection = page.getByRole('region', { name: '선택한 설정' });
    await expect(selection.getByRole('alert')).toHaveText('한 번에 100개까지 연결할 수 있어요. 선택을 줄여 주세요.');
    await shot(page, 'character-selection-limit-desktop');
  });

  test('탭 마지막 묶음 뒤 완료 상태', async ({ page }) => {
    await routeCharacterReview(page, [characterCandidate('a-1', 0, '직업'), characterCandidate('a-2', 0, '거처')], { worldPending: 3 });
    await page.goto(characterReviewUrl(characterGroupKey(0)));
    const primary = bar(page).locator('[data-review-primary-action]');
    await expect(primary).toHaveText('모두 확정');
    await shot(page, 'character-last-group-desktop');
    await primary.click();
    await expect(page.getByText('캐릭터 검토를 마쳤어요', { exact: true }).first()).toBeVisible();
    await expect(page.getByText(/세계관 후보 3개가 남았어요/).first()).toBeVisible();
    await shot(page, 'character-tab-complete-desktop');
  });
});

const harbor: MockWorldTarget = { id: '73333333-3333-4333-8333-333333333333', category: 'LOCATION', subjectName: '은빛 항구',
  properties: [{ scopeName: null, settingName: '기후', value: '온화한 바닷바람' }, { scopeName: '부두', settingName: '규모', value: '배 열 척' }] };
const fortress: MockWorldTarget = { id: '74444444-4444-4444-8444-444444444444', category: 'LOCATION', subjectName: '잿빛 요새', properties: [] };
const unresolved = { suggestedOperation: 'REVIEW_REQUIRED', comparisonReviewReason: 'SUBJECT_UNRESOLVED', targetSubjectName: null };

function unresolvedRows() {
  return [
    worldCandidate('w1', '항구', '기후', { ...unresolved, extractedValue: '안개가 잦다', proposedValue: '안개가 잦다', sourceEpisodeNo: 1 }),
    worldCandidate('w2', '항구', '인구', { ...unresolved, extractedValue: '약 3천 명', proposedValue: '약 3천 명', sourceEpisodeNo: 1 }),
    worldCandidate('w3', '항구', '특산물', { ...unresolved, extractedValue: '은빛 생선', proposedValue: '은빛 생선', sourceEpisodeNo: 2 }),
  ];
}

async function openTargetLink(page: Page) {
  await page.getByRole('region', { name: '선택한 설정' }).getByRole('button', { name: '선택 항목 대상 연결', exact: true }).click();
  return page.getByRole('dialog', { name: '선택 항목 대상 연결' });
}

test.describe('세계관 데스크톱', () => {
  test.use({ viewport: desktop });

  test('체크박스 선택, 선택 항목 대상 연결 모달, 결정으로 남긴 행', async ({ page }) => {
    await routeWorldReview(page, unresolvedRows(), { targets: [harbor, fortress] });
    await page.goto(worldReviewUrl('LOCATION|항구'));
    for (const name of ['기후', '인구', '특산물']) await page.getByRole('checkbox', { name: `선택: ${name}` }).check();
    await expect(page.getByRole('region', { name: '선택한 설정' })).toContainText('3개 선택');
    await center(page.getByRole('checkbox', { name: '모두 선택(3)' }));
    await shot(page, 'world-selection-desktop');

    const dialog = await openTargetLink(page);
    await dialog.getByLabel('연결할 세계관 대상 검색').fill('은빛');
    await dialog.getByRole('radio', { name: /^은빛 항구/ }).click();
    const plan = dialog.getByRole('region', { name: '체크한 설정의 저장 방법' });
    await expect(plan).toContainText('기후기존값 있음 → 병합/교체 결정 필요');
    await expect(plan).toContainText('인구기존값 없음 → 추가로 저장');
    await expect(dialog.getByRole('region', { name: '대상에 저장된 현재 설정' })).toContainText('부두 › 규모배 열 척');
    await shot(page, 'world-target-link-modal-desktop');

    await dialog.getByRole('button', { name: '고른 대상에 연결', exact: true }).click();
    await expect(dialog).toHaveCount(0);
    const linked = page.getByRole('status').filter({ hasText: '2개 저장(추가) · 1개는 내용 결정이 남았어요' });
    await expect(linked).toBeVisible();
    await expect(card(page, 'w1')).toContainText('대상은 골랐어요. 기존값과 어떻게 합칠지 정해 주세요.');
    await linked.evaluate(element => element.scrollIntoView({ block: 'start' }));
    await shot(page, 'world-decision-left-desktop');
  });

  test('같은 이름 대상 차단 안내', async ({ page }) => {
    await routeWorldReview(page, unresolvedRows(), { targets: [harbor, fortress] });
    await page.goto(worldReviewUrl('LOCATION|항구'));
    await page.getByRole('checkbox', { name: '선택: 기후' }).check();
    await page.getByRole('checkbox', { name: '선택: 인구' }).check();
    const dialog = await openTargetLink(page);
    await dialog.getByRole('radio', { name: /^새 대상으로 등록/ }).click();
    await dialog.getByLabel('새 대상 이름').fill('은빛 항구');
    await expect(dialog.getByRole('alert').filter({ hasText: '같은 이름의 대상 ‘은빛 항구’이 이미 있어요' })).toBeVisible();
    await expect(dialog.getByRole('button', { name: '고른 대상에 연결', exact: true })).toBeDisabled();
    await shot(page, 'world-same-name-desktop');
  });

  test('대상 미정 행이 여럿일 때 축소형 대상 선택', async ({ page }) => {
    await routeWorldReview(page, unresolvedRows(), { targets: [harbor, fortress] });
    await page.goto(worldReviewUrl('LOCATION|항구'));
    await expect(card(page, 'w1').getByRole('button', { name: '대상 검색', exact: true })).toBeVisible();
    await center(card(page, 'w1').getByRole('button', { name: '대상 검색', exact: true }));
    await shot(page, 'world-compact-target-desktop');
    await card(page, 'w1').getByRole('button', { name: '대상 검색', exact: true }).click();
    await card(page, 'w1').locator('.review-cb-choice', { hasText: '은빛 항구' }).click();
    await expect(card(page, 'w2').locator('.review-cb-choice', { hasText: '은빛 항구' })).toContainText('이번 검토에서 고른 대상');
    await card(page, 'w2').scrollIntoViewIfNeeded();
    await shot(page, 'world-compact-target-recent-desktop');
  });

  test('응답 유실 복구 배너와 저장되지 않았어요', async ({ page }) => {
    test.setTimeout(60_000);
    const candidates = [
      worldCandidate('a-1', '은빛 항구', '인구', { suggestedOperation: 'REVIEW_REQUIRED', manualReviewAvailable: true }),
      worldCandidate('a-2', '은빛 항구', '기후'),
    ];
    await routeWorldReview(page, candidates);
    // review-late-response: 결정 저장 응답을 잃고 서버에도 저장되지 않는다.
    await page.route(`**${worldListPath}/decisions`, route => route.abort('connectionreset'));
    await page.goto(worldReviewUrl('LOCATION|은빛 항구'));
    await card(page, 'a-1').getByRole('radio', { name: /이 내용 그대로 추가/ }).click();
    const banner = page.getByRole('alert').filter({ hasText: '저장 결과를 아직 확인하지 못했어요.' });
    await expect(banner.getByText(/잠시 후 자동으로 다시 확인해요\(\d\/3\)|최신 상태를 확인하는 중이에요/)).toBeVisible();
    await center(banner);
    await shot(page, 'world-recovery-checking-desktop');
    const unsaved = page.getByText('저장되지 않았어요. 입력한 내용은 그대로예요. 다시 저장해 주세요.');
    await expect(unsaved).toBeVisible({ timeout: 20_000 });
    await center(unsaved);
    await shot(page, 'world-recovery-unsaved-desktop');
  });
});

test.describe('모바일', () => {
  test.use({ viewport: mobile });

  test('캐릭터 연결 모달의 검색·미리보기 세로 배치', async ({ page }) => {
    await routeCharacterLinkMock(page, { candidates: [settingCandidate('candidate-1')], characters: linkCharacters });
    await page.goto(reviewUrl({ group: '미상' }));
    await page.getByRole('region', { name: '직업 설정 후보', exact: true }).getByRole('button', { name: '캐릭터 연결 변경' }).click();
    const dialog = page.getByRole('dialog', { name: '캐릭터 연결 확인' });
    await dialog.getByLabel('작품 전체에서 인물 검색').fill('아리아');
    await dialog.getByRole('button', { name: /^아리아/ }).first().click();
    const existing = dialog.getByRole('region', { name: '이 설정의 기존값' });
    await expect(existing).toContainText('기사');
    await shot(page, 'mobile-character-link-modal');
    await existing.scrollIntoViewIfNeeded();
    await shot(page, 'mobile-character-link-modal-preview');
  });

  test('확정 영역과 선택 바(두 칸 44px)', async ({ page }) => {
    await routeCharacterReview(page, Array.from({ length: 6 }, (_, index) => characterCandidate(`sel-${index}`, 0, `상태 ${index}`, {
      reviewedApplicationMode: null })).concat(characterCandidate('next', 1, '직업')));
    await page.goto(characterReviewUrl(characterGroupKey(0)));
    await page.getByRole('checkbox', { name: '선택: 상태 1' }).check();
    await expect(bar(page).getByRole('region', { name: '선택한 설정' })).toContainText('1개 선택');
    await page.locator('.setting-review-main').evaluate(element => { element.scrollTop = 600; });
    await shot(page, 'mobile-action-bar-selection');
  });
});
