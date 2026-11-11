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
 * #428부터 `설정 고치기`는 리포트를 떠나지 않고 그 위에 캐릭터 편집 창·세계관 상세 창을 띄운다. 정정 문맥은 주소에 싣지 않는다.
 * 이전에 공유된 대시보드 정정 주소(`returnTo=validation-report&correction*`)의 동작은 아래 `대시보드 주소` 테스트로 남긴다.
 */
type Mock = Awaited<ReturnType<typeof mockValidationReport>>;

async function open(page: Page, scenario: ReportScenario = {}, query = '') {
  const mock = await mockValidationReport(page, scenario);
  await authenticate(page);
  await page.goto(mock.url(query));
  await expect(page.locator('#validation-report-title')).toBeVisible();
  return mock;
}

const correctionRequests = (mock: Mock) => mock.requestsTo('/corrections');
const characterDialog = (page: Page, name: string) => page.getByRole('dialog', { name: `${name} 캐릭터 상세` });
const worldDialog = (page: Page) => page.getByRole('dialog', { name: '왕궁 세계관 상세' });
const modalNotice = (page: Page) => page.getByTestId('validation-correction-notice');
const fixRegion = (page: Page) => page.getByRole('region', { name: '고치기' });
const fixResult = (page: Page) => page.locator('.vr-fix-result');
const announcement = (page: Page) => page.getByTestId('validation-fix-announcement');
const recheckProgressUrl = new RegExp(`/episode-upload\\?workId=${WORK_ID}&validationReportId=${RECHECK_REPORT_ID}$`);

async function saveCharacter(page: Page, name: string, label = '저장') {
  const dialog = characterDialog(page, name);
  await dialog.locator('.character-detail-actions').getByRole('button', { name: label, exact: true }).click();
  await dialog.locator('.character-confirm-dialog').getByRole('button', { name: '저장', exact: true }).click();
}

async function openPalaceCorrection(page: Page) {
  const fix = fixRegion(page);
  await fix.getByRole('button', { name: '설정 고치기', exact: true }).click();
  await fix.getByRole('list', { name: '고칠 설정' }).getByRole('button', { name: '왕궁 · 마법 / 사용 제한', exact: true }).click();
  await expect(worldDialog(page)).toBeVisible();
  return worldDialog(page).locator('.world-setting-property-editor');
}

/** 리포트를 떠나지 않았고 주소에 정정 문맥·설정 관리 키를 싣지 않았다. 정정 receipt와 결과(안내를 새로고침 뒤에도 보이기 위함)만 남을 수 있다. */
function expectReportAddress(page: Page, findingIdValue: string) {
  const url = new URL(page.url());
  expect(url.pathname).toBe('/episode-validation-report');
  expect(url.searchParams.get('reportId')).toBe(REPORT_ID);
  expect(url.searchParams.get('findingId')).toBe(findingIdValue);
  expect([...url.searchParams.keys()].filter(key => key.startsWith('correction') && key !== 'correctionReceiptId' && key !== 'correctionResult')).toEqual([]);
  for (const key of ['nav', 'tab', 'modal', 'mode', 'charId', 'settingId', 'returnTo', 'worldSize', 'category']) expect(url.searchParams.get(key), key).toBeNull();
}

/** 재검수 패널에서 수정 내용으로 재검수를 시작하고, 접수 요청에 receipt가 실렸는지 확인한다. */
async function recheckWithReceipt(page: Page, mock: Mock) {
  await page.getByRole('button', { name: '수정 내용으로 재검수', exact: true }).click();
  const confirm = page.getByTestId('validation-recheck-confirm');
  await expect(confirm).toContainText('검사에 쓴 설정을 정정했어요. 정정한 설정을 작가 정정으로 연결해 다시 검사해요.');
  const fingerprint = mock.state.staging.baselineFingerprint;
  await confirm.getByRole('button', { name: '재검수 시작', exact: true }).click();
  // 재검수 접수 뒤에는 검수 로딩창으로 간다. 주소에는 새 report ID만 남는다.
  await expect(page).toHaveURL(recheckProgressUrl);
  const rechecks = mock.requestsTo('/rechecks');
  expect(rechecks).toHaveLength(1);
  expect(rechecks[0].body).toMatchObject({ correctionReceiptId: CORRECTION_RECEIPT_ID, expectedBaselineHash: fingerprint });
  // 새 결과로 넘어가면 이전 report의 receipt는 주소에 남지 않는다.
  expect(new URL(page.url()).searchParams.get('correctionReceiptId')).toBeNull();
}

test('캐릭터 기준 항목이 하나면 리포트 위에서 바로 편집 창을 열고, 저장은 정정 요청 하나로 보내 창을 닫은 뒤 receipt로 재검수한다', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const mock = await open(page, {}, `&branch=SETTING&findingId=${findingId(0)}`);
  const before = page.url();
  const staging = structuredClone(mock.state.staging);
  const fix = fixRegion(page);
  await expect(fix.locator('#validation-correction-target')).toHaveText('비요른 · 검');
  await fix.getByRole('button', { name: '설정 고치기', exact: true }).click();

  // 다른 화면으로 가지 않고 리포트 위에 편집 창이 뜬다. 주소에는 정정 문맥(correction*)을 싣지 않는다.
  const dialog = characterDialog(page, '비요른');
  await expect(dialog).toBeVisible();
  expect(page.url()).toBe(before);
  await expect(modalNotice(page)).toContainText('오류 리포트의 검사 기준과 연결해 정정해요.');
  await expect(modalNotice(page)).toContainText('검사한 설정 하나만 바꿔 저장하면 이 검사 기준과 연결해요.');
  // 이미 리포트 위이므로 돌아가기 링크는 두지 않는다.
  await expect(modalNotice(page).getByRole('link')).toHaveCount(0);
  // 편집으로 바로 연다. 상세 보기 머리의 부가 기능(변화 이력·수정·삭제·이미지 변경)은 리포트 위에서 열지 않는다.
  await expect(dialog.locator('.character-detail-actions').getByRole('button', { name: '저장', exact: true })).toBeVisible();
  for (const name of ['변화 이력 보기', '수정', '삭제', '이미지 변경']) await expect(dialog.getByRole('button', { name, exact: true })).toHaveCount(0);
  // 밝은 상세 모달 안에서도 안내 제목·본문은 4.5:1 이상이다.
  const noticeBox = modalNotice(page).locator('.review-cb-notice');
  for (const text of [noticeBox.locator('strong'), noticeBox.locator('p').first()]) {
    expect(await computedContrastRatio(text, noticeBox, dialog)).toBeGreaterThanOrEqual(4.5);
  }

  await dialog.getByRole('textbox', { name: '검 값' }).fill('다시 벼린 검');
  await saveCharacter(page, '비요른');
  // 정정이 연결되면 창을 닫고 리포트에 결과를 알린다(화면 안내 + 스크린리더 알림).
  await expect(dialog).toHaveCount(0);
  await expect(fixResult(page)).toContainText('저장됐어요. 재검수해 주세요.');
  await expect(fixResult(page)).toContainText('정정한 설정은 이 검수의 기준과 연결됐어요.');
  await expect(announcement(page)).toHaveText('설정을 정정해 저장했어요. 수정 내용으로 재검수해 주세요.');
  const [request] = correctionRequests(mock);
  expect(correctionRequests(mock)).toHaveLength(1);
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
  // 리포트 주소는 그대로이고, 받은 receipt만 기존 키(correctionReceiptId)에 남아 재검수 패널이 바로 쓴다.
  expectReportAddress(page, findingId(0));
  expect(new URL(page.url()).searchParams.get('branch')).toBe('SETTING');
  expect(new URL(page.url()).searchParams.get('correctionReceiptId')).toBe(CORRECTION_RECEIPT_ID);
  // 설정값·인용은 주소와 저장소에 남기지 않는다.
  const stored = await page.evaluate(() => JSON.stringify({ ...localStorage, ...sessionStorage }));
  for (const value of ['다시 벼린 검', '부서진 검', '부서졌다']) {
    expect(decodeURIComponent(page.url())).not.toContain(value);
    expect(stored).not.toContain(value);
  }
  // 정정으로 기준이 무효가 되어 고치기 버튼이 사라지면 초점은 결과 안내·재검수 영역으로 옮긴다.
  await expect(page.getByText('원고 또는 비교한 설정이 바뀌었어요. 수정 내용을 반영해 다시 검수해 주세요.').first()).toBeVisible();
  await expect(page.getByText('설정 정정을 저장했어요. 수정 내용으로 재검수하면 정정한 설정으로 다시 검사해요.')).toBeVisible();
  await expect(fixRegion(page)).toHaveCount(0);
  await expect(fixResult(page)).toBeFocused();
  // 저장만으로 새 검수를 시작하지 않는다.
  expect(mock.requestsTo('/rechecks')).toHaveLength(0);
  // 새로고침해도 결과 안내가 남는다. 스크린리더 알림은 다시 읽지 않는다.
  await page.reload();
  await expect(page.locator('#validation-report-title')).toBeVisible();
  await expect(fixResult(page)).toContainText('저장됐어요. 재검수해 주세요.');
  await expect(announcement(page)).toHaveText('');
  expect(new URL(page.url()).searchParams.get('correctionResult')).toBe('linked');

  await recheckWithReceipt(page, mock);
});

test('세계관 기준 항목이 여러 개면 작가가 고르고, 리포트 위 세계관 상세에서 경로가 정해진 설정을 정정한 뒤 receipt로 재검수한다', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const worldListGets: string[] = [];
  page.on('request', request => {
    if (request.method() === 'GET' && new URL(request.url()).pathname === `/api/v1/works/${WORK_ID}/world-settings`) worldListGets.push(request.url());
  });
  const mock = await open(page, {}, `&findingId=${findingId(1)}`);
  const before = page.url();
  const staging = structuredClone(mock.state.staging);
  const fix = fixRegion(page);
  // 저장 설정이 여럿이면 `설정 고치기`가 작은 선택 목록을 연다(작가용 이름만 쓴다).
  await fix.getByRole('button', { name: '설정 고치기', exact: true }).click();
  const choices = fix.getByRole('list', { name: '고칠 설정' });
  await expect(choices.getByRole('button', { name: '에르웬', exact: true })).toBeVisible();
  await choices.getByRole('button', { name: '왕궁 · 마법 / 사용 제한', exact: true }).click();

  const dialog = worldDialog(page);
  await expect(dialog).toBeVisible();
  // 상세만 띄우므로 목록을 읽지 않고 리포트 주소의 page 등 목록 키를 쓰지 않는다.
  expect(page.url()).toBe(before);
  expect(worldListGets).toEqual([]);
  await expect(modalNotice(page)).toContainText('마법 / 사용 제한 설정의 값을 고쳐 저장하면 이 검사 기준과 연결해요.');
  await expect(modalNotice(page).getByRole('link')).toHaveCount(0);
  // 주소로 여는 이미지 변경·대상 정보 수정은 리포트 위에서 두지 않는다.
  await expect(dialog.getByRole('button', { name: '이미지 변경' })).toHaveCount(0);
  await expect(dialog.getByRole('button', { name: /대상 정보 수정/ })).toHaveCount(0);
  // 경로가 정해진 정정은 그 설정의 수정을 바로 연다.
  const editor = dialog.locator('.world-setting-property-editor');
  await expect(editor.getByRole('textbox', { name: '설정명' })).toHaveValue('사용 제한');
  await editor.getByRole('textbox', { name: '설정값' }).fill('왕궁 건물 안에서만 마법을 쓸 수 없다');
  await editor.getByRole('button', { name: '저장', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await expect(fixResult(page)).toContainText('저장됐어요. 재검수해 주세요.');
  await expect(announcement(page)).toHaveText('설정을 정정해 저장했어요. 수정 내용으로 재검수해 주세요.');
  const [request] = correctionRequests(mock);
  expect(correctionRequests(mock)).toHaveLength(1);
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
  expectReportAddress(page, findingId(1));
  expect(new URL(page.url()).searchParams.get('correctionReceiptId')).toBe(CORRECTION_RECEIPT_ID);
  expect(worldListGets).toEqual([]);

  await recheckWithReceipt(page, mock);
});

test('정정 409는 아무것도 저장하지 않았다고 알리고 다시 저장할 때만 기준 연결 없이 일반 저장한 뒤 창을 닫는다', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const mock = await open(page, {}, `&findingId=${findingId(0)}`);
  await fixRegion(page).getByRole('button', { name: '설정 고치기', exact: true }).click();
  const dialog = characterDialog(page, '비요른');
  mock.failNextCorrection({ status: 409, code: 'VALIDATION_CORRECTION_CONFLICT', message: '정정할 기준 항목을 정확히 연결할 수 없습니다.' });
  await dialog.getByRole('textbox', { name: '검 값' }).fill('다시 벼린 검');
  await saveCharacter(page, '비요른');
  await expect(modalNotice(page).locator('strong')).toHaveText('검수 기준과 지금 저장된 설정이 달라 정정으로 저장하지 못했어요.');
  await expect(modalNotice(page)).toContainText('입력한 내용은 그대로예요. 다시 저장하면 검수 기준과 연결하지 않고 저장해요.');
  await expect(modalNotice(page)).not.toContainText('저장됐');
  // 창과 입력을 유지하고, 일반 저장은 아직 보내지 않는다.
  await expect(dialog.getByRole('textbox', { name: '검 값' })).toHaveValue('다시 벼린 검');
  expect(mock.requestsTo(`/characters/${CHARACTER_ID}`, 'PATCH')).toHaveLength(0);
  expect(correctionRequests(mock)).toHaveLength(1);

  await saveCharacter(page, '비요른', '기준 연결 없이 저장');
  await expect(dialog).toHaveCount(0);
  await expect(fixResult(page)).toContainText('저장됐지만 검수 기준 연결을 확인하지 못했어요.');
  await expect(announcement(page)).toHaveText('설정을 저장했지만 검수 기준 연결을 확인하지 못했어요.');
  expect(mock.requestsTo(`/characters/${CHARACTER_ID}`, 'PATCH')).toHaveLength(1);
  expect(correctionRequests(mock)).toHaveLength(1);
  expectReportAddress(page, findingId(0));
  expect(new URL(page.url()).searchParams.get('correctionReceiptId')).toBeNull();
  await expect(page.getByText('설정 정정을 저장했어요.', { exact: false })).toHaveCount(0);
  // 새로고침해도 결과 안내가 남는다.
  await page.reload();
  await expect(page.locator('#validation-report-title')).toBeVisible();
  await expect(fixResult(page)).toContainText('저장됐지만 검수 기준 연결을 확인하지 못했어요.');
});

test('기준 slot이 없는 캐릭터 정정은 작가가 바꾼 설정 하나를 보내고, 여러 설정을 바꾸면 요청하지 않는다', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const mock = await open(page, {}, `&findingId=${findingId(2)}`);
  await fixRegion(page).getByRole('button', { name: '설정 고치기', exact: true }).click();
  const dialog = characterDialog(page, '에르웬');
  await dialog.getByRole('textbox', { name: '망토 값' }).fill('붉은 망토');
  await dialog.getByRole('textbox', { name: '현재 나이' }).fill('25');
  await saveCharacter(page, '에르웬');
  await expect(modalNotice(page).locator('strong')).toHaveText('정정은 설정 하나만 바꿀 수 있어요.');
  await expect(modalNotice(page)).toContainText('다른 설정은 원래대로 두고 저장해 주세요.');
  expect(correctionRequests(mock)).toHaveLength(0);

  await dialog.getByRole('textbox', { name: '현재 나이' }).fill('24');
  await saveCharacter(page, '에르웬');
  await expect(dialog).toHaveCount(0);
  await expect(fixResult(page)).toContainText('저장됐어요. 재검수해 주세요.');
  const [request] = correctionRequests(mock);
  expect(request.body).toMatchObject({
    entryRef: ERWEN_BASIS.entryRef, expectedEntryHash: ERWEN_BASIS.entryHash,
    character: { targetId: ERWEN_ID, expectedSnapshotVersion: 2, factType: 'PROFILE', factKey: 'profile.망토',
      edit: { currentAge: 24, profile: [expect.objectContaining({ key: 'profile.망토', value: '붉은 망토' })] } },
  });
});

test('정정 응답이 유실되면 창과 입력을 유지하고 다시 저장할 때 같은 키·같은 요청으로 receipt를 확인한다', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const mock = await open(page, {}, `&findingId=${findingId(0)}`);
  await fixRegion(page).getByRole('button', { name: '설정 고치기', exact: true }).click();
  const dialog = characterDialog(page, '비요른');
  mock.loseNextCorrectionResponse();
  await dialog.getByRole('textbox', { name: '검 값' }).fill('다시 벼린 검');
  await saveCharacter(page, '비요른');
  await expect(modalNotice(page).locator('strong')).toHaveText('정정 결과를 확인하지 못했어요.');
  await expect(modalNotice(page)).toContainText('입력한 내용은 그대로예요. 다시 저장하면 같은 요청으로 확인해요.');
  await expect(dialog.getByRole('textbox', { name: '검 값' })).toHaveValue('다시 벼린 검');
  await saveCharacter(page, '비요른');
  await expect(dialog).toHaveCount(0);
  await expect(fixResult(page)).toContainText('저장됐어요. 재검수해 주세요.');
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
  await fixRegion(page).getByRole('button', { name: '설정 고치기', exact: true }).click();
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
  await expect(dialog).toHaveCount(0);
  await expect(fixResult(page)).toContainText('저장됐어요. 재검수해 주세요.');
  const requests = correctionRequests(mock);
  expect(requests).toHaveLength(2);
  const [first, second] = requests;
  expect((second.body as CorrectionBody).idempotencyKey).toBe((first.body as CorrectionBody).idempotencyKey);
  expect(second.body).toEqual(first.body);
  expect(mock.state.corrections.size).toBe(1);
  expect(new URL(page.url()).searchParams.get('correctionReceiptId')).toBe(CORRECTION_RECEIPT_ID);
});

test('세계관 정정도 응답 유실 뒤 상세를 다시 읽으면 같은 키·같은 요청으로 receipt를 확인한다', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const mock = await open(page, {}, `&findingId=${findingId(1)}`);
  const editor = await openPalaceCorrection(page);
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
  await expect(worldDialog(page)).toHaveCount(0);
  await expect(fixResult(page)).toContainText('저장됐어요. 재검수해 주세요.');
  const requests = correctionRequests(mock);
  expect(requests).toHaveLength(2);
  expect(requests[1].body).toEqual(requests[0].body);
  expect(mock.state.corrections.size).toBe(1);
  expect(new URL(page.url()).searchParams.get('correctionReceiptId')).toBe(CORRECTION_RECEIPT_ID);
});

test('정정 응답을 기다리는 동안에는 창을 닫지 않고, 응답이 오면 창을 닫아 리포트에 결과를 남긴다', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const pageErrors: string[] = [];
  page.on('pageerror', error => pageErrors.push(error.message));
  const mock = await open(page, {}, `&findingId=${findingId(1)}`);
  const editor = await openPalaceCorrection(page);
  const release = mock.holdNextCorrection();
  await editor.getByRole('textbox', { name: '설정값' }).fill('왕궁 건물 안에서만 마법을 쓸 수 없다');
  await editor.getByRole('button', { name: '저장', exact: true }).click();
  await expect.poll(() => correctionRequests(mock).length).toBe(1);

  // 저장 중에는 닫기·Esc로 창을 닫지 않는다(결과를 모른 채 리포트로 돌아가지 않게).
  await expect(worldDialog(page).getByRole('button', { name: '닫기', exact: true })).toBeDisabled();
  await page.keyboard.press('Escape');
  await expect(worldDialog(page)).toBeVisible();

  const corrected = page.waitForResponse(response => new URL(response.url()).pathname.endsWith('/corrections'));
  release();
  expect((await corrected).ok()).toBe(true);
  await expect(worldDialog(page)).toHaveCount(0);
  await expect(fixResult(page)).toContainText('저장됐어요. 재검수해 주세요.');
  expectReportAddress(page, findingId(1));
  expect(new URL(page.url()).searchParams.get('correctionReceiptId')).toBe(CORRECTION_RECEIPT_ID);
  expect(pageErrors).toEqual([]);
});

test('고치기 창을 닫으면 요청 없이 리포트의 선택 항목·필터를 그대로 두고 누른 버튼으로 초점을 돌린다', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const mock = await open(page, {}, `&branch=SETTING&judgment=ALL&findingId=${findingId(0)}`);
  const before = page.url();
  const fix = fixRegion(page);

  // 캐릭터 편집 창: 입력 뒤 취소 → 창만 닫힌다.
  const settingFix = fix.getByRole('button', { name: '설정 고치기', exact: true });
  await settingFix.click();
  const dialog = characterDialog(page, '비요른');
  await dialog.getByRole('textbox', { name: '검 값' }).fill('저장하지 않을 값');
  await dialog.locator('.character-detail-actions').getByRole('button', { name: '취소', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  expect(page.url()).toBe(before);
  await expect(settingFix).toBeFocused();
  // Esc로도 닫히고 초점이 돌아온다. 다시 열면 지난 입력을 잇지 않는다.
  await settingFix.click();
  await expect(dialog.getByRole('textbox', { name: '검 값' })).toHaveValue('부서진 검');
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await expect(settingFix).toBeFocused();

  // 원고 고치기 창: 취소 → 창만 닫힌다.
  const replaceFix = fix.getByRole('button', { name: '원고 고치기', exact: true });
  await replaceFix.click();
  const replaceDialog = page.getByRole('dialog', { name: '회차 파일 변경', exact: true });
  await expect(replaceDialog).toBeVisible();
  await replaceDialog.getByRole('button', { name: '취소', exact: true }).click();
  await expect(replaceDialog).toHaveCount(0);
  await expect(replaceFix).toBeFocused();
  expect(page.url()).toBe(before);

  // 세계관 상세 창: 열자마자 연 설정 수정 초안이 있으므로 작성 취소를 확인한 뒤 닫는다.
  await page.locator(`[data-finding-id="${findingId(1)}"]`).click();
  await expect(page).toHaveURL(new RegExp(`findingId=${findingId(1)}`));
  const worldBefore = page.url();
  await openPalaceCorrection(page);
  await worldDialog(page).getByRole('button', { name: '닫기', exact: true }).click();
  await page.getByRole('alertdialog', { name: '작성 중인 내용을 취소할까요?' }).getByRole('button', { name: '작성 취소', exact: true }).click();
  await expect(worldDialog(page)).toHaveCount(0);
  await expect(fix.getByRole('list', { name: '고칠 설정' }).getByRole('button', { name: '왕궁 · 마법 / 사용 제한', exact: true })).toBeFocused();
  expect(page.url()).toBe(worldBefore);
  expect(new URL(worldBefore).searchParams.get('branch')).toBe('SETTING');
  expect(new URL(worldBefore).searchParams.get('judgment')).toBe('ALL');

  expect(mock.state.requests.filter(item => item.method !== 'GET')).toEqual([]);
  await expect(fixResult(page)).toHaveCount(1);
  await expect(page.locator('.vr-fix-result .review-cb-notice')).toHaveCount(0);
});

test('320px에서도 리포트 위 고치기 창의 저장·파일 변경 버튼에 닿을 수 있다', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await open(page, {}, `&findingId=${findingId(0)}`);
  const fix = fixRegion(page);
  await fix.getByRole('button', { name: '설정 고치기', exact: true }).scrollIntoViewIfNeeded();
  await fix.getByRole('button', { name: '설정 고치기', exact: true }).click();
  const dialog = characterDialog(page, '비요른');
  const save = dialog.locator('.character-detail-actions').getByRole('button', { name: '저장', exact: true });
  await save.scrollIntoViewIfNeeded();
  await expect(save).toBeInViewport();
  await save.click();
  const confirm = dialog.locator('.character-confirm-dialog');
  await expect(confirm.getByRole('button', { name: '저장', exact: true })).toBeInViewport();
  await confirm.getByRole('button', { name: '취소', exact: true }).click();
  const cancel = dialog.locator('.character-detail-actions').getByRole('button', { name: '취소', exact: true });
  await cancel.scrollIntoViewIfNeeded();
  await cancel.click();
  await expect(dialog).toHaveCount(0);

  await fix.getByRole('button', { name: '원고 고치기', exact: true }).click();
  const replaceDialog = page.getByRole('dialog', { name: '회차 파일 변경', exact: true });
  await replaceDialog.locator('input[type=file]').setInputFiles({ name: '101-revised.txt', mimeType: 'text/plain', buffer: Buffer.from('고친 101화 원고') });
  const submit = replaceDialog.getByRole('button', { name: '파일 변경하고 재검수', exact: true });
  await submit.scrollIntoViewIfNeeded();
  await expect(submit).toBeInViewport();
  await expect(submit).toBeEnabled();
});

test('basis가 없거나 당시 버전이 없는 항목은 설정 고치기를 잠그고 이름으로 대상을 추측하지 않는다', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const findings = defaultFindings();
  findings[0].basis = [];
  findings[1].basis = [{ ...structuredClone(findings[1].basis[0]), currentVersion: null as unknown as number }];
  const mock = await open(page, { findings }, `&findingId=${findingId(0)}`);
  const fix = fixRegion(page);
  await expect(fix.getByRole('button', { name: '설정 고치기' })).toBeDisabled();
  await expect(fix.locator('#validation-correction-lock')).toHaveText('이 항목에는 고칠 수 있는 저장 설정이 연결되지 않았어요.');
  // 원고 고치기(A9)는 그대로 쓸 수 있다.
  await expect(fix.getByRole('button', { name: '원고 고치기', exact: true })).toBeEnabled();

  await page.locator(`[data-finding-id="${findingId(1)}"]`).click();
  await expect(fix.getByRole('button', { name: '설정 고치기' })).toBeDisabled();
  await expect(fix.locator('#validation-correction-target')).toHaveText('검사 당시 설정 버전이 없어 정정으로 연결할 수 없어요.');
  // 오탈자에는 설정 고치기를 두지 않는다.
  await page.locator(`[data-finding-id="${findingId(3)}"]`).click();
  await expect(page.getByRole('region', { name: '고치기' }).getByText('설정 고치기')).toHaveCount(0);
  expect(correctionRequests(mock)).toHaveLength(0);
  // 계약의 정정 요청 예시와 같은 필드만 쓴다.
  expect(Object.keys(review.correctionFromFindingBasis.request).sort()).toEqual(
    ['baselineId', 'character', 'entryRef', 'expectedBaselineHash', 'expectedBaselineRevision', 'expectedEntryHash', 'expectedReportVersion', 'idempotencyKey', 'worldSetting'],
  );
});

/**
 * #428 전 리포트가 만든 대시보드 정정 주소(이미 공유된 링크). 리포트는 더 이상 이 주소로 보내지 않지만 대시보드는 계속 받는다.
 * 값은 #428 전 `correctionLinks`가 basis[]·report 단건 조회에서 옮기던 그대로다.
 */
function dashboardCorrectionUrl(mock: Mock, target: { findingId: string; type: 'CHARACTER' | 'WORLD_SETTING' }) {
  const staging = mock.state.staging;
  const basis = target.type === 'CHARACTER' ? BJORN_BASIS : PALACE_BASIS;
  const params = new URLSearchParams({
    workId: WORK_ID, nav: 'settingDB',
    ...(target.type === 'CHARACTER'
      ? { tab: 'characters', modal: 'char-detail', charId: CHARACTER_ID, mode: 'edit' }
      : { tab: 'worldsettings', settingId: WORLD_ID }),
    returnTo: 'validation-report', reportId: REPORT_ID, reportFindingId: target.findingId,
    correctionBaselineId: staging.baselineId, correctionBaselineRevision: String(staging.baselineRevision),
    correctionBaselineHash: staging.baselineHash, correctionEntryRef: basis.entryRef, correctionEntryHash: basis.entryHash,
    correctionSubjectType: target.type, correctionTargetId: basis.targetId, correctionVersion: String(basis.currentVersion),
    ...(target.type === 'CHARACTER'
      ? { correctionFactType: 'ITEM', correctionFactKey: 'item.검' }
      : { correctionScopeName: '마법', correctionSettingName: '사용 제한' }),
  });
  return `/dashboard?${params}`;
}

test('대시보드 주소: 이전에 공유된 캐릭터 정정 주소로 들어와도 정정 요청 하나로 저장하고 리포트로 돌아가 receipt를 쓴다', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const mock = await mockValidationReport(page);
  await authenticate(page);
  await page.goto(dashboardCorrectionUrl(mock, { findingId: findingId(0), type: 'CHARACTER' }));
  const dialog = characterDialog(page, '비요른');
  await expect(modalNotice(page)).toContainText('오류 리포트에서 설정 정보를 정정하러 왔어요.');
  await expect(modalNotice(page)).toContainText('검사한 설정 하나만 바꿔 저장하면 이 검사 기준과 연결해요.');
  await dialog.getByRole('textbox', { name: '검 값' }).fill('다시 벼린 검');
  await saveCharacter(page, '비요른');
  await expect(modalNotice(page)).toContainText('저장됐어요. 리포트로 돌아가 재검수해 주세요.');
  expect(correctionRequests(mock)).toHaveLength(1);
  expect(correctionRequests(mock)[0].body).toMatchObject({ entryRef: 'B1', character: { targetId: CHARACTER_ID, factType: 'ITEM', factKey: 'item.검' } });
  expect(mock.requestsTo(`/characters/${CHARACTER_ID}`, 'PATCH')).toHaveLength(0);
  const after = new URL(page.url()).searchParams;
  expect(after.get('correctionResult')).toBe('linked');
  expect(after.get('correctionReceiptId')).toBe(CORRECTION_RECEIPT_ID);
  expect(after.get('mode')).toBeNull();
  for (const key of ['correctionEntryRef', 'correctionEntryHash', 'correctionBaselineHash', 'correctionVersion', 'correctionFactKey']) {
    expect(after.get(key), key).toBeNull();
  }

  await modalNotice(page).getByRole('link', { name: '오류 리포트로 돌아가기' }).click();
  await expect(page).toHaveURL(new RegExp(`reportId=${REPORT_ID}`));
  const report = new URL(page.url()).searchParams;
  expect(report.get('correctionReceiptId')).toBe(CORRECTION_RECEIPT_ID);
  expect(report.get('findingId')).toBe(findingId(0));
  await expect(page.getByText('설정 정정을 저장했어요. 수정 내용으로 재검수하면 정정한 설정으로 다시 검사해요.')).toBeVisible();
  // 복귀만으로 새 검수를 시작하지 않는다.
  expect(mock.requestsTo('/rechecks')).toHaveLength(0);
  await recheckWithReceipt(page, mock);
});

test('대시보드 주소: 정정 응답을 기다리는 동안 리포트로 돌아가면 늦은 성공이 리포트 주소를 바꾸지 않고 리포트만 다시 읽는다', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const pageErrors: string[] = [];
  page.on('pageerror', error => pageErrors.push(error.message));
  const reportGets: string[] = [];
  page.on('request', request => {
    if (request.method() === 'GET' && new URL(request.url()).pathname === `/api/v1/works/${WORK_ID}/episode-validations/${REPORT_ID}`) reportGets.push(request.url());
  });
  const mock = await mockValidationReport(page);
  await authenticate(page);
  await page.goto(dashboardCorrectionUrl(mock, { findingId: findingId(1), type: 'WORLD_SETTING' }));
  const editor = worldDialog(page).locator('.world-setting-property-editor');
  await expect(modalNotice(page)).toContainText('마법 / 사용 제한 설정의 값을 고쳐 저장하면 이 검사 기준과 연결해요.');
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
