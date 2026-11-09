import { useEffect, useRef, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { checkAnalysisStartMutation } from '../api/generated/@tanstack/react-query.gen';
import type { AnalysisJobCreateRequest, AnalysisStartCheckResponse } from '../api/generated/types.gen';
import { toApiError } from '../lib/api-errors';

export type AnalysisStartConsent = Pick<AnalysisJobCreateRequest, 'closeAmbiguousCandidates' | 'reviewGateRevision'>;
type GateDialog = { summary: AnalysisStartCheckResponse; changed: boolean; workId: string };

function isGateConflict(error: unknown) {
  return ['ANALYSIS_MANUAL_REVIEW_REQUIRED', 'ANALYSIS_REVIEW_ACKNOWLEDGEMENT_REQUIRED', 'ANALYSIS_REVIEW_GATE_CHANGED', 'ANALYSIS_PREVIOUS_ANALYSIS_IN_PROGRESS']
    .includes(toApiError(error)?.code ?? '');
}

/** 동의는 한 번의 생성 요청에만 전달한다. 실패 재개 API에는 사용하지 않는다. */
export function useAnalysisStartGate(workId: string) {
  const check = useMutation(checkAnalysisStartMutation());
  const [dialog, setDialog] = useState<GateDialog | null>(null);
  const pendingChoice = useRef<((consent: AnalysisStartConsent | null) => void) | null>(null);
  const authorizing = useRef(false);
  const mounted = useRef(false);
  const currentWork = useRef(workId);
  useEffect(() => {
    currentWork.current = workId;
    mounted.current = true;
    return () => {
      mounted.current = false;
      pendingChoice.current?.(null);
      pendingChoice.current = null;
    };
  }, [workId]);

  const choose = (consent: AnalysisStartConsent | null) => {
    pendingChoice.current?.(consent);
    pendingChoice.current = null;
    setDialog(null);
  };

  const authorize = async (episodeNumbers: number[], isActive: () => boolean, changed = false): Promise<AnalysisStartConsent | null> => {
    if (!isActive() || authorizing.current) return null;
    if (!episodeNumbers.length || episodeNumbers.some(value => !Number.isInteger(value) || value < 1)) {
      throw new Error('분석할 회차 범위를 확인하지 못했습니다. 원고 목록을 다시 확인해 주세요.');
    }
    authorizing.current = true;
    try {
      const requestWorkId = workId;
      const response = await check.mutateAsync({ path: { workId }, body: { episodeNumbers } });
      if (!mounted.current || currentWork.current !== requestWorkId || !isActive()) return null;
      const summary = response.data;
      if (!summary || !summary.revision
        || [summary.activeEarlierAnalysisCount, summary.manualReviewCount, summary.ambiguousCharacterCount, summary.ambiguousWorldCount, summary.ambiguousRelationshipCount]
          .some(count => !Number.isSafeInteger(count) || count < 0)) {
        throw new Error('이전 회차의 검토 상태를 확인하지 못했습니다. 잠시 후 다시 시도해 주세요.');
      }
      if (summary.activeEarlierAnalysisCount === 0 && summary.manualReviewCount === 0
        && summary.ambiguousCharacterCount + summary.ambiguousWorldCount + summary.ambiguousRelationshipCount === 0) return {};
      return await new Promise(resolve => {
        pendingChoice.current = resolve;
        setDialog({ summary, changed, workId });
      });
    } finally {
      authorizing.current = false;
    }
  };

  const create = async <T,>({ episodeNumbers, initialConsent, isActive, submit }: {
    episodeNumbers: number[];
    initialConsent?: AnalysisStartConsent;
    isActive: () => boolean;
    submit: (consent: AnalysisStartConsent) => Promise<T>;
  }): Promise<T | null> => {
    const consent = initialConsent ?? await authorize(episodeNumbers, isActive);
    if (!consent) return null;
    // 저장 전에 받은 동의는 이미 보낸 업로드의 후속 요청에 사용한다. 새 동의는 화면을 떠난 뒤 얻지 않는다.
    if (initialConsent === undefined && !isActive()) return null;
    try {
      return await submit(consent);
    } catch (error) {
      if (!isGateConflict(error) || !isActive()) throw error;
      const renewed = await authorize(episodeNumbers, isActive, true);
      if (!renewed || !isActive()) return null;
      // 최신 확인 뒤에도 상태가 바뀌면 오류를 남긴다. 생성 요청을 자동 반복하지 않는다.
      return submit(renewed);
    }
  };

  return {
    authorize, create,
    busy: check.isPending || dialog?.workId === workId,
    dialogProps: dialog?.workId === workId ? {
      ...dialog,
      onCancel: () => choose(null),
      onContinue: () => {
        if (dialog.summary.activeEarlierAnalysisCount === 0 && dialog.summary.manualReviewCount === 0) {
          const hasSettingCandidates = dialog.summary.ambiguousCharacterCount + dialog.summary.ambiguousWorldCount > 0;
          choose(hasSettingCandidates ? {
            closeAmbiguousCandidates: true, reviewGateRevision: dialog.summary.revision,
          } : {});
        }
      },
    } : null,
  };
}
