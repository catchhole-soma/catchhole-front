import { test, expect, type Page, type Route } from '@playwright/test';
import type { ChatMessageV1, ChatSessionV1 } from '../src/app/api/generated/types.gen';

const work = '11111111-1111-4111-8111-111111111111';
const room = '22222222-2222-4222-8222-222222222222';
const otherRoom = '22222222-2222-4222-8222-222222222223';
const id = (n: number) => `33333333-3333-4333-8333-${String(n).padStart(12, '0')}`;
const answer = { outcome: 'ANSWER' as const, text: '확인한 합성 답변이에요.', sources: [], limitations: [] };

function message(n: number): ChatMessageV1 {
  return {
    questionId: id(n), sequence: n, question: `합성 질문 ${n}`,
    execution: { questionId: id(n), attemptId: id(n), state: 'SUCCEEDED', result: answer },
  };
}

async function fixture(page: Page, rows: ChatMessageV1[], busy = false, initialPage = 0) {
  const state = { rows, busy, messageReads: 0, submissions: 0, retries: 0, nextAttempt: 100 };
  const session = (selected: string): ChatSessionV1 => ({
    id: selected, workId: work,
    createdAt: selected === room ? '2026-10-15T10:00:00' : '2026-10-15T11:00:00',
    expiresAt: new Date(Date.now() + 7200000).toISOString(),
    questionCount: selected === room ? state.rows.length : 0,
    busy: selected === room && state.busy,
  });
  const success = (route: Route, data: unknown) => route.fulfill({
    status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data }),
  });
  const quotaFailure = (row: ChatMessageV1) => ({
    questionId: row.questionId, attemptId: id(state.nextAttempt++),
    state: 'FAILED' as const, failure: 'QUOTA_EXHAUSTED' as const,
  });
  await page.addInitScript(() => {
    const observation = { notices: 0 };
    Object.assign(window, { chatQuotaObservation: observation });
    window.addEventListener('catchhole:ai-token-quota-exhausted', () => observation.notices++);
  });
  await page.route('**/api/v1/**', route => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname;
    if (path.endsWith('/auth/me')) return success(route, {
      id: 1, email: 'chat-state@example.invalid', displayName: '작가', role: 'AUTHOR', status: 'ACTIVE',
    });
    if (path === '/api/v1/works') return success(route, [{
      id: work, title: '합성 대화 상태 검증', genre: '판타지', latestEpisodeNo: 1, lifecycleStatus: 'ACTIVE',
    }]);
    if (path.endsWith('/chat-sessions')) return success(route, {
      content: [session(room), session(otherRoom)], totalElements: 2, hasNext: false,
    });
    if (path.includes('/chat-sessions/')) {
      const selected = path.includes(otherRoom) ? otherRoom : room;
      if (path.endsWith('/messages')) {
        state.messageReads++;
        const index = Number(url.searchParams.get('page') ?? 0);
        const content = selected === room ? state.rows.slice(index * 20, (index + 1) * 20) : [];
        return success(route, {
          content, page: index, size: 20, totalElements: selected === room ? state.rows.length : 0,
          hasNext: selected === room && (index + 1) * 20 < state.rows.length,
        });
      }
      return success(route, session(selected));
    }
    if (path.endsWith('/chat-questions') && request.method() === 'POST') {
      state.submissions++;
      const next = message(state.rows.length + 1);
      next.question = request.postDataJSON().question;
      next.execution = quotaFailure(next);
      state.rows.push(next);
      return success(route, next.execution);
    }
    if (path.endsWith('/retry') && request.method() === 'POST') {
      state.retries++;
      const target = state.rows.find(row => path.includes(row.questionId!))!;
      target.execution = quotaFailure(target);
      return success(route, target.execution);
    }
    if (path.endsWith('/pending')) return success(route, { pending: false });
    return success(route, []);
  });
  await page.goto('/login');
  await page.evaluate(() => localStorage.setItem('accessToken', 'chat-test-token'));
  await page.goto(`/chat?workId=${work}&sessionId=${room}&messagePage=${initialPage + 1}`);
  await expect(page.getByRole('textbox', { name: '질문', exact: true })).toBeEnabled();
  await expect.poll(() => state.messageReads).toBeGreaterThan(0);
  return state;
}

const notices = (page: Page) => page.evaluate(
  () => (window as unknown as { chatQuotaObservation: { notices: number } }).chatQuotaObservation.notices,
);

for (const scenario of [
  { name: '이전 페이지를 읽을 때 최신 질문 실행', active: 20, page: 0, state: 'RUNNING' as const },
  { name: '최신 페이지를 읽을 때 과거 질문 재시도', active: 0, page: 1, state: 'RUNNING' as const },
  { name: '다른 페이지 질문의 정산 대기', active: 20, page: 0, state: 'SETTLEMENT_PENDING' as const },
]) {
  test(`${scenario.name}: 세션 전체 전송과 재시도를 잠근다`, async ({ page }) => {
    const rows = Array.from({ length: 21 }, (_, i) => message(i + 1));
    rows[scenario.active].execution = {
      questionId: id(scenario.active + 1), attemptId: id(90), state: scenario.state,
    };
    if (scenario.page === 0) rows[1].execution = {
      questionId: id(2), attemptId: id(2), state: 'FAILED', failure: 'PROVIDER_FAILURE',
    };
    const state = await fixture(page, rows, true, scenario.page);
    await page.getByRole('textbox', { name: '질문', exact: true }).fill('다음 합성 질문');
    await expect(page.getByRole('button', { name: '보내기', exact: true })).toBeDisabled();
    if (scenario.page === 0) await expect(page.getByRole('button', { name: '다시 시도', exact: true })).toBeDisabled();
    await page.getByRole('textbox', { name: '질문', exact: true }).press('Enter');
    expect(state.submissions).toBe(0);
    state.busy = false;
    state.rows[scenario.active] = message(scenario.active + 1);
    await expect(page.getByRole('button', { name: '보내기', exact: true })).toBeEnabled();
    if (scenario.page === 0) await expect(page.getByRole('button', { name: '다시 시도', exact: true })).toBeEnabled();
  });
}

test('과거 사용량 실패는 대화 재진입과 새로고침에서 알림을 다시 열지 않는다', async ({ page }) => {
  const row = message(1);
  row.execution = { questionId: id(1), attemptId: id(1), state: 'FAILED', failure: 'QUOTA_EXHAUSTED' };
  const state = await fixture(page, [row]);
  await expect(page.getByText('AI 사용량이 부족합니다.', { exact: true })).toBeVisible();
  expect(await notices(page)).toBe(0);
  await page.locator('.chat-room').nth(1).click();
  await expect(page).toHaveURL(new RegExp(otherRoom));
  await page.locator('.chat-room').first().click();
  await expect(page.getByText('AI 사용량이 부족합니다.', { exact: true })).toBeVisible();
  const reads = state.messageReads;
  await expect.poll(() => state.messageReads).toBeGreaterThan(reads);
  expect(await notices(page)).toBe(0);
  await page.reload();
  await expect(page.getByText('AI 사용량이 부족합니다.', { exact: true })).toBeVisible();
  expect(await notices(page)).toBe(0);
  await expect(page.getByRole('button', { name: '사용량 안내 닫기' })).toHaveCount(0);
});

test('새 사용량 실패는 정산 대기 중 반복 조회와 재진입에도 한 번만 알린다', async ({ page }) => {
  const row = message(1);
  row.execution = { questionId: id(1), attemptId: id(1), state: 'RUNNING' };
  const state = await fixture(page, [row], true);
  await expect(page.getByText('설정과 근거를 확인하고 있어요…', { exact: true })).toBeVisible();
  state.rows[0].execution = {
    questionId: id(1), attemptId: id(1), state: 'SETTLEMENT_PENDING', failure: 'QUOTA_EXHAUSTED',
  };
  await expect.poll(() => notices(page)).toBe(1);
  await page.getByRole('button', { name: '사용량 안내 닫기' }).click();
  const reads = state.messageReads;
  await expect.poll(() => state.messageReads).toBeGreaterThan(reads + 1);
  expect(await notices(page)).toBe(1);
  await page.locator('.chat-room').nth(1).click();
  await expect(page).toHaveURL(new RegExp(otherRoom));
  await page.locator('.chat-room').first().click();
  await expect.poll(() => state.messageReads).toBeGreaterThan(reads + 2);
  expect(await notices(page)).toBe(1);
  await expect(page.getByRole('button', { name: '사용량 안내 닫기' })).toHaveCount(0);
});

for (const action of ['submit', 'retry'] as const) {
  test(`본인 ${action} 직후 빠르게 끝난 사용량 실패도 새 실행마다 한 번 알린다`, async ({ page }) => {
    const row = message(1);
    row.execution = { questionId: id(1), attemptId: id(1), state: 'FAILED', failure: 'QUOTA_EXHAUSTED' };
    const state = await fixture(page, action === 'submit' ? [] : [row]);
    if (action === 'submit') {
      await page.getByRole('textbox', { name: '질문', exact: true }).fill('새 합성 질문');
      await page.getByRole('button', { name: '보내기', exact: true }).click();
    } else {
      await page.getByRole('button', { name: '다시 시도', exact: true }).click();
    }
    await expect.poll(() => notices(page)).toBe(1);
    await page.getByRole('button', { name: '사용량 안내 닫기' }).click();
    await page.getByRole('button', { name: '다시 시도', exact: true }).click();
    await expect.poll(() => notices(page)).toBe(2);
    expect(state.retries).toBe(action === 'submit' ? 1 : 2);
    const storage = await page.evaluate(() => JSON.stringify({ localStorage, sessionStorage }));
    expect(storage).not.toContain('합성 질문');
  });
}
