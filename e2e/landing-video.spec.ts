import { expect, test, type Page } from '@playwright/test';

async function scrollHero(page: Page, progress: number) {
  await page.locator('.landing-page').evaluate((container, amount) => {
    const hero = container.querySelector<HTMLElement>('.lvh-story')!;
    const header = container.querySelector<HTMLElement>('.landing-header')!;
    const start = hero.getBoundingClientRect().top - container.getBoundingClientRect().top + container.scrollTop - header.offsetHeight;
    const distance = hero.offsetHeight - container.clientHeight + header.offsetHeight;
    container.scrollTo({ top: start + distance * amount, behavior: 'instant' });
  }, progress);
}

const videoTime = (page: Page) => page.locator('.lvh-film video').evaluate(video => (video as HTMLVideoElement).currentTime);

test('데스크톱 첫 여백이 사라지며 영상이 진행되고 역스크롤로 되돌아온다', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/landing');
  const hero = page.locator('.landing-video-hero');
  const viewport = page.locator('.lvh-viewport');
  const video = page.locator('.lvh-film video');
  await expect(hero).toHaveAttribute('data-mode', 'desktop');
  await expect(video.locator('source')).toHaveAttribute('src', '/landing/video-hero/writer-to-laptop.mp4');
  await expect(video).toHaveAttribute('poster', '/landing/video-hero/poster.jpg');
  await expect.poll(() => video.evaluate(v => (v as HTMLVideoElement).readyState)).toBeGreaterThanOrEqual(2);
  await expect(viewport).toHaveCSS('border-radius', '40px');
  expect((await viewport.boundingBox())!.x).toBe(16);
  await scrollHero(page, .18);
  await expect(viewport).toHaveCSS('border-radius', '0px');
  await expect.poll(() => videoTime(page)).toBeGreaterThan(2);
  expect((await viewport.boundingBox())!.x).toBe(0);
  expect((await viewport.boundingBox())!.y).toBe(0);
  await scrollHero(page, 0);
  await expect.poll(() => videoTime(page)).toBeLessThan(.05);
  await expect(viewport).toHaveCSS('border-radius', '40px');
  await page.mouse.move(700, 450);
  await page.mouse.down();
  await page.mouse.move(700, 200, { steps: 12 });
  await page.mouse.up();
  await expect.poll(() => videoTime(page)).toBeGreaterThan(.1);
});

test('25화 원고에서 설정 6개를 검토하고 확정한 뒤 처음으로 돌아간다', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/landing');
  await expect(page.locator('.landing-actions')).toBeHidden();
  await scrollHero(page, .8587);
  await expect(page.locator('.lvh-editor')).toHaveAttribute('aria-hidden', 'false');
  await expect(page.locator('.lvh-editor img')).toHaveAttribute('src', '/landing/video-hero/manuscript-25.png');
  await expect(page.locator('.lvh-fact')).toHaveCount(6);
  await expect(page.getByRole('heading', { name: '북쪽 성문', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: '리엔', exact: true })).toBeVisible();
  for (const group of ['세계관 설정', '캐릭터 설정', '마법 설정']) {
    await page.getByRole('button', { name: `${group} 확정`, exact: true }).click();
    await expect(page.getByRole('button', { name: `${group} 확정됨`, exact: true })).toBeDisabled();
  }
  await expect(page.getByText('원고 속 설정 6개, 정리 완료')).toBeVisible();
  await expect(page.locator('.landing-actions')).toBeVisible();
  await page.getByRole('button', { name: '처음 장면으로' }).click();
  await expect(page.locator('.lvh-editor')).toHaveAttribute('aria-hidden', 'true');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await expect(page.locator('.landing-actions')).toBeHidden();
  await scrollHero(page, 1);
  await page.locator('.landing-actions').getByRole('button', { name: '지금 무료로 시작하기' }).click();
  await expect(page).toHaveURL('/signup');
  await page.goBack();
  await expect(page).toHaveURL('/landing');
  await expect(page.locator('.landing-header')).toHaveCSS('visibility', 'visible');
});

test('모바일은 일반 재생이고 스크롤은 정지된 영상 시간을 바꾸지 않는다', async ({ page }) => {
  for (const width of [320, 390]) {
    await page.setViewportSize({ width, height: 844 });
    await page.goto('/landing');
    await expect(page.locator('.landing-video-hero')).toHaveAttribute('data-mode', 'mobile');
    const video = page.locator('.lvh-film video');
    await expect(page.locator('.landing-actions')).toBeHidden();
    await expect.poll(() => video.evaluate(v => !(v as HTMLVideoElement).paused)).toBe(true);
    await page.getByRole('button', { name: '영상 일시정지', exact: true }).click();
    const pausedTime = await videoTime(page);
    await page.locator('.landing-page').evaluate(el => el.scrollTo({ top: 440, behavior: 'instant' }));
    await expect.poll(() => videoTime(page)).toBe(pausedTime);
    expect((await page.locator('.landing-video-hero').boundingBox())!.height).toBeLessThan(844);
    expect(await page.locator('.landing-page').evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
    await page.locator('.landing-page').evaluate(el => el.scrollTo({ top: 0, behavior: 'instant' }));
    await page.getByRole('button', { name: '영상 재생', exact: true }).click();
    await expect.poll(() => videoTime(page)).toBeGreaterThan(pausedTime + .1);
    await video.evaluate(element => { const v = element as HTMLVideoElement; v.currentTime = v.duration - .15; });
    await expect(page.locator('.lvh-editor')).toHaveAttribute('aria-hidden', 'false');
    await expect(page.getByText('25화. 북쪽 성문', { exact: true })).toBeVisible();
    await expect(page.locator('.landing-actions')).toBeHidden();
    await page.getByRole('button', { name: '설정 추출 일시정지', exact: true }).click();
    const pausedProgress = await page.locator('.landing-video-hero').getAttribute('data-progress');
    await page.locator('.landing-page').evaluate(el => el.scrollTo({ top: 300, behavior: 'instant' }));
    await expect(page.locator('.landing-video-hero')).toHaveAttribute('data-progress', pausedProgress!);
    await page.locator('.landing-page').evaluate(el => el.scrollTo({ top: 0, behavior: 'instant' }));
    await page.getByRole('button', { name: '설정 추출 재생', exact: true }).click();
    await expect(page.getByRole('heading', { name: '북쪽 성문', exact: true })).toBeVisible();
    await page.getByRole('button', { name: '세계관 설정 확정', exact: true }).click();
    await page.getByRole('button', { name: '캐릭터 설정 확정', exact: true }).click();
    await page.getByRole('button', { name: '마법 설정 확정', exact: true }).click();
    await expect(page.getByText('원고 속 설정 6개, 정리 완료')).toBeVisible();
    await expect(page.locator('.landing-actions')).toBeVisible();
    expect(await page.locator('.landing-page').evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
    for (const fact of await page.locator('.lvh-fact p').all()) await expect(fact).toHaveCSS('font-size', '14px');
    for (const button of await page.locator('.lvh-confirm').all()) expect((await button.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    await page.getByRole('button', { name: '처음부터 다시 보기', exact: true }).click();
    await expect(page.locator('.landing-video-hero')).toHaveAttribute('data-scene', 'video');
    await expect(page.locator('.landing-actions')).toBeHidden();
    await page.locator('.landing-header__actions').getByRole('button', { name: '로그인', exact: true }).click();
    await expect(page).toHaveURL('/login');
    await expect.poll(() => video.evaluate(v => (v as HTMLVideoElement).paused)).toBe(true);
  }
});

test('백그라운드에서 처음 연 모바일 영상은 탭이 보일 때부터 재생된다', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.addInitScript(() => Object.defineProperty(document, 'hidden', { configurable: true, get: () => true }));
  await page.goto('/landing');
  const video = page.locator('.lvh-film video');
  await expect.poll(() => video.evaluate(v => (v as HTMLVideoElement).readyState)).toBeGreaterThanOrEqual(2);
  expect(await video.evaluate(v => (v as HTMLVideoElement).paused)).toBe(true);
  expect(await videoTime(page)).toBe(0);
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => false });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await expect.poll(() => videoTime(page)).toBeGreaterThan(.1);
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await expect.poll(() => video.evaluate(v => (v as HTMLVideoElement).paused)).toBe(true);
});

test('높이가 낮은 데스크톱에서도 설정 글자와 확정 버튼을 읽고 누를 수 있다', async ({ page }) => {
  for (const size of [{ width: 1366, height: 768 }, { width: 1280, height: 720 }]) {
    await page.setViewportSize(size);
    await page.goto('/landing');
    await scrollHero(page, .8587);
    await expect(page.getByRole('heading', { name: '북쪽 성문', exact: true })).toBeVisible();
    const measurements = await page.locator('.lvh-canvas').evaluate(canvas => {
      const scale = canvas.getBoundingClientRect().width / (canvas as HTMLElement).offsetWidth;
      return [...canvas.querySelectorAll('.lvh-fact p, .lvh-setting__status')].map(el => ({
        size: parseFloat(getComputedStyle(el).fontSize) * scale,
        minimum: el.classList.contains('lvh-setting__status') ? 11 : 12.5,
      }));
    });
    for (const text of measurements) expect(text.size).toBeGreaterThanOrEqual(text.minimum - .05);
    await expect.poll(async () => {
      const frame = (await page.locator('.lvh-viewport').boundingBox())!;
      const world = (await page.getByRole('region', { name: '세계관 설정', exact: true }).boundingBox())!;
      const character = (await page.getByRole('region', { name: '캐릭터 설정', exact: true }).boundingBox())!;
      const magic = (await page.getByRole('region', { name: '마법 설정', exact: true }).boundingBox())!;
      return character.y + character.height < magic.y
        && world.y + world.height < frame.y + frame.height
        && magic.y + magic.height < frame.y + frame.height;
    }).toBe(true);
    for (const button of await page.locator('.lvh-confirm').all()) {
      await expect(button).toBeInViewport();
      expect((await button.boundingBox())!.height).toBeGreaterThanOrEqual(43.9);
    }
  }
});

test('모바일 영상 뒤 설정 6개가 스크롤 없이 자동 추출·확정되고 마지막에 CTA가 나온다', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/landing');
  const hero = page.locator('.landing-video-hero');
  const video = page.locator('.lvh-film video');
  await expect.poll(() => video.evaluate(v => (v as HTMLVideoElement).readyState)).toBeGreaterThanOrEqual(2);
  await video.evaluate(element => { const v = element as HTMLVideoElement; v.currentTime = v.duration - .15; });
  await expect(hero).toHaveAttribute('data-scene', 'manuscript');
  await expect(page.locator('.landing-actions')).toBeHidden();
  for (const name of ['세계관 설정', '캐릭터 설정', '마법 설정']) {
    await expect(page.getByRole('region', { name, exact: true })).toBeVisible({ timeout: 10000 });
    await expect(page.locator('.landing-actions')).toBeHidden();
  }
  await expect(page.getByText('원고 속 설정 6개, 정리 완료')).toBeVisible({ timeout: 15000 });
  await expect(page.locator('.lvh-fact')).toHaveCount(6);
  await expect(page.locator('.landing-actions')).toBeVisible();
  expect(await page.locator('.landing-page').evaluate(el => el.scrollTop)).toBe(0);
});

test('모바일 모션 감소에서는 원고·설정을 수동으로 확정하며 CTA까지 갈 수 있다', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.setViewportSize({ width: 320, height: 568 });
  await page.goto('/landing');
  const video = page.locator('.lvh-film video');
  await expect.poll(() => video.evaluate(v => (v as HTMLVideoElement).paused)).toBe(true);
  await page.getByRole('button', { name: '영상 재생', exact: true }).click();
  await expect.poll(() => video.evaluate(v => (v as HTMLVideoElement).readyState)).toBeGreaterThanOrEqual(2);
  await video.evaluate(element => { const v = element as HTMLVideoElement; v.currentTime = v.duration - .15; });
  await expect(page.getByRole('heading', { name: '북쪽 성문', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: '설정 추출 재생', exact: true })).toBeHidden();
  const hero = page.locator('.landing-video-hero');
  const progress = await hero.getAttribute('data-progress');
  await page.waitForTimeout(300);
  await expect(hero).toHaveAttribute('data-progress', progress!);
  await expect(page.locator('.landing-actions')).toBeHidden();
  for (const name of ['세계관 설정', '캐릭터 설정', '마법 설정']) {
    await page.getByRole('button', { name: `${name} 확정`, exact: true }).click();
  }
  await expect(page.locator('.landing-actions')).toBeVisible();
  await page.getByRole('button', { name: '처음부터 다시 보기', exact: true }).click();
  await expect(hero).toHaveAttribute('data-scene', 'video');
  await expect.poll(() => video.evaluate(v => (v as HTMLVideoElement).paused)).toBe(true);
});

test('모션 감소는 자동 진행 없이 버튼으로 정적 설정 장면을 탐색한다', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/landing');
  await expect(page.locator('.landing-video-hero')).toHaveAttribute('data-mode', 'reduced');
  await expect.poll(() => page.locator('video').evaluate(v => v.paused)).toBe(true);
  await page.getByRole('button', { name: '설정 추출 보기' }).click();
  await expect(page.getByRole('heading', { name: '리엔', exact: true })).toBeVisible();
  await page.getByRole('button', { name: '처음 장면으로' }).click();
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
});

test('영상 로딩이 실패해도 재시도와 체험 진입을 제공한다', async ({ page }) => {
  await page.route('**/writer-to-laptop.mp4', route => route.abort());
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/landing');
  await expect(page.getByText('영상을 불러오지 못했습니다.')).toBeVisible({ timeout: 15000 });
  await expect(page.getByRole('button', { name: '다시 불러오기' })).toBeVisible();
  await page.locator('.landing-header__actions').getByRole('button', { name: '로그인 없이 체험하기' }).click();
  await expect(page).toHaveURL('/demo');
});
