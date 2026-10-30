import { useState } from 'react';
import type { FormEvent } from 'react';
import type { SettingCandidateResponse } from '../../../api/generated/types.gen';
import { automaticApplicationPendingMessage } from '../../../lib/setting-review-progress';
import { AutomaticApplicationNotice } from '../AutomaticApplicationNotice';
import { OrderedReviewImpactNotice } from '../OrderedReviewImpactNotice';
import { C } from '../constants';
import { useCharacterSettingLabels } from '../character/CharacterSettingLabelProvider';
import type { CharacterFactApplicationMode } from '../character/character-fact-comparison-policy';
import { REVIEW_TEXT } from '../review-v2-colors';
import { ReviewChoiceCards } from '../review-ui/ReviewPrimitives';
import { modalInputStyle, settingTypeLabels, splitDynamicSettingName, toSettingDisplay, validateCandidateDisplayValue } from './characterReviewFormat';
import { ActionButton, ModalLayer } from './ReviewModalControls';

export function CandidateEditModal({
  candidate,
  pending,
  automaticPending = false,
  readOnly = false,
  error,
  onClose,
  onSubmit,
}: {
  candidate: SettingCandidateResponse;
  pending: boolean;
  automaticPending?: boolean;
  readOnly?: boolean;
  error: string | null;
  onClose: () => void;
  onSubmit: (attributeName: string, attributeValue: string | null, reviewedApplicationMode?: CharacterFactApplicationMode) => void;
}) {
  const labels = useCharacterSettingLabels();
  const originalName = candidate.attributeName?.trim() ?? '';
  const editableName = candidate.attributeNameEditable === true
    && Boolean(candidate.attributeNamePrefix);
  const dynamicName = splitDynamicSettingName(originalName, candidate.attributeNamePrefix);
  const [attributeSuffix, setAttributeSuffix] = useState(dynamicName.suffix);
  const [attributeValue, setAttributeValue] = useState(candidate.attributeValue ?? '');
  const supportsManualDecision = candidate.manualReviewAvailable
    && candidate.matchStatus !== 'AMBIGUOUS' && Boolean(candidate.entityName && candidate.entityName !== '미상');
  const bookRemoval = candidate.source?.sourceKind === 'SETTING_BOOK' && candidate.suggestedOperation === 'REMOVE';
  const [reviewMode, setReviewMode] = useState<CharacterFactApplicationMode | null>(
    bookRemoval && candidate.reviewedApplicationMode !== 'HISTORY_ONLY' ? null : candidate.reviewedApplicationMode ?? null);
  const [validationError, setValidationError] = useState<string | null>(null);
  const valueFormatError = validateCandidateDisplayValue(candidate.valueType, attributeValue);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (pending || automaticPending || readOnly || supportsManualDecision && !reviewMode) return;
    const nextName = editableName ? `${dynamicName.prefix}${attributeSuffix.trim()}` : originalName;
    if (!nextName) {
      setValidationError('설정명 정보가 없어 수정할 수 없습니다.');
      return;
    }
    if (editableName && !attributeSuffix.trim()) {
      setValidationError('설정명 뒷부분을 입력해 주세요.');
      return;
    }
    if (valueFormatError) {
      setValidationError(valueFormatError);
      return;
    }
    setValidationError(null);
    onSubmit(nextName, attributeValue.trim() || null, supportsManualDecision ? reviewMode ?? undefined : undefined);
  };

  return (
    <ModalLayer
      title={candidate.manualReviewAvailable ? '설정 직접 확인' : '설정 후보 수정'}
      description={candidate.manualReviewAvailable
        ? '원문과 설정값을 직접 확인해 주세요. 확인한 값을 저장한 뒤 이 캐릭터의 설정을 함께 확정할 수 있습니다.'
        : '설정명이나 값을 바꾸면 화면에 표시하지 않는 AI 세부 속성은 정리되며, 최초 원문 근거는 유지됩니다.'}
      pending={pending}
      onClose={onClose}
    >
      <form className="review-modal__form" onSubmit={submit} noValidate>
        {readOnly && <p role="status">이전 분석 기록은 수정할 수 없습니다. 입력한 내용은 유지됩니다.</p>}
        {automaticPending && <AutomaticApplicationNotice source={candidate.source} />}
        {!automaticPending && candidate.manualReviewAvailable && <OrderedReviewImpactNotice />}
        <div style={{ marginTop: 22 }}>
          <label htmlFor="candidate-attribute-name" style={{ color: REVIEW_TEXT.text, fontSize: 12 }}>
            설정명
          </label>
          {!editableName ? (
            <>
              <input
                id="candidate-attribute-name"
                value={toSettingDisplay(originalName, candidate.attributeDisplayName, labels).nameLabel}
                readOnly
                aria-describedby="candidate-attribute-name-help"
                style={{ ...modalInputStyle, marginTop: 7, color: REVIEW_TEXT.muted }}
              />
              <div id="candidate-attribute-name-help" style={{ color: REVIEW_TEXT.muted, fontSize: 11, marginTop: 6 }}>
                이 설정명은 변경할 수 없습니다.
              </div>
            </>
          ) : (
            <div style={{ display: 'flex', marginTop: 7 }}>
              <span style={{
                minHeight: 40, padding: '0 11px', borderRadius: '7px 0 0 7px',
                border: `1px solid ${C.border}`, borderRight: 'none', background: C.bg,
                color: REVIEW_TEXT.muted, display: 'inline-flex', alignItems: 'center', fontSize: 13,
                flexShrink: 0, whiteSpace: 'nowrap',
              }}>
                {settingTypeLabels(labels)[dynamicName.prefix.slice(0, -1)] ?? '설정'}
              </span>
              <input
                id="candidate-attribute-name"
                aria-label="설정명 뒷부분"
                value={attributeSuffix}
                disabled={pending}
                onChange={event => setAttributeSuffix(event.target.value)}
                style={{
                  ...modalInputStyle,
                  width: 'auto',
                  minWidth: 0,
                  flex: 1,
                  borderRadius: '0 7px 7px 0',
                }}
              />
            </div>
          )}
        </div>
        <div style={{ marginTop: 18 }}>
          <label htmlFor="candidate-attribute-value" style={{ color: REVIEW_TEXT.text, fontSize: 12 }}>
            설정값
          </label>
          <input
            id="candidate-attribute-value"
            value={attributeValue}
            disabled={pending}
            aria-invalid={Boolean(valueFormatError)}
            aria-describedby={valueFormatError ? 'candidate-attribute-value-error' : undefined}
            onChange={event => {
              setAttributeValue(event.target.value);
              setValidationError(null);
            }}
            style={{ ...modalInputStyle, marginTop: 7 }}
          />
        </div>
        {supportsManualDecision && <ReviewChoiceCards label="수정한 내용을 어디에 반영할까요?" value={reviewMode}
          disabled={pending || automaticPending} onChange={mode => setReviewMode(mode as CharacterFactApplicationMode)}
          choices={[
            ...(!bookRemoval ? [{ id: 'APPLY_PROPOSAL', title: '현재 설정에 반영', description: '위의 값으로 현재 설정을 바꿉니다.' }] : []),
            { id: 'HISTORY_ONLY', title: '이력에만 저장', description: candidate.source?.sourceKind === 'SETTING_BOOK' ? '현재 설정은 유지하고 이 설정집의 기록으로 남깁니다.' : '현재 설정은 유지하고 이 회차의 기록으로 남깁니다.' },
          ]} />}
        {(validationError || valueFormatError || error) && (
          <div id="candidate-attribute-value-error" role="alert" style={{
            marginTop: 14, padding: '10px 12px', borderRadius: 7,
            border: `1px solid ${C.danger}55`, background: `${C.danger}12`,
            color: REVIEW_TEXT.danger, fontSize: 12,
          }}>
            {validationError ?? valueFormatError ?? error}
          </div>
        )}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 22 }}>
          <ActionButton disabled={pending} onClick={onClose}>취소</ActionButton>
          <ActionButton type="submit" disabled={pending || automaticPending || readOnly || Boolean(valueFormatError) || Boolean(supportsManualDecision && !reviewMode)}
            disabledTitle={automaticPending ? automaticApplicationPendingMessage(candidate.source) : valueFormatError ?? (supportsManualDecision && !reviewMode ? '반영 방식을 먼저 선택해 주세요.' : undefined)} tone={C.primary}>
            {pending ? '저장 중…' : candidate.manualReviewAvailable ? '확인한 값 저장' : '저장'}
          </ActionButton>
        </div>
      </form>
    </ModalLayer>
  );
}
