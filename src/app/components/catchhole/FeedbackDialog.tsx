import { type FormEvent, useId, useRef, useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { useMutation } from '@tanstack/react-query';
import {
  CheckCircle2,
  LoaderCircle,
  MessageSquareText,
  X,
} from 'lucide-react';
import { createMyFeedbackMutation } from '../../api/generated/@tanstack/react-query.gen';
import type { FeedbackCreateResponse } from '../../api/generated/types.gen';
import { NetworkError, toApiError } from '../../lib/api-errors';

const MIN_FEEDBACK_LENGTH = 35;
const MAX_FEEDBACK_LENGTH = 1000;

function countCharacters(value: string): number {
  return Array.from(value).length;
}

function toSubmissionError(error: unknown): string {
  if (error instanceof NetworkError) {
    return '서버에 연결할 수 없습니다. 연결 상태를 확인한 뒤 다시 시도해 주세요.';
  }

  const apiError = toApiError(error);
  if (apiError?.code === 'FEEDBACK_CONTENT_INVALID') {
    return `앞뒤 공백을 제외하고 ${MIN_FEEDBACK_LENGTH}자 이상 ${MAX_FEEDBACK_LENGTH.toLocaleString()}자 이하로 입력해 주세요.`;
  }
  if (apiError?.status === 401) {
    return '로그인 상태를 확인할 수 없습니다. 다시 로그인한 뒤 시도해 주세요.';
  }
  return '의견을 보내지 못했습니다. 입력한 내용은 유지되니 잠시 후 다시 시도해 주세요.';
}

function getResultCopy(result: FeedbackCreateResponse): { title: string; description: string } {
  switch (result.rewardRequestOutcome) {
    case 'CREATED':
      return {
        title: '의견과 추가 사용량 요청을 함께 접수했어요',
        description: '운영팀이 의견을 확인한 뒤 요청을 처리합니다. 사용량은 승인될 때 추가됩니다.',
      };
    case 'ALREADY_REQUESTED':
      return {
        title: '의견이 접수됐어요',
        description: '추가 사용량 요청은 이전 의견으로 이미 등록되어 있어요. 새 의견은 계속 보내실 수 있습니다.',
      };
    case 'PENDING_REQUEST_EXISTS':
      return {
        title: '의견이 접수됐어요',
        description: '이미 처리 중인 추가 사용량 요청이 있어 이번에는 새 보상 요청을 만들지 않았어요.',
      };
    default:
      return {
        title: '의견이 접수됐어요',
        description: '보내주신 내용은 서비스 개선에 활용하겠습니다.',
      };
  }
}

export function FeedbackDialog() {
  const feedbackHintId = useId();
  const feedbackErrorId = useId();
  const submitErrorId = useId();
  const feedbackRef = useRef<HTMLTextAreaElement>(null);
  const [open, setOpen] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [feedbackError, setFeedbackError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submittedResult, setSubmittedResult] = useState<FeedbackCreateResponse | null>(null);
  const feedbackRequest = useMutation(createMyFeedbackMutation());

  const normalizedFeedback = feedback.trim();
  const feedbackLength = countCharacters(normalizedFeedback);
  const submitting = feedbackRequest.isPending;
  const canSubmit = feedbackLength >= MIN_FEEDBACK_LENGTH
    && feedbackLength <= MAX_FEEDBACK_LENGTH
    && !submitting;
  const resultCopy = submittedResult ? getResultCopy(submittedResult) : null;

  const resetDialog = () => {
    setFeedback('');
    setFeedbackError(null);
    setSubmitError(null);
    setSubmittedResult(null);
    feedbackRequest.reset();
  };

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen && submitting) return;
    setOpen(nextOpen);
    if (!nextOpen) resetDialog();
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submitting || submittedResult) return;

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
      const response = await feedbackRequest.mutateAsync({
        body: {
          content: normalizedFeedback,
          pagePath: window.location.pathname,
        },
      });
      if (!response.data) throw new Error('의견 등록 응답이 비어 있습니다.');
      setSubmittedResult(response.data);
      setFeedback('');
    } catch (error) {
      setSubmitError(toSubmissionError(error));
    }
  };

  return (
    <Dialog.Root open={open} onOpenChange={handleOpenChange}>
      <Dialog.Trigger asChild>
        <button type="button" className="user-menu__feedback-trigger" aria-label="의견 보내기">
          <MessageSquareText size={17} aria-hidden="true" />
          <span className="user-menu__feedback-label">의견 보내기</span>
        </button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="feedback-dialog__backdrop theme-v2" />
        <Dialog.Content
          className="feedback-dialog theme-v2"
          onOpenAutoFocus={event => {
            if (submittedResult) return;
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
          <div className="feedback-dialog__header">
            <div className="feedback-dialog__icon" aria-hidden="true">
              {submittedResult ? <CheckCircle2 size={20} /> : <MessageSquareText size={20} />}
            </div>
            <div className="feedback-dialog__heading">
              <Dialog.Title>{resultCopy?.title ?? '서비스 의견 보내기'}</Dialog.Title>
              <Dialog.Description>
                {resultCopy?.description
                  ?? '사용하면서 불편했던 점이나 필요했던 기능을 알려주시면 감사하겠습니다. 의견은 언제든 보내실 수 있습니다.'}
              </Dialog.Description>
            </div>
            <Dialog.Close asChild>
              <button
                type="button"
                className="feedback-dialog__close"
                aria-label="의견 보내기 닫기"
                disabled={submitting}
              >
                <X size={20} />
              </button>
            </Dialog.Close>
          </div>

          {submittedResult ? (
            <div className="feedback-dialog__result">
              <p>소중한 의견을 보내주셔서 감사합니다. 서비스 개선을 위해 꼼꼼히 확인하겠습니다.</p>
              <Dialog.Close asChild>
                <button type="button" className="feedback-dialog__primary">확인</button>
              </Dialog.Close>
            </div>
          ) : (
            <form className="feedback-dialog__form" onSubmit={handleSubmit} noValidate>
              <div className="feedback-dialog__reward-note">
                첫 일반 피드백에는 추가 사용량 요청이 함께 등록됩니다. 보상 요청은 계정당 한 번만 만들고, 의견은 계속 보내실 수 있어요.
              </div>
              <div className="feedback-dialog__field-header">
                <label htmlFor="general-feedback-content">의견 내용</label>
                <span className={feedbackLength > MAX_FEEDBACK_LENGTH ? 'is-invalid' : undefined}>
                  {feedbackLength.toLocaleString()} / {MAX_FEEDBACK_LENGTH.toLocaleString()}자
                </span>
              </div>
              <textarea
                ref={feedbackRef}
                id="general-feedback-content"
                rows={6}
                value={feedback}
                placeholder="어느 화면에서 무엇이 불편했는지, 어떤 기능이 더 필요했는지 구체적으로 적어 주세요."
                aria-invalid={Boolean(feedbackError)}
                aria-describedby={`${feedbackHintId}${feedbackError ? ` ${feedbackErrorId}` : ''}`}
                disabled={submitting}
                onChange={event => {
                  setFeedback(event.target.value);
                  setFeedbackError(null);
                  setSubmitError(null);
                }}
              />
              <p className="feedback-dialog__hint" id={feedbackHintId}>
                앞뒤 공백을 제외하고 최소 {MIN_FEEDBACK_LENGTH}자 이상 작성해 주세요.
                원고 내용이나 민감한 정보는 입력하지 않아도 됩니다.
              </p>
              {feedbackError && (
                <p className="feedback-dialog__field-error" id={feedbackErrorId} role="alert">
                  {feedbackError}
                </p>
              )}
              {submitError && (
                <p className="feedback-dialog__submit-error" id={submitErrorId} role="alert">
                  {submitError}
                </p>
              )}
              <div className="feedback-dialog__actions">
                <Dialog.Close asChild>
                  <button type="button" className="feedback-dialog__secondary" disabled={submitting}>
                    취소
                  </button>
                </Dialog.Close>
                <button
                  type="submit"
                  className="feedback-dialog__primary"
                  disabled={!canSubmit}
                  aria-busy={submitting}
                  aria-describedby={submitError ? submitErrorId : undefined}
                >
                  {submitting ? (
                    <>
                      <LoaderCircle className="feedback-dialog__spinner" size={17} aria-hidden="true" />
                      보내는 중...
                    </>
                  ) : '의견 보내기'}
                </button>
              </div>
            </form>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
