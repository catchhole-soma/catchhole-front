import { expect, test, type Page } from '@playwright/test';
import { computedContrastRatio } from './contrast';
import review from './fixtures/validation/validation-review-v1.json' with { type: 'json' };
import {
  authenticate,
  BJORN_BASIS,
  CHARACTER_ID,
  CORRECTION_RECEIPT_ID,
  defaultFindings,
  ERWEN_BASIS,
  ERWEN_ID,
  findingId,
  mockValidationReport,
  PALACE_BASIS,
  RECHECK_REPORT_ID,
  REPORT_ID,
  WORK_ID,
  WORLD_ID,
  type ReportScenario,
} from './fixtures/validation/report-mock';

/**
 * GH314 F3 A10 설정 정보 정정. 발견 항목 상세의 basis[]와 report 단건 조회 값만으로 정정 요청을 만들고
 * (Backend docs/validation-execution-v1.md "발견 항목에서 정정 요청 만들기", 계약 correctionFromFindingBasis),
 * 설정 관리의 저장이 `POST /{reportId}/corrections` 하나로 편집과 receipt를 함께 저장한 뒤 재검수에 receipt를 보낸다.
 */
async function open(page: Page, scenario: ReportScenario = {}, query = '') {
  const mock = await mockValidationReport(page, scenario);
  await authenticate(page);
  await page.goto(mock.url(query));
  await expect(page.locator('#validation-report-title')).toBeVisible();
  return mock;
}

const correctionRequests = (mock: Awaited<ReturnType<typeof mockValidationReport>>) => mock.requestsTo('/corrections');
const characterDialog = (page: Page, name: string) => page.getByRole('dialog', { name: `${name} 캐릭터 상세` });
const modalNotice = (page: Page) => page.getByTestId('validation-correction-notice');

async function saveCharacter(page: Page, name: string, label = '저장') {
  const dialog = characterDialog(page, name);
  await dialog.locator('.character-detail-actions').getByRole('button', { name: label, exact: true }).click();
  await dialog.locator('.character-confirm-dialog').getByRole('button', { name: '저장', exact: true }).click();
}

test('캐릭터 기준 항목이 하나면 바로 편집을 열고, 저장은 정정 요청 하나로 보내 receipt로 재검수한다', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const mock = await open(page, {}, `&branch=SETTING&findingId=${findingId(0)}`);
  const staging = structuredClone(mock.state.staging);
  const fix = page.getByRole('region', { name: '원고·설정 수정' });
  await expect(fix.locator('#validation-correction-target')).toHaveText('캐릭터 · 비요른 · 검 설정을 고쳐요.');
  await fix.getByRole('link', { name: '설정 정보 정정', exact: true }).click();

  await expect(page).toHaveURL(/\/dashboard\?/);
  const params = Object.fromEntries(new URL(page.url()).searchParams);
  expect(params).toEqual({
    workId: WORK_ID, nav: 'settingDB', tab: 'characters', modal: 'char-detail', charId: CHARACTER_ID, mode: 'edit',
    returnTo: 'validation-report', reportId: REPORT_ID, reportFindingId: findingId(0), reportBranch: 'SETTING',
    // 값은 basis[0]와 report 단건 조회에서 그대로 옮긴다.
    correctionBaselineId: staging.baselineId, correctionBaselineRevision: String(staging.baselineRevision),
    correctionBaselineHash: staging.baselineHash, correctionEntryRef: BJORN_BASIS.entryRef, correctionEntryHash: BJORN_BASIS.entryHash,
    correctionSubjectType: 'CHARACTER', correctionTargetId: CHARACTER_ID, correctionVersion: String(BJORN_BASIS.currentVersion),
    correctionFactType: 'ITEM', correctionFactKey: 'item.검',
  });
  const dialog = characterDialog(page, '비요른');
  await expect(modalNotice(page)).toContainText('오류 리포트에서 설정 정보를 정정하러 왔어요.');
  await expect(modalNotice(page)).toContainText('검사한 설정 하나만 바꿔 저장하면 이 검사 기준과 연결해요.');
  // 밝은 상세 모달 안에서도 안내 제목·본문은 4.5:1 이상이다.
  const noticeBox = modalNotice(page).locator('.review-cb-notice');
  for (const text of [noticeBox.locator('strong'), noticeBox.locator('p').first()]) {
    expect(await computedContrastRatio(text, noticeBox, dialog)).toBeGreaterThanOrEqual(4.5);
  }

  await dialog.getByRole('textbox', { name: '검 값' }).fill('다시 벼린 검');
  await saveCharacter(page, '비요른');
  await expect(modalNotice(page)).toContainText('저장됐어요. 리포트로 돌아가 재검수해 주세요.');
  const [request] = correctionRequests(mock);
  expect(request.path).toBe(`/api/v1/works/${WORK_ID}/episode-validations/${REPORT_ID}/corrections`);
  expect(request.body).toEqual({
    idempotencyKey: expect.stringMatching(/^validation-correction-/),
    expectedReportVersion: staging.reportVersion,
    baselineId: staging.baselineId,
    expectedBaselineRevision: staging.baselineRevision,
    expectedBaselineHash: staging.baselineHash,
    entryRef: 'B1',
    expectedEntryHash: BJORN_BASIS.entryHash,
    character: {
      targetId: CHARACTER_ID, expectedSnapshotVersion: 3, factType: 'ITEM', factKey: 'item.검',
      edit: expect.objectContaining({
        name: '비요른', roleLabel: '주인공', currentAge: 27,
        items: [expect.objectContaining({ key: 'item.검', value: '다시 벼린 검' })],
        profile: [expect.objectContaining({ key: 'profile.출신', value: '북부' })],
      }),
    },
  });
  // 일반 저장(PATCH)은 보내지 않는다. 정정 요청 하나가 편집과 receipt를 함께 저장한다.
  expect(mock.requestsTo(`/characters/${CHARACTER_ID}`, 'PATCH')).toHaveLength(0);
  const after = new URL(page.url()).searchParams;
  expect(after.get('correctionResult')).toBe('linked');
  expect(after.get('correctionReceiptId')).toBe(CORRECTION_RECEIPT_ID);
  expect(after.get('mode')).toBeNull();
  for (const key of ['correctionEntryRef', 'correctionEntryHash', 'correctionBaselineHash', 'correctionVersion', 'correctionFactKey']) {
    expect(after.get(key), key).toBeNull();
  }
  // 설정값·인용은 주소와 저장소에 남기지 않는다.
  const stored = await page.evaluate(() => JSON.stringify({ ...localStorage, ...sessionStorage }));
  for (const value of ['다시 벼린 검', '부서진 검', '부서졌다']) {
    expect(decodeURIComponent(page.url())).not.toContain(value);
    expect(stored).not.toContain(value);
  }

  await modalNotice(page).getByRole('link', { name: '오류 리포트로 돌아가기' }).click();
  await expect(page).toHaveURL(new RegExp(`reportId=${REPORT_ID}`));
  const report = new URL(page.url()).searchParams;
  expect(report.get('correctionReceiptId')).toBe(CORRECTION_RECEIPT_ID);
  expect(report.get('findingId')).toBe(findingId(0));
  await expect(page.getByText('원고 또는 비교한 설정이 바뀌었어요. 수정 내용을 반영해 다시 검수해 주세요.').first()).toBeVisible();
  await expect(page.getByText('설정 정정을 저장했어요. 수정 내용으로 재검수하면 정정한 설정으로 다시 검사해요.')).toBeVisible();
  // 복귀만으로 새 검수를 시작하지 않는다.
  expect(mock.requestsTo('/rechecks')).toHaveLength(0);

  await page.getByRole('button', { name: '수정 내용으로 재검수', exact: true }).click();
  const confirm = page.getByTestId('validation-recheck-confirm');
  await expect(confirm).toContainText('검사에 쓴 설정을 정정했어요. 정정한 설정을 작가 정정으로 연결해 다시 검사해요.');
  const fingerprint = mock.state.staging.baselineFingerprint;
  await confirm.getByRole('button', { name: '재검수 시작', exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`reportId=${RECHECK_REPORT_ID}`));
  const [recheck] = mock.requestsTo('/rechecks');
  expect(recheck.body).toMatchObject({ correctionReceiptId: CORRECTION_RECEIPT_ID, expectedBaselineHash: fingerprint });
  // 새 결과로 넘어가면 이전 report의 receipt는 주소에 남지 않는다.
  expect(new URL(page.url()).searchParams.get('correctionReceiptId')).toBeNull();
});

test('세계관 기준 항목이 여러 개면 작가가 고르고, 경로가 정해진 설정의 수정을 열어 정정한다', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const mock = await open(page, {}, `&findingId=${findingId(1)}`);
  const staging = structuredClone(mock.state.staging);
  const fix = page.getByRole('region', { name: '원고·설정 수정' });
  await expect(fix.getByText('이 항목이 비교한 저장 설정이 여러 개예요. 고칠 설정을 골라 주세요.')).toBeVisible();
  await expect(fix.getByRole('link', { name: '캐릭터 · 에르웬 정정', exact: true })).toBeVisible();
  await fix.getByRole('link', { name: '세계관 · 왕궁 · 마법 / 사용 제한 정정', exact: true }).click();

  const params = new URL(page.url()).searchParams;
  expect(params.get('tab')).toBe('worldsettings');
  expect(params.get('settingId')).toBe(WORLD_ID);
  expect(params.get('correctionEntryRef')).toBe(PALACE_BASIS.entryRef);
  expect(params.get('correctionScopeName')).toBe('마법');
  expect(params.get('correctionSettingName')).toBe('사용 제한');
  expect(params.get('correctionVersion')).toBe('4');
  const dialog = page.getByRole('dialog', { name: '왕궁 세계관 상세' });
  await expect(modalNotice(page)).toContainText('마법 / 사용 제한 설정의 값을 고쳐 저장하면 이 검사 기준과 연결해요.');
  // 경로가 정해진 정정은 그 설정의 수정을 바로 연다.
  const editor = dialog.locator('.world-setting-property-editor');
  await expect(editor.getByRole('textbox', { name: '설정명' })).toHaveValue('사용 제한');
  await editor.getByRole('textbox', { name: '설정값' }).fill('왕궁 건물 안에서만 마법을 쓸 수 없다');
  await editor.getByRole('button', { name: '저장', exact: true }).click();
  await expect(modalNotice(page)).toContainText('저장됐어요. 리포트로 돌아가 재검수해 주세요.');
  const [request] = correctionRequests(mock);
  expect(request.body).toEqual({
    idempotencyKey: expect.stringMatching(/^validation-correction-/),
    expectedReportVersion: staging.reportVersion,
    baselineId: staging.baselineId,
    expectedBaselineRevision: staging.baselineRevision,
    // 정정은 report 단건 조회의 baselineHash를 보낸다(재검수의 baselineFingerprint와 다르다).
    expectedBaselineHash: staging.baselineHash,
    entryRef: 'B2',
    expectedEntryHash: PALACE_BASIS.entryHash,
    worldSetting: {
      targetId: WORLD_ID, expectedVersion: 4,
      edit: { currentScopeName: '마법', currentSettingName: '사용 제한', scopeName: '마법', settingName: '사용 제한', settingValue: '왕궁 건물 안에서만 마법을 쓸 수 없다', version: 4 },
    },
  });
  expect(mock.requestsTo(`/world-settings/${WORLD_ID}/properties`, 'PATCH')).toHaveLength(0);
  await expect(editor).toHaveCount(0);
  const back = new URL(await modalNotice(page).getByRole('link', { name: '오류 리포트로 돌아가기' }).getAttribute('href') ?? '', 'http://localhost');
  expect(back.searchParams.get('correctionReceiptId')).toBe(CORRECTION_RECEIPT_ID);
  expect(back.searchParams.get('findingId')).toBe(findingId(1));
});

test('정정 409는 아무것도 저장하지 않았다고 알리고 다시 저장할 때만 기준 연결 없이 일반 저장한다', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const mock = await open(page, {}, `&findingId=${findingId(0)}`);
  await page.getByRole('link', { name: '설정 정보 정정', exact: true }).click();
  const dialog = characterDialog(page, '비요른');
  mock.failNextCorrection({ status: 409, code: 'VALIDATION_CORRECTION_CONFLICT', message: '정정할 기준 항목을 정확히 연결할 수 없습니다.' });
  await dialog.getByRole('textbox', { name: '검 값' }).fill('다시 벼린 검');
  await saveCharacter(page, '비요른');
  await expect(modalNotice(page).locator('strong')).toHaveText('검수 기준과 지금 저장된 설정이 달라 정정으로 저장하지 못했어요.');
  await expect(modalNotice(page)).toContainText('입력한 내용은 그대로예요. 다시 저장하면 검수 기준과 연결하지 않고 저장해요.');
  await expect(modalNotice(page)).not.toContainText('저장됐');
  // 편집과 입력을 유지하고, 일반 저장은 아직 보내지 않는다.
  await expect(dialog.getByRole('textbox', { name: '검 값' })).toHaveValue('다시 벼린 검');
  expect(mock.requestsTo(`/characters/${CHARACTER_ID}`, 'PATCH')).toHaveLength(0);
  expect(correctionRequests(mock)).toHaveLength(1);

  await saveCharacter(page, '비요른', '기준 연결 없이 저장');
  await expect(modalNotice(page)).toContainText('저장됐지만 검수 기준 연결을 확인하지 못했어요.');
  expect(mock.requestsTo(`/characters/${CHARACTER_ID}`, 'PATCH')).toHaveLength(1);
  expect(correctionRequests(mock)).toHaveLength(1);
  const params = new URL(page.url()).searchParams;
  expect(params.get('correctionResult')).toBe('unlinked');
  expect(params.get('correctionReceiptId')).toBeNull();
  expect(params.get('mode')).toBeNull();
  await modalNotice(page).getByRole('link', { name: '오류 리포트로 돌아가기' }).click();
  await expect(page).toHaveURL(new RegExp(`reportId=${REPORT_ID}`));
  expect(new URL(page.url()).searchParams.get('correctionReceiptId')).toBeNull();
  await expect(page.getByText('설정 정정을 저장했어요.', { exact: false })).toHaveCount(0);
});

test('기준 slot이 없는 캐릭터 정정은 작가가 바꾼 설정 하나를 보내고, 여러 설정을 바꾸면 요청하지 않는다', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const mock = await open(page, {}, `&findingId=${findingId(2)}`);
  await page.getByRole('link', { name: '설정 정보 정정', exact: true }).click();
  expect(new URL(page.url()).searchParams.get('correctionFactType')).toBeNull();
  const dialog = characterDialog(page, '에르웬');
  await dialog.getByRole('textbox', { name: '망토 값' }).fill('붉은 망토');
  await dialog.getByRole('textbox', { name: '현재 나이' }).fill('25');
  await saveCharacter(page, '에르웬');
  await expect(modalNotice(page).locator('strong')).toHaveText('정정은 설정 하나만 바꿀 수 있어요.');
  await expect(modalNotice(page)).toContainText('다른 설정은 원래대로 두고 저장해 주세요.');
  expect(correctionRequests(mock)).toHaveLength(0);

  await dialog.getByRole('textbox', { name: '현재 나이' }).fill('24');
  await saveCharacter(page, '에르웬');
  await expect(modalNotice(page)).toContainText('저장됐어요. 리포트로 돌아가 재검수해 주세요.');
  const [request] = correctionRequests(mock);
  expect(request.body).toMatchObject({
    entryRef: ERWEN_BASIS.entryRef, expectedEntryHash: ERWEN_BASIS.entryHash,
    character: { targetId: ERWEN_ID, expectedSnapshotVersion: 2, factType: 'PROFILE', factKey: 'profile.망토',
      edit: { currentAge: 24, profile: [expect.objectContaining({ key: 'profile.망토', value: '붉은 망토' })] } },
  });
});

test('정정 응답이 유실되면 입력을 유지하고 다시 저장할 때 같은 키·같은 요청으로 receipt를 확인한다', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const mock = await open(page, {}, `&findingId=${findingId(0)}`);
  await page.getByRole('link', { name: '설정 정보 정정', exact: true }).click();
  const dialog = characterDialog(page, '비요른');
  mock.loseNextCorrectionResponse();
  await dialog.getByRole('textbox', { name: '검 값' }).fill('다시 벼린 검');
  await saveCharacter(page, '비요른');
  await expect(modalNotice(page).locator('strong')).toHaveText('정정 결과를 확인하지 못했어요.');
  await expect(modalNotice(page)).toContainText('입력한 내용은 그대로예요. 다시 저장하면 같은 요청으로 확인해요.');
  await expect(dialog.getByRole('textbox', { name: '검 값' })).toHaveValue('다시 벼린 검');
  await saveCharacter(page, '비요른');
  await expect(modalNotice(page)).toContainText('저장됐어요. 리포트로 돌아가 재검수해 주세요.');
  const [first, second] = correctionRequests(mock);
  // 서버는 이미 저장했으므로 report version이 올랐지만, 같은 요청을 다시 보내 원래 receipt를 받는다.
  expect(second.body).toEqual(first.body);
  expect(mock.state.corrections.size).toBe(1);
  expect(new URL(page.url()).searchParams.get('correctionReceiptId')).toBe(CORRECTION_RECEIPT_ID);
});

type CorrectionBody = { idempotencyKey: string };
/** 다시 연결되면 Query가 화면의 조회를 다시 읽는다. 응답 유실 뒤 서버에 이미 저장된 값이 상세에 들어온다. */
async function reconnectAndRefetch(page: Page, path: string) {
  const refetched = page.waitForResponse(response => response.request().method() === 'GET' && new URL(response.url()).pathname === path);
  await page.context().setOffline(true);
  await page.context().setOffline(false);
  return (await (await refetched).json()).data;
}

test('정정 응답 유실 뒤 다시 읽은 캐릭터 상세가 초안과 같아도 바뀐 설정을 따지기 전에 같은 요청을 다시 보낸다', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const mock = await open(page, {}, `&findingId=${findingId(0)}`);
  await page.getByRole('link', { name: '설정 정보 정정', exact: true }).click();
  const dialog = characterDialog(page, '비요른');
  mock.loseNextCorrectionResponse();
  await dialog.getByRole('textbox', { name: '검 값' }).fill('다시 벼린 검');
  await saveCharacter(page, '비요른');
  await expect(modalNotice(page).locator('strong')).toHaveText('정정 결과를 확인하지 못했어요.');

  // 서버는 이미 저장했으므로 다시 읽은 상세의 값이 편집 초안과 같다.
  const detail = await reconnectAndRefetch(page, `/api/v1/works/${WORK_ID}/characters/${CHARACTER_ID}`) as { items: Array<{ key: string; value: string }> };
  expect(detail.items.find(item => item.key === 'item.검')?.value).toBe('다시 벼린 검');
  await expect(dialog.getByRole('textbox', { name: '검 값' })).toHaveValue('다시 벼린 검');

  await saveCharacter(page, '비요른');
  await expect(modalNotice(page)).toContainText('저장됐어요. 리포트로 돌아가 재검수해 주세요.');
  await expect(modalNotice(page)).not.toContainText('바뀐 설정이 없어요');
  const requests = correctionRequests(mock);
  expect(requests).toHaveLength(2);
  const [first, second] = requests;
  expect((second.body as CorrectionBody).idempotencyKey).toBe((first.body as CorrectionBody).idempotencyKey);
  expect(second.body).toEqual(first.body);
  expect(mock.state.corrections.size).toBe(1);
  expect(new URL(page.url()).searchParams.get('correctionResult')).toBe('linked');
  expect(new URL(page.url()).searchParams.get('correctionReceiptId')).toBe(CORRECTION_RECEIPT_ID);
});

test('세계관 정정도 응답 유실 뒤 상세를 다시 읽으면 같은 키·같은 요청으로 receipt를 확인한다', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const mock = await open(page, {}, `&findingId=${findingId(1)}`);
  await page.getByRole('region', { name: '원고·설정 수정' }).getByRole('link', { name: '세계관 · 왕궁 · 마법 / 사용 제한 정정', exact: true }).click();
  const editor = page.getByRole('dialog', { name: '왕궁 세계관 상세' }).locator('.world-setting-property-editor');
  const value = '왕궁 건물 안에서만 마법을 쓸 수 없다';
  mock.loseNextCorrectionResponse();
  await editor.getByRole('textbox', { name: '설정값' }).fill(value);
  await editor.getByRole('button', { name: '저장', exact: true }).click();
  await expect(modalNotice(page).locator('strong')).toHaveText('정정 결과를 확인하지 못했어요.');

  const detail = await reconnectAndRefetch(page, `/api/v1/works/${WORK_ID}/world-settings/${WORLD_ID}`) as { version: number; properties: Array<{ scopeName?: string | null; settingName: string; value: string }> };
  expect(detail.properties.find(item => item.scopeName === '마법' && item.settingName === '사용 제한')?.value).toBe(value);
  expect(detail.version).toBe(5);
  await expect(editor.getByRole('textbox', { name: '설정값' })).toHaveValue(value);

  await editor.getByRole('button', { name: '저장', exact: true }).click();
  await expect(modalNotice(page)).toContainText('저장됐어요. 리포트로 돌아가 재검수해 주세요.');
  const requests = correctionRequests(mock);
  expect(requests).toHaveLength(2);
  expect(requests[1].body).toEqual(requests[0].body);
  expect(mock.state.corrections.size).toBe(1);
  expect(new URL(page.url()).searchParams.get('correctionReceiptId')).toBe(CORRECTION_RECEIPT_ID);
});

test('정정 응답을 기다리는 동안 리포트로 돌아가면 늦은 성공이 리포트 주소를 바꾸지 않고 리포트만 다시 읽는다', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const pageErrors: string[] = [];
  page.on('pageerror', error => pageErrors.push(error.message));
  const reportGets: string[] = [];
  page.on('request', request => {
    if (request.method() === 'GET' && new URL(request.url()).pathname === `/api/v1/works/${WORK_ID}/episode-validations/${REPORT_ID}`) reportGets.push(request.url());
  });
  const mock = await open(page, {}, `&findingId=${findingId(1)}`);
  await page.getByRole('region', { name: '원고·설정 수정' }).getByRole('link', { name: '세계관 · 왕궁 · 마법 / 사용 제한 정정', exact: true }).click();
  const editor = page.getByRole('dialog', { name: '왕궁 세계관 상세' }).locator('.world-setting-property-editor');
  const release = mock.holdNextCorrection();
  await editor.getByRole('textbox', { name: '설정값' }).fill('왕궁 건물 안에서만 마법을 쓸 수 없다');
  await editor.getByRole('button', { name: '저장', exact: true }).click();
  await expect.poll(() => correctionRequests(mock).length).toBe(1);

  // 응답을 기다리는 동안에도 리포트로 돌아가는 링크는 열려 있다.
  await modalNotice(page).getByRole('link', { name: '오류 리포트로 돌아가기' }).click();
  await expect(page).toHaveURL(/\/episode-validation-report\?/);
  await expect(page.locator('#validation-report-title')).toBeVisible();
  const reportUrl = page.url();
  const before = reportGets.length;

  const corrected = page.waitForResponse(response => new URL(response.url()).pathname.endsWith('/corrections'));
  release();
  expect((await corrected).ok()).toBe(true);
  // 늦은 성공은 리포트 캐시만 무효화한다. 리포트는 정정으로 바뀐 서버 상태를 다시 읽는다.
  await expect.poll(() => reportGets.length).toBeGreaterThan(before);
  await expect(page.getByText('원고 또는 비교한 설정이 바뀌었어요. 수정 내용을 반영해 다시 검수해 주세요.').first()).toBeVisible();
  expect(page.url()).toBe(reportUrl);
  const params = new URL(page.url()).searchParams;
  expect(new URL(page.url()).pathname).toBe('/episode-validation-report');
  expect([...params.keys()].filter(key => key.startsWith('correction'))).toEqual([]);
  for (const key of ['mode', 'modal', 'nav', 'returnTo']) expect(params.get(key), key).toBeNull();
  expect(pageErrors).toEqual([]);
});

test('basis가 없거나 당시 버전이 없는 항목은 설정 정보 정정을 잠그고 이름으로 대상을 추측하지 않는다', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const findings = defaultFindings();
  findings[0].basis = [];
  findings[1].basis = [{ ...structuredClone(findings[1].basis[0]), currentVersion: null as unknown as number }];
  const mock = await open(page, { findings }, `&findingId=${findingId(0)}`);
  const fix = page.getByRole('region', { name: '원고·설정 수정' });
  await expect(fix.getByRole('button', { name: '설정 정보 정정' })).toBeDisabled();
  await expect(fix.locator('#validation-correction-lock')).toHaveText('이 항목에는 고칠 수 있는 저장 설정이 연결되지 않았어요.');
  await expect(fix.getByRole('link', { name: '설정 정보 정정' })).toHaveCount(0);
  // 원고 파일 변경(A9)은 그대로 쓸 수 있다.
  await expect(fix.getByRole('link', { name: '원고 파일 변경', exact: true })).toBeVisible();

  await page.locator(`[data-finding-id="${findingId(1)}"]`).click();
  await expect(fix.getByRole('button', { name: '설정 정보 정정' })).toBeDisabled();
  await expect(fix.locator('#validation-correction-target')).toHaveText('검사 당시 설정 버전이 없어 정정으로 연결할 수 없어요.');
  // 오탈자에는 설정 정보 정정을 두지 않는다.
  await page.locator(`[data-finding-id="${findingId(3)}"]`).click();
  await expect(page.getByRole('region', { name: '원고·설정 수정' }).getByText('설정 정보 정정')).toHaveCount(0);
  expect(correctionRequests(mock)).toHaveLength(0);
  // 계약의 정정 요청 예시와 같은 필드만 쓴다.
  expect(Object.keys(review.correctionFromFindingBasis.request).sort()).toEqual(
    ['baselineId', 'character', 'entryRef', 'expectedBaselineHash', 'expectedBaselineRevision', 'expectedEntryHash', 'expectedReportVersion', 'idempotencyKey', 'worldSetting'],
  );
});
