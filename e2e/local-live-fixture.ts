import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { test as base } from '@playwright/test';

const execute = promisify(execFile);
type LiveAccount = { memberId: number; api: string; email: string; password: string; workId?: string; characterId?: string };
export const test = base.extend<{ liveAccount: LiveAccount }>({
  // Playwright requires an object destructuring parameter even without dependencies.
  // eslint-disable-next-line no-empty-pattern
  liveAccount: [async ({}, use, testInfo) => {
    const api = process.env.CATCHHOLE_E2E_API_BASE_URL;
    const password = process.env.CATCHHOLE_E2E_SEED_PASSWORD;
    base.skip(!api || !password || !process.env.CATCHHOLE_E2E_DATABASE_URL || !process.env.CATCHHOLE_E2E_SEED_EMAIL,
      'localhost API·DB와 전용 seed 계정이 필요합니다. 실행마다 일회용 계정을 만들고 정리합니다.');
    const python = process.env.CATCHHOLE_E2E_PYTHON ?? 'python3';
    const script = 'scripts/local-live-account.py';
    const run = async (args: string[]) => {
      try { return await execute(python, [script, ...args], { timeout: 120_000 }); }
      catch { throw new Error('로컬 fixture 준비·정리에 실패했습니다. 서버와 전용 테스트 DB 설정을 확인해 주세요.'); }
    };
    const created = await run(['create', ...(testInfo.file.endsWith('character-images-live.spec.ts') ? ['--character'] : [])]);
    const account = JSON.parse(created.stdout) as LiveAccount;
    try { await use({ ...account, api: api!, password: password! }); }
    finally { await run(['cleanup', '--member-id', String(account.memberId), '--email', account.email]); }
  }, { timeout: 150_000 }],
});
