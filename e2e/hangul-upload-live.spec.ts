import { readFileSync } from 'node:fs';
import { expect, type APIResponse } from '@playwright/test';
import { test } from './local-live-fixture';

async function data(response: APIResponse) {
  expect(response.ok(), await response.text()).toBeTruthy();
  return (await response.json()).data;
}
function form(metadata: unknown, names: string[]) {
  const result = new FormData();
  result.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }), 'metadata.json');
  for (const name of names) {
    const bytes = readFileSync(`e2e/fixtures/hangul/${name}`);
    result.append('episodeFiles', new Blob([new Uint8Array(bytes)], { type: 'application/octet-stream' }), name);
  }
  return result;
}

test('한글 원고 세 업로드 방식·설정집 편집·원고 교체를 실제 로컬 API와 저장소로 검증한다', async ({ page, request, liveAccount }) => {
  const login = await data(await request.post(`${liveAccount.api}/api/v1/auth/login`, {
    data: { email: liveAccount.email, password: liveAccount.password },
  }));
  const headers = { Authorization: `Bearer ${login.accessToken}` };
  const work = await data(await request.post(`${liveAccount.api}/api/v1/works`, {
    headers, data: { title: '한글 업로드 일회용 검증', genre: '로맨스', description: '합성 원고만 사용' },
  }));
  const api = `${liveAccount.api}/api/v1/works/${work.id}`;
  const first = await data(await request.post(`${api}/episodes`, {
    headers, multipart: form({ uploadType: 'SINGLE_EPISODE', singleEpisodeNo: 1, singleEpisodeTitle: '첫 편지' }, ['episode-1.hwp']),
  }));
  const firstId = first.createdEpisodes[0].id;
  expect((await data(await request.get(`${api}/episodes/${firstId}`, { headers }))).content).toContain('서윤은 성문 앞에서 편지를 읽었다.');

  for (const mode of ['MULTI_EPISODE_SINGLE_FILE', 'MULTI_EPISODE_MULTI_FILE']) {
    const multi = mode === 'MULTI_EPISODE_MULTI_FILE';
    const names = multi ? ['episode-2.hwpx', 'episode-1.hwp'] : ['two-episodes.hwpx'];
    const detected = await data(await request.post(`${api}/episodes/detect`, { headers, multipart: form({ uploadType: mode }, names) }));
    expect(detected.detectedEpisodes.map((episode: { episodeNo: number }) => episode.episodeNo)).toEqual(multi ? [2, 1] : [1, 2]);
    const offset = multi ? 3 : 1;
    const confirmations = detected.detectedEpisodes.map((episode: { detectionOrder: number; episodeNo: number; title: string }) => ({
      detectionOrder: episode.detectionOrder, episodeNo: episode.episodeNo + offset, title: episode.title,
    })).sort((a: { episodeNo: number }, b: { episodeNo: number }) => a.episodeNo - b.episodeNo);
    const uploaded = await data(await request.post(`${api}/episodes`, {
      headers, multipart: form({ uploadType: mode, episodeConfirmations: confirmations }, names),
    }));
    for (const episode of uploaded.createdEpisodes) {
      const saved = await data(await request.get(`${api}/episodes/${episode.id}`, { headers }));
      expect(saved.content).toContain(episode.episodeNo - offset === 1 ? '서윤은 성문' : '도윤은 오래된');
      if (multi) expect(saved.originalFilename).toBe(episode.episodeNo - offset === 1 ? 'episode-1.hwp' : 'episode-2.hwpx');
    }
  }

  await page.addInitScript(token => localStorage.setItem('accessToken', token), login.accessToken);
  await page.goto(`/dashboard?workId=${work.id}&nav=settingDB&tab=worldrules`);
  await page.getByTestId('open-empty-setting-book-upload').click();
  await page.getByTestId('setting-book-file-input').setInputFiles({
    name: '인물 설정집.hwpx', mimeType: 'application/hwp+zip', buffer: readFileSync('e2e/fixtures/hangul/episode-2.hwpx'),
  });
  await page.getByTestId('setting-book-upload-submit').click();
  const row = page.locator('[data-testid^="setting-book-row-"]');
  await expect(row).toHaveCount(1);
  await expect(row).toContainText('HWPX');
  await row.click();
  await expect(page.getByTestId('setting-book-source')).toContainText('도윤은 오래된 약속을 떠올렸다.');
  await page.getByRole('button', { name: '수정', exact: true }).click();
  await page.getByTestId('setting-book-editor').fill('서윤과 도윤은 오래된 벗이다.');
  await page.getByTestId('setting-book-save').click();
  await page.reload();
  await expect(page.getByTestId('setting-book-source')).toContainText('서윤과 도윤은 오래된 벗이다.');
  const settings = await data(await request.get(`${api}/setting-books`, { headers }));
  expect(settings[0].mimeType).toBe('application/hwp+zip');
  expect(settings[0].originalFilename).toBe('인물 설정집.hwpx');

  await page.goto(`/dashboard?workId=${work.id}&nav=manuscripts`);
  await page.locator('.manuscript-row').filter({ hasText: '첫 편지' }).getByRole('button', { name: '파일 변경', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: '회차 파일 변경', exact: true });
  await dialog.locator('input[type=file]').setInputFiles({
    name: '수정 원고.hwpx', mimeType: 'application/hwp+zip', buffer: readFileSync('e2e/fixtures/hangul/episode-2.hwpx'),
  });
  await dialog.getByRole('button', { name: '파일 변경', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  const replaced = await data(await request.get(`${api}/episodes/${firstId}`, { headers }));
  expect(replaced.episodeNo).toBe(1);
  expect(replaced.title).toBe('첫 편지');
  expect(replaced.content).toContain('도윤은 오래된 약속을 떠올렸다.');
  expect(replaced.originalFilename).toBe('수정 원고.hwpx');
  const episodes = await data(await request.get(`${api}/episodes`, { headers }));
  expect(episodes).toHaveLength(5);
  // 업로드/편집 검증에서 유료 AI 분석을 시작하지 않는다.
  expect(episodes.every((episode: { analysisStatus: string }) => episode.analysisStatus !== 'IN_PROGRESS')).toBeTruthy();
});
