import { execFileSync } from 'node:child_process';
import { readFileSync, statSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import { purgeWorkAndWait } from './live-work-purge';

const fixturePath = process.env.GH221_BROWSER_RUNTIME;
const python = process.env.GH221_TEST_PYTHON;

// Explicit local fixture opt-in; no shared account, application .env, or default DB.
test.skip(!fixturePath || !python, 'GH221의 전용 로컬 Backend·DB fixture와 Python runtime이 필요합니다.');
test.use({ trace: 'off', video: 'off', screenshot: 'off' });

interface RuntimeFixture { apiBaseUrl: string; email: string; password: string; databaseUrl: string }
interface Book { id: string; revisionId: string; revisionNo: number; contentHash: string;
  latestAnalysisJob: { id: string; source: { sourceKind: string; revisionId: string } } }
interface DatabaseState { book: [string, boolean, string] | null; revisions: Array<[string, number, string]>;
  jobs: Array<[string, string, string, string | null, string, string, string]> }

const databaseReader = `
import json, sys, uuid
from pathlib import Path
from urllib.parse import urlparse
import psycopg
try:
    runtime = json.loads(Path(sys.argv[1]).read_text())
    uri = runtime['databaseUrl']
    parsed = urlparse(uri)
    assert parsed.hostname in ('localhost', '127.0.0.1', '::1') and parsed.path == '/gh180_ai_test'
    book_id = uuid.UUID(sys.argv[2])
    with psycopg.connect(uri) as conn:
        conn.execute('SET TRANSACTION READ ONLY')
        book = conn.execute('SELECT f.current_setting_book_revision_id, f.archived_at IS NOT NULL, b.work_id FROM upload_files f JOIN upload_batches b ON b.id=f.batch_id WHERE f.id=%s', (book_id,)).fetchone()
        revisions = conn.execute('SELECT id,revision_no,content_hash FROM setting_book_revisions WHERE setting_book_id=%s ORDER BY revision_no', (book_id,)).fetchall()
        jobs = conn.execute("SELECT id,source_setting_book_revision_id,source_kind,episode_id,status,analysis_mode,review_mode FROM analysis_jobs WHERE source_setting_book_id=%s AND job_type='SETTING_EXTRACTION' ORDER BY created_at,id", (book_id,)).fetchall()
        print(json.dumps(dict(book=book,revisions=revisions,jobs=jobs),default=str))
except Exception:
    raise RuntimeError('Explicit disposable database read failed') from None
`;

function readDatabase(bookId: string): DatabaseState {
  try {
    return JSON.parse(execFileSync(python!, ['-c', databaseReader, fixturePath!, bookId],
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })) as DatabaseState;
  } catch {
    throw new Error('전용 로컬 DB 검증에 실패했습니다.');
  }
}

test('실제 로그인·갱신 쿠키와 설정집 저장/분석 분리, 불변 원문·보관·작품 정리를 검증한다', async ({ page, context, baseURL }) => {
  test.setTimeout(90_000);
  const runtime = JSON.parse(readFileSync(fixturePath!, 'utf8')) as RuntimeFixture;
  const api = new URL(runtime.apiBaseUrl);
  const db = new URL(runtime.databaseUrl);
  expect(['localhost', '127.0.0.1']).toContain(api.hostname);
  expect(api.port).toBe('18081');
  expect(['localhost', '127.0.0.1', '[::1]']).toContain(db.hostname);
  expect(db.pathname).toBe('/gh180_ai_test');
  expect(statSync(fixturePath!).mode & 0o777).toBe(0o600);
  expect(baseURL).toBe('http://localhost:3100');
  const apiBase = 'http://localhost:18081';
  let workId: string | undefined;
  let bookId: string | undefined;
  let purged = false;
  let primaryError: unknown;
  let cleanupError: unknown;
  const mutations: string[] = [];
  page.on('request', request => {
    if (request.method() !== 'GET' && request.url().includes('/setting-books')) {
      mutations.push(`${request.method()} ${new URL(request.url()).pathname}`);
    }
  });
  try {
    await page.goto('/login');
    await page.getByPlaceholder('이메일', { exact: true }).fill(runtime.email);
    await page.getByPlaceholder('비밀번호', { exact: true }).fill(runtime.password);
    await page.getByRole('button', { name: '로그인', exact: true }).click();
    await expect(page).toHaveURL(/\/works$/);
    expect(Boolean((await context.cookies()).find(cookie => cookie.name === 'refreshToken' && cookie.httpOnly))).toBe(true);
    let refreshRequests = 0;
    page.on('request', request => { if (new URL(request.url()).pathname === '/api/v1/auth/refresh') refreshRequests += 1; });
    await page.evaluate(() => localStorage.setItem('accessToken', 'expired-synthetic-token'));
    const refreshed = page.waitForResponse(response => new URL(response.url()).pathname === '/api/v1/auth/refresh' && response.status() === 200);
    await page.reload();
    await refreshed;
    await expect(page).toHaveURL(/\/works$/);
    expect(refreshRequests).toBe(1);
    expect(await page.evaluate(() => Boolean(localStorage.getItem('accessToken')) && localStorage.getItem('accessToken') !== 'expired-synthetic-token')).toBe(true);
    const token = await page.evaluate(() => localStorage.getItem('accessToken'));
    const created = await page.request.post(`${apiBase}/api/v1/works`, { headers: { Authorization: `Bearer ${token}` },
      data: { title: `설정집 로컬 검증 ${Date.now()}`, genre: '판타지', description: 'GH221 전용 합성 테스트 작품' } });
    workId = (await created.json()).data.id as string;
    expect(created.status()).toBe(200);
    await page.goto(`/dashboard?workId=${workId}&nav=settingDB&tab=worldrules`);
    await expect(page.getByTestId('setting-book-workspace')).toBeVisible();
    await page.getByTestId('open-empty-setting-book-upload').click();
    const original = '😀 수아는 북부의 기사다.\n북부의 겨울은 길다.\n';
    await page.getByTestId('setting-book-file-input').setInputFiles({ name: '로컬 인물과 세계.txt', mimeType: 'text/plain', buffer: Buffer.from(original) });
    const upload = page.waitForResponse(response => response.request().method() === 'POST'
      && new URL(response.url()).pathname === `/api/v1/works/${workId}/setting-books`);
    await page.getByTestId('setting-book-upload-submit').click();
    const uploaded = (await (await upload).json()).data as Book;
    bookId = uploaded.id;
    await expect(page.getByTestId('setting-book-analysis-status')).toContainText('분석 대기');
    await expect(page.getByTestId('setting-book-source')).toContainText(original.trim());
    let state = readDatabase(bookId);
    expect(state.book?.[2]).toBe(workId);
    expect(state.revisions).toHaveLength(1);
    expect(state.jobs).toHaveLength(1);
    expect(state.jobs[0].slice(2)).toEqual(['SETTING_BOOK', null, 'PENDING', 'ORDERED_PROVISIONAL', 'AUTOMATIC']);
    expect(state.jobs[0][1]).toBe(uploaded.revisionId);
    expect(mutations.filter(path => path.endsWith('/analysis-jobs'))).toHaveLength(0);
    await page.reload();
    await expect(page).toHaveURL(new RegExp(`settingBookFileId=${bookId}`));
    await expect(page.getByTestId('setting-book-analysis-status')).toContainText('분석 대기');

    await page.getByRole('button', { name: '수정', exact: true }).click();
    await page.getByTestId('setting-book-editor').fill('수아는 북부의 기사다.\n겨울에는 성문을 지킨다.\n');
    await expect(page.getByTestId('setting-book-analyze')).toBeDisabled();
    const save = page.waitForResponse(response => response.request().method() === 'PATCH'
      && new URL(response.url()).pathname === `/api/v1/works/${workId}/setting-books/${bookId}`);
    await page.getByTestId('setting-book-save').click();
    const saved = (await (await save).json()).data as Book;
    expect(saved.revisionId === uploaded.revisionId).toBe(false);
    state = readDatabase(bookId);
    expect(state.revisions).toHaveLength(2);
    expect(state.book?.[0]).toBe(saved.revisionId);
    expect(state.jobs).toHaveLength(1);
    expect(mutations.filter(path => path.endsWith('/analysis-jobs'))).toHaveLength(0);
    await expect(page.getByTestId('setting-book-analyze')).toBeEnabled();
    await page.getByRole('button', { name: '수정', exact: true }).click();
    const sameSave = page.waitForResponse(response => response.request().method() === 'PATCH');
    await page.getByTestId('setting-book-save').click();
    expect((await (await sameSave).json()).data.revisionId).toBe(saved.revisionId);
    expect(readDatabase(bookId).revisions).toHaveLength(2);
    const analyze = page.waitForResponse(response => response.request().method() === 'POST'
      && new URL(response.url()).pathname.endsWith(`/setting-books/${bookId}/analysis-jobs`));
    await page.getByTestId('setting-book-analyze').click();
    const analyzed = (await (await analyze).json()).data;
    expect(analyzed.source.sourceKind).toBe('SETTING_BOOK');
    expect(analyzed.source.revisionId).toBe(saved.revisionId);
    state = readDatabase(bookId);
    expect(state.jobs).toHaveLength(2);
    expect(state.jobs.find(row => row[0] === analyzed.id)?.[1]).toBe(saved.revisionId);
    expect(mutations.filter(path => path.endsWith('/analysis-jobs'))).toHaveLength(1);
    await page.getByRole('button', { name: '분석 진행 보기' }).click();
    await expect(page).toHaveURL(new RegExp(`sourceAnalysisJobId=${analyzed.id}`));
    await page.reload();
    await expect(page.getByTestId('setting-book-analysis-status')).toContainText('로컬 인물과 세계.txt');
    await page.getByRole('button', { name: '설정집으로 돌아가기' }).click();
    await page.getByRole('button', { name: '삭제', exact: true }).click();
    await page.getByRole('dialog', { name: '이 설정집을 삭제할까요?' }).getByRole('button', { name: '삭제', exact: true }).click();
    await expect(page.locator('[data-testid^="setting-book-row-"]')).toHaveCount(0);
    expect(readDatabase(bookId).book?.[1]).toBe(true);
    await page.goto(`/editor?workId=${workId}&settingBookId=${bookId}&revisionId=${uploaded.revisionId}`);
    await expect(page.locator('.original-lines')).toContainText('😀 수아는 북부의 기사다.');
    await expect(page.locator('.original-lines')).toContainText('북부의 겨울은 길다.');
    await expect(page.locator('.original-lines')).not.toContainText('겨울에는 성문을 지킨다.');
    await test.info().attach('local-book-database-proof', { body: JSON.stringify({ uploadJobs: 1, afterSaveJobs: 1,
      afterAnalyzeJobs: state.jobs.length, revisionCount: state.revisions.length, sourceKind: 'SETTING_BOOK',
      episodeId: null, frozenReaderAfterArchive: true, refreshRequests }), contentType: 'application/json' });
    const finalToken = await page.evaluate(() => localStorage.getItem('accessToken'));
    await purgeWorkAndWait(page.request, apiBase, `Bearer ${finalToken}`, workId);
    purged = true;
    expect(readDatabase(bookId)).toEqual({ book: null, revisions: [], jobs: [] });
  } catch (error) {
    primaryError = error;
  } finally {
    if (workId && !purged) {
      const token = await page.evaluate(() => localStorage.getItem('accessToken')).catch(() => null);
      if (token) {
        try {
          await purgeWorkAndWait(page.request, apiBase, `Bearer ${token}`, workId);
        } catch (error) {
          cleanupError = error;
          await test.info().attach('local-cleanup-incomplete', { body: '비동기 삭제 완료 조건을 확인해야 합니다.', contentType: 'text/plain' });
        }
      }
    }
  }
  if (primaryError) throw primaryError;
  if (cleanupError) throw cleanupError;
});
