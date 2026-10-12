import { expect, test } from '@playwright/test';

for (const width of [1231, 390, 320]) {
  test(`랜딩 하단은 실제 스크롤 시 부드럽게 한 번만 등장한다 (${width}px)`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 805 });
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await page.goto('/landing');

    const firstCard = page.locator('.landing-quick-action').first();
    await expect(firstCard).toHaveCSS('opacity', '0');
    await expect(page.locator('.landing-demo-section [data-landing-reveal]')).toHaveCount(7);
    await expect(page.locator('.landing-manuscript-notice [data-landing-reveal]')).toHaveCount(1);
    await expect(page.locator('.lvh-story [data-landing-reveal]')).toHaveCount(0);
    await page.locator('.landing-page').evaluate(container => {
      const card = container.querySelector('.landing-quick-action')!;
      const top = card.getBoundingClientRect().top - container.getBoundingClientRect().top + container.scrollTop;
      container.scrollTo({ top: top - container.clientHeight - 40, behavior: 'instant' });
    });
    await page.mouse.move(width / 2, 600);

    // Sample real rendered frames while a wheel event scrolls the card into view.
    const frames = firstCard.evaluate(async element => {
      const opacity: number[] = [];
      const start = performance.now();
      await new Promise<void>(resolve => {
        const sample = () => {
          opacity.push(Number(getComputedStyle(element).opacity));
          if (performance.now() - start < 1200) requestAnimationFrame(sample);
          else resolve();
        };
        sample();
      });
      return opacity;
    });
    await page.mouse.wheel(0, 420);
    expect((await frames).some(opacity => opacity > 0 && opacity < 1)).toBe(true);
    await expect(firstCard).toHaveCSS('opacity', '1');
    await expect(firstCard).toHaveCSS('translate', 'none');
    await expect(firstCard).toHaveCSS('filter', 'none');

    for (const target of await page.locator('[data-landing-reveal]').all()) {
      await target.scrollIntoViewIfNeeded();
      await expect(target).toHaveAttribute('data-landing-reveal', 'visible');
      await expect(target).toHaveCSS('opacity', '1');
    }
    expect(await page.locator('.landing-page').evaluate(element => (
      element.scrollWidth <= element.clientWidth + 1
    ))).toBe(true);

    await firstCard.scrollIntoViewIfNeeded();
    await expect(firstCard).toHaveCSS('opacity', '1');
    expect(await firstCard.evaluate(element => element.getAnimations().length)).toBe(0);
    await page.screenshot({ path: testInfo.outputPath(`landing-reveal-${width}.png`) });
    await page.locator('.landing-page').evaluate(container => {
      const heading = container.querySelector('.landing-section-heading')!;
      const top = heading.getBoundingClientRect().top - container.getBoundingClientRect().top + container.scrollTop;
      const headerHeight = container.querySelector('.landing-header')!.getBoundingClientRect().height;
      container.scrollTo({ top: top - headerHeight - 24, behavior: 'instant' });
    });
    await page.screenshot({ path: testInfo.outputPath(`landing-catalog-${width}.png`) });
  });
}

test('모션 감소 설정은 모든 하단 콘텐츠를 이동과 지연 없이 보여준다', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/landing');
  for (const target of await page.locator('[data-landing-reveal]').all()) {
    await expect(target).toHaveCSS('opacity', '1');
    await expect(target).toHaveCSS('translate', 'none');
    await expect(target).toHaveCSS('filter', 'none');
    await expect(target).toHaveCSS('transition-duration', '0s');
  }
});

test('페이지를 보는 중 모션 감소를 켜도 숨겨진 콘텐츠를 즉시 보여준다', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.goto('/landing');
  const firstCard = page.locator('.landing-quick-action').first();
  await expect(firstCard).toHaveCSS('opacity', '0');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect(firstCard).toHaveCSS('opacity', '1');
  await expect(firstCard).toHaveCSS('translate', 'none');
  await expect(firstCard).toHaveCSS('filter', 'none');
});

test('하단 CTA에 키보드 포커스를 보내면 즉시 표시하고 체험으로 이동한다', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.goto('/landing');
  const cta = page.locator('.landing-cta');
  await expect(cta).toHaveCSS('opacity', '0');
  const demo = cta.getByRole('button', { name: '로그인 없이 체험하기' });
  await demo.focus();
  await expect(demo).toBeFocused();
  await expect(cta).toHaveCSS('opacity', '1');
  await expect(cta).toHaveCSS('translate', 'none');
  await demo.press('Enter');
  await expect(page).toHaveURL('/demo');
});
