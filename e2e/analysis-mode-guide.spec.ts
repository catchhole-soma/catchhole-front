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
const title = '설정 반영 방식을 비교해 보세요';

async function expectScreen(page: Page, asset: string) {
  const image = page.getByRole('dialog').getByRole('img');
  await expect(image).toBeVisible();
  await expect.poll(() => image.evaluate((node: HTMLImageElement, expectedAsset) => node.complete && node.naturalWidth > 0 && node.currentSrc.includes(expectedAsset), asset)).toBe(true);
}

test('첫 안내는 계정당 한 번이며 닫은 뒤 새 작품·새로고침에서도 자동 반복하지 않는다', async ({ page }) => {
  const { mutations } = await setup(page);
  await enter(page);
  const dialog = page.getByRole('dialog', { name: title });
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText('실제 서비스 화면에 예시 데이터를 넣었어요.');
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await page.reload();
  await page.getByRole('button', { name: /단일 회차 업로드/ }).click();
  await expect(page.getByRole('button', { name: '두 방식의 차이 보기' })).toBeVisible();
  await page.goto(`/episode-upload?workId=${otherWorkId}`);
  await page.getByRole('button', { name: /단일 회차 업로드/ }).click();
  await expect(page.getByRole('button', { name: '두 방식의 차이 보기' })).toBeVisible();
  await expect(dialog).toHaveCount(0);
  expect(mutations).toEqual(['/api/v1/analysis-mode-guide/claim']);
});

test('큰 모달에서 실제 화면을 단계별로 비교하며 실습 입력과 실제 설정 요청이 없다', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  const { mutations } = await setup(page);
  await enter(page);
  const dialog = page.getByRole('dialog', { name: title });
  await expect(dialog).toBeVisible();
  expect((await dialog.boundingBox())!.width).toBeGreaterThanOrEqual(1280);
  expect((await dialog.boundingBox())!.height).toBeGreaterThanOrEqual(950);
  await expectScreen(page, 'automatic-1-desktop');
  await page.keyboard.press('ArrowRight');
  await expect(dialog.getByRole('heading', { name: '명확한 2개는 저장되고, 미확인 1개만 남아요' })).toBeVisible();
  await expectScreen(page, 'automatic-2-desktop');
  await page.screenshot({ path: 'docs/screens/gh194/analysis-guide-desktop.png', animations: 'disabled' });
  await dialog.getByRole('tab', { name: '모든 설정 직접 검토', exact: true }).click();
  await expect(dialog.getByRole('heading', { name: '아직 저장된 설정 없이, 3개 모두 남아요' })).toBeVisible();
  await expectScreen(page, 'manual-2-desktop');
  await page.screenshot({ path: 'docs/screens/gh194/analysis-guide-manual-desktop.png', animations: 'disabled' });
  await dialog.getByRole('button', { name: '다음', exact: true }).click();
  await expectScreen(page, 'manual-3-desktop');
  await expect(dialog.locator('input, select, textarea')).toHaveCount(0);
  await expect(dialog.getByRole('button', { name: /설정 모두 확정|직접 확인해서 반영|캐릭터 일괄 연결/ })).toHaveCount(0);
  // 스크롤 영역에 초점이 있어도 단계 이동 뒤 방향키 조작이 계속된다.
  await dialog.getByRole('tabpanel').focus();
  await page.keyboard.press('ArrowRight');
  await expectScreen(page, 'manual-4-desktop');
  await page.keyboard.press('ArrowLeft');
  await expectScreen(page, 'manual-3-desktop');
  await dialog.getByRole('button', { name: '다음', exact: true }).click();
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
    await page.getByRole('button', { name: '두 방식의 차이 보기' }).click();
    await expect(page.getByRole('dialog', { name: title })).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('radio', { name: /모든 설정 직접 검토/ })).toBeChecked();
  });
}

test('다회차는 자동 반영만 안내하고 비교 방식·단계를 URL에서 복원한다', async ({ page }) => {
  await setup(page);
  await enter(page, true);
  const dialog = page.getByRole('dialog', { name: '자동 반영 과정을 살펴볼까요?' });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('tab')).toHaveCount(0);
  await page.keyboard.press('ArrowRight');
  await expectScreen(page, 'automatic-2-desktop');
  await page.reload();
  await expectScreen(page, 'automatic-2-desktop');
  await page.keyboard.press('Escape');
  await expect(page).not.toHaveURL(/guide=/);
  await page.goto(`/episode-upload?workId=${workId}&guide=analysis-mode&guideStep=3&guideMode=manual`);
  await expectScreen(page, 'manual-3-desktop');
  await expect(page.getByRole('tab', { name: '모든 설정 직접 검토' })).toHaveAttribute('aria-selected', 'true');
  await page.keyboard.press('Escape');
  await expect(page).not.toHaveURL(/guideMode=/);
});

test('320px에서 모바일 실제 화면을 쓰고 본문만 스크롤하며 탐색 버튼은 유지한다', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await setup(page);
  await enter(page);
  const dialog = page.getByRole('dialog', { name: title });
  await expect(dialog).toBeVisible();
  await page.keyboard.press('ArrowRight');
  await expectScreen(page, 'automatic-2-mobile');
  await expect(dialog.getByRole('button', { name: '다음', exact: true })).toBeInViewport();
  await page.screenshot({ path: 'docs/screens/gh194/analysis-guide-mobile.png', animations: 'disabled' });
  const autoTab = dialog.getByRole('tab', { name: 'AI 판단으로 설정 자동 반영', exact: true });
  await autoTab.focus();
  await page.keyboard.press('ArrowRight');
  await expect(dialog.getByRole('tab', { name: '모든 설정 직접 검토', exact: true })).toBeFocused();
  await expectScreen(page, 'manual-2-mobile');
  await expect(page).toHaveURL(/guideStep=2/);
  await dialog.getByRole('button', { name: '다음', exact: true }).click();
  await expectScreen(page, 'manual-3-mobile');
  await dialog.getByRole('tabpanel').evaluate(node => { node.scrollTop = node.scrollHeight; });
  expect(await dialog.evaluate(node => node.scrollWidth - node.clientWidth)).toBeLessThanOrEqual(1);
  await expect(dialog.getByRole('button', { name: '닫기', exact: true })).toBeInViewport();
  const nextHeight = (await dialog.getByRole('button', { name: '다음', exact: true }).boundingBox())!.height;
  expect(Math.round(nextHeight * 100) / 100).toBeGreaterThanOrEqual(44);
  await dialog.getByRole('button', { name: '다음', exact: true }).click();
  await expectScreen(page, 'manual-4-mobile');
  expect(await dialog.getByRole('tabpanel').evaluate(node => node.scrollTop)).toBe(0);
  await expect(dialog.getByRole('button', { name: '알겠어요' })).toBeInViewport();
});
