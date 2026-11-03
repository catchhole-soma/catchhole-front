import { expect, test } from '@playwright/test';
import {
  characterCandidate, characterGroupKey, characterReviewUrl, routeCharacterReview,
  routeWorldReview, worldCandidate, worldReviewUrl,
} from './fixtures/review-group-mock';

test('종료된 캐릭터 후보는 종료 이유와 근거만 보여 주고 반영·수정·제외를 제공하지 않는다', async ({ page }) => {
  const { writes } = await routeCharacterReview(page, [characterCandidate('closed-character', 0, '소속', {
    reviewStatus: 'CLOSED', reviewedApplicationMode: null, confidence: 0.4,
    valueValidation: { status: 'INVALID', repairable: false },
    comparisonReason: '소속을 확정하지 못한 당시 판단입니다.',
  })]);
  await page.goto(characterReviewUrl(characterGroupKey(0), { reviewStatus: 'CLOSED' }));
  const card = page.locator('[data-candidate-id="closed-character"]');
  await expect(card).toContainText('다음 분석 시작으로 검토 종료');
  await expect(card).toContainText('원래 내용과 근거는 기록으로 보존');
  await expect(card.getByRole('button', { name: /^(수정|제외|캐릭터 연결 변경)$/ })).toHaveCount(0);
  await expect(card).toContainText('합성 원문: 소속');
  await expect(card).toContainText('소속에 관한 합성 설정값입니다.');
  await expect(card).toContainText('종료 당시 제안');
  await expect(card).toContainText('소속을 확정하지 못한 당시 판단입니다.');
  await expect(card).toContainText('근거 명확도 40%');
  await expect(card).not.toContainText('설정값의 형식을 확인해 주세요');
  await expect(card).not.toContainText('원문을 직접 확인해 주세요');
  await expect(card).not.toContainText('반영된 설정');
  await expect(page.getByText('남은 항목을 함께 확정합니다.', { exact: false })).toHaveCount(0);
  await expect(page.getByRole('region', { name: '묶음 확정' })).toHaveCount(0);
  await expect(page.getByText('종료된 후보의 내용과 근거를 기록으로 확인할 수 있습니다.', { exact: true })).toBeVisible();
  expect(writes).toHaveLength(0);
});

test('종료된 세계관 후보는 반영됨으로 표시하지 않고 원래 제안을 읽기 전용으로 보여 준다', async ({ page }) => {
  const { writes } = await routeWorldReview(page, [worldCandidate('closed-world', '북부', '기후', {
    reviewStatus: 'CLOSED', suggestedOperation: 'REVIEW_REQUIRED', manualReviewAvailable: true,
    comparisonReason: '기후를 확정하지 못한 당시 판단입니다.',
  })]);
  await page.goto(worldReviewUrl('LOCATION|북부', { reviewStatus: 'CLOSED' }));
  const card = page.locator('[data-candidate-id="closed-world"]');
  await expect(card).toContainText('다음 분석 시작으로 검토 종료');
  await expect(card).toContainText('종료 당시 제안');
  await expect(card).not.toContainText('반영됨');
  await expect(card.getByRole('button', { name: /^(수정|제외)$/ })).toHaveCount(0);
  await expect(card).toContainText('합성 원문: 기후에 관한 합성 내용');
  await expect(card).toContainText('기후를 확정하지 못한 당시 판단입니다.');
  const groupCard = page.locator('.world-candidate-group-card.is-selected');
  await expect(groupCard).toContainText('보존된 제안 기록');
  await expect(groupCard).toContainText('검토 종료');
  await expect(groupCard).not.toContainText('검토 완료');
  await expect(groupCard).not.toContainText('검토 필요');
  await expect(page.getByRole('button', { name: '분류·대상 일괄 수정', exact: true })).toHaveCount(0);
  await expect(page.getByRole('region', { name: '묶음 확정' })).toHaveCount(0);
  await expect(page.getByText('종료된 후보의 내용과 근거를 기록으로 확인할 수 있습니다.', { exact: true })).toBeVisible();
  expect(writes).toHaveLength(0);
});

test('정상 형식으로 비교된 종료 캐릭터 후보도 당시 판단 근거를 한 번만 보여 준다', async ({ page }) => {
  const reason = '서로 다른 소속을 하나로 판단할 근거가 부족했습니다.';
  const { writes } = await routeCharacterReview(page, [characterCandidate('closed-valid-character', 0, '소속', {
    reviewStatus: 'CLOSED', reviewedApplicationMode: null, valueValidation: { status: 'VALID' },
    comparisonReason: reason,
  })]);
  await page.goto(characterReviewUrl(characterGroupKey(0), { reviewStatus: 'CLOSED' }));
  const card = page.locator('[data-candidate-id="closed-valid-character"]');
  await expect(card).toContainText('종료 당시 제안');
  await expect(card).toContainText('소속에 관한 합성 설정값입니다.');
  await expect(card.getByText(reason, { exact: true })).toHaveCount(1);
  await expect(card).toContainText('종료 당시 AI 판단 근거');
  await expect(card).not.toContainText('확인이 필요한 이유');
  expect(writes).toHaveLength(0);
});

test('종료된 미연결 캐릭터 후보는 연결 지시 없이 추출값과 판단 기록을 보존한다', async ({ page }) => {
  const { writes } = await routeCharacterReview(page, [characterCandidate('closed-unlinked', null, '역할', {
    reviewStatus: 'CLOSED', reviewedApplicationMode: null, comparisonReason: '이 인물을 구분할 근거가 부족했습니다.',
  })]);
  await page.goto(characterReviewUrl('미상', { reviewStatus: 'CLOSED' }));
  const card = page.locator('[data-candidate-id="closed-unlinked"]');
  await expect(card).toContainText('역할에 관한 합성 설정값입니다.');
  await expect(card).toContainText('합성 원문: 역할');
  await expect(card).toContainText('이 인물을 구분할 근거가 부족했습니다.');
  await expect(page.getByText('설정마다 대상을 확인해 연결해 주세요.', { exact: false })).toHaveCount(0);
  await expect(card.getByRole('button', { name: /연결|확정|수정|제외/ })).toHaveCount(0);
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
