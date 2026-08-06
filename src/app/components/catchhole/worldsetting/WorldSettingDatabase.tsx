import { useEffect, useMemo, useState } from 'react';
import type { FormEvent, ReactNode } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertCircle,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Database,
  FileText,
  Loader2,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  X,
} from 'lucide-react';
import { useSearchParams } from 'react-router';
import {
  addWorldSettingPropertyMutation,
  createWorldSettingMutation,
  getWorldSettingOptions,
  getWorldSettingQueryKey,
  getWorldSettingsOptions,
  getWorldSettingsQueryKey,
  updateWorldSettingIdentityMutation,
  updateWorldSettingPropertyMutation,
} from '../../../api/generated/@tanstack/react-query.gen';
import type {
  CandidateEvidence,
  PropertyEvidence,
  WorldSettingDetailResponse,
  WorldSettingListItemResponse,
} from '../../../api/generated/types.gen';
import { toApiError } from '../../../lib/api-errors';
import { shouldRetryQuery } from '../../../lib/query-client';
import { C } from '../constants';
import { PageNavigation } from '../PageNavigation';

type WorldCategory = NonNullable<WorldSettingDetailResponse['category']>;
type WorldSort = 'CATEGORY_SUBJECT_ASC' | 'UPDATED_DESC';

const PAGE_SIZE = 20;
const MOBILE_VIEWPORT_QUERY = '(max-width: 900px)';
const CATEGORY_META: Record<WorldCategory, { label: string; description: string; color: string }> = {
  RACE: { label: '종족', description: '공통 신체·문화·기원 특성을 가진 존재 집단', color: '#9B7BFF' },
  FACTION: { label: '세력', description: '국가·조직·종교·길드처럼 영향력을 가진 집단', color: '#4BB8D9' },
  LOCATION: { label: '장소', description: '반복 등장하거나 세계 구조에 영향을 주는 공간', color: '#00C896' },
  MONSTER: { label: '몬스터', description: '지속적인 특성이나 규칙이 있는 몬스터', color: '#E25C5C' },
  POWER_SYSTEM: { label: '마법·능력 체계', description: '마법과 능력의 원리·조건·한계', color: '#B48BFF' },
  WORLD_RULE_HISTORY: { label: '규칙·역사', description: '세계의 법칙·제도·관습·역사', color: '#D4A04A' },
  IMPORTANT_ITEM: { label: '중요 아이템', description: '여러 회차에 영향을 주는 유물·도구', color: '#F4A261' },
};

const CATEGORY_OPTIONS = Object.entries(CATEGORY_META).map(([value, meta]) => ({
  value: value as WorldCategory,
  label: meta.label,
}));

function parsePage(value: string | null): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : 1;
}

function parseCategory(value: string | null): WorldCategory | undefined {
  return value && value in CATEGORY_META ? value as WorldCategory : undefined;
}

function parseSort(value: string | null): WorldSort {
  return value === 'UPDATED_DESC' ? value : 'CATEGORY_SUBJECT_ASC';
}

function errorMessage(error: unknown, fallback: string): string {
  return toApiError(error)?.message ?? (error instanceof Error ? error.message : fallback);
}

function isVersionConflict(error: unknown): boolean {
  return toApiError(error)?.status === 409;
}

function formatUpdatedAt(value?: string): string {
  if (!value) return '수정 시각 없음';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '수정 시각 없음';
  const diff = Date.now() - date.getTime();
  if (diff >= 0 && diff < 60_000) return '방금 수정';
  if (diff >= 0 && diff < 3_600_000) return `${Math.max(1, Math.floor(diff / 60_000))}분 전 수정`;
  if (diff >= 0 && diff < 86_400_000) return `${Math.max(1, Math.floor(diff / 3_600_000))}시간 전 수정`;
  return new Intl.DateTimeFormat('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit' })
    .format(date).replace(/\. /g, '.').replace(/\.$/, '');
}

function Badge({ category }: { category?: WorldCategory }) {
  if (!category) return null;
  const meta = CATEGORY_META[category];
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', minHeight: 23,
      padding: '2px 8px', borderRadius: 11, border: `1px solid ${meta.color}55`,
      background: `${meta.color}18`, color: meta.color, fontSize: 10, fontWeight: 750,
    }}>
      {meta.label}
    </span>
  );
}

function Button({
  children,
  primary = false,
  disabled = false,
  onClick,
  type = 'button',
}: {
  children: ReactNode;
  primary?: boolean;
  disabled?: boolean;
  onClick?: () => void;
  type?: 'button' | 'submit';
}) {
  return (
    <button
      type={type}
      disabled={disabled}
      onClick={onClick}
      style={{
        minHeight: 38, padding: '0 14px', borderRadius: 7,
        border: primary ? 'none' : `1px solid ${C.border}`,
        background: primary ? C.primary : 'transparent',
        color: disabled ? C.t3 : primary ? '#fff' : C.t2,
        fontFamily: 'inherit', fontSize: 12, fontWeight: 700,
        cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.6 : 1,
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
      }}
    >
      {children}
    </button>
  );
}

function PanelState({
  icon,
  title,
  description,
  action,
  minHeight = 300,
}: {
  icon: ReactNode;
  title: string;
  description: string;
  action?: ReactNode;
  minHeight?: number;
}) {
  return (
    <div style={{
      minHeight, borderRadius: 10, border: `1px solid ${C.border}`, background: C.surface,
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      gap: 9, padding: 24, textAlign: 'center',
    }}>
      {icon}
      <strong style={{ color: C.t1, fontSize: 14 }}>{title}</strong>
      <span style={{ color: C.t3, fontSize: 11, lineHeight: 1.6 }}>{description}</span>
      {action}
    </div>
  );
}

function ListItem({
  item,
  selected,
  disabled,
  onClick,
}: {
  item: WorldSettingListItemResponse;
  selected: boolean;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      style={{
        width: '100%', minHeight: 82, padding: '12px 14px', borderRadius: 8,
        border: `1px solid ${selected ? `${C.primary}88` : C.border}`,
        background: selected ? `${C.primary}18` : C.bg,
        textAlign: 'left', fontFamily: 'inherit', cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.65 : 1,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <Badge category={item.category} />
        <strong style={{
          minWidth: 0, flex: 1, color: C.t1, fontSize: 13,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {item.subjectName || '대상명 없음'}
        </strong>
        <ChevronRight size={15} color={selected ? C.primary : C.t3} />
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 9 }}>
        <span style={{ color: C.t3, fontSize: 10 }}>설정 {item.propertyCount ?? 0}개</span>
        <div style={{ flex: 1 }} />
        <span style={{ color: C.t3, fontSize: 10 }}>{formatUpdatedAt(item.updatedAt)}</span>
      </div>
      {(item.matchedSettingName || item.matchedSettingValue) && (
        <div style={{
          marginTop: 8, color: C.t2, fontSize: 10,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {item.matchedSettingName || '일치 설정'} · {item.matchedSettingValue || '값 없음'}
        </div>
      )}
    </button>
  );
}

interface PropertyDraft {
  mode: 'add' | 'edit';
  currentSettingName?: string;
  settingName: string;
  settingValue: string;
  initialSettingName: string;
  initialSettingValue: string;
}

function EvidencePanel({ evidence }: { evidence?: PropertyEvidence }) {
  const history = evidence?.history ?? [];
  if (!evidence?.latestEvidence && history.length === 0) {
    return (
      <div style={{ color: C.t3, fontSize: 11, lineHeight: 1.6 }}>
        직접 입력된 설정 · 연결된 원문 근거 없음
      </div>
    );
  }
  const rows = history.length ? history : evidence?.latestEvidence ? [evidence.latestEvidence] : [];
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {rows.map((item, index) => (
        <EvidenceRow key={`${item.candidateId ?? index}-${item.reviewedAt ?? ''}`} evidence={item} />
      ))}
    </div>
  );
}

function EvidenceRow({ evidence }: { evidence: CandidateEvidence }) {
  const quote = evidenceQuotes(evidence.evidenceSpans)[0];
  return (
    <div style={{
      padding: '9px 11px', borderRadius: 7, border: `1px solid ${C.border}`,
      background: C.bg,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <FileText size={12} color={C.primary} />
        <span style={{ color: C.t2, fontSize: 11 }}>
          {evidence.sourceEpisodeNo == null ? '회차 정보 없음' : `${evidence.sourceEpisodeNo}화`}
        </span>
        <span style={{ color: C.t3, fontSize: 10 }}>{evidence.operation || '확정'}</span>
        <span style={{ color: C.t1, fontSize: 11 }}>{evidence.value || '값 없음'}</span>
        <div style={{ flex: 1 }} />
        <span style={{ color: C.t3, fontSize: 10 }}>{formatUpdatedAt(evidence.reviewedAt ?? undefined)}</span>
      </div>
      {quote && (
        <div style={{
          marginTop: 8, paddingLeft: 10, borderLeft: `2px solid ${C.primary}66`,
          color: C.t2, fontSize: 10, lineHeight: 1.6,
        }}>“{quote}”</div>
      )}
    </div>
  );
}

function evidenceQuotes(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap(item => {
    if (typeof item !== 'object' || item === null) return [];
    const span = item as Record<string, unknown>;
    const quote = span.quote ?? span.text ?? span.sourceText;
    return typeof quote === 'string' && quote.trim() ? [quote.trim()] : [];
  });
}

function PropertyEditor({
  draft,
  pending,
  error,
  conflict,
  onChange,
  onCancel,
  onReload,
  onSave,
}: {
  draft: PropertyDraft;
  pending: boolean;
  error?: string | null;
  conflict: boolean;
  onChange: (next: PropertyDraft) => void;
  onCancel: () => void;
  onReload: () => void;
  onSave: () => void;
}) {
  const inputStyle = {
    width: '100%', height: 38, padding: '0 10px', boxSizing: 'border-box' as const,
    borderRadius: 7, border: `1px solid ${C.border}`, background: C.bg,
    color: C.t1, fontFamily: 'inherit', fontSize: 12, outline: 'none',
  };
  return (
    <div style={{
      padding: 13, borderRadius: 9, border: `1px solid ${C.primary}66`,
      background: `${C.primary}14`,
    }}>
      <div style={{ color: C.primary, fontSize: 11, fontWeight: 750, marginBottom: 10 }}>
        {draft.mode === 'add' ? '새 설정 추가' : '설정 수정'}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(140px, 0.7fr) minmax(220px, 1.7fr)', gap: 10 }}>
        <label style={{ color: C.t3, fontSize: 10 }}>
          설정명
          <input
            value={draft.settingName}
            onChange={event => onChange({ ...draft, settingName: event.target.value })}
            style={{ ...inputStyle, marginTop: 6 }}
          />
        </label>
        <label style={{ color: C.t3, fontSize: 10 }}>
          설정값
          <input
            value={draft.settingValue}
            onChange={event => onChange({ ...draft, settingValue: event.target.value })}
            style={{ ...inputStyle, marginTop: 6 }}
          />
        </label>
      </div>
      {error && (
        <div role="alert" style={{ marginTop: 9, color: C.danger, fontSize: 11, lineHeight: 1.5 }}>
          {error}
          {conflict && (
            <button type="button" onClick={onReload} style={{
              marginLeft: 8, border: 'none', background: 'none', color: C.primary,
              fontFamily: 'inherit', fontSize: 11, fontWeight: 700, cursor: 'pointer',
            }}>
              최신값 다시 불러오기
            </button>
          )}
        </div>
      )}
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 7, marginTop: 10 }}>
        <Button disabled={pending} onClick={onCancel}>취소</Button>
        <Button primary disabled={pending} onClick={onSave}>
          <Check size={12} /> {pending ? '저장 중…' : draft.mode === 'add' ? '추가' : '저장'}
        </Button>
      </div>
    </div>
  );
}

function WorldSettingDetail({
  detail,
  propertyDraft,
  propertyPending,
  propertyError,
  propertyConflict,
  expandedEvidence,
  onEditIdentity,
  onStartAdd,
  onStartEdit,
  onDraftChange,
  onCancelDraft,
  onSaveDraft,
  onReload,
  onToggleEvidence,
}: {
  detail: WorldSettingDetailResponse;
  propertyDraft: PropertyDraft | null;
  propertyPending: boolean;
  propertyError?: string | null;
  propertyConflict: boolean;
  expandedEvidence: string | null;
  onEditIdentity: () => void;
  onStartAdd: () => void;
  onStartEdit: (name: string, value: string) => void;
  onDraftChange: (draft: PropertyDraft) => void;
  onCancelDraft: () => void;
  onSaveDraft: () => void;
  onReload: () => void;
  onToggleEvidence: (name: string) => void;
}) {
  const properties = Object.entries(detail.properties ?? {});
  const evidenceByName = useMemo(() => new Map(
    (detail.propertyEvidence ?? []).map(evidence => [evidence.settingName ?? '', evidence]),
  ), [detail.propertyEvidence]);
  return (
    <div style={{
      minHeight: 540, padding: 20, borderRadius: 10,
      border: `1px solid ${C.border}`, background: C.surface,
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 20 }}>
        <Badge category={detail.category} />
        <div style={{ minWidth: 0, flex: 1 }}>
          <strong style={{ display: 'block', color: C.t1, fontSize: 18, marginBottom: 5 }}>
            {detail.subjectName || '대상명 없음'}
          </strong>
          <span style={{ color: C.t3, fontSize: 10 }}>
            버전 {detail.version ?? 0} · {formatUpdatedAt(detail.updatedAt)}
          </span>
        </div>
        <Button disabled={propertyPending || Boolean(propertyDraft)} onClick={onEditIdentity}><Pencil size={12} /> 대상 정보 수정</Button>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 11 }}>
        <strong style={{ color: C.t1, fontSize: 14 }}>설정</strong>
        <span style={{
          marginLeft: 7, padding: '2px 7px', borderRadius: 9,
          background: C.bg, border: `1px solid ${C.border}`, color: C.t3, fontSize: 10,
        }}>{properties.length}</span>
        <div style={{ flex: 1 }} />
        <Button disabled={Boolean(propertyDraft) || propertyPending} onClick={onStartAdd}><Plus size={12} /> 설정 추가</Button>
      </div>

      {propertyDraft?.mode === 'add' && (
        <div style={{ marginBottom: 10 }}>
          <PropertyEditor
            draft={propertyDraft}
            pending={propertyPending}
            error={propertyError}
            conflict={propertyConflict}
            onChange={onDraftChange}
            onCancel={onCancelDraft}
            onReload={onReload}
            onSave={onSaveDraft}
          />
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
        {properties.map(([name, value]) => {
          const editing = propertyDraft?.mode === 'edit' && propertyDraft.currentSettingName === name;
          const evidence = evidenceByName.get(name);
          const latestEpisode = evidence?.latestEvidence?.sourceEpisodeNo;
          if (editing) {
            return (
              <PropertyEditor
                key={name}
                draft={propertyDraft}
                pending={propertyPending}
                error={propertyError}
                conflict={propertyConflict}
                onChange={onDraftChange}
                onCancel={onCancelDraft}
                onReload={onReload}
                onSave={onSaveDraft}
              />
            );
          }
          return (
            <div key={name} style={{
              borderRadius: 9, border: `1px solid ${C.border}`, background: C.bg, overflow: 'hidden',
            }}>
              <div style={{
                minHeight: 72, padding: '12px 13px', display: 'grid',
                gridTemplateColumns: 'minmax(120px, 0.7fr) minmax(220px, 1.6fr) 100px 34px',
                alignItems: 'center', gap: 12,
              }}>
                <div>
                  <div style={{ color: C.t3, fontSize: 9, marginBottom: 5 }}>설정명</div>
                  <strong style={{ color: C.t1, fontSize: 12 }}>{name}</strong>
                </div>
                <div>
                  <div style={{ color: C.t3, fontSize: 9, marginBottom: 5 }}>설정값</div>
                  <span style={{ color: C.t1, fontSize: 12, lineHeight: 1.55 }}>{value}</span>
                </div>
                <button type="button" onClick={() => onToggleEvidence(name)} style={{
                  border: 'none', background: 'none', textAlign: 'left', padding: 0,
                  color: evidence ? C.primary : C.t3, fontFamily: 'inherit', cursor: 'pointer',
                }}>
                  <div style={{ fontSize: 9, marginBottom: 5 }}>최근 근거</div>
                  <span style={{ fontSize: 11 }}>{latestEpisode == null ? '직접 입력' : `${latestEpisode}화`}</span>
                </button>
                <button
                  type="button"
                  aria-label={`${name} 설정 수정`}
                  disabled={Boolean(propertyDraft) || propertyPending}
                  onClick={() => onStartEdit(name, value)}
                  style={{
                    width: 32, height: 32, borderRadius: 7, border: `1px solid ${C.border}`,
                    background: C.surface, color: C.t2, display: 'flex', alignItems: 'center',
                    justifyContent: 'center', cursor: propertyDraft || propertyPending ? 'not-allowed' : 'pointer',
                  }}
                ><Pencil size={13} /></button>
              </div>
              {expandedEvidence === name && (
                <div style={{ padding: '11px 13px', borderTop: `1px solid ${C.border}`, background: C.surface }}>
                  <EvidencePanel evidence={evidence} />
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div style={{
        marginTop: 18, padding: '13px 14px', borderRadius: 8,
        border: `1px solid ${C.border}`, background: C.bg,
        display: 'flex', alignItems: 'center', gap: 9,
      }}>
        <Clock3 size={14} color={C.t3} />
        <div>
          <div style={{ color: C.t2, fontSize: 11 }}>회차 후보 확정과 직접 입력으로 갱신됨</div>
          <div style={{ color: C.t3, fontSize: 10, marginTop: 3 }}>삭제·보관·복원·전체 변경 이력은 MVP에서 제공하지 않습니다.</div>
        </div>
      </div>
    </div>
  );
}

function ModalShell({
  title,
  description,
  pending,
  dirty,
  children,
  onClose,
  onSubmit,
  submitLabel,
}: {
  title: string;
  description: string;
  pending: boolean;
  dirty: boolean;
  children: ReactNode;
  onClose: () => void;
  onSubmit: (event: FormEvent) => void;
  submitLabel: string;
}) {
  const requestClose = () => {
    if (pending) return;
    if (dirty && !window.confirm('작성 중인 내용을 취소할까요?')) return;
    onClose();
  };
  return (
    <div
      role="presentation"
      onMouseDown={event => { if (event.target === event.currentTarget) requestClose(); }}
      style={{
        position: 'fixed', inset: 0, zIndex: 220, padding: 20,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'rgba(0,0,0,0.7)',
      }}
    >
      <form onSubmit={onSubmit} style={{
        width: 'min(650px, 100%)', maxHeight: 'calc(100vh - 40px)', overflowY: 'auto',
        borderRadius: 12, border: `1px solid ${C.border}`, background: C.surface,
        boxShadow: '0 24px 72px rgba(0,0,0,0.6)',
      }}>
        <div style={{ padding: '22px 24px 16px', display: 'flex', alignItems: 'flex-start', gap: 12 }}>
          <div>
            <strong style={{ display: 'block', color: C.t1, fontSize: 18, marginBottom: 6 }}>{title}</strong>
            <span style={{ color: C.t3, fontSize: 11 }}>{description}</span>
          </div>
          <div style={{ flex: 1 }} />
          <button type="button" aria-label="닫기" disabled={pending} onClick={requestClose} style={{
            width: 34, height: 34, borderRadius: 8, border: `1px solid ${C.border}`,
            background: C.bg, color: C.t3, display: 'flex', alignItems: 'center',
            justifyContent: 'center', cursor: pending ? 'not-allowed' : 'pointer',
          }}><X size={16} /></button>
        </div>
        <div style={{ padding: '0 24px 22px' }}>{children}</div>
        <div style={{
          padding: '15px 24px', borderTop: `1px solid ${C.border}`,
          display: 'flex', justifyContent: 'flex-end', gap: 8,
        }}>
          <Button disabled={pending} onClick={requestClose}>취소</Button>
          <Button type="submit" primary disabled={pending}>
            {pending ? <Loader2 size={13} className="spin" /> : <Check size={13} />} {pending ? '저장 중…' : submitLabel}
          </Button>
        </div>
      </form>
    </div>
  );
}

const modalInputStyle = {
  width: '100%', height: 42, padding: '0 11px', boxSizing: 'border-box' as const,
  borderRadius: 7, border: `1px solid ${C.border}`, background: C.bg,
  color: C.t1, fontFamily: 'inherit', fontSize: 12, outline: 'none',
};

function CreateWorldSettingModal({
  pending,
  error,
  onClose,
  onSubmit,
}: {
  pending: boolean;
  error?: string | null;
  onClose: () => void;
  onSubmit: (category: WorldCategory, subjectName: string, settingName: string, settingValue: string) => void;
}) {
  const [category, setCategory] = useState<WorldCategory>('RACE');
  const [subjectName, setSubjectName] = useState('');
  const [settingName, setSettingName] = useState('');
  const [settingValue, setSettingValue] = useState('');
  const [validationError, setValidationError] = useState<string | null>(null);
  const dirty = Boolean(subjectName || settingName || settingValue || category !== 'RACE');
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!subjectName.trim() || !settingName.trim() || !settingValue.trim()) {
      setValidationError('대상명·설정명·설정값을 모두 입력해 주세요.');
      return;
    }
    setValidationError(null);
    onSubmit(category, subjectName.trim(), settingName.trim(), settingValue.trim());
  };
  return (
    <ModalShell
      title="새 세계관 대상 추가"
      description="분류와 대상, 첫 설정을 입력하면 세계관 DB에 바로 추가됩니다."
      pending={pending}
      dirty={dirty}
      onClose={onClose}
      onSubmit={submit}
      submitLabel="대상 추가"
    >
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.2fr', gap: 12 }}>
        <label style={{ color: C.t3, fontSize: 11 }}>
          분류
          <select value={category} onChange={event => setCategory(event.target.value as WorldCategory)} style={{ ...modalInputStyle, marginTop: 7 }}>
            {CATEGORY_OPTIONS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
        </label>
        <label style={{ color: C.t3, fontSize: 11 }}>
          대상명
          <input value={subjectName} onChange={event => setSubjectName(event.target.value)} placeholder="예: 엘프" style={{ ...modalInputStyle, marginTop: 7 }} />
        </label>
      </div>
      <div style={{ color: C.t1, fontSize: 13, fontWeight: 700, margin: '20px 0 12px' }}>첫 설정</div>
      <label style={{ display: 'block', color: C.t3, fontSize: 11 }}>
        설정명
        <input value={settingName} onChange={event => setSettingName(event.target.value)} placeholder="예: 서식지" style={{ ...modalInputStyle, marginTop: 7 }} />
      </label>
      <label style={{ display: 'block', color: C.t3, fontSize: 11, marginTop: 13 }}>
        설정값
        <textarea value={settingValue} onChange={event => setSettingValue(event.target.value)} placeholder="지속적으로 활용할 설정 내용을 입력하세요." style={{
          ...modalInputStyle, height: 90, padding: '11px', marginTop: 7, resize: 'vertical',
        }} />
      </label>
      <div style={{
        marginTop: 15, padding: '11px 13px', borderRadius: 7,
        border: `1px solid ${C.primary}44`, background: `${C.primary}14`,
        color: C.t2, fontSize: 11,
      }}>
        직접 입력은 AI 후보 검토 없이 확정 세계관에 바로 저장됩니다.
      </div>
      {(validationError || error) && <div role="alert" style={{ marginTop: 11, color: C.danger, fontSize: 11 }}>{validationError ?? error}</div>}
    </ModalShell>
  );
}

function EditIdentityModal({
  detail,
  pending,
  error,
  conflict,
  onClose,
  onReload,
  onSubmit,
}: {
  detail: WorldSettingDetailResponse;
  pending: boolean;
  error?: string | null;
  conflict: boolean;
  onClose: () => void;
  onReload: () => void;
  onSubmit: (category: WorldCategory, subjectName: string) => void;
}) {
  const initialCategory = detail.category ?? 'RACE';
  const initialSubject = detail.subjectName ?? '';
  const [category, setCategory] = useState<WorldCategory>(initialCategory);
  const [subjectName, setSubjectName] = useState(initialSubject);
  const [validationError, setValidationError] = useState<string | null>(null);
  const dirty = category !== initialCategory || subjectName !== initialSubject;
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!subjectName.trim()) {
      setValidationError('대상명을 입력해 주세요.');
      return;
    }
    setValidationError(null);
    onSubmit(category, subjectName.trim());
  };
  return (
    <ModalShell
      title="대상 정보 수정"
      description="분류와 대상명을 수정합니다. 기존 설정은 그대로 유지됩니다."
      pending={pending}
      dirty={dirty}
      onClose={onClose}
      onSubmit={submit}
      submitLabel="변경 저장"
    >
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.2fr', gap: 12 }}>
        <label style={{ color: C.t3, fontSize: 11 }}>
          분류
          <select value={category} onChange={event => setCategory(event.target.value as WorldCategory)} style={{ ...modalInputStyle, marginTop: 7 }}>
            {CATEGORY_OPTIONS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
        </label>
        <label style={{ color: C.t3, fontSize: 11 }}>
          대상명
          <input value={subjectName} onChange={event => setSubjectName(event.target.value)} style={{ ...modalInputStyle, marginTop: 7 }} />
        </label>
      </div>
      <div style={{
        marginTop: 15, padding: '11px 13px', borderRadius: 7,
        border: `1px solid ${C.border}`, background: C.bg,
        color: C.t2, fontSize: 11,
      }}>
        연결된 설정 {detail.propertyCount ?? Object.keys(detail.properties ?? {}).length}개 · 설정값은 변경되지 않습니다.
      </div>
      {(validationError || error) && (
        <div role="alert" style={{ marginTop: 11, color: C.danger, fontSize: 11 }}>
          {validationError ?? error}
          {conflict && (
            <button type="button" onClick={onReload} style={{
              marginLeft: 8, border: 'none', background: 'none', color: C.primary,
              fontFamily: 'inherit', fontSize: 11, fontWeight: 700, cursor: 'pointer',
            }}>최신값 다시 불러오기</button>
          )}
        </div>
      )}
    </ModalShell>
  );
}

export function WorldSettingDatabase({
  workId,
  enabled,
  onAnalyze,
}: {
  workId: string;
  enabled: boolean;
  onAnalyze: () => void;
}) {
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const q = searchParams.get('q')?.trim() ?? '';
  const category = parseCategory(searchParams.get('category'));
  const sort = parseSort(searchParams.get('sort'));
  const page = parsePage(searchParams.get('page'));
  const apiPage = page - 1;
  const selectedId = searchParams.get('settingId');
  const modal = searchParams.get('modal');
  const [searchDraft, setSearchDraft] = useState(q);
  const [propertyDraft, setPropertyDraft] = useState<PropertyDraft | null>(null);
  const [propertyValidationError, setPropertyValidationError] = useState<string | null>(null);
  const [expandedEvidence, setExpandedEvidence] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [mobileViewport, setMobileViewport] = useState(() => (
    typeof window !== 'undefined' && window.matchMedia(MOBILE_VIEWPORT_QUERY).matches
  ));

  useEffect(() => setSearchDraft(q), [q]);
  useEffect(() => {
    const mediaQuery = window.matchMedia(MOBILE_VIEWPORT_QUERY);
    const updateViewport = () => setMobileViewport(mediaQuery.matches);
    updateViewport();
    mediaQuery.addEventListener('change', updateViewport);
    return () => mediaQuery.removeEventListener('change', updateViewport);
  }, []);
  useEffect(() => {
    if (!successMessage) return undefined;
    const timer = window.setTimeout(() => setSuccessMessage(null), 3500);
    return () => window.clearTimeout(timer);
  }, [successMessage]);

  const listQuery = useQuery({
    ...getWorldSettingsOptions({
      path: { workId },
      query: { q: q || undefined, category, sort, page: apiPage, size: PAGE_SIZE },
    }),
    enabled,
    retry: shouldRetryQuery,
  });
  const listData = listQuery.data?.data;
  const worldSettingPage = listData?.worldSettings;
  const items = useMemo(() => worldSettingPage?.content ?? [], [worldSettingPage?.content]);

  useEffect(() => {
    if (mobileViewport || modal || !listQuery.isSuccess || listQuery.isFetching || selectedId || !items[0]?.id) return;
    setSearchParams(previous => {
      const next = new URLSearchParams(previous);
      next.set('settingId', items[0].id!);
      return next;
    }, { replace: true });
  }, [items, listQuery.isFetching, listQuery.isSuccess, mobileViewport, modal, selectedId, setSearchParams]);

  useEffect(() => {
    const totalPages = worldSettingPage?.totalPages;
    if (totalPages == null || apiPage < Math.max(totalPages, 1)) return;
    setSearchParams(previous => {
      const next = new URLSearchParams(previous);
      next.set('page', String(Math.max(totalPages, 1)));
      next.delete('settingId');
      return next;
    }, { replace: true });
  }, [apiPage, setSearchParams, worldSettingPage?.totalPages]);

  const detailQuery = useQuery({
    ...getWorldSettingOptions({ path: { workId, worldSettingId: selectedId ?? '' } }),
    enabled: enabled && Boolean(selectedId),
    retry: (failureCount, error) => toApiError(error)?.status !== 404
      && shouldRetryQuery(failureCount, error),
  });
  const detail = detailQuery.data?.data;

  const invalidateWorldSettings = async (worldSettingId?: string) => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: getWorldSettingsQueryKey({ path: { workId } }) }),
      ...(worldSettingId ? [queryClient.invalidateQueries({
        queryKey: getWorldSettingQueryKey({ path: { workId, worldSettingId } }),
      })] : []),
    ]);
  };

  const createMutation = useMutation({
    ...createWorldSettingMutation(),
    onSuccess: async response => {
      const createdId = response.data?.id;
      setSearchParams(previous => {
        const next = new URLSearchParams(previous);
        next.delete('modal');
        next.delete('q');
        next.delete('category');
        next.delete('sort');
        next.set('page', '1');
        if (createdId) next.set('settingId', createdId);
        return next;
      }, { replace: true });
      setSuccessMessage('새 세계관 대상을 추가했습니다.');
      await invalidateWorldSettings(createdId);
    },
  });
  const identityMutation = useMutation({
    ...updateWorldSettingIdentityMutation(),
    onSuccess: async (_, variables) => {
      await invalidateWorldSettings(variables.path.worldSettingId);
      setSearchParams(previous => {
        const next = new URLSearchParams(previous);
        next.delete('modal');
        return next;
      }, { replace: true });
      setSuccessMessage('대상 정보를 수정했습니다.');
    },
  });
  const addPropertyMutation = useMutation({
    ...addWorldSettingPropertyMutation(),
    onSuccess: async (_, variables) => {
      await invalidateWorldSettings(variables.path.worldSettingId);
      setPropertyDraft(null);
      setPropertyValidationError(null);
      setSuccessMessage('새 설정을 추가했습니다.');
    },
  });
  const updatePropertyMutation = useMutation({
    ...updateWorldSettingPropertyMutation(),
    onSuccess: async (_, variables) => {
      await invalidateWorldSettings(variables.path.worldSettingId);
      setPropertyDraft(null);
      setPropertyValidationError(null);
      setSuccessMessage('설정을 수정했습니다.');
    },
  });

  const propertyPending = addPropertyMutation.isPending || updatePropertyMutation.isPending;
  const propertyMutationError = addPropertyMutation.isError
    ? addPropertyMutation.error
    : updatePropertyMutation.isError
      ? updatePropertyMutation.error
      : null;
  const propertyError = propertyValidationError
    ?? (propertyMutationError ? errorMessage(propertyMutationError, '설정을 저장하지 못했습니다. 입력값을 유지했습니다.') : null);

  const resetPropertyMutations = () => {
    addPropertyMutation.reset();
    updatePropertyMutation.reset();
    setPropertyValidationError(null);
  };

  const confirmDiscardPropertyDraft = () => {
    if (!propertyDraft) return true;
    return window.confirm('작성 중인 설정 내용을 취소할까요?');
  };

  const selectSetting = (id: string) => {
    if (propertyPending || !confirmDiscardPropertyDraft()) return;
    setPropertyDraft(null);
    resetPropertyMutations();
    setExpandedEvidence(null);
    setSearchParams(previous => {
      const next = new URLSearchParams(previous);
      next.set('settingId', id);
      next.delete('modal');
      return next;
    }, { replace: true });
  };

  const updateListParams = (patch: { q?: string; category?: WorldCategory; sort?: WorldSort }) => {
    if (propertyPending || !confirmDiscardPropertyDraft()) return;
    setPropertyDraft(null);
    resetPropertyMutations();
    setSearchParams(previous => {
      const next = new URLSearchParams(previous);
      if ('q' in patch) {
        if (patch.q) next.set('q', patch.q);
        else next.delete('q');
      }
      if ('category' in patch) {
        if (patch.category) next.set('category', patch.category);
        else next.delete('category');
      }
      if ('sort' in patch) {
        if (patch.sort === 'UPDATED_DESC') next.set('sort', patch.sort);
        else next.delete('sort');
      }
      next.set('page', '1');
      next.delete('settingId');
      return next;
    }, { replace: true });
  };

  const saveProperty = () => {
    if (!propertyDraft || !selectedId || !detail || propertyPending) return;
    const settingName = propertyDraft.settingName.trim();
    const settingValue = propertyDraft.settingValue.trim();
    if (!settingName || !settingValue) {
      setPropertyValidationError('설정명과 설정값을 모두 입력해 주세요.');
      return;
    }
    setPropertyValidationError(null);
    if (propertyDraft.mode === 'add') {
      addPropertyMutation.mutate({
        path: { workId, worldSettingId: selectedId },
        body: { settingName, settingValue, version: detail.version },
      });
    } else {
      updatePropertyMutation.mutate({
        path: { workId, worldSettingId: selectedId },
        body: {
          currentSettingName: propertyDraft.currentSettingName!,
          settingName,
          settingValue,
          version: detail.version,
        },
      });
    }
  };

  const changePage = (nextPage: number) => {
    if (propertyPending || !confirmDiscardPropertyDraft()) return;
    setPropertyDraft(null);
    resetPropertyMutations();
    setSearchParams(previous => {
      const next = new URLSearchParams(previous);
      next.set('page', String(nextPage + 1));
      next.delete('settingId');
      return next;
    }, { replace: true });
  };

  if (!enabled) {
    return (
      <PanelState
        icon={<Database size={28} color={C.t3} />}
        title="세계관 DB를 불러올 작품이 필요합니다."
        description="작품을 선택한 뒤 세계관 설정을 관리해 주세요."
      />
    );
  }

  const total = listData?.totalWorldSettingCount ?? 0;
  const filteredTotal = worldSettingPage?.totalElements ?? 0;
  const currentPage = worldSettingPage?.page ?? apiPage;
  const totalPages = worldSettingPage?.totalPages ?? 0;
  const listError = listQuery.isError ? errorMessage(listQuery.error, '세계관 목록을 불러오지 못했습니다.') : null;

  return (
    <section style={{ maxWidth: 1280, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, marginBottom: 18 }}>
        <div>
          <strong style={{ display: 'block', color: C.t1, fontSize: 20, marginBottom: 6 }}>세계관 DB</strong>
          <span style={{ color: C.t3, fontSize: 12 }}>분류와 대상을 선택해 지속 설정을 한곳에서 관리합니다.</span>
        </div>
        <div style={{ flex: 1 }} />
        <span style={{
          minHeight: 27, padding: '0 10px', borderRadius: 14,
          border: `1px solid ${C.border}`, background: C.surface,
          color: C.t2, display: 'inline-flex', alignItems: 'center', fontSize: 11,
        }}>총 {total}개 대상</span>
        <Button primary onClick={() => {
          if (!confirmDiscardPropertyDraft()) return;
          setPropertyDraft(null);
          createMutation.reset();
          setSearchParams(previous => {
            const next = new URLSearchParams(previous);
            next.set('modal', 'world-setting-create');
            return next;
          });
        }}><Plus size={13} /> 새 대상 추가</Button>
      </div>

      {successMessage && (
        <div role="status" style={{
          marginBottom: 12, padding: '10px 13px', borderRadius: 7,
          border: `1px solid ${C.success}55`, background: `${C.success}12`,
          color: C.success, fontSize: 11,
        }}><Check size={12} style={{ verticalAlign: 'middle', marginRight: 6 }} />{successMessage}</div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(260px, 1fr) 250px 220px', gap: 10, marginBottom: 14 }}>
        <form onSubmit={(event: FormEvent) => {
          event.preventDefault();
          updateListParams({ q: searchDraft.trim() });
        }} style={{ position: 'relative' }}>
          <Search size={15} color={C.t3} style={{ position: 'absolute', left: 13, top: 13 }} />
          <input
            value={searchDraft}
            onChange={event => setSearchDraft(event.target.value)}
            placeholder="대상 · 설정명 · 설정값 검색"
            style={{
              width: '100%', height: 42, padding: '0 82px 0 38px', boxSizing: 'border-box',
              borderRadius: 8, border: `1px solid ${C.border}`, background: C.surface,
              color: C.t1, fontFamily: 'inherit', fontSize: 12, outline: 'none',
            }}
          />
          <button type="submit" style={{
            position: 'absolute', right: 6, top: 6, height: 30, padding: '0 10px',
            borderRadius: 6, border: 'none', background: `${C.primary}18`, color: C.primary,
            fontFamily: 'inherit', fontSize: 10, fontWeight: 700, cursor: 'pointer',
          }}>검색</button>
        </form>
        <select
          value={category ?? 'ALL'}
          onChange={event => updateListParams({
            category: event.target.value === 'ALL' ? undefined : event.target.value as WorldCategory,
          })}
          style={{ ...modalInputStyle, height: 42, background: C.surface }}
        >
          <option value="ALL">전체 분류</option>
          {CATEGORY_OPTIONS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
        </select>
        <select
          value={sort}
          onChange={event => updateListParams({ sort: event.target.value as WorldSort })}
          style={{ ...modalInputStyle, height: 42, background: C.surface }}
        >
          <option value="CATEGORY_SUBJECT_ASC">분류·대상 이름순</option>
          <option value="UPDATED_DESC">최근 수정순</option>
        </select>
      </div>

      {listQuery.isPending && !listQuery.data ? (
        <PanelState
          icon={<Loader2 size={27} color={C.primary} className="spin" />}
          title="세계관 설정을 불러오고 있습니다."
          description="분류와 대상별 설정을 정리하고 있습니다."
          minHeight={460}
        />
      ) : listQuery.isError && !listQuery.data ? (
        <PanelState
          icon={<AlertCircle size={27} color={C.danger} />}
          title="세계관 설정을 불러오지 못했습니다."
          description={listError ?? '잠시 후 다시 시도해 주세요.'}
          action={<Button onClick={() => void listQuery.refetch()}><RefreshCw size={12} /> 다시 시도</Button>}
          minHeight={460}
        />
      ) : total === 0 ? (
        <PanelState
          icon={<Database size={30} color={C.primary} />}
          title="등록된 세계관 설정이 없습니다."
          description="회차를 분석해 세계관 설정을 추출하거나 직접 추가해 보세요."
          action={<div style={{ display: 'flex', gap: 8 }}>
            <Button onClick={onAnalyze}>회차 분석하기</Button>
            <Button primary onClick={() => setSearchParams(previous => {
              const next = new URLSearchParams(previous);
              next.set('modal', 'world-setting-create');
              return next;
            })}><Plus size={12} /> 새 대상 추가</Button>
          </div>}
          minHeight={460}
        />
      ) : filteredTotal === 0 ? (
        <PanelState
          icon={<Search size={28} color={C.t3} />}
          title="검색 조건에 맞는 세계관 설정이 없습니다."
          description="검색어 또는 분류 필터를 바꿔 보세요."
          action={<Button onClick={() => {
            setSearchDraft('');
            updateListParams({ q: '', category: undefined, sort: 'CATEGORY_SUBJECT_ASC' });
          }}>검색 조건 초기화</Button>}
          minHeight={460}
        />
      ) : (
        <div className={`world-setting-db-layout${selectedId ? ' mobile-detail-open' : ''}`} style={{
          display: 'grid', gridTemplateColumns: 'minmax(270px, 350px) minmax(0, 1fr)',
          gap: 14, alignItems: 'start',
        }}>
          <aside className="world-setting-db-list" style={{
            minHeight: 540, padding: 14, borderRadius: 10,
            border: `1px solid ${C.border}`, background: C.surface,
            display: 'flex', flexDirection: 'column', gap: 8,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: 3 }}>
              <strong style={{ color: C.t1, fontSize: 13 }}>대상 목록</strong>
              <div style={{ flex: 1 }} />
              <span style={{ color: C.t3, fontSize: 10 }}>{PAGE_SIZE}개씩</span>
            </div>
            {listQuery.isError && listQuery.data && (
              <div role="alert" style={{ color: C.danger, fontSize: 10, marginBottom: 3 }}>
                최신 목록 조회 실패 · 이전 결과 표시 중
              </div>
            )}
            {items.map(item => item.id && (
              <ListItem
                key={item.id}
                item={item}
                selected={item.id === selectedId}
                disabled={propertyPending}
                onClick={() => selectSetting(item.id!)}
              />
            ))}
            <div style={{ flex: 1 }} />
            <PageNavigation
              page={currentPage}
              totalPages={totalPages}
              disabled={listQuery.isFetching || propertyPending}
              onPageChange={changePage}
            />
          </aside>

          <section className="world-setting-db-detail">
            <button type="button" className="world-setting-db-mobile-back" onClick={() => setSearchParams(previous => {
              const next = new URLSearchParams(previous);
              next.delete('settingId');
              return next;
            }, { replace: true })} style={{
              display: 'none', border: 'none', background: 'none', color: C.primary,
              fontFamily: 'inherit', fontSize: 11, marginBottom: 8, cursor: 'pointer',
            }}><ChevronLeft size={14} /> 대상 목록으로</button>
            {!selectedId ? (
              <PanelState
                icon={<Database size={26} color={C.primary} />}
                title="세계관 대상을 선택해 주세요."
                description="왼쪽 목록에서 대상을 선택하면 설정을 확인하고 수정할 수 있습니다."
                minHeight={540}
              />
            ) : detailQuery.isPending ? (
              <PanelState
                icon={<Loader2 size={26} color={C.primary} className="spin" />}
                title="세계관 상세를 불러오고 있습니다."
                description="현재 설정과 연결된 원문 근거를 확인하고 있습니다."
                minHeight={540}
              />
            ) : detailQuery.isError || !detail ? (
              <PanelState
                icon={<AlertCircle size={27} color={C.danger} />}
                title="세계관 상세를 불러오지 못했습니다."
                description={errorMessage(detailQuery.error, '대상이 삭제되었거나 접근할 수 없습니다.')}
                action={<Button onClick={() => void detailQuery.refetch()}><RefreshCw size={12} /> 다시 시도</Button>}
                minHeight={540}
              />
            ) : (
              <WorldSettingDetail
                detail={detail}
                propertyDraft={propertyDraft}
                propertyPending={propertyPending}
                propertyError={propertyError}
                propertyConflict={isVersionConflict(propertyMutationError)}
                expandedEvidence={expandedEvidence}
                onEditIdentity={() => {
                  identityMutation.reset();
                  setSearchParams(previous => {
                    const next = new URLSearchParams(previous);
                    next.set('modal', 'world-setting-edit');
                    return next;
                  });
                }}
                onStartAdd={() => {
                  resetPropertyMutations();
                  setPropertyDraft({
                    mode: 'add', settingName: '', settingValue: '',
                    initialSettingName: '', initialSettingValue: '',
                  });
                }}
                onStartEdit={(name, value) => {
                  resetPropertyMutations();
                  setPropertyDraft({
                    mode: 'edit', currentSettingName: name,
                    settingName: name, settingValue: value,
                    initialSettingName: name, initialSettingValue: value,
                  });
                }}
                onDraftChange={setPropertyDraft}
                onCancelDraft={() => {
                  if (!confirmDiscardPropertyDraft()) return;
                  setPropertyDraft(null);
                  resetPropertyMutations();
                }}
                onSaveDraft={saveProperty}
                onReload={() => void detailQuery.refetch()}
                onToggleEvidence={name => setExpandedEvidence(current => current === name ? null : name)}
              />
            )}
          </section>
        </div>
      )}

      {modal === 'world-setting-create' && (
        <CreateWorldSettingModal
          pending={createMutation.isPending}
          error={createMutation.isError ? errorMessage(createMutation.error, '새 대상을 추가하지 못했습니다.') : null}
          onClose={() => setSearchParams(previous => {
            const next = new URLSearchParams(previous);
            next.delete('modal');
            return next;
          }, { replace: true })}
          onSubmit={(newCategory, subjectName, settingName, settingValue) => createMutation.mutate({
            path: { workId },
            body: { category: newCategory, subjectName, settingName, settingValue },
          })}
        />
      )}
      {modal === 'world-setting-edit' && detail && selectedId && (
        <EditIdentityModal
          key={detail.id}
          detail={detail}
          pending={identityMutation.isPending}
          error={identityMutation.isError ? errorMessage(identityMutation.error, '대상 정보를 수정하지 못했습니다.') : null}
          conflict={identityMutation.isError && isVersionConflict(identityMutation.error)}
          onClose={() => setSearchParams(previous => {
            const next = new URLSearchParams(previous);
            next.delete('modal');
            return next;
          }, { replace: true })}
          onReload={() => void detailQuery.refetch()}
          onSubmit={(newCategory, subjectName) => identityMutation.mutate({
            path: { workId, worldSettingId: selectedId },
            body: { category: newCategory, subjectName, version: detail.version },
          })}
        />
      )}
      <style>{`
        @media (max-width: 900px) {
          .world-setting-db-layout {
            grid-template-columns: minmax(0, 1fr) !important;
          }
          .world-setting-db-layout.mobile-detail-open .world-setting-db-list {
            display: none !important;
          }
          .world-setting-db-layout:not(.mobile-detail-open) .world-setting-db-detail {
            display: none !important;
          }
          .world-setting-db-layout.mobile-detail-open .world-setting-db-mobile-back {
            display: inline-flex !important;
            align-items: center;
            gap: 4px;
          }
        }
      `}</style>
    </section>
  );
}
