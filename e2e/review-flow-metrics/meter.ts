import { expect, type Locator, type Page, type Request } from '@playwright/test';

/*
 * 검토 흐름 조작 수 측정기.
 * - 어댑터의 모든 UI 조작은 click·selectGroup·openPicker·search·fill·goto를 거쳐 센다.
 * - 화면 위치(URL)는 history API 호출을 감싸는 init script로 받아 `group` 변경·탭 전환·검토 화면 밖 이동을 센다.
 * - 쓰기 요청은 보낸 시점에 센다(응답이 유실된 요청도 보낸 요청이다).
 * - 검색 요청(캐릭터 목록·세계관 대상 q 검색)은 응답을 받은 요청만 센다. 화면이 스스로 취소한 조회는 cancelledReads로 따로 센다.
 * - 시간은 기록하지 않는다(목 API라 서버 대기·원문 읽기 시간이 의미 없다).
 */

type Tab = 'character' | 'world';
type EventKind = 'click' | 'search' | 'fill' | 'picker' | 'pageLoad' | 'userGroupChange' | 'autoGroupChange' | 'tabSwitch'
  | 'outsideNavigation' | 'save' | 'characterListRequest' | 'worldSearchRequest' | 'failedWrite' | 'cancelledRead';
interface MeterEvent { phase: string; kind: EventKind; detail: string; route?: string }

const SAVE_ROUTES: Array<[method: string, pattern: RegExp, label: string]> = [
  ['PATCH', /\/setting-candidates\/selected-character-match$/, 'selected-character-match'],
  ['PATCH', /\/setting-candidates\/group-character-match$/, 'group-character-match'],
  ['PATCH', /\/setting-candidates\/[^/]+\/character-match$/, 'character-match'],
  ['POST', /\/setting-candidates\/group-confirm$/, 'character group-confirm'],
  ['PATCH', /\/world-setting-candidates\/decisions$/, 'world decisions'],
  ['POST', /\/world-setting-candidates\/group-confirm$/, 'world group-confirm'],
  ['PATCH', /\/setting-candidates\/[^/]+$/, 'setting-candidates/{id} PATCH'],
];

export class FlowMeter {
  private events: MeterEvent[] = [];
  private currentPhase = 'main';
  private started = false;
  private wasInside = false;
  private lastHref: string | null = null;
  private lastTab: Tab | null = null;
  private lastGroup: Partial<Record<Tab, string>> = {};
  private expectedGroup: string | null = null;

  constructor(private readonly page: Page, private readonly describeGroup: (groupKey: string) => string = key => key) {}

  async attach() {
    await this.page.exposeFunction('__flowMeterUrl', (href: string, documentStart: boolean) => this.onUrl(href, documentStart));
    await this.page.addInitScript(() => {
      const target = window as unknown as { __flowMeterUrl?: (href: string, documentStart: boolean) => void };
      const send = (documentStart: boolean, attempt = 0) => {
        if (typeof target.__flowMeterUrl === 'function') void target.__flowMeterUrl(location.href, documentStart);
        else if (attempt < 50) setTimeout(() => send(documentStart, attempt + 1), 0);
      };
      for (const method of ['pushState', 'replaceState'] as const) {
        const original = history[method];
        history[method] = function patched(this: History, ...args: Parameters<History['pushState']>) {
          const result = original.apply(this, args);
          send(false);
          return result;
        };
      }
      addEventListener('popstate', () => send(false));
      send(true);
    });
    this.page.on('request', request => this.onRequest(request));
    this.page.on('requestfinished', request => this.onRequestFinished(request));
    this.page.on('requestfailed', request => {
      if (!this.started || !request.url().includes('/api/v1/')) return;
      const detail = `${request.method()} ${shortPath(request.url())} 실패(${request.failure()?.errorText ?? '알 수 없음'})`;
      this.record(request.method() === 'GET' ? 'cancelledRead' : 'failedWrite', detail);
    });
  }

  /** 이 시점 이후의 조작·요청만 센다(로그인 준비는 제외). */
  start() {
    this.started = true;
  }

  /** 이후 이벤트를 별도 구간으로도 집계한다(예: 복구 구간). */
  phase(name: string) {
    this.currentPhase = name;
  }

  async goto(url: string) {
    await this.page.goto(url);
  }

  async click(locator: Locator, label: string) {
    this.record('click', label);
    await locator.click();
  }

  /** 연결·대상 모달/피커를 여는 클릭 */
  async openPicker(locator: Locator, label: string) {
    this.record('picker', label);
    await this.click(locator, label);
  }

  /** 사이드바에서 그룹을 직접 고르는 클릭. 이 클릭으로 생긴 `group` 변경은 사용자 이동으로 센다. */
  async selectGroup(locator: Locator, groupKey: string, label: string) {
    this.expectedGroup = groupKey;
    try {
      await this.click(locator, label);
      await expect.poll(() => this.lastGroup[this.lastTab ?? 'character']).toBe(groupKey);
    } finally {
      this.expectedGroup = null;
    }
  }

  async search(locator: Locator, text: string, label: string) {
    this.record('search', `${label}: “${text}”`);
    await locator.fill(text);
  }

  async fill(locator: Locator, text: string, label: string) {
    this.record('fill', `${label}: “${text}”`);
    await locator.fill(text);
  }

  async waitForGroup(groupKey: string) {
    await expect.poll(() => this.lastGroup[this.lastTab ?? 'character']).toBe(groupKey);
  }

  result() {
    const phases = [...new Set(this.events.map(event => event.phase))];
    return {
      metrics: summarize(this.events),
      phases: Object.fromEntries(phases.map(phase => [phase, summarize(this.events.filter(event => event.phase === phase))])),
      trace: this.events.map(event => `[${event.phase}] ${event.kind}: ${event.detail}`),
    };
  }

  private record(kind: EventKind, detail: string, route?: string) {
    if (!this.started) return;
    this.events.push({ phase: this.currentPhase, kind, detail, route });
  }

  private onUrl(href: string, documentStart: boolean) {
    if (!this.started) return;
    const url = new URL(href);
    if (documentStart) this.record('pageLoad', `${url.pathname} 문서 로드`);
    else if (href === this.lastHref) return;
    this.lastHref = href;
    const inside = url.pathname === '/setting-review';
    if (this.wasInside && !inside) this.record('outsideNavigation', `검토 화면 밖으로 이동: ${url.pathname}`);
    this.wasInside = inside;
    if (!inside) return;
    const tab: Tab = url.searchParams.get('candidateType') === 'world' ? 'world' : 'character';
    if (this.lastTab && this.lastTab !== tab) this.record('tabSwitch', `${this.lastTab} → ${tab}`);
    this.lastTab = tab;
    const group = url.searchParams.get('group');
    if (!group) return;
    const previous = this.lastGroup[tab];
    if (previous !== undefined && previous !== group) {
      const user = this.expectedGroup === group;
      this.record(user ? 'userGroupChange' : 'autoGroupChange', `${this.describeGroup(previous)} → ${this.describeGroup(group)}`);
    }
    this.lastGroup[tab] = group;
  }

  private onRequestFinished(request: Request) {
    if (!this.started || !request.url().includes('/api/v1/') || request.method() !== 'GET') return;
    const url = new URL(request.url());
    if (url.pathname.endsWith('/characters')) this.record('characterListRequest', `GET ${shortPath(request.url())}`);
    else if (url.pathname.endsWith('/world-settings') && url.searchParams.get('q')) this.record('worldSearchRequest', `GET ${shortPath(request.url())}`);
  }

  private onRequest(request: Request) {
    if (!this.started || !request.url().includes('/api/v1/') || request.method() === 'GET') return;
    const url = new URL(request.url());
    const method = request.method();
    const route = SAVE_ROUTES.find(([routeMethod, pattern]) => routeMethod === method && pattern.test(url.pathname))?.[2] ?? `${method} 기타`;
    this.record('save', `${method} ${route}`, route);
  }
}

function summarize(events: MeterEvent[]) {
  const count = (kind: EventKind) => events.filter(event => event.kind === kind).length;
  const saveRequestsByRoute: Record<string, number> = {};
  events.filter(event => event.kind === 'save').forEach(event => {
    saveRequestsByRoute[event.route!] = (saveRequestsByRoute[event.route!] ?? 0) + 1;
  });
  const groupChanges = count('userGroupChange') + count('autoGroupChange');
  return {
    screenRoundTrips: count('outsideNavigation') + groupChanges + count('tabSwitch'),
    outsideNavigations: count('outsideNavigation'),
    groupChanges,
    userGroupChanges: count('userGroupChange'),
    autoGroupChanges: count('autoGroupChange'),
    tabSwitches: count('tabSwitch'),
    searchInputs: count('search') + count('characterListRequest') + count('worldSearchRequest'),
    searchTyped: count('search'),
    characterListRequests: count('characterListRequest'),
    worldSearchRequests: count('worldSearchRequest'),
    pickerOpens: count('picker'),
    saveRequests: count('save'),
    saveRequestsByRoute,
    clicks: count('click'),
    textEntries: count('fill'),
    pageLoads: count('pageLoad'),
    failedWrites: count('failedWrite'),
    cancelledReads: count('cancelledRead'),
  };
}

/** 추적 로그용: 작품 경로를 줄이고 검색어를 읽을 수 있게 한다. */
function shortPath(href: string) {
  const url = new URL(href);
  return `${url.pathname.replace(/^\/api\/v1\/works\/[^/]+/, '')}${decodeURIComponent(url.search)}`;
}
