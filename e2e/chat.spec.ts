import { test, expect, type Page, type Route } from '@playwright/test';
const work = '11111111-1111-4111-8111-111111111111';
const room = '22222222-2222-4222-8222-222222222222';
const question = '33333333-3333-4333-8333-333333333333';
function success(route: Route, data: unknown) {
  return route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ success: true, data }),
  });
}
async function fixture(
  page: Page,
  options: { lost?: boolean; waiting?: boolean } = {},
) {
  const state = {
    created: false,
    closed: false,
    submitted: false,
    keys: [] as string[],
    texts: [] as string[],
    complete: !options.waiting,
  };
  const result = {
    outcome: 'ANSWER',
    text: '아리아의 현재 능력은 화염구입니다.',
    limitations: ['최근 대화 일부만 참고했습니다.'],
    sources: [],
    retrievalSources: [
      {
        chunkId: question,
        episodeId: question,
        sourceEpisodeNo: 2,
        sourceHash: 'a'.repeat(64),
        quote: '아리아는 화염구를 배웠다.',
        startOffset: 0,
        endOffset: 16,
      },
    ],
  };
  const execution = () => ({
    questionId: question,
    attemptId: question,
    state: state.complete ? 'SUCCEEDED' : 'RUNNING',
    result: state.complete ? result : null,
  });
  const session = () => ({
    id: room,
    workId: work,
    createdAt: '2026-10-13T10:00:00',
    expiresAt: new Date(Date.now() + 7200000).toISOString(),
    questionCount: state.submitted ? 1 : 0,
  });
  await page.route('**/api/v1/**', (route) => {
    const req = route.request(),
      path = new URL(req.url()).pathname;
    if (path.endsWith('/auth/me'))
      return success(route, {
        id: 1,
        email: 'chat@local.invalid',
        displayName: '작가',
        role: 'AUTHOR',
        status: 'ACTIVE',
      });
    if (path === '/api/v1/works')
      return success(route, [
        {
          id: work,
          title: '빙하의 작가',
          genre: '판타지',
          latestEpisodeNo: 2,
          lifecycleStatus: 'ACTIVE',
        },
      ]);
    if (path.endsWith('/chat-sessions')) {
      if (req.method() === 'POST') {
        state.created = true;
        return success(route, session());
      }
      return success(route, {
        content: state.created && !state.closed ? [session()] : [],
        totalElements: state.created && !state.closed ? 1 : 0,
      });
    }
    if (path.includes('/chat-sessions/')) {
      if (req.method() === 'DELETE') {
        state.closed = true;
        return success(route, null);
      }
      if (state.closed)
        return route.fulfill({
          status: 410,
          contentType: 'application/json',
          body: JSON.stringify({
            success: false,
            error: { code: 'CHAT_SESSION_CLOSED', status: 410 },
          }),
        });
      if (path.endsWith('/messages'))
        return success(route, {
          content: state.submitted
            ? [
                {
                  questionId: question,
                  sequence: 1,
                  question: state.texts[0],
                  execution: execution(),
                },
              ]
            : [],
          page: 0,
          size: 20,
          hasNext: false,
          totalElements: state.submitted ? 1 : 0,
        });
      return success(route, session());
    }
    if (path.endsWith('/chat-questions') && req.method() === 'POST') {
      state.keys.push(req.headers()['idempotency-key']);
      state.texts.push(req.postDataJSON().question);
      state.submitted = true;
      if (options.lost && state.keys.length === 1) return route.abort('failed');
      return success(route, execution());
    }
    if (path.includes('/chat-questions/')) return success(route, execution());
    return success(route, []);
  });
  await page.goto('/login');
  await page.evaluate(() =>
    localStorage.setItem('accessToken', 'chat-test-token'),
  );
  await page.goto(`/chat?workId=${work}`);
  await page.getByRole('button', { name: '대화 시작', exact: true }).click();
  await expect(page).toHaveURL(new RegExp(room));
  await expect(
    page.getByRole('textbox', { name: '질문', exact: true }),
  ).toBeEnabled();
  return state;
}

test('대화 생성·질문·근거·새로고침·종료와 본문 저장 금지', async ({ page }) => {
  const state = await fixture(page);
  await page
    .getByRole('textbox', { name: '질문', exact: true })
    .fill('아리아의 현재 능력은?');
  await page.getByRole('button', { name: '보내기', exact: true }).click();
  await expect(
    page.getByText('아리아의 현재 능력은 화염구입니다.', { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText('최근 대화 일부만 참고했습니다.', { exact: true }),
  ).toBeVisible();
  await page.getByRole('button', { name: '근거 확인' }).click();
  await expect(page.getByRole('dialog')).toContainText(
    '아리아는 화염구를 배웠다.',
  );
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.reload();
  await expect(
    page.getByText('아리아의 현재 능력은 화염구입니다.', { exact: true }),
  ).toBeVisible();
  expect(state.keys).toHaveLength(1);
  const storage = await page.evaluate(() =>
    JSON.stringify({
      local: { ...localStorage },
      session: { ...sessionStorage },
    }),
  );
  expect(storage).not.toContain('화염구');
  expect(page.url()).not.toContain('아리아');
  await page.getByRole('button', { name: '대화 종료', exact: true }).click();
  await expect(
    page.getByText('아리아의 현재 능력은 화염구입니다.', { exact: true }),
  ).toHaveCount(0);
  expect(state.closed).toBe(true);
});

test('전송 응답 유실은 입력을 보존하고 같은 키로 접수를 확인한다', async ({
  page,
}) => {
  const state = await fixture(page, { lost: true });
  await page
    .getByRole('textbox', { name: '질문', exact: true })
    .fill('아리아의 능력은?');
  await page.getByRole('button', { name: '보내기', exact: true }).click();
  await expect(
    page.getByRole('button', { name: '접수 확인', exact: true }),
  ).toBeEnabled();
  await expect(
    page.getByRole('textbox', { name: '질문', exact: true }),
  ).toHaveValue('아리아의 능력은?');
  await page.getByRole('button', { name: '접수 확인', exact: true }).click();
  await expect(
    page.getByRole('textbox', { name: '질문', exact: true }),
  ).toHaveValue('');
  expect(state.keys).toHaveLength(2);
  expect(new Set(state.keys).size).toBe(1);
});

test('한글 조합 Enter는 전송하지 않고 답변 대기 중 다음 전송을 막는다', async ({
  page,
}) => {
  const state = await fixture(page, { waiting: true });
  const input = page.getByRole('textbox', { name: '질문', exact: true });
  await input.fill('아리아의 능력은?');
  await input.dispatchEvent('compositionstart');
  await input.dispatchEvent('keydown', { key: 'Enter', isComposing: true });
  expect(state.keys).toHaveLength(0);
  await input.dispatchEvent('compositionend');
  await input.press('Enter');
  await expect(page.getByText('설정과 근거를 확인하고 있어요…')).toBeVisible();
  await input.fill('그건 언제 얻었어?');
  await expect(
    page.getByRole('button', { name: '보내기', exact: true }),
  ).toBeDisabled();
  state.complete = true;
  await expect(
    page.getByRole('button', { name: '보내기', exact: true }),
  ).toBeEnabled();
});

test('열린 대화가 만료되면 본문과 근거 창을 숨긴다', async ({ page }) => {
  const state = await fixture(page);
  await page
    .getByRole('textbox', { name: '질문', exact: true })
    .fill('아리아의 능력은?');
  await page.getByRole('button', { name: '보내기', exact: true }).click();
  await page.getByRole('button', { name: '근거 확인' }).click();
  await expect(page.getByRole('dialog')).toContainText(
    '아리아는 화염구를 배웠다.',
  );
  state.closed = true;
  await expect(
    page.getByText('종료되었거나 2시간 동안 사용하지 않아 삭제된 대화입니다.'),
  ).toBeVisible();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(
    page.getByText('아리아의 현재 능력은 화염구입니다.', { exact: true }),
  ).toHaveCount(0);
});

test('320px에서도 입력·답변·종료와 회차 범위에 접근한다', async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await fixture(page);
  await page
    .getByRole('textbox', { name: '질문', exact: true })
    .fill('아리아의 능력은?');
  await page.getByRole('button', { name: '보내기', exact: true }).click();
  await expect(
    page.getByText('아리아의 현재 능력은 화염구입니다.', { exact: true }),
  ).toBeInViewport();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await expect(
    page.getByRole('button', { name: '대화 종료', exact: true }),
  ).toBeInViewport();
  await expect(
    page.getByRole('textbox', { name: '질문', exact: true }),
  ).toBeInViewport();
  await page.screenshot({ path: testInfo.outputPath('chat-mobile.png') });
});

test('메시지 페이지와 새로고침은 URL의 순서를 복원한다', async ({ page }) => {
  await fixture(page);
  await page.route('**/chat-sessions/*/messages?*', (route) => {
    const p = Number(new URL(route.request().url()).searchParams.get('page'));
    return success(route, {
      content: [
        {
          questionId: question,
          sequence: p * 20 + 1,
          question: `${p + 1}페이지 질문`,
          execution: {
            state: 'SUCCEEDED',
            result: {
              outcome: 'ANSWER',
              text: `${p + 1}페이지 답변`,
              sources: [],
              limitations: [],
            },
          },
        },
      ],
      page: p,
      size: 20,
      totalElements: 21,
      hasNext: p === 0,
    });
  });
  await page.reload();
  await expect(page.getByText('1페이지 답변', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: '다음', exact: true }).click();
  await expect(page).toHaveURL(/messagePage=2/);
  await expect(page.getByText('2페이지 답변', { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByText('2페이지 답변', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: '이전', exact: true }).click();
  await expect(page.getByText('1페이지 답변', { exact: true })).toBeVisible();
});

test('로그아웃 후 늦게 도착한 전송 응답이 대화를 복원하지 않는다', async ({
  page,
}) => {
  await fixture(page);
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  let received!: () => void;
  const started = new Promise<void>((resolve) => {
    received = resolve;
  });
  await page.route('**/chat-questions', async (route) => {
    received();
    await gate;
    await success(route, {
      questionId: question,
      attemptId: question,
      state: 'QUEUED',
    });
  });
  await page
    .getByRole('textbox', { name: '질문', exact: true })
    .fill('남으면 안 되는 질문');
  await page.getByRole('button', { name: '보내기', exact: true }).click();
  await started;
  await page.getByRole('button', { name: '사용자 메뉴 열기' }).click();
  await page.getByRole('menuitem', { name: '로그아웃' }).click();
  await expect(page).toHaveURL(/\/landing$/);
  release();
  await expect(page.locator('.chat-turn')).toHaveCount(0);
  expect(
    await page.evaluate(() => localStorage.getItem('accessToken')),
  ).toBeNull();
  expect(await page.evaluate(() => JSON.stringify(localStorage))).not.toContain(
    '남으면 안 되는 질문',
  );
});

test('사용자가 작품 선택으로 이동한 뒤 늦은 전송 응답은 화면을 바꾸지 않는다', async ({
  page,
}) => {
  await fixture(page);
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  let received!: () => void;
  const started = new Promise<void>((resolve) => {
    received = resolve;
  });
  await page.route('**/chat-questions', async (route) => {
    received();
    await gate;
    await success(route, { questionId: question, state: 'QUEUED' });
  });
  await page
    .getByRole('textbox', { name: '질문', exact: true })
    .fill('이전 작품 질문');
  await page.getByRole('button', { name: '보내기', exact: true }).click();
  await started;
  await page.getByRole('button', { name: '작품 선택으로 이동' }).click();
  await expect(page).toHaveURL(/\/works$/);
  release();
  await expect(page.getByText('작품 선택', { exact: true })).toBeVisible();
  await expect(page.locator('.chat-conversation')).toHaveCount(0);
});
