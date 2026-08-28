import { expect, test, type Page, type Route } from '@playwright/test';

const MEMBER = {
  id: 314,
  email: 'feedback@example.com',
  displayName: '피드백 작가',
  phoneNumber: '01012345678',
  phoneVerified: true,
  role: 'AUTHOR',
  status: 'ACTIVE',
};

function success(route: Route, data: unknown) {
  return route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ success: true, data, error: null }),
  });
}

async function enterAuthenticatedWorks(page: Page) {
  await page.goto('/login');
  await page.evaluate(() => localStorage.setItem('accessToken', 'general-feedback-token'));
  await page.goto('/works');
}

test('상단 의견 보내기는 입력을 보존하고 일반 피드백 보상 결과를 구분한다', async ({ page }) => {
  let submissionCount = 0;
  let failNextSubmission = true;
  const submittedBodies: Array<{ content: string; pagePath: string }> = [];

  await page.route('**/api/v1/**', route => {
    const request = route.request();
    const pathname = new URL(request.url()).pathname;
    if (pathname.endsWith('/auth/me')) return success(route, MEMBER);

    if (pathname.endsWith('/feedbacks') && request.method() === 'POST') {
      submittedBodies.push(request.postDataJSON() as { content: string; pagePath: string });
      if (failNextSubmission) {
        failNextSubmission = false;
        return route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({
            success: false,
            message: '서버 오류',
            data: null,
            error: { code: 'COMMON_INTERNAL_SERVER_ERROR', status: 500, details: [] },
          }),
        });
      }

      submissionCount += 1;
      return success(route, {
        id: `00000000-0000-4000-8000-00000000031${submissionCount}`,
        rewardRequestOutcome: submissionCount === 1 ? 'CREATED' : 'ALREADY_REQUESTED',
        rewardRequestId: '00000000-0000-4000-8000-000000000399',
        rewardRequestStatus: submissionCount === 1 ? 'PENDING' : 'APPROVED',
        submittedAt: '2026-08-28T16:30:00',
      });
    }

    return success(route, []);
  });

  await enterAuthenticatedWorks(page);

  const trigger = page.getByRole('button', { name: '의견 보내기', exact: true });
  await expect(trigger).toBeVisible();
  await trigger.click();

  const dialog = page.getByRole('dialog', { name: '서비스 의견 보내기' });
  const textarea = dialog.getByRole('textbox', { name: '의견 내용' });
  const submit = dialog.getByRole('button', { name: '의견 보내기', exact: true });
  const content = `  ${'서비스를 사용하면서 발견한 개선 의견입니다. '.repeat(2)}  `;

  await textarea.fill('가'.repeat(34));
  await expect(submit).toBeDisabled();
  await textarea.fill(content);
  await expect(submit).toBeEnabled();
  await submit.click();

  await expect(dialog.getByText('의견을 보내지 못했습니다.', { exact: false })).toBeVisible();
  await expect(textarea).toHaveValue(content);

  await submit.click();
  await expect(page.getByRole('dialog', { name: '의견과 추가 사용량 요청을 함께 접수했어요' })).toBeVisible();
  await expect(page.getByText(
    '소중한 의견을 보내주셔서 감사합니다. 서비스 개선을 위해 꼼꼼히 확인하겠습니다.',
  )).toBeVisible();
  expect(submittedBodies.at(-1)).toEqual({ content: content.trim(), pagePath: '/works' });

  await page.getByRole('button', { name: '확인', exact: true }).click();
  await trigger.click();
  const reopenedDialog = page.getByRole('dialog', { name: '서비스 의견 보내기' });
  await reopenedDialog.getByRole('textbox', { name: '의견 내용' }).fill('추가로 전달하는 두 번째 서비스 개선 의견입니다. '.repeat(2));
  await reopenedDialog.getByRole('button', { name: '의견 보내기', exact: true }).click();
  await expect(page.getByRole('dialog', { name: '의견이 접수됐어요' }))
    .toContainText('추가 사용량 요청은 이전 의견으로 이미 등록되어 있어요.');

  await page.setViewportSize({ width: 320, height: 640 });
  await page.getByRole('button', { name: '확인', exact: true }).click();
  const mobileTriggerBox = await trigger.boundingBox();
  expect(mobileTriggerBox).not.toBeNull();
  expect(mobileTriggerBox!.width).toBe(44);
  expect(mobileTriggerBox!.height).toBeGreaterThanOrEqual(44);
  await trigger.click();
  const mobileDialog = page.getByRole('dialog', { name: '서비스 의견 보내기' });
  const mobileDialogBox = await mobileDialog.boundingBox();
  expect(mobileDialogBox).not.toBeNull();
  expect(mobileDialogBox!.x).toBeGreaterThanOrEqual(0);
  expect(mobileDialogBox!.x + mobileDialogBox!.width).toBeLessThanOrEqual(320);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);

  const primaryContrast = await mobileDialog.getByRole('button', { name: '의견 보내기', exact: true })
    .evaluate(element => {
      const channels = (color: string) => (color.match(/[\d.]+/g) ?? []).slice(0, 3).map(Number);
      const luminance = (color: string) => {
        const rgb = channels(color).map(channel => {
          const normalized = channel / 255;
          return normalized <= 0.04045
            ? normalized / 12.92
            : ((normalized + 0.055) / 1.055) ** 2.4;
        });
        return 0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2];
      };
      const style = getComputedStyle(element);
      const foreground = luminance(style.color);
      const background = luminance(style.backgroundColor);
      return (Math.max(foreground, background) + 0.05)
        / (Math.min(foreground, background) + 0.05);
    });
  expect(primaryContrast).toBeGreaterThanOrEqual(4.5);

  await page.setViewportSize({ width: 640, height: 900 });
  await page.evaluate(() => {
    document.documentElement.style.zoom = '2';
  });
  expect(await page.evaluate(() => ({
    zoom: getComputedStyle(document.documentElement).zoom,
    noOverflow: document.documentElement.scrollWidth <= document.documentElement.clientWidth,
  }))).toEqual({ zoom: '2', noOverflow: true });
});
