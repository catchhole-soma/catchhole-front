import { expect, test, type Page, type Route } from '@playwright/test';

const WORK_ID = '11111111-1111-4111-8111-111111111111';
const EPISODE_ID = '22222222-2222-4222-8222-222222222222';

const member = {
  id: 1,
  email: 'mobile@example.com',
  displayName: '모바일 테스트',
  phoneNumber: '01012345678',
  phoneVerified: false,
  role: 'AUTHOR',
  status: 'ACTIVE',
};

function fulfill(route: Route, data: unknown) {
  return route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ success: true, data, error: null }),
  });
}

async function authenticate(page: Page) {
  await page.goto('/login');
  await page.evaluate(() => localStorage.setItem('accessToken', 'mobile-token'));
}

async function expectNoHorizontalOverflow(page: Page, selector: string) {
  await expect.poll(() => page.locator(selector).evaluate(element => (
    element.scrollWidth <= element.clientWidth + 1
  ))).toBe(true);
}

test('랜딩은 휴대폰과 태블릿에서 세로로 재배치되고 가로로 넘치지 않는다', async ({ page }) => {
  for (const viewport of [
    { width: 390, height: 844 },
    { width: 430, height: 932 },
    { width: 768, height: 1024 },
  ]) {
    await page.setViewportSize(viewport);
    await page.goto('/landing');

    await expectNoHorizontalOverflow(page, '.landing-page');
    const [copyBox, chartBox] = await Promise.all([
      page.locator('.landing-hero-copy').boundingBox(),
      page.locator('.landing-chart').boundingBox(),
    ]);
    expect(copyBox).not.toBeNull();
    expect(chartBox).not.toBeNull();
    expect(Math.abs((copyBox?.x ?? 0) - (chartBox?.x ?? 0))).toBeLessThanOrEqual(1);
    expect(chartBox?.y ?? 0).toBeGreaterThan((copyBox?.y ?? 0) + (copyBox?.height ?? 0));
  }
});

test('작품 선택 카드는 휴대폰에서 한 열로 표시된다', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.route('**/api/v1/auth/me', route => fulfill(route, member));
  await page.route('**/api/v1/works', route => fulfill(route, [
    { id: WORK_ID, title: '모바일 작품 A', description: '첫 작품', genre: '판타지', latestEpisodeNo: 2 },
    { id: EPISODE_ID, title: '모바일 작품 B', description: '두 번째 작품', genre: '로맨스', latestEpisodeNo: 0 },
  ]));

  await authenticate(page);
  await page.goto('/works');

  const [firstBox, secondBox] = await Promise.all([
    page.getByRole('button', { name: '모바일 작품 A 작품 선택' }).boundingBox(),
    page.getByRole('button', { name: '모바일 작품 B 작품 선택' }).boundingBox(),
  ]);
  expect(firstBox).not.toBeNull();
  expect(secondBox).not.toBeNull();
  expect(Math.abs((firstBox?.x ?? 0) - (secondBox?.x ?? 0))).toBeLessThanOrEqual(1);
  expect(secondBox?.y ?? 0).toBeGreaterThan(firstBox?.y ?? 0);
  await expectNoHorizontalOverflow(page, '.work-picker-main');
});

test('대시보드는 휴대폰에서 사이드바를 서랍으로 열고 선택 뒤 닫는다', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.route('**/api/v1/**', route => {
    const pathname = new URL(route.request().url()).pathname;
    if (pathname.endsWith('/auth/me')) return fulfill(route, member);
    if (pathname.endsWith(`/works/${WORK_ID}`)) {
      return fulfill(route, { id: WORK_ID, title: '모바일 대시보드', genre: '판타지', latestEpisodeNo: 0 });
    }
    if (pathname.endsWith(`/works/${WORK_ID}/characters`)) {
      return fulfill(route, {
        content: [], page: 0, size: 8, totalElements: 0, totalPages: 0, hasNext: false,
      });
    }
    return fulfill(route, []);
  });

  await authenticate(page);
  await page.goto(`/dashboard?workId=${WORK_ID}`);

  await expect(page.locator('.desktop-app-sidebar')).toBeHidden();
  await page.getByRole('button', { name: '메뉴 열기', exact: true }).click();
  const drawer = page.getByRole('dialog', { name: '워크스페이스 메뉴' });
  await expect(drawer).toBeVisible();
  await drawer.getByRole('button', { name: /^원고 목록/ }).click();

  await expect(drawer).toHaveCount(0);
  await expect.poll(() => new URL(page.url()).searchParams.get('nav')).toBe('manuscripts');
  await expect(page.getByText('아직 업로드된 원고가 없습니다.', { exact: true })).toBeVisible();
  await expectNoHorizontalOverflow(page, '.dashboard-content');
});

test('캐릭터 목록은 휴대폰에서 여섯 명씩 조회하고 설정 탭을 두 줄로 배치한다', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  let requestedCharacterSize: string | null = null;
  const characterRows = Array.from({ length: 6 }, (_, index) => ({
    id: `33333333-3333-4333-8333-${String(index + 1).padStart(12, '0')}`,
    name: `모바일 캐릭터 ${index + 1}`,
    role: null,
    currentAge: null,
    currentLevel: index + 1,
    firstAppearanceEpisodeNo: index + 1,
    representativeSetting: null,
  }));

  await page.route('**/api/v1/**', route => {
    const url = new URL(route.request().url());
    const pathname = url.pathname;
    if (pathname.endsWith('/auth/me')) return fulfill(route, member);
    if (pathname.endsWith(`/works/${WORK_ID}`)) {
      return fulfill(route, { id: WORK_ID, title: '모바일 대시보드', genre: '판타지', latestEpisodeNo: 6 });
    }
    if (pathname.endsWith(`/works/${WORK_ID}/characters`)) {
      requestedCharacterSize = url.searchParams.get('size');
      return fulfill(route, {
        content: characterRows,
        page: 0,
        size: 6,
        totalElements: 7,
        totalPages: 2,
        hasNext: true,
      });
    }
    const selectedMobileCharacter = characterRows.find(character => (
      pathname.endsWith(`/works/${WORK_ID}/characters/${character.id}`)
    ));
    if (selectedMobileCharacter) {
      return fulfill(route, {
        ...selectedMobileCharacter,
        roleLabel: '주인공',
        firstAppearanceEpisode: { episodeNo: selectedMobileCharacter.firstAppearanceEpisodeNo },
        profile: [],
        stats: [],
        skills: [],
        items: [],
        statuses: [],
      });
    }
    return fulfill(route, []);
  });

  await authenticate(page);
  await page.goto(`/dashboard?workId=${WORK_ID}&nav=settingDB&tab=characters`);

  await expect.poll(() => requestedCharacterSize).toBe('6');
  await expect(page.getByText('모바일 캐릭터 1', { exact: true })).toBeVisible();
  await expect(page.getByText('모바일 캐릭터 6', { exact: true })).toBeVisible();
  await expect(page.getByText('1 / 2', { exact: true })).toBeVisible();

  const tabs = page.locator('.dashboard-tabs');
  const [firstTabBox, fourthTabBox] = await Promise.all([
    tabs.getByRole('button', { name: /^캐릭터/ }).boundingBox(),
    tabs.getByRole('button', { name: /^관계도/ }).boundingBox(),
  ]);
  expect(firstTabBox).not.toBeNull();
  expect(fourthTabBox).not.toBeNull();
  expect(fourthTabBox?.y ?? 0).toBeGreaterThan(firstTabBox?.y ?? 0);
  await expectNoHorizontalOverflow(page, '.dashboard-tabs');

  const archiveButton = page.getByRole('button', { name: '보관된 캐릭터', exact: true });
  await expect(archiveButton).toBeVisible();
  await expect.poll(() => archiveButton.evaluate(element => (
    getComputedStyle(element).whiteSpace === 'nowrap'
      && element.scrollHeight <= element.clientHeight + 1
  ))).toBe(true);

  await page.getByRole('button', { name: /모바일 캐릭터 1/ }).click();
  const detailModal = page.locator('.character-detail-modal');
  await expect(detailModal.locator('.character-basic-grid > div > div:last-child').first())
    .toHaveCSS('color', 'rgb(25, 30, 38)');
  const timelineButton = detailModal.getByRole('button', { name: '변화 이력 보기' });
  await expect(timelineButton).toBeVisible();
  const [headerActionsBox, timelineButtonBox] = await Promise.all([
    detailModal.locator('.character-detail-header__actions').boundingBox(),
    timelineButton.boundingBox(),
  ]);
  expect(headerActionsBox).not.toBeNull();
  expect(timelineButtonBox).not.toBeNull();
  expect(timelineButtonBox!.width).toBeGreaterThanOrEqual(headerActionsBox!.width - 2);
  await expectNoHorizontalOverflow(page, '.character-detail-modal');

  await timelineButton.click();
  const timelinePanel = page.getByRole('dialog', { name: '캐릭터 설정 이력' });
  await expect(timelinePanel).toBeVisible();
  await expect(timelinePanel.getByText('변화 이력을 보고 싶은 설정을 선택하세요.')).toBeVisible();
  const timelinePanelBox = await timelinePanel.boundingBox();
  expect(timelinePanelBox).not.toBeNull();
  expect(timelinePanelBox!.y).toBeGreaterThan(0);
  await expect(detailModal).toBeVisible();
  await timelinePanel.getByRole('button', { name: '타임라인 닫기' }).click();

  await detailModal.getByRole('button', { name: '닫기', exact: true }).click();

  await tabs.getByRole('button', { name: /^설정집 목록/ }).click();
  const uploadButton = page.getByRole('button', { name: '설정집 업로드', exact: true });
  await expect(uploadButton).toBeVisible();
  await expect.poll(() => uploadButton.evaluate(element => (
    getComputedStyle(element).whiteSpace === 'nowrap'
      && element.scrollHeight <= element.clientHeight + 1
  ))).toBe(true);
});

test('원고 목록은 휴대폰에서 메타 정보와 작업 버튼을 카드 안에 모두 표시한다', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.route('**/api/v1/**', route => {
    const pathname = new URL(route.request().url()).pathname;
    if (pathname.endsWith('/auth/me')) return fulfill(route, member);
    if (pathname.endsWith(`/works/${WORK_ID}`)) {
      return fulfill(route, { id: WORK_ID, title: '모바일 원고 작품', genre: '판타지', latestEpisodeNo: 1 });
    }
    if (pathname.endsWith(`/works/${WORK_ID}/episodes`)) {
      return fulfill(route, [{
        id: EPISODE_ID,
        episodeNo: 1,
        title: '모바일에서 작업 버튼을 확인하는 원고',
        originalFilename: 'mobile-episode-01.txt',
        contentUpdatedAt: '2026-08-01T12:00:00+09:00',
        charCount: 5240,
        analysisStatus: 'COMPLETED',
      }]);
    }
    return fulfill(route, []);
  });

  await authenticate(page);
  await page.goto(`/dashboard?workId=${WORK_ID}&nav=manuscripts`);

  await expect(page.locator('.manuscript-table-head')).toBeHidden();
  const row = page.locator('.manuscript-row').first();
  await expect(row).toContainText('mobile-episode-01.txt');
  for (const label of ['원문', '파일 변경', '삭제']) {
    const button = row.getByRole('button', { name: label, exact: true });
    await expect(button).toBeVisible();
    const box = await button.boundingBox();
    expect(box).not.toBeNull();
    expect((box?.x ?? 0) + (box?.width ?? 0)).toBeLessThanOrEqual(390);
  }
  await expectNoHorizontalOverflow(page, '.dashboard-content');
});

test('회차 업로드 방식과 원문 리더는 휴대폰 너비에 맞춰 표시된다', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.route('**/api/v1/**', route => {
    const pathname = new URL(route.request().url()).pathname;
    if (pathname.endsWith('/auth/me')) return fulfill(route, member);
    if (pathname.endsWith(`/episodes/${EPISODE_ID}`)) {
      return fulfill(route, {
        id: EPISODE_ID,
        episodeNo: 3,
        title: '긴 모바일 원문 제목이 헤더 밖으로 넘치지 않아야 하는 회차',
        content: '첫 번째 문장입니다.\n두 번째 문장입니다.',
        originalFilename: 'episode-3.txt',
        contentUpdatedAt: '2026-08-01T12:00:00+09:00',
        charCount: 22,
      });
    }
    if (pathname.endsWith(`/works/${WORK_ID}`)) {
      return fulfill(route, { id: WORK_ID, title: '모바일 작품', genre: '판타지', latestEpisodeNo: 2 });
    }
    return fulfill(route, []);
  });

  await authenticate(page);
  await page.goto(`/episode-upload?workId=${WORK_ID}`);

  const firstStepLabel = page.locator('.episode-upload-step__label').first();
  const firstStepLine = page.locator('.episode-upload-step__line').first();
  const [stepLabelBox, stepLineBox] = await Promise.all([
    firstStepLabel.boundingBox(),
    firstStepLine.boundingBox(),
  ]);
  expect(stepLabelBox).not.toBeNull();
  expect(stepLineBox).not.toBeNull();
  expect(stepLineBox!.x).toBeGreaterThanOrEqual(stepLabelBox!.x + stepLabelBox!.width);

  const modeCards = page.locator('.episode-upload-mode-grid > *');
  await expect(modeCards).toHaveCount(3);
  const [firstModeBox, secondModeBox] = await Promise.all([
    modeCards.nth(0).boundingBox(),
    modeCards.nth(1).boundingBox(),
  ]);
  expect(firstModeBox).not.toBeNull();
  expect(secondModeBox).not.toBeNull();
  expect(Math.abs((firstModeBox?.x ?? 0) - (secondModeBox?.x ?? 0))).toBeLessThanOrEqual(1);
  expect(secondModeBox?.y ?? 0).toBeGreaterThan(firstModeBox?.y ?? 0);
  await expectNoHorizontalOverflow(page, '.episode-upload-page');

  await page.goto(`/editor?workId=${WORK_ID}&episodeId=${EPISODE_ID}`);
  await expect(page.getByRole('article')).toContainText('첫 번째 문장입니다.');
  await expectNoHorizontalOverflow(page, '.original-reader-page');
  await expectNoHorizontalOverflow(page, '.original-reader-header');
});
