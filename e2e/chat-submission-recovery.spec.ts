import { test, expect, type Page, type Route } from '@playwright/test';
import type { ChatMessageV1 } from '../src/app/api/generated/types.gen';

const workId = '11111111-1111-4111-8111-111111111111';
const roomId = '22222222-2222-4222-8222-222222222222';
const otherRoomId = '22222222-2222-4222-8222-222222222223';
const id = (n: number) => `33333333-3333-4333-8333-${String(n).padStart(12, '0')}`;
const ok = (route: Route, data: unknown) => route.fulfill({ json: { success: true, data } });

function message(sequence: number): ChatMessageV1 {
  return {
    questionId: id(sequence), sequence, question: `합성 질문 ${sequence}`,
    execution: {
      questionId: id(sequence), attemptId: id(sequence), state: 'SUCCEEDED',
      result: { outcome: 'ANSWER', text: `합성 답변 ${sequence}`, sources: [], limitations: [] },
    },
  };
}

async function fixture(page: Page, count = 20, quota = false, acknowledgeExisting = false, holdInitialList = false) {
  const state = {
    rows: Array.from({ length: count }, (_, i) => message(i + 1)),
    posts: 0, failures: 0, recoveredReads: 0, allowRecovery: false,
    messagePages: [] as number[], pendingLookups: 0,
    listReads: 0, listFailure: false, holdNextList: holdInitialList, heldList: false, cancelledLists: 0,
    releaseList: async () => {},
  };
  if (quota && count) state.rows[0].execution = {
    questionId: id(1), attemptId: id(1), state: 'FAILED', failure: 'PROVIDER_FAILURE',
  };
  const session = (selected: string) => ({
    id: selected, workId, busy: false,
    createdAt: selected === roomId ? '2026-10-15T10:00:00' : '2026-10-15T11:00:00',
    expiresAt: new Date(Date.now() + 7_200_000).toISOString(),
    questionCount: selected === roomId ? state.rows.length : 0,
  });
  await page.addInitScript(() => {
    localStorage.setItem('accessToken', 'synthetic-chat-recovery-token');
    const observation = { notices: 0 };
    Object.assign(window, { chatRecoveryObservation: observation });
    window.addEventListener('catchhole:ai-token-quota-exhausted', () => observation.notices++);
  });
  page.on('requestfailed', request => {
    if (new URL(request.url()).pathname.endsWith('/chat-sessions')) state.cancelledLists++;
  });
  await page.route('**/api/v1/**', async route => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname;
    if (path.endsWith('/auth/me')) return ok(route, {
      id: 1, email: 'recovery@example.invalid', displayName: '작가', role: 'AUTHOR', status: 'ACTIVE',
    });
    if (path === '/api/v1/works') return ok(route, [{
      id: workId, title: '합성 접수 복구 검증', genre: '판타지', latestEpisodeNo: 40, lifecycleStatus: 'ACTIVE',
    }]);
    if (path.endsWith('/extension-requests/me/pending')) {
      state.pendingLookups++;
      return ok(route, { pending: false });
    }
    if (path.endsWith('/ai-token-usages/me')) return ok(route, {
      availableTokens: 0, grantedTokens: 4000000, usedTokens: 4000000, reservedTokens: 0,
    });
    if (request.method() === 'POST' && (path.endsWith('/chat-questions') || path.endsWith('/retry'))) {
      state.posts++;
      if (quota) return route.fulfill({ status: 409, json: {
        success: false, error: { code: 'AI_TOKEN_QUOTA_EXHAUSTED', status: 409, message: 'AI 사용량이 부족합니다.' },
      } });
      if (acknowledgeExisting) return ok(route, state.rows.at(-1)?.execution);
      const accepted = message(state.rows.length + 1);
      accepted.question = request.postDataJSON().question;
      state.rows.push(accepted);
      return ok(route, accepted.execution);
    }
    if (path.endsWith('/chat-sessions')) {
      state.listReads++;
      const data = { content: [session(roomId), session(otherRoomId)], totalElements: 2 };
      if (state.holdNextList) {
        state.holdNextList = false;
        state.heldList = true;
        await new Promise<void>(resolve => {
          state.releaseList = async () => {
            await ok(route, data).catch(() => {});
            resolve();
          };
        });
        return;
      }
      if (state.listFailure) return route.fulfill({ status: 503, json: {
        success: false, error: { code: 'TEMPORARY_UNAVAILABLE', status: 503 },
      } });
      return ok(route, data);
    }
    if (path.includes('/chat-sessions/')) {
      const selected = path.includes(otherRoomId) ? otherRoomId : roomId;
      if (path.endsWith('/messages')) {
        const index = Number(url.searchParams.get('page'));
        if (selected === roomId) state.messagePages.push(index);
        const rows = selected === roomId ? state.rows : [];
        return ok(route, {
          content: rows.slice(index * 20, (index + 1) * 20), page: index, size: 20,
          totalElements: rows.length, hasNext: (index + 1) * 20 < rows.length,
        });
      }
      if (selected === roomId && state.posts && !quota) {
        if (!state.allowRecovery) {
          state.failures++;
          return route.fulfill({ status: 503, json: {
            success: false, error: { code: 'TEMPORARY_UNAVAILABLE', status: 503 },
          } });
        }
        state.recoveredReads++;
      }
      return ok(route, session(selected));
    }
    return ok(route, []);
  });
  await page.goto(`/chat?workId=${workId}&sessionId=${roomId}&messagePage=1`);
  await expect(page.getByRole('textbox', { name: '질문', exact: true })).toBeEnabled();
  return state;
}

async function submit(page: Page, sequence: number) {
  await page.getByRole('textbox', { name: '질문', exact: true }).fill(`새 질문 ${sequence}`);
  await page.getByRole('button', { name: '보내기', exact: true }).click();
  await expect(page.getByRole('button', { name: '다시 확인', exact: true })).toBeVisible();
}

test('20→21 접수 뒤 count 조회 실패가 회복되면 새 질문을 한 번만 표시하고 재전송하지 않는다', async ({ page }) => {
  const state = await fixture(page);
  await submit(page, 21);
  expect(state.posts).toBe(1);
  expect(state.failures).toBeGreaterThan(0);
  await expect(page.getByRole('textbox', { name: '질문', exact: true })).toHaveValue('');
  await expect(page.getByText(/전송 여부를 확인하려면/)).toHaveCount(0);
  state.allowRecovery = true;
  await expect(page).toHaveURL(/messagePage=2/);
  await expect(page.getByText('새 질문 21', { exact: true })).toBeVisible();
  await expect(page.getByText('합성 답변 21', { exact: true })).toBeVisible();
  await expect.poll(() => state.recoveredReads).toBeGreaterThan(1);
  expect(state.posts).toBe(1);
});

test('복구 후 이전 페이지와 수동 스크롤은 일반 polling에 끌려가지 않는다', async ({ page }) => {
  const state = await fixture(page);
  await submit(page, 21);
  state.allowRecovery = true;
  await expect(page).toHaveURL(/messagePage=2/);
  await expect(page.getByText('합성 답변 21', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: '이전', exact: true }).click();
  await expect(page.getByText('합성 답변 20', { exact: true })).toBeVisible();
  const scroller = page.locator('.chat-messages');
  // URL changes before the page's initial anchor effect finishes. Start the
  // user's scroll only after that navigation has settled.
  await expect.poll(() => scroller.evaluate(element => element.scrollTop)).toBeGreaterThan(1000);
  await scroller.evaluate(element => { element.scrollTop = 100; });
  expect(await scroller.evaluate(element => element.scrollTop)).toBe(100);
  const reads = state.messagePages.length;
  await expect.poll(() => state.messagePages.length).toBeGreaterThan(reads + 1);
  await expect(page).toHaveURL(/messagePage=1/);
  expect(await scroller.evaluate(element => element.scrollTop)).toBeCloseTo(100, 0);
  expect(state.posts).toBe(1);
});

for (const failFirst of [false, true]) {
  test(`질문 수가 같은 멱등 접수는 ${failFirst ? '조회 실패 회복' : '정상 재조회'} 후에도 해당 질문으로 이동한다`, async ({ page }) => {
    const state = await fixture(page, 20, false, true);
    const scroller = page.locator('.chat-messages');
    await expect.poll(() => scroller.evaluate(element => element.scrollTop)).toBeGreaterThan(1000);
    await scroller.evaluate(element => { element.scrollTop = 0; });
    if (failFirst) {
      await submit(page, 20);
      state.allowRecovery = true;
    } else {
      state.allowRecovery = true;
      await page.getByRole('textbox', { name: '질문', exact: true }).fill('접수 확인 질문');
      await page.getByRole('button', { name: '보내기', exact: true }).click();
    }
    await expect.poll(() => state.recoveredReads).toBeGreaterThan(0);
    await expect(page.getByText('합성 답변 20', { exact: true })).toBeVisible();
    await expect.poll(() => scroller.evaluate(element => element.scrollTop)).toBeGreaterThan(1000);
    await expect(page).toHaveURL(/messagePage=1/);
    expect(state.posts).toBe(1);
    expect(state.rows).toHaveLength(20);
  });
}

test('조회 복구 전 사용자가 뒤로 이전 페이지를 선택하면 접수 후 자동 이동을 취소한다', async ({ page }) => {
  const state = await fixture(page, 40);
  await page.getByRole('button', { name: '다음', exact: true }).click();
  await expect(page).toHaveURL(/messagePage=2/);
  await submit(page, 41);
  await page.goBack();
  await expect(page).toHaveURL(/messagePage=1/);
  state.allowRecovery = true;
  await expect.poll(() => state.recoveredReads).toBeGreaterThan(1);
  await expect(page.getByText('합성 답변 20', { exact: true })).toBeVisible();
  await expect(page).toHaveURL(/messagePage=1/);
  expect(state.posts).toBe(1);
  expect(state.messagePages).not.toContain(2);
});

test('조회 복구 전 다른 방을 선택하면 이전 방의 접수 후 자동 이동을 폐기한다', async ({ page }) => {
  const state = await fixture(page);
  await submit(page, 21);
  await page.locator('.chat-room').nth(1).click();
  await expect(page).toHaveURL(new RegExp(otherRoomId));
  state.allowRecovery = true;
  await expect(page.getByText('첫 질문을 보내 보세요. 후속 질문도 이어서 할 수 있어요.')).toBeVisible();
  await page.goBack();
  await expect.poll(() => state.recoveredReads).toBeGreaterThan(1);
  await expect(page).toHaveURL(/messagePage=1/);
  expect(state.messagePages).not.toContain(1);
  expect(state.posts).toBe(1);
});

for (const failSessionFirst of [false, true]) {
  test(`20→21 접수 직후 방을 왕복해도 최신 답변을 연다: 상세 조회 ${failSessionFirst ? '실패 후 회복' : '성공'}`, async ({ page }) => {
    const state = await fixture(page);
    state.allowRecovery = !failSessionFirst;
    await page.getByRole('textbox', { name: '질문', exact: true }).fill('새 질문 21');
    await page.getByRole('button', { name: '보내기', exact: true }).click();
    await expect(page.locator('.chat-room').first()).toContainText('21개 질문');
    expect(state.listReads).toBeGreaterThan(1);
    state.allowRecovery = true;
    await expect(page.getByText('합성 답변 21', { exact: true })).toBeVisible();
    await page.locator('.chat-room').nth(1).click();
    await expect(page).toHaveURL(new RegExp(otherRoomId));
    await page.locator('.chat-room').first().click();
    await expect(page).toHaveURL(/messagePage=2/);
    await expect(page.getByText('합성 답변 21', { exact: true })).toBeVisible();
    expect(state.posts).toBe(1);
  });
}

test('접수 전 시작한 목록의 늦은 응답은 확인된 새 질문 수를 덮어쓰지 않는다', async ({ page }) => {
  const state = await fixture(page);
  state.allowRecovery = true;
  state.holdNextList = true;
  await page.evaluate(() => window.dispatchEvent(new Event('visibilitychange')));
  await expect.poll(() => state.heldList).toBe(true);
  await page.getByRole('textbox', { name: '질문', exact: true }).fill('새 질문 21');
  await page.getByRole('button', { name: '보내기', exact: true }).click();
  await expect(page.getByText('합성 답변 21', { exact: true })).toBeVisible();
  await expect.poll(() => state.cancelledLists).toBeGreaterThan(0);
  await state.releaseList();
  await expect(page.locator('.chat-room').first()).toContainText('21개 질문');
  await page.locator('.chat-room').nth(1).click();
  await page.locator('.chat-room').first().click();
  await expect(page).toHaveURL(/messagePage=2/);
  await expect(page.getByText('합성 답변 21', { exact: true })).toBeVisible();
  expect(state.posts).toBe(1);
});

test('첫 방 목록 조회가 끝나기 전에 접수해도 초기 요청을 취소하고 새 질문 수를 받는다', async ({ page }) => {
  const state = await fixture(page, 20, false, false, true);
  await expect.poll(() => state.heldList).toBe(true);
  state.allowRecovery = true;
  await page.getByRole('textbox', { name: '질문', exact: true }).fill('새 질문 21');
  await page.getByRole('button', { name: '보내기', exact: true }).click();
  await expect(page.getByText('합성 답변 21', { exact: true })).toBeVisible();
  await expect.poll(() => state.cancelledLists).toBeGreaterThan(0);
  await state.releaseList();
  await expect(page.locator('.chat-room').first()).toContainText('21개 질문');
  await page.locator('.chat-room').nth(1).click();
  await page.locator('.chat-room').first().click();
  await expect(page).toHaveURL(/messagePage=2/);
  await expect(page.getByText('합성 답변 21', { exact: true })).toBeVisible();
  expect(state.posts).toBe(1);
});

test('목록 재검증 실패도 접수를 되돌리지 않고 상세에서 확인한 질문 수를 보존한다', async ({ page }) => {
  const state = await fixture(page);
  state.allowRecovery = true;
  state.listFailure = true;
  await page.getByRole('textbox', { name: '질문', exact: true }).fill('새 질문 21');
  await page.getByRole('button', { name: '보내기', exact: true }).click();
  await expect(page.getByText('합성 답변 21', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: '목록 다시 확인', exact: true })).toBeVisible();
  const cachedCount = await page.evaluate(async sessionId => {
    const module = '/src/app/lib/query-client.ts';
    const { queryClient } = await import(module);
    const queries = queryClient.getQueryCache().getAll();
    const list = queries.find((query: { queryKey: Array<{ _id?: string }> }) => query.queryKey[0]?._id === 'listChatSessions');
    return list?.state.data?.data?.content?.find((room: { id: string }) => room.id === sessionId)?.questionCount;
  }, roomId);
  expect(cachedCount).toBe(21);
  await expect(page.getByRole('textbox', { name: '질문', exact: true })).toHaveValue('');
  await expect(page.getByText(/전송 여부를 확인하려면/)).toHaveCount(0);
  state.listFailure = false;
  await page.getByRole('button', { name: '목록 다시 확인', exact: true }).click();
  await expect(page.locator('.chat-room').first()).toContainText('21개 질문');
  expect(state.posts).toBe(1);
});

test('같은 페이지의 연속 질문 뒤에도 한 번 뒤로가면 이전 화면으로 돌아간다', async ({ page }) => {
  const state = await fixture(page, 1);
  state.allowRecovery = true;
  await page.goto('/works');
  await page.goto(`/chat?workId=${workId}&sessionId=${roomId}&messagePage=1`);
  const input = page.getByRole('textbox', { name: '질문', exact: true });
  await expect(input).toBeEnabled();
  const before = await page.evaluate(() => history.length);
  for (const n of [2, 3, 4]) {
    await input.fill(`새 질문 ${n}`);
    await page.getByRole('button', { name: '보내기', exact: true }).click();
    await expect(page.getByText(`합성 답변 ${n}`, { exact: true })).toBeVisible();
    await expect(input).toHaveValue('');
  }
  expect(await page.evaluate(() => history.length)).toBe(before);
  await page.goBack();
  await expect(page).toHaveURL('/works');
  expect(state.posts).toBe(3);
});

for (const action of ['submit', 'retry'] as const) {
  test(`동기 ${action} 사용량 부족은 공통 fetch에서 모달 이벤트를 한 번만 보낸다`, async ({ page }) => {
    const state = await fixture(page, action === 'submit' ? 0 : 1, true);
    if (action === 'submit') {
      await page.getByRole('textbox', { name: '질문', exact: true }).fill('사용량 부족 합성 질문');
      await page.getByRole('button', { name: '보내기', exact: true }).click();
    } else {
      await page.getByRole('button', { name: '다시 시도', exact: true }).click();
    }
    await expect(page.getByRole('button', { name: '사용량 안내 닫기' })).toBeVisible();
    await expect.poll(() => state.pendingLookups).toBe(1);
    const notices = await page.evaluate(() =>
      (window as unknown as { chatRecoveryObservation: { notices: number } }).chatRecoveryObservation.notices);
    expect(notices).toBe(1);
    expect(state.posts).toBe(1);
  });
}
