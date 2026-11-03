import { expect, test, type Locator, type Page } from '@playwright/test';
import { computedContrastRatio } from './contrast';
import review from './fixtures/validation/validation-review-v1.json' with { type: 'json' };
import results from './fixtures/validation/validation-results-v1.json' with { type: 'json' };
import {
  authenticate,
  CHARACTER_ID,
  defaultFindings,
  EPISODE_ID,
  findingId,
  mockValidationReport,
  PAST_REPORT_ID,
  retarget,
  RECHECK_REPORT_ID,
  REPORT_ID,
  WORK_ID,
  WORLD_ID,
  type ReportScenario,
} from './fixtures/validation/report-mock';

async function open(page: Page, scenario: ReportScenario = {}, query = '') {
  const mock = await mockValidationReport(page, scenario);
  await authenticate(page);
  await page.goto(mock.url(query));
  await expect(page.locator('#validation-report-title')).toBeVisible();
  return mock;
}

const rows = (page: Page) => page.getByRole('list', { name: '검사 항목 목록' }).locator('.vr-row');
const blocks = (page: Page, name = '이번 원고와 근거 비교') => page.getByRole('region', { name });
const block = (page: Page, index: number) => page.locator('.vr-blocks .vr-block:not(.is-note)').nth(index);
const header = (page: Page, index: number) => block(page, index).locator('.vr-block__head button');
const lines = (page: Page, index: number) => block(page, index).locator('.vr-block__line');
const row = (page: Page, index: number) => page.locator(`[data-finding-id="${findingId(index)}"]`);
const detailHeading = (page: Page) => page.locator('#validation-finding-title');
const choice = (page: Page, name: string) => page.locator('.vr-judgment').getByRole('button', { name: new RegExp(`^${name}`) });
const counts = (page: Page, group: '설정 충돌' | '오탈자', label: string) => page.getByRole('region', { name: '결과 요약' })
  .locator('.vr-counts__group', { has: page.getByRole('heading', { name: group, exact: true }) })
  .locator('.vr-counts__metrics > div', { has: page.locator('dt', { hasText: new RegExp(`^${label}$`) }) }).locator('dd');
const refocusWindow = (page: Page) => page.evaluate(() => window.dispatchEvent(new Event('visibilitychange')));
const judgedFindings = () => defaultFindings().map(item => ({
  ...item, judgment: { value: item.branch === 'SETTING' ? 'NOT_CONFLICT' : 'KEEP_ORIGINAL', version: 1, decidedAt: '2026-10-30T10:15:00' },
}));
const noHorizontalOverflow = (page: Page) => page.evaluate(() => {
  const main = document.querySelector('main');
  return document.documentElement.scrollWidth <= innerWidth + 1 && (!main || main.scrollWidth <= main.clientWidth + 1);
});
async function minHeight(locator: Locator) {
  return (await locator.boundingBox())?.height ?? 0;
}

test('정상 완료·항목 있음: 목록·상세·근거를 읽고 판단을 저장하면 집계가 바뀌고 선택은 유지된다', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const mock = await open(page);
  await expect(page.getByRole('heading', { name: '101화 오류 리포트' })).toBeVisible();
  await expect(page.getByText('확인이 필요한 내용이 있어 설정 추출을 보류했어요.')).toBeVisible();
  await expect(page.getByText('확인할 내용이 있어요. 검토 필요 항목에 판단을 남겨 주세요.')).toBeVisible();
  await expect(page.getByRole('button', { name: '검토 완료 후 설정 추출' })).toBeDisabled();
  await expect(rows(page)).toHaveCount(4);
  await expect(counts(page, '설정 충돌', '검토 필요')).toHaveText('3');
  await expect(counts(page, '오탈자', '검토 필요')).toHaveText('1');
  // 큰 화면은 서버 순서의 첫 항목을 자동으로 연다.
  await expect(page).toHaveURL(new RegExp(`findingId=${findingId(0)}`));
  // 제목과 그 아래 설명은 판정이 쓴 문장(headline, 원인→결과 두 문장 reason)이고 고치는 방법 안내가 한 줄 붙는다(2026-11-03).
  await expect(detailHeading(page)).toHaveText('비요른의 검 상태가 기존 설정과 달라요');
  await expect(page.locator('.vr-detail-summary')).toHaveText(
    '기존 설정은 비요른의 검이 산산이 부서져 손잡이만 남았다고 해요. 그런데 101화에서는 그 검을 다시 뽑아 들어요.');
  await expect(page.locator('.vr-detail-hint')).toHaveText('101화에서 일부러 바꾼 거라면 설정을, 실수라면 원고를 고쳐 주세요.');
  expect(mock.state.findingQueries[0]).toContain('judgment=PENDING');
  expect(mock.state.findingQueries[0]).toContain('page=0');
  expect(mock.state.findingQueries[0]).toContain('size=20');

  // 문맥 블록: 이번 원고 → 기준(저장 설정값) → 근거(이전 회차, 회차 순). 처음 두 블록만 펼치고 수정 전후처럼 보이는 −/+는 없다.
  const expected = defaultFindings()[0].blocks;
  const stack = blocks(page);
  await expect(stack.locator('.vr-block')).toHaveCount(4);
  await expect(stack.locator('.vr-block__role')).toHaveText(['이번 원고', '기준', '근거', '근거']);
  await expect(stack.locator('.vr-block__label')).toHaveText(expected.map(item => item.label));
  await expect(block(page, 0).locator('.vr-block__label')).toHaveText(/^101화 · \d+~\d+자$/);
  await expect(block(page, 1).locator('.vr-block__label')).toHaveText('설정 · 비요른 · 검');
  await expect(block(page, 2).locator('.vr-block__label')).toHaveText(/^20화 · \d+~\d+자$/);
  await expect(block(page, 3).locator('.vr-block__label')).toHaveText(/^24화 · \d+~\d+자$/);
  for (const [index, open] of [[0, true], [1, true], [2, false], [3, false]] as const) {
    await expect(header(page, index)).toHaveAttribute('aria-expanded', String(open));
  }
  await expect(stack).not.toContainText('−');
  // 이번 원고: 인용 줄을 강조하고 위아래 2줄을 함께 보인다(빈 줄은 세지 않는다).
  await expect(lines(page, 0)).toHaveText(['성문 앞에 모인 사람들이 숨을 죽였다.', '북쪽 하늘이 붉게 물들고 있었다.', '비요른은 그 검을 뽑았다.',
    '칼날이 떨리는 소리가 성벽에 부딪혔다.', '아무도 그 검이 어디서 왔는지 묻지 않았다.']);
  await expect(block(page, 0).locator('.vr-block__line.is-quote mark')).toHaveText('비요른은 그 검을 뽑았다.');
  // 기준: 설정값 전체 안에서 판정이 옮긴 문장을 강조한다. 앞뒤 줄·더 보기는 없다.
  await expect(block(page, 1).locator('.vr-block__line')).toHaveText('20화 전투 중 산산이 부서져 손잡이만 남음');
  await expect(block(page, 1).locator('mark')).toHaveText('산산이 부서져 손잡이만 남음');
  await expect(block(page, 1).getByRole('button', { name: /더 보기/ })).toHaveCount(0);
  // 위로 더 보기는 서버에서 같은 원고를 5줄 더 읽고 원고 처음에 닿으면 사라진다.
  const firstWindow = expected[0].context as { start: number; end: number };
  await block(page, 0).getByRole('button', { name: '위로 더 보기' }).click();
  await expect(lines(page, 0).first()).toHaveText('새벽이 오기 전, 성 밖의 들판은 조용했다.');
  await expect(lines(page, 0)).toHaveCount(7);
  await expect(block(page, 0).getByRole('button', { name: '위로 더 보기' })).toHaveCount(0);
  expect(new URLSearchParams(mock.state.contextRequests[0])).toEqual(new URLSearchParams(
    `sourceRef=T1&anchorStart=${firstWindow.start}&anchorEnd=${firstWindow.start}&before=5&after=0`));
  await block(page, 0).getByRole('button', { name: '아래로 더 보기' }).click();
  await expect(lines(page, 0)).toHaveCount(12);
  expect(new URLSearchParams(mock.state.contextRequests[1]).get('anchorStart')).toBe(String(firstWindow.end));
  // 접힌 근거 블록은 머리말만 있고 누르면 펼친다. 근거 블록도 같은 방식으로 더 읽는다.
  await expect(block(page, 2).locator('.vr-block__line')).toHaveCount(0);
  await header(page, 2).click();
  await expect(header(page, 2)).toHaveAttribute('aria-expanded', 'true');
  await expect(block(page, 2).locator('.vr-block__line.is-quote mark')).toHaveText('그의 검은 손잡이만 남긴 채 산산이 부서졌다.');
  await expect(lines(page, 2)).toHaveCount(5);
  await block(page, 2).getByRole('button', { name: '위로 더 보기' }).click();
  await expect(lines(page, 2).first()).toHaveText('전령이 성문을 두드렸다.');
  expect(new URLSearchParams(mock.state.contextRequests.at(-1)).get('sourceRef')).toBe('R1');
  // 다시 접었다 펴도 더 읽은 줄은 그대로다.
  await header(page, 0).click();
  await expect(block(page, 0).locator('.vr-block__line')).toHaveCount(0);
  await header(page, 0).click();
  await expect(lines(page, 0)).toHaveCount(12);
  // 판정이 쓰지 않은 검색 조각, 근거 원문 목록, 전체 원문 링크는 두지 않는다.
  await expect(page.getByRole('region', { name: '근거로 쓴 원문' })).toHaveCount(0);
  await expect(page.getByText(/검색에 쓴 다른 원고 조각/)).toHaveCount(0);
  await expect(page.getByText('대장간 앞은 늘 시끄러웠다.')).toHaveCount(0);
  await expect(page.getByRole('link', { name: /전체 원문 보기/ })).toHaveCount(0);
  for (const internal of ['T1', 'R1', 'R3', 'E1', 'B1', '비교 원문', 'limited', '영수증']) await expect(page.locator('.vr-detail-card')).not.toContainText(internal);

  await choice(page, '충돌 아님으로 표시').click();
  await expect(page.getByText('충돌 아님으로 표시했어요.').first()).toBeVisible();
  expect(mock.judgmentPatches()[0]).toMatchObject({
    path: `/api/v1/works/${WORK_ID}/episode-validations/${REPORT_ID}/findings/${findingId(0)}/judgment`,
    body: { judgment: 'NOT_CONFLICT', expectedJudgmentVersion: 0, expectedCheckRevision: 1 },
  });
  await expect(counts(page, '설정 충돌', '검토 필요')).toHaveText('2');
  await expect(counts(page, '설정 충돌', '충돌 아님')).toHaveText('1');
  // 저장 뒤에도 같은 상세를 유지하고 검토 필요 필터에서 빠졌음을 알린다.
  await expect(page).toHaveURL(new RegExp(`findingId=${findingId(0)}`));
  await expect(detailHeading(page)).toHaveText('비요른의 검 상태가 기존 설정과 달라요');
  await expect(choice(page, '충돌 아님으로 표시')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByText('이 항목은 현재 필터에서 제외됐어요.')).toBeVisible();
  await expect(rows(page)).toHaveCount(3);
  await page.getByRole('button', { name: '다음 항목' }).click();
  await expect(page).toHaveURL(new RegExp(`findingId=${findingId(1)}`));
  await expect(detailHeading(page)).toBeFocused();

  // 원문·인용·설정값은 URL이나 브라우저 저장소에 남기지 않는다.
  const stored = await page.evaluate(() => JSON.stringify({ ...localStorage, ...sessionStorage }));
  for (const quote of ['비요른은 그 검을 뽑았다.', '왕궁 앞뜰', '부서졌다']) {
    expect(decodeURIComponent(page.url())).not.toContain(quote);
    expect(stored).not.toContain(quote);
  }
});

test('오탈자는 이번 원고 블록 한 줄 안에서 원문을 지운 표시로 두고 제안을 바로 뒤에 보이며 원문은 고치지 않는다고 알린다', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const mock = await open(page, {}, `&findingId=${findingId(3)}`);
  await expect(detailHeading(page)).toHaveText('‘되요’ → ‘돼요’');
  const stack = blocks(page, '원문과 교정 제안');
  await expect(stack.locator('.vr-block')).toHaveCount(1);
  await expect(block(page, 0).locator('.vr-block__role')).toHaveText('이번 원고');
  await expect(block(page, 0).locator('.vr-block__label')).toHaveText(defaultFindings()[3].blocks[0].label);
  await expect(lines(page, 0)).toHaveCount(5);
  const quote = block(page, 0).locator('.vr-block__line.is-quote');
  await expect(quote.locator('del')).toContainText('되요');
  await expect(quote.locator('ins')).toContainText('돼요');
  await expect(quote).toHaveText(/^그러면 (원문 )?되요→(제안 )?돼요 정말 괜찮겠어\?$/);
  await expect(stack).not.toContainText('−');
  await expect(stack.getByText('원문은 자동으로 고치지 않아요.')).toBeVisible();
  // 오탈자 블록도 같은 원고를 더 읽는다.
  await block(page, 0).getByRole('button', { name: '아래로 더 보기' }).click();
  await expect(lines(page, 0)).toHaveCount(8);
  await expect(block(page, 0).getByRole('button', { name: '아래로 더 보기' })).toHaveCount(0);
  expect(new URLSearchParams(mock.state.contextRequests[0]).get('after')).toBe('5');
});

test('앞뒤 줄이 겹치는 원고 위치는 한 블록에 함께 강조하고 판정 제목이 없는 이전 결과는 화면이 제목을 만든다', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const mock = await open(page, {}, `&findingId=${findingId(2)}`);
  // 판정 headline이 없으면 대상·확인 항목으로 만든 문장, 설명은 판정 사유다.
  await expect(detailHeading(page)).toHaveText('에르웬 망토 색이 기존 기록과 다를 수 있어요');
  await expect(page.locator('.vr-detail-summary')).toHaveText('망토의 색이 이전 회차와 달라요.');
  await expect(blocks(page).locator('.vr-block__role')).toHaveText(['이번 원고', '근거']);
  const merged = defaultFindings()[2].blocks[0] as unknown as { label: string; quotes: unknown[] };
  expect(merged.quotes).toHaveLength(2);
  await expect(block(page, 0).locator('.vr-block__label')).toHaveText(merged.label);
  // 같은 줄은 한 번만 보이고 두 인용 줄을 각각 강조한다. 사이 줄은 강조하지 않는다.
  await expect(lines(page, 0)).toHaveText(['경비병들이 서로를 돌아보았다.', '그러면 되요 정말 괜찮겠어?', '에르웬은 붉은 망토를 여몄다.',
    '바람이 다시 거세졌다.', '붉은 망토 자락이 바람에 흩날렸다.', '성문이 천천히 열리기 시작했다.', '누군가 낮게 비요른의 이름을 불렀다.']);
  await expect(block(page, 0).locator('.vr-block__line.is-quote mark')).toHaveText(['에르웬은 붉은 망토를 여몄다.', '붉은 망토 자락이 바람에 흩날렸다.']);
  await expect(block(page, 0).locator('.vr-block__line:not(.is-quote)')).toHaveCount(5);
  // 합친 블록도 창의 처음에서 위로 더 읽고, 원고 끝에 닿았으면 아래로 더 보기가 없다.
  await expect(block(page, 0).getByRole('button', { name: '아래로 더 보기' })).toHaveCount(0);
  await block(page, 0).getByRole('button', { name: '위로 더 보기' }).click();
  await expect(lines(page, 0)).toHaveCount(12);
  await expect(lines(page, 0).first()).toHaveText('비요른은 그 검을 뽑았다.');
  const window = merged as unknown as { context: { start: number } };
  expect(new URLSearchParams(mock.state.contextRequests[0])).toEqual(new URLSearchParams(
    `sourceRef=T1&anchorStart=${window.context.start}&anchorEnd=${window.context.start}&before=5&after=0`));
  expect(decodeURIComponent(page.url())).not.toContain('망토');
});

test('떨어진 원고 위치는 위치마다 블록을 두고 더 보기 실패는 일시 오류면 다시 시도, 원고가 바뀌었으면 멈춘다', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const findings = defaultFindings();
  findings[2] = retarget(findings[2], ['북쪽 하늘이 붉게 물들고 있었다.', '붉은 망토 자락이 바람에 흩날렸다.']);
  const mock = await open(page, { findings }, `&findingId=${findingId(2)}`);
  await expect(blocks(page).locator('.vr-block__role')).toHaveText(['이번 원고', '이번 원고', '근거']);
  await expect(header(page, 0)).toHaveAttribute('aria-expanded', 'true');
  await expect(header(page, 1)).toHaveAttribute('aria-expanded', 'true');
  await expect(header(page, 2)).toHaveAttribute('aria-expanded', 'false');
  await expect(block(page, 0).locator('.vr-block__line.is-quote mark')).toHaveText('북쪽 하늘이 붉게 물들고 있었다.');
  await expect(block(page, 1).locator('.vr-block__line.is-quote mark')).toHaveText('붉은 망토 자락이 바람에 흩날렸다.');
  // 원고 끝에 닿은 블록은 아래로 더 보기가 없다.
  await expect(block(page, 1).getByRole('button', { name: '아래로 더 보기' })).toHaveCount(0);

  mock.failNextContext({ status: 409, code: 'VALIDATION_SOURCE_CONTEXT_UNAVAILABLE', message: '검사 당시 원문을 지금 읽을 수 없어 앞뒤 문장을 보여 드릴 수 없습니다.', context: { reason: 'SOURCE_UNREADABLE' } });
  await block(page, 0).getByRole('button', { name: '위로 더 보기' }).click();
  await expect(block(page, 0).locator('.vr-block__note')).toHaveText('앞뒤 문장을 더 불러오지 못했어요. 잠시 뒤 다시 시도해 주세요.');
  await expect(lines(page, 0)).toHaveCount(5);
  await block(page, 0).getByRole('button', { name: '위로 더 보기' }).click();
  await expect(lines(page, 0)).toHaveCount(6);
  await expect(block(page, 0).locator('.vr-block__note')).toHaveCount(0);

  mock.failNextContext({ status: 409, code: 'VALIDATION_SOURCE_CONTEXT_UNAVAILABLE', message: '검사 당시 원문을 지금 읽을 수 없어 앞뒤 문장을 보여 드릴 수 없습니다.', context: { reason: 'SOURCE_CHANGED' } });
  await block(page, 1).getByRole('button', { name: '위로 더 보기' }).click();
  await expect(block(page, 1).locator('.vr-block__note')).toHaveText('검사 뒤 원고가 바뀌었거나 지워져 더 보여 드릴 수 없어요.');
  await expect(block(page, 1).getByRole('button', { name: /더 보기/ })).toHaveCount(0);
  await expect(lines(page, 1)).toHaveCount(5);
  expect(decodeURIComponent(page.url())).not.toContain('망토');
});

test('서버가 앞뒤 줄을 읽지 못한 블록은 인용만 보이고 이전 서버 응답(blocks 없음)도 블록으로 보인다', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const findings = defaultFindings();
  const unreadable = findings[0].blocks[0] as unknown as Record<string, unknown>;
  unreadable.context = null;
  unreadable.contextStatus = 'SOURCE_UNREADABLE';
  const changed = findings[0].blocks[1 + 1] as unknown as Record<string, unknown>;
  changed.context = null;
  changed.contextStatus = 'SOURCE_CHANGED';
  delete (findings[2] as unknown as Record<string, unknown>).blocks;
  const mock = await open(page, { findings }, `&findingId=${findingId(0)}`);
  await expect(block(page, 0).locator('.vr-block__line')).toHaveText('비요른은 그 검을 뽑았다.');
  await expect(block(page, 0).locator('.vr-block__note')).toContainText('앞뒤 문장을 불러오지 못했어요.');
  await block(page, 0).getByRole('button', { name: '다시 불러오기' }).click();
  await expect(lines(page, 0)).toHaveCount(5);
  expect(new URLSearchParams(mock.state.contextRequests[0]).get('before')).toBe('2');
  await header(page, 2).click();
  await expect(block(page, 2).locator('.vr-block__note')).toHaveText('검사 뒤 원고가 바뀌었거나 지워져 앞뒤 문장은 보여 드릴 수 없어요.');
  await expect(block(page, 2).getByRole('button', { name: /다시 불러오기|더 보기/ })).toHaveCount(0);

  await row(page, 2).click();
  await expect(blocks(page).locator('.vr-block__role')).toHaveText(['이번 원고', '이번 원고', '근거']);
  await expect(block(page, 0).locator('.vr-block__label')).toHaveText(/^101화 · \d+~\d+자$/);
  await expect(block(page, 2).locator('.vr-block__label')).toHaveText(/^20화 · \d+~\d+자$/);
  await expect(page.locator('.vr-blocks').getByRole('button', { name: /더 보기/ })).toHaveCount(0);
});

test('두 검사 0건은 검토 완료 버튼 없이 자동 추출을 안내하고 서버가 확정한 뒤에만 확정 완료를 표시한다', async ({ page }) => {
  const mock = await open(page, {
    findings: [],
    staging: { reviewStage: 'REVIEW_COMPLETED', extractionJobId: review.responses.reviewSummary.completion.extractionJobId, extractionStatus: 'PENDING' },
    summary: {
      completionMode: 'COMPLETED', canCompleteReview: false, judgmentLocked: true, lockReason: 'REVIEW_COMPLETED',
      holdReasons: [], allowedActions: ['APPLY_SETTINGS'], extractionState: 'RUNNING',
      completion: { ...review.responses.reviewSummary.completion, trigger: 'AUTOMATIC' },
    },
  });
  await expect(page.getByText('확인한 범위에서 충돌 의심 항목과 오탈자 제안을 찾지 못했어요.')).toBeVisible();
  await expect(page.getByText('이번 회차의 설정을 추출하고 있어요.')).toBeVisible();
  await expect(page.getByRole('button', { name: '검토 완료 후 설정 추출' })).toHaveCount(0);
  await expect(page.getByText('이번 회차의 설정을 확정했어요.')).toHaveCount(0);
  await expect(counts(page, '설정 충돌', '전체')).toHaveText('0');
  await expect(page.getByText('확인한 범위에서 찾은 항목이 없어요.')).toBeVisible();

  mock.patchStaging({ reviewStage: 'APPLIED', candidateStatus: 'READY', extractionStatus: 'READY', reportVersion: 14 });
  mock.patchSummary({ reviewStage: 'APPLIED', extractionState: 'SUCCEEDED', allowedActions: [],
    application: { ...review.responses.reviewSummary.application, status: 'APPLIED', holdReasons: [], appliedAt: '2026-10-30T11:07:00' } });
  // 추출 중에는 3초마다 다시 확인한다.
  await expect(page.getByText(/이번 회차의 설정을 확정했어요/)).toBeVisible({ timeout: 8_000 });
  expect(mock.state.requests.filter(request => request.method === 'POST')).toHaveLength(0);
});

test('일부 중단은 미검사 범위를 숨기지 않고 서버가 허용한 중단 검사 재시도만 제공한다', async ({ page }) => {
  const mock = await open(page, {
    staging: { executionStatus: 'PARTIAL' },
    summary: { holdReasons: ['EXECUTION_NOT_COMPLETED', 'PENDING_JUDGMENTS'], allowedActions: ['SAVE_JUDGMENT', 'RETRY'] },
    results: { ...results.completed, status: 'PARTIAL', settingStatus: 'PARTIAL', completedChecks: 2,
      coverage: { ...results.completed.coverage, requiredStages: 8, completedStages: 5 } },
  });
  await expect(page.getByText('일부 구간의 검사를 마치지 못했어요.')).toBeVisible();
  await expect(page.getByText('아직 검사를 마치지 못했어요.')).toBeVisible();
  await expect(page.getByText('검사하지 못한 범위를 특정할 수 없어요.')).toBeVisible();
  await expect(page.getByText('필수 검사 단위 8개 중 3개를 마치지 못했어요.')).toBeVisible();
  await expect(page.getByRole('list', { name: '검사 범위 요약' })).toContainText('일부 완료');
  await expect(page.getByRole('button', { name: '검토 완료 후 설정 추출' })).toBeDisabled();
  // 중단 결과에서도 게시된 항목은 판단할 수 있다.
  await expect(choice(page, '수정 필요로 표시')).toBeEnabled();

  await page.getByRole('button', { name: '중단된 검사 다시 시도' }).click();
  await expect(page.getByText('중단된 검사를 다시 시작했어요. 검사가 끝날 때까지 판단은 잠겨요.').first()).toBeVisible();
  const retry = mock.state.requests.find(request => request.path.endsWith('/retries'));
  expect(retry?.body).toMatchObject({ expectedReportVersion: 12, idempotencyKey: expect.stringMatching(/^validation-retry-/) });
  await expect(page.getByText('검사가 끝나면 판단을 남길 수 있어요. 지금은 발견한 항목을 읽기만 할 수 있어요.')).toBeVisible();
  await expect(choice(page, '수정 필요로 표시')).toBeDisabled();
  await expect(page.getByText('설정 충돌을 확인하고 있어요.')).toBeVisible();
});

test('추가 확인 필요와 심각 등급은 별도 축으로 표시하고 AI 결과 유형 필터는 서버에 보낸다', async ({ page }) => {
  const mock = await open(page);
  const ambiguous = row(page, 1);
  await expect(ambiguous.getByText('영향 심각')).toBeVisible();
  await expect(ambiguous.getByText('추가 확인 필요', { exact: true })).toBeVisible();
  await ambiguous.click();
  await expect(detailHeading(page)).toHaveText('왕궁 앞뜰이 마법 금지 구역인지 확인이 필요해요');
  await expect(page.locator('.vr-detail-summary')).toHaveText('왕궁 앞뜰이 마법 금지 구역에 들어가는지 알 수 없어요.');
  // 근거 문장이 없는 추가 확인 필요는 이번 원고 블록 뒤에 설정에 내용이 없다고 알리고 검색 조각을 블록으로 만들지 않는다.
  await expect(blocks(page).locator('.vr-block')).toHaveCount(2);
  await expect(block(page, 0).locator('.vr-block__role')).toHaveText('이번 원고');
  await expect(block(page, 0).locator('.vr-block__line.is-quote')).toContainText('왕궁 앞뜰에 발을 디딘 에르웬이');
  await expect(blocks(page).locator('.vr-block.is-note')).toContainText('저장된 설정에 이 내용이 없어요.');
  await expect(page.getByText('왕궁 안에서는 누구도 마법을 사용할 수 없다.')).toHaveCount(0);
  await expect(page.locator('.vr-detail-notes')).toContainText('영향 · 심각');
  await expect(page.locator('.vr-detail-notes')).toContainText('주문으로 탈출하는 장면의 성립 조건이에요.');
  // 판정의 조회 과정 기록(completion)은 작가 화면에 쓰지 않는다.
  await expect(page.locator('.vr-detail-card')).not.toContainText('앞뜰이 ‘왕궁 안’에 포함되는지 설정에 적혀 있지 않아요.');

  await page.getByRole('group', { name: 'AI 결과 유형' }).getByRole('button', { name: '추가 확인 필요' }).click();
  await expect(page).toHaveURL(/outcome=NEEDS_CONTEXT/);
  await expect(page).not.toHaveURL(/page=/);
  await expect(rows(page)).toHaveCount(1);
  expect(mock.state.findingQueries.at(-1)).toContain('outcome=NEEDS_CONTEXT');
});

test('목록 행은 판정이 쓴 제목을, 없으면 대상·확인 항목으로 만든 문장을 쓰고 판단 이유를 한 줄로 보여 준다', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const findings = defaultFindings();
  // 대상이 기준 항목으로 이어지지 않은 설정 항목(subject=null)도 판정 제목이 있으면 그것을 쓰고 대상 라벨은 두지 않는다.
  findings.push({ ...structuredClone(findings[1]), findingId: findingId(4), subject: null, settingName: null, settingKey: null, basis: [] });
  // 판정 제목도 대상도 없는 이전 결과는 확인 항목으로 문장을 만든다.
  findings.push({ ...structuredClone(findings[1]), findingId: findingId(5), subject: null, settingName: null, settingKey: null, basis: [], headline: null } as typeof findings[number]);
  await open(page, { findings });
  const title = (index: number) => row(page, index).locator('.vr-row__title');
  const reason = (index: number) => row(page, index).locator('.vr-row__reason');
  await expect(title(0)).toHaveText('비요른의 검 상태가 기존 설정과 달라요');
  await expect(reason(0)).toHaveText('기존 설정은 비요른의 검이 산산이 부서져 손잡이만 남았다고 해요. 그런데 101화에서는 그 검을 다시 뽑아 들어요.');
  await expect(row(page, 0).locator('.vr-chip--subject')).toHaveText('캐릭터');
  await expect(title(1)).toHaveText('왕궁 앞뜰이 마법 금지 구역인지 확인이 필요해요');
  await expect(row(page, 1).locator('.vr-chip--subject')).toHaveText('세계관');
  // 판정 제목이 없으면 대상 이름과 확인 항목(topic)으로 만든 문장이다.
  await expect(title(2)).toHaveText('에르웬 망토 색이 기존 기록과 다를 수 있어요');
  await expect(reason(2)).toHaveText('망토의 색이 이전 회차와 달라요.');
  await expect(title(4)).toHaveText('왕궁 앞뜰이 마법 금지 구역인지 확인이 필요해요');
  await expect(reason(4)).toHaveText('왕궁 앞뜰이 마법 금지 구역에 들어가는지 알 수 없어요.');
  await expect(title(5)).toHaveText('앞뜰의 마법 사용을 확인해 주세요');
  for (const index of [4, 5]) await expect(row(page, index).locator('.vr-chip--subject')).toHaveCount(0);
  // 오탈자는 판단 이유만 제목으로 쓰고 대상 라벨을 두지 않는다.
  await expect(reason(3)).toHaveCount(0);
  await expect(row(page, 3).locator('.vr-chip--subject')).toHaveCount(0);
  await expect(title(3)).toHaveText('‘되어요’의 준말은 ‘돼요’예요.');

  // 상세 제목은 목록과 같은 문장이고 사유는 그 아래다.
  await expect(detailHeading(page)).toHaveText('비요른의 검 상태가 기존 설정과 달라요');
  await row(page, 4).click();
  await expect(detailHeading(page)).toHaveText('왕궁 앞뜰이 마법 금지 구역인지 확인이 필요해요');
  await expect(page.locator('.vr-detail-summary')).toHaveText('왕궁 앞뜰이 마법 금지 구역에 들어가는지 알 수 없어요.');
  await row(page, 5).click();
  await expect(detailHeading(page)).toHaveText('앞뜰의 마법 사용을 확인해 주세요');
});

test('등급·대상 필터는 서버에 보내고 첫 페이지로 돌아가며 건수는 목록 응답, 집계는 검토 요약을 쓴다', async ({ page }) => {
  const base = defaultFindings();
  // 21개 이상이어야 2페이지가 생긴다. 계약 모양은 그대로 두고 ID·등급·대상만 바꾼다.
  const extra = Array.from({ length: 20 }, (_, index) => ({
    ...structuredClone(base[index % 2 === 0 ? 0 : 1]),
    findingId: `00000000-0000-4000-8000-0000000003${String(index).padStart(2, '0')}`,
  }));
  const mock = await open(page, { findings: [...base, ...extra] }, '&judgment=ALL&page=2');
  await expect(rows(page)).toHaveCount(4);
  await expect(page.getByText('조건에 맞는 항목 24개', { exact: false })).toBeVisible();

  await page.getByRole('group', { name: '등급' }).getByRole('button', { name: '심각' }).click();
  await expect(page).toHaveURL(/impact=SEVERE/);
  await expect(page).not.toHaveURL(/[?&]page=/);
  await expect.poll(() => mock.state.findingQueries.at(-1)).toContain('impact=SEVERE');
  expect(mock.state.findingQueries.at(-1)).toContain('page=0');
  // 서버가 오탈자와 다른 등급을 뺀 결과의 totalElements를 그대로 보여 준다.
  await expect(page.getByText('조건에 맞는 항목 22개', { exact: false })).toBeVisible();
  await expect(page.getByText('등급·대상으로 거르면 오탈자와 대상이 없는 항목은 빠져요.')).toBeVisible();
  await expect(counts(page, '오탈자', '전체')).toHaveText('1');

  await page.getByRole('group', { name: '대상' }).getByRole('button', { name: '세계관' }).click();
  await expect(page).toHaveURL(/subjectType=WORLD_SETTING/);
  await expect.poll(() => mock.state.findingQueries.at(-1)).toMatch(/impact=SEVERE.*subjectType=WORLD_SETTING|subjectType=WORLD_SETTING.*impact=SEVERE/);
  await expect(page.getByText('조건에 맞는 항목 11개', { exact: false })).toBeVisible();
  await expect(rows(page).first().locator('.vr-chip--subject')).toHaveText('세계관');
  // 새로고침은 URL의 필터를 그대로 서버에 보낸다.
  await page.reload();
  await expect(page.getByRole('group', { name: '대상' }).getByRole('button', { name: '세계관' })).toHaveAttribute('aria-pressed', 'true');
  await expect.poll(() => mock.state.findingQueries.at(-1)).toContain('subjectType=WORLD_SETTING');

  // 오탈자 분류에는 등급·대상이 없어 필터를 숨기고 주소에서도 지운다.
  await page.getByRole('group', { name: '분류' }).getByRole('button', { name: '오탈자' }).click();
  await expect(page).not.toHaveURL(/impact=|subjectType=/);
  await expect(page.getByRole('group', { name: '등급' })).toHaveCount(0);
  await expect(page.getByRole('group', { name: '대상' })).toHaveCount(0);
  await expect.poll(() => mock.state.findingQueries.at(-1)).not.toMatch(/impact=|subjectType=/);

  // 작은 화면은 같은 필터를 이름 있는 선택 메뉴로 제공한다.
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('combobox', { name: '분류' }).selectOption('SETTING');
  await page.getByRole('combobox', { name: '등급' }).selectOption('CAUTION');
  await expect(page).toHaveURL(/impact=CAUTION/);
  await expect.poll(() => mock.state.findingQueries.at(-1)).toContain('impact=CAUTION');
  await expect(page.getByText('조건에 맞는 항목이 없어요.')).toBeVisible();
});

test('A5 대상 설정 보기는 연결된 캐릭터·세계관 상세를 열고 돌아오며 연결이 없으면 이름으로 잇지 않고 잠근다', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const findings = defaultFindings();
  findings.push({ ...structuredClone(findings[2]), findingId: findingId(4), subject: { type: 'CHARACTER', id: null, name: '에르웬' } });
  const noSubject = { ...structuredClone(findings[2]), findingId: '00000000-0000-4000-8000-000000000151', subject: null, settingName: null, basis: [] };
  findings.push(noSubject);
  const mock = await open(page, { findings }, `&branch=SETTING&findingId=${findingId(0)}`);
  const view = page.getByRole('link', { name: '대상 설정 보기', exact: true });
  await expect(page.locator('#validation-target-name')).toHaveText('캐릭터 · 비요른 · 지금 저장된 설정을 열어요.');
  const href = new URL(await view.getAttribute('href') ?? '', 'http://localhost');
  expect(Object.fromEntries(href.searchParams)).toEqual({
    workId: WORK_ID, nav: 'settingDB', tab: 'characters', modal: 'char-detail', charId: CHARACTER_ID,
    returnTo: 'validation-report', reportId: REPORT_ID, reportFindingId: findingId(0), reportBranch: 'SETTING', reportView: 'subject',
  });
  await view.click();
  const dialog = page.getByRole('dialog', { name: '비요른 캐릭터 상세' });
  await expect(dialog).toBeVisible();
  const inside = dialog.getByTestId('validation-correction-notice');
  await expect(inside).toHaveCount(0);
  await expect(page.getByTestId('validation-report-return')).toContainText('오류 리포트에서 대상 설정을 보러 왔어요.');
  // 보기만 했으므로 정정 요청이나 일반 저장을 보내지 않는다.
  expect(mock.state.requests.filter(item => item.method !== 'GET')).toEqual([]);
  await dialog.getByRole('button', { name: '닫기', exact: true }).click();
  await page.getByTestId('validation-report-return').getByRole('link', { name: '오류 리포트로 돌아가기' }).click();
  await expect(page).toHaveURL(new RegExp(`reportId=${REPORT_ID}.*findingId=${findingId(0)}`));

  // 세계관 대상은 세계관 상세를 연다.
  await row(page, 1).click();
  await expect(page.locator('#validation-target-name')).toHaveText('세계관 · 왕궁 · 지금 저장된 설정을 열어요.');
  const worldHref = new URL(await view.getAttribute('href') ?? '', 'http://localhost');
  expect(worldHref.searchParams.get('tab')).toBe('worldsettings');
  expect(worldHref.searchParams.get('settingId')).toBe(WORLD_ID);
  expect(worldHref.searchParams.get('modal')).toBeNull();
  await view.click();
  await expect(page.getByRole('dialog', { name: '왕궁 세계관 상세' })).toBeVisible();
  await page.goBack();

  // 서버가 실제 대상 ID를 주지 않으면 같은 이름의 설정으로 연결하지 않는다.
  await row(page, 4).click();
  await expect(view).toHaveCount(0);
  await expect(page.getByRole('button', { name: '대상 설정 보기' })).toBeDisabled();
  await expect(page.locator('#validation-target-lock')).toHaveText('연결된 대상이 없어요. 이름이 같은 설정으로 대신 연결하지 않아요.');
  await page.locator(`[data-finding-id="${noSubject.findingId}"]`).click();
  await expect(page.locator('#validation-target-lock')).toHaveText('연결된 대상이 없어요.');
});

test('판단 변경과 검토 필요로 되돌리기는 현재 version을 보내고 같은 값은 다시 저장하지 않는다', async ({ page }) => {
  const mock = await open(page, {}, '&judgment=ALL');
  await choice(page, '수정 필요로 표시').click();
  await expect(choice(page, '수정 필요로 표시')).toHaveAttribute('aria-pressed', 'true');
  await expect(counts(page, '설정 충돌', '수정 필요')).toHaveText('1');
  await expect(page.getByText('수정 필요로 표시한 항목이 있어요. 원고나 설정을 고친 뒤 다시 검수해 주세요.')).toBeVisible();
  await choice(page, '수정 필요로 표시').click();
  await choice(page, '충돌 아님으로 표시').click();
  await expect(choice(page, '충돌 아님으로 표시')).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: '검토 필요로 되돌리기' }).click();
  await expect(page.getByText('검토 필요로 되돌렸어요.').first()).toBeVisible();
  await expect(page.getByRole('button', { name: '검토 필요로 되돌리기' })).toHaveCount(0);
  await expect(counts(page, '설정 충돌', '검토 필요')).toHaveText('3');
  expect(mock.judgmentPatches().map(request => request.body)).toEqual([
    { judgment: 'NEEDS_FIX', expectedJudgmentVersion: 0, expectedCheckRevision: 1 },
    { judgment: 'NOT_CONFLICT', expectedJudgmentVersion: 1, expectedCheckRevision: 1 },
    { judgment: 'PENDING', expectedJudgmentVersion: 2, expectedCheckRevision: 1 },
  ]);
  await page.getByText('판단 기록 3개').click();
  await expect(page.locator('.vr-history-log li')).toHaveCount(3);

  // 오탈자는 수정 필요·원문 유지를 사용하고 checkRevision을 보내지 않는다.
  await row(page, 3).click();
  await expect(choice(page, '원문 유지')).toBeVisible();
  await expect(choice(page, '충돌 아님으로 표시')).toHaveCount(0);
  await choice(page, '원문 유지').click();
  await expect(choice(page, '원문 유지')).toHaveAttribute('aria-pressed', 'true');
  expect(mock.judgmentPatches().at(-1)?.body).toEqual({ judgment: 'KEEP_ORIGINAL', expectedJudgmentVersion: 0 });
  await expect(counts(page, '오탈자', '원문 유지')).toHaveText('1');
});

test('판단 409는 최신 판단을 보여 주고 사용자가 다시 고르기 전에는 덮어쓰지 않는다', async ({ page }) => {
  const mock = await open(page);
  mock.failNextJudgment({ code: 'VALIDATION_JUDGMENT_VERSION_CONFLICT', message: '판단이 바뀌었습니다.', external: { findingId: findingId(0), judgment: 'NEEDS_FIX' } });
  await choice(page, '충돌 아님으로 표시').click();
  await expect(page.getByText('다른 곳에서 판단이 바뀌었어요. 최신 판단을 확인한 뒤 다시 선택해 주세요.').first()).toBeVisible();
  await expect(choice(page, '수정 필요로 표시')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('.vr-detail-card').getByText('작가 판단 · 수정 필요')).toBeVisible();
  await page.waitForTimeout(500);
  expect(mock.judgmentPatches()).toHaveLength(1);

  await choice(page, '충돌 아님으로 표시').click();
  await expect(choice(page, '충돌 아님으로 표시')).toHaveAttribute('aria-pressed', 'true');
  expect(mock.judgmentPatches().map(request => request.body)).toEqual([
    { judgment: 'NOT_CONFLICT', expectedJudgmentVersion: 0, expectedCheckRevision: 1 },
    { judgment: 'NOT_CONFLICT', expectedJudgmentVersion: 1, expectedCheckRevision: 1 },
  ]);
});

test('새 근거로 바뀐 항목은 배지를, 이전 revision 항목은 읽기 전용 안내와 이전 판단을 보여 준다', async ({ page }) => {
  const findings = defaultFindings();
  findings[2].priorRevisions = review.responses.findingDetail.priorRevisions;
  findings[2].judgmentHistory = review.responses.findingDetail.judgmentHistory.slice(0, 1);
  const stale = {
    ...structuredClone(findings[2]), findingId: findingId(4), stale: true, changed: false,
    judgment: { value: 'NOT_CONFLICT', version: 1, decidedAt: '2026-10-30T10:01:00' }, priorRevisions: [],
  };
  const mock = await open(page, { findings: [...findings, stale] });
  await expect(row(page, 2).getByText('새 근거로 다시 확인 필요')).toBeVisible();
  await row(page, 2).click();
  await expect(page.locator('.vr-detail-card').getByText('새 근거로 다시 확인 필요')).toBeVisible();
  await expect(page.getByRole('region', { name: '이전 검사 결과' })).toContainText('설정 충돌 · 당시 판단 충돌 아님');

  await page.goto(mock.url(`&findingId=${findingId(4)}`));
  await expect(page.getByText('이 항목은 이전 검사 내용이에요.')).toBeVisible();
  await expect(choice(page, '수정 필요로 표시')).toBeDisabled();
  await expect(page.getByRole('button', { name: '검토 필요로 되돌리기' })).toBeDisabled();
  await expect(rows(page)).toHaveCount(4);
});

test('검사 중 발견한 항목은 읽기 전용이고 완료가 확인되면 판단을 열며 갱신은 초점을 옮기지 않는다', async ({ page }) => {
  const mock = await open(page, {
    findings: defaultFindings().slice(0, 2),
    staging: { executionStatus: 'RUNNING', reviewStage: 'VALIDATING' },
    summary: { judgmentLocked: true, lockReason: 'EXECUTION_IN_PROGRESS', allowedActions: [], holdReasons: ['EXECUTION_NOT_COMPLETED'] },
    results: { ...results.completed, status: 'RUNNING', settingStatus: 'RUNNING', typoStatus: 'COMPLETED' },
  });
  await expect(page.getByText('설정 충돌을 확인하고 있어요.')).toBeVisible();
  await expect(page.getByText('발견한 항목은 검사가 끝날 때까지 읽기만 할 수 있어요.')).toBeVisible();
  await expect(choice(page, '수정 필요로 표시')).toBeDisabled();
  await expect(page.getByRole('button', { name: '검토 완료 후 설정 추출' })).toHaveCount(0);
  const filter = page.getByRole('group', { name: '분류' }).getByRole('button', { name: '오탈자' });
  await filter.focus();

  mock.state.findings = defaultFindings();
  mock.patchStaging({ executionStatus: 'COMPLETED', reviewStage: 'AWAITING_REVIEW', reportVersion: 13 });
  mock.patchSummary({ judgmentLocked: false, lockReason: undefined, allowedActions: ['SAVE_JUDGMENT'], holdReasons: ['PENDING_JUDGMENTS'] });
  await expect(page.getByText('확인이 필요한 내용이 있어 설정 추출을 보류했어요.')).toBeVisible({ timeout: 8_000 });
  await expect(choice(page, '수정 필요로 표시')).toBeEnabled();
  await expect(rows(page)).toHaveCount(4);
  await expect(filter).toBeFocused();
  await expect(page).toHaveURL(new RegExp(`findingId=${findingId(0)}`));
});

test('원고 교체로 무효가 된 결과는 이전에 읽은 인용을 다시 보여 주지 않는다', async ({ page }) => {
  const mock = await open(page);
  await expect(page.getByText('비요른은 그 검을 뽑았다.').first()).toBeVisible();
  const detailReads = mock.state.detailGets;
  mock.patchStaging({ status: 'INVALIDATED', baselineStatus: 'INVALIDATED', reviewStage: 'INVALIDATED', executionStatus: 'CANCELED',
    holdReason: 'SOURCE_EVIDENCE_PURGED', reportVersion: 20 });
  mock.patchSummary({ reviewStage: 'INVALIDATED', judgmentLocked: true, lockReason: 'REPORT_INVALIDATED', allowedActions: ['RECHECK'], holdReasons: ['REPORT_INVALIDATED'] });
  mock.state.findings = [];
  await refocusWindow(page);
  await expect(page.getByText('원고 또는 비교한 설정이 바뀌었어요. 수정 내용을 반영해 다시 검수해 주세요.')).toBeVisible();
  await expect(page.getByText('원문이 변경되거나 삭제되어 당시 근거를 볼 수 없어요.')).toBeVisible();
  await expect(page.getByText('그의 검은 손잡이만 남긴 채 산산이 부서졌다.')).toHaveCount(0);
  await expect(page.getByText('비요른은 그 검을 뽑았다.')).toHaveCount(0);
  await expect(page.locator('.vr-row')).toHaveCount(0);
  await expect(page.getByRole('region', { name: '결과 요약' })).toHaveCount(0);
  // F2: 서버가 RECHECK를 허용하고 자격 조회가 최신 회차라고 확인하면 재검수를 연다(흐름은 episode-validation-recheck.spec.ts).
  await expect(page.getByRole('button', { name: '수정 내용으로 재검수' })).toBeEnabled();
  await page.getByRole('button', { name: '검사 이력' }).click();
  await expect(page.getByRole('heading', { name: '검사 이력' })).toBeVisible();
  await expect(page.getByText('그의 검은 손잡이만 남긴 채 산산이 부서졌다.')).toHaveCount(0);
  expect(mock.state.detailGets).toBe(detailReads);
});

test('확정 뒤 진단 재검수는 결과 전용 안내를 보여 주고 검토 완료 버튼을 두지 않는다', async ({ page }) => {
  await open(page, {
    staging: { mode: 'DIAGNOSTIC_ONLY', previousApplicationReceipt: { kind: 'AUTOMATIC_APPLICATION', analysisJobId: review.responses.reviewSummary.completion.extractionJobId } as never },
    summary: { mode: 'DIAGNOSTIC_ONLY', holdReasons: ['DIAGNOSTIC_ONLY', 'PENDING_JUDGMENTS'] },
  });
  await expect(page.getByText('이전 원고의 설정은 확정했어요. 이번 재검수는 검사 결과만 제공해요.').first()).toBeVisible();
  await expect(page.getByRole('button', { name: '검토 완료 후 설정 추출' })).toHaveCount(0);
  await expect(choice(page, '충돌 아님으로 표시')).toBeEnabled();
});

test('회차 전체 확정 보류는 서버 사유를 보여 주고 명시 반영 뒤 서버 결과로만 확정 완료를 표시한다', async ({ page }) => {
  // 계약 예시의 APPLICATION_HELD 검토 요약을 그대로 쓰고 집계만 목 항목에서 계산한다.
  const held: Partial<typeof review.responses.reviewSummary> = { ...review.responses.reviewSummary };
  delete held.counts;
  delete held.reportId;
  delete held.reportVersion;
  const mock = await open(page, {
    findings: judgedFindings(),
    staging: { reviewStage: 'APPLICATION_HELD', reportVersion: 15, extractionStatus: 'READY', candidateStatus: 'PENDING', extractionJobId: review.responses.reviewSummary.completion.extractionJobId },
    summary: held,
  }, '&judgment=ALL');
  await expect(page.getByText('설정 확정을 보류했어요.')).toBeVisible();
  await expect(page.getByText('캐릭터 · 반영 방식을 정해야 하는 후보가 있어요.')).toBeVisible();
  await expect(page.getByRole('link', { name: '설정 후보 확인' })).toHaveAttribute('href',
    `/setting-review?workId=${WORK_ID}&batchId=${mock.state.staging.batchId}`);
  await expect(page.getByText('이번 회차의 설정을 확정했어요.')).toHaveCount(0);
  await expect(page.getByText('검토를 마쳐 판단을 바꿀 수 없어요.')).toBeVisible();
  await page.getByRole('button', { name: '설정 확정 다시 시도' }).click();
  await expect(page.getByText('이번 회차의 설정을 확정했어요.').first()).toBeVisible();
  const request = mock.state.requests.find(item => item.path.endsWith('/settings-application'));
  expect(request?.body).toMatchObject({ expectedReportVersion: 15, idempotencyKey: expect.stringMatching(/^validation-settings-application-/) });
});

test('모든 항목을 판단하면 표시된 항목의 검토 완료를 안내하고 서버 허용 뒤에만 검토 완료를 요청한다', async ({ page }) => {
  const mock = await open(page, { findings: judgedFindings() });
  await expect(page.getByText('표시된 항목의 검토를 마쳤어요.')).toBeVisible();
  await expect(page.getByText('모든 항목의 판단을 마쳤어요.')).toBeVisible();
  const complete = page.getByRole('button', { name: '검토 완료 후 설정 추출' });
  await expect(complete).toBeEnabled();
  await complete.click();
  await expect(page.getByText('검토를 마쳤어요.', { exact: true })).toBeVisible();
  await expect(page.getByText('이번 회차의 설정을 추출하고 있어요.', { exact: true })).toBeVisible();
  const request = mock.state.requests.find(item => item.path.endsWith('/review-completion'));
  expect(request?.body).toMatchObject({ expectedReportVersion: 12, idempotencyKey: expect.stringMatching(/^validation-review-completion-/) });
  await page.getByRole('button', { name: '전체 보기' }).click();
  await expect(rows(page)).toHaveCount(4);
  await expect(page.getByText('검토를 마쳐 판단을 바꿀 수 없어요.')).toBeVisible();
});

test('검사 이력은 접힌 상태에서 열고 이전 결과 주소는 요약만 보여 준 뒤 최신 결과로 돌아간다', async ({ page }) => {
  const mock = await open(page, {}, `&findingId=${findingId(1)}`);
  await expect(page.getByRole('heading', { name: '검사 이력' })).toHaveCount(0);
  await page.getByRole('button', { name: '검사 이력' }).click();
  await expect(page).toHaveURL(/history=1/);
  const history = page.getByRole('region', { name: '검사 이력' });
  await expect(history.locator('.vr-history-row')).toHaveCount(2);
  await expect(history.locator('.vr-history-row').first()).toContainText('보고 있는 결과');
  await expect(history.locator('.vr-history-row').nth(1)).toContainText('무효');
  await history.getByRole('link', { name: '이 검수 요약 보기' }).click();
  await expect(page).toHaveURL(new RegExp(`reportId=${PAST_REPORT_ID}`));
  await expect(page.getByText('이전 검수 결과예요.')).toBeVisible();
  await expect(page.locator('.vr-row')).toHaveCount(0);
  await page.getByRole('button', { name: '최신 결과로 돌아가기' }).click();
  await expect(page).toHaveURL(new RegExp(`reportId=${REPORT_ID}.*findingId=${findingId(1)}`));
  await expect(detailHeading(page)).toHaveText('왕궁 앞뜰이 마법 금지 구역인지 확인이 필요해요');

  // 공유된 이전 결과 주소로 바로 들어와도 요약 전용이며 회차의 현재 결과를 서버에서 찾는다.
  await page.goto(`/episode-validation-report?workId=${WORK_ID}&reportId=${PAST_REPORT_ID}`);
  await expect(page.getByText('이전 검수 결과예요.')).toBeVisible();
  await page.getByRole('button', { name: '최신 결과로 돌아가기' }).click();
  await expect(page).toHaveURL(new RegExp(`reportId=${REPORT_ID}`));
  await expect(page).not.toHaveURL(/episodeId=/);
  expect(mock.state.requests.filter(request => request.method !== 'GET')).toHaveLength(0);
});

test('회차로 들어오면 서버의 현재 결과로 주소를 바꾸고 결과가 없으면 실행 없음을 알린다', async ({ page }) => {
  const mock = await mockValidationReport(page);
  await authenticate(page);
  await page.goto(`/episode-validation-report?workId=${WORK_ID}&episodeId=${EPISODE_ID}`);
  await expect(page).toHaveURL(new RegExp(`reportId=${REPORT_ID}`));
  await expect(page).not.toHaveURL(/episodeId=/);
  await expect(page.getByRole('heading', { name: '101화 오류 리포트' })).toBeVisible();
  expect(mock.state.requests).toHaveLength(0);
});

/** 다른 창의 재검수처럼 현재 report A를 퇴역시키고 새 report B를 현재로 만든다. */
function retireCurrentReport(mock: Awaited<ReturnType<typeof mockValidationReport>>) {
  const previous = mock.state.staging;
  mock.state.pastReports.set(previous.reportId, { ...previous, current: false, status: 'INVALIDATED', baselineStatus: 'INVALIDATED', reviewStage: 'INVALIDATED', executionStatus: 'CANCELED' });
  mock.patchStaging({ reportId: RECHECK_REPORT_ID, baselineId: RECHECK_REPORT_ID, revision: previous.revision + 1, previousReportId: previous.reportId, reportVersion: 1 });
}

/** 새로고침 없이 앱 안에서 주소를 바꾼다. Query 캐시가 그대로 남는 실제 화면 이동과 같다. */
async function navigateInApp(page: Page, url: string) {
  await page.evaluate(target => {
    window.history.pushState({}, '', target);
    window.dispatchEvent(new PopStateEvent('popstate'));
  }, url);
}

test('회차 주소로 다시 들어오면 이전 방문의 캐시가 아니라 새로 받은 현재 결과로 이동한다', async ({ page }) => {
  const mock = await mockValidationReport(page);
  const currentReads: string[] = [];
  page.on('request', request => { if (new URL(request.url()).pathname.endsWith('/episode-validations/current')) currentReads.push(request.url()); });
  await authenticate(page);
  const episodeUrl = `/episode-validation-report?workId=${WORK_ID}&episodeId=${EPISODE_ID}`;
  await page.goto(episodeUrl);
  await expect(page).toHaveURL(new RegExp(`reportId=${REPORT_ID}`));
  await expect(page.getByRole('heading', { name: '101화 오류 리포트' })).toBeVisible();

  await navigateInApp(page, `/dashboard?workId=${WORK_ID}&nav=analyses`);
  await expect(page.getByRole('heading', { name: '분석 목록' })).toBeVisible();
  retireCurrentReport(mock);
  const readsBefore = currentReads.length;
  await navigateInApp(page, episodeUrl);
  await expect(page).toHaveURL(new RegExp(`reportId=${RECHECK_REPORT_ID}`));
  await expect(page).not.toHaveURL(new RegExp(`reportId=${REPORT_ID}`));
  await expect(page.getByRole('heading', { name: '101화 오류 리포트' })).toBeVisible();
  await expect(page.getByText('이전 검수 결과예요.')).toHaveCount(0);
  expect(currentReads.length).toBeGreaterThan(readsBefore);
});

test('최신 결과로 돌아가기는 보던 결과가 그 사이 퇴역했으면 서버의 최신 결과로 간다', async ({ page }) => {
  const mock = await open(page, {}, `&findingId=${findingId(1)}`);
  await page.getByRole('button', { name: '검사 이력' }).click();
  await page.getByRole('region', { name: '검사 이력' }).getByRole('link', { name: '이 검수 요약 보기' }).click();
  await expect(page).toHaveURL(new RegExp(`reportId=${PAST_REPORT_ID}`));
  await expect(page.getByText('이전 검수 결과예요.')).toBeVisible();
  // 이력을 보는 동안 다른 창에서 재검수해 보던 report가 퇴역했다.
  retireCurrentReport(mock);
  await page.getByRole('button', { name: '최신 결과로 돌아가기' }).click();
  await expect(page).toHaveURL(new RegExp(`reportId=${RECHECK_REPORT_ID}`));
  // 퇴역한 report의 선택은 새 결과에 옮기지 않는다.
  expect(new URL(page.url()).searchParams.get('findingId')).not.toBe(findingId(1));
  await expect(page).not.toHaveURL(/episodeId=/);
  await expect(page.getByText('이전 검수 결과예요.')).toHaveCount(0);
});

/** 분석 목록 2페이지의 검수 카드에서 리포트 A로 들어온다. 목록은 배치 요약만 응답한다. */
async function enterFromAnalysisList(page: Page) {
  const mock = await mockValidationReport(page);
  await page.route('**/analysis-jobs/batches**', route => route.fulfill({ contentType: 'application/json', body: JSON.stringify({
    success: true, data: { content: [{ batchId: mock.state.staging.batchId, uploadType: 'SINGLE_EPISODE', status: 'ERROR_REVIEW_PENDING',
      episodeStatus: 'ERROR_REVIEW_PENDING', episodeStartNo: 101, episodeEndNo: 101, episodeCount: 1, jobGroups: [], episodeJobGroups: [],
      settingBooks: [], validationReports: [{ ...review.responses.batchValidationReport, reviewStage: 'AWAITING_REVIEW' }] }],
    page: 1, size: 10, totalPages: 2, totalElements: 11 }, error: null }) }));
  await authenticate(page);
  await page.goto(`/dashboard?workId=${WORK_ID}&nav=analyses&analysisPage=2`);
  await page.getByTestId('validation-analysis-card').getByRole('button', { name: '오류 리포트 보기' }).click();
  await expect(page).toHaveURL(new RegExp(`reportId=${REPORT_ID}`));
  await expect(page.locator('#validation-report-title')).toBeVisible();
  await page.getByRole('button', { name: '검사 이력' }).click();
  await page.getByRole('region', { name: '검사 이력' }).getByRole('link', { name: '이 검수 요약 보기' }).click();
  await expect(page).toHaveURL(new RegExp(`reportId=${PAST_REPORT_ID}`));
  await expect(page.getByText('이전 검수 결과예요.')).toBeVisible();
}

const analysisListUrl = new RegExp(`/dashboard\\?workId=${WORK_ID}&nav=analyses&analysisPage=2$`);

test('분석 목록에서 들어와 이전 결과로 이동한 뒤에도 분석 목록 복귀는 원래 목록 페이지로 간다', async ({ page }) => {
  await enterFromAnalysisList(page);
  await page.getByRole('button', { name: '← 분석 목록' }).click();
  await expect(page).toHaveURL(analysisListUrl);
  await expect(page.getByRole('heading', { name: '분석 목록' })).toBeVisible();
});

test('이전 결과에서 최신 결과로 돌아온 뒤 분석 목록 복귀도 원래 목록 페이지로 간다', async ({ page }) => {
  await enterFromAnalysisList(page);
  await page.getByRole('button', { name: '최신 결과로 돌아가기' }).click();
  await expect(page).toHaveURL(new RegExp(`reportId=${REPORT_ID}`));
  await expect(page.getByText('이전 검수 결과예요.')).toHaveCount(0);
  await page.getByRole('button', { name: '분석 목록으로', exact: true }).first().click();
  await expect(page).toHaveURL(analysisListUrl);
  await expect(page.getByRole('heading', { name: '분석 목록' })).toBeVisible();
});

test('현재 결과가 없는 회차는 실행 없음과 분석 목록 이동을 제공한다', async ({ page }) => {
  await mockValidationReport(page, { currentReportMissing: true });
  await authenticate(page);
  await page.goto(`/episode-validation-report?workId=${WORK_ID}&episodeId=${EPISODE_ID}`);
  await expect(page.getByText('이 회차에는 아직 오류 검사 결과가 없어요.')).toBeVisible();
  await page.getByRole('button', { name: '분석 목록으로', exact: true }).last().click();
  await expect(page).toHaveURL(new RegExp(`/dashboard\\?workId=${WORK_ID}&nav=analyses`));
});

test('조건에 맞는 항목이 없으면 전체 0건과 구분하고 필터를 초기화한다', async ({ page }) => {
  const mock = await open(page, {}, '&branch=TYPO&judgment=NEEDS_FIX&page=3&outcome=CONFLICT');
  // 분류와 맞지 않는 결과 유형과 범위를 벗어난 페이지는 정규화한다.
  await expect(page).not.toHaveURL(/outcome=/);
  await expect(page).not.toHaveURL(/page=/);
  await expect(page.getByText('조건에 맞는 항목이 없어요.')).toBeVisible();
  await expect(page.getByText('확인한 범위에서 찾은 항목이 없어요.')).toHaveCount(0);
  await page.getByRole('button', { name: '필터 초기화' }).click();
  await expect(page).not.toHaveURL(/branch=|judgment=/);
  await expect(rows(page)).toHaveCount(4);
  expect(mock.state.findingQueries.at(-1)).toContain('judgment=PENDING');
});

test('320px에서는 이름 있는 선택 메뉴로 목록과 상세를 오가며 주요 버튼은 44px 이상이다', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await open(page);
  await expect(page.getByRole('combobox', { name: '작가 판단' })).toBeVisible();
  await expect(page.getByRole('combobox', { name: '분류' })).toBeVisible();
  await expect(page.locator('.vr-detail')).toBeHidden();
  await expect(page).not.toHaveURL(/findingId=/);
  expect(await noHorizontalOverflow(page)).toBe(true);
  expect(await minHeight(page.getByRole('button', { name: '검토 완료 후 설정 추출' }))).toBeGreaterThanOrEqual(44);

  await page.getByRole('combobox', { name: '분류' }).selectOption('SETTING');
  await expect(page).toHaveURL(/branch=SETTING/);
  await expect(rows(page)).toHaveCount(3);
  await row(page, 1).click();
  await expect(page.locator('.vr-sidebar')).toBeHidden();
  await expect(detailHeading(page)).toBeFocused();
  expect(await noHorizontalOverflow(page)).toBe(true);
  for (const button of [page.getByRole('button', { name: '목록으로', exact: true }), choice(page, '수정 필요로 표시'), choice(page, '충돌 아님으로 표시')]) {
    expect(await minHeight(button)).toBeGreaterThanOrEqual(44);
  }
  await page.getByRole('button', { name: '목록으로', exact: true }).click();
  await expect(page.locator('.vr-sidebar')).toBeVisible();
  await expect(row(page, 1)).toBeFocused();
  expect(await noHorizontalOverflow(page)).toBe(true);
});

test('키보드로 항목을 열면 상세 제목으로, 목록 복귀는 원래 항목이나 목록 제목으로 초점을 돌린다', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await open(page);
  await row(page, 2).focus();
  await page.keyboard.press('Enter');
  await expect(detailHeading(page)).toBeFocused();
  await expect(detailHeading(page)).toHaveText('에르웬 망토 색이 기존 기록과 다를 수 있어요');
  await page.keyboard.press('Tab');
  await expect(page.locator(':focus')).not.toHaveAttribute('id', 'validation-finding-title');

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(page.url().replace(/&findingId=[^&]+/, ''));
  await row(page, 0).focus();
  await page.keyboard.press('Enter');
  await expect(detailHeading(page)).toBeFocused();
  // 판단 저장으로 검토 필요 목록에서 빠진 항목은 목록 제목으로 돌아간다.
  await choice(page, '충돌 아님으로 표시').press('Enter');
  await expect(choice(page, '충돌 아님으로 표시')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('.vr-row')).toHaveCount(3);
  await page.getByRole('button', { name: '목록으로', exact: true }).press('Enter');
  await expect(page.getByRole('heading', { name: '검사 항목', exact: true })).toBeFocused();
  await row(page, 1).focus();
  await page.keyboard.press('Enter');
  await page.getByRole('button', { name: '목록으로', exact: true }).press('Enter');
  await expect(row(page, 1)).toBeFocused();
});

test('주요 문구와 상태 배지는 Theme V2 표면에서 4.5:1 이상 대비를 유지한다', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await open(page);
  await expect(detailHeading(page)).toBeVisible();
  const canvas = page.locator('main');
  const checks: Array<[string, Locator, Locator]> = [
    ['단계 안내', page.locator('.vr-status .review-cb-notice strong').first(), page.locator('.vr-status .review-cb-notice').first()],
    ['보류 사유', page.locator('.vr-hold-list li').first(), page.locator('.vr-status .review-cb-notice').first()],
    ['작품·회차', page.locator('.vr-status__identity small'), page.locator('.vr-status')],
    ['경고 배지', row(page, 0).locator('.vr-chip.is-warning').first(), row(page, 0).locator('.vr-chip.is-warning').first()],
    ['심각 배지', row(page, 0).locator('.vr-chip.is-danger'), row(page, 0).locator('.vr-chip.is-danger')],
    ['결과 유형 배지', row(page, 1).locator('.vr-chip.is-primary'), row(page, 1).locator('.vr-chip.is-primary')],
    ['목록 인용', row(page, 1).locator('.vr-row__quote'), row(page, 1)],
    ['선택 행 제목', row(page, 0).locator('.vr-row__title'), row(page, 0)],
    ['검토 필요 건수', counts(page, '설정 충돌', '검토 필요'), page.locator('.vr-counts__group').first()],
    ['집계 라벨', page.locator('.vr-counts__metrics dt').first(), page.locator('.vr-counts__group').first()],
    ['분석 목록 링크', page.getByRole('button', { name: '← 분석 목록' }), canvas],
    ['대상 설정 안내', page.locator('#validation-target-name'), page.locator('.vr-detail-body')],
    ['대상 라벨', row(page, 0).locator('.vr-chip--subject'), row(page, 0).locator('.vr-chip--subject')],
    ['판단 이유 한 줄', row(page, 1).locator('.vr-row__reason'), row(page, 1)],
    ['상세 사유', page.locator('.vr-detail-summary'), page.locator('.vr-detail-card > header')],
    ['블록 머리말', block(page, 0).locator('.vr-block__label'), header(page, 0)],
    ['이번 원고 표지', block(page, 0).locator('.vr-block__role'), block(page, 0).locator('.vr-block__role')],
    ['기준 표지', block(page, 1).locator('.vr-block__role'), block(page, 1).locator('.vr-block__role')],
    ['문맥 줄', lines(page, 0).first(), block(page, 0)],
    ['인용 줄', block(page, 0).locator('.vr-block__line.is-quote mark'), block(page, 0).locator('.vr-block__line.is-quote mark')],
    ['더 보기', block(page, 0).getByRole('button', { name: '위로 더 보기' }), block(page, 0).getByRole('button', { name: '위로 더 보기' })],
    ['판단 안내', page.locator('.vr-judgment > .vr-muted'), page.locator('.vr-detail-body')],
  ];
  for (const [name, text, background] of checks) {
    await expect(text, name).toBeVisible();
    expect(await computedContrastRatio(text, background, canvas), name).toBeGreaterThanOrEqual(4.5);
  }
});
