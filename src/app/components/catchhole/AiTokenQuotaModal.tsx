import { type FormEvent, useEffect, useId, useRef, useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { useMutation, useQuery } from '@tanstack/react-query';
import {
  AlertTriangle,
  CheckCircle2,
  Clock3,
  LoaderCircle,
  Mail,
  X,
} from 'lucide-react';
import {
  createMyAiTokenExtensionRequestMutation,
  getMyAiTokenUsageOptions,
  getMyPendingAiTokenExtensionRequestOptions,
} from '../../api/generated/@tanstack/react-query.gen';
import type {
  AiTokenExtensionCreateRequest,
  AiTokenExtensionRequestResponse,
} from '../../api/generated/types.gen';
import { NetworkError, toApiError } from '../../lib/api-errors';
import {
  subscribeAiTokenQuotaExhausted,
  type AiTokenQuotaNotice,
} from '../../lib/ai-token-quota';

const MIN_FEEDBACK_LENGTH = 35;
const MAX_FEEDBACK_LENGTH = 1000;

const CONTEXT_BY_NOTICE: Record<
  AiTokenQuotaNotice['kind'],
  AiTokenExtensionCreateRequest['context']
> = {
  'request-blocked': 'REQUEST_BLOCKED',
  'analysis-failed': 'ANALYSIS_FAILED',
  'analysis-interrupted': 'ANALYSIS_INTERRUPTED',
};

function countCharacters(value: string): number {
  return Array.from(value).length;
}

function toSubmissionError(error: unknown): string {
  if (error instanceof NetworkError) {
    return '서버에 연결할 수 없습니다. 연결 상태를 확인한 뒤 다시 시도해 주세요.';
  }

  const apiError = toApiError(error);
  if (apiError?.code === 'AI_TOKEN_EXTENSION_FEEDBACK_INVALID') {
    return `앞뒤 공백을 제외하고 ${MIN_FEEDBACK_LENGTH}자 이상 ${MAX_FEEDBACK_LENGTH.toLocaleString()}자 이하로 입력해 주세요.`;
  }
  if (apiError?.status === 401) {
    return '로그인 상태를 확인할 수 없습니다. 다시 로그인한 뒤 시도해 주세요.';
  }
  return '요청을 보내지 못했습니다. 입력한 내용은 유지되니 잠시 후 다시 시도해 주세요.';
}

export function AiTokenQuotaModal() {
  const feedbackHintId = useId();
  const feedbackErrorId = useId();
  const submitErrorId = useId();
  const feedbackRef = useRef<HTMLTextAreaElement>(null);
  const [open, setOpen] = useState(false);
  const [notice, setNotice] = useState<AiTokenQuotaNotice>({ kind: 'request-blocked' });
  const [feedback, setFeedback] = useState('');
  const [feedbackError, setFeedbackError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submittedRequest, setSubmittedRequest] = useState<AiTokenExtensionRequestResponse | null>(null);
  const usageQuery = useQuery({
    ...getMyAiTokenUsageOptions(),
    enabled: open,
    retry: false,
    staleTime: 0,
    refetchOnMount: 'always',
  });
  const pendingRequestQuery = useQuery({
    ...getMyPendingAiTokenExtensionRequestOptions(),
    enabled: open,
    retry: false,
    staleTime: 0,
    refetchOnMount: 'always',
  });
  const extensionRequest = useMutation(createMyAiTokenExtensionRequestMutation());
  const resetExtensionRequest = extensionRequest.reset;

  useEffect(() => subscribeAiTokenQuotaExhausted(nextNotice => {
    setNotice(nextNotice);
    setFeedback('');
    setFeedbackError(null);
    setSubmitError(null);
    setSubmittedRequest(null);
    resetExtensionRequest();
    setOpen(true);
  }), [resetExtensionRequest]);

  const normalizedFeedback = feedback.trim();
  const feedbackLength = countCharacters(normalizedFeedback);
  const submitting = extensionRequest.isPending;
  const pendingRequestStatus = pendingRequestQuery.data?.data?.pending;
  const checkingPendingRequest = !submittedRequest
    && (pendingRequestQuery.isPending || pendingRequestQuery.isFetching);
  const pendingRequestCheckSucceeded = !submittedRequest
    && !checkingPendingRequest
    && pendingRequestQuery.isSuccess
    && typeof pendingRequestStatus === 'boolean';
  const pendingRequestCheckFailed = !submittedRequest
    && !checkingPendingRequest
    && !pendingRequestCheckSucceeded;
  const hasPendingRequest = Boolean(submittedRequest)
    || (pendingRequestCheckSucceeded && pendingRequestStatus === true);
  const canShowFeedbackForm = pendingRequestCheckSucceeded && pendingRequestStatus === false;
  const canSubmit = canShowFeedbackForm
    && feedbackLength >= MIN_FEEDBACK_LENGTH
    && feedbackLength <= MAX_FEEDBACK_LENGTH
    && !submitting;

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submitting || hasPendingRequest || !canShowFeedbackForm) return;

    if (feedbackLength < MIN_FEEDBACK_LENGTH) {
      setFeedbackError(`조금 더 구체적으로 ${MIN_FEEDBACK_LENGTH}자 이상 작성해 주세요.`);
      setSubmitError(null);
      feedbackRef.current?.focus();
      return;
    }
    if (feedbackLength > MAX_FEEDBACK_LENGTH) {
      setFeedbackError(`${MAX_FEEDBACK_LENGTH.toLocaleString()}자 이하로 작성해 주세요.`);
      setSubmitError(null);
      feedbackRef.current?.focus();
      return;
    }

    setFeedbackError(null);
    setSubmitError(null);
    try {
      const response = await extensionRequest.mutateAsync({
        body: {
          feedback: normalizedFeedback,
          context: CONTEXT_BY_NOTICE[notice.kind],
        },
      });
      if (!response.data) throw new Error('추가 사용량 요청 응답이 비어 있습니다.');
      setSubmittedRequest(response.data);
      setFeedback('');
    } catch (error) {
      setSubmitError(toSubmissionError(error));
    }
  };

  const interruptedCount = notice.interruptedComparisonCount ?? 0;
  const failedEpisodeCount = notice.failedEpisodeCount ?? 0;
  const totalEpisodeCount = notice.totalEpisodeCount ?? 0;
  const analysisFailed = notice.kind === 'analysis-failed';
  const analysisInterrupted = notice.kind === 'analysis-interrupted';
  const mixedAnalysisInterruption = analysisFailed
    && notice.interruptedComparisonCount !== undefined;
  const title = analysisInterrupted
    ? '설정 비교가 일부 중단되었습니다'
    : analysisFailed
      ? mixedAnalysisInterruption
        ? '회차 분석과 설정 비교가 중단되었습니다'
        : totalEpisodeCount > 1 && failedEpisodeCount >= totalEpisodeCount
          ? '전체 회차 분석이 중단되었습니다'
          : totalEpisodeCount > 1
            ? '일부 회차 분석이 중단되었습니다'
            : '회차 분석이 중단되었습니다'
      : '기본 사용량을 모두 소진했습니다';
  const description = analysisInterrupted
    ? `${interruptedCount > 0 ? `${interruptedCount}개 ` : ''}세계관 설정 비교가 사용량 부족으로 중단됐습니다. 이미 완료된 추출과 비교 결과는 유지되며, 추가 사용량을 받은 뒤 검토 화면에서 남은 비교만 재개할 수 있습니다.`
    : analysisFailed
      ? `${failedEpisodeCount > 0 ? `${failedEpisodeCount}개 ` : ''}회차 분석이 사용량 부족으로 중단됐습니다. 추가 사용량을 받은 뒤 실패한 회차만 다시 시도해 주세요.${mixedAnalysisInterruption ? ` ${interruptedCount > 0 ? `${interruptedCount}개 ` : '일부 '}세계관 설정 비교도 중단됐지만 완료된 추출과 비교 결과는 유지됩니다. 검토 화면에서 남은 비교만 재개할 수 있습니다.` : ''}`
      : '서비스를 이용해 주셔서 감사합니다. 아래에서 추가 사용량을 바로 요청할 수 있습니다.';
  const contactEmail = usageQuery.data?.data?.contactEmail;

  return (
    <Dialog.Root
      open={open}
      onOpenChange={nextOpen => {
        if (!nextOpen && !submitting) setOpen(false);
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="ai-token-quota-modal__backdrop theme-v2" />
        <Dialog.Content
          className="ai-token-quota-modal theme-v2"
          onOpenAutoFocus={event => {
            if (!canShowFeedbackForm) return;
            event.preventDefault();
            feedbackRef.current?.focus();
          }}
          onEscapeKeyDown={event => {
            if (submitting) event.preventDefault();
          }}
          onInteractOutside={event => {
            if (submitting) event.preventDefault();
          }}
        >
          <div className="ai-token-quota-modal__header">
            <div className="ai-token-quota-modal__icon" aria-hidden="true">
              <AlertTriangle size={20} />
            </div>
            <div className="ai-token-quota-modal__heading">
              <Dialog.Title>{title}</Dialog.Title>
              <Dialog.Description>{description}</Dialog.Description>
            </div>
            <Dialog.Close asChild>
              <button
                type="button"
                className="ai-token-quota-modal__close"
                aria-label="사용량 안내 닫기"
                disabled={submitting}
              >
                <X size={20} />
              </button>
            </Dialog.Close>
          </div>

          <div className="ai-token-quota-modal__body">
            {checkingPendingRequest ? (
              <div className="ai-token-quota-modal__status" aria-live="polite">
                <LoaderCircle className="ai-token-quota-modal__spinner" size={22} aria-hidden="true" />
                <div>
                  <strong>이전 요청을 확인하고 있어요</strong>
                  <p>잠시만 기다려 주세요.</p>
                </div>
              </div>
            ) : pendingRequestCheckFailed ? (
              <div className="ai-token-quota-modal__status" role="alert">
                <AlertTriangle size={22} aria-hidden="true" />
                <div>
                  <strong>이전 요청을 확인하지 못했어요</strong>
                  <p>현재 요청 상태를 확인한 뒤 추가 사용량을 요청할 수 있습니다.</p>
                  <div className="ai-token-quota-modal__actions">
                    <button
                      type="button"
                      className="ai-token-quota-modal__secondary"
                      onClick={() => void pendingRequestQuery.refetch()}
                    >
                      다시 시도
                    </button>
                  </div>
                </div>
              </div>
            ) : hasPendingRequest ? (
              <div className="ai-token-quota-modal__status" aria-live="polite">
                {submittedRequest ? (
                  <CheckCircle2 size={22} aria-hidden="true" />
                ) : (
                  <Clock3 size={22} aria-hidden="true" />
                )}
                <div>
                  <strong>추가 사용량 요청을 확인하고 있어요</strong>
                  <p>
                    운영팀이 피드백을 확인한 뒤 승인하면 최초 제공량과 같은 사용량이 추가됩니다.
                    처리 전에는 요청을 한 번만 보낼 수 있습니다.
                  </p>
                </div>
              </div>
            ) : canShowFeedbackForm ? (
              <form className="ai-token-quota-modal__form" onSubmit={handleSubmit} noValidate>
                <div className="ai-token-quota-modal__field-header">
                  <label htmlFor="ai-token-extension-feedback">피드백과 사용 계획</label>
                  <span className={feedbackLength > MAX_FEEDBACK_LENGTH ? 'is-invalid' : undefined}>
                    {feedbackLength.toLocaleString()} / {MAX_FEEDBACK_LENGTH.toLocaleString()}자
                  </span>
                </div>
                <textarea
                  ref={feedbackRef}
                  id="ai-token-extension-feedback"
                  rows={6}
                  value={feedback}
                  placeholder="어떤 작업을 이어서 하고 싶은지, 사용하면서 불편했던 점이나 기대한 결과를 구체적으로 적어 주세요."
                  aria-invalid={Boolean(feedbackError)}
                  aria-describedby={`${feedbackHintId}${feedbackError ? ` ${feedbackErrorId}` : ''}`}
                  disabled={submitting}
                  onChange={event => {
                    setFeedback(event.target.value);
                    setFeedbackError(null);
                    setSubmitError(null);
                  }}
                />
                <p className="ai-token-quota-modal__hint" id={feedbackHintId}>
                  앞뒤 공백을 제외하고 최소 {MIN_FEEDBACK_LENGTH}자 이상 작성해 주세요.
                  원고 내용이나 민감한 정보는 입력하지 않아도 됩니다.
                </p>
                {feedbackError && (
                  <p className="ai-token-quota-modal__field-error" id={feedbackErrorId} role="alert">
                    {feedbackError}
                  </p>
                )}
                {submitError && (
                  <p className="ai-token-quota-modal__submit-error" id={submitErrorId} role="alert">
                    {submitError}
                  </p>
                )}

                <div className="ai-token-quota-modal__actions">
                  <Dialog.Close asChild>
                    <button type="button" className="ai-token-quota-modal__secondary" disabled={submitting}>
                      취소
                    </button>
                  </Dialog.Close>
                  <button
                    type="submit"
                    className="ai-token-quota-modal__primary"
                    disabled={!canSubmit}
                    aria-busy={submitting}
                    aria-describedby={submitError ? submitErrorId : undefined}
                  >
                    {submitting ? (
                      <>
                        <LoaderCircle className="ai-token-quota-modal__spinner" size={17} aria-hidden="true" />
                        제출 중...
                      </>
                    ) : '제출'}
                  </button>
                </div>
              </form>
            ) : null}

            <div className="ai-token-quota-modal__contact-row">
              <Mail size={16} aria-hidden="true" />
              {usageQuery.isPending ? (
                <span>문의 이메일을 확인하고 있습니다...</span>
              ) : usageQuery.isError ? (
                <button type="button" onClick={() => void usageQuery.refetch()}>
                  문의 정보를 불러오지 못했습니다. 다시 시도
                </button>
              ) : contactEmail ? (
                <span>
                  이메일로 직접 문의하려면{' '}
                  <a className="ai-token-quota-modal__contact" href={`mailto:${contactEmail}`}>
                    {contactEmail}
                  </a>
                </span>
              ) : (
                <span>문의 이메일은 서비스 공지를 확인해 주세요.</span>
              )}
            </div>
          </div>

          {hasPendingRequest && (
            <div className="ai-token-quota-modal__footer">
              <Dialog.Close asChild>
                <button type="button" className="ai-token-quota-modal__primary">
                  확인
                </button>
              </Dialog.Close>
            </div>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
