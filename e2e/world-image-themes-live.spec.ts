import { expect, test } from '@playwright/test';
import { purgeWorkAndWait } from './live-work-purge';

const api = process.env.CATCHHOLE_E2E_API_BASE_URL;
const email = process.env.CATCHHOLE_E2E_EMAIL;
const password = process.env.CATCHHOLE_E2E_PASSWORD;

test('장르별 초기·기본 그림과 공용 추천·전체 도감 선택을 실제 서버에 연결한다', async ({ page, request }) => {
  test.skip(!api || !email || !password, '로컬 인증 계정과 Backend 주소가 필요합니다.');
  test.setTimeout(120_000);
  const login = await request.post(`${api}/api/v1/auth/login`, { data: { email, password } });
  expect(login.ok()).toBeTruthy();
  const token = (await login.json()).data.accessToken;
  const headers = { Authorization: `Bearer ${token}` };
  const title = `장르 이미지 검증 ${Date.now()}`;
  const created = await request.post(`${api}/api/v1/works`, { headers, data: { title, genre: '판타지' } });
  expect(created.ok()).toBeTruthy();
  const workId = (await created.json()).data.id;
  const workUrl = `${api}/api/v1/works/${workId}`;
  try {
    const createdSetting = await request.post(`${workUrl}/world-settings`, { headers, data: {
      category: 'LOCATION', subjectName: '검증용 장소', settingName: '특징', settingValue: '내용은 바뀌지 않는다.',
    } });
    expect(createdSetting.ok()).toBeTruthy();
    const settingId = (await createdSetting.json()).data.id;
    const detailUrl = `${workUrl}/world-settings/${settingId}`;
    const genres = {
      '판타지': 'fantasy', '로맨스': 'modern-common', '코미디': 'modern-common', '일상': 'modern-common',
      '기타': 'modern-common', '무협': 'wuxia', SF: 'sf', '추리': 'mystery', '호러': 'horror', '스포츠': 'sports',
    };
    const themes = new Map<string, string>();
    let sharedForestPath: string | undefined;
    for (const [genre, theme] of Object.entries(genres)) {
      expect((await request.patch(workUrl, { headers, data: { title, genre } })).ok()).toBeTruthy();
      const response = await request.get(`${workUrl}/world-image-theme`, { headers });
      expect(response.ok()).toBeTruthy();
      const result = (await response.json()).data;
      expect(result.theme).toBe(theme);
      expect(Object.keys(result.overview)).toHaveLength(8);
      expect(Object.keys(result.defaults)).toHaveLength(7);
      if (themes.has(theme)) expect(result.overview.ALL.imageUrl).toBe(themes.get(theme));
      themes.set(theme, result.overview.ALL.imageUrl);
      const detail = (await (await request.get(detailUrl, { headers })).json()).data;
      expect(detail.image).toMatchObject({ source: 'AUTO', version: 0, imageUrl: result.defaults.LOCATION.imageUrl });
      expect(detail.version).toBe(0);
      const catalog = await request.get(`${api}/api/v1/world-image-catalog`, {
        headers, params: { workId, recommended: true, category: 'LOCATION', q: '숲' },
      });
      const forest = (await catalog.json()).data.content.find((item: { id: string }) => item.id === 'location-forest');
      expect(forest).toBeTruthy();
      sharedForestPath ??= forest.imageUrl;
      expect(forest.imageUrl).toBe(sharedForestPath);
    }
    expect(new Set(themes.values()).size).toBe(7);

    await request.patch(workUrl, { headers, data: { title, genre: 'SF' } });
    const sf = (await (await request.get(`${workUrl}/world-image-theme`, { headers })).json()).data;
    await page.goto('/login');
    await page.evaluate(value => { localStorage.setItem('accessToken', value); localStorage.removeItem('catchhole_demo_mode'); }, token);
    const dashboard = `/dashboard?workId=${workId}&nav=settingDB&tab=worldsettings`;
    await page.setViewportSize({ width: 1440, height: 1100 });
    await page.goto(dashboard);
    const overview = page.locator('.world-setting-category-overview');
    await expect(overview.getByRole('button', { name: '전체 보기', exact: true }).locator('img')).toHaveAttribute('src', `${api}${sf.overview.ALL.imageUrl}`);
    for (const picture of await overview.locator('img').all()) {
      await picture.scrollIntoViewIfNeeded();
      await expect(picture).toHaveJSProperty('naturalWidth', 960);
    }
    await overview.scrollIntoViewIfNeeded();
    await page.screenshot({ path: 'docs/screens/gh194/theme-sf-overview.png', animations: 'disabled' });
    await overview.getByRole('button', { name: '장소 설정 보기', exact: true }).click();
    const card = page.getByRole('button', { name: '검증용 장소 세계관 대상 보기' });
    await expect(card.locator('img')).toHaveAttribute('src', `${api}${sf.defaults.LOCATION.thumbnailUrl}`);
    await card.click();
    await page.getByRole('button', { name: '이미지 변경', exact: true }).click();
    const picker = page.getByRole('dialog', { name: '대표 이미지 선택', exact: true });
    await expect(picker.getByRole('button', { name: '장르 추천', exact: true })).toHaveAttribute('aria-pressed', 'true');
    await expect(picker.getByLabel('다음 페이지')).toBeEnabled();
    await picker.getByLabel('다음 페이지').click();
    await expect(picker.getByRole('navigation')).toContainText('2 / 2');
    await picker.getByLabel('대표 이미지 이름·별칭 검색').fill('삼림');
    await picker.getByRole('button', { name: '검색', exact: true }).click();
    await picker.getByRole('button', { name: '숲 이미지 선택', exact: true }).click();
    await picker.getByRole('button', { name: '전체 도감', exact: true }).click();
    await expect(picker.getByRole('button', { name: '숲 이미지 선택', exact: true })).toHaveAttribute('aria-pressed', 'true');
    await picker.getByRole('button', { name: '장르 추천', exact: true }).click();
    await picker.getByLabel('대표 이미지 이름·별칭 검색').fill('객잔');
    await picker.getByRole('button', { name: '검색', exact: true }).click();
    await expect(picker.getByText('이 장르의 추천 이미지가 없어요.', { exact: false })).toBeVisible();
    await picker.getByRole('button', { name: '전체 도감에서 찾기', exact: true }).click();
    await picker.getByRole('button', { name: '객잔 이미지 선택', exact: true }).click();
    await expect(picker.getByRole('button', { name: '객잔 이미지 선택', exact: true }).locator('img')).toHaveJSProperty('naturalWidth', 480);
    await page.screenshot({ path: 'docs/screens/gh194/theme-picker-desktop.png', animations: 'disabled' });
    await page.setViewportSize({ width: 320, height: 568 });
    await expect(picker.getByRole('button', { name: '이미지 저장', exact: true })).toBeEnabled();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await picker.getByRole('button', { name: '객잔 이미지 선택', exact: true }).scrollIntoViewIfNeeded();
    await picker.locator('.world-setting-dialog__content').evaluate(element => { element.scrollTop = element.scrollHeight; });
    const optionBounds = await picker.getByRole('button', { name: '객잔 이미지 선택', exact: true }).boundingBox();
    const footerBounds = await picker.locator('.world-image-picker__footer').boundingBox();
    expect(optionBounds!.y + optionBounds!.height).toBeLessThanOrEqual(footerBounds!.y);
    await page.screenshot({ path: 'docs/screens/gh194/theme-picker-mobile.png', animations: 'disabled' });
    await picker.getByRole('button', { name: '이미지 저장', exact: true }).click();
    await expect(picker).toHaveCount(0);
    await request.patch(workUrl, { headers, data: { title, genre: '스포츠' } });
    const selected = (await (await request.get(detailUrl, { headers })).json()).data;
    expect(selected.image).toMatchObject({ source: 'MANUAL', catalogId: 'wuxia-inn', version: 1 });
    expect(selected.version).toBe(0);
    expect(selected.properties[0].value).toBe('내용은 바뀌지 않는다.');
    await page.goto(`${dashboard}&category=LOCATION`);
    await expect(card.locator('img')).toHaveAttribute('src', `${api}${selected.image.thumbnailUrl}`);
    await card.click();
    await page.getByRole('button', { name: '이미지 변경', exact: true }).click();
    await picker.getByRole('button', { name: /^분류 기본 이미지/ }).click();
    await picker.getByRole('button', { name: '이미지 저장', exact: true }).click();
    await expect(picker).toHaveCount(0);
    const reset = (await (await request.get(detailUrl, { headers })).json()).data;
    const sports = (await (await request.get(`${workUrl}/world-image-theme`, { headers })).json()).data;
    expect(reset.image).toMatchObject({ source: 'DEFAULT', imageUrl: sports.defaults.LOCATION.imageUrl, version: 2 });
    await page.getByRole('button', { name: '이미지 변경', exact: true }).click();
    await picker.getByRole('button', { name: /대상 이름에 따라 자동 선택/ }).click();
    await picker.getByRole('button', { name: '이미지 저장', exact: true }).click();
    await expect(picker).toHaveCount(0);
    const automatic = (await (await request.get(detailUrl, { headers })).json()).data;
    expect(automatic.image.source).toBe('AUTO');
    const renamed = await request.patch(`${detailUrl}/identity`, { headers, data: {
      category: 'LOCATION', subjectName: '고블린 숲', version: automatic.version,
    } });
    expect(renamed.ok()).toBeTruthy();
    const persisted = (await renamed.json()).data;
    expect(persisted.image).toMatchObject({ source: 'AUTO', catalogId: 'location-forest' });
    expect((await (await request.get(detailUrl, { headers })).json()).data.image).toEqual(persisted.image);
  } finally {
    await purgeWorkAndWait(request, api!, headers.Authorization, workId);
  }
});
