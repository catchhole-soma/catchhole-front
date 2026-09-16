import { useCallback, useEffect, useRef } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  claimMyFeedbackPromptMutation,
  getMyFeedbackPromptOptions,
  getMyFeedbackPromptQueryKey,
} from '../api/generated/@tanstack/react-query.gen';

function canShowPrompt(): boolean {
  return document.visibilityState === 'visible'
    && !document.querySelector('[role="dialog"], [role="alertdialog"], [aria-modal="true"], .user-menu__popover')
    && !document.activeElement?.matches('input, textarea, select, [contenteditable="true"]');
}

/** Server grants the prompt once per account. Only request it while the UI is idle. */
export function useFeedbackPrompt({
  memberId, allowed, onShow,
}: { memberId?: number; allowed: boolean; onShow: () => void }) {
  const queryClient = useQueryClient();
  const attempted = useRef(false);
  const options = getMyFeedbackPromptOptions();
  const scopedKey = { ...getMyFeedbackPromptQueryKey()[0], memberId };
  const queryKey: ReturnType<typeof getMyFeedbackPromptQueryKey> = [scopedKey];
  const prompt = useQuery({
    ...options,
    queryKey,
    enabled: Boolean(memberId) && allowed,
    retry: false,
    refetchOnWindowFocus: false,
  });
  const { mutateAsync: claim } = useMutation({
    ...claimMyFeedbackPromptMutation(),
    retry: false,
  });

  const markFeedbackSubmitted = useCallback(() => {
    attempted.current = true;
    queryClient.setQueryData([{ ...getMyFeedbackPromptOptions().queryKey[0], memberId }], {
      success: true, data: { shouldShow: false },
    });
  }, [memberId, queryClient]);

  useEffect(() => {
    if (!allowed || !memberId || !prompt.isSuccess || !prompt.data.data?.shouldShow || attempted.current) return;
    let active = true;
    const timer = window.setInterval(() => {
      if (!canShowPrompt()) return;
      window.clearInterval(timer);
      attempted.current = true;
      void claim({}).then(response => {
        markFeedbackSubmitted();
        if (active && response.data?.shouldShow && canShowPrompt()) {
          onShow();
        }
      }).catch(() => {
        // A failed or ambiguous claim must never produce repeated popups or block manual feedback.
      });
    }, 1800);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [allowed, memberId, prompt.isSuccess, prompt.data, claim, onShow, markFeedbackSubmitted]);

  return { markFeedbackSubmitted };
}
