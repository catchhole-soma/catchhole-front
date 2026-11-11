import type { Page } from '@playwright/test';

export type GtagCall = unknown[];

// 운영 빌드에서만 주입되는 gtag를 대신해 호출 인자를 순서대로 기록한다.
export async function installGtagMock(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const calls: unknown[][] = [];
    const browserWindow = window as Window & {
      __gtagCalls?: unknown[][];
      gtag?: (...args: unknown[]) => void;
    };
    browserWindow.__gtagCalls = calls;
    browserWindow.gtag = (...args: unknown[]) => {
      calls.push(args);
    };
  });
}

// mock을 설치하지 않은 페이지에서는 빈 목록을 돌려준다.
export function getGtagCalls(page: Page): Promise<GtagCall[]> {
  return page.evaluate(() => (
    (window as Window & { __gtagCalls?: unknown[][] }).__gtagCalls ?? []
  ));
}

export async function getGtagEvents(page: Page, eventName: string): Promise<GtagCall[]> {
  return (await getGtagCalls(page)).filter(call => call[0] === 'event' && call[1] === eventName);
}
