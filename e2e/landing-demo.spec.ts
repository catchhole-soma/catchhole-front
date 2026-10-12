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

  await expect(heroActions).toBeHidden();
  await page.locator('.landing-page').evaluate(container => {
    const hero = container.querySelector<HTMLElement>('.lvh-story')!;
    const top = hero.getBoundingClientRect().top - container.getBoundingClientRect().top + container.scrollTop;
    container.scrollTo({ top: top + hero.offsetHeight - container.clientHeight, behavior: 'instant' });
  });
  await expect(heroActions).toBeVisible();

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

test('랜딩은 네 장면 제품 소개와 주요 서비스 카탈로그를 유지한다', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/landing');

  await expect(page.getByRole('heading', {
    level: 1,
    name: '설정 추출부터 검수까지 캐치홀 하나로',
  })).toBeVisible();

  const demoSection = page.locator('.landing-demo-section');
  await expect(demoSection).toHaveCount(1);
  await expect(page.getByRole('heading', {
    level: 2,
    name: '원고가 작품 설정이 되는 과정을 직접 확인하세요',
  })).toBeVisible();

  const productStory = page.locator('.landing-product-story');
  await expect(productStory.locator('article')).toHaveCount(4);
  await expect(productStory.getByRole('tab')).toHaveCount(0);
  await expect(productStory.getByRole('button')).toHaveCount(0);
  for (const card of await productStory.locator('article').all()) {
    for (const text of await card.locator('h3, .product-story__copy > p, .product-story__eyebrow, .product-story__note').all()) {
      expect(await computedContrastRatio(text, card)).toBeGreaterThanOrEqual(4.5);
    }
  }

  const quickActions = page.locator('.landing-quick-action');
  await expect(quickActions).toHaveCount(3);
  await expect(quickActions.first()).toHaveCSS('border-radius', '0px');
  await expect(quickActions.first()).toHaveCSS('box-shadow', 'none');

  const workflowRows = page.locator('.landing-feature-card');
  await expect(workflowRows).toHaveCount(8);
  await expect(workflowRows.first()).toHaveCSS('border-radius', '24px');
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
  for (const card of await workflowRows.all()) {
    const category = card.locator('.landing-service-card__meta > span:first-child');
    expect(await computedContrastRatio(category, card)).toBeGreaterThanOrEqual(4.5);
    expect(await computedContrastRatio(card.locator('h3'), card)).toBeGreaterThanOrEqual(4.5);
    expect(await computedContrastRatio(card.locator('p'), card)).toBeGreaterThanOrEqual(4.5);
  }
  for (const card of await quickActions.all()) {
    expect(await computedContrastRatio(card.locator('strong'), page.locator('.landing-quick-actions'))).toBeGreaterThanOrEqual(4.5);
    expect(await computedContrastRatio(card.locator('.landing-quick-action__copy > span'), page.locator('.landing-quick-actions'))).toBeGreaterThanOrEqual(4.5);
  }

  const finalCta = page.locator('.landing-cta');
  await expect(finalCta).toHaveCSS('background-color', 'rgb(255, 255, 255)');
  await expect(finalCta).toHaveCSS('background-image', 'none');
  await expect(finalCta).toHaveCSS('box-shadow', 'none');

  await expect(page.locator('.landing-trust__item')).toHaveCount(2);

  const story = page.getByRole('region', { name: '다음 화를 기다리는 마음으로, 캐치홀을 만들어요.' });
  await expect(story).toBeVisible();
  await story.scrollIntoViewIfNeeded();
  for (const text of await story.locator('[data-landing-reveal]').all()) {
    await text.scrollIntoViewIfNeeded();
    await expect(text).toHaveCSS('opacity', '1');
  }
  await page.setViewportSize({ width: 1440, height: 1200 });
  await story.scrollIntoViewIfNeeded();
  await story.screenshot({ path: 'docs/screens/landing-reader-story-desktop.png' });
  for (const text of await story.locator('p, .landing-story__eyebrow, h2 span, .landing-story__idea span, .landing-story__signature strong, .landing-story__signature > span').all()) {
    expect(await computedContrastRatio(text, story)).toBeGreaterThanOrEqual(4.5);
  }
});

test('원고 보호 안내는 데모 다음에 표시되고 개인정보 링크를 키보드로 읽고 사용할 수 있다', async ({ page }) => {
  for (const width of [320, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/landing');

    const notice = page.getByRole('region', { name: '작가님의 원고는 AI 학습에 사용하지 않습니다.', exact: true });
    const heading = notice.getByRole('heading', { level: 2 });
    const description = notice.getByText('원고와 분석 결과 모두에 적용됩니다.', { exact: true });
    const privacyLink = notice.getByRole('link', { name: '개인정보 처리방침 보기', exact: true });
    await expect(heading).toHaveText('작가님의 원고는 AI 학습에 사용하지 않습니다.');
    await expect(description).toBeVisible();
    await expect(privacyLink).toHaveAttribute('href', '/privacy');
    expect(await notice.evaluate(element => ({
      afterDemo: element.previousElementSibling?.classList.contains('landing-demo-section'),
      beforeFeatures: element.nextElementSibling?.classList.contains('landing-quick-actions'),
    }))).toEqual({ afterDemo: true, beforeFeatures: true });

    expect(await computedContrastRatio(description, notice)).toBeGreaterThanOrEqual(4.5);
    expect(await computedContrastRatio(privacyLink, privacyLink, notice)).toBeGreaterThanOrEqual(4.5);
    await expect(privacyLink).toHaveCSS('text-decoration-line', /underline/);

    await page.getByRole('link', { name: '가상 원고로 직접 체험하기' }).focus();
    await page.keyboard.press('Tab');
    await expect(privacyLink).toBeFocused();
    await notice.scrollIntoViewIfNeeded();
    await expect(privacyLink).toBeInViewport({ ratio: 1 });

    const focus = await privacyLink.evaluate(element => {
      const style = getComputedStyle(element);
      const background = getComputedStyle(element.closest('section')!).backgroundColor;
      const rgba = (color: string) => color.match(/[\d.]+/g)!.map(Number);
      const [outline, surface] = [rgba(style.outlineColor), rgba(background)];
      const alpha = outline[3] ?? 1;
      const luminance = (channels: number[]) => channels.slice(0, 3)
        .map(channel => channel / 255)
        .map(channel => channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4)
        .reduce((sum, channel, index) => sum + channel * [0.2126, 0.7152, 0.0722][index], 0);
      const foreground = luminance(outline.slice(0, 3).map((channel, index) => (
        channel * alpha + surface[index] * (1 - alpha)
      )));
      const backdrop = luminance(surface);
      return {
        visible: element.matches(':focus-visible') && style.outlineStyle !== 'none'
          && style.outlineStyle !== 'hidden' && parseFloat(style.outlineWidth) > 0,
        contrast: (Math.max(foreground, backdrop) + 0.05) / (Math.min(foreground, backdrop) + 0.05),
      };
    });
    expect(focus.visible).toBe(true);
    expect(focus.contrast).toBeGreaterThanOrEqual(3);
    expect((await privacyLink.boundingBox())!.height).toBeGreaterThanOrEqual(44);

    await expect.poll(() => notice.evaluate(section => (
      [...section.querySelectorAll<HTMLElement>('h2, p, a')].every(element => {
        const rect = element.getBoundingClientRect();
        return element.scrollWidth <= element.clientWidth + 1
          && element.scrollHeight <= element.clientHeight + 1
          && rect.left >= 0 && rect.right <= window.innerWidth
          && rect.top >= 0 && rect.bottom <= window.innerHeight;
      })
    ))).toBe(true);

    await page.keyboard.press('Enter');
    await expect(page).toHaveURL('/privacy');
  }
});

test('네 장면은 현재 제품 화면을 보여주고 키보드로 직접 체험에 연결된다', async ({ page }) => {
  await page.goto('/landing');
  const story = page.locator('.landing-product-story');
  for (const picture of await story.locator('img').all()) {
    await picture.scrollIntoViewIfNeeded();
    await expect.poll(() => picture.evaluate(image => (image as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
    await expect(picture).toHaveAttribute('alt', /.+/);
  }
  const demoLink = story.getByRole('link', { name: '가상 원고로 직접 체험하기' });
  await demoLink.focus();
  await expect(demoLink).toBeFocused();
  await demoLink.press('Enter');
  await expect(page).toHaveURL('/demo');
  await expect(page.getByRole('button', { name: 'AI 분석 시작' })).toBeVisible();
});

for (const width of [320, 390, 820, 1231]) {
  test(`네 장면의 설명과 실제 화면은 반응형으로 배치된다 (${width}px)`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 1600 });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/landing');
    const cards = page.locator('.product-story');
    for (const card of await cards.all()) {
      await card.scrollIntoViewIfNeeded();
      await expect(card).toHaveCSS('opacity', '1');
      for (const picture of await card.locator('img').all()) {
        await expect.poll(() => picture.evaluate(image => (image as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
      }
      expect(await card.locator('.product-story__copy').evaluate(copy => [...copy.querySelectorAll<HTMLElement>('h3,p,a,span')].every(node => node.scrollWidth <= node.clientWidth + 1))).toBe(true);
      expect(await page.locator('.landing-page').evaluate(element => element.scrollWidth <= element.clientWidth + 1)).toBe(true);
      await card.screenshot({ path: testInfo.outputPath(`product-story-${width}-${await card.getAttribute('aria-labelledby')}.png`) });
    }
    if (width === 320) {
      expect(await page.locator('.product-story__review img').evaluate(image => (image as HTMLImageElement).currentSrc)).toContain('review-mobile');
    }
  });
}

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

for (const width of [320, 1280]) {
  test(`일반 소개는 자동 반영 기본값을 알리고 수동 검토 데모와 구분한다 (${width}px)`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/landing');
    await expect(page.locator('.landing-quick-actions')).toContainText('명확한 설정은 자동 반영하고 필요한 내용만 확인해요.');
    await expect(page.locator('.landing-quick-actions')).toContainText('자동 반영·직접 확인');
    await expect(page.locator('.landing-feature-card').filter({ hasText: '캐릭터·세계관 자동 추출' })).toContainText('명확한 설정은 자동으로 작품에 쌓고');
    await expect(page.locator('.product-story--review')).toContainText('명확한 설정은 자동으로 반영해요.');
    await expect(page.locator('.landing-product-story__caption')).toContainText('가상 원고를 사용한 실제 서비스 화면 예시');
    for (const outdated of ['작가님이 확인한 내용만 작품 설정으로 확정합니다.', '작가가 직접 최종 확정', '검토한 내용만 작품 설정으로 저장해요.', '작가가 확인할 검토 목록']) {
      await expect(page.getByText(outdated, { exact: false })).toHaveCount(0);
    }
    expect(await page.locator('.landing-page').evaluate(element => element.scrollWidth <= element.clientWidth + 1)).toBeTruthy();
    await expect(page.locator('.app-route-layer')).toHaveCSS('opacity', '1');
    await page.screenshot({ path: `docs/screens/gh180-landing-auto-${width}.png` });
    await page.goto('/demo');
    await expect(page.getByText('이 체험은 설정을 직접 검토하는 예시입니다.', { exact: false })).toBeVisible();
    await expect(page.getByRole('button', { name: 'AI 분석 시작', exact: true })).toBeEnabled();
  });
}
