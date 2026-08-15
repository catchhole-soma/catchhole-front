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

function queryValues(url: URL, name: string): string[] {
  return url.searchParams.getAll(name).flatMap(value => value.split(',')).filter(Boolean);
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

test('캐릭터 후보 조회가 실패해도 세계관 후보 탭으로 이동할 수 있다', async ({ page }) => {
  await page.route('**/api/v1/**', route => {
    const pathname = new URL(route.request().url()).pathname;
    if (pathname.endsWith('/auth/me')) return fulfill(route, member);
    if (pathname === `/api/v1/works/${workId}/setting-candidates`) {
      return fulfillError(route, 500, '캐릭터 후보를 조회하지 못했습니다.');
    }
    if (pathname === `/api/v1/works/${workId}/world-setting-candidates`) {
      return fulfill(route, {
        batchId,
        episodeStartNo: 1,
        episodeEndNo: 1,
        episodeCount: 1,
        totalCandidateCount: 0,
        reviewedCandidateCount: 0,
        pendingCandidateCount: 0,
        pendingComparisonCount: 0,
        processingComparisonCount: 0,
        failedComparisonCount: 0,
        recomparisonRequiredCount: 0,
        groups: {
          content: [], page: 0, size: 20, totalElements: 0, totalPages: 0, hasNext: false,
        },
      });
    }
    return fulfill(route, []);
  });

  await authenticate(page);
  await page.goto(`/setting-review?workId=${workId}&batchId=${batchId}`);

  await expect(page.getByText('설정 후보를 불러오지 못했습니다.')).toBeVisible();
  await page.getByRole('button', { name: /세계관 후보/ }).click();

  await expect.poll(() => new URL(page.url()).searchParams.get('candidateType')).toBe('world');
  await expect(page.getByText('이번 분석에서 추출된 세계관 후보가 없습니다.')).toBeVisible();
});

test('캐릭터 탭에서도 진행 중인 세계관 비교 집계를 polling한다', async ({ page }) => {
  let worldSummaryRequestCount = 0;

  await page.route('**/api/v1/**', route => {
    const requestUrl = new URL(route.request().url());
    const pathname = requestUrl.pathname;
    if (pathname.endsWith('/auth/me')) return fulfill(route, member);
    if (pathname === `/api/v1/works/${workId}/setting-candidates`) {
      return fulfill(route, {
        batchId,
        episodeStartNo: 1,
        episodeEndNo: 1,
        episodeCount: 1,
        totalCandidateCount: 1,
        reviewedCandidateCount: 0,
        pendingCandidateCount: 1,
        matchRequiredCandidateCount: 0,
        groups: {
          content: [{
            groupKey: '수아',
            entityName: '수아',
            candidateCount: 1,
            evidenceEpisodeNos: [1],
            candidates: [candidates[0]],
          }],
          page: 0,
          size: 20,
          totalElements: 1,
          totalPages: 1,
          hasNext: false,
        },
      });
    }
    if (pathname === `/api/v1/works/${workId}/world-setting-candidates`) {
      worldSummaryRequestCount += 1;
      return fulfill(route, {
        batchId,
        totalCandidateCount: 1,
        reviewedCandidateCount: 0,
        pendingCandidateCount: 1,
        pendingComparisonCount: worldSummaryRequestCount === 1 ? 1 : 0,
        processingComparisonCount: 0,
        failedComparisonCount: 0,
        recomparisonRequiredCount: 0,
        groups: {
          content: [], page: 0, size: 1, totalElements: 0, totalPages: 0, hasNext: false,
        },
      });
    }
    return fulfill(route, []);
  });

  await authenticate(page);
  await page.goto(`/setting-review?workId=${workId}&batchId=${batchId}`);

  await expect.poll(() => worldSummaryRequestCount, { timeout: 6_000 }).toBeGreaterThan(1);
});

test('검토 대기를 기본으로 조회하고 전체 필터는 URL에 명시한다', async ({ page }) => {
  const requestedReviewStatuses: Array<string | null> = [];
  const requestedLegacyCandidates: Array<string | null> = [];

  await page.route('**/api/v1/**', route => {
    const requestUrl = new URL(route.request().url());
    const pathname = requestUrl.pathname;
    if (pathname.endsWith('/auth/me')) return fulfill(route, member);

    const listPath = `/api/v1/works/${workId}/setting-candidates`;
    if (pathname === listPath) {
      const reviewStatus = requestUrl.searchParams.get('reviewStatus');
      requestedReviewStatuses.push(reviewStatus);
      requestedLegacyCandidates.push(requestUrl.searchParams.get('includeLegacyCandidates'));
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

  await expect(page.locator('.app-route-layer--static')).toBeVisible();
  await expect(page.locator('.app-route-layer--animated')).toHaveCount(0);
  await expect.poll(() => requestedReviewStatuses.at(-1)).toBe('PENDING_REVIEW');
  await expect.poll(() => requestedLegacyCandidates.at(-1)).toBe('false');
  await expect.poll(() => new URL(page.url()).searchParams.get('reviewStatus')).toBeNull();
  await expect(page.getByRole('heading', { name: '수아' })).toBeVisible();
  await expect(page.locator('.setting-candidate-detail').first()).toHaveCSS('content-visibility', 'visible');
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

test('느린 필터 응답 중에도 필터와 뒤로가기 버튼을 유지해 다음 클릭을 받는다', async ({ page }) => {
  let releaseAllFilter: (() => void) | undefined;

  await page.route('**/api/v1/**', async route => {
    const requestUrl = new URL(route.request().url());
    const pathname = requestUrl.pathname;
    if (pathname.endsWith('/auth/me')) return fulfill(route, member);

    const listPath = `/api/v1/works/${workId}/setting-candidates`;
    if (pathname === listPath) {
      const reviewStatus = requestUrl.searchParams.get('reviewStatus');
      if (reviewStatus === null) {
        await new Promise<void>(resolve => {
          releaseAllFilter = resolve;
        });
      }
      const content = reviewStatus === 'CONFIRMED' ? [candidates[1]] : [candidates[0]];
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
    return fulfill(route, []);
  });

  await authenticate(page);
  await page.goto(`/setting-review?workId=${workId}&batchId=${batchId}`);
  await expect(page.getByRole('heading', { name: '수아' })).toBeVisible();

  await page.getByRole('button', { name: '전체', exact: true }).first().click();
  await expect.poll(() => Boolean(releaseAllFilter)).toBe(true);
  await expect(page.getByRole('button', { name: '이전 화면' })).toBeVisible();
  await expect(page.getByRole('heading', { name: '수아' })).toBeVisible();
  await expect(page.getByRole('button', { name: '수정', exact: true })).toBeDisabled();
  await expect(page.getByRole('button', { name: '제외', exact: true })).toBeDisabled();
  await page.getByRole('button', { name: '확정', exact: true }).first().click({ timeout: 500 });
  await expect.poll(() => new URL(page.url()).searchParams.get('reviewStatus')).toBe('CONFIRMED');

  releaseAllFilter?.();
});

test('연결됨 필터는 기존 캐릭터와 이번 확정의 신규 캐릭터 연결을 함께 조회해 구분한다', async ({ page }) => {
  const autoMatchedCandidate = {
    ...candidates[0],
    id: secondCandidateId,
    entityName: '신규 수아',
    matchStatus: 'AUTO_MATCHED_BY_NAME' as const,
  };
  const connectedCandidates = [candidates[0], autoMatchedCandidate];
  let requestedMatchStatuses: string[] = [];

  await page.route('**/api/v1/**', route => {
    const requestUrl = new URL(route.request().url());
    const pathname = requestUrl.pathname;
    if (pathname.endsWith('/auth/me')) return fulfill(route, member);

    const listPath = `/api/v1/works/${workId}/setting-candidates`;
    if (pathname === listPath) {
      requestedMatchStatuses = queryValues(requestUrl, 'matchStatuses');
      return fulfill(route, {
        batchId,
        episodeStartNo: 1,
        episodeEndNo: 1,
        episodeCount: 1,
        totalCandidateCount: 2,
        reviewedCandidateCount: 0,
        pendingCandidateCount: 2,
        matchRequiredCandidateCount: 0,
        candidates: {
          content: connectedCandidates,
          page: 0,
          size: 20,
          totalElements: 2,
          totalPages: 1,
          hasNext: false,
        },
      });
    }
    const candidateId = pathname.startsWith(`${listPath}/`)
      ? pathname.slice(`${listPath}/`.length)
      : null;
    if (candidateId) {
      return fulfill(route, connectedCandidates.find(candidate => candidate.id === candidateId));
    }
    return fulfill(route, []);
  });

  await authenticate(page);
  await page.goto(`/setting-review?workId=${workId}&batchId=${batchId}`);
  await page.getByRole('button', { name: '연결됨', exact: true }).click();

  await expect.poll(() => new URL(page.url()).searchParams.get('matchStatus')).toBe('CONNECTED');
  await expect.poll(() => requestedMatchStatuses.sort()).toEqual(
    ['AUTO_MATCHED_BY_NAME', 'MATCHED'].sort(),
  );
  await expect(page.getByText('기존 캐릭터 연결됨').first()).toBeVisible();
  await expect(page.getByText('신규 캐릭터에 연결됨').first()).toBeVisible();
});

test('브라우저 뒤로가기 직후 이전 검토 화면이 클릭을 가로채지 않고 늦은 응답도 복귀시키지 않는다', async ({ page }) => {
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
    if (pathname === `${listPath}/group-confirm`) {
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

  await page.getByRole('button', { name: /설정 모두 확정/ }).last().click();
  await expect.poll(() => Boolean(releaseConfirm)).toBe(true);
  await page.goBack();
  await expect.poll(() => new URL(page.url()).pathname).toBe('/dashboard');
  await page.getByRole('button', { name: '작품 설정' }).click({ timeout: 1_500 });
  await expect.poll(() => new URL(page.url()).searchParams.get('nav')).toBe('settingDB');

  releaseConfirm?.();
  await expect.poll(() => confirmRequestCount).toBe(1);
  await page.waitForTimeout(500);
  await expect.poll(() => new URL(page.url()).pathname).toBe('/dashboard');
  await expect.poll(() => new URL(page.url()).searchParams.get('nav')).toBe('settingDB');
});

test('후보 수정의 늦은 응답은 떠난 검토 화면의 URL을 다시 쓰지 않는다', async ({ page }) => {
  let releaseUpdate: (() => void) | undefined;

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
    if (pathname === `${listPath}/${firstCandidateId}` && route.request().method() === 'PATCH') {
      await new Promise<void>(resolve => {
        releaseUpdate = resolve;
      });
      return fulfill(route, { ...candidates[0], attributeValue: '짙은 갈색' });
    }
    if (pathname === `${listPath}/${firstCandidateId}`) return fulfill(route, candidates[0]);
    return fulfill(route, []);
  });

  await authenticate(page);
  await page.goto(`/dashboard?workId=${workId}&nav=analyses`);
  await page.goto(
    `/setting-review?workId=${workId}&batchId=${batchId}&candidate=${firstCandidateId}`,
  );

  await page.getByRole('button', { name: '수정', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: '설정 후보 수정' });
  await dialog.getByLabel('설정값').fill('짙은 갈색');
  await dialog.getByRole('button', { name: '저장', exact: true }).click();
  await expect.poll(() => Boolean(releaseUpdate)).toBe(true);

  await page.goBack();
  await expect.poll(() => new URL(page.url()).pathname).toBe('/dashboard');
  releaseUpdate?.();
  await page.waitForTimeout(500);

  await expect.poll(() => new URL(page.url()).pathname).toBe('/dashboard');
  await expect.poll(() => new URL(page.url()).searchParams.get('nav')).toBe('analyses');
});

test('모바일에서는 후보 목록과 상세를 한 화면씩 전환한다', async ({ page }) => {
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
  await page.goto(`/setting-review?workId=${workId}&batchId=${batchId}`);

  const layout = page.locator('.setting-review-layout');
  const candidateList = layout.locator('.setting-review-sidebar');
  const candidateDetail = layout.locator('.setting-review-detail');

  await expect(candidateList).toBeVisible();
  await expect(candidateDetail).toBeHidden();

  await candidateList.getByRole('button', { name: /수아/ }).click();
  await expect(candidateList).toBeHidden();
  await expect(candidateDetail).toBeVisible();
  await expect(page.getByRole('button', { name: '후보 목록으로' })).toBeVisible();

  await page.getByRole('button', { name: '후보 목록으로' }).click();
  await expect(candidateList).toBeVisible();
  await expect(candidateDetail).toBeHidden();
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
    if (pathname === `${listPath}/group-confirm`) {
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

  const confirmButton = page.getByRole('button', { name: /설정 모두 확정/ });
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

test('묶음 확정 응답 후 최신 후보 목록을 받을 때까지 중복 확정을 잠근다', async ({ page }) => {
  let confirmed = false;
  let confirmRequestCount = 0;
  let releaseListRefresh: (() => void) | null = null;
  const listRefreshGate = new Promise<void>(resolve => {
    releaseListRefresh = resolve;
  });

  await page.route('**/api/v1/**', async route => {
    const requestUrl = new URL(route.request().url());
    const pathname = requestUrl.pathname;
    if (pathname.endsWith('/auth/me')) return fulfill(route, member);

    const listPath = `/api/v1/works/${workId}/setting-candidates`;
    if (pathname === listPath) {
      if (confirmed) await listRefreshGate;
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
    if (pathname === `${listPath}/group-confirm`) {
      confirmRequestCount += 1;
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

  await page.getByRole('button', { name: /설정 모두 확정/ }).click();
  await expect.poll(() => confirmRequestCount).toBe(1);

  await page.getByRole('button', { name: /수아 1개 설정/ }).click();
  const pendingButton = page.getByRole('button', { name: '전체 확정 중…' });
  await expect(pendingButton).toBeDisabled();
  await page.waitForTimeout(100);
  expect(confirmRequestCount).toBe(1);

  releaseListRefresh?.();
  await expect(page.getByText('모든 설정 후보 검토를 완료했습니다.'))
    .toHaveCount(2, { timeout: 10_000 });
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
    if (pathname === `${listPath}/group-confirm`) {
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

  const confirmButton = page.getByRole('button', { name: /설정 모두 확정/ });
  await expect(confirmButton).toBeEnabled();
  await confirmButton.click();

  await expect.poll(() => confirmed, { timeout: 10_000 }).toBe(true);
  await expect(page.getByRole('alert')).toContainText(
    '최신 후보를 불러오지 못해 마지막으로 확인한 목록을 표시합니다.',
    { timeout: 10_000 },
  );
  await expect.poll(() => new URL(page.url()).searchParams.get('candidate')).toBeNull();
  await expect(page.getByText('캐릭터 후보 묶음을 선택해 주세요.')).toBeVisible();
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
  await expect(page.getByRole('button', { name: /설정 모두 확정/ }).last()).toBeDisabled();

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
    if (pathname === `${listPath}/group-confirm`) {
      confirmRequestCount += 1;
      if (confirmRequestCount === 1) {
        return fulfillError(route, 409, '캐릭터 연결 상태를 확인해 주세요.');
      }
      reviewStatus = 'CONFIRMED';
      matchStatus = 'AUTO_MATCHED_BY_NAME';
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

  const confirmButton = page.getByRole('button', { name: /설정 모두 확정/ }).last();
  await expect(page.getByText('새 캐릭터 후보').last()).toBeVisible();
  await expect(confirmButton).toBeEnabled();
  await confirmButton.click();

  await expect(page.getByRole('alert')).toHaveText('캐릭터 연결 상태를 확인해 주세요.');
  await expect(page.getByRole('heading', { name: '수아' })).toBeVisible();
  await expect(confirmButton).toBeEnabled();

  await confirmButton.click();

  await expect(page.getByText('확정된 후보입니다. 모든 정보는 읽기 전용으로 표시됩니다.')).toBeVisible();
  await expect(page.getByText('신규 캐릭터에 연결됨').last()).toBeVisible();
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

  const dismissButton = page.getByRole('button', { name: '제외', exact: true });
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

test('캐릭터 설정 비교 제안을 현재값 또는 이력으로 확정하고 모바일에서 결정을 한 열로 표시한다', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  let confirmed = false;
  let confirmBody: unknown;
  const comparedCandidate = {
    ...candidates[0],
    candidateKind: 'SETTING' as const,
    comparisonStatus: 'COMPLETED' as const,
    suggestedOperation: 'MERGE' as const,
    temporalScope: 'PRESENT' as const,
    comparisonTargetFactType: 'PROFILE' as const,
    comparisonTargetFactKey: 'profile.eye_color',
    proposedFactValue: '짙은 갈색',
    proposedValueJson: { value: '화면에 직접 노출하지 않을 구조화 값' },
    snapshotChanges: [{
      action: 'UPSERT' as const,
      factType: 'PROFILE' as const,
      factKey: 'profile.eye_color',
      beforeFactValue: '갈색',
      beforeValueJson: { value: '이전 구조화 값' },
      proposedFactValue: '짙은 갈색',
      proposedValueJson: { value: '변경 구조화 값' },
    }],
    comparisonReason: '기존 눈 색상 설명을 보존하면서 더 구체적인 표현으로 합칩니다.',
    comparisonBaseSnapshotVersion: 7,
  };

  await page.route('**/api/v1/**', route => {
    const request = route.request();
    const pathname = new URL(request.url()).pathname;
    if (pathname.endsWith('/auth/me')) return fulfill(route, member);

    const listPath = `/api/v1/works/${workId}/setting-candidates`;
    if (pathname === listPath) {
      const content = confirmed ? [] : [comparedCandidate];
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
    if (pathname === `${listPath}/group-confirm`) {
      confirmBody = request.postDataJSON();
      confirmed = true;
      return fulfill(route, { id: firstCandidateId, reviewStatus: 'CONFIRMED' });
    }
    if (pathname === `${listPath}/${firstCandidateId}`) {
      return fulfill(route, {
        ...comparedCandidate,
        reviewStatus: confirmed ? 'CONFIRMED' : 'PENDING_REVIEW',
      });
    }
    return fulfill(route, []);
  });

  await authenticate(page);
  await page.goto(
    `/setting-review?workId=${workId}&batchId=${batchId}&candidate=${firstCandidateId}`,
  );

  const comparisonPanel = page.getByRole('region', { name: '캐릭터 설정 AI 비교 결과' });
  await expect(comparisonPanel.getByText('현재 설정 병합', { exact: true })).toBeVisible();
  await expect(comparisonPanel.getByText('− 기존값', { exact: true })).toBeVisible();
  await expect(comparisonPanel.getByText('+ 제안값', { exact: true })).toBeVisible();
  const proposedValue = comparisonPanel.locator(
    '.character-comparison-value--proposed .character-comparison-value__content',
  );
  await expect(proposedValue).toHaveCSS('color', 'rgb(25, 30, 38)');
  await expect(comparisonPanel.getByText('기존 눈 색상 설명을 보존하면서 더 구체적인 표현으로 합칩니다.')).toBeVisible();
  await expect(comparisonPanel.getByText('갈색 → 짙은 갈색', { exact: true })).toBeVisible();
  await expect(comparisonPanel.getByText('화면에 직접 노출하지 않을 구조화 값')).toHaveCount(0);

  const applyButton = comparisonPanel.getByRole('button', { name: /AI 제안대로 현재 설정 반영/ });
  const historyButton = comparisonPanel.getByRole('button', { name: /이력에만 저장/ });
  const [applyBox, historyBox] = await Promise.all([applyButton.boundingBox(), historyButton.boundingBox()]);
  expect(applyBox).not.toBeNull();
  expect(historyBox).not.toBeNull();
  expect(historyBox?.y ?? 0).toBeGreaterThan((applyBox?.y ?? 0) + (applyBox?.height ?? 0) - 1);

  await historyButton.click();
  await page.getByRole('button', { name: /설정 모두 확정/ }).last().click();

  await expect.poll(() => confirmBody).toEqual({
    batchId,
    candidates: [{
      candidateId: firstCandidateId,
      applicationMode: 'HISTORY_ONLY',
      baseSnapshotVersion: 7,
    }],
  });
});

test('동일 상태 종료 제안을 현재 설정에서 제거하는 방식으로 확정한다', async ({ page }) => {
  let confirmBody: unknown;
  const removeCandidate = {
    ...candidates[1],
    reviewStatus: 'PENDING_REVIEW' as const,
    candidateKind: 'SETTING' as const,
    comparisonStatus: 'COMPLETED' as const,
    suggestedOperation: 'REMOVE' as const,
    temporalScope: 'PRESENT' as const,
    comparisonTargetFactType: 'STATUS' as const,
    comparisonTargetFactKey: 'status.부상_상태',
    proposedFactValue: null,
    proposedValueJson: null,
    snapshotChanges: [{
      action: 'REMOVE' as const,
      factType: 'STATUS' as const,
      factKey: 'status.부상_상태',
      beforeFactValue: '경상',
      beforeValueJson: { value: '경상' },
      proposedFactValue: null,
      proposedValueJson: null,
    }],
    comparisonReason: '상처가 회복되어 현재 부상 상태를 종료합니다.',
    comparisonBaseSnapshotVersion: 9,
  };

  await page.route('**/api/v1/**', route => {
    const request = route.request();
    const pathname = new URL(request.url()).pathname;
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
          content: [removeCandidate],
          page: 0, size: 20, totalElements: 1, totalPages: 1, hasNext: false,
        },
      });
    }
    if (pathname === `${listPath}/group-confirm`) {
      confirmBody = request.postDataJSON();
      return fulfill(route, { id: secondCandidateId, reviewStatus: 'CONFIRMED' });
    }
    if (pathname === `${listPath}/${secondCandidateId}`) return fulfill(route, removeCandidate);
    return fulfill(route, []);
  });

  await authenticate(page);
  await page.goto(
    `/setting-review?workId=${workId}&batchId=${batchId}&candidate=${secondCandidateId}`,
  );

  const comparisonPanel = page.getByRole('region', { name: '캐릭터 설정 AI 비교 결과' });
  await expect(comparisonPanel.getByText('현재 설정 종료', { exact: true })).toBeVisible();
  await expect(comparisonPanel.getByText('종료할 현재 설정', { exact: true })).toBeVisible();
  await expect(comparisonPanel.getByText('현재값에서 종료', { exact: true })).toBeVisible();

  await page.getByRole('button', { name: /설정 모두 확정/ }).last().click();
  await expect.poll(() => confirmBody).toEqual({
    batchId,
    candidates: [{
      candidateId: secondCandidateId,
      applicationMode: 'APPLY_PROPOSAL',
      baseSnapshotVersion: 9,
    }],
  });
});

test('검토 완료 후보는 저장된 확정 방식을 추측하지 않고 비교 결과만 읽기 전용으로 표시한다', async ({ page }) => {
  const confirmedCandidate = {
    ...candidates[0],
    reviewStatus: 'CONFIRMED' as const,
    candidateKind: 'SETTING' as const,
    comparisonStatus: 'COMPLETED' as const,
    suggestedOperation: 'MERGE' as const,
    temporalScope: 'PRESENT' as const,
    comparisonTargetFactType: 'PROFILE' as const,
    comparisonTargetFactKey: 'profile.eye_color',
    proposedFactValue: '짙은 갈색',
    proposedValueJson: { value: '짙은 갈색' },
    snapshotChanges: [{
      action: 'UPSERT' as const,
      factType: 'PROFILE' as const,
      factKey: 'profile.eye_color',
      beforeFactValue: '갈색',
      beforeValueJson: { value: '갈색' },
      proposedFactValue: '짙은 갈색',
      proposedValueJson: { value: '짙은 갈색' },
    }],
    comparisonReason: '기존 설명과 새 내용을 합쳤습니다.',
    comparisonBaseSnapshotVersion: 7,
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
        reviewedCandidateCount: 1,
        pendingCandidateCount: 0,
        matchRequiredCandidateCount: 0,
        candidates: {
          content: [confirmedCandidate],
          page: 0,
          size: 20,
          totalElements: 1,
          totalPages: 1,
          hasNext: false,
        },
      });
    }
    if (pathname === `${listPath}/${firstCandidateId}`) return fulfill(route, confirmedCandidate);
    return fulfill(route, []);
  });

  await authenticate(page);
  await page.goto(
    `/setting-review?workId=${workId}&batchId=${batchId}`
    + `&reviewStatus=CONFIRMED&candidate=${firstCandidateId}`,
  );

  const comparisonPanel = page.getByRole('region', { name: '캐릭터 설정 AI 비교 결과' });
  const readOnlyNotice = page.getByRole('status')
    .filter({ hasText: '확정된 후보입니다. 모든 정보는 읽기 전용으로 표시됩니다.' });
  await expect(readOnlyNotice).toBeVisible();
  await expect(readOnlyNotice).toHaveCSS('color', 'rgb(51, 58, 70)');
  await expect(page.locator('.setting-candidate-detail.is-read-only')).toHaveCSS('opacity', '1');
  await expect(comparisonPanel.getByText('현재 설정 병합', { exact: true })).toBeVisible();
  await expect(comparisonPanel.getByText('갈색 → 짙은 갈색', { exact: true })).toBeVisible();
  await expect(comparisonPanel.getByText('확정 방식', { exact: true })).toHaveCount(0);
  await expect(comparisonPanel.getByRole('button', { name: /AI 제안대로 현재 설정 반영/ })).toHaveCount(0);
  await expect(comparisonPanel.getByRole('button', { name: /이력에만 저장/ })).toHaveCount(0);
});

test('재비교 결과가 바뀌면 저장된 현재값 반영 선택을 허용 가능한 이력 저장으로 보정한다', async ({ page }) => {
  let listReadCount = 0;
  let confirmBody: unknown;
  const comparedCandidate = (historyOnly: boolean) => ({
    ...candidates[0],
    candidateKind: 'SETTING' as const,
    comparisonStatus: 'COMPLETED' as const,
    suggestedOperation: historyOnly ? 'HISTORY_ONLY' as const : 'UPDATE' as const,
    temporalScope: historyOnly ? 'PAST' as const : 'PRESENT' as const,
    comparisonTargetFactType: 'PROFILE' as const,
    comparisonTargetFactKey: 'profile.eye_color',
    proposedFactValue: historyOnly ? null : '짙은 갈색',
    proposedValueJson: historyOnly ? null : { value: '짙은 갈색' },
    snapshotChanges: historyOnly ? [] : [{
      action: 'UPSERT' as const,
      factType: 'PROFILE' as const,
      factKey: 'profile.eye_color',
      beforeFactValue: '갈색',
      beforeValueJson: { value: '갈색' },
      proposedFactValue: '짙은 갈색',
      proposedValueJson: { value: '짙은 갈색' },
    }],
    comparisonReason: historyOnly
      ? '과거 회상에 등장한 정보이므로 이력으로만 남깁니다.'
      : '현재 눈 색상을 더 구체적인 표현으로 바꿉니다.',
    comparisonBaseSnapshotVersion: 7,
  });

  await page.route('**/api/v1/**', route => {
    const request = route.request();
    const requestUrl = new URL(request.url());
    const pathname = requestUrl.pathname;
    if (pathname.endsWith('/auth/me')) return fulfill(route, member);

    const listPath = `/api/v1/works/${workId}/setting-candidates`;
    if (pathname === listPath) {
      listReadCount += 1;
      const candidate = comparedCandidate(listReadCount > 1);
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
          content: [candidate],
          page: 0,
          size: 20,
          totalElements: 1,
          totalPages: 1,
          hasNext: false,
        },
      });
    }
    if (pathname === `${listPath}/group-confirm`) {
      confirmBody = request.postDataJSON();
      return fulfill(route, { id: firstCandidateId, reviewStatus: 'CONFIRMED' });
    }
    return fulfill(route, []);
  });

  await authenticate(page);
  await page.goto(`/setting-review?workId=${workId}&batchId=${batchId}`);

  const comparisonPanel = page.getByRole('region', { name: '캐릭터 설정 AI 비교 결과' });
  await comparisonPanel.getByRole('button', { name: /AI 제안대로 현재 설정 반영/ }).click();
  await page.getByRole('button', { name: '전체', exact: true }).first().click();
  await expect(comparisonPanel.getByText('이력에만 저장', { exact: true })).toBeVisible();

  await page.getByRole('button', { name: /설정 모두 확정/ }).last().click();
  await expect.poll(() => confirmBody).toEqual({
    batchId,
    candidates: [{
      candidateId: firstCandidateId,
      applicationMode: 'HISTORY_ONLY',
      baseSnapshotVersion: 7,
    }],
  });
});

test('실패한 캐릭터 설정 비교를 재요청하고 완료 전까지 확정을 잠근다', async ({ page }) => {
  let comparisonStatus: 'FAILED' | 'PENDING' | 'COMPLETED' = 'FAILED';
  let pendingListReadCount = 0;
  let retryRequestCount = 0;
  const comparedCandidate = () => ({
    ...candidates[0],
    candidateKind: 'SETTING' as const,
    comparisonStatus,
    suggestedOperation: comparisonStatus === 'COMPLETED' ? 'UPDATE' as const : undefined,
    comparisonErrorMessage: comparisonStatus === 'FAILED' ? 'AI 비교 응답 형식이 올바르지 않습니다.' : null,
    comparisonReason: comparisonStatus === 'COMPLETED' ? '현재 눈 색상 정보를 갱신합니다.' : null,
    comparisonBaseSnapshotVersion: 8,
  });

  await page.route('**/api/v1/**', route => {
    const pathname = new URL(route.request().url()).pathname;
    if (pathname.endsWith('/auth/me')) return fulfill(route, member);

    const listPath = `/api/v1/works/${workId}/setting-candidates`;
    if (pathname === listPath) {
      if (comparisonStatus === 'PENDING') {
        pendingListReadCount += 1;
        if (pendingListReadCount >= 2) comparisonStatus = 'COMPLETED';
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
          content: [comparedCandidate()],
          page: 0,
          size: 20,
          totalElements: 1,
          totalPages: 1,
          hasNext: false,
        },
      });
    }
    if (pathname === `${listPath}/${firstCandidateId}/recompare`) {
      retryRequestCount += 1;
      comparisonStatus = 'PENDING';
      return fulfill(route, comparedCandidate());
    }
    if (pathname === `${listPath}/${firstCandidateId}`) {
      return fulfill(route, comparedCandidate());
    }
    return fulfill(route, []);
  });

  await authenticate(page);
  await page.goto(
    `/setting-review?workId=${workId}&batchId=${batchId}&candidate=${firstCandidateId}`,
  );

  const confirmButton = page.getByRole('button', { name: /설정 모두 확정/ }).last();
  await expect(page.getByText(
    '현재 설정과 비교 결과를 만들지 못했습니다. 다시 비교하거나 설정을 수정해 주세요.',
  )).toBeVisible();
  await expect(page.getByText('AI 비교 응답 형식이 올바르지 않습니다.')).toHaveCount(0);
  await expect(confirmButton).toBeDisabled();

  await page.getByRole('button', { name: '다시 비교', exact: true }).click();
  await expect.poll(() => retryRequestCount).toBe(1);
  await expect(page.getByText('현재 캐릭터 설정과 비교하고 있습니다.')).toBeVisible();
  await expect(confirmButton).toBeDisabled();

  await expect(page.getByText('비교 완료', { exact: true })).toBeVisible({ timeout: 7_000 });
  await expect(confirmButton).toBeEnabled();
});

test('연결 대기 중인 신규 캐릭터 후보는 바로 확정할 수 있다', async ({ page }) => {
  let confirmBody: unknown;
  const newCharacterCandidate = {
    ...candidates[0],
    candidateKind: 'SETTING' as const,
    matchedCharacterId: null,
    matchStatus: 'UNRESOLVED' as const,
    comparisonStatus: 'WAITING_FOR_CHARACTER_MATCH' as const,
  };

  await page.route('**/api/v1/**', route => {
    const request = route.request();
    const pathname = new URL(request.url()).pathname;
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
          content: [newCharacterCandidate],
          page: 0,
          size: 20,
          totalElements: 1,
          totalPages: 1,
          hasNext: false,
        },
      });
    }
    if (pathname === `${listPath}/group-confirm`) {
      confirmBody = request.postDataJSON();
      return fulfill(route, { id: firstCandidateId, reviewStatus: 'CONFIRMED' });
    }
    if (pathname === `${listPath}/${firstCandidateId}`) {
      return fulfill(route, newCharacterCandidate);
    }
    return fulfill(route, []);
  });

  await authenticate(page);
  await page.goto(
    `/setting-review?workId=${workId}&batchId=${batchId}&candidate=${firstCandidateId}`,
  );

  await expect(page.getByText('새 캐릭터로 확정하면 이 설정을 현재값으로 바로 반영합니다.')).toBeVisible();
  const confirmButton = page.getByRole('button', { name: /설정 모두 확정/ }).last();
  await expect(confirmButton).toBeEnabled();
  await confirmButton.click();
  await expect.poll(() => confirmBody).toEqual({
    batchId,
    candidates: [{
      candidateId: firstCandidateId,
      applicationMode: 'APPLY_PROPOSAL',
      baseSnapshotVersion: null,
    }],
  });
});

test('비교 정보가 없는 기존 연결 후보는 확정 대신 현재 설정 비교를 시작한다', async ({ page }) => {
  let retryRequestCount = 0;
  const legacyCandidate = {
    ...candidates[0],
    candidateKind: 'SETTING' as const,
    comparisonStatus: 'NOT_REQUIRED' as const,
  };

  await page.route('**/api/v1/**', route => {
    const pathname = new URL(route.request().url()).pathname;
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
          content: [legacyCandidate],
          page: 0,
          size: 20,
          totalElements: 1,
          totalPages: 1,
          hasNext: false,
        },
      });
    }
    if (pathname === `${listPath}/${firstCandidateId}/recompare`) {
      retryRequestCount += 1;
      return fulfill(route, { ...legacyCandidate, comparisonStatus: 'PENDING' });
    }
    if (pathname === `${listPath}/${firstCandidateId}`) {
      return fulfill(route, legacyCandidate);
    }
    return fulfill(route, []);
  });

  await authenticate(page);
  await page.goto(
    `/setting-review?workId=${workId}&batchId=${batchId}&candidate=${firstCandidateId}`,
  );

  await expect(page.getByRole('button', { name: /설정 모두 확정/ }).last()).toBeDisabled();
  const startButton = page.getByRole('button', { name: '현재 설정 비교 시작', exact: true });
  await expect(startButton).toBeEnabled();
  await startButton.click();
  await expect.poll(() => retryRequestCount).toBe(1);
});

test('검토 대기 후보를 무시하는 동안 저장 동작만 잠그고 후보 탐색은 유지한다', async ({ page }) => {
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

  await page.getByRole('button', { name: '제외', exact: true }).click();
  await expect.poll(() => Boolean(releaseDismiss)).toBe(true);
  await expect(page.getByRole('button', { name: /강민준/ })).toBeEnabled();
  await expect(page.getByRole('button', { name: /설정 모두 확정/ }).first()).toBeDisabled();
  await page.getByRole('button', { name: /강민준/ }).click();
  await expect.poll(() => new URL(page.url()).searchParams.get('group')).toBe('강민준');
  await expect.poll(() => new URL(page.url()).searchParams.get('candidate')).toBeNull();
  const main = page.locator('main');
  const scrollTopBeforeAutoSelect = await main.evaluate(element => {
    element.scrollTop = Math.min(80, element.scrollHeight - element.clientHeight);
    return element.scrollTop;
  });
  expect(scrollTopBeforeAutoSelect).toBeGreaterThan(0);

  releaseDismiss?.();

  await expect.poll(() => new URL(page.url()).searchParams.get('group')).toBe('강민준');
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
  await expect(page.getByRole('button', { name: /강민준/ }).first()).toBeEnabled();
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
  await expect(dialog.getByLabel('캐릭터 이름')).toHaveCount(0);
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
      const requestedMatchStatuses = queryValues(requestUrl, 'matchStatuses');
      const content = requestedMatchStatuses.length > 0 && !requestedMatchStatuses.includes(matchStatus)
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
  await expect(page.getByRole('button', { name: /설정 모두 확정/ }).last()).toBeEnabled();
});

test('같은 이름의 캐릭터 후보를 일괄 연결하고 그룹 전체만 확정한다', async ({ page }) => {
  let entityName = '수아';
  let groupMatchBody: unknown;
  let groupConfirmBody: unknown;
  const groupedCandidates = [
    {
      ...candidates[0],
      entityName,
      matchedCharacterId: null,
      matchStatus: 'UNRESOLVED' as const,
      comparisonStatus: 'WAITING_FOR_CHARACTER_MATCH' as const,
    },
    {
      ...candidates[0],
      id: secondCandidateId,
      episodeNo: 2,
      entityName,
      rawEntityMention: '그녀',
      matchedCharacterId: null,
      matchStatus: 'UNRESOLVED' as const,
      attributeName: 'stats.strength',
      attributeValue: '강함',
      comparisonStatus: 'WAITING_FOR_CHARACTER_MATCH' as const,
    },
  ];

  await page.route('**/api/v1/**', route => {
    const request = route.request();
    const pathname = new URL(request.url()).pathname;
    if (pathname.endsWith('/auth/me')) return fulfill(route, member);
    const listPath = `/api/v1/works/${workId}/setting-candidates`;
    if (pathname === listPath) {
      const content = groupedCandidates.map(candidate => ({ ...candidate, entityName }));
      return fulfill(route, {
        batchId,
        episodeStartNo: 1,
        episodeEndNo: 2,
        episodeCount: 2,
        totalCandidateCount: 2,
        reviewedCandidateCount: 0,
        pendingCandidateCount: 2,
        matchRequiredCandidateCount: 0,
        groups: {
          content: [{
            groupKey: entityName.toLocaleLowerCase(),
            entityName,
            candidateCount: 2,
            evidenceEpisodeNos: [1, 2],
            candidates: content,
          }],
          page: 0,
          size: 20,
          totalElements: 1,
          totalPages: 1,
          hasNext: false,
        },
      });
    }
    if (pathname === `${listPath}/group-character-match`) {
      groupMatchBody = request.postDataJSON();
      entityName = '나은';
      return fulfill(route, {
        groupKey: '나은',
        entityName,
        candidates: groupedCandidates.map(candidate => ({ ...candidate, entityName })),
      });
    }
    if (pathname === `${listPath}/group-confirm`) {
      groupConfirmBody = request.postDataJSON();
      return fulfill(route, {
        groupKey: entityName,
        entityName,
        candidates: groupedCandidates.map(candidate => ({
          ...candidate,
          entityName,
          reviewStatus: 'CONFIRMED',
        })),
      });
    }
    return fulfill(route, []);
  });

  await authenticate(page);
  await page.goto(`/setting-review?workId=${workId}&batchId=${batchId}`);

  await expect(page.getByRole('button', { name: /수아 2개 설정/ })).toHaveCount(1);
  const groupDetail = page.getByRole('article');
  await expect(groupDetail.getByRole('region', { name: '눈 색깔 설정 후보' })).toBeVisible();
  await expect(groupDetail.getByRole('region', { name: '근력 설정 후보' })).toBeVisible();
  await expect(groupDetail.getByRole('button', { name: '확정', exact: true })).toHaveCount(0);

  await page.getByRole('button', { name: '캐릭터 일괄 연결' }).click();
  const matchDialog = page.getByRole('dialog', { name: '캐릭터 일괄 연결' });
  await matchDialog.getByRole('button', { name: '새 캐릭터로 등록', exact: true }).first().click();
  await matchDialog.getByLabel('새 캐릭터 이름').fill('나은');
  await matchDialog.getByRole('button', { name: '새 캐릭터로 등록', exact: true }).last().click();
  await expect.poll(() => groupMatchBody).toEqual({
    batchId,
    candidateIds: [firstCandidateId, secondCandidateId],
    resolutionType: 'CREATE_NEW',
    entityName: '나은',
  });
  await expect(page.getByRole('button', { name: /나은 2개 설정/ })).toBeVisible();

  await page.getByRole('button', { name: /2개 설정 모두 확정/ }).click();
  await expect.poll(() => groupConfirmBody).toEqual({
    batchId,
    candidates: [
      {
        candidateId: firstCandidateId,
        applicationMode: 'APPLY_PROPOSAL',
        baseSnapshotVersion: null,
      },
      {
        candidateId: secondCandidateId,
        applicationMode: 'APPLY_PROPOSAL',
        baseSnapshotVersion: null,
      },
    ],
  });
});

test('그룹 확정 중 다른 후보 묶음을 선택하면 새 선택을 유지한다', async ({ page }) => {
  let firstGroupConfirmed = false;
  let releaseConfirm: (() => void) | undefined;
  const firstGroupCandidate = { ...candidates[0], entityName: '수아' };
  const secondGroupCandidate = { ...candidates[0], id: secondCandidateId, entityName: '민준' };

  await page.route('**/api/v1/**', async route => {
    const request = route.request();
    const pathname = new URL(request.url()).pathname;
    if (pathname.endsWith('/auth/me')) return fulfill(route, member);

    const listPath = `/api/v1/works/${workId}/setting-candidates`;
    if (pathname === listPath) {
      const groups = [
        ...(!firstGroupConfirmed ? [{
          groupKey: '수아',
          entityName: '수아',
          candidateCount: 1,
          evidenceEpisodeNos: [1],
          candidates: [firstGroupCandidate],
        }] : []),
        {
          groupKey: '민준',
          entityName: '민준',
          candidateCount: 1,
          evidenceEpisodeNos: [2],
          candidates: [secondGroupCandidate],
        },
      ];
      return fulfill(route, {
        batchId,
        episodeStartNo: 1,
        episodeEndNo: 2,
        episodeCount: 2,
        totalCandidateCount: 2,
        reviewedCandidateCount: firstGroupConfirmed ? 1 : 0,
        pendingCandidateCount: firstGroupConfirmed ? 1 : 2,
        matchRequiredCandidateCount: 0,
        groups: {
          content: groups,
          page: 0,
          size: 20,
          totalElements: groups.length,
          totalPages: 1,
          hasNext: false,
        },
      });
    }
    if (pathname === `${listPath}/group-confirm`) {
      await new Promise<void>(resolve => {
        releaseConfirm = resolve;
      });
      firstGroupConfirmed = true;
      return fulfill(route, { groupKey: '수아', entityName: '수아', candidates: [] });
    }
    return fulfill(route, []);
  });

  await authenticate(page);
  await page.goto(`/setting-review?workId=${workId}&batchId=${batchId}&group=수아`);

  await page.getByRole('button', { name: /1개 설정 모두 확정/ }).click();
  await expect.poll(() => Boolean(releaseConfirm)).toBe(true);
  await page.getByRole('button', { name: /민준 1개 설정/ }).click();
  await expect.poll(() => new URL(page.url()).searchParams.get('group')).toBe('민준');

  releaseConfirm?.();
  await expect.poll(() => firstGroupConfirmed).toBe(true);
  await expect.poll(() => new URL(page.url()).searchParams.get('group')).toBe('민준');
  await expect(page.getByRole('heading', { name: '민준' })).toBeVisible();
});

test('그룹 확정 중 세계관 탭으로 이동하면 늦은 성공 응답이 탭 URL을 되돌리지 않는다', async ({ page }) => {
  let releaseConfirm: (() => void) | undefined;

  await page.route('**/api/v1/**', async route => {
    const request = route.request();
    const pathname = new URL(request.url()).pathname;
    if (pathname.endsWith('/auth/me')) return fulfill(route, member);
    const characterListPath = `/api/v1/works/${workId}/setting-candidates`;
    const worldListPath = `/api/v1/works/${workId}/world-setting-candidates`;
    if (pathname === characterListPath && request.method() === 'GET') {
      return fulfill(route, {
        batchId,
        episodeStartNo: 1,
        episodeEndNo: 1,
        episodeCount: 1,
        totalCandidateCount: 1,
        reviewedCandidateCount: 0,
        pendingCandidateCount: 1,
        matchRequiredCandidateCount: 0,
        groups: {
          content: [{
            groupKey: '수아', entityName: '수아', candidateCount: 1,
            evidenceEpisodeNos: [1], candidates: [candidates[0]],
          }],
          page: 0, size: 20, totalElements: 1, totalPages: 1, hasNext: false,
        },
      });
    }
    if (pathname === `${characterListPath}/group-confirm`) {
      await new Promise<void>(resolve => {
        releaseConfirm = resolve;
      });
      return fulfill(route, { groupKey: '수아', entityName: '수아', candidates: [] });
    }
    if (pathname === worldListPath && request.method() === 'GET') {
      return fulfill(route, {
        batchId,
        episodeStartNo: 1,
        episodeEndNo: 1,
        episodeCount: 1,
        totalCandidateCount: 0,
        reviewedCandidateCount: 0,
        pendingCandidateCount: 0,
        pendingComparisonCount: 0,
        processingComparisonCount: 0,
        failedComparisonCount: 0,
        recomparisonRequiredCount: 0,
        groups: {
          content: [], page: 0, size: 20, totalElements: 0, totalPages: 0, hasNext: false,
        },
      });
    }
    return fulfill(route, []);
  });

  await authenticate(page);
  await page.goto(`/setting-review?workId=${workId}&batchId=${batchId}&group=수아`);

  await page.getByRole('button', { name: /1개 설정 모두 확정/ }).click();
  await expect.poll(() => Boolean(releaseConfirm)).toBe(true);
  await page.getByRole('button', { name: /세계관 후보/ }).click();
  await expect.poll(() => new URL(page.url()).searchParams.get('candidateType')).toBe('world');

  releaseConfirm?.();
  await expect.poll(() => new URL(page.url()).searchParams.get('candidateType')).toBe('world');
  await expect(page.getByText('이번 분석에서 추출된 세계관 후보가 없습니다.')).toBeVisible();
});

test('구버전 다중 페이지 후보 응답에서는 불완전한 묶음 일괄 작업을 잠근다', async ({ page }) => {
  await page.route('**/api/v1/**', route => {
    const pathname = new URL(route.request().url()).pathname;
    if (pathname.endsWith('/auth/me')) return fulfill(route, member);

    const listPath = `/api/v1/works/${workId}/setting-candidates`;
    if (pathname === listPath) {
      return fulfill(route, {
        batchId,
        episodeStartNo: 1,
        episodeEndNo: 21,
        episodeCount: 21,
        totalCandidateCount: 21,
        reviewedCandidateCount: 0,
        pendingCandidateCount: 21,
        matchRequiredCandidateCount: 0,
        candidates: {
          content: [candidates[0]],
          page: 0,
          size: 20,
          totalElements: 21,
          totalPages: 2,
          hasNext: true,
        },
      });
    }
    return fulfill(route, []);
  });

  await authenticate(page);
  await page.goto(`/setting-review?workId=${workId}&batchId=${batchId}`);

  await expect(page.getByRole('button', { name: '캐릭터 일괄 연결' })).toBeDisabled();
  await expect(page.getByRole('button', { name: /설정 모두 확정/ }).last()).toBeDisabled();
  await expect(page.getByText('서버 업데이트 전 호환 목록에서는 묶음 전체를 보장할 수 없어 일괄 확정을 지원하지 않습니다.'))
    .toBeVisible();
});

test('큰 캐릭터 후보 묶음도 세계관 후보처럼 한 목록으로 렌더링하고 전체 묶음을 확정한다', async ({ page }) => {
  let groupConfirmBody: { candidates?: Array<{ candidateId?: string }> } | undefined;
  const largeGroupCandidates = Array.from({ length: 25 }, (_, index) => ({
    ...candidates[0],
    id: `aaaaaaaa-aaaa-4aaa-8aaa-${String(index + 1).padStart(12, '0')}`,
    episodeNo: index + 1,
    entityName: '비요른 얀델',
    rawEntityMention: '비요른',
    matchedCharacterId: null,
    matchStatus: 'UNRESOLVED' as const,
    attributeName: `stats.test_${index + 1}`,
    attributeNameEditable: true,
    attributeNamePrefix: 'stats.',
    attributeValue: String(index + 1),
    comparisonStatus: 'WAITING_FOR_CHARACTER_MATCH' as const,
  }));

  await page.route('**/api/v1/**', route => {
    const request = route.request();
    const pathname = new URL(request.url()).pathname;
    if (pathname.endsWith('/auth/me')) return fulfill(route, member);
    const listPath = `/api/v1/works/${workId}/setting-candidates`;
    if (pathname === listPath) {
      return fulfill(route, {
        batchId,
        episodeStartNo: 1,
        episodeEndNo: 25,
        episodeCount: 25,
        totalCandidateCount: 25,
        reviewedCandidateCount: 0,
        pendingCandidateCount: 25,
        matchRequiredCandidateCount: 0,
        groups: {
          content: [{
            groupKey: '비요른 얀델',
            entityName: '비요른 얀델',
            candidateCount: 25,
            evidenceEpisodeNos: Array.from({ length: 25 }, (_, index) => index + 1),
            candidates: largeGroupCandidates,
          }],
          page: 0,
          size: 20,
          totalElements: 1,
          totalPages: 1,
          hasNext: false,
        },
      });
    }
    if (pathname === `${listPath}/group-confirm`) {
      groupConfirmBody = request.postDataJSON();
      return fulfill(route, {
        groupKey: '비요른 얀델',
        entityName: '비요른 얀델',
        candidates: largeGroupCandidates.map(candidate => ({
          ...candidate,
          reviewStatus: 'CONFIRMED',
        })),
      });
    }
    return fulfill(route, []);
  });

  await authenticate(page);
  await page.goto(`/setting-review?workId=${workId}&batchId=${batchId}`);

  const details = page.locator('.setting-candidate-detail');
  await expect(details).toHaveCount(25);

  await page.getByRole('button', { name: /25개 설정 모두 확정/ }).click();
  await expect.poll(() => groupConfirmBody?.candidates?.length).toBe(25);
  expect(groupConfirmBody?.candidates?.map(candidate => candidate.candidateId))
    .toEqual(largeGroupCandidates.map(candidate => candidate.id));
});

test('단건 공유 링크가 기본 필터와 현재 페이지 밖 후보의 실제 그룹을 찾아간다', async ({ page }) => {
  const precedingId = '77777777-7777-4777-8777-777777777771';
  const target = { ...candidates[1], id: secondCandidateId, entityName: '후보 대상' };
  const preceding = { ...candidates[1], id: precedingId, entityName: '앞선 대상' };
  const requestedPages: string[] = [];
  const requestedLegacyCandidates: Array<string | null> = [];

  await page.route('**/api/v1/**', route => {
    const requestUrl = new URL(route.request().url());
    const pathname = requestUrl.pathname;
    if (pathname.endsWith('/auth/me')) return fulfill(route, member);
    const listPath = `/api/v1/works/${workId}/setting-candidates`;
    if (pathname === `${listPath}/${secondCandidateId}`) return fulfill(route, target);
    if (pathname === listPath) {
      const reviewStatus = requestUrl.searchParams.get('reviewStatus');
      const pageIndex = Number(requestUrl.searchParams.get('page') ?? 0);
      requestedPages.push(`${reviewStatus ?? 'ALL'}:${pageIndex}`);
      requestedLegacyCandidates.push(requestUrl.searchParams.get('includeLegacyCandidates'));
      const visible = reviewStatus !== 'PENDING_REVIEW'
        ? [preceding, target][pageIndex]
        : candidates[0];
      const totalPages = reviewStatus !== 'PENDING_REVIEW' ? 2 : 1;
      return fulfill(route, {
        batchId,
        episodeStartNo: 1,
        episodeEndNo: 2,
        episodeCount: 2,
        totalCandidateCount: 3,
        reviewedCandidateCount: 2,
        pendingCandidateCount: 1,
        matchRequiredCandidateCount: 0,
        groups: {
          content: [{
            groupKey: visible.entityName.trim().replace(/\s+/g, ' ').toLocaleLowerCase(),
            entityName: visible.entityName,
            candidateCount: 1,
            evidenceEpisodeNos: [visible.episodeNo],
            candidates: [visible],
          }],
          page: pageIndex,
          size: 1,
          totalElements: totalPages,
          totalPages,
          hasNext: pageIndex + 1 < totalPages,
        },
      });
    }
    return fulfill(route, []);
  });

  await authenticate(page);
  await page.goto(
    `/setting-review?workId=${workId}&batchId=${batchId}&size=1&candidate=${secondCandidateId}`,
  );

  await expect.poll(() => new URL(page.url()).searchParams.get('reviewStatus')).toBe('ALL');
  await expect.poll(() => requestedPages).toContain('ALL:1');
  await expect.poll(() => new URL(page.url()).searchParams.get('page')).toBe('2');
  await expect.poll(() => new URL(page.url()).searchParams.get('candidate')).toBeNull();
  await expect(page.getByRole('heading', { name: '후보 대상' })).toBeVisible();
  expect(requestedLegacyCandidates).not.toContain('true');
  expect(requestedLegacyCandidates).toContain('false');
});

test('단건 공유 링크의 그룹 탐색 실패를 같은 화면에서 다시 시도한다', async ({ page }) => {
  const target = { ...candidates[1], id: secondCandidateId, entityName: '재시도 대상' };
  let failedGroupRequestCount = 0;

  await page.route('**/api/v1/**', route => {
    const requestUrl = new URL(route.request().url());
    const pathname = requestUrl.pathname;
    if (pathname.endsWith('/auth/me')) return fulfill(route, member);
    const listPath = `/api/v1/works/${workId}/setting-candidates`;
    if (pathname === `${listPath}/${secondCandidateId}`) return fulfill(route, target);
    if (pathname === listPath) {
      const reviewStatus = requestUrl.searchParams.get('reviewStatus');
      if (reviewStatus == null && failedGroupRequestCount < 3) {
        failedGroupRequestCount += 1;
        return fulfillError(route, 500, '후보 묶음 조회에 실패했습니다.');
      }
      const visible = reviewStatus === 'PENDING_REVIEW' ? candidates[0] : target;
      return fulfill(route, {
        batchId,
        episodeStartNo: 1,
        episodeEndNo: 2,
        episodeCount: 2,
        totalCandidateCount: 2,
        reviewedCandidateCount: 1,
        pendingCandidateCount: 1,
        matchRequiredCandidateCount: 0,
        groups: {
          content: [{
            groupKey: visible.entityName.trim().replace(/\s+/g, ' ').toLocaleLowerCase(),
            entityName: visible.entityName,
            candidateCount: 1,
            evidenceEpisodeNos: [visible.episodeNo],
            candidates: [visible],
          }],
          page: 0,
          size: 20,
          totalElements: 1,
          totalPages: 1,
          hasNext: false,
        },
      });
    }
    return fulfill(route, []);
  });

  await authenticate(page);
  await page.goto(
    `/setting-review?workId=${workId}&batchId=${batchId}&candidate=${secondCandidateId}`,
  );

  await expect(page.getByText('공유된 후보의 묶음 위치를 찾지 못했습니다.')).toBeVisible();
  await page.getByRole('button', { name: '다시 시도', exact: true }).click();

  await expect.poll(() => new URL(page.url()).searchParams.get('candidate')).toBeNull();
  await expect(page.getByRole('heading', { name: '재시도 대상' })).toBeVisible();
  await expect.poll(() => failedGroupRequestCount).toBe(3);
});

test('후보 polling 중에도 수정 모달의 입력 포커스를 유지한다', async ({ page }) => {
  let listRequestCount = 0;
  const processingCandidate = {
    ...candidates[0],
    comparisonStatus: 'PROCESSING',
  };

  await page.route('**/api/v1/**', route => {
    const requestUrl = new URL(route.request().url());
    const pathname = requestUrl.pathname;
    if (pathname.endsWith('/auth/me')) return fulfill(route, member);
    const listPath = `/api/v1/works/${workId}/setting-candidates`;
    if (pathname === listPath) {
      listRequestCount += 1;
      const refreshedCandidate = {
        ...processingCandidate,
        confidence: 0.9 + listRequestCount / 1000,
      };
      return fulfill(route, {
        batchId,
        episodeStartNo: 1,
        episodeEndNo: 1,
        episodeCount: 1,
        totalCandidateCount: 1,
        reviewedCandidateCount: 0,
        pendingCandidateCount: 1,
        matchRequiredCandidateCount: 0,
        groups: {
          content: [{
            groupKey: '수아',
            entityName: '수아',
            candidateCount: 1,
            evidenceEpisodeNos: [1],
            candidates: [refreshedCandidate],
          }],
          page: 0,
          size: 20,
          totalElements: 1,
          totalPages: 1,
          hasNext: false,
        },
      });
    }
    if (pathname === `${listPath}/${firstCandidateId}`) return fulfill(route, processingCandidate);
    return fulfill(route, []);
  });

  await authenticate(page);
  await page.goto(`/setting-review?workId=${workId}&batchId=${batchId}`);
  await page.getByRole('button', { name: '수정', exact: true }).click();

  const valueInput = page.getByRole('dialog', { name: '설정 후보 수정' }).getByLabel('설정값');
  await valueInput.fill('입력 중인 설정값');
  await valueInput.focus();
  const requestCountBeforePolling = listRequestCount;
  await expect.poll(() => listRequestCount).toBeGreaterThan(requestCountBeforePolling);

  await expect(valueInput).toBeFocused();
  await expect(valueInput).toHaveValue('입력 중인 설정값');
});

test('이름 없는 캐릭터 그룹도 마지막 목록에서 선택해 검토한다', async ({ page }) => {
  const unnamed = { ...candidates[0], entityName: '', rawEntityMention: '' };
  await page.route('**/api/v1/**', route => {
    const requestUrl = new URL(route.request().url());
    const pathname = requestUrl.pathname;
    if (pathname.endsWith('/auth/me')) return fulfill(route, member);
    if (pathname === `/api/v1/works/${workId}/setting-candidates`) {
      return fulfill(route, {
        batchId,
        episodeStartNo: 1,
        episodeEndNo: 1,
        episodeCount: 1,
        totalCandidateCount: 1,
        reviewedCandidateCount: 0,
        pendingCandidateCount: 1,
        matchRequiredCandidateCount: 0,
        groups: {
          content: [{
            groupKey: '',
            entityName: '',
            candidateCount: 1,
            evidenceEpisodeNos: [1],
            candidates: [unnamed],
          }],
          page: 0,
          size: 20,
          totalElements: 1,
          totalPages: 1,
          hasNext: false,
        },
      });
    }
    return fulfill(route, []);
  });

  await authenticate(page);
  await page.goto(`/setting-review?workId=${workId}&batchId=${batchId}`);

  await expect(page.getByRole('button', { name: /이름 없는 캐릭터 1개 설정/ })).toBeVisible();
  await expect(page.getByRole('heading', { name: '이름 없는 캐릭터' })).toBeVisible();
  await expect.poll(() => new URL(page.url()).searchParams.get('group')).toContain('__unnamed__:');
});
