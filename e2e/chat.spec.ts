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

async function multipleEvidenceFixture(page: Page) {
  const first = '44444444-4444-4444-8444-444444444441';
  const unavailable = '44444444-4444-4444-8444-444444444442';
  const third = '44444444-4444-4444-8444-444444444443';
  const last = '44444444-4444-4444-8444-444444444445';
  const text = [
    '하린의 공명력 기록 A: 12 (출처 2화) · 근거 1, 3',
    '하린의 공명력 기록 B: 27 (출처 9화) (근거 2)',
    '사건의 경위는 합성 원문에 기록돼요. 근거 4, 5',
    '수치는 3이고 1회 증가했어요.',
    '불명확한 참조 · 근거 99',
    '확인되지 않은 혼합 번호 · 근거 1, 99',
    '문장 안의 근거 3은 일반 문장입니다.',
  ].join('\n');
  await fixture(page, {
    result: {
      text,
      limitations: [],
      sources: [
        { tool: 'CHARACTER_EVIDENCE', targetId: first },
        { tool: 'WORLD_EVIDENCE', targetId: unavailable },
        { tool: 'CHARACTER_EVIDENCE', targetId: third },
      ],
      retrievalSources: [
        {
          chunkId: question,
          episodeId: question,
          sourceEpisodeNo: 12,
          sourceHash: 'a'.repeat(64),
          quote: '합성 검색 원문: 하린은 문을 열고 연구실로 들어갔다.',
          startOffset: 0,
          endOffset: 30,
        },
        {
          chunkId: last,
          episodeId: last,
          sourceEpisodeNo: 15,
          sourceHash: 'b'.repeat(64),
          quote: '합성 검색 원문: 연구실의 종이 울렸다.',
          startOffset: 0,
          endOffset: 22,
        },
      ],
    },
  });
  await page.route('**/setting-tools/queries', (route) => {
    const targetId = route.request().postDataJSON().targetId;
    if (targetId === unavailable)
      return route.fulfill({ status: 503, body: 'synthetic unavailable' });
    expect([first, third]).toContain(targetId);
    const episode = targetId === first ? 2 : 9;
    return success(route, {
      items: {
        content: [{
          id: targetId,
          subjectId: room,
          subjectName: '하린',
          displayName: '공명력',
          origin: 'CONFIRMED_ANALYSIS',
          evidence: {
            status: 'AVAILABLE',
            episodeId: targetId,
            sourceEpisodeNo: episode,
            quotes: [{
              text: episode === 2
                ? '합성 직접 원문: 하린의 공명력은 12였다.'
                : '합성 직접 원문: 하린의 공명력은 27이었다. ' + '긴 원문도 마지막까지 확인할 수 있다. '.repeat(35),
            }],
          },
        }],
      },
    });
  });
  await page.getByRole('textbox', { name: '질문', exact: true }).fill('하린의 변경 기록과 각 원문을 보여줘');
  await page.getByRole('button', { name: '보내기', exact: true }).click();
  await expect(page.locator('.chat-answer')).toContainText('하린의 공명력 기록 A');
  return { first, third, unavailable };
}

test('본문의 확인된 근거 번호만 배지로 바꾸고 일반 숫자·불명 참조는 보존한다', async ({ page }) => {
  await multipleEvidenceFixture(page);
  const answer = page.locator('.chat-answer');
  for (const number of [1, 2, 3, 4, 5]) {
    const badge = answer.getByRole('button', { name: `근거 ${number} 보기`, exact: true });
    await expect(badge).toHaveCount(1);
    await expect(badge).toHaveText(`[${number}]`);
  }
  await expect(answer.getByRole('button', { name: '근거 99 보기', exact: true })).toHaveCount(0);
  for (const unchanged of [
    '수치는 3이고 1회 증가했어요.',
    '불명확한 참조 · 근거 99',
    '확인되지 않은 혼합 번호 · 근거 1, 99',
    '문장 안의 근거 3은 일반 문장입니다.',
  ]) await expect(answer).toContainText(unchanged);
  await expect(answer.getByRole('button', { name: '답변 근거 5개 모두 보기', exact: true })).toHaveText('근거 5개');
});

test('한 줄의 여러 문장 근거는 연결하고 인용문·고유명사·HTML 모양 본문은 보존한다', async ({ page }) => {
  const untouched = [
    '알 수 없는 조합입니다. (근거 1, 99) 뒤 문장도 그대로입니다.',
    '“근거 2”라는 유물은 3개의 조각으로 이루어져 있습니다.',
    '인용문: “문을 열었다. (근거 2) 바람만 지나갔다.”',
    '인용문: "문을 닫았다. (근거 2) 아무 소리도 없었다."',
    "인용문: '발소리가 들렸다. (근거 2) 창문은 닫혀 있었다.'",
    '인용문: ‘등불이 꺼졌다. (근거 2) 잠시 뒤 밝아졌다.’',
    '인용문: 「빈 방이었다. (근거 2) 누군가 들어왔다.」',
    '인용문: 『바람이 불었다. (근거 2) 문이 흔들렸다.』',
    '작품의 코드 모양 문구: `설명문. (근거 2) 다음 문장.`',
    '여러 줄 인용: “첫 줄의 원문입니다.\n다음 줄의 원문입니다. (근거 2) 마지막 줄입니다.”',
    '<script>window.syntheticCitationExecuted=true</script>',
    '알 수 없는 마지막 번호 · 근거 1, 99',
  ];
  await fixture(page, {
    result: {
      text: [
        '첫 문장. (근거 1) 둘째 문장. (근거 3) 시점은 확인 못했습니다.',
        "O'Neill의 첫 기록입니다. · 근거 1",
        "O'Neill의 다음 기록입니다. · 근거 3",
        ...untouched,
      ].join('\n'),
      limitations: [],
      sources: [],
      retrievalSources: [1, 2, 3].map((number) => ({
        chunkId: `55555555-5555-4555-8555-55555555555${number}`,
        episodeId: question,
        sourceEpisodeNo: number,
        sourceHash: 'c'.repeat(64),
        quote: `합성 원문 ${number}`,
        startOffset: 0,
        endOffset: 7,
      })),
    },
  });
  await page.getByRole('textbox', { name: '질문', exact: true }).fill('기록된 장면을 설명해줘');
  await page.getByRole('button', { name: '보내기', exact: true }).click();
  const answer = page.locator('.chat-answer');
  await expect(answer.getByRole('button', { name: '근거 1 보기', exact: true })).toHaveCount(2);
  await expect(answer.getByRole('button', { name: '근거 3 보기', exact: true })).toHaveCount(2);
  await expect(answer.getByRole('button', { name: '근거 2 보기', exact: true })).toHaveCount(0);
  await expect(answer.getByRole('button', { name: '근거 99 보기', exact: true })).toHaveCount(0);
  await expect(answer).toContainText('첫 문장. [1] 둘째 문장. [3] 시점은 확인 못했습니다.');
  await expect(answer).toContainText("O'Neill의 첫 기록입니다. [1]");
  await expect(answer).toContainText("O'Neill의 다음 기록입니다. [3]");
  for (const text of untouched) await expect(answer).toContainText(text);
  await expect(answer.locator('script')).toHaveCount(0);
  expect(await page.evaluate(() => 'syntheticCitationExecuted' in window)).toBe(false);
});

for (const width of [1280, 320]) {
  test(`${width}px 근거 배지는 해당 번호를 열고 실패 항목·키보드·작은 화면을 보존한다`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: width === 320 ? 568 : 800 });
    const { third } = await multipleEvidenceFixture(page);
    const trigger = page.locator('.chat-answer').getByRole('button', { name: '근거 3 보기', exact: true });
    await trigger.focus();
    await page.keyboard.press('Enter');
    const dialog = page.getByRole('dialog', { name: '답변의 근거' });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole('article')).toHaveCount(5);
    for (let index = 0; index < 5; index++)
      await expect(dialog.getByRole('article').nth(index)).toHaveAttribute('aria-label', `근거 ${index + 1}`);
    const selected = dialog.getByRole('article', { name: '근거 3', exact: true });
    await expect(selected).toContainText('합성 직접 원문: 하린의 공명력은 27이었다.');
    await expect(selected).toBeFocused();
    await expect(selected.getByRole('heading')).toBeInViewport();
    await expect(dialog.getByRole('button', { name: '근거 3으로 이동', exact: true })).toHaveAttribute('aria-current', 'true');
    await expect(dialog.getByRole('article', { name: '근거 2', exact: true })).toContainText('확인할 수 없어요');
    await expect(dialog.getByRole('article', { name: '근거 4', exact: true })).toContainText('합성 검색 원문: 하린은 문을 열고 연구실로 들어갔다.');
    await expect(dialog.getByRole('article', { name: '근거 5', exact: true })).toContainText('합성 검색 원문: 연구실의 종이 울렸다.');
    await expect(dialog.getByRole('button', { name: '근거 닫기', exact: true })).toBeInViewport();
    await expect(selected.getByRole('link', { name: '9화 원문 보기', exact: true })).toHaveAttribute(
      'href', `/editor?workId=${work}&episodeId=${third}`,
    );
    await expect(selected.getByRole('link', { name: '설정 보기', exact: true })).toHaveAttribute(
      'href', `/dashboard?workId=${work}&nav=settingDB&tab=characters&modal=char-detail&charId=${room}`,
    );
    expect(await dialog.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.screenshot({ path: testInfo.outputPath(`chat-evidence-${width}px.png`) });
    const fourth = dialog.getByRole('article', { name: '근거 4', exact: true });
    const fourthNavigation = dialog.getByRole('button', { name: '근거 4으로 이동', exact: true });
    await fourthNavigation.click();
    await expect(fourth).toBeFocused();
    await expect(fourth.getByRole('heading')).toBeInViewport();
    await expect(fourthNavigation).toHaveAttribute('aria-current', 'true');
    await expect(fourth.getByRole('link', { name: '12화 원문 보기', exact: true })).toHaveAttribute(
      'href', `/editor?workId=${work}&episodeId=${question}`,
    );
    await page.screenshot({ path: testInfo.outputPath(`chat-evidence-multiple-${width}px.png`) });
    const unavailable = dialog.getByRole('article', { name: '근거 2', exact: true });
    const unavailableNavigation = dialog.getByRole('button', { name: '근거 2으로 이동', exact: true });
    await unavailableNavigation.click();
    await expect(unavailable).toBeFocused();
    await expect(unavailable.getByRole('heading')).toBeInViewport();
    await expect(unavailableNavigation).toHaveAttribute('aria-current', 'true');
    await expect(unavailable.getByRole('link')).toHaveCount(0);
    await dialog.getByRole('button', { name: '근거 3으로 이동', exact: true }).click();
    await expect(selected).toBeFocused();
    await expect(selected.getByRole('heading')).toBeInViewport();
    const originalLink = selected.getByRole('link', { name: '9화 원문 보기', exact: true });
    await originalLink.scrollIntoViewIfNeeded();
    await expect(originalLink).toBeInViewport();
    const settingLink = selected.getByRole('link', { name: '설정 보기', exact: true });
    await settingLink.scrollIntoViewIfNeeded();
    await expect(settingLink).toBeInViewport();
    await expect(dialog.getByRole('button', { name: '근거 닫기', exact: true })).toBeInViewport();
    await originalLink.focus();
    for (let step = 0; step < 12; step++) {
      await page.keyboard.press('Tab');
      expect(await dialog.evaluate((element) => element.contains(document.activeElement))).toBe(true);
    }
    await page.keyboard.press('Escape');
    await expect(dialog).toHaveCount(0);
    await expect(trigger).toBeFocused();
    await trigger.click();
    await expect(dialog.getByRole('article', { name: '근거 3', exact: true }).getByRole('heading')).toBeInViewport();
    await dialog.getByRole('button', { name: '근거 닫기', exact: true }).click();
    await expect(dialog).toHaveCount(0);
    await expect(trigger).toBeFocused();
  });
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
  await page.getByRole('button', { name: /^답변 근거 \d+개 모두 보기$/ }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByRole('article', { name: '근거 1', exact: true })).toContainText('확인할 수 없어요');
  await expect(dialog).toContainText('아리아는 화염구를 배웠다.');
  await expect(dialog).toContainText('그녀의 손끝에서 화염구가 피어올랐다.');
  await expect(dialog.getByRole('blockquote')).toHaveCount(2);
  await expect(dialog.getByRole('article')).toHaveCount(3);
  await expect(dialog.getByRole('article', { name: '근거 2', exact: true })).toContainText('아리아');
  await expect(dialog.getByRole('article', { name: '근거 2', exact: true })).toContainText('화염구');
  await expect(dialog.getByRole('article', { name: '근거 3', exact: true })).toContainText('2화');
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
    await page.getByRole('button', { name: /^답변 근거 \d+개 모두 보기$/ }).click();
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
  await page.getByRole('button', { name: /^답변 근거 \d+개 모두 보기$/ }).click();
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
  await page.getByRole('button', { name: /^답변 근거 \d+개 모두 보기$/ }).click();
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

test('긴 답변 끝을 읽을 때 같은 메시지 polling이 질문으로 되돌리지 않는다', async ({ page }) => {
  await fixture(page, { result: {
    text: '확인한 내용을 자세히 설명합니다.\n'.repeat(100),
    limitations: [], sources: [], retrievalSources: [],
  } });
  await page.getByRole('textbox', { name: '질문', exact: true }).fill('변화 과정을 알려줘');
  await page.getByRole('button', { name: '보내기', exact: true }).click();
  await expect(page.locator('.chat-answer')).toContainText('확인한 내용을 자세히 설명합니다.');
  const scroller = page.locator('.chat-messages');
  await scroller.evaluate((el) => { el.scrollTop = el.scrollHeight; });
  const bottom = await scroller.evaluate((el) => el.scrollTop);
  expect(bottom).toBeGreaterThan(500);
  for (let i = 0; i < 2; i++) {
    await page.waitForResponse((response) => response.url().includes('/messages?'));
    await expect.poll(() => scroller.evaluate((el) => el.scrollTop)).toBe(bottom);
  }
});

test('답변 완료와 재조회가 과거 대화를 읽던 위치를 유지한다', async ({ page }) => {
  const state = await fixture(page, { waiting: true });
  await page.route('**/chat-sessions/*/messages?*', (route) => success(route, {
    content: [
      { questionId: '44444444-4444-4444-8444-444444444444', question: '앞선 질문', execution: {
        state: 'SUCCEEDED', result: { outcome: 'ANSWER', text: '앞선 긴 답변입니다.\n'.repeat(100), sources: [], limitations: [] },
      } },
      { questionId: question, question: '현재 질문', execution: {
        state: state.complete ? 'SUCCEEDED' : 'RUNNING',
        result: state.complete ? { outcome: 'ANSWER', text: '새로운 긴 답변입니다.\n'.repeat(100), sources: [], limitations: [] } : null,
      } },
    ], page: 0, size: 20, hasNext: false, totalElements: 2,
  }));
  await page.reload();
  await expect(page.getByText('현재 질문', { exact: true })).toBeVisible();
  const scroller = page.locator('.chat-messages');
  await scroller.evaluate((el) => { el.scrollTop = 120; });
  state.complete = true;
  await expect(page.locator('.chat-answer').last()).toContainText('새로운 긴 답변입니다.');
  expect(await scroller.evaluate((el) => el.scrollTop)).toBe(120);
});

test('저장된 조건 답변은 관련 설정이 없는 수만 생략하고 불확실성과 인용은 보존한다', async ({ page }) => {
  const prefix = '현재 등록된 인물 38명 중 질문한 조건에 맞는 것으로 확인한 인물은 1명이에요.';
  await fixture(page, { result: {
    text: `${prefix}\n- 아리아: 요정입니다.\n“확인한 결과에는 포함하지 않았어요: 관련 설정이 없는 30명.”\n확인한 결과에는 포함하지 않았어요: 관련 설정이 없는 30명, 조건 충족 여부가 불확실한 2명.`,
    limitations: [], sources: [], retrievalSources: [],
  } });
  await page.getByRole('textbox', { name: '질문', exact: true }).fill('요정인 인물은?');
  await page.getByRole('button', { name: '보내기', exact: true }).click();
  const answer = page.locator('.chat-answer');
  await expect(answer).toContainText('확인한 결과에는 포함하지 않았어요: 조건 충족 여부가 불확실한 2명.');
  await expect(answer).toContainText('“확인한 결과에는 포함하지 않았어요: 관련 설정이 없는 30명.”');
  await expect(answer).not.toContainText('관련 설정이 없는 30명,');
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

for (const width of [1280, 320]) {
  test(`${width}px 대화방 목록으로 전환하고 선택한 방을 다시 눌러도 읽던 페이지를 유지한다`, async ({ page }) => {
    await page.setViewportSize({ width, height: 800 });
    await fixture(page);
    const otherRoom = '55555555-5555-4555-8555-555555555555';
    await page.route('**/chat-sessions?*', (route) => success(route, { content: [
      { id: room, createdAt: '2026-10-15T10:00:00', questionCount: 23 },
      { id: otherRoom, createdAt: '2026-10-15T11:00:00', questionCount: 1 },
    ], totalElements: 2 }));
    await page.route('**/chat-sessions/*/messages?*', (route) => success(route, {
      content: [{ questionId: question, question: route.request().url().includes(otherRoom) ? '두 번째 방 질문' : '첫 번째 방 질문', execution: { state: 'SUCCEEDED', result: { outcome: 'ANSWER', text: '답변입니다.', sources: [], limitations: [] } } }],
      page: 1, size: 20, totalElements: 23, hasNext: false,
    }));
    await page.goto(`/chat?workId=${work}&sessionId=${room}&messagePage=2`);
    if (width === 320) await page.getByRole('button', { name: '대화 목록', exact: true }).click();
    await page.getByRole('button', { name: /23개 질문/ }).click();
    await expect(page).toHaveURL(/messagePage=2/);
    if (width === 320) await page.getByRole('button', { name: '대화 목록', exact: true }).click();
    await page.getByRole('button', { name: /1개 질문/ }).click();
    await expect(page).toHaveURL(new RegExp(otherRoom));
    await expect(page.getByText('두 번째 방 질문', { exact: true })).toBeVisible();
    if (width === 320) await expect(page.getByRole('button', { name: '대화 목록', exact: true })).toHaveAttribute('aria-expanded', 'false');
    await expect(page.getByText('Enter로 보내기 · Shift+Enter로 줄바꿈')).toHaveCount(0);
  });
}

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
    await page.getByRole('button', { name: /^답변 근거 \d+개 모두 보기$/ }).click();
    await expect(page.getByRole('dialog')).toContainText(
      '아리아는 화염구를 배웠다.',
    );
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).toHaveCount(0);
  });
}
