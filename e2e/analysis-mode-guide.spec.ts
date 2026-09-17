import { expect, test, type Page } from '@playwright/test';

const workId = '11111111-1111-4111-8111-111111111111';
const otherWorkId = '22222222-2222-4222-8222-222222222222';
async function setup(page: Page, { eligible = true, fail = false, claimEligible = true } = {}) {
  const mutations: string[] = [];
  const requests: string[] = [];
  let consumed = false;
  await page.route('**/api/v1/**', async route => {
    const path = new URL(route.request().url()).pathname;
    requests.push(path);
    if (route.request().method() !== 'GET') mutations.push(path);
    let data: unknown = [];
    if (path.endsWith('/auth/me')) data = { id: 1, email: 'guide@example.com', displayName: '안내 테스트', role: 'AUTHOR', status: 'ACTIVE' };
    else if (/\/works\/[^/]+$/.test(path)) data = { id: path.split('/').at(-1), title: '처음 쓰는 작품', lifecycleStatus: 'ACTIVE' };
    else if (path.endsWith('/episodes/upload-policy')) data = { pendingCharacterCandidateCount: 0, pendingWorldSettingCandidateCount: 0, maxUploadCharacters: 250000 };
    else if (path.endsWith('/analysis-mode-guide')) {
      if (fail) return route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ success: false }) });
      data = { shouldShow: eligible && !consumed };
    } else if (path.endsWith('/analysis-mode-guide/claim')) {
      data = { shouldShow: eligible && claimEligible && !consumed }; consumed = true;
    }
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data, error: null }) });
  });
  await page.addInitScript(() => localStorage.setItem('accessToken', 'guide-fixture'));
  return { mutations, requests };
}
async function enter(page: Page, multiple = false) {
  await page.goto(`/episode-upload?workId=${workId}`);
  await page.getByRole('button', { name: multiple ? /다회차 - 단일 파일/ : /단일 회차 업로드/ }).click();
}
const title = '설정은 언제 작품에 저장될까요?';

test('첫 안내는 계정당 한 번이며 닫은 뒤 새 작품·새로고침에서도 자동 반복하지 않는다', async ({ page }) => {
  const { mutations } = await setup(page);
  await enter(page);
  const dialog = page.getByRole('dialog', { name: title });
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText('실제 작품에는 저장되지 않아요.');
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await page.reload();
  await page.getByRole('button', { name: /단일 회차 업로드/ }).click();
  await expect(page.getByRole('button', { name: '두 방식의 차이 체험하기' })).toBeVisible();
  await page.goto(`/episode-upload?workId=${otherWorkId}`);
  await page.getByRole('button', { name: /단일 회차 업로드/ }).click();
  await expect(page.getByRole('button', { name: '두 방식의 차이 체험하기' })).toBeVisible();
  await expect(dialog).toHaveCount(0);
  expect(mutations).toEqual(['/api/v1/analysis-mode-guide/claim']);
});

test('방향키와 확정 실습은 저장 시점의 차이를 보여주며 실제 설정 API를 호출하지 않는다', async ({ page }) => {
  const { mutations } = await setup(page);
  await enter(page);
  const dialog = page.getByRole('dialog', { name: title });
  await expect(dialog).toBeVisible();
  await page.keyboard.press('ArrowRight');
  await expect(dialog.getByRole('heading', { name: '저장되는 시점이 달라요' })).toBeVisible();
  const auto = dialog.getByRole('region', { name: '자동 반영 예시' });
  const manual = dialog.getByRole('region', { name: '직접 검토 예시' });
  await expect(auto.locator('.analysis-mode-guide__counts')).toHaveText('반영됨 2직접 확인 1');
  await expect(manual.locator('.analysis-mode-guide__counts')).toHaveText('반영됨 0직접 확인 3');
  // 공통 모달의 muted !important 규칙이 상태 색상을 덮는 회귀를 막는다.
  await expect(auto.locator('.analysis-mode-guide__status.is-saved').first()).toHaveCSS('color', 'rgb(6, 105, 71)');
  await expect(manual.locator('.analysis-mode-guide__status').first()).toHaveCSS('color', 'rgb(138, 75, 0)');
  const contrasts = await dialog.locator('.analysis-mode-guide__status').evaluateAll(elements => {
    const luminance = (color: string) => {
      const rgb = (color.match(/[\d.]+/g) ?? []).slice(0, 3).map(value => {
        const channel = Number(value) / 255;
        return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
      });
      return rgb[0] * 0.2126 + rgb[1] * 0.7152 + rgb[2] * 0.0722;
    };
    return elements.map(element => {
      const foreground = luminance(getComputedStyle(element).color);
      const background = luminance(getComputedStyle(element.closest('[role="dialog"]')!).backgroundColor);
      return (Math.max(foreground, background) + 0.05) / (Math.min(foreground, background) + 0.05);
    });
  });
  for (const contrast of contrasts) expect(contrast).toBeGreaterThanOrEqual(4.5);
  await page.screenshot({ path: 'docs/screens/gh194/analysis-guide-desktop.png', animations: 'disabled' });
  await page.keyboard.press('ArrowRight');
  await expect(manual.getByRole('button', { name: '확인한 설정 3개 확정해 보기' })).toBeDisabled();
  await auto.getByLabel('치유 능력의 대상').selectOption('유나');
  await auto.getByRole('button', { name: '남은 설정 1개 확정해 보기' }).click();
  await expect(auto.locator('.analysis-mode-guide__counts')).toHaveText('반영됨 3직접 확인 0');
  await expect(manual.locator('.analysis-mode-guide__counts')).toHaveText('반영됨 0직접 확인 3');
  await manual.getByLabel('치유 능력의 대상').selectOption('레온');
  await manual.getByRole('button', { name: '확인한 설정 3개 확정해 보기' }).click();
  await page.keyboard.press('ArrowRight');
  await expect(dialog.getByRole('heading', { name: '작품에 남는 내용을 확인해요' })).toBeVisible();
  await expect(manual.locator('.analysis-mode-guide__counts')).toHaveText('반영됨 3직접 확인 0');
  await dialog.getByRole('button', { name: '알겠어요' }).click();
  await expect(page.getByRole('radio', { name: /AI 판단으로 설정 자동 반영/ })).toBeChecked();
  expect(mutations).toEqual(['/api/v1/analysis-mode-guide/claim']);
});

for (const mode of ['existing', 'failed', 'claimed-elsewhere']) {
  test(`${mode}: 자동 안내 없이 업로드를 유지하고 도움말은 직접 열 수 있다`, async ({ page }) => {
    const fixture = await setup(page, { eligible: mode !== 'existing', fail: mode === 'failed', claimEligible: mode !== 'claimed-elsewhere' });
    await enter(page);
    await expect.poll(() => fixture.requests.some(path => path.endsWith('/analysis-mode-guide'))).toBe(true);
    if (mode === 'claimed-elsewhere') await expect.poll(() => fixture.mutations.length).toBe(1);
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await page.getByRole('radio', { name: /모든 설정 직접 검토/ }).check();
    await page.getByRole('button', { name: '두 방식의 차이 체험하기' }).click();
    await expect(page.getByRole('dialog', { name: title })).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('radio', { name: /모든 설정 직접 검토/ })).toBeChecked();
  });
}

test('다회차 안내에는 자동 반영만 표시하고 URL 직접 진입과 단계 새로고침을 지원한다', async ({ page }) => {
  await setup(page);
  await enter(page, true);
  const dialog = page.getByRole('dialog', { name: '자동 반영 과정을 살펴볼까요?' });
  await expect(dialog).toBeVisible();
  await page.keyboard.press('ArrowRight');
  await expect(dialog.getByRole('region', { name: '자동 반영 예시' })).toBeVisible();
  await expect(dialog.getByRole('region', { name: '직접 검토 예시' })).toHaveCount(0);
  await page.reload();
  await expect(dialog.getByRole('heading', { name: '저장되는 시점이 달라요' })).toBeVisible();
  await expect(page).toHaveURL(/guideStep=2/);
  await page.keyboard.press('Escape');
  await expect(page).not.toHaveURL(/guide=/);
});

test('320px에서 본문만 스크롤하고 확정·닫기·방향 버튼을 조작할 수 있다', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await setup(page);
  await enter(page);
  const dialog = page.getByRole('dialog', { name: title });
  await expect(dialog).toBeVisible();
  await page.keyboard.press('ArrowRight');
  await expect(dialog.getByRole('button', { name: '다음', exact: true })).toBeInViewport();
  await page.screenshot({ path: 'docs/screens/gh194/analysis-guide-mobile.png', animations: 'disabled' });
  await dialog.getByRole('tab', { name: '직접 검토', exact: true }).click();
  await expect(dialog.getByRole('region', { name: '직접 검토 예시' })).toBeVisible();
  await expect(dialog.getByRole('region', { name: '자동 반영 예시' })).not.toBeVisible();
  await dialog.getByRole('button', { name: '다음', exact: true }).click();
  const manual = dialog.getByRole('region', { name: '직접 검토 예시' });
  await manual.getByLabel('치유 능력의 대상').selectOption('레온');
  await manual.getByRole('button', { name: '확인한 설정 3개 확정해 보기' }).click();
  await expect(manual.getByRole('status')).toContainText('모두 확정');
  expect(await dialog.evaluate(node => node.scrollWidth - node.clientWidth)).toBeLessThanOrEqual(1);
  await expect(dialog.getByRole('button', { name: '닫기', exact: true })).toBeInViewport();
  const nextHeight = (await dialog.getByRole('button', { name: '다음', exact: true }).boundingBox())!.height;
  expect(Math.round(nextHeight * 100) / 100).toBeGreaterThanOrEqual(44);
  await dialog.getByRole('button', { name: '다음', exact: true }).click();
  await expect(dialog.getByRole('button', { name: '알겠어요' })).toBeInViewport();
});
