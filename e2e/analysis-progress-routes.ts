import type { Page, Route } from '@playwright/test';

/** Reuse per-job scenario builders while fulfilling the new atomic bulk HTTP contract. No detail HTTP requests are sent. */
export async function routeAnalysisProgress(page: Page, handler: (route: Route) => unknown, pattern = '**/analysis-jobs/**') {
  await page.route(pattern, async route => {
    const url = new URL(route.request().url());
    if (url.pathname.endsWith('/world-setting-candidates/progress')) {
      const request = new Proxy(route.request(), { get(target, key) {
        if (key === 'url') return () => { const original = new URL(url); original.pathname = original.pathname.replace(/\/progress$/, ''); return original.href; };
        const value = Reflect.get(target, key); return typeof value === 'function' ? value.bind(target) : value;
      } });
      const countRoute = new Proxy(route, { get(target, key) {
        if (key === 'request') return () => request;
        if (key === 'fulfill') return async (options: Parameters<Route['fulfill']>[0]) => {
          const response = JSON.parse(String(options?.body));
          if ((options?.status ?? 200) < 400) response.data = {
            pendingComparisonCount: response.data?.pendingComparisonCount ?? 0,
            processingComparisonCount: response.data?.processingComparisonCount ?? 0,
            tokenInterruptedComparisonCount: response.data?.tokenInterruptedComparisonCount ?? 0,
          };
          await route.fulfill({ ...options, body: JSON.stringify(response) });
        };
        const value = Reflect.get(target, key); return typeof value === 'function' ? value.bind(target) : value;
      } });
      await handler(countRoute); return;
    }
    if (!url.pathname.endsWith('/analysis-jobs/progress')) { await handler(route); return; }
    const ids = url.searchParams.getAll('analysisJobIds').flatMap(value => value.split(','));
    const responses = await Promise.all(ids.map(async id => {
      let result: Parameters<Route['fulfill']>[0] | undefined;
      const request = new Proxy(route.request(), { get(target, key) {
        if (key === 'url') return () => `${url.origin}${url.pathname.replace(/\/progress$/, '')}/${id}`;
        const value = Reflect.get(target, key); return typeof value === 'function' ? value.bind(target) : value;
      } });
      const jobRoute = new Proxy(route, { get(target, key) {
        if (key === 'request') return () => request;
        if (key === 'fulfill') return async (options: Parameters<Route['fulfill']>[0]) => { result = options; };
        const value = Reflect.get(target, key); return typeof value === 'function' ? value.bind(target) : value;
      } });
      await handler(jobRoute);
      return result;
    }));
    if (responses.some(response => !response)) return;
    const error = responses.find(response => (response?.status ?? 200) >= 400);
    if (error) { await route.fulfill(error); return; }
    const data = responses.flatMap(response => JSON.parse(String(response!.body)).data);
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data, error: null }) });
  });
}

export const routeProgressApi = (page: Page, handler: (route: Route) => unknown) => routeAnalysisProgress(page, handler, '**/api/v1/**');
