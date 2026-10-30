import { expect, type Page } from '@playwright/test';
import { CHARACTER_CASES, UNKNOWN_GROUP_KEY, WORLD_CASES, WORLD_TARGET, type FlowAdapter, type FlowContext } from '../fixture';
import type { FlowMeter } from '../meter';

/*
 * 기준선 어댑터: main(#211 후속 이전) 화면에서 작가가 정답을 알고 있을 때 밟는 최소 절차.
 * - 캐릭터: 미상 묶음 → 후보별 `캐릭터 연결 변경` 모달(8명 단위, 현재 페이지 안에서만 검색) →
 *   연결하면 화면이 연결된 인물 묶음으로 이동 → 그 자리에서 현재 반영 선택 → 사이드바로 미상 묶음 복귀 → … →
 *   인물 묶음마다 `N개 설정 모두 확정`.
 * - 세계관: 행마다 대상 검색 → 대상 카드 선택 → `이 내용으로 검토 완료` → 마지막에 `모두 확정`.
 * 문구·역할 이름에 의존하므로 화면 문구가 바뀌면 이 파일을 함께 고친다.
 */

type CharacterCase = (typeof CHARACTER_CASES)[number];

const groupCard = (page: Page, name: string) => page.locator('.candidate-group-card')
  .filter({ has: page.locator('strong', { hasText: new RegExp(`^${name}$`) }) });
const candidateRegion = (page: Page, item: CharacterCase) => page.getByRole('region', { name: `${item.label} 설정 후보`, exact: true });
const currentGroup = (page: Page) => new URL(page.url()).searchParams.get('group');

async function openUnknownGroup({ page, meter }: FlowContext) {
  await meter.selectGroup(groupCard(page, '미상'), UNKNOWN_GROUP_KEY, '사이드바: 미상 묶음 열기');
  await expect(page.getByRole('heading', { level: 2 })).toContainText('미상');
}

/** 후보 하나를 정답 인물에 연결한다. 연결하면 main 화면은 연결된 인물 묶음으로 이동한다. */
async function linkCandidate({ page, meter, server }: FlowContext, item: CharacterCase) {
  const region = candidateRegion(page, item);
  await expect(region).toContainText('캐릭터 · 미상');
  await meter.openPicker(region.getByRole('button', { name: '캐릭터 연결 변경', exact: true }), `${item.label}: 캐릭터 연결 변경`);
  const dialog = page.getByRole('dialog', { name: '캐릭터 연결 확인' });
  await expect(dialog).toBeVisible();
  if (item.createNew) {
    await meter.click(dialog.getByRole('button', { name: '새 캐릭터로 등록', exact: true }), '모달: 새 캐릭터로 등록 선택');
    await meter.fill(dialog.getByLabel('새 캐릭터 이름', { exact: true }), item.answer, '모달: 새 캐릭터 이름');
    await meter.click(dialog.locator('button[type="submit"]'), '모달: 새 캐릭터로 등록');
  } else {
    // 목록은 8명씩이고 검색은 현재 페이지 안에서만 된다. 대상이 보일 때까지 페이지를 넘긴다.
    const choices = dialog.locator('.review-modal__choice');
    const target = choices.filter({ hasText: new RegExp(`^${item.answer}`) });
    for (let pageIndex = 1; ; pageIndex += 1) {
      await expect(choices.first()).toBeVisible();
      if (await target.count()) break;
      await meter.click(dialog.getByRole('button', { name: '다음 페이지', exact: true }), `모달: 다음 페이지(${pageIndex + 1}쪽)`);
      await expect(dialog.getByText(`${pageIndex + 1} / `, { exact: false })).toBeVisible();
    }
    await meter.click(target, `모달: ${item.answer} 선택`);
    await meter.click(dialog.getByRole('button', { name: '선택한 캐릭터에 연결', exact: true }), '모달: 선택한 캐릭터에 연결');
  }
  await expect(dialog).toHaveCount(0);
  const candidate = server.characterCandidate(item.id);
  const groupKey = candidate.matchedCharacterId ? `existing:${candidate.matchedCharacterId}` : item.answer.toLocaleLowerCase('ko-KR');
  await meter.waitForGroup(groupKey);
  await expect(region).toContainText(`캐릭터 · ${item.answer}`);
}

async function chooseCurrent({ page, meter }: FlowContext, item: CharacterCase) {
  const region = candidateRegion(page, item);
  await meter.click(region.getByRole('button', { name: /현재 설정에 반영/ }), `${item.label}: 현재 설정에 반영`);
}

async function expectChoiceSaved(page: Page, item: CharacterCase) {
  const region = candidateRegion(page, item);
  await expect(region.getByText('선택한 내용을 저장했어요.', { exact: false })).toBeVisible();
  await expect(region.getByRole('alert')).toHaveCount(0);
}

async function confirmCurrentGroup({ page, meter }: FlowContext, name: string, count: number) {
  const before = currentGroup(page);
  await expect(page.getByRole('heading', { level: 2 })).toContainText(name);
  await meter.click(page.getByRole('button', { name: `${count}개 설정 모두 확정`, exact: true }), `${name} 묶음: ${count}개 설정 모두 확정`);
  // 확정하면 main 화면은 현재 페이지의 첫 그룹을 자동으로 고른다. 자동 선택이 끝난 뒤 다음 조작을 한다.
  await expect.poll(() => {
    const group = currentGroup(page);
    return group !== null && group !== before;
  }).toBe(true);
}

export const baselineFlow: FlowAdapter = {
  name: 'baseline',
  file: 'e2e/review-flow-metrics/flows/baseline.ts',
  scenarios: {
    A: async context => {
      const { page, meter, server } = context;
      for (const item of CHARACTER_CASES) {
        await openUnknownGroup(context);
        await linkCandidate(context, item);
        await chooseCurrent(context, item);
        await expectChoiceSaved(page, item);
      }
      // 마지막 연결로 이미 열려 있는 인물J 묶음부터 확정하고, 남은 인물 묶음은 사이드바로 찾아 확정한다.
      await confirmCurrentGroup(context, '인물J', 1);
      await selectPersonGroup(context, meter, '인물H');
      await confirmCurrentGroup(context, '인물H', 1);
      await selectPersonGroup(context, meter, '인물B');
      await confirmCurrentGroup(context, '인물B', 2);
      // 끝 조건: 미상 후보 4건이 모두 정답 대상으로 확정되고 다음 그룹(인물A)이 열린다.
      await expect.poll(() => CHARACTER_CASES.map(item => server.characterCandidate(item.id).reviewStatus)).toEqual(['CONFIRMED', 'CONFIRMED', 'CONFIRMED', 'CONFIRMED']);
      await expect(page.getByRole('heading', { level: 2 })).toContainText('인물A');
    },
    B: async ({ page, meter, server }) => {
      await expect(page.locator('.world-setting-diff-row')).toHaveCount(WORLD_CASES.length);
      for (const [index, item] of WORLD_CASES.entries()) {
        const row = page.locator(`.world-setting-diff-row[data-candidate-id="${item.id}"]`);
        await meter.search(row.getByRole('textbox', { name: '기존 세계관 대상 검색', exact: true }), WORLD_TARGET.name, `${index + 1}행 ${item.settingName}: 대상 검색`);
        const target = row.getByRole('button', { name: new RegExp(`${WORLD_TARGET.name}.*이 대상에 연결`) });
        await meter.click(target, `${index + 1}행: ${WORLD_TARGET.name} 카드 선택`);
        await expect(row.getByLabel('최종 내용', { exact: true })).toHaveValue(item.value);
        await meter.click(row.getByRole('button', { name: '이 내용으로 검토 완료', exact: true }), `${index + 1}행: 이 내용으로 검토 완료`);
        await expect(row.locator('.review-cb-heading')).toContainText('검토 완료');
      }
      await meter.click(page.getByRole('button', { name: '모두 확정', exact: true }), '모두 확정');
      await expect.poll(() => WORLD_CASES.map(item => server.worldCandidate(item.id).reviewStatus)).toEqual(WORLD_CASES.map(() => 'CONFIRMED'));
    },
    C: async context => {
      const { page, meter, server } = context;
      const item = CHARACTER_CASES[0];
      await openUnknownGroup(context);
      await linkCandidate(context, item);
      meter.phase('recovery');
      // 첫 현재/이력 선택 PATCH는 서버에 저장되지만 응답이 유실된다.
      await chooseCurrent(context, item);
      const region = candidateRegion(page, item);
      await expect(region.getByRole('alert')).toBeVisible();
      await expect(region.getByText('선택한 내용을 저장했어요.', { exact: false })).toHaveCount(0);
      // main 화면은 네트워크 오류 뒤 목록을 다시 읽지 않는다. 작가가 볼 수 있는 복구 수단은 같은 선택을 다시 누르는 것이다.
      await chooseCurrent(context, item);
      await expectChoiceSaved(page, item);
      expect(server.characterCandidate(item.id).reviewedApplicationMode).toBe('APPLY_PROPOSAL');
    },
  },
};

async function selectPersonGroup({ page, server }: FlowContext, meter: FlowMeter, name: string) {
  const characterId = server.characterIdByName(name);
  await meter.selectGroup(groupCard(page, name), characterId ? `existing:${characterId}` : name.toLocaleLowerCase('ko-KR'), `사이드바: ${name} 묶음 열기`);
}
