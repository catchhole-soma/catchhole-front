import { expect, test } from '@playwright/test';
import { computedContrastRatio } from './contrast';

test('랜딩의 주 CTA는 로그인 없이 체험하기다', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/landing');

  const headerActions = page.locator('.landing-header__actions');
  const heroActions = page.locator('.landing-actions');
  const bottomActions = page.locator('.landing-cta__actions');
  const headerDemo = headerActions.getByRole('button', { name: '로그인 없이 체험하기' });
  const heroDemo = heroActions.getByRole('button', { name: '로그인 없이 체험하기' });
  const bottomDemo = bottomActions.getByRole('button', { name: '로그인 없이 체험하기' });

  await expect(headerDemo).toHaveClass(/ch-action--primary/);
  await expect(heroDemo).toHaveClass(/ch-action--primary/);
  await expect(bottomDemo).toHaveClass(/ch-action--primary/);
  await expect(heroActions.getByRole('button', { name: '지금 무료로 시작하기' })).toHaveClass(/ch-action--secondary/);
  await expect(bottomActions.getByRole('button', { name: '무료로 시작하기' })).toHaveClass(/ch-action--secondary/);

  await expect(headerDemo).toHaveCSS('min-height', '40px');
  await expect(headerDemo).toHaveCSS('background-color', 'rgb(18, 93, 230)');
  await expect(headerDemo).toHaveCSS('border-radius', '30px');
  await expect(heroDemo).toHaveCSS('min-height', '48px');
  await expect(heroDemo).toHaveCSS('background-color', 'rgb(18, 93, 230)');
  await expect(heroDemo).toHaveCSS('border-radius', '30px');
  await expect(bottomDemo).toHaveCSS('min-height', '48px');
  await expect(bottomDemo).toHaveCSS('background-color', 'rgb(18, 93, 230)');
  await expect(bottomDemo).toHaveCSS('border-radius', '30px');
  expect(await computedContrastRatio(heroDemo)).toBeGreaterThanOrEqual(4.5);
  expect(await computedContrastRatio(bottomDemo)).toBeGreaterThanOrEqual(4.5);

  await heroDemo.click();
  await expect(page).toHaveURL('/demo');
});

test('랜딩은 NHN형 제품 아코디언과 주요 서비스 카탈로그를 유지한다', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/landing');

  await expect(page.getByRole('heading', {
    level: 1,
    name: '원고 속 캐릭터와 세계관을, 근거와 함께 정리하세요',
  })).toBeVisible();

  const demoSection = page.locator('.landing-demo-section');
  await expect(demoSection).toHaveCount(1);
  await expect(page.getByRole('heading', {
    level: 2,
    name: '원고가 작품 설정이 되는 과정을 직접 확인하세요',
  })).toBeVisible();

  const demo = page.locator('.landing-demo-accordion');
  const firstTab = demo.getByRole('tab', { name: '1단계 작품 선택과 원고 목록' });
  await firstTab.focus();
  await expect(firstTab).toHaveAttribute('aria-selected', 'true');
  await expect(firstTab).toHaveCSS('opacity', '1');

  const demoTrack = demo.locator('.landing-demo-accordion__track');
  const demoPanels = page.locator('.landing-demo-panel');
  await expect(demoTrack).toHaveCSS('display', 'flex');
  await expect(demoTrack).toHaveCSS('height', '520px');
  await expect(demoTrack).toHaveCSS('column-gap', '12px');
  await expect(demoPanels).toHaveCount(8);
  await expect(demoPanels.first()).toHaveCSS('flex-grow', '11');
  await expect(demoPanels.nth(1)).toHaveCSS('flex-grow', '1');
  await expect(demoPanels.first()).toHaveCSS('border-radius', '12px');

  const quickActions = page.locator('.landing-quick-action');
  await expect(quickActions).toHaveCount(3);
  await expect(quickActions.first()).toHaveCSS('border-radius', '0px');
  await expect(quickActions.first()).toHaveCSS('box-shadow', 'none');

  const workflowRows = page.locator('.landing-feature-card');
  await expect(workflowRows).toHaveCount(8);
  await expect(workflowRows.first()).toHaveCSS('border-radius', '0px');
  await expect(workflowRows.first()).toHaveCSS('box-shadow', 'none');
  await expect(page.getByText('업데이트 예정', { exact: true })).toHaveCount(3);
  for (const service of [
    '작품 업로드',
    '캐릭터·세계관 자동 추출',
    '세계관 DB',
    '캐릭터 DB',
    '원문 근거',
    '캐릭터 관계도',
    '설정 챗봇',
    '오류 리포트',
  ]) {
    await expect(workflowRows.getByRole('heading', { level: 3, name: service })).toBeVisible();
  }

  const serviceCategories = page.locator('.landing-service-card__meta > span:first-child');
  await expect(serviceCategories).toHaveCount(8);
  for (const category of await serviceCategories.all()) {
    expect(await computedContrastRatio(category, page.locator('.landing-features'))).toBeGreaterThanOrEqual(4.5);
  }

  const finalCta = page.locator('.landing-cta');
  await expect(finalCta).toHaveCSS('background-color', 'rgb(255, 255, 255)');
  await expect(finalCta).toHaveCSS('background-image', 'none');
  await expect(finalCta).toHaveCSS('box-shadow', 'none');

  const hero = page.locator('.landing-hero');
  const trustItems = page.locator('.landing-trust__item');
  await expect(trustItems).toHaveCount(2);
  for (const trustItem of await trustItems.all()) {
    expect(await computedContrastRatio(trustItem, hero)).toBeGreaterThanOrEqual(4.5);
  }
});

test('랜딩 Hero는 넓은 화면에서 분할되고 좁은 화면에서 카피 다음에 이미지가 쌓인다', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/landing');

  const heroInner = page.locator('.landing-hero__inner');
  const heroCopy = page.locator('.landing-hero-copy');
  const heroVisual = page.locator('.landing-hero__visual');
  await expect(heroInner).toHaveCSS('display', 'grid');
  await expect(heroVisual.locator('img')).toBeVisible();

  const [desktopCopyBox, desktopVisualBox] = await Promise.all([
    heroCopy.boundingBox(),
    heroVisual.boundingBox(),
  ]);
  expect(desktopCopyBox).not.toBeNull();
  expect(desktopVisualBox).not.toBeNull();
  expect(desktopCopyBox!.x + desktopCopyBox!.width).toBeLessThanOrEqual(desktopVisualBox!.x + 1);

  await page.setViewportSize({ width: 390, height: 844 });
  const [mobileCopyBox, mobileVisualBox] = await Promise.all([
    heroCopy.boundingBox(),
    heroVisual.boundingBox(),
  ]);
  expect(mobileCopyBox).not.toBeNull();
  expect(mobileVisualBox).not.toBeNull();
  expect(mobileCopyBox!.y + mobileCopyBox!.height).toBeLessThanOrEqual(mobileVisualBox!.y + 1);
});

test('랜딩 데모는 전체 설정 관리 흐름을 직접 탐색하고 재생을 제어할 수 있다', async ({ page }) => {
  await page.goto('/landing');

  const demo = page.locator('.landing-demo-accordion');
  await expect(demo).toBeVisible();
  const stage = demo.locator('.landing-demo__native-stage');
  await expect(stage.getByText('마나 0의 짐꾼', { exact: true }).first()).toBeVisible();

  const pauseButton = demo.getByRole('button', { name: '자동 재생 일시정지' });
  await pauseButton.press('Enter');
  await expect(demo.getByRole('button', { name: '자동 재생 시작' })).toBeVisible();

  await demo.getByRole('tab', { name: '3단계 원고 분석' }).focus();
  await expect(stage.locator('.landing-native-processing__spinner')).toBeVisible();

  await demo.getByRole('tab', { name: '4단계 설정 후보 추출' }).focus();
  await expect(stage.locator('.landing-native-review-tabs .is-active')).toContainText('세계관 후보');
  await expect(stage.getByText('거꾸로숲', { exact: true }).first()).toBeVisible();

  await demo.getByRole('tab', { name: '5단계 후보 비교와 확정' }).focus();
  await expect(stage.locator('.landing-native-review-tabs .is-active')).toContainText('캐릭터 후보');
  await expect(stage.getByText('에단 렌', { exact: true }).first()).toBeVisible();
  await expect(stage.getByText('재액 운반자', { exact: true }).first()).toBeVisible();

  await demo.getByRole('tab', { name: '6단계 작품 설정 전체 목록' }).focus();
  await expect(stage.getByText('캐릭터 설정', { exact: true }).first()).toBeVisible();
  await expect(stage.locator('.landing-native-character-modal')).toHaveCount(0);

  await demo.getByRole('tab', { name: '7단계 캐릭터 상세 모달' }).focus();
  await expect(stage.locator('.landing-native-character-modal')).toBeVisible();
  await expect(stage.getByText('재액 운반자', { exact: true }).first()).toBeVisible();

  await demo.getByRole('tab', { name: '8단계 변화 이력 전체 보기' }).focus();
  await expect(stage.locator('.landing-native-timeline-modal')).toBeVisible();
  await expect(stage.getByText('전체 보기', { exact: true })).toHaveClass(/is-active/);
  await expect(stage.getByText('저주 반전', { exact: true })).toBeVisible();
});

test('랜딩 데모의 모든 장면은 휴대폰에서도 가려지거나 가로로 넘치지 않는다', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/landing');

  const demo = page.locator('.landing-demo-accordion');
  await demo.getByRole('button', { name: '자동 재생 일시정지' }).click();

  const activeStepTab = demo.locator('.landing-demo-panel.is-active .landing-demo-panel__trigger');
  const inactiveStepTab = demo.locator('.landing-demo-panel:not(.is-active) .landing-demo-panel__trigger').first();
  expect(await computedContrastRatio(activeStepTab)).toBeGreaterThanOrEqual(4.5);
  expect(await computedContrastRatio(inactiveStepTab)).toBeGreaterThanOrEqual(4.5);

  for (let index = 1; index <= 8; index += 1) {
    await demo.getByRole('tab', { name: new RegExp(`^${index}단계`) }).click();
    await expect.poll(() => demo.locator('.landing-demo-panel.is-active .landing-demo__viewport').evaluate(element => ({
      horizontal: element.scrollWidth <= element.clientWidth + 1,
      vertical: element.scrollHeight <= element.clientHeight + 1,
    }))).toEqual({ horizontal: true, vertical: true });
  }

  await expect.poll(() => page.locator('.landing-page').evaluate(element => (
    element.scrollWidth <= element.clientWidth + 1
  ))).toBe(true);
});

test('랜딩 데모는 중간 폭에서도 활성 장면을 자르지 않는다', async ({ page }) => {
  await page.setViewportSize({ width: 1025, height: 900 });
  await page.goto('/landing');

  const demo = page.locator('.landing-demo-accordion');
  const firstTab = demo.getByRole('tab', { name: '1단계 작품 선택과 원고 목록' });
  await firstTab.focus();
  await expect(firstTab).toHaveAttribute('aria-selected', 'true');

  await expect.poll(() => demo.locator('.landing-demo-panel.is-active').evaluate(panel => {
    const content = panel.querySelector<HTMLElement>('.landing-demo-panel__content');
    if (!content) return false;
    return content.getBoundingClientRect().width <= panel.getBoundingClientRect().width + 1
      && content.scrollWidth <= content.clientWidth + 1;
  })).toBe(true);
});

test('랜딩 헤더는 중간 너비에서도 주 CTA를 자르지 않는다', async ({ page }) => {
  for (const width of [521, 640]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/landing');

    const header = page.locator('.landing-header__inner');
    const primary = page.locator('.landing-header__actions').getByRole('button', { name: '로그인 없이 체험하기' });
    await expect(primary).toBeVisible();
    await expect.poll(async () => {
      const [headerBox, primaryBox] = await Promise.all([header.boundingBox(), primary.boundingBox()]);
      if (!headerBox || !primaryBox) return false;
      return primaryBox.x >= headerBox.x - 1
        && primaryBox.x + primaryBox.width <= headerBox.x + headerBox.width + 1;
    }).toBe(true);
  }
});

test('랜딩 주 CTA는 320px와 200% 확대에서도 잘리거나 가로로 넘치지 않는다', async ({ page }) => {
  const conditions = [
    { height: 844, width: 320, zoom: 1 },
    { height: 900, width: 640, zoom: 2 },
  ] as const;

  for (const condition of conditions) {
    await page.setViewportSize({ width: condition.width, height: condition.height });
    await page.goto('/landing');
    await page.locator('html').evaluate((element, zoom) => {
      element.style.zoom = String(zoom);
    }, condition.zoom);

    const headerDemo = page.locator('.landing-header__actions').getByRole('button', { name: '로그인 없이 체험하기' });
    const headerLogin = page.locator('.landing-header__actions').getByRole('button', { name: '로그인', exact: true });
    const headerSignup = page.locator('.landing-header__actions').getByRole('button', { name: '무료로 시작하기' });
    const header = page.locator('.landing-header__inner');
    await expect(headerDemo).toBeVisible();
    await expect(headerLogin).toBeVisible();
    await expect(headerSignup).toBeHidden();
    await expect.poll(() => headerDemo.evaluate(element => (
      element.scrollWidth <= element.clientWidth + 1
    ))).toBe(true);
    await expect.poll(async () => {
      const [headerBox, demoBox, loginBox] = await Promise.all([
        header.boundingBox(),
        headerDemo.boundingBox(),
        headerLogin.boundingBox(),
      ]);
      if (!headerBox || !demoBox || !loginBox) return false;
      return loginBox.x >= headerBox.x - 1
        && demoBox.x + demoBox.width <= headerBox.x + headerBox.width + 1;
    }).toBe(true);
    await expect.poll(() => page.evaluate(() => ({
      body: document.body.scrollWidth <= document.body.clientWidth + 1,
      document: document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1,
    }))).toEqual({ body: true, document: true });
  }
});

test('모바일 헤더의 로그인 버튼은 로그인 라우트 모달을 연다', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 844 });
  await page.goto('/landing');

  await page.locator('.landing-header__actions').getByRole('button', { name: '로그인', exact: true }).click();
  await expect(page).toHaveURL('/login');
});
