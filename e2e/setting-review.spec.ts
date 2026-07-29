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
    attributeValue: '갈색',
    valueType: 'STRING',
    evidenceSpans: [{ quote: '수아의 눈동자는 햇살 아래 짙은 갈색으로 빛났다.' }],
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
    attributeName: 'profile.occupation',
    attributeValue: '궁정 마법사',
    valueType: 'STRING',
    evidenceSpans: [{ quote: '민준은 왕실의 궁정 마법사로 임명되었다.' }],
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
    + '&jobType=EPISODE_VALIDATION&size=1',
  );

  await expect(page.getByText('1–5화 · 5개 회차')).toBeVisible();
  await expect(page.getByRole('heading', { name: '수아' })).toBeVisible();
  await expect(page.getByText('수아의 눈동자는 햇살 아래 짙은 갈색으로 빛났다.')).toBeVisible();
  await expect(page.getByRole('button', { name: '수정', exact: true })).toBeDisabled();
  await expect(page.getByRole('button', { name: '확정', exact: true }).last()).toBeDisabled();

  await page.getByRole('button', { name: '다음 페이지' }).click();
  await expect(page).toHaveURL(/page=2/);
  await expect.poll(() => new URL(page.url()).searchParams.get('jobType')).toBe('EPISODE_VALIDATION');
  await expect(page.getByRole('heading', { name: '강민준' })).toBeVisible();
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
