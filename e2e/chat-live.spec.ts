import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';

// Only a disposable local Java e2e DB + scripted Python QA server may be used.
const fixturePath = process.env.CATCHHOLE_CHAT_LIVE_FIXTURE;
test('실제 Front–Spring–Python·PostgreSQL 후속 질문은 수정된 설정을 다시 조회한다', async ({
  page,
  request,
}, testInfo) => {
  test.skip(!fixturePath, '격리한 로컬 서버와 명시적 fixture가 필요합니다.');
  const base = process.env.VITE_API_BASE_URL ?? '';
  expect(new URL(base).hostname).toMatch(/^(localhost|127\.0\.0\.1)$/);
  const fixture = JSON.parse(readFileSync(fixturePath!, 'utf8'));
  const { token, workId, setting } = fixture;
  const headers = { Authorization: `Bearer ${token}` };
  const current = await request.get(
    `${base}/api/v1/works/${workId}/world-settings/${setting.id}`,
    { headers },
  );
  expect(current.ok()).toBe(true);
  const reset = await request.patch(
    `${base}/api/v1/works/${workId}/world-settings/${setting.id}/properties`,
    {
      headers,
      data: {
        currentScopeName: null,
        currentSettingName: '소모 마력',
        scopeName: null,
        settingName: '소모 마력',
        settingValue: '35',
        version: (await current.json()).data.version,
      },
    },
  );
  expect(reset.ok()).toBe(true);
  const startingVersion = (await reset.json()).data.version;
  await page.goto('/login');
  await page.evaluate(
    (value) => localStorage.setItem('accessToken', value),
    token,
  );
  await page.goto(`/chat?workId=${workId}`);
  await page.getByRole('button', { name: '대화 시작', exact: true }).click();
  await expect(page).toHaveURL(/sessionId=/);
  const sessionId = new URL(page.url()).searchParams.get('sessionId');
  expect(sessionId).toBeTruthy();
  try {
    const input = page.getByRole('textbox', { name: '질문', exact: true });
    await page.getByText('근거를 찾을 출처 회차 범위', { exact: true }).click();
    await page.getByRole('spinbutton', { name: '시작 회차' }).fill('1');
    await page.getByRole('spinbutton', { name: '마지막 회차' }).fill('1');
    await input.fill('화염술의 소모 마력은?');
    await page.getByRole('button', { name: '보내기', exact: true }).click();
    await expect(page.locator('.chat-answer').first()).toContainText('35', {
      timeout: 20_000,
    });
    await expect(
      page.getByRole('spinbutton', { name: '시작 회차' }),
    ).toHaveValue('');
    await expect(
      page.getByRole('spinbutton', { name: '마지막 회차' }),
    ).toHaveValue('');
    const changed = await request.patch(
      `${base}/api/v1/works/${workId}/world-settings/${setting.id}/properties`,
      {
        headers,
        data: {
          currentScopeName: null,
          currentSettingName: '소모 마력',
          scopeName: null,
          settingName: '소모 마력',
          settingValue: '42',
          version: startingVersion,
        },
      },
    );
    expect(changed.ok(), await changed.text()).toBe(true);
    await input.fill('그 마법의 소모 마력은?');
    await page.getByRole('button', { name: '보내기', exact: true }).click();
    await expect(page.locator('.chat-answer').nth(1)).toContainText('42', {
      timeout: 20_000,
    });
    await page.reload();
    await expect(page.locator('.chat-turn')).toHaveCount(2);
    await expect(page.locator('.chat-answer').nth(1)).toContainText('42');
    await input.fill('아리아가 반지를 버린 장면은?');
    await page.getByRole('button', { name: '보내기', exact: true }).click();
    await expect(page.locator('.chat-answer').nth(2)).toContainText('강물', {
      timeout: 20_000,
    });
    await page
      .getByRole('button', { name: /^답변 근거 \d+개 모두 보기$/ })
      .last()
      .click();
    await expect(page.getByRole('dialog')).toContainText(
      '추적을 피하려고 반지를 강물에 던졌다.',
    );
    await expect(
      page.getByRole('link', { name: /\d+화 원문 보기/ }),
    ).toHaveAttribute(
      'href',
      `/editor?workId=${workId}&episodeId=${fixture.episodeId}`,
    );
    await page.keyboard.press('Escape');
    await expect(page.locator('.app-route-layer').last()).toHaveCSS(
      'opacity',
      '1',
    );
    await page.screenshot({
      path: testInfo.outputPath('chat-live-desktop.png'),
    });
    await page.setViewportSize({ width: 320, height: 568 });
    await expect(input).toBeInViewport();
    await page.screenshot({
      path: testInfo.outputPath('chat-live-mobile.png'),
    });
    await page.getByRole('button', { name: '대화 종료', exact: true }).click();
    await expect(page.locator('.chat-turn')).toHaveCount(0);
    const closed = await request.get(
      `${base}/api/v1/works/${workId}/chat-sessions/${sessionId}/messages`,
      { headers },
    );
    expect(closed.status()).toBe(410);
  } finally {
    await request.delete(
      `${base}/api/v1/works/${workId}/chat-sessions/${sessionId}`,
      { headers },
    );
  }
});
