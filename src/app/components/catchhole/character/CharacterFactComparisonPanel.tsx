import { AlertCircle, Check, History, Loader2, RefreshCw, Sparkles } from 'lucide-react';
import type { ReactNode } from 'react';
import type { SettingCandidateResponse } from '../../../api/generated/types.gen';
import { C } from '../constants';
import {
  getCharacterFactComparisonPolicy,
  type CharacterFactApplicationMode,
} from './character-fact-comparison-policy';
import './character-evidence.css';

type CharacterFactComparisonStatus = NonNullable<SettingCandidateResponse['comparisonStatus']>;
type CharacterFactOperation = NonNullable<SettingCandidateResponse['suggestedOperation']>;
interface Props {
  candidate: SettingCandidateResponse;
  applicationMode: CharacterFactApplicationMode;
  disabled?: boolean;
  retrying?: boolean;
  retryError?: string | null;
  onApplicationModeChange: (mode: CharacterFactApplicationMode) => void;
  onRetry?: () => void;
}

const STATUS_META: Record<CharacterFactComparisonStatus, { label: string; color: string }> = {
  NOT_REQUIRED: { label: '비교 불필요', color: C.t3 },
  WAITING_FOR_CHARACTER_MATCH: { label: '캐릭터 연결 대기', color: C.warning },
  PENDING: { label: '비교 대기', color: C.t3 },
  PROCESSING: { label: '비교 중', color: C.primary },
  COMPLETED: { label: '비교 완료', color: C.success },
  FAILED: { label: '비교 실패', color: C.danger },
  RECOMPARISON_REQUIRED: { label: '재비교 필요', color: C.warning },
};

const OPERATION_META: Record<CharacterFactOperation, { label: string; color: string }> = {
  ADD: { label: '현재 설정 추가', color: C.success },
  UPDATE: { label: '현재 설정 수정', color: C.warning },
  MERGE: { label: '현재 설정 병합', color: C.primary },
  HISTORY_ONLY: { label: '이력만 저장', color: C.t3 },
  EXCLUDE: { label: '반영하지 않음', color: C.danger },
  REVIEW_REQUIRED: { label: '사용자 검토 필요', color: C.warning },
};

const TEMPORAL_SCOPE_LABELS: Record<NonNullable<SettingCandidateResponse['temporalScope']>, string> = {
  PRESENT: '현재 사실',
  PAST: '과거 사실',
  HYPOTHETICAL: '가정·추측',
  UNKNOWN: '시점 불명확',
};

function formatStructuredValue(value: unknown): string | null {
  if (value == null) return null;
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (
    typeof value === 'object'
    && !Array.isArray(value)
    && Object.keys(value).length === 1
    && 'value' in value
  ) {
    return formatStructuredValue(value.value);
  }
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function preferredFactValue(
  factValue: string | null | undefined,
  structuredValue: unknown,
): string | null {
  // 사용자용 표시값은 Backend가 확정한 문자열을 우선하고 JSON은 구응답 호환에만 사용한다.
  return factValue ?? formatStructuredValue(structuredValue);
}

function DecisionButton({
  active,
  disabled,
  title,
  description,
  icon,
  onClick,
}: {
  active: boolean;
  disabled: boolean;
  title: string;
  description: string;
  icon: ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      disabled={disabled}
      onClick={onClick}
      style={{
        minHeight: 58,
        padding: '9px 11px',
        borderRadius: 8,
        border: `1px solid ${active ? C.primary : C.border}`,
        background: active ? C.primary + '16' : C.bg,
        color: disabled ? C.t3 : C.t1,
        cursor: disabled ? 'not-allowed' : 'pointer',
        textAlign: 'left',
        display: 'flex',
        gap: 8,
        alignItems: 'center',
        fontFamily: 'inherit',
        opacity: disabled ? 0.62 : 1,
      }}
    >
      <span style={{ color: active ? C.primary : C.t3, lineHeight: 0 }}>{icon}</span>
      <span>
        <strong style={{ display: 'block', fontSize: 11, marginBottom: 3 }}>{title}</strong>
        <span style={{ color: C.t3, fontSize: 10, lineHeight: 1.45 }}>{description}</span>
      </span>
    </button>
  );
}

export function CharacterFactComparisonPanel({
  candidate,
  applicationMode,
  disabled = false,
  retrying = false,
  retryError,
  onApplicationModeChange,
  onRetry,
}: Props) {
  const comparisonStatus = candidate.comparisonStatus ?? 'NOT_REQUIRED';
  const statusMeta = STATUS_META[comparisonStatus];
  const operation = candidate.suggestedOperation ?? null;
  const operationMeta = operation ? OPERATION_META[operation] : null;
  const active = comparisonStatus === 'PENDING' || comparisonStatus === 'PROCESSING';
  const policy = getCharacterFactComparisonPolicy(candidate);
  const retryAvailable = policy.retryAvailable;
  const completed = comparisonStatus === 'COMPLETED';
  const pendingReview = candidate.reviewStatus == null || candidate.reviewStatus === 'PENDING_REVIEW';
  const snapshotChanges = candidate.snapshotChanges ?? [];
  const primaryUpsert = snapshotChanges.find(change => (
    change.action === 'UPSERT'
    && (!candidate.comparisonTargetFactKey || change.factKey === candidate.comparisonTargetFactKey)
  )) ?? snapshotChanges.find(change => change.action === 'UPSERT');
  const beforeValue = preferredFactValue(primaryUpsert?.beforeFactValue, primaryUpsert?.beforeValueJson);
  const proposedValue = preferredFactValue(
    primaryUpsert?.proposedFactValue ?? candidate.proposedFactValue,
    primaryUpsert?.proposedValueJson ?? candidate.proposedValueJson,
  );
  const additionalChanges = snapshotChanges.filter(change => change !== primaryUpsert);

  return (
    <section
      aria-label="캐릭터 설정 AI 비교 결과"
      style={{
        marginTop: 10,
        padding: '12px 13px',
        borderRadius: 7,
        border: `1px solid ${statusMeta.color}55`,
        background: statusMeta.color + '0E',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <Sparkles size={15} color={C.primary} />
        <strong style={{ color: C.t1, fontSize: 13 }}>
          {comparisonStatus === 'WAITING_FOR_CHARACTER_MATCH' && candidate.matchStatus === 'UNRESOLVED'
            ? '신규 캐릭터 설정 반영 안내'
            : 'AI 현재 설정 비교'}
        </strong>
        <span style={{
          padding: '3px 8px',
          borderRadius: 10,
          border: `1px solid ${statusMeta.color}`,
          color: statusMeta.color,
          fontSize: 10,
          fontWeight: 700,
          display: 'inline-flex',
          alignItems: 'center',
          gap: 5,
        }}>
          {active && <Loader2 size={10} className="spin" />}
          {statusMeta.label}
        </span>
        {operationMeta && (
          <span style={{ color: operationMeta.color, fontSize: 11, fontWeight: 700 }}>
            {operationMeta.label}
          </span>
        )}
        {candidate.temporalScope && (
          <span style={{ color: C.t3, fontSize: 11 }}>
            {TEMPORAL_SCOPE_LABELS[candidate.temporalScope]}
          </span>
        )}
      </div>

      {active && (
        <div role="status" style={{ color: C.t2, fontSize: 12, lineHeight: 1.65, marginTop: 12 }}>
          현재 캐릭터 설정과 비교하고 있습니다. 비교가 끝나기 전에는 후보를 확정할 수 없습니다.
        </div>
      )}

      {comparisonStatus === 'WAITING_FOR_CHARACTER_MATCH' && (
        <div role="status" style={{ color: C.t2, fontSize: 12, lineHeight: 1.65, marginTop: 12 }}>
          {candidate.matchStatus === 'UNRESOLVED'
            ? '새 캐릭터로 확정하면 이 설정을 현재값으로 바로 반영합니다. 같은 이름의 기존 캐릭터가 확인되면 현재 설정 비교 후 다시 확정하게 됩니다.'
            : '비교할 캐릭터를 먼저 연결해 주세요. 연결이 완료되면 현재 설정 비교를 시작합니다.'}
        </div>
      )}

      {comparisonStatus === 'NOT_REQUIRED' && (
        <div role="status" style={{ color: C.t2, fontSize: 12, lineHeight: 1.65, marginTop: 12 }}>
          현재 설정에 적용할 비교 제안이 준비되지 않았습니다. 후보를 확정하지 않고 상태를 확인해 주세요.
        </div>
      )}

      {retryAvailable && (
        <div style={{ marginTop: 12 }}>
          <div role="alert" style={{ color: comparisonStatus === 'FAILED' ? C.danger : C.warning, fontSize: 12, lineHeight: 1.65 }}>
            {comparisonStatus === 'FAILED'
              ? '현재 설정과 비교 결과를 만들지 못했습니다. 다시 비교하거나 설정을 수정해 주세요.'
              : comparisonStatus === 'NOT_REQUIRED'
                ? '이전 분석 후보라 현재 설정 비교가 아직 없습니다. 비교를 시작한 뒤 확정해 주세요.'
                : '후보 또는 현재 설정이 바뀌어 다시 비교해야 합니다.'}
          </div>
          {onRetry && (
            <button
              type="button"
              disabled={disabled || retrying}
              onClick={onRetry}
              style={{
                height: 32,
                marginTop: 10,
                padding: '0 12px',
                borderRadius: 6,
                border: `1px solid ${C.primary}`,
                background: 'transparent',
                color: C.primary,
                fontFamily: 'inherit',
                fontSize: 11,
                fontWeight: 700,
                cursor: disabled || retrying ? 'not-allowed' : 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              <RefreshCw size={12} className={retrying ? 'spin' : undefined} />
              {retrying
                ? comparisonStatus === 'NOT_REQUIRED' ? '비교 요청 중…' : '재비교 요청 중…'
                : comparisonStatus === 'NOT_REQUIRED' ? '현재 설정 비교 시작' : '다시 비교'}
            </button>
          )}
          {retryError && (
            <div role="alert" style={{ color: C.danger, fontSize: 11, marginTop: 8 }}>{retryError}</div>
          )}
        </div>
      )}

      {completed && operation === 'EXCLUDE' && (
        <div role="status" style={{ color: C.t2, fontSize: 12, lineHeight: 1.65, marginTop: 12, display: 'flex', gap: 7 }}>
          <AlertCircle size={15} color={C.danger} style={{ flexShrink: 0, marginTop: 2 }} />
          새 설정이나 이력에는 저장하지 않는 제안입니다. 아래의 ‘모두 확정’을 누르면 이 항목은 자동으로 제외 처리됩니다.
        </div>
      )}

      {completed && operation !== 'EXCLUDE' && (beforeValue != null || proposedValue != null) && (
        <div className="character-comparison-values" style={{
          display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: 8,
          marginTop: 10,
        }}>
          <div style={{ padding: '10px 12px', borderRadius: 7, border: `1px solid ${C.danger}33`, background: `${C.danger}0A` }}>
            <div style={{ color: C.danger, fontSize: 10, fontWeight: 750, marginBottom: 5 }}>− 기존값</div>
            <div style={{ color: C.t2, fontSize: 12, lineHeight: 1.55, overflowWrap: 'anywhere' }}>
              {beforeValue ?? '없음'}
            </div>
          </div>
          <div style={{ padding: '10px 12px', borderRadius: 7, border: `1px solid ${C.success}66`, background: `${C.success}12`, boxShadow: `inset 3px 0 0 ${C.success}` }}>
            <div style={{ color: C.success, fontSize: 10, fontWeight: 800, marginBottom: 5 }}>+ 제안값</div>
            <div style={{ color: C.t1, fontSize: 12, fontWeight: 700, lineHeight: 1.55, overflowWrap: 'anywhere' }}>
              {proposedValue ?? '값 없음'}
            </div>
          </div>
          {beforeValue != null && proposedValue != null && (
            <span style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0, 0, 0, 0)' }}>
              {beforeValue} → {proposedValue}
            </span>
          )}
        </div>
      )}

      {completed && additionalChanges.length > 0 && (
        <div style={{ marginTop: 13 }}>
          <div style={{ color: C.t3, fontSize: 10, marginBottom: 7 }}>함께 적용할 현재 설정 변경</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {additionalChanges.map((change, index) => (
              <div
                key={`${change.action}-${change.factType ?? ''}-${change.factKey ?? ''}-${index}`}
                style={{
                  padding: '9px 11px',
                  borderRadius: 6,
                  border: `1px solid ${change.action === 'REMOVE' ? C.danger + '66' : C.success + '66'}`,
                  background: C.bg,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  color: C.t2,
                  fontSize: 11,
                  flexWrap: 'wrap',
                }}
              >
                <span style={{ color: change.action === 'REMOVE' ? C.danger : C.success, fontWeight: 700 }}>
                  {change.action === 'REMOVE' ? '현재값에서 종료' : '현재값 반영'}
                </span>
                <span>{change.factKey || change.factType || '설정'}</span>
                <span style={{ marginLeft: 'auto', color: C.t3, overflowWrap: 'anywhere' }}>
                  {change.action === 'REMOVE'
                    ? preferredFactValue(change.beforeFactValue, change.beforeValueJson)
                    : [
                        preferredFactValue(change.beforeFactValue, change.beforeValueJson),
                        preferredFactValue(change.proposedFactValue, change.proposedValueJson),
                      ].filter(Boolean).join(' → ')}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {completed && candidate.comparisonReason && (
        <div style={{ marginTop: 13, color: C.t2, fontSize: 12, lineHeight: 1.65 }}>
          <strong style={{ color: C.primary, fontSize: 10, display: 'block', marginBottom: 4 }}>AI 판단 근거</strong>
          {candidate.comparisonReason}
        </div>
      )}

      {completed && pendingReview && operation !== 'EXCLUDE' && (
        <div style={{ marginTop: 15 }}>
          <div style={{ color: C.t3, fontSize: 10, marginBottom: 7 }}>확정 방식</div>
          <div className="character-comparison-decisions" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 8 }}>
            <DecisionButton
              active={applicationMode === 'APPLY_PROPOSAL'}
              disabled={disabled || !policy.canApplyProposal}
              title="AI 제안대로 현재 설정 반영"
              description="새 이력을 저장하고, 제안된 현재 설정 변경도 함께 반영합니다."
              icon={<Check size={15} />}
              onClick={() => onApplicationModeChange('APPLY_PROPOSAL')}
            />
            <DecisionButton
              active={applicationMode === 'HISTORY_ONLY'}
              disabled={disabled || !policy.canSaveHistory}
              title="이력에만 저장"
              description="타임라인 이력은 남기되 캐릭터의 현재 설정은 바꾸지 않습니다."
              icon={<History size={15} />}
              onClick={() => onApplicationModeChange('HISTORY_ONLY')}
            />
          </div>
          {operation === 'REVIEW_REQUIRED' && (
            <div style={{ color: C.warning, fontSize: 11, lineHeight: 1.55, marginTop: 8 }}>
              AI가 현재 설정 변경을 안전하게 결정하지 못했습니다. 이력에만 저장하거나 후보를 수정한 뒤 다시 비교해 주세요.
            </div>
          )}
        </div>
      )}
    </section>
  );
}
