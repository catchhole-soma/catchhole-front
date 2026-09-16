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

  await textarea.fill('가'.repeat(9));
  await expect(submit).toBeDisabled();
  await textarea.fill('🙂'.repeat(10));
  await expect(submit).toBeEnabled();
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
  expect(mobileTriggerBox!.width).toBeGreaterThan(44);
  await expect(trigger.locator('.user-menu__feedback-label')).toBeVisible();
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

const WORK_ID = '11111111-1111-4111-8111-111111111111';
const manuscriptUrl = `/dashboard?workId=${WORK_ID}&nav=manuscripts`;

async function mockFeedbackPrompt(page: Page, options: { eligible?: boolean; processing?: boolean; batchProcessing?: boolean; claimFails?: boolean; claimDenied?: boolean } = {}) {
  let claimed = false;
  const work = { id: WORK_ID, title: '의견 안내 테스트', genre: '판타지', latestEpisodeNo: 20, lifecycleStatus: 'ACTIVE' };
  await page.route('**/api/v1/**', route => {
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith('/auth/me')) return success(route, MEMBER);
    if (path.endsWith('/feedbacks/prompt')) return success(route, { shouldShow: options.eligible !== false && !claimed });
    if (path.endsWith('/feedbacks/prompt/claim')) {
      if (options.claimFails) return route.fulfill({ status: 503, body: '{}' });
      if (options.claimDenied) return success(route, { shouldShow: false });
      const shouldShow = !claimed && options.eligible !== false;
      claimed = true;
      return success(route, { shouldShow });
    }
    if (path.endsWith('/feedbacks')) return success(route, { id: 'feedback-id', rewardRequestOutcome: 'ALREADY_REQUESTED' });
    if (path.endsWith('/works')) return success(route, [work]);
    if (path.endsWith(`/works/${WORK_ID}`)) return success(route, work);
    if (path.endsWith('/episodes')) return success(route, [1, 2, 3].map(n => ({
      id: `00000000-0000-4000-8000-00000000000${n}`, episodeNo: n === 3 ? 20 : n,
      title: `${n}화`, status: options.processing ? 'ANALYZING' : 'ANALYZED',
      analysisStatus: options.processing ? 'IN_PROGRESS' : 'COMPLETED', charCount: 1000,
    })));
    if (path.endsWith('/analysis-jobs/batches')) return success(route, {
      content: options.batchProcessing ? [{ id: 'active-batch', status: 'IN_PROGRESS' }] : [],
      totalElements: options.batchProcessing ? 1 : 0, totalPages: options.batchProcessing ? 1 : 0,
    });
    return success(route, []);
  });
  await enterAuthenticatedWorks(page);
}

test('원고 목록에서 의견 안내를 한 번 보여주고 닫은 뒤 새로고침해도 다시 표시하지 않는다', async ({ page }) => {
  await mockFeedbackPrompt(page);
  await page.goto(manuscriptUrl);
  await expect(page.getByText('남은 사용량', { exact: true })).toHaveCount(0);
  const invitation = page.getByRole('dialog', { name: '캐치홀을 사용해 주셔서 감사합니다!' });
  await expect(invitation).toBeVisible();
  await page.screenshot({ path: 'output/feedback-invitation-desktop.png' });
  await invitation.getByRole('button', { name: '닫기', exact: true }).click();
  await expect(page.getByRole('button', { name: '의견 보내기', exact: true })).toBeFocused();
  await page.reload();
  await expect(page.getByText('총 3개 회차')).toBeVisible();
  // 자동 노출 유예 시간 이후에도 서버에 기록한 닫기 상태를 유지해야 한다.
  await page.waitForTimeout(2600);
  await expect(invitation).toHaveCount(0);
  await page.getByRole('button', { name: '의견 보내기', exact: true }).click();
  await expect(page.getByRole('dialog', { name: '서비스 의견 보내기' })).toBeVisible();
});

test('자동 안내에서 10자 의견을 보내고 모바일에서도 라벨과 동작을 유지한다', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await mockFeedbackPrompt(page);
  await page.goto(manuscriptUrl);
  const invitation = page.getByRole('dialog', { name: '캐치홀을 사용해 주셔서 감사합니다!' });
  await expect(invitation).toBeVisible();
  await page.screenshot({ path: 'output/feedback-invitation-mobile.png' });
  await invitation.getByRole('button', { name: '의견 남기기' }).click();
  const textarea = page.getByRole('textbox', { name: '의견 내용' });
  await expect(textarea).toBeFocused();
  await textarea.fill('🙂'.repeat(10));
  await page.getByRole('dialog').getByRole('button', { name: '의견 보내기', exact: true }).click();
  await expect(page.getByRole('dialog', { name: '의견이 접수됐어요' })).toBeVisible();
  await page.getByRole('button', { name: '확인', exact: true }).click();
  await expect(page.locator('.user-menu__feedback-label')).toBeVisible();
  for (const width of [320, 375, 390, 412]) {
    await page.setViewportSize({ width, height: 800 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    const brand = await page.getByRole('button', { name: '작품 선택으로 이동' }).boundingBox();
    const feedback = await page.getByRole('button', { name: '의견 보내기', exact: true }).boundingBox();
    expect(brand && feedback && (brand.x + brand.width <= feedback.x || brand.y + brand.height <= feedback.y)).toBe(true);
  }
});

for (const scenario of [
  { name: '노출 대상이 아닌 계정', options: { eligible: false } },
  { name: '분석 진행 중', options: { processing: true } },
  { name: '회차 분석 완료 후 세계관 비교 진행 중', options: { batchProcessing: true } },
  { name: '노출 기록 서버 장애', options: { claimFails: true } },
  { name: '다른 탭에서 먼저 안내한 계정', options: { claimDenied: true } },
]) {
  test(`${scenario.name}에는 자동 안내를 띄우지 않고 수동 의견 보내기를 유지한다`, async ({ page }) => {
    await mockFeedbackPrompt(page, scenario.options);
    await page.goto(manuscriptUrl);
    await expect(page.getByText('총 3개 회차')).toBeVisible();
    if ('batchProcessing' in scenario.options) {
      await expect(page.getByText('진행 중인 분석이 있습니다.', { exact: true })).toBeVisible();
    }
    await page.waitForTimeout(2600);
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await page.getByRole('button', { name: '의견 보내기', exact: true }).click();
    await expect(page.getByRole('dialog', { name: '서비스 의견 보내기' })).toBeVisible();
  });
}

test('다른 모달을 열고 있을 때는 자동 안내가 끼어들지 않는다', async ({ page }) => {
  await mockFeedbackPrompt(page);
  await page.goto(manuscriptUrl);
  await page.getByRole('button', { name: '의견 보내기', exact: true }).click();
  await page.getByRole('textbox', { name: '의견 내용' }).fill('작성 중인 의견');
  await page.waitForTimeout(2600);
  await expect(page.getByRole('dialog')).toHaveCount(1);
  await expect(page.getByRole('textbox', { name: '의견 내용' })).toHaveValue('작성 중인 의견');
  await page.getByRole('button', { name: '취소', exact: true }).click();
  await expect(page.getByRole('dialog', { name: '캐치홀을 사용해 주셔서 감사합니다!' })).toBeVisible();
});


test('노출 기록 응답이 늦게 도착해도 검토 화면으로 이동한 사용자를 방해하지 않는다', async ({ page }) => {
  await mockFeedbackPrompt(page);
  let release: () => void = () => {};
  const responseReady = new Promise<void>(resolve => { release = resolve; });
  await page.route('**/feedbacks/prompt/claim', async route => {
    await responseReady;
    await success(route, { shouldShow: true });
  });
  const claim = page.waitForRequest('**/feedbacks/prompt/claim');
  await page.goto(manuscriptUrl);
  await claim;
  await page.getByRole('button', { name: '작품 설정', exact: true }).click();
  await expect(page).toHaveURL(/nav=settingDB/);
  release();
  await page.waitForTimeout(300);
  await expect(page.getByRole('dialog', { name: '캐치홀을 사용해 주셔서 감사합니다!' })).toHaveCount(0);
});


test('노출 응답을 기다리는 동안 시작한 원고 제목 입력의 포커스를 빼앗지 않는다', async ({ page }) => {
  await mockFeedbackPrompt(page);
  let release: () => void = () => {};
  const responseReady = new Promise<void>(resolve => { release = resolve; });
  await page.route('**/feedbacks/prompt/claim', async route => {
    await responseReady;
    await success(route, { shouldShow: true });
  });
  const claim = page.waitForRequest('**/feedbacks/prompt/claim');
  await page.goto(manuscriptUrl);
  await claim;
  await page.getByTitle('제목 수정', { exact: true }).first().click();
  const title = page.getByRole('textbox', { name: '1화 제목' });
  await title.fill('작성 중인 제목');
  const response = page.waitForResponse('**/feedbacks/prompt/claim');
  release();
  await response;
  await expect(title).toBeFocused();
  await expect(title).toHaveValue('작성 중인 제목');
  await expect(page.getByRole('dialog', { name: '캐치홀을 사용해 주셔서 감사합니다!' })).toHaveCount(0);
});
