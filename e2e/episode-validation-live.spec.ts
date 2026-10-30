import { expect, type APIRequestContext, type Page } from '@playwright/test';
import { test } from './local-live-fixture';
import { purgeWorkAndWait } from './live-work-purge';

/**
 * GH314 V1 실제 연결: Front → Java(local) → 일회용 PostgreSQL → AI Worker(실제 모델).
 * 공통 live 환경(`CATCHHOLE_E2E_*`)과 같은 API에 붙은 추출·검수 Worker(`CATCHHOLE_E2E_VALIDATION_WORKER=1`)가
 * 있을 때만 실행한다. 모델 호출을 줄이려고 한 작품의 짧은 합성 원고 두 회차만 사용한다.
 * 핵심 경로만 확인한다: 1화 기존 설정 구축 → 2화 신규 회차 검수 → 실제 리포트 → 판단 저장 → 검토 완료 → 확정 단계 → 다음 회차 차단.
 */
const EPISODE_1 = `1화 등대지기

바닷가 마을 하람에는 오래된 하얀 등대가 있다. 등대지기 서윤은 서른 살이고, 매일 저녁 여섯 시에 등대에 불을 켠다.

서윤에게는 하얀 털을 가진 진돗개 모래가 있다. 모래는 서윤이 등대 계단을 오를 때마다 계단 아래에서 기다린다.

하람 마을의 배들은 해가 지기 전에 항구로 돌아와야 한다. 이것은 마을 사람들이 오래전부터 지켜 온 약속이다.
`;
// 맞춤법 오탈자 하나(됬다 → 됐다)만 심었다. 설정은 1화와 모두 같다.
const EPISODE_2 = `2화 조용한 저녁

저녁 여섯 시가 되자 서윤은 등대 계단을 올라 불을 켰다. 하얀 진돗개 모래는 계단 아래에서 꼬리를 흔들며 기다렸다.

해가 지기 전에 마을의 배들이 하나둘 항구로 돌아왔다. 마지막 배까지 무사히 돌아오게 됬다.

서윤은 등대 창가에 앉아 오늘 바다가 조용했다고 일지에 적었다.
`;
const STAGE_TIMEOUT = 25 * 60_000;
const TERMINAL_EXECUTION = new Set(['COMPLETED', 'PARTIAL', 'FAILED', 'CANCELED']);

type Json = Record<string, unknown> & { data?: unknown };
type Staging = { reportId: string; reviewStage: string; executionStatus: string };
type Finding = { findingId: string; branch: 'SETTING' | 'TYPO'; checkRevision: number | null; judgment: { value: string; version: number } | null };

async function data<T>(response: Awaited<ReturnType<APIRequestContext['get']>>): Promise<T> {
  expect(response.ok(), `${response.status()} ${response.url()}`).toBeTruthy();
  return ((await response.json()) as Json).data as T;
}

async function poll<T>(read: () => Promise<T>, done: (value: T) => boolean, timeout: number, label: string): Promise<T> {
  const deadline = Date.now() + timeout;
  for (;;) {
    const value = await read();
    if (done(value)) return value;
    if (Date.now() > deadline) throw new Error(`${label} 대기 시간이 지났습니다.`);
    await new Promise(resolve => setTimeout(resolve, 5_000));
  }
}

async function dismissGuide(page: Page) {
  const guide = page.getByRole('dialog', { name: '설정이 반영되는 과정을 살펴보세요' });
  if (await guide.isVisible().catch(() => false)) {
    await page.keyboard.press('Escape');
    await expect(guide).toHaveCount(0);
  }
}

async function chooseSingleUpload(page: Page, workId: string, episodeNo: number, text: string) {
  await page.goto(`/episode-upload?workId=${workId}`);
  await page.getByRole('button', { name: /단일 회차 업로드/ }).click();
  await dismissGuide(page);
  await page.locator('input[type=file]').first().setInputFiles({ name: `${episodeNo}화.txt`, mimeType: 'text/plain', buffer: Buffer.from(text) });
  await expect(page.getByPlaceholder('비우면 파일에서 감지')).toHaveValue(String(episodeNo));
}

test.setTimeout(45 * 60_000);

test('1화 설정 구축 뒤 2화 신규 회차 검수가 실제 리포트·판단·검토 완료·다음 회차 차단까지 이어진다', async ({ page, request, liveAccount }, testInfo) => {
  test.skip(process.env.CATCHHOLE_E2E_VALIDATION_WORKER !== '1',
    '같은 로컬 API에 연결된 추출·검수 Worker가 필요합니다(CATCHHOLE_E2E_VALIDATION_WORKER=1). 실제 모델을 호출합니다.');
  const { api, email, password } = liveAccount;
  const token = (await data<{ accessToken: string }>(await request.post(`${api}/api/v1/auth/login`, { data: { email, password } }))).accessToken;
  const headers = { Authorization: `Bearer ${token}` };
  const base = (workId: string) => `${api}/api/v1/works/${workId}`;
  const workId = (await data<{ id: string }>(await request.post(`${api}/api/v1/works`, { headers, data: { title: '등대 검수 검증', genre: '일상' } }))).id;
  const note = (type: string, description: string) => testInfo.annotations.push({ type, description });
  try {
    await page.goto('/login');
    await page.evaluate(value => localStorage.setItem('accessToken', value), token);
    await page.setViewportSize({ width: 1440, height: 900 });

    // 1화: 기존 설정 구축(자동 반영). 화면이 SETTING_EXTRACTION Job을 만들고 Worker가 처리한다.
    await chooseSingleUpload(page, workId, 1, EPISODE_1);
    await expect(page.getByRole('button', { name: /^기존 설정 구축/ })).toHaveAttribute('aria-pressed', 'true');
    await page.getByRole('button', { name: '다음 — 분석 시작' }).click();
    await expect(page).toHaveURL(/currentAnalysisJobIds=/);
    const jobs = await poll(async () => data<Array<{ status: string; automaticAppliedAt: string | null }>>(await request.get(`${base(workId)}/analysis-jobs`, { headers })),
      list => list.length === 1 && ['SUCCEEDED', 'FAILED', 'CANCELED'].includes(list[0].status), STAGE_TIMEOUT, '1화 설정 추출');
    expect(jobs[0].status).toBe('SUCCEEDED');
    expect(jobs[0].automaticAppliedAt).not.toBeNull();

    // 2화: 신규 회차 검수. 업로드 뒤 설정 추출 Job 없이 접수하고 리포트로 이동한다.
    await chooseSingleUpload(page, workId, 2, EPISODE_2);
    await page.getByRole('button', { name: /^신규 회차 검수/ }).click();
    await page.getByRole('button', { name: '다음 — 검수 시작' }).click();
    await expect(page).toHaveURL(/\/episode-validation-report\?workId=.+&reportId=/, { timeout: 60_000 });
    const reportId = new URL(page.url()).searchParams.get('reportId')!;
    await expect(page.locator('#validation-report-title')).toHaveText('2화 오류 리포트');
    expect(await data<unknown[]>(await request.get(`${base(workId)}/analysis-jobs`, { headers }))).toHaveLength(1);

    const startedAt = Date.now();
    const staging = await poll(async () => data<Staging>(await request.get(`${base(workId)}/episode-validations/${reportId}`, { headers })),
      value => TERMINAL_EXECUTION.has(value.executionStatus), STAGE_TIMEOUT, '오류 검사');
    note('validation-seconds', String(Math.round((Date.now() - startedAt) / 1000)));
    expect(staging.executionStatus, '실제 모델 검사가 두 분기 모두 끝나야 합니다.').toBe('COMPLETED');
    expect(staging.reviewStage).toBe('AWAITING_REVIEW');
    const findings = (await data<{ content: Finding[] }>(await request.get(`${base(workId)}/episode-validations/${reportId}/findings?size=100`, { headers }))).content;
    const typos = findings.filter(finding => finding.branch === 'TYPO');
    note('findings', `setting=${findings.length - typos.length} typo=${typos.length}`);
    expect(typos.length, '심어 둔 맞춤법 오류(됬다)를 제안해야 합니다.').toBeGreaterThanOrEqual(1);

    // 검토 전에는 다음 회차 등록이 화면과 서버 양쪽에서 막힌다.
    await page.goto(`/episode-upload?workId=${workId}`);
    const blocked = page.getByTestId('next-episode-blocked');
    await expect(blocked).toContainText('이 회차의 검토와 설정 저장을 마친 뒤 다음 회차를 등록할 수 있어요.');
    await expect(blocked).toContainText('검토 중인 회차: 2화');
    const upload = await request.post(`${base(workId)}/episodes`, { headers, multipart: {
      metadata: { name: 'metadata.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify({ uploadType: 'SINGLE_EPISODE', singleEpisodeNo: 3, singleEpisodeTitle: '다음 회차' })) },
      episodeFiles: { name: '3화.txt', mimeType: 'text/plain', buffer: Buffer.from('3화 다음 회차\n\n서윤은 다음 날에도 등대에 불을 켰다.') },
    } });
    expect(upload.status()).toBe(409);
    expect(((await upload.json()) as { error: { code: string } }).error.code).toBe('VALIDATION_NEXT_EPISODE_BLOCKED');
    expect(await data<unknown[]>(await request.get(`${base(workId)}/episodes`, { headers }))).toHaveLength(2);
    await blocked.getByRole('link', { name: '현재 리포트로 이동' }).click();
    await expect(page).toHaveURL(new RegExp(`reportId=${reportId}`));

    // 실제 결과 하나는 화면에서 판단한다. 오탈자는 원문 유지로 해소해 검토 완료 조건을 만든다.
    const typo = typos[0];
    await page.goto(`/episode-validation-report?workId=${workId}&reportId=${reportId}&findingId=${typo.findingId}`);
    await expect(page.locator('.vr-row').first()).toBeVisible();
    await page.locator('.vr-judgment').getByRole('button', { name: /^원문 유지/ }).click();
    await expect(page.locator('.vr-detail-card').getByText('작가 판단 · 원문 유지')).toBeVisible();
    // 모델이 더 낸 항목은 API로 같은 해소 판단을 저장한다(건수는 annotation으로 남긴다).
    for (const finding of findings.filter(item => item.findingId !== typo.findingId)) {
      const saved = await request.patch(`${base(workId)}/episode-validations/${reportId}/findings/${finding.findingId}/judgment`, { headers, data: {
        judgment: finding.branch === 'TYPO' ? 'KEEP_ORIGINAL' : 'NOT_CONFLICT', expectedJudgmentVersion: finding.judgment?.version ?? 0, expectedCheckRevision: finding.checkRevision,
      } });
      expect(saved.ok()).toBeTruthy();
    }
    const summary = await data<{ canCompleteReview: boolean; completionMode: string }>(await request.get(`${base(workId)}/episode-validations/${reportId}/review`, { headers }));
    expect(summary).toMatchObject({ canCompleteReview: true, completionMode: 'EXPLICIT_REQUIRED' });
    // 마지막 판단 저장만으로는 추출 Job이 생기지 않는다.
    expect(await data<unknown[]>(await request.get(`${base(workId)}/analysis-jobs`, { headers }))).toHaveLength(1);

    await page.reload();
    const complete = page.getByRole('button', { name: '검토 완료 후 설정 추출' });
    await expect(complete).toBeEnabled();
    await complete.click();
    const released = await poll(async () => data<Staging>(await request.get(`${base(workId)}/episode-validations/${reportId}`, { headers })),
      value => ['APPLIED', 'APPLICATION_HELD', 'EXTRACTION_FAILED'].includes(value.reviewStage), STAGE_TIMEOUT, '검토 완료 뒤 설정 추출');
    note('final-stage', released.reviewStage);
    expect(['APPLIED', 'APPLICATION_HELD']).toContain(released.reviewStage);
    expect(await data<unknown[]>(await request.get(`${base(workId)}/analysis-jobs`, { headers }))).toHaveLength(2);
    await page.reload();
    await expect(page.locator('.vr-status')).toContainText(released.reviewStage === 'APPLIED' ? '확정 완료' : '확정 보류');

    const admission = await data<{ nextEpisodeAdmission: { allowed: boolean } }>(await request.get(`${base(workId)}/episode-validations/eligibility`, { headers }));
    expect(admission.nextEpisodeAdmission.allowed).toBe(released.reviewStage === 'APPLIED');
    // 실행 기록용: 이 일회용 계정이 쓴 AI 사용량(Terra는 환산 1배라 raw token과 같다).
    const usage = await data<{ usedTokens: number }>(await request.get(`${api}/api/v1/ai-token-usages/me`, { headers }));
    note('ai-used-tokens', String(usage.usedTokens));
  } finally {
    await purgeWorkAndWait(request, api, headers.Authorization, workId);
  }
});
