import { expect, type Page } from '@playwright/test';
import { CHARACTER_CASES, UNKNOWN_GROUP_KEY, WORLD_CASES, WORLD_TARGET, type FlowAdapter, type FlowContext } from '../fixture';

/*
 * 개선 어댑터: #211 후속 F1~F3 화면에서 작가가 정답을 알고 있을 때 밟는 최소 절차.
 * - 캐릭터: 미연결 묶음에서 같은 인물(인물B)의 설정 2개를 체크해 `선택 항목 연결`로 한 번에 서버 검색·연결하고,
 *   나머지는 후보별 `캐릭터 연결 변경`에서 서버 검색(인물H)·새 인물 등록(인물J)으로 연결한다. 연결해도 읽던 묶음에 남고,
 *   묶음이 비면 다음 미처리 묶음이 열린다. 인물 묶음마다 현재 반영을 고른 뒤 고정 확정 영역의 `확정하고 다음`을 누른다.
 *   자동으로 열린 묶음이 이번 사례와 무관하면(인물A) 사이드바에서 남은 묶음을 고른다.
 * - 세계관: `모두 선택` → `선택 항목 대상 연결` → 대상 검색 1회 → 장소X 선택 → `고른 대상에 연결` → `모두 확정`.
 * - 복구: 연결한 묶음으로 이동해 현재 반영을 고르면 응답이 유실된다. 화면이 스스로 다시 읽어 저장 완료로 바뀌는지만 확인한다.
 * 기준선과 같은 fixture·meter·끝 조건을 쓴다. 문구·역할 이름에 의존하므로 화면 문구가 바뀌면 이 파일을 함께 고친다.
 */

type CharacterCase = (typeof CHARACTER_CASES)[number];

const SAVED_TEXT = '저장했어요 · 확정 전까지 바꿀 수 있어요';
const caseOf = (label: string) => CHARACTER_CASES.find(item => item.label === label)!;
/** 정답 인물별 후보. 미연결 묶음을 비운 뒤 이 묶음들만 확정한다(인물A 묶음은 이번 사례가 아니다). */
const PERSON_GROUPS: Array<{ name: string; items: CharacterCase[] }> = [
  { name: '인물H', items: [caseOf('직업')] },
  { name: '인물B', items: [caseOf('소속'), caseOf('상태')] },
  { name: '인물J', items: [caseOf('나이')] },
];

const groupCard = (page: Page, title: string | RegExp) => page.locator('.candidate-group-card')
  .filter({ has: page.locator('strong', { hasText: typeof title === 'string' ? new RegExp(`^${title}$`) : title }) });
const candidateRegion = (page: Page, item: CharacterCase) => page.getByRole('region', { name: `${item.label} 설정 후보`, exact: true });
const primaryAction = (page: Page) => page.getByRole('region', { name: '묶음 확정', exact: true })
  .getByRole('button', { name: /^(모두 확정|확정하고 다음)$/ });
const currentGroup = (page: Page) => new URL(page.url()).searchParams.get('group');
const personGroupKey = ({ server }: FlowContext, name: string) => {
  const characterId = server.characterIdByName(name);
  return characterId ? `existing:${characterId}` : name.toLocaleLowerCase('ko-KR');
};

async function openUnknownGroup({ page, meter }: FlowContext) {
  await meter.selectGroup(groupCard(page, /^미연결 후보 \d+개$/), UNKNOWN_GROUP_KEY, '사이드바: 미연결 후보 묶음 열기');
  await expect(page.getByRole('heading', { level: 2 })).toContainText('인물 미확인');
}

/** 연결 모달에서 작품 전체 서버 검색으로 인물을 찾아 고르고 미리보기를 확인한다. */
async function searchAndPick({ page, meter }: FlowContext, dialogName: string, name: string) {
  const dialog = page.getByRole('dialog', { name: dialogName });
  // 모달을 열면 최근 수정순 첫 페이지가 먼저 보인다. 그 목록이 그려진 뒤 검색한다.
  await expect(dialog.locator('.review-match-result').first()).toBeVisible();
  await meter.search(dialog.getByLabel('작품 전체에서 인물 검색', { exact: true }), name, `${dialogName}: 인물 검색`);
  const result = dialog.getByRole('button', { name: new RegExp(`^${name}`) });
  await expect(dialog.locator('.review-match-results')).toHaveAttribute('aria-busy', 'false');
  await expect(dialog.locator('.review-match-result')).toHaveCount(1);
  await meter.click(result, `${dialogName}: ${name} 선택`);
  // 미리보기: 고른 인물과 이 설정의 기존값을 같은 모달에서 본다(추가 조작 없음).
  const preview = dialog.getByRole('complementary', { name: '연결 미리보기' });
  await expect(preview).toContainText(name);
  await expect(preview.getByRole('region', { name: '이 설정의 기존값' })).toBeVisible();
  return dialog;
}

/** 미연결 묶음에서 체크한 설정을 한 인물에 함께 연결한다. 화면은 미연결 묶음에 남는다. */
async function linkChecked(context: FlowContext, items: CharacterCase[], name: string) {
  const { page, meter } = context;
  for (const item of items) {
    await meter.click(page.getByRole('checkbox', { name: `선택: ${item.label}`, exact: true }), `${item.label}: 체크`);
  }
  const bar = page.getByRole('region', { name: '선택한 설정', exact: true });
  await expect(bar).toContainText(`${items.length}개 선택`);
  await meter.openPicker(bar.getByRole('button', { name: '선택 항목 연결', exact: true }), '선택 항목 연결');
  const dialog = await searchAndPick(context, '선택 항목 연결', name);
  await meter.click(dialog.getByRole('button', { name: '선택한 캐릭터에 연결', exact: true }), '선택 항목 연결: 선택한 캐릭터에 연결');
  await expect(dialog).toHaveCount(0);
  await expect(page.getByRole('status').filter({ hasText: `${items.length}개를 ‘${name}’에 연결했어요.` })).toBeVisible();
  expect(currentGroup(page)).toBe(UNKNOWN_GROUP_KEY);
}

/** 후보 하나를 `캐릭터 연결 변경`으로 연결한다. 미연결 묶음에 다른 후보가 남아 있으면 화면은 그 묶음에 남는다. */
async function linkOne(context: FlowContext, item: CharacterCase) {
  const { page, meter, server } = context;
  const region = candidateRegion(page, item);
  await expect(region).toContainText('캐릭터 · 미연결');
  await meter.openPicker(region.getByRole('button', { name: '캐릭터 연결 변경', exact: true }), `${item.label}: 캐릭터 연결 변경`);
  const dialogName = '캐릭터 연결 확인';
  if (item.createNew) {
    const dialog = page.getByRole('dialog', { name: dialogName });
    await expect(dialog.locator('.review-match-result').first()).toBeVisible();
    await meter.click(dialog.getByRole('button', { name: '새 캐릭터로 등록', exact: true }).first(), '모달: 새 캐릭터로 등록 선택');
    await meter.fill(dialog.getByLabel('새 캐릭터 이름', { exact: true }), item.answer, '모달: 새 캐릭터 이름');
    await meter.click(dialog.locator('button[type="submit"]'), '모달: 새 캐릭터로 등록');
    await expect(dialog).toHaveCount(0);
  } else {
    const dialog = await searchAndPick(context, dialogName, item.answer);
    await meter.click(dialog.getByRole('button', { name: '선택한 캐릭터에 연결', exact: true }), '모달: 선택한 캐릭터에 연결');
    await expect(dialog).toHaveCount(0);
  }
  await expect.poll(() => server.characterCandidate(item.id).entityName).toBe(item.answer);
}

async function chooseCurrent({ page, meter }: FlowContext, item: CharacterCase) {
  const region = candidateRegion(page, item);
  await meter.click(region.getByRole('radio', { name: /현재 설정에 반영/ }), `${item.label}: 현재 설정에 반영`);
}

async function expectChoiceSaved(page: Page, item: CharacterCase) {
  const region = candidateRegion(page, item);
  await expect(region.getByText(SAVED_TEXT, { exact: true })).toBeVisible();
  await expect(region.getByRole('alert')).toHaveCount(0);
}

/** 묶음의 대기 후보 전원을 고정 확정 영역의 주 버튼 한 번으로 확정하고 다음 묶음으로 넘어간다. */
async function confirmAndNext({ page, meter, server }: FlowContext, name: string, items: CharacterCase[]) {
  const before = currentGroup(page);
  const button = primaryAction(page);
  await expect(button).toBeEnabled();
  const label = (await button.textContent())?.trim() ?? '';
  await meter.click(button, `${name} 묶음: ${label}`);
  await expect.poll(() => items.map(item => server.characterCandidate(item.id).reviewStatus)).toEqual(items.map(() => 'CONFIRMED'));
  if (label === '확정하고 다음') {
    await expect.poll(() => {
      const group = currentGroup(page);
      return group !== null && group !== before;
    }).toBe(true);
  }
}

export const improvedFlow: FlowAdapter = {
  name: 'improved',
  file: 'e2e/review-flow-metrics/flows/improved.ts',
  scenarios: {
    A: async context => {
      const { page, meter, server } = context;
      await openUnknownGroup(context);
      // 같은 인물로 보이는 2화 소속·상태를 체크해 한 번에 연결하고, 나머지는 후보별로 연결한다.
      await linkChecked(context, [caseOf('소속'), caseOf('상태')], '인물B');
      await linkOne(context, caseOf('직업'));
      await expect(page.getByRole('heading', { level: 2 })).toContainText('인물 미확인');
      expect(currentGroup(page)).toBe(UNKNOWN_GROUP_KEY);
      // 마지막 후보를 연결하면 미연결 묶음이 비고 화면이 다음 미처리 묶음을 연다.
      await linkOne(context, caseOf('나이'));
      await expect.poll(() => currentGroup(page)).not.toBe(UNKNOWN_GROUP_KEY);

      const remaining = [...PERSON_GROUPS];
      while (remaining.length) {
        const index = remaining.findIndex(group => personGroupKey(context, group.name) === currentGroup(page));
        if (index < 0) {
          // 이번 사례와 무관한 묶음(인물A)이 열렸다. 사이드바에서 남은 묶음 중 위에 있는 것을 고른다.
          const order = await page.locator('.candidate-group-card strong').allTextContents();
          const next = remaining.slice().sort((left, right) => order.indexOf(left.name) - order.indexOf(right.name))[0];
          await meter.selectGroup(groupCard(page, next.name), personGroupKey(context, next.name), `사이드바: ${next.name} 묶음 열기`);
          continue;
        }
        const [group] = remaining.splice(index, 1);
        await expect(page.getByRole('heading', { level: 2 })).toContainText(group.name);
        for (const item of group.items) {
          await chooseCurrent(context, item);
          await expectChoiceSaved(page, item);
        }
        await confirmAndNext(context, group.name, group.items);
      }
      // 끝 조건: 미상 후보 4건이 모두 정답 대상으로 확정되고 다음 그룹(인물A)이 열린다.
      await expect.poll(() => CHARACTER_CASES.map(item => server.characterCandidate(item.id).reviewStatus)).toEqual(['CONFIRMED', 'CONFIRMED', 'CONFIRMED', 'CONFIRMED']);
      expect(CHARACTER_CASES.map(item => server.characterCandidate(item.id).entityName)).toEqual(CHARACTER_CASES.map(item => item.answer));
      await expect(page.getByRole('heading', { level: 2 })).toContainText('인물A');
    },
    B: async ({ page, meter, server }) => {
      await expect(page.locator('.world-setting-diff-row')).toHaveCount(WORLD_CASES.length);
      await meter.click(page.getByRole('checkbox', { name: `모두 선택(${WORLD_CASES.length})`, exact: true }), `모두 선택(${WORLD_CASES.length})`);
      const bar = page.getByRole('region', { name: '선택한 설정', exact: true });
      await expect(bar).toContainText(`${WORLD_CASES.length}개 선택`);
      await meter.openPicker(bar.getByRole('button', { name: '선택 항목 대상 연결', exact: true }), '선택 항목 대상 연결');
      const dialog = page.getByRole('dialog', { name: '선택 항목 대상 연결' });
      // 같은 분류의 장소가 많아 장소X는 대상 목록 첫 페이지에 없다. 이름으로 한 번 검색한다.
      await expect(dialog.getByRole('radio').first()).toBeVisible();
      await meter.search(dialog.getByLabel('연결할 세계관 대상 검색', { exact: true }), WORLD_TARGET.name, '대상 검색');
      await meter.click(dialog.getByRole('radio', { name: new RegExp(`^${WORLD_TARGET.name}`) }), `${WORLD_TARGET.name} 선택`);
      const plan = dialog.getByRole('region', { name: '체크한 설정의 저장 방법' });
      for (const item of WORLD_CASES) await expect(plan).toContainText(`${item.settingName}기존값 없음 → 추가로 저장`);
      await meter.click(dialog.getByRole('button', { name: '고른 대상에 연결', exact: true }), '고른 대상에 연결');
      await expect(dialog).toHaveCount(0);
      await expect(page.getByRole('status').filter({ hasText: `${WORLD_CASES.length}개 저장(추가)` })).toBeVisible();
      const button = primaryAction(page);
      await expect(button).toBeEnabled();
      const label = (await button.textContent())?.trim() ?? '';
      await meter.click(button, label);
      await expect.poll(() => WORLD_CASES.map(item => server.worldCandidate(item.id).reviewStatus)).toEqual(WORLD_CASES.map(() => 'CONFIRMED'));
      expect(WORLD_CASES.map(item => server.worldCandidate(item.id).finalSubjectName)).toEqual(WORLD_CASES.map(() => WORLD_TARGET.name));
    },
    C: async context => {
      const { page, meter, server } = context;
      const item = CHARACTER_CASES[0];
      await openUnknownGroup(context);
      await linkOne(context, item);
      // 연결해도 미연결 묶음에 남는다. 현재 반영을 고르려면 안내의 버튼으로 연결한 묶음을 연다.
      const notice = page.getByRole('status').filter({ hasText: `‘${item.label}’ 설정을 ‘${item.answer}’에 연결했어요.` });
      await meter.selectGroup(notice.getByRole('button', { name: '연결한 묶음 보기', exact: true }), personGroupKey(context, item.answer), '안내: 연결한 묶음 보기');
      await expect(page.getByRole('heading', { level: 2 })).toContainText(item.answer);
      meter.phase('recovery');
      // 첫 현재/이력 선택 PATCH는 서버에 저장되지만 응답이 유실된다. 화면이 스스로 다시 읽어 저장 완료로 바뀐다.
      await chooseCurrent(context, item);
      await expectChoiceSaved(page, item);
      await expect(primaryAction(page)).toBeEnabled();
      expect(server.characterCandidate(item.id).reviewedApplicationMode).toBe('APPLY_PROPOSAL');
    },
  },
};
