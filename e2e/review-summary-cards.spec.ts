import { expect, test, type Page } from '@playwright/test';
import {
  characterCandidate, characterGroupKey, characterReviewUrl, routeCharacterReview, routeWorldReview, worldCandidate, worldReviewUrl,
} from './fixtures/review-group-mock';

// #211 후속 3차(D6): 결정이 끝난 카드는 처음 열 때 한 줄 요약으로 접고, 반복되는 안내·목록을 줄인다.
const card = (page: Page, id: string) => page.locator(`[data-candidate-id="${id}"]`);

test('캐릭터: 저장된 결정·제외 제안은 요약으로 접고 미결정 카드는 펼친다', async ({ page }) => {
  await routeCharacterReview(page, [
    characterCandidate('saved', 0, '직업', { reviewedApplicationMode: 'HISTORY_ONLY', attributeValue: '견습 기사' }),
    characterCandidate('exclude', 0, '별명', { suggestedOperation: 'EXCLUDE', manualReviewAvailable: false, reviewedApplicationMode: null }),
    characterCandidate('open-1', 0, '소속', { reviewedApplicationMode: null }),
    characterCandidate('open-2', 0, '거처', { reviewedApplicationMode: null }),
  ]);
  await page.goto(characterReviewUrl(characterGroupKey(0)));
  const saved = card(page, 'saved');
  await expect(saved).toHaveClass(/is-summary/);
  await expect(saved.getByRole('heading', { name: '직업' })).toBeVisible();
  await expect(saved).toContainText('저장했어요');
  await expect(saved).toContainText('이력에만 저장 · 견습 기사');
  await expect(saved.locator('.review-cb-evidence')).toHaveCount(0);
  // 요약에서도 연결 변경·수정·제외를 쓸 수 있다.
  for (const name of ['캐릭터 연결 변경', '수정', '제외']) await expect(saved.getByRole('button', { name, exact: true })).toBeEnabled();
  await expect(card(page, 'exclude')).toContainText('제외 예정');
  await expect(card(page, 'open-1')).not.toHaveClass(/is-summary/);
  await expect(card(page, 'open-1').locator('.review-cb-evidence')).toHaveCount(1);

  const expand = saved.getByRole('button', { name: '펼치기', exact: true });
  await expect(expand).toHaveAttribute('aria-expanded', 'false');
  await expand.click();
  await saved.locator('.review-cb-evidence summary').click();
  await expect(saved.getByText('합성 원문: 직업', { exact: true })).toBeVisible();
  await saved.getByRole('button', { name: '접기', exact: true }).click();
  await expect(saved).toHaveClass(/is-summary/);

  // 이력 선택 예문은 첫 미결정 카드에만 보인다.
  await expect(card(page, 'open-1').locator('.review-cb-choice', { hasText: '이력에만 저장' })).toContainText('과거에는 용병이었다');
  await expect(card(page, 'open-2').locator('.review-cb-choice', { hasText: '이력에만 저장' })).not.toContainText('과거에는 용병이었다');
  await expect(card(page, 'open-2').locator('.review-cb-choice', { hasText: '이력에만 저장' })).toContainText('현재 시점의 설정이 아닐 때 선택합니다.');
});

test('캐릭터: 이 화면에서 방금 고른 카드는 저장 뒤에도 펼친 채 두고 미결정으로 돌아가면 펼친다', async ({ page }) => {
  await routeCharacterReview(page, [characterCandidate('a-1', 0, '직업', { reviewedApplicationMode: null })]);
  await page.goto(characterReviewUrl(characterGroupKey(0)));
  await card(page, 'a-1').locator('.review-cb-choice', { hasText: '현재 설정에 반영' }).click();
  await expect(card(page, 'a-1')).toContainText('저장했어요 · 확정 전까지 바꿀 수 있어요');
  await expect(card(page, 'a-1')).not.toHaveClass(/is-summary/);
});

test('캐릭터: 연결이 모호한 후보는 등록 인물 3명과 검색·새 인물만 보여 준다', async ({ page }) => {
  await routeCharacterReview(page, [characterCandidate('who', null, '소속', { comparisonStatus: 'WAITING_FOR_CHARACTER_MATCH',
    suggestedOperation: null, manualReviewAvailable: false, reviewedApplicationMode: null, rawEntityMention: '검은 망토' })]);
  await page.goto(characterReviewUrl('미상'));
  const targets = card(page, 'who').locator('.review-character-targets');
  await expect(targets.locator('.review-cb-choice')).toHaveCount(4);
  await expect(targets.locator('.review-cb-choice').last()).toContainText('새로운 인물');
  await expect(targets.getByRole('button', { name: '다음 페이지' })).toHaveCount(0);
  await targets.getByRole('button', { name: '검색으로 찾기', exact: true }).click();
  await expect(page.getByRole('dialog', { name: '캐릭터 연결 확인' }).getByRole('searchbox')).toHaveValue('검은 망토');
});

test('세계관: 저장된 결정은 요약으로 접고 펼치면 원문 근거를 그대로 본다', async ({ page }) => {
  await routeWorldReview(page, [
    worldCandidate('saved', '은빛 항구', '기후', { finalOperation: 'ADD', finalCategory: 'LOCATION', finalSubjectName: '은빛 항구',
      finalScopeName: null, finalSettingName: '기후', finalValue: '작가가 정한 기후', userModified: true }),
    worldCandidate('open', '은빛 항구', '인구', { suggestedOperation: 'REVIEW_REQUIRED', manualReviewAvailable: true }),
  ]);
  await page.goto(worldReviewUrl('LOCATION|은빛 항구'));
  const saved = card(page, 'saved');
  await expect(saved).toHaveClass(/is-summary/);
  await expect(saved).toContainText('저장했어요');
  await expect(saved).toContainText('작가가 정한 기후');
  await expect(saved.getByRole('button', { name: '수정', exact: true })).toBeEnabled();
  await expect(saved.getByRole('button', { name: '기후 제외', exact: true })).toBeEnabled();
  await expect(card(page, 'open')).not.toHaveClass(/is-summary/);
  await saved.getByRole('button', { name: '펼치기', exact: true }).click();
  await saved.locator('.review-cb-evidence summary').click();
  await expect(saved.getByText('“합성 원문: 기후에 관한 합성 내용”', { exact: true })).toBeVisible();
});

test('세계관: 대상 미정 행이 여럿이면 행마다 검색 목록 대신 최근 고른 대상과 대상 검색을 보여 준다', async ({ page }) => {
  const unresolved = { suggestedOperation: 'REVIEW_REQUIRED', comparisonReviewReason: 'SUBJECT_UNRESOLVED', targetSubjectName: null };
  await routeWorldReview(page, [
    worldCandidate('u-1', '항구', '기후', unresolved),
    worldCandidate('u-2', '항구', '인구', unresolved),
  ], { targets: [{ id: '84444444-4444-4444-8444-444444444444', category: 'LOCATION', subjectName: '은빛 항구', properties: [] }] });
  const searches: string[] = [];
  page.on('request', request => { if (request.url().includes('/world-settings?')) searches.push(request.url()); });
  await page.goto(worldReviewUrl('LOCATION|항구'));
  const first = card(page, 'u-1');
  await expect(first.getByRole('textbox', { name: '기존 세계관 대상 검색' })).toHaveCount(0);
  await expect(first.getByRole('button', { name: '대상 검색', exact: true })).toBeVisible();
  expect(searches).toEqual([]);
  await first.getByRole('button', { name: '대상 검색', exact: true }).click();
  await first.locator('.review-cb-choice', { hasText: '은빛 항구' }).click();
  // 한 행에서 고른 대상은 다른 대상 미정 행에서 검색 없이 고를 수 있다.
  const recent = card(page, 'u-2').locator('.review-cb-choice', { hasText: '은빛 항구' });
  await expect(recent).toContainText('이번 검토에서 고른 대상');
  await expect(card(page, 'u-2').getByRole('textbox', { name: '기존 세계관 대상 검색' })).toHaveCount(0);
});
