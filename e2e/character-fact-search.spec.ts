import { expect, test, type Page, type Route } from '@playwright/test';

const workId = '11111111-1111-4111-8111-111111111111';
const characterId = '22222222-2222-4222-8222-222222222222';
const factId = '33333333-3333-4333-8333-333333333333';
const retryFactId = '44444444-4444-4444-8444-444444444444';
const missingFactId = '55555555-5555-4555-8555-555555555555';

const member = {
  id: 1,
  email: 'character-fact-search@example.com',
  displayName: '설정 검색 테스트',
  phoneNumber: '01012345678',
  phoneVerified: false,
  role: 'AUTHOR',
  status: 'ACTIVE',
};

function success(route: Route, data: unknown) {
  return route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ success: true, message: null, data, error: null }),
  });
}

function failure(route: Route, status: number, message: string) {
  return route.fulfill({
    status,
    contentType: 'application/json',
    body: JSON.stringify({
      success: false,
      message,
      data: null,
      error: {
        code: status === 404 ? 'CHARACTER_FACT_NOT_FOUND' : 'COMMON_INTERNAL_SERVER_ERROR',
        status,
        details: [],
      },
    }),
  });
}

function searchPage(content: unknown[], page = 0, totalElements = content.length, totalPages = 1) {
  return {
    content,
    page,
    size: 20,
    totalElements,
    totalPages,
    hasNext: page + 1 < totalPages,
  };
}

function searchResult(id = factId) {
  return {
    characterFactId: id,
    factType: 'SKILL',
    factTypeLabel: '스킬',
    displayName: id === missingFactId ? '사라진 기술' : '월광 검술',
    factValue: id === missingFactId ? 'Lv.0' : 'Lv.3',
    contributesToCurrentSnapshot: id !== retryFactId,
    // 새 필드와 값이 다를 때도 deprecated alias보다 새 계약을 우선해야 한다.
    isCurrent: true,
    characterId,
    characterName: '아르켄',
    sourceEpisodeId: '66666666-6666-4666-8666-666666666666',
    sourceEpisodeNo: 12,
    effectiveFromEpisodeNo: 10,
  };
}

function detail(id = factId, evidenceQuotes: string[] = []) {
  return {
    characterFactId: id,
    factKey: 'skill.moonlight_sword',
    factType: 'SKILL',
    factTypeLabel: '스킬',
    displayName: '월광 검술',
    factValue: 'Lv.3',
    contributesToCurrentSnapshot: id !== retryFactId,
    isCurrent: true,
    effectiveFromEpisodeNo: 10,
    characterId,
    characterName: '아르켄',
    sourceCandidateId: '77777777-7777-4777-8777-777777777777',
    sourceEpisodeId: '66666666-6666-4666-8666-666666666666',
    sourceEpisodeNo: 12,
    evidenceQuotes,
  };
}

function characterDetail() {
  return {
    id: characterId,
    name: '아르켄',
    status: 'ACTIVE',
    currentAge: 24,
    currentLevel: 7,
    roleLabel: '주인공',
    firstAppearanceEpisode: null,
    profile: [],
    stats: [],
    skills: [],
    items: [],
    statuses: [],
  };
}

async function authenticate(page: Page) {
  await page.goto('/login');
  await page.evaluate(() => {
    localStorage.setItem('accessToken', 'character-fact-search-token');
    localStorage.removeItem('catchhole_demo_mode');
  });
}

function routeDashboardBase(route: Route) {
  const request = route.request();
  const url = new URL(request.url());
  const pathname = url.pathname;

  if (pathname.endsWith('/auth/me')) return success(route, member);
  if (pathname === '/api/v1/works' && request.method() === 'GET') {
    return success(route, [{
      id: workId,
      title: '설정 검색 작품',
      genre: '판타지',
      episodeCount: 12,
    }]);
  }
  if (pathname === `/api/v1/works/${workId}`) {
    return success(route, {
      id: workId,
      title: '설정 검색 작품',
      genre: '판타지',
      latestEpisodeNo: 12,
    });
  }
  if (pathname === `/api/v1/works/${workId}/episodes`) return success(route, []);
  if (pathname === `/api/v1/works/${workId}/characters`
    || pathname === `/api/v1/works/${workId}/characters/archived`) {
    return success(route, searchPage([]));
  }
  if (pathname === `/api/v1/works/${workId}/characters/${characterId}`) {
    return success(route, characterDetail());
  }
  return null;
}

test('검색 상태를 URL에 보존하고 300ms debounce와 UI/API 페이지 변환을 적용한다', async ({ page }) => {
  const requests: Array<Record<string, string | null>> = [];

  await page.route('**/api/v1/**', route => {
    const url = new URL(route.request().url());
    const baseHandled = routeDashboardBase(route);
    if (baseHandled) return baseHandled;

    if (url.pathname === `/api/v1/works/${workId}/character-facts/search`) {
      requests.push({
        q: url.searchParams.get('q'),
        factType: url.searchParams.get('factType'),
        scope: url.searchParams.get('scope'),
        page: url.searchParams.get('page'),
        size: url.searchParams.get('size'),
      });
      const apiPage = Number(url.searchParams.get('page') ?? 0);
      return success(route, searchPage([searchResult()], apiPage, 21, 2));
    }
    if (url.pathname === `/api/v1/works/${workId}/character-facts/${factId}`) {
      return success(route, detail());
    }
    return success(route, []);
  });

  await authenticate(page);
  await page.goto(
    `/dashboard?workId=${workId}&nav=settingDB&tab=search`
    + '&q=%EA%B2%80%EC%88%A0&factType=ALL&scope=ALL&page=2&size=20',
  );

  await expect(page.getByTestId('character-fact-results')).toBeVisible();
  const firstResult = page.getByTestId('character-fact-results').getByRole('button').first();
  await expect(page.locator('.character-fact-search__field')).toHaveCSS('background-color', 'rgb(255, 255, 255)');
  await expect(page.getByRole('button', { name: '전체', exact: true }).first()).toHaveCSS('color', 'rgb(8, 126, 242)');
  await expect(firstResult).toHaveCSS('background-color', 'rgb(255, 255, 255)');
  await expect(firstResult).toHaveCSS('border-radius', '16px');
  await expect(firstResult.getByText('월광 검술', { exact: true })).toBeVisible();
  await expect(firstResult.getByText('Lv.3', { exact: true })).toBeVisible();
  await expect.poll(() => requests.some(request => request.q === '검술' && request.page === '1'))
    .toBe(true);
  await expect(page.getByText('2 / 2 페이지', { exact: true })).toBeVisible();

  const input = page.getByRole('textbox', { name: '설정 검색' });
  await expect(input).toHaveAttribute('placeholder', '설정명 또는 값 검색');
  const requestCountBeforeTyping = requests.length;
  await input.fill('회복');
  await page.waitForTimeout(150);
  expect(requests).toHaveLength(requestCountBeforeTyping);
  expect(new URL(page.url()).searchParams.get('q')).toBe('검술');

  await expect.poll(() => requests.some(request => (
    request.q === '회복'
    && request.page === '0'
    && request.size === '20'
  ))).toBe(true);
  await expect.poll(() => new URL(page.url()).searchParams.get('q')).toBe('회복');
  expect(new URL(page.url()).searchParams.get('page')).toBe('1');

  await page.getByRole('button', { name: '스킬', exact: true }).click();
  await expect.poll(() => requests.some(request => (
    request.q === '회복' && request.factType === 'SKILL' && request.page === '0'
  ))).toBe(true);

  await page.getByRole('button', { name: '다음 페이지' }).click();
  await expect.poll(() => requests.some(request => (
    request.factType === 'SKILL' && request.page === '1'
  ))).toBe(true);
  expect(new URL(page.url()).searchParams.get('page')).toBe('2');

  await page.getByRole('button', { name: '현재값 근거', exact: true }).click();
  await expect.poll(() => requests.some(request => (
    request.factType === 'SKILL'
    && request.scope === 'CURRENT'
    && request.page === '0'
  ))).toBe(true);
  expect(new URL(page.url()).searchParams.get('page')).toBe('1');

  await page.getByTestId('character-fact-results').getByRole('button').first().click();
  const dialog = page.getByRole('dialog', { name: '설정 상세' });
  await expect(dialog).toBeVisible();
  await expect(dialog).toHaveCSS('background-color', 'rgb(255, 255, 255)');
  await expect(dialog).toHaveCSS('border-radius', '20px');
  await expect(dialog.getByText('설정명', { exact: true })).toBeVisible();
  await expect(dialog.getByText('월광 검술', { exact: true })).toBeVisible();
  await expect(dialog.getByText('Lv.3', { exact: true })).toBeVisible();
  await expect(dialog.getByText('설정 키', { exact: true })).toHaveCount(0);
  await expect(dialog.getByText('skill.moonlight_sword', { exact: true })).toHaveCount(0);
  await expect(dialog.getByText('원문이 삭제되었거나 저장된 근거가 없습니다.', { exact: true })).toBeVisible();
  await expect(dialog.locator('.theme-evidence__empty'))
    .toHaveCSS('background-color', 'rgb(248, 251, 255)');
  expect(new URL(page.url()).searchParams.get('modal')).toBe('fact-detail');
  expect(new URL(page.url()).searchParams.get('factId')).toBe(factId);

  await dialog.getByRole('button', { name: '설정 상세 닫기' }).click();
  const afterClose = new URL(page.url()).searchParams;
  expect(afterClose.get('modal')).toBeNull();
  expect(afterClose.get('factId')).toBeNull();
  expect(afterClose.get('q')).toBe('회복');
  expect(afterClose.get('factType')).toBe('SKILL');
  expect(afterClose.get('scope')).toBe('CURRENT');

  await page.getByTestId('character-fact-results').getByRole('button').first().click();
  await page.getByRole('dialog', { name: '설정 상세' })
    .getByRole('button', { name: '캐릭터 상세 보기' })
    .click();
  const characterUrl = new URL(page.url()).searchParams;
  expect(characterUrl.get('tab')).toBe('characters');
  expect(characterUrl.get('modal')).toBe('char-detail');
  expect(characterUrl.get('charId')).toBe(characterId);
  expect(characterUrl.get('factId')).toBeNull();
  expect(characterUrl.get('q')).toBe('회복');
});

test('검색 로딩·실패 재시도·빈 결과 상태를 표시한다', async ({ page }) => {
  let searchAttempts = 0;

  await page.route('**/api/v1/**', async route => {
    const url = new URL(route.request().url());
    const baseHandled = routeDashboardBase(route);
    if (baseHandled) return baseHandled;

    if (url.pathname === `/api/v1/works/${workId}/character-facts/search`) {
      searchAttempts += 1;
      if (searchAttempts === 1) {
        await new Promise(resolve => setTimeout(resolve, 400));
      }
      if (searchAttempts <= 3) {
        return failure(route, 500, '설정 검색 결과를 불러오지 못했습니다.');
      }
      return success(route, searchPage([]));
    }
    return success(route, []);
  });

  await authenticate(page);
  await page.goto(`/dashboard?workId=${workId}&nav=settingDB&tab=search`);

  await expect(page.getByText('설정 검색 결과를 불러오는 중입니다.', { exact: true })).toBeVisible();
  await expect(page.getByText('설정 검색 결과를 불러오지 못했습니다.', { exact: true }))
    .toBeVisible({ timeout: 10_000 });
  await page.getByRole('button', { name: '다시 시도', exact: true }).click();
  await expect(page.getByText('검색 결과가 없습니다', { exact: true })).toBeVisible();
  expect(searchAttempts).toBe(4);
});

test('상세 실패를 모달 안에서 재시도하고 404를 찾을 수 없음으로 구분한다', async ({ page }) => {
  let retryDetailAttempts = 0;

  await page.route('**/api/v1/**', route => {
    const url = new URL(route.request().url());
    const baseHandled = routeDashboardBase(route);
    if (baseHandled) return baseHandled;

    if (url.pathname === `/api/v1/works/${workId}/character-facts/search`) {
      return success(route, searchPage([
        searchResult(retryFactId),
        searchResult(missingFactId),
      ]));
    }
    if (url.pathname === `/api/v1/works/${workId}/character-facts/${retryFactId}`) {
      retryDetailAttempts += 1;
      if (retryDetailAttempts <= 3) {
        return failure(route, 500, '설정 정보를 불러오지 못했습니다.');
      }
      return success(route, detail(retryFactId, ['달빛이 칼날을 따라 번졌다.']));
    }
    if (url.pathname === `/api/v1/works/${workId}/character-facts/${missingFactId}`) {
      return failure(route, 404, '설정 정보를 찾을 수 없습니다.');
    }
    return success(route, []);
  });

  await authenticate(page);
  await page.goto(`/dashboard?workId=${workId}&nav=settingDB&tab=search`);

  const cards = page.getByTestId('character-fact-results').getByRole('button');
  await expect(cards).toHaveCount(2);
  await expect(cards.first().getByText('그 외 이력', { exact: true })).toBeVisible();
  await cards.first().click();

  const retryDialog = page.getByRole('dialog', { name: '설정 상세' });
  await expect(retryDialog.getByText('설정 정보를 불러오지 못했습니다.', { exact: true }))
    .toBeVisible({ timeout: 10_000 });
  await retryDialog.getByRole('button', { name: '다시 시도', exact: true }).click();
  await expect(retryDialog.getByText('달빛이 칼날을 따라 번졌다.', { exact: false })).toBeVisible();
  expect(retryDetailAttempts).toBe(4);
  await retryDialog.getByRole('button', { name: '설정 상세 닫기' }).click();

  await cards.nth(1).click();
  const missingDialog = page.getByRole('dialog', { name: '설정 상세' });
  await expect(missingDialog.getByText('설정 정보를 찾을 수 없습니다.', { exact: true })).toBeVisible();
  await expect(missingDialog.getByRole('button', { name: '다시 시도', exact: true })).toHaveCount(0);
});
