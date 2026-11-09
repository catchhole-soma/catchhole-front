import { expect, test, type Page } from '@playwright/test';

const workId = '11111111-1111-4111-8111-111111111111';
const directory = `/dashboard?workId=${workId}&nav=settingDB&tab=characters`;
const people = Array.from({ length: 15 }, (_, i) => ({
  id: `22222222-2222-4222-8222-${String(i + 1).padStart(12, '0')}`,
  name: i === 14 ? '조조' : `인물 ${i + 1}`, recordCount: 150 - i * 5,
  firstAppearanceEpisodeNo: i + 1, aliases: i === 14 ? ['맹덕', '백%기사'] : [],
}));
async function mock(page: Page) {
  const requests: URL[] = [];
  await page.addInitScript(() => localStorage.setItem('accessToken', 'catalog-fixture'));
  await page.route('**/api/v1/**', async route => {
    const url = new URL(route.request().url()); const path = url.pathname;
    let data: unknown = [];
    if (path.endsWith('/auth/me')) data = { id: 1, displayName: '작가', email: 'catalog@example.invalid', role: 'AUTHOR', status: 'ACTIVE' };
    else if (path.endsWith(`/works/${workId}`)) data = { id: workId, title: '합성 작품', genre: 'FANTASY', latestEpisodeNo: 198 };
    else if (path.endsWith('/works')) data = [{ id: workId, title: '합성 작품', genre: 'FANTASY', latestEpisodeNo: 198 }];
    else if (path.endsWith('/characters')) {
      requests.push(url);
      const q = (url.searchParams.get('query') ?? '').toLowerCase();
      const rows = people.filter(p => [p.name, ...p.aliases].some(n => n.toLowerCase().includes(q)));
      const pageNo = Number(url.searchParams.get('page') ?? 0), size = Number(url.searchParams.get('size') ?? 24);
      data = { content: rows.slice(pageNo * size, (pageNo + 1) * size), page: pageNo, size, totalElements: rows.length, totalPages: Math.ceil(rows.length / size), hasNext: (pageNo + 1) * size < rows.length };
    } else if (path.includes('/characters/')) {
      const person = people.find(p => path.endsWith(`/${p.id}`));
      if (person) data = { id: person.id, name: person.name, profile: [], stats: [], skills: [], items: [], statuses: [] };
    }
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify({ success: true, data }) });
  });
  return requests;
}

test('누적 기록 수는 서버 카드에서 표시하고 검색은 뒤 페이지의 별칭도 찾는다', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const requests = await mock(page); await page.goto(directory);
  await expect(page.getByText('누적 기록 150건', { exact: true })).toBeVisible();
  expect(requests.every(r => Number(r.searchParams.get('size')) <= 24)).toBeTruthy();
  await expect(page.getByRole('button', { name: '조조 캐릭터 상세 보기' })).toHaveCount(0);
  const input = page.getByRole('textbox', { name: '캐릭터 이름 또는 별칭 검색' });
  await input.fill('맹덕');
  await expect(page.getByRole('button', { name: '조조 캐릭터 상세 보기' })).toBeVisible();
  expect(requests.at(-1)?.searchParams.get('query')).toBe('맹덕');
  expect(requests.at(-1)?.searchParams.get('page')).toBe('0');
  await expect(page).toHaveURL(/characterQuery=/);
  await page.reload(); await expect(input).toHaveValue('맹덕');
  await expect(page.getByRole('button', { name: '조조 캐릭터 상세 보기' })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBeTruthy();
  await page.screenshot({ path: '/tmp/gh410-character-directory-mobile.png', fullPage: true });
});

test('한글 조합 중에는 요청하지 않고 조합 완료 후 한 번 검색한다', async ({ page }) => {
  const requests = await mock(page); await page.goto(directory);
  const input = page.getByRole('textbox', { name: '캐릭터 이름 또는 별칭 검색' });
  await expect(page.getByText('누적 기록 150건', { exact: true })).toBeVisible();
  await input.dispatchEvent('compositionstart'); await input.fill('맹');
  await page.waitForTimeout(400);
  expect(requests.filter(r => r.searchParams.has('query'))).toHaveLength(0);
  await input.fill('맹덕'); await input.dispatchEvent('compositionend');
  await expect(page.getByRole('button', { name: '조조 캐릭터 상세 보기' })).toBeVisible();
  expect(requests.filter(r => r.searchParams.has('query'))).toHaveLength(1);
});

test('검색 변경은 페이지를 초기화하고 비어 있는 결과와 전체 빈 작품을 구분한다', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const requests = await mock(page); await page.goto(`${directory}&characterOffset=6`);
  await expect(page.getByRole('button', { name: '인물 7 캐릭터 상세 보기' })).toBeVisible();
  const input = page.getByRole('textbox', { name: '캐릭터 이름 또는 별칭 검색' });
  await input.fill('없는 인물'); await expect(page.getByText('검색 결과가 없습니다', { exact: true })).toBeVisible();
  expect(new URL(page.url()).searchParams.has('characterOffset')).toBeFalsy();
  await expect(page.getByRole('button', { name: '원고 분석하기', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: '검색 초기화', exact: true }).click();
  await expect(page.getByText('누적 기록 150건', { exact: true })).toBeVisible();
  expect(requests.at(-1)?.searchParams.get('page')).toBe('0');
  await input.fill('백%'); await expect(page.getByRole('button', { name: '조조 캐릭터 상세 보기' })).toBeVisible();
  expect(requests.at(-1)?.searchParams.get('query')).toBe('백%');
});

test('데스크톱에서 검색을 지우고 뒤로가면 검색어와 결과를 복원한다', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await mock(page); await page.goto(directory);
  const input = page.getByRole('textbox', { name: '캐릭터 이름 또는 별칭 검색' });
  await input.fill('맹덕'); await expect(page.getByRole('button', { name: '조조 캐릭터 상세 보기' })).toBeVisible();
  await page.getByRole('button', { name: '인물 검색 초기화' }).click();
  await expect(page.getByText('누적 기록 150건', { exact: true })).toBeVisible();
  await page.goBack(); await expect(input).toHaveValue('맹덕');
  await expect(page.locator('.character-card')).toHaveCount(1);
  await page.screenshot({ path: '/tmp/gh410-character-directory-desktop.png', fullPage: true });
});
