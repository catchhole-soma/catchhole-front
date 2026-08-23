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
  let summaryRequestCount = 0;
  let summaryShouldFail = true;
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
    if (pathname === `/api/v1/works/${workId}/characters/${characterId}`) {
      return success(route, {
        id: characterId,
        name: '아리아',
        roleLabel: '주인공',
        currentAge: 24,
        currentLevel: 3,
        firstAppearanceEpisode: {
          episodeId: '55555555-5555-4555-8555-555555555551',
          episodeNo: 1,
          title: '첫 등장',
        },
        profile: [{
          characterFactId: secondFactId,
          key: 'profile.height',
          displayName: '신장',
          value: '170cm',
          valueType: 'STRING',
          properties: [],
          hasEvidence: false,
        }],
        stats: [],
        skills: [],
        items: [],
        statuses: [{
          characterFactId: firstFactId,
          key: 'status.injury',
          displayName: '부상',
          value: '오른발을 다침',
          valueType: 'STRING',
          properties: [],
          hasEvidence: true,
        }],
      });
    }
    if (pathname === `/api/v1/works/${workId}/characters/${characterId}/timeline/summary`) {
      summaryRequestCount += 1;
      if (summaryShouldFail) {
        return route.fulfill({
          status: 404,
          contentType: 'application/json',
          body: JSON.stringify({
            success: false,
            message: '타임라인 요약을 불러오지 못했습니다.',
            data: null,
            error: { code: 'CHARACTER_TIMELINE_NOT_FOUND', status: 404, details: [] },
          }),
        });
      }
      const factType = url.searchParams.get('factType') ?? 'ALL';
      const factTypes = url.searchParams.getAll('factTypes');
      const factKeys = url.searchParams.getAll('factKeys');
      const filteredFactCount = factTypes.length > 0 || factKeys.length > 0
        ? 2
        : factType === 'PROFILE' || factType === 'AGE' ? 1 : factType === 'STATUS' ? 2 : 4;
      return success(route, {
        characterId,
        characterName: '아리아',
        firstAppearanceEpisodeNo: 1,
        totalFactCount: 4,
        totalEpisodeCount: 2,
        appliedFactType: factType,
        appliedFactTypes: factTypes,
        appliedFactKeys: factKeys,
        filteredFactCount,
        factTypeCounts: [
          { factType: 'PROFILE', factTypeLabel: '프로필', count: 1 },
          { factType: 'AGE', factTypeLabel: '나이', count: 1 },
          { factType: 'LEVEL', factTypeLabel: '레벨', count: 0 },
          { factType: 'STAT', factTypeLabel: '스탯', count: 0 },
          { factType: 'SKILL', factTypeLabel: '스킬', count: 0 },
          { factType: 'ITEM', factTypeLabel: '아이템', count: 0 },
          { factType: 'STATUS', factTypeLabel: '상태', count: 2 },
        ],
        factFacets: [
          {
            factType: 'PROFILE',
            factTypeLabel: '프로필',
            count: 1,
            factKeys: [{ factKey: 'profile.height', displayName: '신장', count: 1 }],
          },
          {
            factType: 'AGE',
            factTypeLabel: '나이',
            count: 1,
            factKeys: [{ factKey: 'age', displayName: '나이', count: 1 }],
          },
          { factType: 'LEVEL', factTypeLabel: '레벨', count: 0, factKeys: [] },
          { factType: 'STAT', factTypeLabel: '스탯', count: 0, factKeys: [] },
          { factType: 'SKILL', factTypeLabel: '스킬', count: 0, factKeys: [] },
          { factType: 'ITEM', factTypeLabel: '아이템', count: 0, factKeys: [] },
          {
            factType: 'STATUS',
            factTypeLabel: '상태',
            count: 2,
            factKeys: [
              { factKey: 'status.injury', displayName: '부상', count: 1 },
              { factKey: 'status.recovery', displayName: '회복', count: 1 },
            ],
          },
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
        factTypes: url.searchParams.getAll('factTypes').join(','),
        factKeys: url.searchParams.getAll('factKeys').join(','),
        cursor: url.searchParams.get('cursor'),
        fromEpisodeNo: url.searchParams.get('fromEpisodeNo'),
      });
      const profileSelected = url.searchParams.getAll('factTypes').includes('PROFILE');
      const secondFact = profileSelected
        ? {
            characterFactId: secondFactId,
            factType: 'PROFILE',
            factKey: 'profile.height',
            factTypeLabel: '프로필',
            displayName: '신장',
            factValue: '170cm',
            sourceType: 'EPISODE',
            sourceEpisodeId: '55555555-5555-4555-8555-555555555552',
            sourceEpisodeNo: 2,
            hasEvidence: false,
          }
        : {
            characterFactId: secondFactId,
            factType: 'STATUS',
            factKey: 'status.recovery',
            factTypeLabel: '상태',
            displayName: '회복',
            factValue: '상처가 회복되기 시작함',
            sourceType: 'EPISODE',
            sourceEpisodeId: '55555555-5555-4555-8555-555555555552',
            sourceEpisodeNo: 2,
            hasEvidence: false,
          };
      const profileOnly = url.searchParams.getAll('factTypes').includes('PROFILE')
        && url.searchParams.getAll('factKeys').length === 0;
      if (profileOnly) {
        return success(route, { content: [secondFact], nextCursor: null, hasNext: false, size: 1 });
      }
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
          factKey: 'status.injury',
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
  await page.goto(`/dashboard?workId=${workId}&nav=settingDB&tab=characters`);

  await expect(page.getByRole('heading', { name: '캐릭터 설정', exact: true })).toBeVisible();
  await expect(page.locator('.database-v2')).toHaveCount(1);
  await expect(page.locator('.character-card').first()).toHaveCSS('background-color', 'rgb(255, 255, 255)');
  await expect(page.locator('.character-card').first()).toHaveCSS('border-radius', '16px');
  await expect(page.locator('.character-card').first().locator('.character-avatar')).toHaveCount(0);
  await expect(page.locator('.character-card').first().locator('.character-card__eyebrow')).toHaveText('CHARACTER');
  await page.getByRole('button', { name: /아리아/ }).click();
  await expect(page.getByText('현재 나이', { exact: true })).toBeVisible();
  await expect(page.locator('.character-detail-modal')).toHaveCSS('background-color', 'rgb(255, 255, 255)');
  const emptyStat = page.getByText('스탯 정보 없음', { exact: true }).locator('..').locator('..');
  await expect(emptyStat).toHaveCSS('background-color', 'rgb(238, 247, 255)');
  await expect(emptyStat).toHaveCSS('min-height', '66px');
  await expect(page.getByTestId('character-status-settings').locator('.character-setting-row')).toHaveCSS('grid-column', '1 / -1');
  await page.getByRole('button', { name: '변화 이력 보기' }).click();

  const detailModal = page.getByTestId('character-modal-backdrop');
  const dialog = page.getByRole('dialog', { name: '캐릭터 설정 이력' });
  await expect(detailModal).toBeVisible();
  await expect(dialog).toBeVisible();
  await expect(dialog).toHaveCSS('background-color', 'rgb(255, 255, 255)');
  await expect.poll(async () => {
    const [currentDetailBox, currentTimelineBox] = await Promise.all([
      detailModal.locator('.character-detail-modal').boundingBox(),
      dialog.boundingBox(),
    ]);
    if (!currentDetailBox || !currentTimelineBox) return Number.POSITIVE_INFINITY;
    return currentTimelineBox.x - (currentDetailBox.x + currentDetailBox.width);
  }).toBeLessThanOrEqual(20);
  const [detailBox, initialTimelineBox] = await Promise.all([
    detailModal.locator('.character-detail-modal').boundingBox(),
    dialog.boundingBox(),
  ]);
  expect(detailBox).not.toBeNull();
  expect(initialTimelineBox).not.toBeNull();
  const panelGap = initialTimelineBox!.x - (detailBox!.x + detailBox!.width);
  expect(panelGap).toBeGreaterThanOrEqual(12);
  await expect(dialog.getByRole('alert')).toContainText('타임라인 요약을 불러오지 못했습니다.');
  await expect(dialog.getByText('변화 이력을 보고 싶은 설정을 선택하세요.')).toHaveCount(0);
  summaryShouldFail = false;
  await dialog.getByRole('button', { name: '다시 시도' }).click();
  await expect(dialog.getByText('변화 이력을 보고 싶은 설정을 선택하세요.')).toBeVisible();
  await expect(detailModal.getByRole('button', { name: '부상 원문 근거 보기' })).toHaveCount(0);
  expect(timelineRequests).toHaveLength(0);
  await expect.poll(() => summaryRequestCount).toBeGreaterThan(0);

  const profileFilter = detailModal.getByRole('button', { name: '프로필 전체 변화 이력 추가' });
  await profileFilter.click();
  await expect(detailModal.getByRole('button', { name: '프로필 전체 변화 이력 제거' }))
    .toHaveAttribute('aria-pressed', 'true');
  await expect(detailModal.getByRole('button', { name: '신장 변화 이력 추가' }))
    .toHaveAttribute('aria-pressed', 'false');
  await expect(detailModal.locator('.character-section-timeline-heading.is-selected + div')).toHaveCount(1);
  await expect.poll(() => new URL(page.url()).searchParams.getAll('timelineFactTypes')).toEqual(['PROFILE']);
  await expect.poll(() => timelineRequests.some(request => request.factTypes === 'PROFILE')).toBe(true);

  const injuryFilter = detailModal.getByRole('button', { name: '부상 변화 이력 추가' });
  await injuryFilter.click();
  await expect(detailModal.getByRole('button', { name: '부상 변화 이력 제거' }))
    .toHaveAttribute('aria-pressed', 'true');
  await expect.poll(() => new URL(page.url()).searchParams.getAll('timelineFactKeys')).toEqual(['status.injury']);
  await expect.poll(() => timelineRequests.some(request => (
    request.factTypes === 'PROFILE' && request.factKeys === 'status.injury'
  ))).toBe(true);
  await expect(dialog.locator('.character-timeline-fact__copy strong').getByText('부상', { exact: true })).toBeVisible();

  await dialog.getByRole('button', { name: '처음부터 다시 불러오기' }).click();
  await expect(dialog.getByText('신장', { exact: true })).toBeVisible();
  await expect.poll(() => timelineRequests.filter(request => request.cursor === 'cursor-2').length).toBe(2);

  const timelineFeed = dialog.locator('.character-timeline-feed');
  await timelineFeed.evaluate(element => {
    element.style.height = '80px';
    element.style.overflowY = 'auto';
    element.scrollTop = element.scrollHeight;
  });
  await expect.poll(() => timelineFeed.evaluate(element => element.scrollTop)).toBeGreaterThan(0);

  await dialog.getByRole('button', { name: '부상 필터 제거' }).click();
  await expect.poll(() => new URL(page.url()).searchParams.getAll('timelineFactKeys')).toEqual([]);
  await expect.poll(() => timelineRequests.some(request => (
    request.factTypes === 'PROFILE' && request.factKeys === ''
  ))).toBe(true);
  await expect.poll(() => timelineFeed.evaluate(element => element.scrollTop)).toBe(0);
  await expect(dialog.getByRole('button', { name: '부상 필터 제거' })).toHaveCount(0);

  await dialog.getByRole('button', { name: '프로필 전체 이력 필터 제거' }).click();
  await expect.poll(() => new URL(page.url()).searchParams.getAll('timelineFactTypes')).toEqual([]);
  await expect(dialog.getByText('변화 이력을 보고 싶은 설정을 선택하세요.')).toBeVisible();
  expect(timelineRequests.filter(request => (
    !request.factType && !request.factTypes && !request.factKeys
  ))).toHaveLength(0);

  await dialog.getByRole('button', { name: '전체 이력 보기' }).click();
  await expect.poll(() => new URL(page.url()).searchParams.getAll('timelineFactTypes')).toEqual([]);
  await expect.poll(() => new URL(page.url()).searchParams.getAll('timelineFactKeys')).toEqual([]);
  await dialog.getByRole('button', { name: /상태 2/ }).click();
  await expect.poll(() => new URL(page.url()).searchParams.get('timelineFactType')).toBe('STATUS');
  await expect.poll(() => timelineRequests.some(request => request.factType === 'STATUS')).toBe(true);

  await dialog.getByRole('button', { name: '2화 1개', exact: true }).click();
  await expect.poll(() => new URL(page.url()).searchParams.get('timelineEpisodeNo')).toBe('2');
  await expect.poll(() => timelineRequests.some(request => request.fromEpisodeNo === '2')).toBe(true);

  await dialog.getByRole('button', { name: '첫 회차부터 보기' }).click();
  await expect.poll(() => new URL(page.url()).searchParams.get('timelineEpisodeNo')).toBeNull();
  await expect(dialog.getByText('부상', { exact: true })).toBeVisible();
  await dialog.locator('button.timeline-evidence-button:not(:disabled)').click();

  await expect(page.getByRole('region', { name: '캐릭터 설정 원문 근거' })).toBeVisible();
  await expect(page.getByRole('region', { name: '캐릭터 설정 원문 근거' }))
    .toHaveCSS('background-color', 'rgb(255, 255, 255)');
  const evidenceTimelineBox = await dialog.boundingBox();
  expect(evidenceTimelineBox).not.toBeNull();
  expect(Math.abs(evidenceTimelineBox!.width - initialTimelineBox!.width)).toBeLessThan(2);
  await expect(page.getByTestId('character-evidence-highlight')).toHaveText('검을 들었다');
  await expect(page.getByRole('button', { name: '원문 근거 닫기' })).toBeVisible();
  await expect.poll(() => page.locator('.character-evidence-panel__body').evaluate(element => element.scrollTop)).toBeGreaterThan(0);
  await expect(detailModal.locator('.character-detail-modal')).toHaveCSS('pointer-events', 'none');
  expect(new URL(page.url()).searchParams.get('timelineFactId')).toBe(firstFactId);
  expect(new URL(page.url()).searchParams.get('factId')).toBeNull();

  const dimmedDetailBox = await detailModal.locator('.character-detail-modal').boundingBox();
  expect(dimmedDetailBox).not.toBeNull();
  await page.mouse.click(dimmedDetailBox!.x + 12, dimmedDetailBox!.y + 180);
  await expect(detailModal).toBeVisible();
  await expect(dialog).toBeVisible();
  await expect(page.getByRole('region', { name: '캐릭터 설정 원문 근거' })).toBeVisible();
  expect(new URL(page.url()).searchParams.get('timelineFactId')).toBe(firstFactId);

  await page.getByRole('button', { name: '원문 근거 닫기' }).click();
  await expect(page.getByRole('region', { name: '캐릭터 설정 원문 근거' })).toHaveCount(0);
  expect(new URL(page.url()).searchParams.get('timelineFactId')).toBeNull();
  expect(new URL(page.url()).searchParams.get('timelineFactType')).toBe('STATUS');
  await expect(dialog.getByText('부상', { exact: true })).toBeVisible();

  await page.getByRole('button', { name: '타임라인 닫기' }).click();
  await expect(page.getByText('현재 나이', { exact: true })).toBeVisible();
  await expect.poll(() => new URL(page.url()).searchParams.get('modal')).toBe('char-detail');
  await expect.poll(() => new URL(page.url()).searchParams.get('mode')).toBeNull();
  await expect.poll(() => new URL(page.url()).searchParams.get('timelineFactType')).toBeNull();

  await page.goto(
    `/dashboard?workId=${workId}&nav=settingDB&tab=characters`
      + `&modal=character-timeline&charId=${characterId}`
      + `&timelineFactType=STATUS&timelineEpisodeNo=2&factId=${firstFactId}`,
  );
  await expect.poll(() => new URL(page.url()).searchParams.get('modal')).toBe('char-detail');
  await expect.poll(() => new URL(page.url()).searchParams.get('mode')).toBe('timeline');
  await expect.poll(() => new URL(page.url()).searchParams.get('timelineView')).toBe('all');
  await expect.poll(() => new URL(page.url()).searchParams.get('timelineFactType')).toBe('STATUS');
  await expect.poll(() => new URL(page.url()).searchParams.get('timelineEpisodeNo')).toBe('2');
  await expect.poll(() => new URL(page.url()).searchParams.get('timelineFactId')).toBe(firstFactId);
  await expect.poll(() => new URL(page.url()).searchParams.get('factId')).toBeNull();
  await expect(page.getByRole('dialog', { name: '캐릭터 설정 이력' })).toBeVisible();
  await expect(page.getByRole('region', { name: '캐릭터 설정 원문 근거' })).toBeVisible();
});
