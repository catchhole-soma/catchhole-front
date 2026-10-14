import { test, expect, type Page, type Route } from '@playwright/test';
import type { ChatResultV1 } from '../src/app/api/generated/types.gen';
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
  options: {
    lost?: boolean;
    waiting?: boolean;
    failed?: boolean;
    settling?: boolean;
    result?: Partial<ChatResultV1>;
  } = {},
) {
  const state = {
    created: false,
    closed: false,
    submitted: false,
    keys: [] as string[],
    texts: [] as string[],
    bodies: [] as Array<{
      question: string;
      episodeFrom?: number;
      episodeTo?: number;
    }>,
    complete: !options.waiting,
    failed: !!options.failed,
    retries: 0,
    settling: !!options.settling,
  };
  const result: ChatResultV1 = {
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
    ...options.result,
  };
  const execution = () => ({
    questionId: question,
    attemptId: question,
    state: state.failed
      ? 'FAILED'
      : state.settling
        ? 'SETTLEMENT_PENDING'
        : state.complete
          ? 'SUCCEEDED'
          : 'RUNNING',
    failure: state.failed ? 'PROVIDER_FAILURE' : null,
    result: state.complete && !state.failed ? result : null,
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
      state.bodies.push(req.postDataJSON());
      state.submitted = true;
      if (options.lost && state.keys.length === 1) return route.abort('failed');
      return success(route, execution());
    }
    if (path.endsWith('/retry') && req.method() === 'POST') {
      expect(req.postDataJSON().previousAttemptId).toBe(question);
      state.failed = false;
      state.complete = true;
      state.retries++;
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
  return Object.assign(state, { result });
}

for (const width of [1280, 320]) {
  test(`${width}px 답변 안내는 펼침·접힘에서 모든 다른 문장을 보존한다`, async ({ page }) => {
    await page.setViewportSize({ width, height: 800 });
    const limitations = [
      '일부 기록만 확인했습니다.',
      '인용 원문을 확인하지 못했습니다.',
      '일부 기록만 확인했습니다.',
      '최근 대화 일부만 참고했습니다.',
      'R2 [ADD]와 A_B의 연결 근거를 확인하지 못했습니다.',
    ];
    const uniqueNotes = [...new Set(limitations)];
    const text = 'R2 [ADD]는 작품에 등록된 장비 이름입니다.\n설정값은 A_B입니다.';
    await fixture(page, { result: { text, limitations } });
    await page.getByRole('textbox', { name: '질문', exact: true }).fill('장비 이름은?');
    await page.getByRole('button', { name: '보내기', exact: true }).click();
    const notes = page.getByRole('complementary', { name: '답변에서 확인할 점' });
    const toggle = notes.getByRole('button', { name: '답변에서 확인할 점 4가지 펼치기' });
    const list = notes.locator('ul');
    await expect(toggle).toBeVisible();
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await expect(toggle).toHaveAttribute('aria-controls', await list.getAttribute('id') as string);
    await expect(list).toBeHidden();
    await expect(list.locator('li')).toHaveText(uniqueNotes);
    await toggle.focus();
    await page.keyboard.press('Enter');
    const expandedToggle = notes.getByRole('button', { name: '답변에서 확인할 점 4가지 접기' });
    await expect(expandedToggle).toBeFocused();
    await expect(expandedToggle).toHaveAttribute('aria-expanded', 'true');
    await expect(notes.getByRole('listitem')).toHaveCount(uniqueNotes.length);
    for (const note of uniqueNotes) {
      await expect(notes.getByText(note, { exact: true })).toBeVisible();
    }
    await expect(page.locator('.chat-answer > p')).toHaveText(text);
    const bounds = await expandedToggle.boundingBox();
    expect(bounds?.height).toBeGreaterThanOrEqual(44);
    const overflows = await notes.evaluate((element) => element.scrollWidth > element.clientWidth);
    expect(overflows).toBe(false);
    await page.keyboard.press('Space');
    await expect(toggle).toBeFocused();
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await expect(list).toBeHidden();
    await expect(list.locator('li')).toHaveText(uniqueNotes);
    await toggle.click();
    await expect(list).toBeVisible();
    await expect(list.locator('li')).toHaveText(uniqueNotes);
    await expect(page.locator('.chat-answer > p')).toHaveText(text);
    const contrast = await notes.evaluate((element) => {
      const color = getComputedStyle(element).color;
      const channels = color.match(/[\d.]+/g)!.slice(0, 3).map(Number).map((value) => {
        const channel = value / 255;
        return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
      });
      const luminance = channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
      return 1.05 / (luminance + 0.05);
    });
    expect(contrast).toBeGreaterThanOrEqual(4.5);
  });
}

test('서로 다른 안내가 하나면 펼침 없이 원문을 표시한다', async ({ page }) => {
  const note = 'R2 [ADD]와 A_B의 원문을 확인하지 못했습니다.';
  await fixture(page, { result: { limitations: [note, note] } });
  await page.getByRole('textbox', { name: '질문', exact: true }).fill('장비 이름은?');
  await page.getByRole('button', { name: '보내기', exact: true }).click();
  const notes = page.getByRole('complementary', { name: '답변에서 확인할 점' });
  await expect(notes.getByText(note, { exact: true })).toBeVisible();
  await expect(notes.getByRole('button')).toHaveCount(0);
  await expect(notes.locator('p')).toHaveCount(1);
});

test('안내가 없으면 답변 안내 영역을 만들지 않는다', async ({ page }) => {
  await fixture(page, { result: { limitations: [] } });
  await page.getByRole('textbox', { name: '질문', exact: true }).fill('장비 이름은?');
  await page.getByRole('button', { name: '보내기', exact: true }).click();
  await expect(page.getByText('아리아의 현재 능력은 화염구입니다.', { exact: true })).toBeVisible();
  await expect(page.getByRole('complementary', { name: '답변에서 확인할 점' })).toHaveCount(0);
});

test('직접 근거 하나를 읽지 못해도 성공한 직접 근거와 검색 인용을 함께 표시한다', async ({ page }) => {
  const unavailable = '44444444-4444-4444-8444-444444444444';
  await fixture(page, {
    result: {
      sources: [
        { tool: 'WORLD_EVIDENCE', targetId: unavailable },
        { tool: 'CHARACTER_EVIDENCE', targetId: question },
      ],
    },
  });
  await page.route('**/setting-tools/queries', (route) => {
    if (route.request().postDataJSON().targetId === unavailable) {
      return route.fulfill({ status: 503, body: 'unavailable' });
    }
    return success(route, {
      items: { content: [{
        id: question,
        subjectName: '아리아',
        displayName: '화염구',
        evidence: {
          status: 'AVAILABLE',
          sourceEpisodeNo: 3,
          quotes: [{ text: '그녀의 손끝에서 화염구가 피어올랐다.' }],
        },
      }] },
    });
  });
  await page.getByRole('textbox', { name: '질문', exact: true }).fill('능력의 근거는?');
  await page.getByRole('button', { name: '보내기', exact: true }).click();
  await page.getByRole('button', { name: '근거 확인', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByRole('alert')).toContainText('직접 근거 1건을 확인하지 못했어요.');
  await expect(dialog).toContainText('아리아는 화염구를 배웠다.');
  await expect(dialog).toContainText('그녀의 손끝에서 화염구가 피어올랐다.');
  await expect(dialog.getByRole('blockquote')).toHaveCount(2);
  await expect(dialog.locator('article h3')).toHaveText([
    '근거 2 · 아리아 · 화염구',
    '근거 3 · 2화 · 원문 검색 인용',
  ]);
});

for (const changed of ['failed', 'attempt'] as const) {
  test(`근거 조회 후 질문 재검증이 ${changed}이면 이전 인용을 표시하지 않는다`, async ({ page }) => {
    const state = await fixture(page);
    let reads = 0;
    await page.route(`**/chat-questions/${question}`, (route) => {
      reads++;
      if (reads > 1 && changed === 'failed') {
        return route.fulfill({ status: 410, body: 'unavailable' });
      }
      return success(route, {
        questionId: question,
        attemptId: reads > 1 ? room : question,
        state: 'SUCCEEDED',
        result: state.result,
      });
    });
    await page.getByRole('textbox', { name: '질문', exact: true }).fill('근거는?');
    await page.getByRole('button', { name: '보내기', exact: true }).click();
    await page.getByRole('button', { name: '근거 확인', exact: true }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog.getByRole('alert')).toContainText('현재 원문과 대화를 확인하지 못했습니다.');
    await expect(dialog.getByRole('blockquote')).toHaveCount(0);
  });
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
  await page.getByText('근거를 찾을 출처 회차 범위', { exact: true }).click();
  await page.getByRole('spinbutton', { name: '시작 회차' }).fill('3');
  await page.getByRole('spinbutton', { name: '마지막 회차' }).fill('5');
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
  await expect(page.getByRole('spinbutton', { name: '시작 회차' })).toHaveValue(
    '3',
  );
  await expect(
    page.getByRole('spinbutton', { name: '마지막 회차' }),
  ).toHaveValue('5');
  await page.getByRole('button', { name: '접수 확인', exact: true }).click();
  await expect(
    page.getByRole('textbox', { name: '질문', exact: true }),
  ).toHaveValue('');
  expect(state.keys).toHaveLength(2);
  expect(new Set(state.keys).size).toBe(1);
  expect(state.bodies[1]).toEqual(state.bodies[0]);
  await expect(page.getByRole('spinbutton', { name: '시작 회차' })).toHaveValue(
    '',
  );
  await expect(
    page.getByRole('spinbutton', { name: '마지막 회차' }),
  ).toHaveValue('');
});

test('접수된 질문의 회차 범위는 다음 질문에 계승하지 않는다', async ({
  page,
}) => {
  const state = await fixture(page);
  await page.getByText('근거를 찾을 출처 회차 범위', { exact: true }).click();
  await page.getByRole('spinbutton', { name: '시작 회차' }).fill('3');
  await page.getByRole('spinbutton', { name: '마지막 회차' }).fill('5');
  const input = page.getByRole('textbox', { name: '질문', exact: true });
  await input.fill('아리아의 마력 변경 이력은?');
  await page.getByRole('button', { name: '보내기', exact: true }).click();
  await expect(input).toHaveValue('');
  expect(state.bodies[0]).toMatchObject({ episodeFrom: 3, episodeTo: 5 });
  await expect(page.getByRole('spinbutton', { name: '시작 회차' })).toHaveValue(
    '',
  );
  await expect(
    page.getByRole('spinbutton', { name: '마지막 회차' }),
  ).toHaveValue('');
  await input.fill('그 인물의 전체 마력 변경 이력은?');
  await page.getByRole('button', { name: '보내기', exact: true }).click();
  await expect.poll(() => state.bodies.length).toBe(2);
  expect(state.bodies[1]).not.toHaveProperty('episodeFrom');
  expect(state.bodies[1]).not.toHaveProperty('episodeTo');
});

test('답변이 보여도 정산 완료 전에는 다음 질문을 전송하지 않는다', async ({
  page,
}) => {
  const state = await fixture(page, { settling: true });
  const input = page.getByRole('textbox', { name: '질문', exact: true });
  await input.fill('아리아의 능력은?');
  await page.getByRole('button', { name: '보내기', exact: true }).click();
  await expect(page.locator('.chat-answer')).toContainText('화염구');
  await input.fill('그건 언제 얻었어?');
  await expect(
    page.getByRole('button', { name: '보내기', exact: true }),
  ).toBeDisabled();
  await input.press('Enter');
  expect(state.keys).toHaveLength(1);
  state.settling = false;
  await expect(
    page.getByRole('button', { name: '보내기', exact: true }),
  ).toBeEnabled();
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

for (const width of [1280, 320]) {
  test(`실패 질문의 명시적 재시도와 근거 확인 (${width}px)`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: width === 320 ? 568 : 800 });
    const state = await fixture(page, { failed: true });
    await page
      .getByRole('textbox', { name: '질문', exact: true })
      .fill('아리아의 능력은?');
    await page.getByRole('button', { name: '보내기', exact: true }).click();
    const retry = page.getByRole('button', { name: '다시 시도', exact: true });
    await expect(retry).toBeVisible();
    expect(state.retries).toBe(0);
    await retry.click();
    await expect(
      page.getByText('아리아의 현재 능력은 화염구입니다.', { exact: true }),
    ).toBeVisible();
    expect(state.retries).toBe(1);
    await expect(page.locator('.chat-turn')).toHaveCount(1);
    await page.getByRole('button', { name: '근거 확인', exact: true }).click();
    await expect(page.getByRole('dialog')).toContainText(
      '아리아는 화염구를 배웠다.',
    );
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).toHaveCount(0);
  });
}
