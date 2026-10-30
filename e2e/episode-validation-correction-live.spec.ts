import { expect, type APIRequestContext, type Locator, type Response as PageResponse } from '@playwright/test';
import { test } from './local-live-fixture';
import { purgeWorkAndWait } from './live-work-purge';
import { buildEpisode1Settings, data, poll, STAGE_TIMEOUT, submitValidation, TERMINAL_EXECUTION } from './validation-live-helpers';

/**
 * GH314 F3 실제 연결: A10 설정 정보 정정 → receipt → A11 수정 내용으로 재검수.
 * Front → Java(local) → 일회용 PostgreSQL → AI Worker(실제 모델). `episode-validation-live`와 같은 조건(live fixture 변수 +
 * 같은 API에 붙은 추출·검수 Worker, `CATCHHOLE_E2E_VALIDATION_WORKER=1`)에서만 실행한다.
 * 2화에 1화(서른 살)와 바로 어긋나는 나이 서술 하나를 심고, 검토 대기(AWAITING_REVIEW) 리포트의 설정 검사 항목에서 서윤의 나이를 정정한다.
 * 나이가 바뀌었다고 읽힐 문장(`올해로 … 되었다`)은 변화·예외 판단을 부르므로(#341) 변화 없는 서술로 심는다.
 * 2화 검사와 재검수는 각각 PARTIAL로 끝나면(#341) 서버가 RETRY를 허용할 때만 작가 경로(`중단된 검사 다시 시도`)로 한 번씩 다시 시도한다.
 * 정정은 고정 기준과 현재 설정이 그대로일 때만 저장되므로 검토 완료·설정 추출 전에 한다(Backend validation-execution-v1.md "명시적 기준 정정").
 * 화면·서버 흐름(정정 저장·기준 무효화·RECHECK·새 report 연결·재검수 종료)은 바로 확인한다.
 * 모델 판정(정정 전 나이 충돌·정정 후 해소)과 #341(검수 Worker가 변화·예외 조회 없는 충돌 의심 판정을 분기 전체 실패로 처리)의
 * 알려진 PARTIAL(`INVALID_DECISION_CHANGE_SEARCH_MISSING`)은 annotation으로만 남기고 spec을 실패시키지 않으며,
 * #341 해결 뒤 재검수 COMPLETED를 hard로 되돌린다. 그 외 비정상 종료는 실패한다.
 */
// episode-validation-live의 2화 첫 문단 뒤에 변화가 아닌 나이 모순 문단 하나만 더했다. 오탈자(됬다)와 나머지 문장은 같다.
const EPISODE_2 = `2화 조용한 저녁

저녁 여섯 시가 되자 서윤은 등대 계단을 올라 불을 켰다. 하얀 진돗개 모래는 계단 아래에서 꼬리를 흔들며 기다렸다.

등대지기 서윤은 스물여덟 살이다.

해가 지기 전에 마을의 배들이 하나둘 항구로 돌아왔다. 마지막 배까지 무사히 돌아오게 됬다.

서윤은 등대 창가에 앉아 오늘 바다가 조용했다고 일지에 적었다.
`;
const CHARACTER = '서윤';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const CORRECTING_COPY = '오류 리포트에서 설정 정보를 정정하러 왔어요.';
const LINKED_COPY = '저장됐어요. 리포트로 돌아가 재검수해 주세요.';

type AuthHeaders = { Authorization: string };
type Staging = {
  reportId: string; reportVersion: number; reviewStage: string; executionStatus: string; current: boolean; mode: string; previousReportId: string | null;
  baselineId: string | null; baselineRevision: number | null; baselineHash: string | null;
};
type Basis = {
  entryRef: string; entryHash: string; subjectType: 'CHARACTER' | 'WORLD_SETTING'; targetId: string; subjectName: string;
  factType: string | null; factKey: string | null; scopeName: string | null; settingName: string | null; currentVersion: number | null;
};
type Finding = { findingId: string; branch: 'SETTING' | 'TYPO' };
type FindingDetail = Finding & {
  payload: { impact?: string; reason?: string } | null;
  subject: { type: string; id: string | null; name: string } | null;
  settingName: string | null;
  settingKey: string | null;
  basis: Basis[] | null;
};
/** 정정 응답. `entityVersion`은 정정을 저장한 뒤의 캐릭터 snapshot version이다(캐릭터 상세 응답에는 version이 없다). */
type Receipt = { correctionId: string; entityVersion: number };

/** 목록은 대상·basis를 주지 않으므로 설정 검사 항목은 상세를 읽는다. */
async function readFindings(request: APIRequestContext, reportUrl: string, headers: AuthHeaders) {
  const findings = (await data<{ content: Finding[] }>(await request.get(`${reportUrl}/findings?size=100`, { headers }))).content;
  const settings: FindingDetail[] = [];
  for (const finding of findings) {
    if (finding.branch === 'SETTING') settings.push(await data<FindingDetail>(await request.get(`${reportUrl}/findings/${finding.findingId}`, { headers })));
  }
  return { settings, counts: `setting=${settings.length} typo=${findings.length - settings.length}` };
}

const characterBasis = (finding: FindingDetail) => (finding.basis ?? []).filter(entry => entry.subjectType === 'CHARACTER' && entry.subjectName === CHARACTER);

/**
 * annotation용 서윤 나이 충돌: 서윤 캐릭터 basis가 있고 나이를 가리키는 표시가 하나라도 있다. 서버는 모델 문구가 slot과 정확히 맞을 때만
 * basis slot·`settingKey`를 채우므로(Backend validation-review-v1.md B2 "알려진 한계") 설정명과 판정 사유 문구도 본다. 정정 대상 선택에는 쓰지 않는다.
 */
const isAgeConflict = (finding: FindingDetail) => {
  const entries = characterBasis(finding);
  return entries.length > 0 && (entries.some(entry => entry.factType === 'AGE') || finding.settingKey === 'AGE:age'
    || (finding.settingName ?? '').includes('나이') || /나이|살/.test(finding.payload?.reason ?? ''));
};

/**
 * 정정할 항목과 basis. 서윤 basis가 나이 slot(AGE)을 가리키는 항목을 먼저 고르고, 없으면 slot이 비어 작가가 바꾼 slot 하나로
 * 정정하는 basis를 쓴다. 다른 slot을 가리키는 basis로는 나이 정정을 연결할 수 없다(화면이 저장 전에 막는다).
 */
function chooseCorrection(settings: FindingDetail[]) {
  for (const fits of [(entry: Basis) => entry.factType === 'AGE', (entry: Basis) => entry.factType == null]) {
    for (const finding of settings) {
      const entry = characterBasis(finding).find(fits);
      if (entry) return { finding, entry };
    }
  }
  return null;
}

/** 고르지 못했을 때 실패 메시지에 남길 요약. 대상·설정명·basis 대상만 쓰고 원문·설정값은 넣지 않는다. */
const summarize = (settings: FindingDetail[]) => settings.map(finding => `[subject=${finding.subject?.name ?? '없음'} setting=${finding.settingName ?? '없음'} basis=${
  (finding.basis ?? []).map(entry => `${entry.subjectType}:${entry.subjectName}:${entry.factType ?? '-'}`).join(',') || '없음'}]`).join(' ') || '설정 검사 항목 없음';

async function saveCharacter(dialog: Locator) {
  await dialog.locator('.character-detail-actions').getByRole('button', { name: '저장', exact: true }).click();
  await dialog.locator('.character-confirm-dialog').getByRole('button', { name: '저장', exact: true }).click();
}

/** 저장 뒤 모달 안내가 정정 중 안내에서 결과(연결·409 거절·응답 유실·slot 안내)로 바뀔 때까지 기다려 그 문구를 돌려준다. */
async function settledNotice(notice: Locator) {
  await expect(notice.locator('strong')).not.toHaveText(CORRECTING_COPY, { timeout: 60_000 });
  return (await notice.innerText()).replace(/\s+/g, ' ').trim();
}

test.setTimeout(45 * 60_000);

test('검토 대기 리포트에서 서윤의 나이를 정정하면 receipt로 재검수해 정정한 설정으로 새 리포트를 만든다', async ({ page, request, liveAccount }, testInfo) => {
  test.skip(process.env.CATCHHOLE_E2E_VALIDATION_WORKER !== '1',
    '같은 로컬 API에 연결된 추출·검수 Worker가 필요합니다(CATCHHOLE_E2E_VALIDATION_WORKER=1). 실제 모델을 호출합니다.');
  const { api, email, password } = liveAccount;
  const token = (await data<{ accessToken: string }>(await request.post(`${api}/api/v1/auth/login`, { data: { email, password } }))).accessToken;
  const headers = { Authorization: `Bearer ${token}` };
  const workId = (await data<{ id: string }>(await request.post(`${api}/api/v1/works`, { headers, data: { title: '등대 정정 검증', genre: '일상' } }))).id;
  const workUrl = `${api}/api/v1/works/${workId}`;
  const reportUrl = (reportId: string) => `${workUrl}/episode-validations/${reportId}`;
  const readStaging = async (reportId: string) => data<Staging>(await request.get(reportUrl(reportId), { headers }));
  const note = (type: string, description: string) => testInfo.annotations.push({ type, description });
  const untilTerminal = (reportId: string, label: string) => poll(() => readStaging(reportId), value => TERMINAL_EXECUTION.has(value.executionStatus), STAGE_TIMEOUT, label);
  /** COMPLETED가 아니면 실패 메시지·annotation에 남길 실행 요약과 실패 코드. `/results`의 상태·실패 코드만 쓰고 원문·인용은 넣지 않는다. */
  const execution = async (staging: Staging) => {
    if (staging.executionStatus === 'COMPLETED') return { summary: '', failureCode: null };
    const response = await request.get(`${reportUrl(staging.reportId)}/results`, { headers });
    const results = response.ok() ? ((await response.json()) as { data?: Record<string, unknown> }).data ?? {} : {};
    const field = (key: string) => String(results[key] ?? '없음');
    const summary = ` executionStatus=${staging.executionStatus} status=${field('status')} settingStatus=${field('settingStatus')} `
      + `typoStatus=${field('typoStatus')} failureCode=${field('failureCode')}`;
    return { summary, failureCode: typeof results.failureCode === 'string' ? results.failureCode : null };
  };
  /**
   * PARTIAL이면 작가 경로로 한 번만 다시 시도한다. 서버 `/review`가 RETRY를 허용할 때만 리포트의 `중단된 검사 다시 시도`를 누르고,
   * 접수(실행 상태가 종료를 벗어나거나 reportVersion 증가 — 서버는 둘을 한 트랜잭션에서 바꾼다)를 확인한 뒤 다시 종료까지 기다린다.
   * `run`은 다시 시도한 검사(`first` 2화 검사, `recheck` 재검수)이며 annotation으로 남긴다. 화면은 이미 그 report에 있다.
   */
  const retryPartialOnce = async (partial: Staging, run: 'first' | 'recheck') => {
    const review = await data<{ reviewStage: string; allowedActions: string[] }>(await request.get(`${reportUrl(partial.reportId)}/review`, { headers }));
    if (!review.allowedActions.includes('RETRY')) {
      throw new Error(`검사가 PARTIAL로 끝났지만 다시 시도를 허용하지 않습니다: executionStatus=${partial.executionStatus} reviewStage=${review.reviewStage}`);
    }
    await page.reload();
    const retryStartedAt = Date.now();
    await page.getByRole('region', { name: '검사 기준과 범위' }).getByRole('button', { name: '중단된 검사 다시 시도', exact: true }).click();
    await poll(() => readStaging(partial.reportId),
      value => !TERMINAL_EXECUTION.has(value.executionStatus) || value.reportVersion > partial.reportVersion, 60_000, '중단된 검사 다시 시도 접수');
    const retried = await untilTerminal(partial.reportId, `다시 시도한 오류 검사(${run})`);
    note('retry-used', run);
    note(`retry-seconds-${run}`, String(Math.round((Date.now() - retryStartedAt) / 1000)));
    return retried;
  };
  // 새 fixture 계정이면 첫 분석 안내가 한 번 열린다. 서버 판단을 먼저 읽어 그때만 기다린다.
  const guideFirst = (await data<{ shouldShow: boolean }>(await request.get(`${api}/api/v1/analysis-mode-guides`, { headers }))).shouldShow;
  try {
    await page.goto('/login');
    await page.evaluate(value => localStorage.setItem('accessToken', value), token);
    await page.setViewportSize({ width: 1440, height: 900 });

    // 1화 기존 설정 구축. 정정할 나이 slot(서른 살 → 30)이 서윤의 현재 설정에 있어야 이 시나리오가 성립한다.
    await buildEpisode1Settings(page, request, { workId, workUrl, headers }, guideFirst);
    const characters = (await data<{ content: Array<{ id: string; name: string }> }>(await request.get(`${workUrl}/characters?page=0&size=24`, { headers }))).content;
    const characterId = characters.find(item => item.name === CHARACTER)?.id;
    if (!characterId) throw new Error(`1화 설정 구축이 캐릭터 ${CHARACTER}를 만들지 않았습니다: ${characters.map(item => item.name).join(', ') || '캐릭터 없음'}`);
    const readAge = async () => (await data<{ currentAge: number | null }>(await request.get(`${workUrl}/characters/${characterId}`, { headers }))).currentAge;
    expect(await readAge(), `1화의 '서른 살'이 ${CHARACTER}의 나이 slot(AGE) 30으로 저장돼야 정정할 수 있습니다.`).toBe(30);

    // 2화 신규 회차 검수. 검토 대기에서 멈춰 있어야 기준을 정정할 수 있다.
    const reportId = await submitValidation(page, workId, 2, EPISODE_2);
    await expect(page.locator('#validation-report-title')).toHaveText('2화 오류 리포트');
    const startedAt = Date.now();
    let staging = await untilTerminal(reportId, '오류 검사');
    note('validation-seconds', String(Math.round((Date.now() - startedAt) / 1000)));
    if (staging.executionStatus === 'PARTIAL') staging = await retryPartialOnce(staging, 'first');
    expect(staging.executionStatus, `실제 모델 검사가 두 분기 모두 끝나야 합니다.${(await execution(staging)).summary}`).toBe('COMPLETED');
    expect(staging.reviewStage).toBe('AWAITING_REVIEW');

    // 정정할 항목은 서윤 캐릭터 basis가 있는 설정 검사 항목이다. 없으면 심은 나이 모순을 서버 기준과 잇지 못한 것이므로 멈춘다.
    const before = await readFindings(request, reportUrl(reportId), headers);
    note('findings', before.counts);
    note('setting-findings-before', summarize(before.settings));
    const ageBefore = before.settings.filter(isAgeConflict).length;
    // 모델 판정이므로 기록만 한다. 서윤 basis가 있는 항목은 아래 chooseCorrection이 바로 확인한다.
    note('age-conflict-before', String(ageBefore));
    const chosen = chooseCorrection(before.settings);
    if (!chosen) {
      throw new Error(`${CHARACTER} 캐릭터 basis(나이 slot 또는 slot 미지정)가 있는 설정 검사 항목이 없습니다: ${summarize(before.settings)}`);
    }
    const { finding, entry } = chosen;
    note('chosen-finding', `impact=${finding.payload?.impact ?? '없음'} subject=${finding.subject ? `${finding.subject.type}:${finding.subject.name}` : '없음'} `
      + `settingName=${finding.settingName ?? '없음'} settingKey=${finding.settingKey ?? '없음'} basis=${finding.basis?.length ?? 0} factType=${entry.factType ?? '없음'}`);
    expect(entry.targetId, `basis의 대상이 ${CHARACTER} 캐릭터여야 합니다.`).toBe(characterId);
    expect(typeof entry.currentVersion, '고정 기준 당시 snapshot version이 있어야 정정으로 연결할 수 있습니다.').toBe('number');
    const baselineVersion = entry.currentVersion!;

    // 정정 요청 하나가 편집과 receipt를 함께 저장한다. 일반 저장(PATCH)은 보내지 않는다.
    const corrections: PageResponse[] = [];
    let plainSaves = 0;
    page.on('response', response => {
      const { pathname } = new URL(response.url());
      const method = response.request().method();
      if (method === 'POST' && pathname.endsWith(`/episode-validations/${reportId}/corrections`)) corrections.push(response);
      if (method === 'PATCH' && pathname.endsWith(`/characters/${characterId}`)) plainSaves += 1;
    });

    // A10: 원고·설정 수정에서 고른 basis의 정정을 연다. basis가 하나면 `설정 정보 정정`, 여럿이면 `캐릭터 · 서윤 … 정정`이다.
    await page.goto(`/episode-validation-report?workId=${workId}&reportId=${reportId}&branch=SETTING&findingId=${finding.findingId}`);
    const fix = page.getByRole('region', { name: '원고·설정 수정' });
    const link = fix.getByRole('link', { name: new RegExp(`^(설정 정보 정정|캐릭터 · ${CHARACTER}( · .+)? 정정)$`) })
      .and(fix.locator(`[href*="correctionEntryRef=${entry.entryRef}&"]`));
    await expect(link).toBeVisible();
    note('correction-link', await link.innerText());
    const current = await readStaging(reportId);
    await link.click();

    await expect(page).toHaveURL(/\/dashboard\?/);
    const opened = new URL(page.url()).searchParams;
    expect(Object.fromEntries(opened)).toMatchObject({
      modal: 'char-detail', charId: characterId, mode: 'edit', returnTo: 'validation-report', reportId,
      correctionSubjectType: 'CHARACTER', correctionTargetId: characterId, correctionEntryRef: entry.entryRef,
      correctionBaselineId: current.baselineId, correctionBaselineRevision: String(current.baselineRevision),
      correctionVersion: String(baselineVersion),
    });
    // hash는 값을 출력하지 않고 일치 여부만 본다.
    expect(opened.get('correctionEntryHash') === entry.entryHash, 'correctionEntryHash가 basis의 entryHash와 같아야 합니다.').toBe(true);
    expect(Boolean(current.baselineHash) && opened.get('correctionBaselineHash') === current.baselineHash,
      'correctionBaselineHash가 단건 조회 baselineHash와 같아야 합니다.').toBe(true);
    note('correction-slot', opened.get('correctionFactType') ? `${opened.get('correctionFactType')}:${opened.get('correctionFactKey')}` : '없음(바꾼 slot 하나)');

    const dialog = page.getByRole('dialog', { name: `${CHARACTER} 캐릭터 상세` });
    const notice = page.getByTestId('validation-correction-notice');
    await expect(notice).toContainText(CORRECTING_COPY);
    const age = dialog.getByRole('textbox', { name: '현재 나이' });
    await expect(age).toHaveValue('30');
    await age.fill('28');
    await saveCharacter(dialog);
    // 409(기준과 지금 저장된 설정이 다름)·응답 유실·slot 안내면 실제 서버와 화면 계약이 어긋난 것이므로 그 안내로 멈춘다.
    const shown = await settledNotice(notice);
    expect(shown, `정정이 receipt로 연결되지 않았습니다. 화면 안내: ${shown}`).toContain(LINKED_COPY);
    const saved = new URL(page.url()).searchParams;
    const receiptId = saved.get('correctionReceiptId') ?? '';
    expect(saved.get('correctionResult')).toBe('linked');
    expect(receiptId).toMatch(UUID);
    expect(saved.get('mode')).toBeNull();
    await expect.poll(() => corrections.length, '정정 요청은 한 번만 보낸다').toBe(1);
    expect(plainSaves, '정정 문맥의 저장은 일반 캐릭터 저장을 보내지 않는다').toBe(0);
    const receipt = ((await corrections[0].json()) as { data: Receipt }).data;
    expect(receipt.correctionId).toBe(receiptId);

    // 저장은 실제 캐릭터 설정을 바꾸고 snapshot version을 올린다. report는 현재 결과로 남되 기준이 무효가 되어 RECHECK가 열린다.
    expect(await readAge(), '정정한 나이가 캐릭터 현재 설정에 저장돼야 합니다.').toBe(28);
    note('snapshot-version', `${baselineVersion} → ${receipt.entityVersion}`);
    expect(receipt.entityVersion, '정정 저장이 캐릭터 snapshot version을 올려야 합니다.').toBeGreaterThan(baselineVersion);
    const invalidated = await readStaging(reportId);
    expect(invalidated.current, '정정은 현재 report를 바꾸지 않는다').toBe(true);
    const review = await data<{ reviewStage: string; allowedActions: string[] }>(await request.get(`${reportUrl(reportId)}/review`, { headers }));
    note('corrected-stage', `staging=${invalidated.reviewStage} review=${review.reviewStage}`);
    expect(review.allowedActions, '정정으로 기준이 무효가 된 현재 report는 재검수를 연다').toContain('RECHECK');

    // A11: 리포트로 돌아가면 receipt가 주소에 남고, 재검수는 그 receipt와 report의 기준 fingerprint를 보낸다.
    await notice.getByRole('link', { name: '오류 리포트로 돌아가기' }).click();
    await expect(page).toHaveURL(new RegExp(`/episode-validation-report\\?.*reportId=${reportId}`));
    expect(new URL(page.url()).searchParams.get('correctionReceiptId')).toBe(receiptId);
    await expect(page.getByText('원고 또는 비교한 설정이 바뀌었어요. 수정 내용을 반영해 다시 검수해 주세요.').first()).toBeVisible();
    await expect(page.getByText('설정 정정을 저장했어요. 수정 내용으로 재검수하면 정정한 설정으로 다시 검사해요.')).toBeVisible();
    await page.getByRole('button', { name: '수정 내용으로 재검수', exact: true }).click();
    const confirm = page.getByTestId('validation-recheck-confirm');
    await expect(confirm).toContainText('검사에 쓴 설정을 정정했어요. 정정한 설정을 작가 정정으로 연결해 다시 검사해요.');
    await confirm.getByRole('button', { name: '재검수 시작', exact: true }).click();
    // 서버가 receipt·기준 식별값·원고 확인을 거절하면 확인 영역에 남은 안내로 멈춘다.
    await expect(page).toHaveURL(url => {
      const next = url.searchParams.get('reportId');
      return url.pathname === '/episode-validation-report' && Boolean(next) && next !== reportId;
    }, { timeout: 60_000 }).catch(async () => {
      const left = await confirm.innerText({ timeout: 5_000 }).catch(() => '없음');
      throw new Error(`재검수가 새 report로 넘어가지 않았습니다. 화면 안내: ${left.replace(/\s+/g, ' ').trim()}`);
    });
    const recheckId = new URL(page.url()).searchParams.get('reportId')!;
    // 새 결과로 넘어가면 이전 report의 receipt는 주소에 남지 않는다.
    expect(new URL(page.url()).searchParams.get('correctionReceiptId')).toBeNull();
    await expect(page.locator('#validation-report-title')).toHaveText('2화 오류 리포트');
    expect((await readStaging(recheckId)).previousReportId, '새 report는 정정한 report를 잇는다').toBe(reportId);
    expect((await readStaging(reportId)).current, '재검수 뒤 이전 report는 현재 결과가 아니다').toBe(false);

    const recheckStartedAt = Date.now();
    let finished = await untilTerminal(recheckId, '재검수 오류 검사');
    note('recheck-seconds', String(Math.round((Date.now() - recheckStartedAt) / 1000)));
    if (finished.executionStatus === 'PARTIAL') finished = await retryPartialOnce(finished, 'recheck');
    note('recheck-stage', `${finished.reviewStage} mode=${finished.mode}`);
    const recheckExecution = await execution(finished);
    note('recheck-execution', recheckExecution.summary.trim() || `executionStatus=${finished.executionStatus}`);
    expect(['FAILED', 'CANCELED'], `재검수가 실패·취소로 끝났습니다.${recheckExecution.summary}`).not.toContain(finished.executionStatus);
    const recheckCompleted = finished.executionStatus === 'COMPLETED';
    // #341의 알려진 PARTIAL은 기록만 하고 실패시키지 않는다. 해결 뒤 이 분기를 지우고 COMPLETED를 hard로 되돌린다.
    const knownPartial = finished.executionStatus === 'PARTIAL' && recheckExecution.failureCode === 'INVALID_DECISION_CHANGE_SEARCH_MISSING';
    if (knownPartial) note('known-issue', 'catchhole-backend-java#341');
    else expect(finished.executionStatus, `정정한 설정으로 다시 검사한 두 분기가 모두 끝나야 합니다.${recheckExecution.summary}`).toBe('COMPLETED');
    expect.soft(finished.mode, '아무것도 확정하지 않았으므로 확정 전 검수다.').toBe('BEFORE_CONFIRMATION');

    // 정정한 나이(28)는 2화의 스물여덟 살과 맞으므로 같은 나이 충돌이 다시 나오지 않기를 기대한다(모델 판정).
    const after = await readFindings(request, reportUrl(recheckId), headers);
    note('recheck-findings', after.counts);
    note('setting-findings-after', summarize(after.settings));
    // 모델 판정이므로 기록만 한다. 검사를 마치지 못한 재검수에서는 충돌이 없다는 판단을 내릴 수 없다.
    note('age-conflict-after', recheckCompleted ? String(after.settings.filter(isAgeConflict).length) : '미판정');
    // 실행 기록용: 이 일회용 계정이 쓴 AI 사용량(1화 추출·두 번의 검수 합계).
    const usage = await data<{ usedTokens: number }>(await request.get(`${api}/api/v1/ai-token-usages/me`, { headers }));
    note('ai-used-tokens', String(usage.usedTokens));
  } finally {
    await purgeWorkAndWait(request, api, headers.Authorization, workId);
  }
});
