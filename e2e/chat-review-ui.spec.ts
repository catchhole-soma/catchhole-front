import { expect, test, type Page, type Route } from '@playwright/test';

const workId = '11111111-1111-4111-8111-111111111111';
const roomId = '22222222-2222-4222-8222-222222222222';
const otherRoomId = '33333333-3333-4333-8333-333333333333';
const questionId = '44444444-4444-4444-8444-444444444444';

function success(route: Route, data: unknown) {
  return route.fulfill({ json: { success: true, data } });
}

async function mockChat(page: Page, otherQuestionCount = 41) {
  const messageReads: Array<{ sessionId: string; page: number }> = [];
  const sessions = [
    { id: roomId, questionCount: 1, createdAt: '2026-10-15T10:00:00' },
    { id: otherRoomId, questionCount: otherQuestionCount, createdAt: '2026-10-15T11:00:00' },
  ].map((session) => ({
    ...session,
    workId,
    busy: false,
    expiresAt: new Date(Date.now() + 7_200_000).toISOString(),
  }));
  const result = {
    outcome: 'ANSWER',
    text: '하린의 등록된 설정을 확인했어요. 근거 1',
    limitations: [],
    sources: [{ tool: 'CHARACTER_EVIDENCE', targetId: questionId }],
    retrievalSources: [],
  };
  const execution = { questionId, attemptId: questionId, state: 'SUCCEEDED', result };

  await page.addInitScript(() => localStorage.setItem('accessToken', 'chat-ui-test-token'));
  await page.route('**/api/v1/**', (route) => {
    const url = new URL(route.request().url());
    const path = url.pathname;
    if (path.endsWith('/auth/me')) return success(route, {
      id: 1, email: 'chat-ui@local.invalid', displayName: '작가', role: 'AUTHOR', status: 'ACTIVE',
    });
    if (path === '/api/v1/works') return success(route, [{
      id: workId, title: '합성 검증 작품', genre: '판타지', latestEpisodeNo: 9, lifecycleStatus: 'ACTIVE',
    }]);
    if (path.endsWith('/chat-sessions')) return success(route, {
      content: sessions, totalElements: sessions.length,
    });
    if (path.endsWith('/messages')) {
      const sessionId = path.split('/').at(-2)!;
      const pageIndex = Number(url.searchParams.get('page'));
      messageReads.push({ sessionId, page: pageIndex });
      const count = sessions.find((session) => session.id === sessionId)!.questionCount;
      return success(route, {
        content: count ? [{
          questionId, sequence: pageIndex * 20 + 1,
          question: `질문 ${pageIndex * 20 + 1}`, execution,
        }] : [],
        page: pageIndex, size: 20, totalElements: count,
        totalPages: Math.ceil(count / 20), hasNext: (pageIndex + 1) * 20 < count,
      });
    }
    if (path.includes('/chat-sessions/')) return success(route,
      sessions.find((session) => path.endsWith(session.id)),
    );
    if (path.includes('/chat-questions/')) return success(route, execution);
    if (path.endsWith('/setting-tools/queries')) return success(route, {
      items: { content: [
        {
          id: 'manual', subjectId: roomId, subjectName: '하린', displayName: '남은 횟수',
          origin: 'USER_INPUT', value: '0', evidence: { status: 'UNAVAILABLE' },
        },
        {
          id: 'history', subjectId: roomId, subjectName: '하린', displayName: '과거 칭호',
          historyOnly: true, value: '<수호자>\n긴 기록의 앞부분', valueTruncated: true,
          evidence: { status: 'UNAVAILABLE' },
        },
        {
          id: 'quoted', subjectId: roomId, subjectName: '하린', displayName: '나이', value: '20',
          evidence: {
            status: 'AVAILABLE', episodeId: questionId, sourceEpisodeNo: 9,
            quotes: [{ text: '하린은 스무 살이었다.' }],
          },
        },
      ] },
    });
    return success(route, []);
  });
  await page.goto(`/chat?workId=${workId}&sessionId=${roomId}`);
  await expect(page.getByRole('textbox', { name: '질문', exact: true })).toBeEnabled();
  return messageReads;
}

for (const width of [320, 390]) {
  test(`${width}px 작품 메뉴는 배경을 가리고 초점 순환·Escape 복귀를 제공한다`, async ({ page }) => {
    await page.setViewportSize({ width, height: 568 });
    await mockChat(page);
    const trigger = page.getByRole('button', { name: '메뉴 열기', exact: true });
    await trigger.click();
    const dialog = page.getByRole('dialog', { name: '작품 메뉴', exact: true });
    await expect(dialog).toBeVisible();
    const close = dialog.getByRole('button', { name: '메뉴 닫기', exact: true });
    await expect(close).toBeFocused();
    await expect(page.getByRole('textbox', { name: '질문', exact: true })).toHaveCount(0);
    await expect.poll(() => page.locator('.chat-page').evaluate((element) =>
      element.closest('[aria-hidden="true"]') !== null,
    )).toBe(true);

    await page.keyboard.press('Shift+Tab');
    await expect(dialog.getByRole('button', { name: process.env.VITE_RELATIONSHIP_WORKSPACE_ENABLED !== 'false' ? /^관계도$/ : /^그래프 뷰/ })).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(close).toBeFocused();
    await expect.poll(() => dialog.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);
    await page.keyboard.press('Escape');
    await expect(dialog).toHaveCount(0);
    await expect(trigger).toBeFocused();
    await expect(page.getByRole('textbox', { name: '질문', exact: true })).toBeVisible();

    await trigger.click();
    await close.click();
    await expect(dialog).toHaveCount(0);
    await expect(trigger).toBeFocused();
  });
}

for (const width of [1280, 320]) {
  test(`${width}px 원문이 없는 설정값과 생략 상태를 인용과 구분해 표시한다`, async ({ page }) => {
    await page.setViewportSize({ width, height: 800 });
    await mockChat(page);
    await page.getByRole('button', { name: '답변 근거 1개 모두 보기', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: '답변의 근거' });
    const manual = dialog.locator('.chat-evidence-detail').filter({ hasText: '남은 횟수' });
    await expect(manual).toContainText('직접 입력한 설정');
    await expect(manual.locator('dd')).toHaveText('0');
    await expect(manual.getByRole('blockquote')).toHaveCount(0);
    const history = dialog.locator('.chat-evidence-detail').filter({ hasText: '과거 칭호' });
    await expect(history).toContainText('현재값에 반영되지 않은 이력');
    await expect(history.locator('dd')).toHaveText('<수호자>\n긴 기록의 앞부분');
    await expect(history).toContainText('설정값이 길어 일부 내용이 생략됐어요.');
    await expect(history.getByRole('link', { name: '설정 보기', exact: true })).toHaveAttribute('href', /charId=/);
    const quoted = dialog.locator('.chat-evidence-detail').filter({ hasText: '하린 · 나이' });
    await expect(quoted.locator('dd')).toHaveText('20');
    await expect(quoted.getByRole('blockquote')).toHaveText('하린은 스무 살이었다.');
    await expect(quoted.getByRole('link', { name: '9화 원문 보기' })).toHaveAttribute('href', /episodeId=/);
    await expect(dialog.getByText(/설정값이 길어 일부 내용이 생략/)).toHaveCount(1);
    await expect(dialog.getByRole('blockquote')).toHaveCount(1);
    await expect.poll(() => dialog.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);
  });
}

for (const count of [0, 20, 21, 40, 41]) {
  test(`다른 방의 질문 ${count}개는 마지막 페이지로 열고 명시적 페이지는 보존한다`, async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    const reads = await mockChat(page, count);
    const expectedPage = Math.max(1, Math.ceil(count / 20));
    const selectRoom = page.locator('.chat-room').nth(1);
    await selectRoom.click();
    await expect(page).toHaveURL(new RegExp(`sessionId=${otherRoomId}&messagePage=${expectedPage}`));
    await expect.poll(() => reads.some((read) => read.sessionId === otherRoomId && read.page === expectedPage - 1)).toBe(true);
    if (count > 20) {
      await expect(page.getByText(`질문 ${(expectedPage - 1) * 20 + 1}`, { exact: true })).toBeVisible();
      await page.getByRole('button', { name: '이전', exact: true }).click();
      await expect(page).toHaveURL(new RegExp(`messagePage=${expectedPage - 1}`));
      await selectRoom.click();
      await expect(page).toHaveURL(new RegExp(`messagePage=${expectedPage - 1}`));
      await page.reload();
      await expect(page).toHaveURL(new RegExp(`messagePage=${expectedPage - 1}`));
      await expect(page.getByText(`질문 ${(expectedPage - 2) * 20 + 1}`, { exact: true })).toBeVisible();
    }
  });
}
