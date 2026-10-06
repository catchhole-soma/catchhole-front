import { expect, test, type Page } from '@playwright/test';
import { computedContrastRatio } from './contrast';

const workId = '11111111-1111-4111-8111-111111111111';
const otherWorkId = '22222222-2222-4222-8222-222222222222';
async function setup(page: Page, { eligible = true, fail = false, claimEligible = true, failFirstClaim = false } = {}) {
  const mutations: string[] = [];
  const requests: string[] = [];
  let consumed = false;
  let claims = 0;
  await page.route('**/api/v1/**', async route => {
    const path = new URL(route.request().url()).pathname;
    requests.push(path);
    if (route.request().method() !== 'GET') mutations.push(path);
    let data: unknown = [];
    if (path.endsWith('/auth/me')) data = { id: 1, email: 'guide@example.com', displayName: '안내 테스트', role: 'AUTHOR', status: 'ACTIVE' };
    else if (/\/works\/[^/]+$/.test(path)) data = { id: path.split('/').at(-1), title: '처음 쓰는 작품', lifecycleStatus: 'ACTIVE' };
    else if (path.endsWith('/episodes/upload-policy')) data = { pendingCharacterCandidateCount: 0, pendingWorldSettingCandidateCount: 0, maxUploadCharacters: 250000 };
    else if (path.endsWith('/analysis-mode-guides')) {
      if (fail) return route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ success: false }) });
      data = { shouldShow: eligible && !consumed };
    } else if (path.endsWith('/analysis-mode-guides/claim')) {
      if (failFirstClaim && claims++ === 0) return route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ success: false }) });
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
const title = '설정이 반영되는 과정을 살펴보세요';

test('첫 안내는 계정당 한 번이며 닫은 뒤 새 작품·새로고침에서도 자동 반복하지 않는다', async ({ page }) => {
  const { mutations } = await setup(page);
  await enter(page);
  const dialog = page.getByRole('dialog', { name: title });
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText('실제 화면에 예시 데이터를 넣었어요.');
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await page.reload();
  await page.getByRole('button', { name: /단일 회차 업로드/ }).click();
  await expect(page.getByRole('button', { name: '두 방식의 차이 보기' })).toBeVisible();
  await page.goto(`/episode-upload?workId=${otherWorkId}`);
  await page.getByRole('button', { name: /단일 회차 업로드/ }).click();
  await expect(page.getByRole('button', { name: '두 방식의 차이 보기' })).toBeVisible();
  await expect(dialog).toHaveCount(0);
  expect(mutations).toEqual(['/api/v1/analysis-mode-guides/claim']);
});

test('한 줄의 5단계에서 실제 컴포넌트를 보여주고 예시 조작은 차단한다', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  const { mutations, requests } = await setup(page);
  await enter(page);
  const dialog = page.getByRole('dialog', { name: title });
  expect((await dialog.boundingBox())!.width).toBeGreaterThanOrEqual(1280);
  expect((await dialog.boundingBox())!.height).toBeGreaterThanOrEqual(950);
  await expect(dialog.getByRole('tablist')).toHaveCount(0);
  const steps = dialog.getByRole('navigation', { name: '안내 단계' });
  await expect(steps.getByRole('button')).toHaveText(['1반영 방식', '2모든 설정 직접 검토', '3AI 자동 반영', '4자동 반영 후 직접 검토', '5검토 완료']);
  const positions = await steps.getByRole('button').evaluateAll(nodes => nodes.map(node => node.getBoundingClientRect().top));
  expect(new Set(positions).size).toBe(1);
  await expect(dialog.locator('img, picture')).toHaveCount(0);
  await expect(dialog.locator('.episode-analysis-mode')).toBeVisible();
  const preview = dialog.locator('.analysis-guide-preview');
  await expect(preview.locator('[inert]')).toHaveCount(1);
  await page.screenshot({ path: 'docs/screens/gh215/analysis-guide-mode-desktop.png', animations: 'disabled' });
  // 실제 업로드의 radio와 예시의 radio가 같은 그룹이 되어 선택을 바꾸지 않는다.
  const manualRadio = preview.locator('input[value="MANUAL"]');
  await manualRadio.evaluate(node => (node as HTMLElement).focus());
  await expect(manualRadio).not.toBeFocused();
  const radioBox = (await manualRadio.boundingBox())!;
  await page.mouse.click(radioBox.x + 5, radioBox.y + 5);
  await expect(preview.locator('input[value="AUTOMATIC"]')).toBeChecked();
  await page.keyboard.press('ArrowRight');
  await expect(dialog.getByRole('heading', { name: '모든 설정을 직접 보고 확정해요' })).toBeVisible();
  await expect(preview.locator('.setting-candidate-detail')).toHaveCount(2);
  await expect(preview.locator('.setting-review-summary__item.is-direct strong')).toHaveText('3개');
  await expect(preview.locator('.candidate-group-card')).toHaveCount(2);
  await expect(preview.locator('.candidate-group-card').first()).toContainText('레온');
  await expect(preview.locator('.candidate-group-card').last()).toContainText('인물 미상');
  await expect(preview.locator('.review-cb-heading__image img')).toHaveCount(2);
  await expect(preview.locator('.setting-candidate-detail').first().locator('.review-cb-comparison')).toHaveCount(0);
  const comparison = preview.locator('.review-cb-comparison.is-change');
  await expect(comparison).toHaveCount(1);
  await expect(comparison.locator('.is-before')).toContainText('왕국 정찰병');
  await expect(comparison.locator('.is-after')).toContainText('북부 원정대 정찰병');
  await expect(comparison.locator('mark')).not.toHaveCount(0);
  const selectedChoice = preview.locator('.review-cb-choice[aria-pressed=true]').first();
  await expect(selectedChoice.locator('.review-cb-choice__effect')).toHaveCount(0);
  expect(await computedContrastRatio(selectedChoice.locator('strong'), selectedChoice)).toBeGreaterThanOrEqual(4.5);
  expect(await computedContrastRatio(selectedChoice.locator('.review-cb-choice__preview'), selectedChoice)).toBeGreaterThanOrEqual(4.5);
  await expect(preview.locator('iframe, picture')).toHaveCount(0);
  const storageBefore = await page.evaluate(() => ({ local: { ...localStorage }, session: { ...sessionStorage } }));
  await expect.poll(() => preview.locator('.review-cb-heading__image img').first().evaluate(node => (node as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
  await page.screenshot({ path: 'docs/screens/gh215/analysis-guide-manual-desktop.png', animations: 'disabled' });
  await comparison.scrollIntoViewIfNeeded();
  await page.screenshot({ path: 'docs/screens/gh215/analysis-guide-diff-desktop.png', animations: 'disabled' });
  const before = requests.length;
  const edit = preview.locator('.setting-candidate-detail').last().getByRole('button', { name: '수정', exact: true });
  const box = (await edit.boundingBox())!;
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  await expect(page.getByRole('dialog')).toHaveCount(1);
  expect(requests.length).toBe(before);
  await dialog.getByRole('region', { name: '단계별 예시' }).focus();
  await page.keyboard.press('ArrowRight');
  await expect(preview.locator('.character-simple-settings')).toContainText('엘프');
  await expect(preview.locator('.character-simple-settings')).toContainText('북부 원정대 정찰병');
  await expect(preview.locator('.setting-candidate-detail')).toHaveCount(0);
  await expect(preview.locator('.setting-review-summary__item.is-confirmed strong')).toHaveText('2개');
  await page.screenshot({ path: 'docs/screens/gh215/analysis-guide-desktop.png', animations: 'disabled' });
  await page.keyboard.press('ArrowRight');
  await expect(preview.locator('.setting-candidate-detail')).toHaveCount(1);
  await expect(preview.locator('.setting-candidate-detail')).toContainText('누구에 관한 내용인가요?');
  await expect(preview.locator('.review-character-targets .review-cb-choice')).toHaveCount(3);
  await expect(preview.locator('.review-character-targets .review-cb-choice')).toContainText(['레온', '유나', '새로운 인물']);
  await expect(preview.locator('.review-cb-heading')).toContainText('인물 확인 필요');
  await expect(preview).not.toContainText('자동 비교를 마치지 못했어요');
  await expect(preview.locator('.review-cb-heading__image img')).toHaveCount(1);
  const target = preview.locator('.review-character-targets .review-cb-choice').first();
  await target.scrollIntoViewIfNeeded();
  await target.evaluate(node => (node as HTMLElement).focus());
  await expect(target).not.toBeFocused();
  const targetBox = (await target.boundingBox())!;
  await page.mouse.click(targetBox.x + targetBox.width / 2, targetBox.y + targetBox.height / 2);
  await expect(target).toHaveAttribute('aria-pressed', 'false');
  await expect(preview.locator('.review-character-targets')).toBeVisible();
  await dialog.getByRole('region', { name: '단계별 예시' }).focus();
  await page.screenshot({ path: 'docs/screens/gh215/analysis-guide-exception-desktop.png', animations: 'disabled' });
  await page.keyboard.press('ArrowRight');
  await expect(preview.locator('.setting-review-page')).toContainText('모든 설정 후보 검토를 완료했습니다.');
  await expect(preview.locator('.setting-review-summary__item.is-direct strong')).toHaveText('0개');
  await expect(preview.locator('.setting-review-summary__item.is-confirmed strong')).toHaveText('3개');
  await page.screenshot({ path: 'docs/screens/gh215/analysis-guide-complete-desktop.png', animations: 'disabled' });
  await page.keyboard.press('ArrowLeft');
  await expect(page).toHaveURL(/guideStep=4/);
  await dialog.getByRole('button', { name: '다음', exact: true }).click();
  await dialog.getByRole('button', { name: '알겠어요' }).click();
  await expect(page.getByRole('radio', { name: /AI 판단으로 설정 자동 반영/ })).toBeChecked();
  expect(mutations).toEqual(['/api/v1/analysis-mode-guides/claim']);
  expect(requests.filter(path => /characters|world-settings|private-world-images|setting-candidates|analysis-jobs/.test(path))).toEqual([]);
  expect(await page.evaluate(() => ({ local: { ...localStorage }, session: { ...sessionStorage } }))).toEqual(storageBefore);
});

for (const mode of ['existing', 'failed', 'claimed-elsewhere']) {
  test(`${mode}: 자동 안내 없이 업로드를 유지하고 도움말은 직접 열 수 있다`, async ({ page }) => {
    const fixture = await setup(page, { eligible: mode !== 'existing', fail: mode === 'failed', claimEligible: mode !== 'claimed-elsewhere' });
    await enter(page);
    await expect.poll(() => fixture.requests.some(path => path.endsWith('/analysis-mode-guides'))).toBe(true);
    if (mode === 'claimed-elsewhere') await expect.poll(() => fixture.mutations.length).toBe(1);
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await page.getByRole('radio', { name: /모든 설정 직접 검토/ }).check();
    await page.getByRole('button', { name: '두 방식의 차이 보기' }).click();
    const dialog = page.getByRole('dialog', { name: title });
    await expect(dialog.getByRole('heading', { name: title })).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(dialog).toHaveCount(0);
    await expect(page.getByRole('radio', { name: /모든 설정 직접 검토/ })).toBeChecked();
  });
}

test('안내 제목에 초점이 들어오는 즉시 Escape를 눌러도 닫힌다', async ({ page }) => {
  await setup(page, { eligible: false });
  await enter(page);
  await page.evaluate(dialogTitle => {
    const closeOnFocus = (event: FocusEvent) => {
      const target = event.target;
      if (!(target instanceof HTMLElement) || target.textContent !== dialogTitle) return;
      document.removeEventListener('focusin', closeOnFocus);
      target.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
      document.body.dataset.guideEscapeDispatched = 'true';
    };
    document.addEventListener('focusin', closeOnFocus);
  }, title);
  await page.getByRole('button', { name: '두 방식의 차이 보기' }).click();
  await expect(page.locator('body')).toHaveAttribute('data-guide-escape-dispatched', 'true');
  await expect(page.getByRole('dialog', { name: title })).toHaveCount(0);
  await expect(page).not.toHaveURL(/guide=analysis-mode/);
});

test('다회차의 자동 반영 정책을 안내하고 5단계를 URL에서 복원한다', async ({ page }) => {
  await setup(page);
  await enter(page, true);
  const dialog = page.getByRole('dialog', { name: title });
  await expect(dialog).toContainText('지금 선택한 다회차 업로드는 자동 반영으로 진행돼요.');
  await page.keyboard.press('ArrowRight');
  await expect(page).toHaveURL(/guideStep=2(?:&|$)/);
  await expect(dialog.getByRole('heading', { name: '모든 설정을 직접 보고 확정해요' })).toBeVisible();
  await page.keyboard.press('ArrowRight');
  await expect(page).toHaveURL(/guideStep=3(?:&|$)/);
  await expect(dialog.getByRole('heading', { name: '명확한 설정은 AI가 바로 반영해요' })).toBeVisible();
  await page.reload();
  await expect(dialog.getByRole('heading', { name: '명확한 설정은 AI가 바로 반영해요' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page).not.toHaveURL(/guide=/);
  await page.goto(`/episode-upload?workId=${workId}&guide=analysis-mode&guideStep=5&guideMode=manual`);
  await expect(dialog.getByRole('heading', { name: '남은 설정을 확정하면 검토가 끝나요' })).toBeVisible();
  await expect(dialog.getByRole('tab')).toHaveCount(0);
  await page.keyboard.press('Escape');
  await expect(page).not.toHaveURL(/guideMode=/);
});

test('320px에서 단계 바는 한 줄이고 실제 컴포넌트가 재배치되며 탐색 버튼은 유지한다', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await setup(page);
  await enter(page);
  const dialog = page.getByRole('dialog', { name: title });
  await expect(dialog).toBeVisible();
  const steps = dialog.getByRole('navigation', { name: '안내 단계' });
  const positions = await steps.getByRole('button').evaluateAll(nodes => nodes.map(node => node.getBoundingClientRect().top));
  expect(new Set(positions).size).toBe(1);
  await dialog.getByRole('button', { name: '다음', exact: true }).click();
  const region = dialog.getByRole('region', { name: '단계별 예시' });
  await expect(dialog.locator('.setting-candidate-detail')).toHaveCount(2);
  expect(await region.evaluate(node => node.scrollWidth - node.clientWidth)).toBeLessThanOrEqual(1);
  await region.evaluate(node => { node.scrollTop = node.scrollHeight; });
  await expect(dialog.getByRole('button', { name: '닫기', exact: true })).toBeInViewport();
  await expect(dialog.getByRole('button', { name: '다음', exact: true })).toBeInViewport();
  await dialog.getByRole('button', { name: '다음', exact: true }).click();
  await expect.poll(() => region.evaluate(node => node.scrollTop)).toBe(0);
  await page.screenshot({ path: 'docs/screens/gh215/analysis-guide-mobile.png', animations: 'disabled' });
  await dialog.getByRole('button', { name: '다음', exact: true }).click();
  await expect(dialog.locator('.setting-candidate-detail')).toHaveCount(1);
  await expect(dialog.locator('.review-character-targets .review-cb-choice')).toHaveCount(3);
  await dialog.locator('.review-character-targets .review-cb-choice').first().scrollIntoViewIfNeeded();
  await dialog.locator('.review-character-targets .review-cb-choice img').evaluateAll(nodes => Promise.all(nodes.map(node => (node as HTMLImageElement).decode())));
  await page.screenshot({ path: 'docs/screens/gh215/analysis-guide-choices-mobile.png', animations: 'disabled' });
  expect(await region.evaluate(node => node.scrollWidth - node.clientWidth)).toBeLessThanOrEqual(1);
  await dialog.getByRole('button', { name: '다음', exact: true }).click();
  await expect(steps.getByRole('button', { name: /5.*검토 완료/ })).toBeInViewport();
  expect(Math.round((await dialog.getByRole('button', { name: '알겠어요' }).boundingBox())!.height)).toBeGreaterThanOrEqual(44);
  await expect(dialog.getByRole('button', { name: '알겠어요' })).toBeInViewport();
});


test('자동 기록 실패 뒤 수동으로 본 안내도 계정에 기록한다', async ({ page }) => {
  const { mutations } = await setup(page, { failFirstClaim: true });
  await enter(page);
  await expect.poll(() => mutations.filter(path => path.endsWith('/claim')).length).toBe(1);
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.getByRole('button', { name: '두 방식의 차이 보기', exact: true }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect.poll(() => mutations.filter(path => path.endsWith('/claim')).length).toBe(2);
  await page.reload();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.getByRole('button', { name: '닫기', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
});
