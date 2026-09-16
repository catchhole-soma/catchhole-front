import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';

// Run only against an isolated, pre-seeded test account; never create a real account here.
const fixturePath = process.env.CATCHHOLE_FEEDBACK_LIVE_FIXTURE;

test('실제 서버에서 일회 안내와 일반 의견 저장을 완료한다', async ({ page }) => {
  test.skip(!fixturePath, '격리된 Backend 테스트 계정 fixture가 있을 때만 실행합니다.');
  const fixture = JSON.parse(readFileSync(fixturePath!, 'utf8')) as { accessToken: string; workId: string };
  await page.goto('/login');
  await page.evaluate(token => localStorage.setItem('accessToken', token), fixture.accessToken);
  await page.goto(`/dashboard?workId=${fixture.workId}&nav=manuscripts`);

  const invitation = page.getByRole('dialog', { name: '캐치홀을 사용해 주셔서 감사합니다!' });
  await expect(invitation).toBeVisible();
  await invitation.getByRole('button', { name: '의견 남기기' }).click();
  await page.getByRole('textbox', { name: '의견 내용' }).fill('🙂'.repeat(10));
  const saved = page.waitForResponse(response => response.url().endsWith('/feedbacks') && response.request().method() === 'POST');
  await page.getByRole('dialog').getByRole('button', { name: '의견 보내기', exact: true }).click();
  expect((await saved).status()).toBe(200);
  await expect(page.getByRole('dialog', { name: '의견과 추가 사용량 요청을 함께 접수했어요' })).toBeVisible();
  await page.getByRole('button', { name: '확인', exact: true }).click();

  const status = page.waitForResponse(response => response.url().endsWith('/feedbacks/prompt'));
  await page.reload();
  expect((await (await status).json()).data.shouldShow).toBe(false);
  await page.waitForTimeout(2200);
  await expect(invitation).toHaveCount(0);
  await expect(page.getByRole('button', { name: '의견 보내기', exact: true })).toBeVisible();
});
