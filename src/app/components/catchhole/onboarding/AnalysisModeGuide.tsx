import { useCallback, useEffect, useRef } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'react-router';
import { CircleHelp } from 'lucide-react';
import {
  claimMyAnalysisGuideMutation, getMyAnalysisGuideOptions, getMyAnalysisGuideQueryKey, getMeOptions,
} from '../../../api/generated/@tanstack/react-query.gen';
import { AnalysisModeGuideDialog } from './AnalysisModeGuideDialog';

function safeToOpen() {
  return document.visibilityState === 'visible'
    && !document.querySelector('[role="dialog"], [role="alertdialog"], [aria-modal="true"], .user-menu__popover')
    && !document.activeElement?.matches('input, textarea, select, [contenteditable="true"]');
}

export function AnalysisModeGuide({ multiple, disabled, active }: { multiple: boolean; disabled: boolean; active: boolean }) {
  const [params, setParams] = useSearchParams();
  const client = useQueryClient();
  const member = useQuery({ ...getMeOptions(), staleTime: 60_000 });
  const memberId = member.data?.data?.id;
  const open = params.get('guide') === 'analysis-mode';
  const rawStep = Number(params.get('guideStep') ?? 1);
  const step = Number.isInteger(rawStep) && rawStep >= 1 && rawStep <= 4 ? rawStep - 1 : 0;
  const attempted = useRef(false);
  const scopedKey = { ...getMyAnalysisGuideQueryKey()[0], memberId };
  const queryKey: ReturnType<typeof getMyAnalysisGuideQueryKey> = [scopedKey];
  const prompt = useQuery({
    ...getMyAnalysisGuideOptions(), queryKey,
    enabled: Boolean(memberId) && active && !disabled && !open,
    retry: false, refetchOnWindowFocus: false,
  });
  const { mutateAsync: claim } = useMutation({ ...claimMyAnalysisGuideMutation(), retry: false });
  const rememberAttempt = useCallback(() => {
    client.setQueryData([{ ...getMyAnalysisGuideQueryKey()[0], memberId }], { success: true, data: { shouldShow: false } });
  }, [client, memberId]);
  const show = useCallback((automatic: boolean) => {
    setParams(current => {
      const next = new URLSearchParams(current);
      next.set('guide', 'analysis-mode'); next.set('guideStep', '1');
      if (multiple) next.set('guideVariant', 'multiple'); else next.delete('guideVariant');
      return next;
    }, { replace: automatic, preventScrollReset: true });
  }, [setParams, multiple]);

  useEffect(() => {
    if (!memberId || !active || disabled || open || !prompt.isSuccess || !prompt.data.data?.shouldShow || attempted.current) return;
    let mounted = true;
    const timer = window.setInterval(() => {
      if (!safeToOpen()) return;
      window.clearInterval(timer);
      attempted.current = true;
      void claim({}).then(response => {
        rememberAttempt();
        if (mounted && response.data?.shouldShow && safeToOpen()) show(true);
      }).catch(() => { /* 안내 실패로 업로드를 막거나 자동 재시도하지 않는다. */ });
    }, 400);
    return () => { mounted = false; window.clearInterval(timer); };
  }, [memberId, active, disabled, open, prompt.isSuccess, prompt.data, claim, rememberAttempt, show]);

  // 도움말·직접 링크로 이미 본 사람에게도 자동 안내를 다시 띄우지 않는다.
  useEffect(() => {
    if (!open || !memberId || attempted.current) return;
    attempted.current = true;
    void claim({}).then(rememberAttempt).catch(() => { /* 수동 체험은 안내 기록 실패와 무관하게 사용할 수 있다. */ });
  }, [open, memberId, claim, rememberAttempt]);

  return <>
    {active && <button type="button" className="analysis-mode-guide-trigger" disabled={disabled} onClick={() => show(false)}>
      <CircleHelp size={16} aria-hidden="true" />{multiple ? '자동 반영 과정 체험하기' : '두 방식의 차이 체험하기'}
    </button>}
    {open && <AnalysisModeGuideDialog multiple={params.get('guideVariant') === 'multiple'} step={step} onStepChange={nextStep => {
      setParams(current => { const next = new URLSearchParams(current); next.set('guideStep', String(nextStep + 1)); return next; }, { replace: true, preventScrollReset: true });
    }} onClose={() => {
      setParams(current => { const next = new URLSearchParams(current); next.delete('guide'); next.delete('guideStep'); next.delete('guideVariant'); return next; }, { replace: true, preventScrollReset: true });
    }} />}
  </>;
}
