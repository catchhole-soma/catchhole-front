import { expect, type APIRequestContext, type Page } from '@playwright/test';
import type { AnalysisJobResponse } from '../src/app/api/generated/types.gen';
import { isCompletedOrderedAnalysis, isInvalidatedAnalysis } from '../src/app/lib/ordered-analysis';

/**
 * GH314 신규 회차 검수 실제 연결 spec(`episode-validation-live`, `episode-validation-correction-live`)의 공통 준비.
 * 같은 1화 원고·대기 시간·응답 읽기·업로드 선택·1화 기존 설정 구축을 두 spec이 같은 문구와 시간으로 쓴다.
 */
const EPISODE_1 = `1화 등대지기

바닷가 마을 하람에는 오래된 하얀 등대가 있다. 등대지기 서윤은 서른 살이고, 매일 저녁 여섯 시에 등대에 불을 켠다.

서윤에게는 하얀 털을 가진 진돗개 모래가 있다. 모래는 서윤이 등대 계단을 오를 때마다 계단 아래에서 기다린다.

하람 마을의 배들은 해가 지기 전에 항구로 돌아와야 한다. 이것은 마을 사람들이 오래전부터 지켜 온 약속이다.
`;
export const STAGE_TIMEOUT = 25 * 60_000;
export const TERMINAL_EXECUTION = new Set(['COMPLETED', 'PARTIAL', 'FAILED', 'CANCELED']);

type Json = Record<string, unknown> & { data?: unknown };

export async function data<T>(response: Awaited<ReturnType<APIRequestContext['get']>>): Promise<T> {
  expect(response.ok(), `${response.status()} ${response.url()}`).toBeTruthy();
  return ((await response.json()) as Json).data as T;
}

export async function poll<T>(read: () => Promise<T>, done: (value: T) => boolean, timeout: number, label: string): Promise<T> {
  const deadline = Date.now() + timeout;
  for (;;) {
    const value = await read();
    if (done(value)) return value;
    if (Date.now() > deadline) throw new Error(`${label} 대기 시간이 지났습니다.`);
    await new Promise(resolve => setTimeout(resolve, 5_000));
  }
}

/** 처음 분석하는 계정의 일회 안내는 조회·400ms 타이머·선점 뒤 늦게 열린다. analysis-mode-guide-live처럼 열릴 때까지 기다렸다 닫는다. */
async function chooseSingleUpload(page: Page, workId: string, episodeNo: number, text: string, expectGuide: boolean) {
  await page.goto(`/episode-upload?workId=${workId}`);
  await page.getByRole('button', { name: /단일 회차 업로드/ }).click();
  const guide = page.getByRole('dialog', { name: '설정이 반영되는 과정을 살펴보세요' });
  if (expectGuide) {
    await expect(guide).toBeVisible();
    await page.keyboard.press('Escape');
  }
  await expect(guide).toHaveCount(0);
  await page.locator('input[type=file]').first().setInputFiles({ name: `${episodeNo}화.txt`, mimeType: 'text/plain', buffer: Buffer.from(text) });
  await expect(page.getByPlaceholder('비우면 파일에서 감지')).toHaveValue(String(episodeNo));
}

/** 실제 연결 작품 하나. `workUrl`은 `${api}/api/v1/works/${workId}`다. */
type LiveWork = { workId: string; workUrl: string; headers: { Authorization: string } };

/** 1화: 기존 설정 구축(자동 반영). 화면이 SETTING_EXTRACTION Job을 만들고 Worker가 처리한다. */
export async function buildEpisode1Settings(page: Page, request: APIRequestContext, { workId, workUrl, headers }: LiveWork, expectGuide: boolean) {
  await chooseSingleUpload(page, workId, 1, EPISODE_1, expectGuide);
  await expect(page.getByRole('button', { name: /^기존 설정 구축/ })).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: '다음 — 분석 시작' }).click();
  await expect(page).toHaveURL(/currentAnalysisJobIds=/);
  // 화면과 같은 완료 기준(SUCCEEDED+SEALED+자동 반영 시각)까지 기다리고, 스스로 끝나지 않는 상태에서는 바로 멈춘다.
  const stopped = (job: AnalysisJobResponse) => job.status === 'FAILED' || job.status === 'CANCELED' || isInvalidatedAnalysis(job)
    || (job.status === 'SUCCEEDED' && job.analysisRun?.journalStatus === 'INCOMPLETE');
  const jobs = await poll(async () => data<AnalysisJobResponse[]>(await request.get(`${workUrl}/analysis-jobs`, { headers })),
    list => list.length === 1 && (isCompletedOrderedAnalysis(list[0]) || stopped(list[0])), STAGE_TIMEOUT, '1화 설정 추출·자동 반영');
  expect(isCompletedOrderedAnalysis(jobs[0]),
    `1화 설정 추출이 자동 반영까지 끝나지 않았습니다: status=${jobs[0].status} journal=${jobs[0].analysisRun?.journalStatus ?? '없음'} `
    + `automaticAppliedAt=${jobs[0].automaticAppliedAt ?? '없음'} failureCode=${jobs[0].failureCode ?? '없음'}`).toBe(true);
}

/** 신규 회차 검수로 접수한다. 업로드 뒤 설정 추출 Job 없이 리포트로 이동하며 그 reportId를 돌려준다. */
export async function submitValidation(page: Page, workId: string, episodeNo: number, text: string) {
  await chooseSingleUpload(page, workId, episodeNo, text, false);
  await page.getByRole('button', { name: /^신규 회차 검수/ }).click();
  await page.getByRole('button', { name: '다음 — 검수 시작' }).click();
  await expect(page).toHaveURL(/\/episode-validation-report\?workId=.+&reportId=/, { timeout: 60_000 });
  return new URL(page.url()).searchParams.get('reportId')!;
}
