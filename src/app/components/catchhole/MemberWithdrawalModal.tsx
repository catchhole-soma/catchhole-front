import { type FormEvent, type RefObject, useId, useRef, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import * as Dialog from '@radix-ui/react-dialog';
import { AlertTriangle, X } from 'lucide-react';
import { withdrawMeMutation } from '../../api/generated/@tanstack/react-query.gen';
import { NetworkError, toApiError } from '../../lib/api-errors';

const CONFIRMATION_PHRASE = '회원 탈퇴';
const PASSWORD_MAX_LENGTH = 64;

type WithdrawalFieldErrors = {
  confirmation?: string;
  currentPassword?: string;
};

type MemberWithdrawalModalProps = {
  onAccepted: () => void;
  onClose: () => void;
  returnFocusRef: RefObject<HTMLButtonElement>;
};

function toWithdrawalErrors(error: unknown): {
  fieldErrors?: WithdrawalFieldErrors;
  formError?: string;
} {
  if (error instanceof NetworkError) {
    return { formError: '서버에 연결할 수 없습니다. 연결 상태를 확인한 뒤 다시 시도해 주세요.' };
  }

  const apiError = toApiError(error);
  if (!apiError) {
    return { formError: '회원 탈퇴를 요청하지 못했습니다. 잠시 후 다시 시도해 주세요.' };
  }

  if (apiError.code === 'MEMBER_WITHDRAWAL_PASSWORD_MISMATCH') {
    return { fieldErrors: { currentPassword: '현재 비밀번호가 일치하지 않습니다.' } };
  }

  const fieldErrors = apiError.details.reduce<WithdrawalFieldErrors>((errors, detail) => {
    if (detail.field.endsWith('currentPassword')) errors.currentPassword = detail.message;
    if (detail.field.endsWith('confirmation')) errors.confirmation = detail.message;
    return errors;
  }, {});
  if (fieldErrors.currentPassword || fieldErrors.confirmation) return { fieldErrors };

  if (apiError.status === 401) {
    return { formError: '로그인 상태를 확인할 수 없습니다. 다시 로그인한 뒤 시도해 주세요.' };
  }

  return { formError: '회원 탈퇴를 요청하지 못했습니다. 잠시 후 다시 시도해 주세요.' };
}

export function MemberWithdrawalModal({
  onAccepted,
  onClose,
  returnFocusRef,
}: MemberWithdrawalModalProps) {
  const titleId = useId();
  const descriptionId = useId();
  const warningId = useId();
  const passwordErrorId = useId();
  const confirmationHintId = useId();
  const confirmationErrorId = useId();
  const formErrorId = useId();
  const passwordInputRef = useRef<HTMLInputElement>(null);
  const confirmationInputRef = useRef<HTMLInputElement>(null);
  const withdrawalRequest = useMutation(withdrawMeMutation());
  const [currentPassword, setCurrentPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [fieldErrors, setFieldErrors] = useState<WithdrawalFieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);

  const canSubmit = currentPassword.trim().length > 0
    && currentPassword.length <= PASSWORD_MAX_LENGTH
    && confirmation === CONFIRMATION_PHRASE;
  const isPending = withdrawalRequest.isPending;

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isPending) return;

    const clientErrors: WithdrawalFieldErrors = {};
    if (!currentPassword.trim()) clientErrors.currentPassword = '현재 비밀번호를 입력해 주세요.';
    else if (currentPassword.length > PASSWORD_MAX_LENGTH) {
      clientErrors.currentPassword = `현재 비밀번호는 ${PASSWORD_MAX_LENGTH}자 이하로 입력해 주세요.`;
    }
    if (confirmation !== CONFIRMATION_PHRASE) {
      clientErrors.confirmation = `‘${CONFIRMATION_PHRASE}’를 정확히 입력해 주세요.`;
    }

    if (clientErrors.currentPassword || clientErrors.confirmation) {
      setFieldErrors(clientErrors);
      setFormError(null);
      if (clientErrors.currentPassword) passwordInputRef.current?.focus();
      else confirmationInputRef.current?.focus();
      return;
    }

    setFieldErrors({});
    setFormError(null);
    try {
      await withdrawalRequest.mutateAsync({
        body: { currentPassword, confirmation },
      });
      onAccepted();
    } catch (error) {
      const nextErrors = toWithdrawalErrors(error);
      setFieldErrors(nextErrors.fieldErrors ?? {});
      setFormError(nextErrors.formError ?? null);
      if (nextErrors.fieldErrors?.currentPassword) passwordInputRef.current?.focus();
      else if (nextErrors.fieldErrors?.confirmation) confirmationInputRef.current?.focus();
    }
  };

  return (
    <Dialog.Root
      open
      onOpenChange={open => {
        if (!open && !isPending) onClose();
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="member-withdrawal-modal__backdrop" />
        <Dialog.Content
          className="member-withdrawal-modal theme-v2"
          aria-labelledby={titleId}
          aria-describedby={`${descriptionId} ${warningId}`}
          onOpenAutoFocus={event => {
            event.preventDefault();
            passwordInputRef.current?.focus();
          }}
          onCloseAutoFocus={event => {
            event.preventDefault();
            returnFocusRef.current?.focus();
          }}
          onEscapeKeyDown={event => {
            if (isPending) event.preventDefault();
          }}
          onInteractOutside={event => {
            if (isPending) event.preventDefault();
          }}
        >
          <div className="member-withdrawal-modal__header">
            <div>
              <Dialog.Title id={titleId}>회원 탈퇴</Dialog.Title>
              <Dialog.Description id={descriptionId}>
                계정과 등록한 작품·회차·설정의 삭제를 요청합니다.
              </Dialog.Description>
            </div>
            <Dialog.Close asChild>
              <button
                type="button"
                className="member-withdrawal-modal__close"
                aria-label="회원 탈퇴 창 닫기"
                disabled={isPending}
              >
                <X size={20} />
              </button>
            </Dialog.Close>
          </div>

          <div className="member-withdrawal-modal__warning" id={warningId}>
            <AlertTriangle size={18} aria-hidden="true" />
            <p>
              탈퇴가 접수되면 즉시 로그아웃되며 계정과 세션을 사용할 수 없습니다.
              삭제된 데이터는 복구할 수 없습니다.
            </p>
          </div>

          <form className="member-withdrawal-modal__form" onSubmit={handleSubmit} noValidate>
            <div className="member-withdrawal-modal__field">
              <label htmlFor="member-withdrawal-password">현재 비밀번호</label>
              <input
                ref={passwordInputRef}
                id="member-withdrawal-password"
                type="password"
                value={currentPassword}
                maxLength={PASSWORD_MAX_LENGTH}
                autoComplete="current-password"
                aria-invalid={Boolean(fieldErrors.currentPassword)}
                aria-describedby={fieldErrors.currentPassword ? passwordErrorId : undefined}
                disabled={isPending}
                onChange={event => {
                  setCurrentPassword(event.target.value);
                  setFieldErrors(errors => ({ ...errors, currentPassword: undefined }));
                  setFormError(null);
                }}
              />
              {fieldErrors.currentPassword && (
                <p className="member-withdrawal-modal__field-error" id={passwordErrorId} role="alert">
                  {fieldErrors.currentPassword}
                </p>
              )}
            </div>

            <div className="member-withdrawal-modal__field">
              <label htmlFor="member-withdrawal-confirmation">확인 문구</label>
              <input
                ref={confirmationInputRef}
                id="member-withdrawal-confirmation"
                type="text"
                value={confirmation}
                autoComplete="off"
                spellCheck={false}
                aria-invalid={Boolean(fieldErrors.confirmation)}
                aria-describedby={`${confirmationHintId}${fieldErrors.confirmation ? ` ${confirmationErrorId}` : ''}`}
                disabled={isPending}
                onChange={event => {
                  setConfirmation(event.target.value);
                  setFieldErrors(errors => ({ ...errors, confirmation: undefined }));
                  setFormError(null);
                }}
              />
              <p className="member-withdrawal-modal__hint" id={confirmationHintId}>
                계속하려면 <strong>{CONFIRMATION_PHRASE}</strong>를 정확히 입력해 주세요.
              </p>
              {fieldErrors.confirmation && (
                <p className="member-withdrawal-modal__field-error" id={confirmationErrorId} role="alert">
                  {fieldErrors.confirmation}
                </p>
              )}
            </div>

            {formError && (
              <p className="member-withdrawal-modal__form-error" id={formErrorId} role="alert">
                {formError}
              </p>
            )}

            <div className="member-withdrawal-modal__actions">
              <Dialog.Close asChild>
                <button type="button" className="member-withdrawal-modal__cancel" disabled={isPending}>
                  취소
                </button>
              </Dialog.Close>
              <button
                type="submit"
                className="member-withdrawal-modal__confirm"
                disabled={!canSubmit || isPending}
                aria-busy={isPending}
                aria-describedby={formError ? formErrorId : undefined}
              >
                {isPending ? '탈퇴 처리 중...' : '회원 탈퇴'}
              </button>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
