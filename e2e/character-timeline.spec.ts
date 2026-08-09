import { expect, test, type Page, type Route } from '@playwright/test';

const workId = '11111111-1111-4111-8111-111111111111';
const characterId = '22222222-2222-4222-8222-222222222222';
const firstFactId = '33333333-3333-4333-8333-333333333333';
const secondFactId = '44444444-4444-4444-8444-444444444444';

function success(route: Route, data: unknown) {
  return route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ success: true, message: null, data, error: null }),
  });
}

async function authenticate(page: Page) {
  await page.goto('/login');
  await page.evaluate(() => {
    localStorage.setItem('accessToken', 'character-timeline-token');
    localStorage.removeItem('catchhole_demo_mode');
  });
}

test('캐릭터 설정 이력을 필터·cursor로 조회하고 기존 원문 근거 패널을 연다', async ({ page }) => {
  const timelineRequests: Array<Record<string, string | null>> = [];
  let cursorRequestCount = 0;
  await page.route('**/api/v1/**', route => {
    const request = route.request();
    const url = new URL(request.url());
    const pathname = url.pathname;

    if (pathname.endsWith('/auth/me')) {
      return success(route, {
        id: 1,
        email: 'timeline@example.com',
        displayName: '타임라인 테스트',
        role: 'AUTHOR',
        status: 'ACTIVE',
      });
    }
    if (pathname === '/api/v1/works') {
      return success(route, [{ id: workId, title: '타임라인 작품', genre: '판타지', latestEpisodeNo: 2 }]);
    }
    if (pathname === `/api/v1/works/${workId}`) {
      return success(route, { id: workId, title: '타임라인 작품', genre: '판타지', latestEpisodeNo: 2 });
    }
    if (pathname === `/api/v1/works/${workId}/episodes`) return success(route, []);
    if (pathname === `/api/v1/works/${workId}/characters`) {
      return success(route, {
        content: [{
          id: characterId,
          name: '아리아',
          firstAppearanceEpisodeNo: 1,
          currentAge: 24,
          currentLevel: 3,
          representativeSetting: null,
        }],
        page: 0,
        size: Number(url.searchParams.get('size')),
        totalElements: 1,
        totalPages: 1,
        hasNext: false,
      });
    }
    if (pathname === `/api/v1/works/${workId}/characters/${characterId}/timeline/summary`) {
      const factType = url.searchParams.get('factType') ?? 'ALL';
      return success(route, {
        characterId,
        characterName: '아리아',
        firstAppearanceEpisodeNo: 1,
        totalFactCount: 2,
        totalEpisodeCount: 2,
        appliedFactType: factType,
        filteredFactCount: 2,
        factTypeCounts: [
          { factType: 'PROFILE', factTypeLabel: '프로필', count: 0 },
          { factType: 'AGE', factTypeLabel: '나이', count: 0 },
          { factType: 'LEVEL', factTypeLabel: '레벨', count: 0 },
          { factType: 'STAT', factTypeLabel: '스탯', count: 0 },
          { factType: 'SKILL', factTypeLabel: '스킬', count: 0 },
          { factType: 'ITEM', factTypeLabel: '아이템', count: 0 },
          { factType: 'STATUS', factTypeLabel: '상태', count: 2 },
        ],
        episodes: [
          { episodeId: '55555555-5555-4555-8555-555555555551', episodeNo: 1, factCount: 1 },
          { episodeId: '55555555-5555-4555-8555-555555555552', episodeNo: 2, factCount: 1 },
        ],
        manualFactCount: 0,
      });
    }
    if (pathname === `/api/v1/works/${workId}/characters/${characterId}/timeline`) {
      timelineRequests.push({
        factType: url.searchParams.get('factType'),
        cursor: url.searchParams.get('cursor'),
        fromEpisodeNo: url.searchParams.get('fromEpisodeNo'),
      });
      const secondFact = {
        characterFactId: secondFactId,
        factType: 'STATUS',
        factTypeLabel: '상태',
        displayName: '회복',
        factValue: '상처가 회복되기 시작함',
        sourceType: 'EPISODE',
        sourceEpisodeId: '55555555-5555-4555-8555-555555555552',
        sourceEpisodeNo: 2,
        hasEvidence: false,
      };
      if (url.searchParams.get('cursor')) {
        cursorRequestCount += 1;
        if (cursorRequestCount === 1) {
          return route.fulfill({
            status: 400,
            contentType: 'application/json',
            body: JSON.stringify({
              success: false,
              message: '타임라인 cursor가 올바르지 않습니다.',
              data: null,
              error: { code: 'CHARACTER_TIMELINE_CURSOR_INVALID', status: 400, details: [] },
            }),
          });
        }
        return success(route, { content: [secondFact], nextCursor: null, hasNext: false, size: 1 });
      }
      if (url.searchParams.get('fromEpisodeNo') === '2') {
        return success(route, { content: [secondFact], nextCursor: null, hasNext: false, size: 1 });
      }
      return success(route, {
        content: [{
          characterFactId: firstFactId,
          factType: 'STATUS',
          factTypeLabel: '상태',
          displayName: '부상',
          factValue: '오른발을 다침',
          sourceType: 'EPISODE',
          sourceEpisodeId: '55555555-5555-4555-8555-555555555551',
          sourceEpisodeNo: 1,
          hasEvidence: true,
        }],
        nextCursor: 'cursor-2',
        hasNext: true,
        size: 1,
      });
    }
    if (pathname === `/api/v1/works/${workId}/character-facts/${firstFactId}/evidence`) {
      const evidencePrefix = Array.from(
        { length: 80 },
        (_, index) => `${index + 1}번째 문단은 하이라이트 전의 긴 원문입니다.`,
      ).join('\n\n');
      const evidenceQuote = '검을 들었다';
      return success(route, {
        characterFactId: firstFactId,
        sourceCandidateId: '66666666-6666-4666-8666-666666666666',
        episode: { id: '55555555-5555-4555-8555-555555555551', episodeNo: 1, title: '첫 부상' },
        content: `${evidencePrefix}${evidenceQuote}.`,
        evidenceSpans: [{
          quote: evidenceQuote,
          startOffset: [...evidencePrefix].length,
          endOffset: [...evidencePrefix, ...evidenceQuote].length,
        }],
      });
    }
    return success(route, []);
  });

  await authenticate(page);
  await page.goto(`/dashboard?workId=${workId}&nav=settingDB&tab=timeline`);

  await expect(page.getByText('캐릭터 타임라인', { exact: true }).first()).toBeVisible();
  await expect(page.getByText('아리아', { exact: true })).toBeVisible();
  await expect(page.getByText('첫 등장 1화', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: /아리아/ }).click();

  const dialog = page.getByRole('dialog', { name: '캐릭터 설정 이력' });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText('부상', { exact: true })).toBeVisible();
  await dialog.getByRole('button', { name: '처음부터 다시 불러오기' }).click();
  await expect(dialog.getByText('회복', { exact: true })).toBeVisible();
  await expect.poll(() => timelineRequests.filter(request => request.cursor === 'cursor-2').length).toBe(2);

  await dialog.getByRole('button', { name: /상태 2/ }).click();
  await expect.poll(() => new URL(page.url()).searchParams.get('timelineFactType')).toBe('STATUS');
  await expect.poll(() => timelineRequests.some(request => request.factType === 'STATUS')).toBe(true);

  await dialog.getByRole('button', { name: '2화' }).click();
  await expect.poll(() => new URL(page.url()).searchParams.get('timelineEpisodeNo')).toBe('2');
  await expect.poll(() => timelineRequests.some(request => request.fromEpisodeNo === '2')).toBe(true);

  await dialog.getByRole('button', { name: '첫 회차부터 보기' }).click();
  await expect.poll(() => new URL(page.url()).searchParams.get('timelineEpisodeNo')).toBeNull();
  await expect(dialog.getByText('부상', { exact: true })).toBeVisible();
  await dialog.locator('button.timeline-evidence-button:not(:disabled)').click();

  await expect(page.getByRole('region', { name: '캐릭터 설정 원문 근거' })).toBeVisible();
  await expect(page.getByTestId('character-evidence-highlight')).toHaveText('검을 들었다');
  await expect(page.getByRole('button', { name: '원문 근거 닫기' })).toBeVisible();
  await expect.poll(() => page.locator('.character-evidence-panel__body').evaluate(element => element.scrollTop)).toBeGreaterThan(0);
  expect(await page.getByTestId('character-timeline-backdrop').evaluate(element => element.scrollTop)).toBe(0);
  expect(new URL(page.url()).searchParams.get('factId')).toBe(firstFactId);

  await page.getByRole('button', { name: '원문 근거 닫기' }).click();
  await expect(page.getByRole('region', { name: '캐릭터 설정 원문 근거' })).toHaveCount(0);
  expect(new URL(page.url()).searchParams.get('factId')).toBeNull();
  expect(new URL(page.url()).searchParams.get('timelineFactType')).toBe('STATUS');
});
