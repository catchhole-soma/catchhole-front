import { expect, test, type Locator, type Page } from '@playwright/test';

const EDITED_WORLD_VALUE = '수호자의 이름이 지워지면 모든 귀환문이 즉시 닫힌다.';

async function activate(target: Locator, withKeyboard: boolean) {
  await expect(target).toBeVisible();
  await expect(target).toBeEnabled();
  if (withKeyboard) await target.press('Enter');
  else await target.click();
}

async function expectNoHorizontalOverflow(page: Page) {
  await expect.poll(() => page.locator('.interactive-demo-page').evaluate(element => (
    element.scrollWidth <= element.clientWidth + 1
  ))).toBe(true);
}

async function expectGuideCenteredOn(page: Page, target: Locator) {
  const focusBox = page.locator('.interactive-demo-guide-focus-box.is-visible');
  await expect(target).toHaveAttribute('data-demo-focus', 'true');
  await expect(target).toBeFocused();
  await expect(focusBox).toBeVisible();
  await expect.poll(() => target.evaluate(element => {
    const overlay = document.querySelector<HTMLElement>('.interactive-demo-guide-focus-box.is-visible');
    if (!overlay) return false;
    const targetBounds = element.getBoundingClientRect();
    const overlayBounds = overlay.getBoundingClientRect();
    const targetCenterX = (targetBounds.left + targetBounds.right) / 2;
    const targetCenterY = (targetBounds.top + targetBounds.bottom) / 2;
    const overlayCenterX = (overlayBounds.left + overlayBounds.right) / 2;
    const overlayCenterY = (overlayBounds.top + overlayBounds.bottom) / 2;
    return overlay.style.transformOrigin === 'center center'
      && Math.abs(targetCenterX - overlayCenterX) <= 1
      && Math.abs(targetCenterY - overlayCenterY) <= 1
      && overlayBounds.left < targetBounds.left
      && overlayBounds.top < targetBounds.top
      && overlayBounds.right > targetBounds.right
      && overlayBounds.bottom > targetBounds.bottom;
  })).toBe(true);
}

async function expectGuideTracksPageScroll(page: Page, target: Locator) {
  const demoPage = page.locator('.interactive-demo-page');
  await expectGuideCenteredOn(page, target);
  const scrollState = await demoPage.evaluate(element => ({
    maximum: element.scrollHeight - element.clientHeight,
    original: element.scrollTop,
  }));
  expect(scrollState.maximum).toBeGreaterThan(0);
  const movedScrollTop = await demoPage.evaluate((element, { maximum, original }) => {
    element.scrollTop = original < maximum
      ? Math.min(original + 80, maximum)
      : Math.max(original - 80, 0);
    return element.scrollTop;
  }, scrollState);
  expect(movedScrollTop).not.toBe(scrollState.original);
  await expectGuideCenteredOn(page, target);
  await demoPage.evaluate((element, scrollTop) => { element.scrollTop = scrollTop; }, scrollState.original);
  await expectGuideCenteredOn(page, target);
}

async function expectInlineGuideOn(page: Page, target: Locator) {
  await expect(target).toHaveAttribute('data-demo-focus', 'true');
  await expect(target).toHaveClass(/interactive-demo-guided-target--inline/);
  await expect(page.locator('.interactive-demo-guide-focus-box.is-visible')).toHaveCount(0);
  const inlineGuide = await target.evaluate(element => ({
    animationName: getComputedStyle(element).animationName,
    breathingOffsets: document.getAnimations()
      .find(animation => (animation as CSSAnimation).animationName === 'interactive-demo-inline-target-breathe')
      ?.effect?.getKeyframes()
      .map(keyframe => keyframe.outlineOffset) ?? [],
    outlineStyle: getComputedStyle(element).outlineStyle,
    outlineWidth: getComputedStyle(element).outlineWidth,
  }));
  expect(inlineGuide.animationName).toContain('interactive-demo-inline-target-breathe');
  expect(inlineGuide.breathingOffsets).toEqual(['4px', '10px', '4px']);
  expect(inlineGuide.outlineStyle).toBe('solid');
  expect(inlineGuide.outlineWidth).toBe('3px');
}

async function completeDemo(page: Page, options: { keyboard?: boolean; mobile?: boolean } = {}) {
  const { keyboard = false, mobile = false } = options;
  const checkLayout = async () => {
    if (mobile) await expectNoHorizontalOverflow(page);
  };

  await expect(page.getByRole('heading', { name: '가상 원고 확인' })).toBeVisible();
  await expect(page.locator('.interactive-demo-manuscript__body p')).toHaveCount(10);
  await expect(page.getByText('거꾸로숲의 새벽은 늘 땅 아래에서 시작됐다.', { exact: false })).toBeVisible();
  await expect(page.getByText('원정대는 돌아갈 길 대신 숲의 중심부로 방향을 틀었다.', { exact: false })).toBeAttached();
  await expect(page.getByTestId('demo-coachmark')).toContainText('원고 분석을 시작해 보세요');
  const startTarget = page.getByRole('button', { name: 'AI 분석 시작' });
  const focusBox = page.locator('.interactive-demo-guide-focus-box.is-visible');
  await expectGuideCenteredOn(page, startTarget);
  const targetHighlight = await startTarget.evaluate(element => {
    const overlay = document.querySelector<HTMLElement>('.interactive-demo-guide-focus-box.is-visible')!;
    const layer = overlay.parentElement as HTMLElement;
    const visual = getComputedStyle(overlay, '::before');
    return {
      boxShadow: getComputedStyle(element).boxShadow,
      borderRadius: visual.borderTopLeftRadius,
      borderWidth: visual.borderTopWidth,
      entryInsets: document.getAnimations()
        .find(animation => (animation as CSSAnimation).animationName === 'interactive-demo-target-box-enter')
        ?.effect?.getKeyframes()
        .map(keyframe => keyframe.left) ?? [],
      breathingInsets: document.getAnimations()
        .find(animation => (animation as CSSAnimation).animationName === 'interactive-demo-target-box-breathe')
        ?.effect?.getKeyframes()
        .map(keyframe => keyframe.left) ?? [],
      headerBottom: document.querySelector<HTMLElement>('.interactive-demo-header')!.getBoundingClientRect().bottom,
      layerIsPageChild: layer.parentElement === document.querySelector('.interactive-demo-page'),
      layerTop: Number.parseFloat(getComputedStyle(layer).top),
      motion: visual.animationName,
      transform: visual.transform,
    };
  });
  expect(targetHighlight.boxShadow).not.toContain('9999px');
  expect(targetHighlight.borderWidth).toBe('3px');
  expect(targetHighlight.borderRadius).toBe('14px');
  expect(targetHighlight.motion).toContain('interactive-demo-target-box-enter');
  expect(targetHighlight.motion).toContain('interactive-demo-target-box-breathe');
  expect(targetHighlight.entryInsets[0]).toBe('-24px');
  expect(targetHighlight.entryInsets[targetHighlight.entryInsets.length - 1]).toBe('0px');
  expect(targetHighlight.breathingInsets).toEqual(['0px', '-10px', '0px']);
  expect(targetHighlight.transform).toBe('none');
  expect(targetHighlight.layerIsPageChild).toBe(true);
  expect(targetHighlight.layerTop).toBeCloseTo(targetHighlight.headerBottom, 0);
  const stackingOrder = await page.evaluate(() => ({
    header: Number.parseInt(getComputedStyle(document.querySelector('.interactive-demo-header')!).zIndex, 10),
    target: Number.parseInt(getComputedStyle(document.querySelector('[data-demo-focus="true"]')!).zIndex, 10),
  }));
  expect(stackingOrder.header).toBeGreaterThan(stackingOrder.target);
  await checkLayout();

  await activate(startTarget, keyboard);
  await expect(page.getByRole('heading', { name: '회차 업로드' })).toBeVisible();
  await expect(focusBox).toHaveCount(0);
  const reviewButton = page.getByRole('button', { name: '설정 후보 검토' });
  await expect(reviewButton).toBeVisible({ timeout: 6_000 });
  await expectGuideTracksPageScroll(page, reviewButton);
  await expect(page.getByText('설정 후보 생성 완료', { exact: true }).first()).toBeVisible();
  await checkLayout();

  await activate(reviewButton, keyboard);
  await expect(page.getByRole('heading', { name: '캐릭터 후보 확정' })).toBeVisible();
  await expect(page.getByText('재액 운반자', { exact: true }).first()).toBeVisible();
  await expect(page.getByText('추천 문장 사용', { exact: true })).toHaveCount(0);
  await checkLayout();

  const approveCharacterButton = page.getByRole('button', { name: '1개 설정 모두 확정' });
  await expectGuideCenteredOn(page, approveCharacterButton);
  await activate(approveCharacterButton, keyboard);
  await expect(page.getByRole('heading', { name: '세계관 후보 확정' })).toBeVisible();
  await expect(page.getByTestId('demo-coachmark')).toContainText('세계관 설정 후보를 수정하세요');
  await expect(page.getByRole('heading', { name: '귀환문의 조건', exact: true })).toBeVisible();
  const editWorldButton = page.getByRole('button', { name: '수정', exact: true });
  await expectGuideCenteredOn(page, editWorldButton);
  await activate(editWorldButton, keyboard);

  const worldEditor = page.getByRole('textbox', { name: '최종 설정값' });
  await expect(worldEditor).toBeFocused();
  await expectGuideCenteredOn(page, worldEditor);
  await expect(page.getByRole('button', { name: '수정안 적용' })).toBeDisabled();
  await worldEditor.fill(EDITED_WORLD_VALUE);
  await expect(page.getByRole('button', { name: '수정안 적용' })).toBeEnabled();
  await expect(page.getByText('추천 문장 사용', { exact: true })).toHaveCount(0);
  await checkLayout();
  await activate(page.getByRole('button', { name: '수정안 적용' }), keyboard);
  await expect(page.getByText('수정안이 적용되었습니다. 대상 그룹을 확정하면 세계관 설정에 반영됩니다.')).toBeVisible();
  await activate(page.getByRole('button', { name: '모두 확정' }), keyboard);

  await expect(page.getByRole('heading', { name: '징조', exact: true })).toBeVisible();
  await expect(page.getByTestId('demo-coachmark')).toContainText('근거가 부족한 후보는 제외하세요');
  await expect(page.getByText('검은 달은 왕실의 멸망을 예고한다.', { exact: true })).toBeVisible();
  await checkLayout();
  await activate(page.getByRole('button', { name: '제외', exact: true }), keyboard);

  await expect(page.getByRole('heading', { name: '캐릭터 설정', exact: true })).toBeVisible();
  await expect(page.getByTestId('demo-coachmark')).toContainText('캐릭터 설정 DB에 반영됐습니다');
  await expect.poll(() => page.getByRole('button', { name: /캐릭터 상세 보기/ }).count())
    .toBeGreaterThanOrEqual(4);
  await expect(page.getByRole('button', { name: '리아 모렌 캐릭터 상세 보기' })).toBeVisible();
  await expect(page.getByRole('button', { name: '체험 마치기' })).toHaveCount(0);
  await checkLayout();

  await activate(page.getByRole('button', { name: '에단 렌 캐릭터 상세 보기' }), keyboard);
  const characterDetail = page.getByRole('dialog', { name: '에단 렌 캐릭터 상세' });
  await expect(characterDetail).toBeVisible();
  await expect(characterDetail.getByText('재액 운반자', { exact: true })).toBeVisible();
  await expect(page.getByTestId('demo-coachmark')).toContainText('직업 설정의 원문 근거를 열어 보세요');

  await activate(characterDetail.getByRole('button', { name: '역할 원문 근거 보기' }), keyboard);
  await expect(page.getByTestId('demo-coachmark')).toContainText('직업 설정의 원문 근거를 열어 보세요');
  await expect(characterDetail.getByLabel('캐릭터 설정 원문 근거')).toContainText('마나가 없는 몸은 재액을 밀어내지 못했지만');
  await activate(characterDetail.getByRole('button', { name: '원문 근거 닫기' }), keyboard);

  await activate(characterDetail.getByRole('button', { name: '직업 원문 근거 보기' }), keyboard);
  const currentEvidence = characterDetail.getByLabel('캐릭터 설정 원문 근거');
  await expect(currentEvidence).toContainText('전직을 확정합니다. 직업 변경: 짐꾼 → 재액 운반자.');
  await expect(focusBox).toHaveCount(0);
  await checkLayout();
  await activate(currentEvidence.getByRole('button', { name: '원문 근거 닫기' }), keyboard);
  await expect(currentEvidence).toHaveCount(0);

  const timelineButton = characterDetail.getByRole('button', { name: '변화 이력 보기' });
  await expectInlineGuideOn(page, timelineButton);

  await activate(timelineButton, keyboard);
  const characterTimeline = page.getByRole('dialog', { name: '캐릭터 설정 이력' });
  await expect(characterTimeline).toBeVisible();
  await expect(characterTimeline.getByText('변화 이력을 보고 싶은 설정을 선택하세요.')).toBeVisible();
  await expect(page.getByTestId('demo-coachmark')).toContainText('변화 이력을 볼 설정을 선택하세요');

  const occupationTimelineTarget = characterDetail.getByRole('button', { name: '직업 변화 이력 추가' });
  await expectGuideCenteredOn(page, occupationTimelineTarget);
  await expect.poll(() => focusBox.evaluate(element => getComputedStyle(element, '::before').borderTopLeftRadius)).toBe('14px');
  const overlayEscapesClippingAncestor = await occupationTimelineTarget.evaluate(target => {
    const overlay = document.querySelector<HTMLElement>('.interactive-demo-guide-focus-box.is-visible');
    let ancestor = target.parentElement;
    while (ancestor && ancestor !== document.body) {
      const style = getComputedStyle(ancestor);
      if ([style.overflow, style.overflowX, style.overflowY].some(value => value === 'hidden')) {
        return overlay ? !ancestor.contains(overlay) : false;
      }
      ancestor = ancestor.parentElement;
    }
    return false;
  });
  expect(overlayEscapesClippingAncestor).toBe(true);

  await activate(occupationTimelineTarget, keyboard);
  await expect(characterTimeline.getByText('짐꾼', { exact: true })).toBeVisible();
  await expect(characterTimeline.getByText('재액 운반자', { exact: true })).toBeVisible();

  await activate(characterTimeline.getByRole('button', { name: '1화 직업 원문 근거 보기' }), keyboard);
  await expect(characterTimeline.getByLabel('캐릭터 설정 원문 근거')).toContainText('전투직이 아닌 짐꾼');
  await expect(page.getByTestId('demo-coachmark')).toContainText('6화 직업 변화의 원문을 열어 보세요');
  await activate(characterTimeline.getByRole('button', { name: '원문 근거 닫기' }), keyboard);

  await activate(characterTimeline.getByRole('button', { name: '6화 직업 원문 근거 보기' }), keyboard);
  const timelineEvidence = characterTimeline.getByLabel('캐릭터 설정 원문 근거');
  await expect(timelineEvidence).toContainText('전직을 확정합니다. 직업 변경: 짐꾼 → 재액 운반자.');
  await expect(page.getByTestId('demo-coachmark')).toContainText('회차별 변화의 원문까지 연결됩니다');
  await activate(timelineEvidence.getByRole('button', { name: '원문 근거 닫기' }), keyboard);
  await expect(timelineEvidence).toHaveCount(0);
  const closeTimelineButton = characterDetail.getByRole('button', { name: '이력 닫기' });
  await expectInlineGuideOn(page, closeTimelineButton);
  await activate(closeTimelineButton, keyboard);
  await expect(characterTimeline).toHaveCount(0);
  const closeCharacterButton = characterDetail.getByRole('button', { name: '닫기' });
  await expectInlineGuideOn(page, closeCharacterButton);
  await activate(closeCharacterButton, keyboard);

  await activate(page.getByRole('button', { name: '세리아 노크 캐릭터 상세 보기' }), keyboard);
  const secondaryCharacterDetail = page.getByRole('dialog', { name: '세리아 노크 캐릭터 상세' });
  await expect(secondaryCharacterDetail.getByText('백야 진형', { exact: true })).toBeVisible();
  await expect(secondaryCharacterDetail.getByText('은월창', { exact: true })).toBeVisible();
  await expect(page.getByTestId('demo-coachmark')).toContainText('이제 세계관 설정 DB를 확인하세요');
  await activate(secondaryCharacterDetail.getByRole('button', { name: '닫기' }), keyboard);

  await activate(page.getByRole('tab', { name: /세계관 설정/ }), keyboard);
  await expect(page.locator('.world-setting-database__title')).toHaveText('세계관 설정');

  if (mobile) await activate(page.getByRole('button', { name: '대상 목록으로' }), keyboard);
  await activate(page.getByRole('button', { name: '무저갱 관문 세계관 대상 보기' }), keyboard);
  await expect(page.getByText('무저갱 관문', { exact: true }).last()).toBeVisible();
  await expect(page.getByText('서약자의 인장이 있어야 관문이 열린다.', { exact: true })).toBeVisible();
  if (mobile) await activate(page.getByRole('button', { name: '대상 목록으로' }), keyboard);
  await activate(page.getByRole('button', { name: '거꾸로숲 세계관 대상 보기' }), keyboard);
  const worldDetail = page.locator('.world-setting-detail-card');
  await expect(worldDetail.getByText(EDITED_WORLD_VALUE, { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: '체험 마치기' })).toHaveCount(0);

  await activate(worldDetail.getByRole('button', { name: '하늘과 땅의 방향 원문 근거 보기' }), keyboard);
  await expect(page.getByTestId('demo-coachmark')).toContainText('세계관 설정의 원문 근거를 열어 보세요');
  await expect(worldDetail.getByText('직접 입력된 설정 · 연결된 원문 근거 없음')).toBeVisible();
  await activate(worldDetail.getByRole('button', { name: '하늘과 땅의 방향 원문 근거 보기' }), keyboard);

  const guidedWorldEvidenceButton = worldDetail.getByRole('button', { name: '귀환문의 조건 원문 근거 보기' });
  await expectGuideCenteredOn(page, guidedWorldEvidenceButton);
  await activate(guidedWorldEvidenceButton, keyboard);
  await expect(worldDetail.locator('.world-setting-evidence-row')).toContainText('수호자의 이름이 지워지는 순간');
  await expectGuideCenteredOn(page, guidedWorldEvidenceButton);
  const worldEvidenceHighlight = await guidedWorldEvidenceButton.evaluate(() => {
    const overlay = document.querySelector<HTMLElement>('.interactive-demo-guide-focus-box.is-visible')!;
    return {
      borderRadius: getComputedStyle(overlay, '::before').borderTopLeftRadius,
    };
  });
  expect(worldEvidenceHighlight.borderRadius).toBe('14px');
  const finishButton = page.getByRole('button', { name: '체험 마치기' });
  await expect(finishButton).toBeEnabled();
  await checkLayout();

  await activate(finishButton, keyboard);
  await expect(page.getByRole('heading', { name: /한 편의 원고가 작품의 기준이 되었습니다/ })).toBeVisible();
  await expect(focusBox).toHaveCount(0);
  await checkLayout();
}

test('비로그인 사용자는 API 호출 없이 안내 시나리오를 완료하고 회원가입으로 이동한다', async ({ page }) => {
  const dataRequests: string[] = [];
  page.on('request', request => {
    if (request.resourceType() === 'fetch' || request.resourceType() === 'xhr') {
      dataRequests.push(request.url());
    }
  });

  await page.goto('/demo');
  await completeDemo(page, { keyboard: true });

  await expect(page.getByRole('button', { name: '다시 체험하기' })).toBeVisible();
  expect(dataRequests).toEqual([]);

  await page.getByRole('button', { name: '내 작품으로 시작하기' }).click();
  await expect(page).toHaveURL(/\/signup$/);
  await expect(page.getByRole('dialog', { name: '회원가입' })).toBeVisible();
  await page.getByRole('button', { name: '회원가입 닫기' }).click();
  await expect(page).toHaveURL(/\/landing$/);
  await expect(page.locator('#features').getByRole('button', { name: '로그인 없이 체험하기' })).toBeVisible();
  expect(dataRequests).toEqual([
    'http://localhost:8081/api/v1/legal-documents/current?locale=ko-KR',
  ]);
});

test('데모 상태는 저장되지 않으며 새로고침과 재체험으로 처음부터 초기화된다', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/landing');
  await page.locator('#features').getByRole('button', { name: '로그인 없이 체험하기' }).click();
  await expect(page).toHaveURL(/\/demo$/);

  const startButton = page.getByRole('button', { name: 'AI 분석 시작' });
  await expect(startButton).toHaveCSS('animation-name', 'none');
  await startButton.click();
  await expect(page.getByRole('button', { name: '설정 후보 검토' })).toBeVisible({ timeout: 6_000 });
  await page.reload();

  await expect(page.getByRole('heading', { name: '가상 원고 확인' })).toBeVisible();
  await expect(page.getByText('1 / 5', { exact: true })).toBeVisible();
  expect(await page.evaluate(() => ({ local: localStorage.length, session: sessionStorage.length }))).toEqual({ local: 0, session: 0 });
});

test('모바일에서도 전체 흐름이 가로로 넘치지 않고 다시 체험할 수 있다', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/demo');
  await completeDemo(page, { mobile: true });

  await page.getByRole('button', { name: '다시 체험하기' }).click();
  await expect(page.getByRole('heading', { name: '가상 원고 확인' })).toBeVisible();
  await expect(page.getByTestId('demo-coachmark')).toContainText('1 / 5');
  await expectNoHorizontalOverflow(page);
});
