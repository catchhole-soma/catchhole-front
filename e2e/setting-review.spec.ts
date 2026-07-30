import { expect, test, type Page, type Route } from '@playwright/test';

const workId = '11111111-1111-4111-8111-111111111111';
const batchId = '22222222-2222-4222-8222-222222222222';
const firstCandidateId = '33333333-3333-4333-8333-333333333333';
const secondCandidateId = '44444444-4444-4444-8444-444444444444';

const member = {
  id: 1,
  email: 'setting-review@example.com',
  displayName: '설정 검토 테스트',
  phoneNumber: '01012345678',
  phoneVerified: false,
  role: 'AUTHOR',
  status: 'ACTIVE',
};

const candidates = [
  {
    id: firstCandidateId,
    workId,
    episodeNo: 1,
    entityType: 'CHARACTER',
    entityName: '수아',
    rawEntityMention: '수아',
    matchedCharacterId: '55555555-5555-4555-8555-555555555555',
    matchStatus: 'MATCHED',
    attributeName: 'profile.eye_color',
    attributeNameEditable: false,
    attributeNamePrefix: null,
    attributeValue: '갈색',
    valueType: 'STRING',
    valueJson: { hiddenDetail: '숨은 구조화 값' },
    evidenceSpans: [{ quote: '수아의 눈동자는 햇살 아래 짙은 갈색으로 빛났다.' }],
    rawAiResultJson: { secret: '숨은 AI 원본' },
    confidence: 0.92,
    reviewStatus: 'PENDING_REVIEW',
  },
  {
    id: secondCandidateId,
    workId,
    episodeNo: 2,
    entityType: 'CHARACTER',
    entityName: '강민준',
    rawEntityMention: '민준',
    matchedCharacterId: '66666666-6666-4666-8666-666666666666',
    matchStatus: 'MATCHED',
    attributeName: 'status.부상_상태',
    attributeNameEditable: true,
    attributeNamePrefix: 'status.',
    attributeValue: '경상',
    valueType: 'JSON',
    evidenceSpans: [{ quote: '민준은 전투에서 경상을 입었다.' }],
    confidence: 0.83,
    reviewStatus: 'CONFIRMED',
  },
] as const;

function fulfill(route: Route, data: unknown) {
  return route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ success: true, data, error: null }),
  });
}

function fulfillError(
  route: Route,
  status: number,
  message: string,
  code = 'SETTING_CANDIDATE_CONFIRM_FAILED',
) {
  return route.fulfill({
    status,
    contentType: 'application/json',
    body: JSON.stringify({
      success: false,
      message,
      data: null,
      error: { code, status, details: [] },
    }),
  });
}

async function authenticate(page: Page) {
  await page.goto('/login');
  await page.evaluate(() => localStorage.setItem('accessToken', 'setting-review-token'));
}

test('필수 검토 문맥이 없으면 후보 API를 호출하지 않는다', async ({ page }) => {
  let candidateRequestCount = 0;
  await page.route('**/api/v1/**', route => {
    const pathname = new URL(route.request().url()).pathname;
    if (pathname.includes('/setting-candidates')) candidateRequestCount += 1;
    return fulfill(route, pathname.endsWith('/auth/me') ? member : []);
  });

  await authenticate(page);
  await page.goto('/setting-review');

  await expect(page.getByText('검토할 분석 정보를 찾을 수 없습니다.')).toBeVisible();
  await expect.poll(() => candidateRequestCount).toBe(0);
});

test('검토 대기를 기본으로 조회하고 전체 필터는 URL에 명시한다', async ({ page }) => {
  const requestedReviewStatuses: Array<string | null> = [];

  await page.route('**/api/v1/**', route => {
    const requestUrl = new URL(route.request().url());
    const pathname = requestUrl.pathname;
    if (pathname.endsWith('/auth/me')) return fulfill(route, member);

    const listPath = `/api/v1/works/${workId}/setting-candidates`;
    if (pathname === listPath) {
      const reviewStatus = requestUrl.searchParams.get('reviewStatus');
      requestedReviewStatuses.push(reviewStatus);
      const content = reviewStatus === 'PENDING_REVIEW' ? [candidates[0]] : [...candidates];
      return fulfill(route, {
        batchId,
        episodeStartNo: 1,
        episodeEndNo: 2,
        episodeCount: 2,
        totalCandidateCount: 2,
        reviewedCandidateCount: 1,
        pendingCandidateCount: 1,
        matchRequiredCandidateCount: 0,
        candidates: {
          content,
          page: 0,
          size: 20,
          totalElements: content.length,
          totalPages: 1,
          hasNext: false,
        },
      });
    }

    const candidateId = pathname.startsWith(`${listPath}/`)
      ? pathname.slice(`${listPath}/`.length)
      : null;
    if (candidateId) {
      return fulfill(route, candidates.find(candidate => candidate.id === candidateId));
    }
    return fulfill(route, []);
  });

  await authenticate(page);
  await page.goto(`/setting-review?workId=${workId}&batchId=${batchId}`);

  await expect.poll(() => requestedReviewStatuses.at(-1)).toBe('PENDING_REVIEW');
  await expect.poll(() => new URL(page.url()).searchParams.get('reviewStatus')).toBeNull();
  await expect(page.getByRole('heading', { name: '수아' })).toBeVisible();
  await expect(page.getByRole('progressbar', { name: '설정 후보 검토 진행률' })).toHaveCount(0);
  await expect(page.getByText('1/2 검토 완료', { exact: true })).toHaveCount(0);

  await page.getByRole('button', { name: '전체', exact: true }).first().click();

  await expect.poll(() => new URL(page.url()).searchParams.get('reviewStatus')).toBe('ALL');
  await expect.poll(() => requestedReviewStatuses.at(-1)).toBeNull();

  await page.getByRole('button', { name: '이전 화면' }).click();
  await expect.poll(() => new URL(page.url()).pathname).toBe('/dashboard');
  await expect.poll(() => new URL(page.url()).searchParams.get('nav')).toBe('analyses');
  await page.goBack();
  await expect.poll(() => new URL(page.url()).pathname).toBe('/login');
});

test('후보 처리 응답 전에 이탈하면 늦은 성공 응답이 검토 화면을 다시 열지 않는다', async ({ page }) => {
  let releaseConfirm: (() => void) | undefined;
  let confirmRequestCount = 0;

  await page.route('**/api/v1/**', async route => {
    const requestUrl = new URL(route.request().url());
    const pathname = requestUrl.pathname;
    if (pathname.endsWith('/auth/me')) return fulfill(route, member);

    const listPath = `/api/v1/works/${workId}/setting-candidates`;
    if (pathname === listPath) {
      return fulfill(route, {
        batchId,
        episodeStartNo: 1,
        episodeEndNo: 1,
        episodeCount: 1,
        totalCandidateCount: 1,
        reviewedCandidateCount: 0,
        pendingCandidateCount: 1,
        matchRequiredCandidateCount: 0,
        candidates: {
          content: [candidates[0]],
          page: 0,
          size: 20,
          totalElements: 1,
          totalPages: 1,
          hasNext: false,
        },
      });
    }
    if (pathname === `${listPath}/${firstCandidateId}/confirm`) {
      confirmRequestCount += 1;
      await new Promise<void>(resolve => {
        releaseConfirm = resolve;
      });
      return fulfill(route, { id: firstCandidateId, reviewStatus: 'CONFIRMED' });
    }
    if (pathname === `${listPath}/${firstCandidateId}`) return fulfill(route, candidates[0]);
    return fulfill(route, []);
  });

  await authenticate(page);
  await page.goto(`/dashboard?workId=${workId}&nav=analyses`);
  await page.goto(
    `/setting-review?workId=${workId}&batchId=${batchId}&candidate=${firstCandidateId}`,
  );

  await page.getByRole('button', { name: '확정', exact: true }).last().click();
  await expect.poll(() => Boolean(releaseConfirm)).toBe(true);
  await page.goBack();
  await expect.poll(() => new URL(page.url()).pathname).toBe('/dashboard');

  releaseConfirm?.();
  await expect.poll(() => confirmRequestCount).toBe(1);
  await page.waitForTimeout(500);
  await expect.poll(() => new URL(page.url()).pathname).toBe('/dashboard');
  await expect.poll(() => new URL(page.url()).searchParams.get('nav')).toBe('analyses');
});

test('모바일에서는 후보 목록과 상세를 한 열로 배치한다', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });

  await page.route('**/api/v1/**', route => {
    const requestUrl = new URL(route.request().url());
    const pathname = requestUrl.pathname;
    if (pathname.endsWith('/auth/me')) return fulfill(route, member);

    const listPath = `/api/v1/works/${workId}/setting-candidates`;
    if (pathname === listPath) {
      return fulfill(route, {
        batchId,
        episodeStartNo: 1,
        episodeEndNo: 1,
        episodeCount: 1,
        totalCandidateCount: 1,
        reviewedCandidateCount: 0,
        pendingCandidateCount: 1,
        matchRequiredCandidateCount: 0,
        candidates: {
          content: [candidates[0]],
          page: 0,
          size: 20,
          totalElements: 1,
          totalPages: 1,
          hasNext: false,
        },
      });
    }
    if (pathname === `${listPath}/${firstCandidateId}`) return fulfill(route, candidates[0]);
    return fulfill(route, []);
  });

  await authenticate(page);
  await page.goto(
    `/setting-review?workId=${workId}&batchId=${batchId}&candidate=${firstCandidateId}`,
  );

  const layout = page.locator('.setting-review-layout');
  const [asideBox, detailBox] = await Promise.all([
    layout.locator('aside').boundingBox(),
    layout.locator('section').boundingBox(),
  ]);
  expect(asideBox).not.toBeNull();
  expect(detailBox).not.toBeNull();
  expect(Math.abs((detailBox?.x ?? 0) - (asideBox?.x ?? 0))).toBeLessThanOrEqual(1);
  expect(detailBox?.y ?? 0).toBeGreaterThan(asideBox?.y ?? 0);
  await expect.poll(() => layout.evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true);
});

test('마지막 검토 대기 후보를 확정하면 완료 상태를 표시한다', async ({ page }) => {
  let confirmed = false;

  await page.route('**/api/v1/**', route => {
    const requestUrl = new URL(route.request().url());
    const pathname = requestUrl.pathname;
    if (pathname.endsWith('/auth/me')) return fulfill(route, member);

    const listPath = `/api/v1/works/${workId}/setting-candidates`;
    if (pathname === listPath) {
      const content = confirmed ? [] : [candidates[0]];
      return fulfill(route, {
        batchId,
        episodeStartNo: 1,
        episodeEndNo: 1,
        episodeCount: 1,
        totalCandidateCount: 1,
        reviewedCandidateCount: confirmed ? 1 : 0,
        pendingCandidateCount: confirmed ? 0 : 1,
        matchRequiredCandidateCount: 0,
        candidates: {
          content,
          page: 0,
          size: 20,
          totalElements: content.length,
          totalPages: content.length === 0 ? 0 : 1,
          hasNext: false,
        },
      });
    }
    if (pathname === `${listPath}/${firstCandidateId}/confirm`) {
      confirmed = true;
      return fulfill(route, { id: firstCandidateId, reviewStatus: 'CONFIRMED' });
    }
    if (pathname === `${listPath}/${firstCandidateId}`) {
      return fulfill(route, {
        ...candidates[0],
        reviewStatus: confirmed ? 'CONFIRMED' : 'PENDING_REVIEW',
      });
    }
    return fulfill(route, []);
  });

  await authenticate(page);
  await page.goto(`/setting-review?workId=${workId}&batchId=${batchId}`);

  const confirmButton = page
    .getByRole('article')
    .getByRole('button', { name: '확정', exact: true });
  await expect(confirmButton).toBeEnabled();
  await confirmButton.click();

  await expect.poll(() => confirmed, { timeout: 10_000 }).toBe(true);
  await expect.poll(
    () => new URL(page.url()).searchParams.get('candidate'),
    { timeout: 10_000 },
  ).toBeNull();
  await expect(page.getByText('모든 설정 후보 검토를 완료했습니다.'))
    .toHaveCount(2, { timeout: 10_000 });
  await expect(page.getByText('확정하거나 무시한 후보는 검토 상태 필터에서 다시 확인할 수 있습니다.'))
    .toBeVisible();
});

test('확정 후 목록 재조회가 실패하면 이전 후보를 다시 자동 선택하지 않는다', async ({ page }) => {
  let confirmed = false;

  await page.route('**/api/v1/**', route => {
    const requestUrl = new URL(route.request().url());
    const pathname = requestUrl.pathname;
    if (pathname.endsWith('/auth/me')) return fulfill(route, member);

    const listPath = `/api/v1/works/${workId}/setting-candidates`;
    if (pathname === listPath) {
      if (confirmed) {
        return fulfillError(
          route,
          404,
          '최신 설정 후보 목록을 불러오지 못했습니다.',
          'SETTING_CANDIDATE_LIST_FAILED',
        );
      }
      return fulfill(route, {
        batchId,
        episodeStartNo: 1,
        episodeEndNo: 1,
        episodeCount: 1,
        totalCandidateCount: 1,
        reviewedCandidateCount: 0,
        pendingCandidateCount: 1,
        matchRequiredCandidateCount: 0,
        candidates: {
          content: [candidates[0]],
          page: 0,
          size: 20,
          totalElements: 1,
          totalPages: 1,
          hasNext: false,
        },
      });
    }
    if (pathname === `${listPath}/${firstCandidateId}/confirm`) {
      confirmed = true;
      return fulfill(route, { id: firstCandidateId, reviewStatus: 'CONFIRMED' });
    }
    if (pathname === `${listPath}/${firstCandidateId}`) {
      return fulfill(route, {
        ...candidates[0],
        reviewStatus: confirmed ? 'CONFIRMED' : 'PENDING_REVIEW',
      });
    }
    return fulfill(route, []);
  });

  await authenticate(page);
  await page.goto(`/setting-review?workId=${workId}&batchId=${batchId}`);

  const confirmButton = page
    .getByRole('article')
    .getByRole('button', { name: '확정', exact: true });
  await expect(confirmButton).toBeEnabled();
  await confirmButton.click();

  await expect.poll(() => confirmed, { timeout: 10_000 }).toBe(true);
  await expect(page.getByRole('alert')).toContainText(
    '최신 후보를 불러오지 못해 마지막으로 확인한 목록을 표시합니다.',
    { timeout: 10_000 },
  );
  await expect.poll(() => new URL(page.url()).searchParams.get('candidate')).toBeNull();
  await expect(page.getByText('설정 후보를 선택해 주세요.')).toBeVisible();
});

test('업로드 묶음 후보를 조회하고 페이지·필터를 URL과 서버 요청에 동기화한다', async ({ page }) => {
  const listRequests: Array<{ page: string | null; reviewStatus: string | null }> = [];

  await page.route('**/api/v1/**', route => {
    const requestUrl = new URL(route.request().url());
    const pathname = requestUrl.pathname;
    if (pathname.endsWith('/auth/me')) return fulfill(route, member);

    const listPath = `/api/v1/works/${workId}/setting-candidates`;
    if (pathname === listPath) {
      const requestedPage = requestUrl.searchParams.get('page');
      const reviewStatus = requestUrl.searchParams.get('reviewStatus');
      listRequests.push({ page: requestedPage, reviewStatus });
      const pageIndex = Number(requestedPage ?? 0);
      const content = reviewStatus === 'CONFIRMED'
        ? [candidates[1]]
        : [candidates[Math.min(pageIndex, 1)]];
      return fulfill(route, {
        batchId,
        episodeStartNo: 1,
        episodeEndNo: 5,
        episodeCount: 5,
        totalCandidateCount: 2,
        reviewedCandidateCount: 1,
        pendingCandidateCount: 1,
        matchRequiredCandidateCount: 0,
        candidates: {
          content,
          page: reviewStatus === 'CONFIRMED' ? 0 : pageIndex,
          size: 1,
          totalElements: reviewStatus === 'CONFIRMED' ? 1 : 2,
          totalPages: reviewStatus === 'CONFIRMED' ? 1 : 2,
          hasNext: reviewStatus !== 'CONFIRMED' && pageIndex === 0,
        },
      });
    }

    const candidateId = pathname.startsWith(`${listPath}/`)
      ? pathname.slice(`${listPath}/`.length)
      : null;
    if (candidateId) {
      const candidate = candidates.find(item => item.id === candidateId);
      return fulfill(route, candidate);
    }
    return fulfill(route, []);
  });

  await authenticate(page);
  await page.goto(
    `/setting-review?workId=${workId}&batchId=${batchId}`
    + '&jobType=EPISODE_VALIDATION&reviewStatus=ALL&size=1',
  );

  await expect(page.getByText('1–5화 · 5개 회차')).toBeVisible();
  await expect(page.getByRole('heading', { name: '수아' })).toBeVisible();
  const detail = page.getByRole('article');
  await expect(detail.getByText('프로필', { exact: true })).toBeVisible();
  await expect(detail.getByText('눈 색깔', { exact: true })).toBeVisible();
  await expect(page.getByText('profile.eye_color', { exact: true })).toHaveCount(0);
  await expect(page.getByText('STRING', { exact: true })).toHaveCount(0);
  await expect(page.getByText('숨은 구조화 값', { exact: true })).toHaveCount(0);
  await expect(page.getByText('숨은 AI 원본', { exact: true })).toHaveCount(0);
  await expect(page.getByText('수아의 눈동자는 햇살 아래 짙은 갈색으로 빛났다.')).toBeVisible();
  await expect(page.getByRole('button', { name: '수정', exact: true })).toBeEnabled();
  await expect(page.getByRole('button', { name: '확정', exact: true }).last()).toBeEnabled();

  await page.getByRole('button', { name: '다음 페이지' }).click();
  await expect(page).toHaveURL(/page=2/);
  await expect.poll(() => new URL(page.url()).searchParams.get('jobType')).toBe('EPISODE_VALIDATION');
  await expect(page.getByRole('heading', { name: '강민준' })).toBeVisible();
  await expect(detail.getByText('상태', { exact: true })).toBeVisible();
  await expect(detail.getByText('부상 상태', { exact: true })).toBeVisible();
  await expect(page.getByText('status.부상_상태', { exact: true })).toHaveCount(0);
  await expect.poll(() => listRequests.some(request => request.page === '1')).toBe(true);

  await page.getByRole('button', { name: '확정', exact: true }).first().click();
  await expect(page).toHaveURL(/reviewStatus=CONFIRMED/);
  await expect.poll(() => new URL(page.url()).searchParams.get('jobType')).toBe('EPISODE_VALIDATION');
  await expect.poll(() => new URL(page.url()).searchParams.get('page')).toBe('1');
  await expect.poll(() => listRequests.some(request => (
    request.page === '0' && request.reviewStatus === 'CONFIRMED'
  ))).toBe(true);
});

test('범위를 벗어난 페이지를 보정하고 무시한 미연결 후보를 생성 예정으로 표시하지 않는다', async ({ page }) => {
  const requestedPages: string[] = [];
  const dismissedCandidate = {
    ...candidates[0],
    matchedCharacterId: null,
    matchStatus: 'UNRESOLVED',
    reviewStatus: 'DISMISSED',
  } as const;

  await page.route('**/api/v1/**', route => {
    const requestUrl = new URL(route.request().url());
    const pathname = requestUrl.pathname;
    if (pathname.endsWith('/auth/me')) return fulfill(route, member);

    const listPath = `/api/v1/works/${workId}/setting-candidates`;
    if (pathname === listPath) {
      const requestedPage = requestUrl.searchParams.get('page') ?? '0';
      requestedPages.push(requestedPage);
      const pageIndex = Number(requestedPage);
      return fulfill(route, {
        batchId,
        episodeStartNo: 1,
        episodeEndNo: 2,
        episodeCount: 2,
        totalCandidateCount: 2,
        reviewedCandidateCount: 1,
        pendingCandidateCount: 1,
        matchRequiredCandidateCount: 0,
        candidates: {
          content: pageIndex === 1 ? [dismissedCandidate] : [],
          page: pageIndex,
          size: 1,
          totalElements: 2,
          totalPages: 2,
          hasNext: pageIndex === 0,
        },
      });
    }
    if (pathname === `${listPath}/${firstCandidateId}`) {
      return fulfill(route, dismissedCandidate);
    }
    return fulfill(route, []);
  });

  await authenticate(page);
  await page.goto(
    `/setting-review?workId=${workId}&batchId=${batchId}&page=100&size=1`,
  );

  await expect.poll(() => new URL(page.url()).searchParams.get('page')).toBe('2');
  await expect.poll(() => requestedPages.includes('99')).toBe(true);
  await expect.poll(() => requestedPages.includes('1')).toBe(true);
  await expect(page.getByText('연결하지 않고 무시한 후보')).toBeVisible();
  await expect(page.getByText('새 캐릭터 등록 예정')).toHaveCount(0);
});

test('후보 확정 실패 상태를 유지하고 재시도 성공 후 목록과 상세를 갱신한다', async ({ page }) => {
  let confirmRequestCount = 0;
  let reviewStatus: 'PENDING_REVIEW' | 'CONFIRMED' = 'PENDING_REVIEW';
  let matchStatus: 'UNRESOLVED' | 'MATCHED' = 'UNRESOLVED';
  let matchedCharacterId: string | null = null;
  const candidate = {
    ...candidates[0],
    matchedCharacterId,
    matchStatus,
    reviewStatus,
  };

  await page.route('**/api/v1/**', route => {
    const requestUrl = new URL(route.request().url());
    const pathname = requestUrl.pathname;
    if (pathname.endsWith('/auth/me')) return fulfill(route, member);

    const listPath = `/api/v1/works/${workId}/setting-candidates`;
    if (pathname === listPath) {
      return fulfill(route, {
        batchId,
        episodeStartNo: 1,
        episodeEndNo: 1,
        episodeCount: 1,
        totalCandidateCount: 1,
        reviewedCandidateCount: reviewStatus === 'CONFIRMED' ? 1 : 0,
        pendingCandidateCount: reviewStatus === 'PENDING_REVIEW' ? 1 : 0,
        matchRequiredCandidateCount: 0,
        candidates: {
          content: [{ ...candidate, matchedCharacterId, matchStatus, reviewStatus }],
          page: 0,
          size: 20,
          totalElements: 1,
          totalPages: 1,
          hasNext: false,
        },
      });
    }
    if (pathname === `${listPath}/${firstCandidateId}/confirm`) {
      confirmRequestCount += 1;
      if (confirmRequestCount === 1) {
        return fulfillError(route, 409, '캐릭터 연결 상태를 확인해 주세요.');
      }
      reviewStatus = 'CONFIRMED';
      matchStatus = 'MATCHED';
      matchedCharacterId = '77777777-7777-4777-8777-777777777777';
      return fulfill(route, { id: firstCandidateId, reviewStatus });
    }
    if (pathname === `${listPath}/${firstCandidateId}`) {
      return fulfill(route, { ...candidate, matchedCharacterId, matchStatus, reviewStatus });
    }
    return fulfill(route, []);
  });

  await authenticate(page);
  await page.goto(
    `/setting-review?workId=${workId}&batchId=${batchId}`
    + `&reviewStatus=ALL&candidate=${firstCandidateId}`,
  );

  const confirmButton = page.getByRole('button', { name: '확정', exact: true }).last();
  await expect(page.getByText('새 캐릭터 후보').last()).toBeVisible();
  await expect(confirmButton).toBeEnabled();
  await confirmButton.click();

  await expect(page.getByRole('alert')).toHaveText('캐릭터 연결 상태를 확인해 주세요.');
  await expect(page.getByRole('heading', { name: '수아' })).toBeVisible();
  await expect(confirmButton).toBeEnabled();

  await confirmButton.click();

  await expect(page.getByText('확정된 후보입니다. 모든 정보는 읽기 전용으로 표시됩니다.')).toBeVisible();
  await expect(page.getByText('기존 캐릭터 연결됨').last()).toBeVisible();
  const reviewSummary = page.getByRole('region', { name: '설정 후보 검토 요약' });
  await expect(reviewSummary.getByText('검토 완료', { exact: true }).locator('..'))
    .toContainText('1개');
  await expect.poll(() => confirmRequestCount).toBe(2);
});

test('연결 확인이 필요한 후보도 무시할 수 있고 실패 후 같은 화면에서 재시도한다', async ({ page }) => {
  let dismissRequestCount = 0;
  let reviewStatus: 'PENDING_REVIEW' | 'DISMISSED' = 'PENDING_REVIEW';
  const candidate = {
    ...candidates[0],
    matchedCharacterId: null,
    matchStatus: 'AMBIGUOUS' as const,
  };

  await page.route('**/api/v1/**', route => {
    const requestUrl = new URL(route.request().url());
    const pathname = requestUrl.pathname;
    if (pathname.endsWith('/auth/me')) return fulfill(route, member);

    const listPath = `/api/v1/works/${workId}/setting-candidates`;
    if (pathname === listPath) {
      return fulfill(route, {
        batchId,
        episodeStartNo: 1,
        episodeEndNo: 1,
        episodeCount: 1,
        totalCandidateCount: 1,
        reviewedCandidateCount: reviewStatus === 'DISMISSED' ? 1 : 0,
        pendingCandidateCount: reviewStatus === 'PENDING_REVIEW' ? 1 : 0,
        matchRequiredCandidateCount: reviewStatus === 'PENDING_REVIEW' ? 1 : 0,
        candidates: {
          content: [{ ...candidate, reviewStatus }],
          page: 0,
          size: 20,
          totalElements: 1,
          totalPages: 1,
          hasNext: false,
        },
      });
    }
    if (pathname === `${listPath}/${firstCandidateId}/dismiss`) {
      dismissRequestCount += 1;
      if (dismissRequestCount === 1) {
        return fulfillError(
          route,
          500,
          '일시적인 오류로 후보를 무시하지 못했습니다.',
          'SETTING_CANDIDATE_DISMISS_FAILED',
        );
      }
      reviewStatus = 'DISMISSED';
      return fulfill(route, { id: firstCandidateId, reviewStatus });
    }
    if (pathname === `${listPath}/${firstCandidateId}`) {
      return fulfill(route, { ...candidate, reviewStatus });
    }
    return fulfill(route, []);
  });

  await authenticate(page);
  await page.goto(
    `/setting-review?workId=${workId}&batchId=${batchId}`
    + `&reviewStatus=ALL&candidate=${firstCandidateId}`,
  );

  const dismissButton = page.getByRole('button', { name: '무시', exact: true }).last();
  await expect(page.getByText('어떤 캐릭터의 설정인지 확인이 필요합니다.')).toBeVisible();
  await expect(dismissButton).toBeEnabled();
  await dismissButton.click();

  await expect(page.getByRole('alert')).toHaveText('일시적인 오류로 후보를 무시하지 못했습니다.');
  await expect(page.getByRole('heading', { name: '수아' })).toBeVisible();
  await expect(dismissButton).toBeEnabled();

  await dismissButton.click();

  await expect(page.getByText('무시한 후보입니다. 모든 정보는 읽기 전용으로 표시됩니다.')).toBeVisible();
  await expect(page.getByText('어떤 캐릭터의 설정인지 확인이 필요합니다.')).toHaveCount(0);
  await expect(page.getByText('수아의 눈동자는 햇살 아래 짙은 갈색으로 빛났다.')).toBeVisible();
  const reviewSummary = page.getByRole('region', { name: '설정 후보 검토 요약' });
  await expect(reviewSummary.getByText('검토 완료', { exact: true }).locator('..'))
    .toContainText('1개');
  await expect(page.getByRole('button', { name: '무시', exact: true })).toHaveCount(1);
  await expect.poll(() => dismissRequestCount).toBe(2);
});

test('검토 대기 후보를 무시하는 동안 이동을 잠그고 완료 후 다음 후보를 선택한다', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 420 });
  let firstDismissed = false;
  let releaseDismiss: (() => void) | undefined;
  const nextCandidate = {
    ...candidates[1],
    reviewStatus: 'PENDING_REVIEW' as const,
  };

  await page.route('**/api/v1/**', async route => {
    const requestUrl = new URL(route.request().url());
    const pathname = requestUrl.pathname;
    if (pathname.endsWith('/auth/me')) return fulfill(route, member);

    const listPath = `/api/v1/works/${workId}/setting-candidates`;
    if (pathname === listPath) {
      const content = firstDismissed ? [nextCandidate] : [candidates[0], nextCandidate];
      return fulfill(route, {
        batchId,
        episodeStartNo: 1,
        episodeEndNo: 2,
        episodeCount: 2,
        totalCandidateCount: 2,
        reviewedCandidateCount: firstDismissed ? 1 : 0,
        pendingCandidateCount: firstDismissed ? 1 : 2,
        matchRequiredCandidateCount: 0,
        candidates: {
          content,
          page: 0,
          size: 20,
          totalElements: content.length,
          totalPages: 1,
          hasNext: false,
        },
      });
    }
    if (pathname === `${listPath}/${firstCandidateId}/dismiss`) {
      await new Promise<void>(resolve => {
        releaseDismiss = resolve;
      });
      firstDismissed = true;
      return fulfill(route, { id: firstCandidateId, reviewStatus: 'DISMISSED' });
    }
    if (pathname === `${listPath}/${firstCandidateId}`) {
      return fulfill(route, {
        ...candidates[0],
        reviewStatus: firstDismissed ? 'DISMISSED' : 'PENDING_REVIEW',
      });
    }
    if (pathname === `${listPath}/${secondCandidateId}`) {
      return fulfill(route, nextCandidate);
    }
    return fulfill(route, []);
  });

  await authenticate(page);
  await page.goto(
    `/setting-review?workId=${workId}&batchId=${batchId}`
    + `&reviewStatus=PENDING_REVIEW&candidate=${firstCandidateId}`,
  );

  await page.getByRole('button', { name: '무시', exact: true }).last().click();
  await expect.poll(() => Boolean(releaseDismiss)).toBe(true);
  await expect(page.getByRole('button', { name: /강민준/ })).toBeDisabled();
  await expect(page.getByRole('button', { name: '확정', exact: true }).first()).toBeDisabled();
  const main = page.locator('main');
  const scrollTopBeforeAutoSelect = await main.evaluate(element => {
    element.scrollTop = Math.min(80, element.scrollHeight - element.clientHeight);
    return element.scrollTop;
  });
  expect(scrollTopBeforeAutoSelect).toBeGreaterThan(0);

  releaseDismiss?.();

  await expect.poll(() => new URL(page.url()).searchParams.get('candidate')).toBe(secondCandidateId);
  await expect(page.getByRole('heading', { name: '강민준' })).toBeVisible();
  const scrollTopAfterAutoSelect = await main.evaluate(element => new Promise<number>(resolve => {
    let previous = element.scrollTop;
    let stableFrameCount = 0;
    const waitForStableScroll = () => {
      const current = element.scrollTop;
      stableFrameCount = current === previous ? stableFrameCount + 1 : 0;
      previous = current;
      if (stableFrameCount >= 5) {
        resolve(current);
        return;
      }
      requestAnimationFrame(waitForStableScroll);
    };
    requestAnimationFrame(waitForStableScroll);
  }));
  expect(Math.abs(scrollTopAfterAutoSelect - scrollTopBeforeAutoSelect)).toBeLessThanOrEqual(1);
  const reviewSummary = page.getByRole('region', { name: '설정 후보 검토 요약' });
  await expect(reviewSummary.getByText('검토 완료', { exact: true }).locator('..'))
    .toContainText('1개');
  await expect(page.getByRole('button', { name: /강민준/ })).toBeEnabled();
});

test('고정 설정명은 잠그고 표시값만 두 필드 수정 요청으로 저장한다', async ({ page }) => {
  let attributeValue = '갈색';
  let submittedBody: unknown;
  const candidate = { ...candidates[0] };

  await page.route('**/api/v1/**', route => {
    const requestUrl = new URL(route.request().url());
    const pathname = requestUrl.pathname;
    if (pathname.endsWith('/auth/me')) return fulfill(route, member);

    const listPath = `/api/v1/works/${workId}/setting-candidates`;
    if (pathname === listPath) {
      return fulfill(route, {
        batchId,
        episodeStartNo: 1,
        episodeEndNo: 1,
        episodeCount: 1,
        totalCandidateCount: 1,
        reviewedCandidateCount: 0,
        pendingCandidateCount: 1,
        matchRequiredCandidateCount: 0,
        candidates: {
          content: [{ ...candidate, attributeValue }],
          page: 0,
          size: 20,
          totalElements: 1,
          totalPages: 1,
          hasNext: false,
        },
      });
    }
    if (pathname === `${listPath}/${firstCandidateId}` && route.request().method() === 'PATCH') {
      submittedBody = route.request().postDataJSON();
      attributeValue = '짙은 갈색';
      return fulfill(route, { ...candidate, attributeValue });
    }
    if (pathname === `${listPath}/${firstCandidateId}`) {
      return fulfill(route, { ...candidate, attributeValue });
    }
    return fulfill(route, []);
  });

  await authenticate(page);
  await page.goto(`/setting-review?workId=${workId}&batchId=${batchId}&candidate=${firstCandidateId}`);

  await page.getByRole('button', { name: '수정', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: '설정 후보 수정' });
  await expect(dialog.getByLabel('설정명')).toHaveValue('눈 색깔');
  await expect(dialog.getByLabel('설정명')).toHaveAttribute('readonly', '');
  await dialog.getByLabel('설정값').fill('짙은 갈색');
  await dialog.getByRole('button', { name: '저장', exact: true }).click();

  await expect(dialog).toHaveCount(0);
  await expect.poll(() => submittedBody).toEqual({
    attributeName: 'profile.eye_color',
    attributeValue: '짙은 갈색',
  });
  await expect(page.getByRole('article').getByText('짙은 갈색', { exact: true })).toBeVisible();
});

test('표시값이 null인 JSON 후보를 그대로 저장하면 null을 유지한다', async ({ page }) => {
  let submittedBody: unknown;
  const candidate = {
    ...candidates[1],
    id: firstCandidateId,
    attributeValue: null,
    valueJson: { name: '부상 상태', level: 3, effect: '이동 저하' },
    reviewStatus: 'PENDING_REVIEW' as const,
  };

  await page.route('**/api/v1/**', route => {
    const requestUrl = new URL(route.request().url());
    const pathname = requestUrl.pathname;
    if (pathname.endsWith('/auth/me')) return fulfill(route, member);

    const listPath = `/api/v1/works/${workId}/setting-candidates`;
    if (pathname === listPath) {
      return fulfill(route, {
        batchId,
        episodeStartNo: 2,
        episodeEndNo: 2,
        episodeCount: 1,
        totalCandidateCount: 1,
        reviewedCandidateCount: 0,
        pendingCandidateCount: 1,
        matchRequiredCandidateCount: 0,
        candidates: {
          content: [candidate],
          page: 0,
          size: 20,
          totalElements: 1,
          totalPages: 1,
          hasNext: false,
        },
      });
    }
    if (pathname === `${listPath}/${firstCandidateId}` && route.request().method() === 'PATCH') {
      submittedBody = route.request().postDataJSON();
      return fulfill(route, candidate);
    }
    if (pathname === `${listPath}/${firstCandidateId}`) return fulfill(route, candidate);
    return fulfill(route, []);
  });

  await authenticate(page);
  await page.goto(`/setting-review?workId=${workId}&batchId=${batchId}&candidate=${firstCandidateId}`);

  await page.getByRole('button', { name: '수정', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: '설정 후보 수정' });
  await expect(dialog.getByLabel('설정값')).toHaveValue('');
  await dialog.getByRole('button', { name: '저장', exact: true }).click();

  await expect(dialog).toHaveCount(0);
  await expect.poll(() => submittedBody).toEqual({
    attributeName: 'status.부상 상태',
    attributeValue: null,
  });
});

test('동적 설정명 suffix와 값을 수정하고 실패한 입력 그대로 재시도한다', async ({ page }) => {
  let updateRequestCount = 0;
  const submittedBodies: unknown[] = [];
  let attributeName = 'status.부상_상태';
  let attributeValue = '경상';
  const candidate = {
    ...candidates[1],
    id: firstCandidateId,
    reviewStatus: 'PENDING_REVIEW' as const,
  };

  await page.route('**/api/v1/**', route => {
    const requestUrl = new URL(route.request().url());
    const pathname = requestUrl.pathname;
    if (pathname.endsWith('/auth/me')) return fulfill(route, member);

    const listPath = `/api/v1/works/${workId}/setting-candidates`;
    if (pathname === listPath) {
      return fulfill(route, {
        batchId,
        episodeStartNo: 2,
        episodeEndNo: 2,
        episodeCount: 1,
        totalCandidateCount: 1,
        reviewedCandidateCount: 0,
        pendingCandidateCount: 1,
        matchRequiredCandidateCount: 0,
        candidates: {
          content: [{ ...candidate, attributeName, attributeValue }],
          page: 0,
          size: 20,
          totalElements: 1,
          totalPages: 1,
          hasNext: false,
        },
      });
    }
    if (pathname === `${listPath}/${firstCandidateId}` && route.request().method() === 'PATCH') {
      updateRequestCount += 1;
      submittedBodies.push(route.request().postDataJSON());
      if (updateRequestCount === 1) {
        return fulfillError(
          route,
          409,
          '설정 후보 수정에 실패했습니다.',
          'SETTING_CANDIDATE_UPDATE_FAILED',
        );
      }
      attributeName = 'status.중상_상태';
      attributeValue = '중상';
      return fulfill(route, { ...candidate, attributeName, attributeValue });
    }
    if (pathname === `${listPath}/${firstCandidateId}`) {
      return fulfill(route, { ...candidate, attributeName, attributeValue });
    }
    return fulfill(route, []);
  });

  await authenticate(page);
  await page.goto(`/setting-review?workId=${workId}&batchId=${batchId}&candidate=${firstCandidateId}`);

  await page.getByRole('button', { name: '수정', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: '설정 후보 수정' });
  const settingTypeLabel = dialog.getByText('상태', { exact: true });
  await expect(settingTypeLabel).toBeVisible();
  await expect(settingTypeLabel).toHaveCSS('white-space', 'nowrap');
  await expect(settingTypeLabel).toHaveCSS('flex-shrink', '0');
  await expect(dialog.getByText('status.', { exact: true })).toHaveCount(0);
  await dialog.getByLabel('설정명 뒷부분').fill('중상 상태');
  await dialog.getByLabel('설정값').fill('중상');
  await dialog.getByRole('button', { name: '저장', exact: true }).click();

  await expect(dialog.getByRole('alert')).toHaveText('설정 후보 수정에 실패했습니다.');
  await expect(dialog.getByLabel('설정명 뒷부분')).toHaveValue('중상 상태');
  await expect(dialog.getByLabel('설정값')).toHaveValue('중상');

  await dialog.getByRole('button', { name: '저장', exact: true }).click();

  await expect(dialog).toHaveCount(0);
  await expect.poll(() => submittedBodies).toEqual([
    { attributeName: 'status.중상 상태', attributeValue: '중상' },
    { attributeName: 'status.중상 상태', attributeValue: '중상' },
  ]);
  const detail = page.getByRole('article');
  await expect(detail.getByText('중상 상태', { exact: true })).toBeVisible();
  await expect(detail.getByText('중상', { exact: true })).toBeVisible();
});

test('기존 캐릭터 연결 실패 시 선택을 유지하고 재시도 성공 후 후보를 갱신한다', async ({ page }) => {
  const characterId = '77777777-7777-4777-8777-777777777777';
  let matchRequestCount = 0;
  let matchStatus: 'AMBIGUOUS' | 'MATCHED' = 'AMBIGUOUS';
  let matchedCharacterId: string | null = null;
  const candidate = {
    ...candidates[0],
    matchStatus,
    matchedCharacterId,
  };

  await page.route('**/api/v1/**', async route => {
    const requestUrl = new URL(route.request().url());
    const pathname = requestUrl.pathname;
    if (pathname.endsWith('/auth/me')) return fulfill(route, member);
    if (pathname === `/api/v1/works/${workId}/characters`) {
      return fulfill(route, {
        content: [
          { id: characterId, name: '윤지우', firstAppearanceEpisodeNo: 1 },
          { id: '88888888-8888-4888-8888-888888888888', name: '서하린' },
        ],
        page: 0,
        size: 8,
        totalElements: 2,
        totalPages: 1,
        hasNext: false,
      });
    }

    const listPath = `/api/v1/works/${workId}/setting-candidates`;
    if (pathname === listPath) {
      const requestedMatchStatus = requestUrl.searchParams.get('matchStatus');
      const content = requestedMatchStatus && requestedMatchStatus !== matchStatus
        ? []
        : [{ ...candidate, matchStatus, matchedCharacterId }];
      return fulfill(route, {
        batchId,
        episodeStartNo: 1,
        episodeEndNo: 1,
        episodeCount: 1,
        totalCandidateCount: 1,
        reviewedCandidateCount: 0,
        pendingCandidateCount: 1,
        matchRequiredCandidateCount: matchStatus === 'AMBIGUOUS' ? 1 : 0,
        candidates: {
          content,
          page: 0,
          size: 20,
          totalElements: content.length,
          totalPages: content.length === 0 ? 0 : 1,
          hasNext: false,
        },
      });
    }
    if (pathname === `${listPath}/${firstCandidateId}/character-match`) {
      matchRequestCount += 1;
      const body = route.request().postDataJSON();
      expect(body).toEqual({
        resolutionType: 'MATCH_EXISTING',
        matchedCharacterId: characterId,
      });
      if (matchRequestCount === 1) {
        return fulfillError(
          route,
          409,
          '선택한 캐릭터에 연결하지 못했습니다.',
          'SETTING_CANDIDATE_CHARACTER_MATCH_FAILED',
        );
      }
      matchStatus = 'MATCHED';
      matchedCharacterId = characterId;
      return fulfill(route, { ...candidate, matchStatus, matchedCharacterId });
    }
    if (pathname === `${listPath}/${firstCandidateId}`) {
      return fulfill(route, { ...candidate, matchStatus, matchedCharacterId });
    }
    return fulfill(route, []);
  });

  await authenticate(page);
  await page.goto(
    `/setting-review?workId=${workId}&batchId=${batchId}`
    + `&matchStatus=AMBIGUOUS&candidate=${firstCandidateId}`,
  );

  await page.getByRole('button', { name: '기존 캐릭터에 연결', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: '캐릭터 연결 확인' });
  await dialog.getByLabel('현재 페이지에서 검색').fill('지우');
  const characterButton = dialog.getByRole('button', { name: /윤지우/ });
  await characterButton.click();
  await dialog.getByLabel('현재 페이지에서 검색').fill('하린');
  await dialog.getByRole('button', { name: '선택한 캐릭터에 연결' }).click();
  await expect(dialog.getByRole('alert')).toHaveText('현재 목록에서 연결할 캐릭터를 선택해 주세요.');
  await expect.poll(() => matchRequestCount).toBe(0);

  await dialog.getByLabel('현재 페이지에서 검색').fill('지우');
  await dialog.getByRole('button', { name: /윤지우/ }).click();
  await dialog.getByRole('button', { name: '선택한 캐릭터에 연결' }).click();

  await expect(dialog.getByRole('alert')).toHaveText('선택한 캐릭터에 연결하지 못했습니다.');
  await expect(dialog.getByLabel('현재 페이지에서 검색')).toHaveValue('지우');
  await expect(characterButton).toHaveAttribute('aria-pressed', 'true');

  await dialog.getByRole('button', { name: '선택한 캐릭터에 연결' }).click();

  await expect(dialog).toHaveCount(0);
  await expect.poll(() => new URL(page.url()).searchParams.get('candidate')).toBeNull();
  await expect(page.getByText('조건에 맞는 설정 후보가 없습니다.')).toBeVisible();
  await expect.poll(() => matchRequestCount).toBe(2);
});

test('연결 확인 후보를 입력한 이름의 새 캐릭터로 등록한다', async ({ page }) => {
  let submittedBody: unknown;
  let matchStatus: 'AMBIGUOUS' | 'UNRESOLVED' = 'AMBIGUOUS';
  let entityName = '수아';
  const candidate = {
    ...candidates[0],
    matchStatus,
    matchedCharacterId: null,
  };

  await page.route('**/api/v1/**', route => {
    const requestUrl = new URL(route.request().url());
    const pathname = requestUrl.pathname;
    if (pathname.endsWith('/auth/me')) return fulfill(route, member);

    const listPath = `/api/v1/works/${workId}/setting-candidates`;
    if (pathname === listPath) {
      return fulfill(route, {
        batchId,
        episodeStartNo: 1,
        episodeEndNo: 1,
        episodeCount: 1,
        totalCandidateCount: 1,
        reviewedCandidateCount: 0,
        pendingCandidateCount: 1,
        matchRequiredCandidateCount: matchStatus === 'AMBIGUOUS' ? 1 : 0,
        candidates: {
          content: [{ ...candidate, entityName, matchStatus }],
          page: 0,
          size: 20,
          totalElements: 1,
          totalPages: 1,
          hasNext: false,
        },
      });
    }
    if (pathname === `${listPath}/${firstCandidateId}/character-match`) {
      submittedBody = route.request().postDataJSON();
      entityName = '윤수아';
      matchStatus = 'UNRESOLVED';
      return fulfill(route, { ...candidate, entityName, matchStatus });
    }
    if (pathname === `${listPath}/${firstCandidateId}`) {
      return fulfill(route, { ...candidate, entityName, matchStatus });
    }
    return fulfill(route, []);
  });

  await authenticate(page);
  await page.goto(`/setting-review?workId=${workId}&batchId=${batchId}&candidate=${firstCandidateId}`);

  await page.getByRole('button', { name: '새 캐릭터로 등록', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: '캐릭터 연결 확인' });
  await dialog.getByLabel('새 캐릭터 이름').fill('윤수아');
  await dialog.getByRole('button', { name: '새 캐릭터로 등록', exact: true }).last().click();

  await expect(dialog).toHaveCount(0);
  await expect.poll(() => submittedBody).toEqual({
    resolutionType: 'CREATE_NEW',
    entityName: '윤수아',
  });
  await expect(page.getByText('새 캐릭터 후보').last()).toBeVisible();
  await expect(page.getByRole('button', { name: '확정', exact: true }).last()).toBeEnabled();
});
