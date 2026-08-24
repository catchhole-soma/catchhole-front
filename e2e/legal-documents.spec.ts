import { expect, test, type Route } from '@playwright/test';

const success = (data: unknown) => ({
  success: true,
  message: '요청을 처리했습니다.',
  data,
  error: null,
});

const failure = (code: string, status: number) => ({
  success: false,
  message: '요청을 처리할 수 없습니다.',
  data: null,
  error: { code, status, details: [] },
});

const respond = (route: Route, body: unknown, status = 200) => route.fulfill({
  status,
  contentType: 'application/json',
  body: JSON.stringify(body),
});

function legalBundle(version = '2026-08-24', termsId = 31, privacyId = 32) {
  return {
    termsOfService: {
      id: termsId,
      documentType: 'TERMS_OF_SERVICE',
      locale: 'ko-KR',
      documentVersion: version,
      title: 'CatchHole 이용약관',
      contentMarkdown: [
        '# CatchHole 이용약관',
        '',
        '## 1. 목적',
        '',
        '이 문서는 실제 API에서 내려온 장문 Markdown 원문입니다.',
        '',
        '| 항목 | 내용 |',
        '| --- | --- |',
        '| 공식 주소 | https://www.catchhole.com |',
        '',
        '[CatchHole 공식 사이트](https://www.catchhole.com)',
      ].join('\n'),
      contentHash: 'a'.repeat(64),
      status: 'PUBLISHED',
      effectiveDate: '2026-08-24',
      publishedAt: '2026-08-24T18:00:00',
    },
    privacyPolicy: {
      id: privacyId,
      documentType: 'PRIVACY_POLICY',
      locale: 'ko-KR',
      documentVersion: version,
      title: 'CatchHole 개인정보처리방침',
      contentMarkdown: [
        '# CatchHole 개인정보처리방침',
        '',
        '## 5. 외부 AI 처리',
        '',
        'OpenAI API 요청에는 `store: false`를 적용합니다.',
        '',
        '## 8. 분석·광고 도구',
        '',
        'GA4와 Meta Pixel 관련 처리 내용은 이 개인정보처리방침에 공개합니다.',
      ].join('\n'),
      contentHash: 'b'.repeat(64),
      status: 'PUBLISHED',
      effectiveDate: '2026-08-24',
      publishedAt: '2026-08-24T18:00:00',
    },
  };
}

test('공개 약관 경로는 Backend의 PUBLISHED Markdown 원문과 버전을 렌더링한다', async ({ page }) => {
  await page.route('**/api/v1/legal-documents/current*', route => (
    respond(route, success(legalBundle()))
  ));

  await page.goto('/terms');
  await expect(page.getByRole('heading', { name: 'CatchHole 이용약관', level: 1 })).toBeVisible();
  await expect(page.getByText('문서 버전 2026-08-24')).toBeVisible();
  await expect(page.getByText('2026년 8월 24일 시행')).toBeVisible();
  await expect(page.getByRole('region', { name: '법률 문서 표' })).toBeVisible();
  const officialSite = page.getByRole('link', { name: 'CatchHole 공식 사이트' });
  await expect(officialSite).toHaveAttribute('target', '_blank');
  await expect(officialSite).toHaveAttribute('rel', /noopener/);

  await page.goto('/privacy');
  await expect(page.getByRole('heading', { name: 'CatchHole 개인정보처리방침', level: 1 })).toBeVisible();
  await expect(page.getByRole('heading', { name: '5. 외부 AI 처리', level: 2 })).toBeVisible();
  await expect(page.getByText('GA4와 Meta Pixel 관련 처리 내용은 이 개인정보처리방침에 공개합니다.')).toBeVisible();
});

test('회원가입 중 문서가 교체되면 동의를 해제하고 최신 문서 ID를 다시 표시한다', async ({ page }) => {
  let stale = false;
  let signupBody: Record<string, unknown> | null = null;

  await page.route('**/api/v1/**', route => {
    const request = route.request();
    const pathname = new URL(request.url()).pathname;
    if (pathname === '/api/v1/legal-documents/current') {
      return respond(route, success(stale
        ? legalBundle('2026-08-24.2', 41, 42)
        : legalBundle('2026-08-24', 31, 32)));
    }
    if (pathname === '/api/v1/auth/phone-verifications') {
      return respond(route, success({
        verificationId: 'legal-version-verification',
        expiresInSeconds: 300,
        resendAfterSeconds: 60,
      }));
    }
    if (pathname.endsWith('/legal-version-verification/confirm')) {
      return respond(route, success({
        phoneVerificationToken: 'legal-version-signup-token',
        expiresInSeconds: 600,
      }));
    }
    if (pathname === '/api/v1/auth/signup') {
      signupBody = request.postDataJSON() as Record<string, unknown>;
      stale = true;
      return respond(route, failure('LEGAL_DOCUMENT_NOT_CURRENT', 409), 409);
    }
    return respond(route, success([]));
  });

  await page.goto('/signup');
  const dialog = page.getByRole('dialog', { name: '회원가입' });
  await page.getByPlaceholder('이름 (필명)').fill('문서 버전 테스트');
  await page.getByPlaceholder('이메일').fill('legal-version@example.com');
  await page.getByPlaceholder('휴대폰 번호 (예: 01012345678)').fill('01012345678');
  await dialog.getByRole('button', { name: '인증번호 받기' }).click();
  await page.getByPlaceholder('인증번호 6자리').fill('123456');
  await dialog.getByRole('button', { name: '인증', exact: true }).click();
  await expect(page.getByText('휴대폰 인증이 완료되었습니다.', { exact: true })).toBeVisible();
  await page.getByPlaceholder('비밀번호', { exact: true }).fill('Password1234');
  await page.getByPlaceholder('비밀번호 확인').fill('Password1234');
  await dialog.getByRole('button', { name: '이용약관 동의 및 개인정보 처리방침 확인' }).click();
  await dialog.getByRole('button', { name: '만 14세 이상 확인' }).click();
  const signupButton = dialog.getByRole('button', { name: '회원가입', exact: true });
  await expect(signupButton).toBeEnabled();
  await signupButton.click();

  await expect(page.getByText('가입 중 법률 문서가 변경되었습니다. 최신 내용을 다시 확인해주세요.')).toBeVisible();
  expect(signupBody).toMatchObject({
    age14OrOlderConfirmed: true,
    privacyPolicyDocumentId: 32,
    termsDocumentId: 31,
  });
  await expect(dialog.getByRole('button', { name: '이용약관 동의 및 개인정보 처리방침 확인' }))
    .toHaveAttribute('aria-pressed', 'false');
  await expect(dialog.getByText('현재 문서 2026-08-24.2')).toBeVisible();
  await expect(signupButton).toBeDisabled();
});
