import { execSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { expect, test } from '@playwright/test';
import { describeGroupKey, ENTRY_URLS, installReviewFlowMock, signIn, type ScenarioId } from './review-flow-metrics/fixture';
import { baselineFlow } from './review-flow-metrics/flows/baseline';
import { improvedFlow } from './review-flow-metrics/flows/improved';
import { FlowMeter } from './review-flow-metrics/meter';

/*
 * #211 후속: 정답을 미리 아는 합성 사례로 검토 흐름의 화면 왕복·검색 반복·저장/확정 동작 수를 센다.
 * METRICS_FLOW=baseline|improved(기본 improved)로 화면 버전별 어댑터를 고르고,
 * 결과는 test-results/review-flow-metrics/<METRICS_LABEL>.json(기본 local)에 남긴다.
 * 목 API 기준 조작 수만 세며 원문 읽기·서버 대기 시간은 기록하지 않는다.
 */

const flow = process.env.METRICS_FLOW === 'baseline' ? baselineFlow : improvedFlow;
const label = process.env.METRICS_LABEL || 'local';
const SCENARIOS: Record<ScenarioId, { title: string; endCondition: string }> = {
  A: {
    title: '미상 묶음의 서로 다른 인물 후보 4건 연결·현재 반영·확정',
    endCondition: '미상 후보 4건(직업→인물H, 소속·상태→인물B, 나이→새 인물J)이 모두 CONFIRMED',
  },
  B: {
    title: '같은 세계관 대상(장소X) 후보 5건 대상 연결·확정',
    endCondition: '대상 미연결 후보 5건이 모두 장소X로 CONFIRMED',
  },
  C: {
    title: '현재 반영 선택 저장 응답 유실 뒤 복구',
    endCondition: '응답이 유실된 후보의 reviewedApplicationMode가 서버에 저장되고 화면이 저장 완료로 보임',
  },
};

const results: Partial<Record<ScenarioId, ReturnType<FlowMeter['result']> & { unhandledApi: string[] }>> = {};

test.describe('검토 흐름 조작 수 측정', () => {
  test.describe.configure({ mode: 'serial' });
  test.skip(Boolean(flow.skipReason), flow.skipReason);

  for (const scenario of Object.keys(SCENARIOS) as ScenarioId[]) {
    test(`${scenario}: ${SCENARIOS[scenario].title}`, async ({ page }) => {
      test.setTimeout(120_000);
      const server = await installReviewFlowMock(page, { abortFirstApplicationModePatch: scenario === 'C' });
      const meter = new FlowMeter(page, describeGroupKey);
      await meter.attach();
      await signIn(page);
      meter.start();
      await meter.goto(ENTRY_URLS[scenario]);
      await flow.scenarios[scenario]({ page, meter, server });
      results[scenario] = { ...meter.result(), unhandledApi: [...server.unhandled] };
      expect(server.unhandled).toEqual([]);
    });
  }

  test.afterAll(() => {
    const ids = Object.keys(SCENARIOS) as ScenarioId[];
    // 한 시나리오라도 끝 조건에 닿지 못했으면 측정값을 남기지 않는다.
    if (ids.some(id => !results[id])) return;
    const git = (command: string) => {
      try { return execSync(command, { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim(); } catch { return null; }
    };
    const output = {
      schema: 'catchhole-review-flow-metrics/v1',
      label,
      flow: flow.name,
      adapter: flow.file,
      uiCommit: process.env.METRICS_UI_COMMIT || git('git rev-parse --short HEAD'),
      headCommit: git('git rev-parse --short HEAD'),
      recordedOn: new Date().toLocaleDateString('sv-SE'),
      basis: '목 API(Playwright route) 기준 UI 조작·요청 수. 원문 읽기·서버 대기 시간은 측정하지 않는다. 합성 사례 1건.',
      metricDefinitions: {
        screenRoundTrips: '검토 화면 밖으로 나간 이동 + URL group 값 변경(사용자 선택·자동 이동 모두) + 캐릭터/세계관 탭 전환',
        autoGroupChanges: '사용자가 사이드바에서 고르지 않았는데 바뀐 group(연결·확정 뒤 자동 이동)',
        searchInputs: '검색 입력 횟수(searchTyped) + 응답을 받은 GET characters 목록 요청(모달 페이지 넘김 포함) + 응답을 받은 GET world-settings?q= 요청',
        pickerOpens: '연결·대상 모달/피커를 연 횟수',
        saveRequests: '보낸 PATCH/POST 요청 수(응답이 유실된 요청 포함), 경로별 saveRequestsByRoute',
        clicks: '어댑터가 수행한 UI 클릭 수',
        textEntries: '검색이 아닌 입력(새 인물 이름 등)',
        pageLoads: '문서 로드 수(진입 1회 포함)',
        failedWrites: '응답을 받지 못한 쓰기 요청(시나리오 C의 유실 1건 등)',
        cancelledReads: '화면이 스스로 취소한 조회 요청(참고용, 다른 지표에 넣지 않음)',
      },
      scenarios: Object.fromEntries(ids.map(id => [id, { ...SCENARIOS[id], ...results[id] }])),
    };
    const directory = resolve('test-results', 'review-flow-metrics');
    mkdirSync(directory, { recursive: true });
    writeFileSync(resolve(directory, `${label}.json`), `${JSON.stringify(output, null, 2)}\n`);
    console.log(`\n검토 흐름 조작 수(${flow.name}, ${label}) — 목 API 기준 조작 수, 시간 미측정`);
    console.table(Object.fromEntries(ids.map(id => {
      const { saveRequestsByRoute, ...metrics } = results[id]!.metrics;
      void saveRequestsByRoute;
      return [id, metrics];
    })));
  });
});
