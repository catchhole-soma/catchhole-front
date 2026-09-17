import { expect, test, type Page } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import type { SettingCandidateResponse } from '../src/app/api/generated/types.gen';

// 실제 화면/스타일에서 안내 자산을 재생성한다. 개인 원고·계정·실제 API를 사용하지 않는다.
const workId = '11111111-1111-4111-8111-111111111111';
const batchId = '22222222-2222-4222-8222-222222222222';
const characterId = '44444444-4444-4444-8444-444444444444';
const pageOf = (content: unknown[]) => ({ content, page: 0, size: 20, totalElements: content.length, totalPages: content.length ? 1 : 0, hasNext: false });

test('실제 업로드·검토 화면으로 읽기 전용 안내 자산을 캡처한다', async ({ browser }) => {
  test.skip(process.env.CATCHHOLE_CAPTURE_ANALYSIS_GUIDE !== '1', '안내 자산 재생성 시에만 실행합니다.');
  test.setTimeout(120_000);
  await mkdir('src/assets/onboarding', { recursive: true });
  for (const size of ['desktop', 'mobile'] as const) {
    for (const mode of ['automatic', 'manual'] as const) {
      const page = await browser.newPage({ viewport: { width: size === 'desktop' ? 1200 : 390, height: 1000 }, deviceScaleFactor: 1 });
      let completed = false;
      const automatic = mode === 'automatic';
      const candidates = (): SettingCandidateResponse[] => [
        { attributeName: 'profile.species', attributeValue: '엘프', evidenceSpans: [{ quote: '레온은 엘프였다.' }] },
        { attributeName: 'profile.occupation', attributeValue: '정찰병', evidenceSpans: [{ quote: '레온은 왕국의 정찰병으로 일했다.' }] },
        { attributeName: 'skills.치유', attributeValue: '상처를 치유한다.', evidenceSpans: [{ quote: '레온과 유나가 동굴에 들어섰다. 그는 손끝으로 상처를 아물게 했다.' }] },
      ].map((fact, index) => ({
        id: `${index + 3}3333333-3333-4333-8333-333333333333`, workId, episodeNo: 1,
        entityType: 'CHARACTER', entityName: '레온', rawEntityMention: index === 2 ? '그' : '레온',
        matchedCharacterId: index === 2 && !completed ? null : characterId,
        matchStatus: index === 2 && !completed ? 'AMBIGUOUS' : 'MATCHED',
        candidateKind: 'SETTING', valueType: 'STRING', confidence: 0.9,
        analysisMode: automatic ? 'ORDERED_PROVISIONAL' : 'CONFIRMED_ONLY',
        reviewStatus: completed || automatic && index < 2 ? 'CONFIRMED' : 'PENDING_REVIEW',
        comparisonStatus: index === 2 && !completed ? 'FAILED' : 'COMPLETED',
        suggestedOperation: 'ADD', comparisonRevision: 'guide-revision',
        comparisonReason: '원문에서 확인한 새로운 설정입니다.',
        ...(index === 2 && !completed ? { automaticReviewHoldReason: 'SUBJECT_RESOLUTION_FAILED', manualReviewAvailable: true } : {}),
        ...fact,
      }));
      await page.route('**/api/v1/**', route => {
        const url = new URL(route.request().url());
        const path = url.pathname;
        expect(route.request().method(), '캡처가 실제 변경을 요청하면 안 된다').toBe('GET');
        const saved = completed ? 3 : automatic ? 2 : 0;
        const zero = { totalCandidateCount: 0, reviewedCandidateCount: 0, pendingCandidateCount: 0,
          confirmedCandidateCount: 0, dismissedCandidateCount: 0, directReviewCandidateCount: 0, processingCandidateCount: 0 };
        let data: unknown = [];
        if (path.endsWith('/auth/me')) data = { id: 1, displayName: '예시 작가', email: 'guide@example.invalid', role: 'AUTHOR', status: 'ACTIVE' };
        else if (path.endsWith(`/works/${workId}`)) data = { id: workId, title: '은빛숲의 정찰병', genre: '판타지', lifecycleStatus: 'ACTIVE' };
        else if (path.endsWith('/analysis-mode-guide')) data = { shouldShow: false };
        else if (path.endsWith('/episodes/upload-policy')) data = { pendingCharacterCandidateCount: 0, pendingWorldSettingCandidateCount: 0, maxUploadCharacters: 250000 };
        else if (path.endsWith('/setting-candidates')) {
          const visible = candidates().filter(row => !url.searchParams.get('reviewStatus') || url.searchParams.get('reviewStatus')!.includes(row.reviewStatus!));
          const pending = visible.filter(row => row.reviewStatus === 'PENDING_REVIEW').length;
          data = { batchId, episodeStartNo: 1, episodeEndNo: 1, episodeCount: 1, comparisonRevision: 'guide-revision',
            totalCandidateCount: 3, reviewedCandidateCount: saved, pendingCandidateCount: 3 - saved, matchRequiredCandidateCount: completed ? 0 : 1,
            confirmedCandidateCount: saved, dismissedCandidateCount: 0, directReviewCandidateCount: 3 - saved, processingCandidateCount: 0,
            groups: pageOf(visible.length ? [{ groupKey: '레온', entityName: '레온', candidateCount: visible.length,
              pendingCandidateCount: pending, matchedCharacterId: characterId, candidates: visible, evidenceEpisodeNos: [1] }] : []) };
        } else if (path.includes('/setting-candidates/')) data = candidates().find(row => path.endsWith(row.id!));
        else if (path.endsWith('/world-setting-candidates')) data = { batchId, ...zero, groups: pageOf([]) };
        else if (path.endsWith('/characters')) data = pageOf([{ id: characterId, name: '레온' }]);
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data }) });
      });
      await page.addInitScript(() => localStorage.setItem('accessToken', 'guide-capture-fixture'));
      const capture = async (step: number, locator: ReturnType<Page['locator']>) => {
        await page.evaluate(() => document.fonts.ready);
        await locator.screenshot({ path: `src/assets/onboarding/${mode}-${step}-${size}.png`, animations: 'disabled' });
      };
      await page.goto(`/episode-upload?workId=${workId}`);
      await page.getByRole('button', { name: /단일 회차 업로드/ }).click();
      await page.getByRole('radio', { name: automatic ? /AI 판단으로 설정 자동 반영/ : /모든 설정 직접 검토/ }).check();
      await capture(1, page.locator('.episode-analysis-mode'));
      await page.goto(`/setting-review?workId=${workId}&batchId=${batchId}`);
      await expect(page.locator('.setting-review-summary__item.is-direct strong')).toHaveText(`${3 - savedCount()}개`);
      // 모바일의 실제 목록 화면과 데스크톱의 요약·목록·상세를 그대로 캡처한다.
      await capture(2, page.locator('.setting-review-main'));
      if (size === 'mobile') await page.locator('.candidate-group-card').click();
      await expect(page.locator('.setting-review-detail')).toBeVisible();
      await expect(page.locator('.setting-candidate-detail')).toHaveCount(automatic ? 1 : 3);
      // scroll container 밖은 브라우저가 그리지 않으므로 충분한 세로 viewport에서 상세 전체를 촬영한다.
      const detailHeight = await page.locator('.setting-review-detail').evaluate(node => node.scrollHeight);
      await page.setViewportSize({ width: size === 'desktop' ? 1200 : 390, height: detailHeight + 800 });
      await capture(3, page.locator('.setting-review-detail'));
      await page.setViewportSize({ width: size === 'desktop' ? 1200 : 390, height: 1000 });
      completed = true;
      await page.reload();
      await expect(page.getByRole('button', { name: '원고 목록으로', exact: true })).toBeEnabled();
      await capture(4, page.locator('.setting-review-main'));
      await page.close();
      function savedCount() { return completed ? 3 : automatic ? 2 : 0; }
    }
  }
});
