import { expect, test } from '@playwright/test';
import {
  characterCandidate, characterGroupKey, characterReviewUrl, routeCharacterReview,
  routeWorldReview, worldCandidate, worldReviewUrl,
} from './fixtures/review-group-mock';

test('종료된 캐릭터 후보는 종료 이유와 근거만 보여 주고 반영·수정·제외를 제공하지 않는다', async ({ page }) => {
  const { writes } = await routeCharacterReview(page, [characterCandidate('closed-character', 0, '소속', {
    reviewStatus: 'CLOSED', reviewedApplicationMode: null,
  })]);
  await page.goto(characterReviewUrl(characterGroupKey(0), { reviewStatus: 'CLOSED' }));
  const card = page.locator('[data-candidate-id="closed-character"]');
  await expect(card).toContainText('다음 분석 시작으로 검토 종료');
  await expect(card).toContainText('원래 내용과 근거는 기록으로 보존');
  await expect(card.getByRole('button', { name: /^(수정|제외|캐릭터 연결 변경)$/ })).toHaveCount(0);
  await expect(card).toContainText('합성 원문: 소속');
  expect(writes).toHaveLength(0);
});

test('종료된 세계관 후보는 반영됨으로 표시하지 않고 원래 제안을 읽기 전용으로 보여 준다', async ({ page }) => {
  const { writes } = await routeWorldReview(page, [worldCandidate('closed-world', '북부', '기후', {
    reviewStatus: 'CLOSED', suggestedOperation: 'REVIEW_REQUIRED', manualReviewAvailable: true,
  })]);
  await page.goto(worldReviewUrl('LOCATION|북부', { reviewStatus: 'CLOSED' }));
  const card = page.locator('[data-candidate-id="closed-world"]');
  await expect(card).toContainText('다음 분석 시작으로 검토 종료');
  await expect(card).toContainText('종료 당시 제안');
  await expect(card).not.toContainText('반영됨');
  await expect(card.getByRole('button', { name: /^(수정|제외)$/ })).toHaveCount(0);
  await expect(card).toContainText('합성 원문: 기후에 관한 합성 내용');
  expect(writes).toHaveLength(0);
});

for (const kind of ['character', 'world'] as const) {
  test(`검토 대상이 0개인 ${kind} 화면에서도 종료 기록을 명시적으로 열 수 있다`, async ({ page }) => {
    const candidateId = `closed-empty-${kind}`;
    const { writes } = kind === 'character'
      ? await routeCharacterReview(page, [characterCandidate(candidateId, 0, '소속', { reviewStatus: 'CLOSED', reviewedApplicationMode: null })])
      : await routeWorldReview(page, [worldCandidate(candidateId, '북부', '기후', { reviewStatus: 'CLOSED' })]);
    await page.goto(kind === 'character' ? characterReviewUrl('') : worldReviewUrl(''));
    await expect(page.locator(`[data-candidate-id="${candidateId}"]`)).toHaveCount(0);
    await page.getByRole('button', { name: '검토 종료 기록 보기', exact: true }).click();
    await expect(page.locator(`[data-candidate-id="${candidateId}"]`)).toContainText('다음 분석 시작으로 검토 종료');
    expect(writes).toHaveLength(0);
  });

  test(`종료된 ${kind} 후보의 이전 공유 링크는 전체 필터 대신 종료 기록을 찾아 연다`, async ({ page }) => {
    const candidateId = `closed-deep-link-${kind}`;
    const { writes } = kind === 'character'
      ? await routeCharacterReview(page, [characterCandidate(candidateId, 0, '소속', { reviewStatus: 'CLOSED', reviewedApplicationMode: null })])
      : await routeWorldReview(page, [worldCandidate(candidateId, '북부', '기후', { reviewStatus: 'CLOSED' })]);
    const url = new URL(kind === 'character' ? characterReviewUrl('') : worldReviewUrl(''), 'http://localhost');
    url.searchParams.delete('group');
    url.searchParams.set('candidate', candidateId);
    await page.goto(`${url.pathname}${url.search}`);
    await expect(page.locator(`[data-candidate-id="${candidateId}"]`)).toContainText('다음 분석 시작으로 검토 종료');
    await expect(page).toHaveURL(/(?:reviewStatus|characterReviewStatus|worldReviewStatus)=CLOSED/);
    expect(writes).toHaveLength(0);
  });
}
