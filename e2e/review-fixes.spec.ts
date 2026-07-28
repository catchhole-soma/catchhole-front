import { expect, test, type Page, type Route } from '@playwright/test';

const workId = '11111111-1111-4111-8111-111111111111';
const batchId = '22222222-2222-4222-8222-222222222222';
const episodeId = '44444444-4444-4444-8444-444444444444';

const member = {
  id: 1,
  email: 'review-fixes@example.com',
  displayName: '리뷰 수정 테스트',
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

async function authenticate(page: Page, token: string) {
  await page.goto('/login');
  await page.evaluate(value => localStorage.setItem('accessToken', value), token);
}

test('삭제된 회차의 저장된 분석 URL은 사용할 수 없는 종료 상태를 표시한다', async ({ page }) => {
  const analysisJobId = '33333333-3333-4333-8333-333333333333';

  await page.route('**/api/v1/**', route => {
    const pathname = new URL(route.request().url()).pathname;
    const data = pathname.endsWith('/auth/me')
      ? member
      : pathname.endsWith(`/${workId}/analysis-jobs/${analysisJobId}`)
        ? {
            id: analysisJobId,
            workId,
            workTitle: '현재 작품',
            batchId,
            jobType: 'EPISODE_VALIDATION',
            status: 'SUCCEEDED',
            episodes: [{
              id: episodeId,
              episodeNo: 20,
              title: '삭제된 회차',
              status: 'ARCHIVED',
            }],
          }
        : pathname.endsWith(`/works/${workId}`)
          ? { id: workId, title: '현재 작품', genre: '판타지' }
          : pathname.endsWith('/works')
            ? [{ id: workId, title: '현재 작품', genre: '판타지', episodeCount: 0 }]
            : [];

    return fulfill(route, data);
  });

  await authenticate(page, 'archived-analysis-token');
  await page.goto(
    `/episode-upload?workId=${workId}&batchId=${batchId}`
    + `&analysisJobIds=${analysisJobId}&currentAnalysisJobIds=${analysisJobId}`
    + '&jobType=EPISODE_VALIDATION',
  );

  await expect(page.getByText('삭제되어 사용할 수 없는 회차가 있습니다')).toBeVisible();
  await expect(page.getByText('사용할 수 없음', { exact: true })).toBeVisible();
  await expect(page.getByText('이 회차는 삭제되어 더 이상 분석 대상에 포함되지 않습니다.')).toBeVisible();
  await expect(page.getByText('분석을 준비하고 있습니다')).toHaveCount(0);
  await expect(page.getByRole('button', { name: '분석 결과를 열 수 없습니다' })).toBeDisabled();
});

test('대시보드의 실패 회차 다시 시도는 새 Job을 현재 polling 대상으로 연다', async ({ page }) => {
  const failedAnalysisJobId = '33333333-3333-4333-8333-333333333333';
  const retryAnalysisJobId = '55555555-5555-4555-8555-555555555555';
  let retryRequestCount = 0;
  let createRequestCount = 0;

  await page.route('**/api/v1/**', route => {
    const request = route.request();
    const pathname = new URL(request.url()).pathname;

    if (
      request.method() === 'POST'
      && pathname.endsWith(`/${workId}/analysis-jobs/${failedAnalysisJobId}/retry`)
    ) {
      retryRequestCount += 1;
      return fulfill(route, [{ id: retryAnalysisJobId }]);
    }
    if (request.method() === 'POST' && pathname.endsWith(`/${workId}/analysis-jobs`)) {
      createRequestCount += 1;
      return fulfill(route, []);
    }

    const data = pathname.endsWith('/auth/me')
      ? member
      : pathname.endsWith(`/${workId}/episodes`)
        ? [{
            id: episodeId,
            batchId,
            episodeNo: 20,
            title: '재시도 대상 회차',
            originalFilename: 'episode-20.txt',
            contentUpdatedAt: '2026-07-28T12:00:00',
            charCount: 1200,
            analysisStatus: 'FAILED',
            latestAnalysisJobId: failedAnalysisJobId,
            unresolvedFindingCount: null,
          }]
        : pathname.endsWith(`/${workId}/analysis-jobs/${failedAnalysisJobId}`)
          ? {
              id: failedAnalysisJobId,
              workId,
              workTitle: '현재 작품',
              batchId,
              jobType: 'EPISODE_VALIDATION',
              status: 'FAILED',
              episodes: [{ id: episodeId, episodeNo: 20, title: '재시도 대상 회차', status: 'FAILED' }],
            }
          : pathname.endsWith(`/${workId}/analysis-jobs/${retryAnalysisJobId}`)
            ? {
                id: retryAnalysisJobId,
                workId,
                workTitle: '현재 작품',
                batchId,
                jobType: 'EPISODE_VALIDATION',
                status: 'PENDING',
                episodes: [{ id: episodeId, episodeNo: 20, title: '재시도 대상 회차', status: 'FAILED' }],
              }
            : pathname.endsWith(`/works/${workId}`)
              ? { id: workId, title: '현재 작품', genre: '판타지' }
              : pathname.endsWith('/works')
                ? [{ id: workId, title: '현재 작품', genre: '판타지', episodeCount: 1 }]
                : [];

    return fulfill(route, data);
  });

  await authenticate(page, 'dashboard-retry-token');
  await page.goto(`/dashboard?workId=${workId}&nav=manuscripts`);

  await page.getByRole('button', { name: '다시 시도', exact: true }).click();

  await expect.poll(() => retryRequestCount).toBe(1);
  expect(createRequestCount).toBe(0);
  await expect.poll(() => {
    const params = new URL(page.url()).searchParams;
    return [
      params.get('analysisJobIds'),
      params.get('currentAnalysisJobIds'),
    ];
  }).toEqual([
    `${failedAnalysisJobId},${retryAnalysisJobId}`,
    retryAnalysisJobId,
  ]);
});

test('설정집 삭제는 대상을 표시하고 실패한 모달에서 다시 시도한다', async ({ page }) => {
  const settingBookId = '66666666-6666-4666-8666-666666666666';
  let settingBooks = [{
    id: settingBookId,
    originalFilename: '세계관_최종본.txt',
    fileSize: 1200,
    uploadedAt: '2026-07-28T12:00:00',
  }];
  let deleteRequestCount = 0;
  let nativeDialogCount = 0;

  page.on('dialog', async dialog => {
    nativeDialogCount += 1;
    await dialog.dismiss();
  });

  await page.route('**/api/v1/**', route => {
    const request = route.request();
    const pathname = new URL(request.url()).pathname;

    if (
      request.method() === 'DELETE'
      && pathname.endsWith(`/${workId}/setting-books/${settingBookId}`)
    ) {
      deleteRequestCount += 1;
      if (deleteRequestCount === 1) {
        return route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({
            success: false,
            data: null,
            error: {
              code: 'SETTING_BOOK_DELETE_FAILED',
              message: '설정집 원본을 삭제하지 못했습니다.',
              details: [],
            },
          }),
        });
      }
      settingBooks = [];
      return fulfill(route, null);
    }

    const data = pathname.endsWith('/auth/me')
      ? member
      : pathname.endsWith(`/${workId}/setting-books`)
        ? settingBooks
        : pathname.endsWith(`/${workId}/episodes`)
          ? []
          : pathname.endsWith(`/works/${workId}`)
            ? { id: workId, title: '현재 작품', genre: '판타지' }
            : pathname.endsWith('/works')
              ? [{ id: workId, title: '현재 작품', genre: '판타지', episodeCount: 0 }]
              : [];

    return fulfill(route, data);
  });

  await authenticate(page, 'setting-book-delete-token');
  await page.goto(`/dashboard?workId=${workId}&nav=manuscripts`);

  await page.getByRole('button', { name: '삭제', exact: true }).click();
  const modal = page.getByRole('dialog', { name: '이 설정집을 삭제할까요?' });
  await expect(modal).toBeVisible();
  await expect(modal.getByText('세계관_최종본.txt')).toBeVisible();
  expect(nativeDialogCount).toBe(0);

  await modal.getByRole('button', { name: '삭제', exact: true }).click();
  await expect.poll(() => deleteRequestCount).toBe(1);
  await expect(modal.getByRole('alert')).toHaveText(
    '삭제에 실패했습니다. 설정집은 목록에 그대로 유지됩니다.',
  );
  await expect(page.getByRole('button', { name: '세계관_최종본.txt' })).toBeVisible();

  await modal.getByRole('button', { name: '다시 시도' }).click();
  await expect.poll(() => deleteRequestCount).toBe(2);
  await expect(modal).not.toBeVisible();
  await expect(page.getByRole('button', { name: '세계관_최종본.txt' })).not.toBeVisible();
});

test('직접 연 원문 화면의 원고 목록 버튼은 이전 페이지가 아닌 현재 작품 목록으로 간다', async ({ page }) => {
  await page.route('**/api/v1/**', route => {
    const pathname = new URL(route.request().url()).pathname;
    const data = pathname.endsWith('/auth/me')
      ? member
      : pathname.endsWith(`/episodes/${episodeId}`)
        ? {
            id: episodeId,
            episodeNo: 20,
            title: '직접 연 원문',
            content: '원문입니다.',
            originalFilename: 'episode-20.txt',
            contentUpdatedAt: '2026-07-28T12:00:00',
            charCount: 6,
          }
        : pathname.endsWith(`/works/${workId}`)
          ? { id: workId, title: '현재 작품', genre: '판타지' }
          : pathname.endsWith('/works')
            ? [{ id: workId, title: '현재 작품', genre: '판타지', episodeCount: 1 }]
            : [];

    return fulfill(route, data);
  });

  await authenticate(page, 'direct-reader-token');
  await page.goto('/works');
  await page.goto(`/editor?workId=${workId}&episodeId=${episodeId}`);

  await page.getByRole('button', { name: '원고 목록', exact: true }).click();

  await expect(page).toHaveURL(
    new RegExp(`/dashboard\\?workId=${workId}&nav=manuscripts$`),
  );
});

test('설정집 업로드 요청 중에는 선택 파일과 드롭 영역을 변경할 수 없다', async ({ page }) => {
  let releaseUploadRequest!: () => void;
  const uploadResponseGate = new Promise<void>(resolve => {
    releaseUploadRequest = resolve;
  });
  let uploadRequestCount = 0;
  let uploadBody = '';

  await page.route('**/api/v1/**', async route => {
    const request = route.request();
    const pathname = new URL(request.url()).pathname;

    if (
      request.method() === 'POST'
      && pathname.endsWith(`/${workId}/setting-books`)
    ) {
      uploadRequestCount += 1;
      uploadBody = request.postData() ?? '';
      await uploadResponseGate;
      return fulfill(route, {
        id: '77777777-7777-4777-8777-777777777777',
        originalFilename: 'setting-a.txt',
      });
    }

    const data = pathname.endsWith('/auth/me')
      ? member
      : pathname.endsWith(`/${workId}/setting-books`)
        ? []
        : pathname.endsWith(`/${workId}/episodes`)
          ? []
          : pathname.endsWith(`/works/${workId}`)
            ? { id: workId, title: '현재 작품', genre: '판타지' }
            : pathname.endsWith('/works')
              ? [{ id: workId, title: '현재 작품', genre: '판타지', episodeCount: 0 }]
              : [];

    return fulfill(route, data);
  });

  await authenticate(page, 'pending-file-token');
  await page.goto(`/dashboard?workId=${workId}&nav=manuscripts`);
  await page.getByRole('button', { name: '설정집 업로드', exact: true }).click();

  const fileInput = page.locator('input[type="file"]');
  const dropArea = fileInput.locator('..');
  await fileInput.setInputFiles({
    name: 'setting-a.txt',
    mimeType: 'text/plain',
    buffer: Buffer.from('첫 번째 설정집'),
  });
  await page.getByRole('button', { name: '업로드', exact: true }).click();

  await expect.poll(() => uploadRequestCount).toBe(1);
  await expect(fileInput).toBeDisabled();
  await expect(dropArea).toHaveAttribute('aria-disabled', 'true');

  const replacementTransfer = await page.evaluateHandle(() => {
    const transfer = new DataTransfer();
    transfer.items.add(new File(['두 번째 설정집'], 'setting-b.txt', { type: 'text/plain' }));
    return transfer;
  });
  await dropArea.dispatchEvent('drop', { dataTransfer: replacementTransfer });

  await expect(page.getByText(/setting-a\.txt/)).toBeVisible();
  await expect(page.getByText(/setting-b\.txt/)).toHaveCount(0);
  expect(uploadBody).toContain('setting-a.txt');
  expect(uploadBody).not.toContain('setting-b.txt');

  releaseUploadRequest();
  await expect(page.getByText('설정집 업로드', { exact: true })).toHaveCount(1);
});
