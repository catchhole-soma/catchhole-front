import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { motion } from 'motion/react';
import {
  AlertCircle,
  Archive,
  Check,
  ChevronRight,
  FileText,
  Loader2,
  Plus,
  RefreshCw,
  Trash2,
  Upload,
  Users,
  X,
} from 'lucide-react';
import {
  deleteCharacterMutation,
  getCharacterOptions,
  getCharacterQueryKey,
  getCharactersOptions,
  getCharactersQueryKey,
  updateCharacterMutation,
} from '../../../api/generated/@tanstack/react-query.gen';
import type {
  CharacterDetailResponse,
  CharacterSettingPropertyRequest,
  CharacterSettingResponse,
  CharacterSettingUpdateRequest,
  CharacterSummaryResponse,
  CharacterUpdateRequest,
} from '../../../api/generated/types.gen';
import { useResponsiveGridPagination } from '../../../hooks/useResponsiveGridPagination';
import { toApiError } from '../../../lib/api-errors';
import { C } from '../constants';
import { PageNavigation } from '../PageNavigation';

type SettingValueType = CharacterSettingUpdateRequest['valueType'];
type SettingGroupKey = 'profile' | 'stats' | 'skills' | 'items' | 'statuses';

interface DraftProperty extends CharacterSettingPropertyRequest {
  displayName: string;
}

interface DraftSetting {
  characterFactId?: string;
  key: string;
  displayName: string;
  value: string;
  valueType: SettingValueType;
  properties: DraftProperty[];
  hasEvidence: boolean;
}

interface CharacterDraft {
  name: string;
  roleLabel: string;
  currentAge: string;
  currentLevel: string;
  firstAppearanceEpisodeNo: string;
  profile: DraftSetting[];
  stats: DraftSetting[];
  skills: DraftSetting[];
  items: DraftSetting[];
  statuses: DraftSetting[];
}

interface Props {
  workId: string;
  selectedCharacterId: string | null;
  isEditing: boolean;
  openInEditMode?: boolean;
  demoMode: boolean;
  onOpen: (characterId: string, edit: boolean) => void;
  onClose: () => void;
  onEditChange: (editing: boolean) => void;
  onAnalyze: () => void;
}

const AVATAR_COLORS = [C.primary, '#E25C5C', '#4BB8D9', C.success, '#D4A04A', '#B48BFF'];
const CHARACTER_CARD_HEIGHT = 177;
const CHARACTER_GRID_GAP = 16;
const SETTING_GROUP_LABELS: Record<SettingGroupKey, string> = {
  profile: '프로필',
  stats: '스탯',
  skills: '스킬',
  items: '아이템',
  statuses: '상태',
};

function colorFor(id: string): string {
  const hash = Array.from(id).reduce((value, char) => value + char.charCodeAt(0), 0);
  return AVATAR_COLORS[hash % AVATAR_COLORS.length];
}

function setting(
  id: string,
  key: string,
  displayName: string,
  value: string,
  valueType: SettingValueType = 'STRING',
  properties: Array<{ key: string; displayName: string; value: string; valueType?: SettingValueType }> = [],
): CharacterSettingResponse {
  return {
    characterFactId: id,
    key,
    displayName,
    value,
    valueType,
    properties: properties.map(property => ({
      key: property.key,
      displayName: property.displayName,
      value: property.value,
      valueType: property.valueType ?? 'STRING',
    })),
    hasEvidence: true,
  };
}

const INITIAL_DEMO_CHARACTERS: CharacterDetailResponse[] = [
  {
    id: 'sua',
    name: '수아',
    roleLabel: '주인공',
    currentAge: 23,
    currentAgeFact: { characterFactId: 'sua-age', hasEvidence: true },
    currentLevel: 15,
    currentLevelFact: { characterFactId: 'sua-level', hasEvidence: true },
    firstAppearanceEpisode: { id: 'demo-episode-1', episodeNo: 1 },
    profile: [
      setting('sua-gender', 'profile.gender', '성별', '여성'),
      setting('sua-species', 'profile.species', '종족', '인간'),
      setting('sua-affiliation', 'profile.affiliation', '소속', '왕립 검술학교'),
      setting('sua-occupation', 'profile.occupation', '직업', '검사 지망생'),
      setting('sua-eye', 'profile.eye_color', '눈 색깔', '갈색'),
      setting('sua-description', 'profile.description', '설명', '왕립 검술학교에 재학 중인 검사 지망생'),
    ],
    stats: [
      setting('sua-strength', 'stats.strength', '근력', '42', 'NUMBER'),
      setting('sua-agility', 'stats.agility', '민첩', '58', 'NUMBER'),
      setting('sua-mana', 'stats.mana', '마력', '31', 'NUMBER'),
    ],
    skills: [
      setting('sua-skill-1', 'skill.basic_sword', '기본 검술', 'Lv.3', 'JSON', [
        { key: 'name', displayName: '이름', value: '기본 검술' },
        { key: 'level', displayName: '레벨', value: '3', valueType: 'NUMBER' },
      ]),
      setting('sua-skill-2', 'skill.magic_sense', '마력 감지', 'Lv.1', 'JSON', [
        { key: 'name', displayName: '이름', value: '마력 감지' },
        { key: 'level', displayName: '레벨', value: '1', valueType: 'NUMBER' },
      ]),
    ],
    items: [
      setting('sua-item-1', 'item.training_sword', '훈련용 검', '1개', 'JSON', [
        { key: 'name', displayName: '이름', value: '훈련용 검' },
        { key: 'quantity', displayName: '수량', value: '1', valueType: 'NUMBER' },
      ]),
      setting('sua-item-2', 'item.student_id', '학생증', '보유', 'JSON', [
        { key: 'name', displayName: '이름', value: '학생증' },
        { key: 'state', displayName: '상태', value: '보유' },
      ]),
    ],
    statuses: [
      setting('sua-status', 'status.normal', '정상', '정상', 'JSON', [
        { key: 'name', displayName: '이름', value: '정상' },
      ]),
    ],
  },
  {
    id: 'min', name: '강민준', roleLabel: '남자주인공', currentAge: 28, currentLevel: 21,
    firstAppearanceEpisode: { id: 'demo-episode-2', episodeNo: 2 },
    profile: [setting('min-job', 'profile.occupation', '직업', '왕실 기사')],
    stats: [], skills: [], items: [], statuses: [],
  },
  {
    id: 'lena', name: '이레나', roleLabel: '라이벌', currentAge: 24, currentLevel: 18,
    firstAppearanceEpisode: { id: 'demo-episode-3', episodeNo: 3 },
    profile: [setting('lena-job', 'profile.occupation', '직업', '마법 연구원')],
    stats: [], skills: [], items: [], statuses: [],
  },
];

function toSummary(detail: CharacterDetailResponse): CharacterSummaryResponse {
  const representative = detail.profile?.find(item => item.key === 'profile.occupation')
    ?? detail.profile?.[0];
  return {
    id: detail.id,
    name: detail.name,
    currentAge: detail.currentAge,
    representativeAttributeLabel: representative?.displayName ?? (detail.currentLevel == null ? null : '레벨'),
    representativeAttributeValue: representative?.value ?? (detail.currentLevel == null ? null : String(detail.currentLevel)),
    firstAppearanceEpisodeNo: detail.firstAppearanceEpisode?.episodeNo,
  };
}

function errorMessage(error: unknown, fallback: string): string {
  return toApiError(error)?.message ?? (error instanceof Error ? error.message : fallback);
}

function toDraftSetting(value: CharacterSettingResponse): DraftSetting {
  return {
    characterFactId: value.characterFactId,
    key: value.key ?? '',
    displayName: value.displayName ?? value.key ?? '설정',
    value: value.value ?? '',
    valueType: value.valueType ?? 'STRING',
    properties: (value.properties ?? []).map(property => ({
      key: property.key ?? '',
      displayName: property.displayName ?? property.key ?? '속성',
      value: property.value ?? null,
      valueType: property.valueType ?? 'STRING',
    })),
    hasEvidence: value.hasEvidence ?? false,
  };
}

function toDraft(detail: CharacterDetailResponse): CharacterDraft {
  return {
    name: detail.name ?? '',
    roleLabel: detail.roleLabel ?? '',
    currentAge: detail.currentAge == null ? '' : String(detail.currentAge),
    currentLevel: detail.currentLevel == null ? '' : String(detail.currentLevel),
    firstAppearanceEpisodeNo: detail.firstAppearanceEpisode?.episodeNo == null
      ? ''
      : String(detail.firstAppearanceEpisode.episodeNo),
    profile: (detail.profile ?? []).map(toDraftSetting),
    stats: (detail.stats ?? []).map(toDraftSetting),
    skills: (detail.skills ?? []).map(toDraftSetting),
    items: (detail.items ?? []).map(toDraftSetting),
    statuses: (detail.statuses ?? []).map(toDraftSetting),
  };
}

function nullable(value: string): string | null {
  const normalized = value.trim();
  return normalized.length === 0 ? null : normalized;
}

function optionalInteger(value: string, minimum: number, label: string): number | null {
  if (value.trim() === '') return null;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < minimum) {
    throw new Error(`${label}은(는) ${minimum} 이상의 정수로 입력해 주세요.`);
  }
  return parsed;
}

function validateTypedValue(value: string | null | undefined, valueType: SettingValueType, label: string): void {
  if (value == null || value.trim() === '') return;
  if (valueType === 'NUMBER' && !Number.isFinite(Number(value))) {
    throw new Error(`${label}은(는) 숫자로 입력해 주세요.`);
  }
  if (valueType === 'BOOLEAN' && !['true', 'false'].includes(value.toLowerCase())) {
    throw new Error(`${label}은(는) true 또는 false로 입력해 주세요.`);
  }
  if (valueType === 'JSON') {
    try {
      JSON.parse(value);
    } catch {
      throw new Error(`${label}의 JSON 형식을 확인해 주세요.`);
    }
  }
}

function toRequestSettings(settings: DraftSetting[], complex: boolean): CharacterSettingUpdateRequest[] {
  return settings.map(item => {
    // 복합 설정의 valueType은 valueJson 전체 타입이다. 화면용 factValue(Lv.3, 보유 등)는
    // 일반 문자열일 수 있으므로 대표값은 검증하지 않고, 세부 properties만 각 타입대로 검증한다.
    if (!complex) {
      validateTypedValue(item.value, item.valueType, item.displayName);
    }
    item.properties.forEach(property => validateTypedValue(
      property.value,
      property.valueType,
      `${item.displayName} ${property.displayName}`,
    ));
    return {
      key: item.key,
      value: nullable(item.value),
      valueType: item.valueType,
      properties: item.properties.map(property => ({
        key: property.key,
        value: nullable(property.value ?? ''),
        valueType: property.valueType,
      })),
    };
  });
}

function toRequest(draft: CharacterDraft): CharacterUpdateRequest {
  if (!draft.name.trim()) throw new Error('이름을 입력해 주세요.');
  return {
    name: draft.name.trim(),
    roleLabel: nullable(draft.roleLabel),
    currentAge: optionalInteger(draft.currentAge, 0, '현재 나이'),
    currentLevel: optionalInteger(draft.currentLevel, 0, '현재 레벨'),
    firstAppearanceEpisodeNo: optionalInteger(draft.firstAppearanceEpisodeNo, 1, '첫 등장 회차'),
    profile: toRequestSettings(draft.profile, false),
    stats: toRequestSettings(draft.stats, false),
    skills: toRequestSettings(draft.skills, true),
    items: toRequestSettings(draft.items, true),
    statuses: toRequestSettings(draft.statuses, true),
  };
}

function isUnchangedSetting(previous: CharacterSettingResponse | undefined, draft: DraftSetting): boolean {
  if (!previous || previous.key !== draft.key || (previous.valueType ?? 'STRING') !== draft.valueType) {
    return false;
  }
  if ((previous.value ?? null) !== nullable(draft.value)) return false;

  const previousProperties = previous.properties ?? [];
  if (previousProperties.length !== draft.properties.length) return false;
  return draft.properties.every((property, index) => {
    const previousProperty = previousProperties[index];
    return previousProperty?.key === property.key
      && (previousProperty.value ?? null) === nullable(property.value ?? '')
      && (previousProperty.valueType ?? 'STRING') === property.valueType;
  });
}

function draftToDemoDetail(previous: CharacterDetailResponse, draft: CharacterDraft): CharacterDetailResponse {
  const toResponse = (
    items: DraftSetting[],
    previousItems: CharacterSettingResponse[] | undefined,
  ): CharacterSettingResponse[] => items.map(item => {
    const previousItem = previousItems?.find(candidate => (
      candidate.characterFactId === item.characterFactId
    ));
    return {
      characterFactId: item.characterFactId ?? `demo-fact-${item.key}`,
      key: item.key,
      displayName: item.properties.find(property => property.key === 'name')?.value
        ?? item.displayName,
      value: nullable(item.value),
      valueType: item.valueType,
      properties: item.properties,
      hasEvidence: isUnchangedSetting(previousItem, item)
        ? previousItem?.hasEvidence ?? false
        : false,
    };
  });
  const currentAge = optionalInteger(draft.currentAge, 0, '현재 나이');
  const currentLevel = optionalInteger(draft.currentLevel, 0, '현재 레벨');
  return {
    ...previous,
    name: draft.name.trim(),
    roleLabel: nullable(draft.roleLabel),
    currentAge,
    currentAgeFact: currentAge == null
      ? undefined
      : currentAge === previous.currentAge
        ? previous.currentAgeFact
        : { characterFactId: `demo-fact-age-${Date.now()}`, hasEvidence: false },
    currentLevel,
    currentLevelFact: currentLevel == null
      ? undefined
      : currentLevel === previous.currentLevel
        ? previous.currentLevelFact
        : { characterFactId: `demo-fact-level-${Date.now()}`, hasEvidence: false },
    firstAppearanceEpisode: draft.firstAppearanceEpisodeNo.trim()
      ? { episodeNo: optionalInteger(draft.firstAppearanceEpisodeNo, 1, '첫 등장 회차') ?? undefined }
      : undefined,
    profile: toResponse(draft.profile, previous.profile),
    stats: toResponse(draft.stats, previous.stats),
    skills: toResponse(draft.skills, previous.skills),
    items: toResponse(draft.items, previous.items),
    statuses: toResponse(draft.statuses, previous.statuses),
  };
}

function Avatar({ id, name, size = 48 }: { id: string; name: string; size?: number }) {
  const color = colorFor(id);
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%', flexShrink: 0,
      background: color + '18', border: `2px solid ${color}`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      color, fontSize: size * 0.4, fontWeight: 700,
    }}>
      {name.trim().charAt(0) || '?'}
    </div>
  );
}

function CharacterCard({
  character,
  selected,
  onClick,
}: {
  character: CharacterSummaryResponse;
  selected: boolean;
  onClick: () => void;
}) {
  const [hovered, setHovered] = useState(false);
  const id = character.id ?? '';
  const color = colorFor(id);
  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        height: CHARACTER_CARD_HEIGHT, boxSizing: 'border-box', overflow: 'hidden',
        padding: 20, borderRadius: 10, textAlign: 'left',
        border: `1.5px solid ${selected || hovered ? color : C.border}`,
        background: selected ? color + '0D' : C.bg, color: C.t1,
        cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.15s',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 18 }}>
        <Avatar id={id} name={character.name ?? ''} size={48} />
        <strong style={{ flex: 1, minWidth: 0, fontSize: 16, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {character.name || '이름 없음'}
        </strong>
        <ChevronRight size={17} color={hovered || selected ? color : C.t3} />
      </div>
      {[
        ['나이', character.currentAge == null ? '—' : `${character.currentAge}세`],
        [character.representativeAttributeLabel ?? '대표 설정', character.representativeAttributeValue ?? '—'],
        ['첫 등장', character.firstAppearanceEpisodeNo == null
          ? '—'
          : `${character.firstAppearanceEpisodeNo}화`],
      ].map(([label, value]) => (
        <div key={label} style={{ display: 'flex', justifyContent: 'space-between', gap: 16, marginTop: 7 }}>
          <span style={{ color: C.t3, fontSize: 12 }}>{label}</span>
          <span style={{ color: C.t2, fontSize: 12, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{value}</span>
        </div>
      ))}
    </button>
  );
}

function EmptyArea({ label }: { label: string }) {
  return (
    <div style={{ padding: '18px 14px', color: C.t3, fontSize: 12, textAlign: 'center' }}>
      등록된 {label} 정보가 없습니다.
    </div>
  );
}

function EvidenceButton({
  enabled,
  label,
  onClick,
}: {
  enabled: boolean;
  label: string;
  onClick: () => void;
}) {
  if (!enabled) return null;
  return (
    <button
      type="button"
      aria-label={`${label} 원문 근거 보기`}
      title="원문 근거 보기"
      onClick={onClick}
      style={{ background: 'none', border: 'none', color: C.primary, padding: 2, cursor: 'pointer', lineHeight: 0 }}
    >
      <FileText size={14} />
    </button>
  );
}

function SimpleSettingList({
  settings,
  emptyLabel,
  columns = 1,
  onEvidence,
}: {
  settings: CharacterSettingResponse[];
  emptyLabel: string;
  columns?: 1 | 2;
  onEvidence: (characterFactId: string) => void;
}) {
  if (settings.length === 0) return <EmptyArea label={emptyLabel} />;
  return (
    <div style={{ display: 'grid', gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}>
      {settings.map((item, index) => (
        <div key={item.characterFactId ?? item.key ?? index} style={{
          minHeight: 40, padding: '8px 14px', display: 'grid',
          gridTemplateColumns: columns === 2 ? '80px minmax(0, 1fr) auto' : '110px minmax(0, 1fr) auto',
          alignItems: 'center', gap: 10,
          borderRight: columns === 2 && index % 2 === 0 ? `1px solid ${C.border}` : 'none',
          borderBottom: Math.floor(index / columns) < Math.ceil(settings.length / columns) - 1
            ? `1px solid ${C.border}`
            : 'none',
        }}>
          <span style={{ color: C.t3, fontSize: 12 }}>{item.displayName ?? item.key}</span>
          <span style={{ color: C.t2, fontSize: 12, overflowWrap: 'anywhere' }}>{item.value || '—'}</span>
          <EvidenceButton
            enabled={Boolean(item.hasEvidence && item.characterFactId)}
            label={item.displayName ?? item.key ?? emptyLabel}
            onClick={() => item.characterFactId && onEvidence(item.characterFactId)}
          />
        </div>
      ))}
    </div>
  );
}

const inputStyle = {
  width: '100%', height: 36, boxSizing: 'border-box' as const,
  borderRadius: 6, border: `1px solid ${C.border}`, background: '#24242F',
  color: C.t1, padding: '0 10px', fontSize: 12, fontFamily: 'inherit', outline: 'none',
};

function EditSettingList({
  settings,
  group,
  emptyLabel,
  complex = false,
  columns = 1,
  onChange,
  onRemove,
  onAdd,
  onEvidence,
}: {
  settings: DraftSetting[];
  group: SettingGroupKey;
  emptyLabel: string;
  complex?: boolean;
  columns?: 1 | 2;
  onChange: (index: number, setting: DraftSetting) => void;
  onRemove: (index: number) => void;
  onAdd?: () => void;
  onEvidence?: (characterFactId: string) => void;
}) {
  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: columns === 2 ? 'repeat(2, minmax(0, 1fr))' : 'minmax(0, 1fr)',
      gap: complex ? 8 : 0,
    }}>
      {settings.length === 0 && <div style={{ gridColumn: '1 / -1' }}><EmptyArea label={emptyLabel} /></div>}
      {settings.map((item, index) => {
        const namePropertyIndex = item.properties.findIndex(property => property.key === 'name');
        const editableName = namePropertyIndex >= 0;
        return (
          <div key={item.characterFactId ?? item.key} style={{
            display: 'grid',
            gridTemplateColumns: complex
              ? 'minmax(120px, 1fr) minmax(100px, 0.7fr) auto'
              : columns === 2
                ? '80px minmax(0, 1fr) auto'
                : '110px minmax(0, 1fr) auto',
            gap: 8, alignItems: 'center', padding: complex ? 8 : '7px 12px',
            border: complex ? `1px solid ${C.border}` : 'none',
            borderRight: !complex && columns === 2 && index % 2 === 0 ? `1px solid ${C.border}` : undefined,
            borderBottom: !complex
              && Math.floor(index / columns) < Math.ceil(settings.length / columns) - 1
              ? `1px solid ${C.border}`
              : undefined,
            borderRadius: complex ? 7 : 0,
          }}>
            {complex || editableName ? (
              <input
                aria-label={`${emptyLabel} 이름`}
                value={namePropertyIndex >= 0 ? item.properties[namePropertyIndex].value ?? '' : item.displayName}
                onChange={event => {
                  const properties = [...item.properties];
                  if (namePropertyIndex >= 0) {
                    properties[namePropertyIndex] = { ...properties[namePropertyIndex], value: event.target.value };
                  } else if (complex) {
                    properties.push({
                      key: 'name',
                      displayName: '이름',
                      value: event.target.value,
                      valueType: 'STRING',
                    });
                  }
                  onChange(index, { ...item, displayName: event.target.value, properties });
                }}
                style={inputStyle}
              />
            ) : (
              <span title={item.key} style={{ color: C.t3, fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {item.displayName}
              </span>
            )}
            <input
              aria-label={`${item.displayName} 값`}
              value={item.value}
              onChange={event => onChange(index, { ...item, value: event.target.value })}
              style={inputStyle}
            />
            <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <EvidenceButton
                enabled={Boolean(item.hasEvidence && item.characterFactId && onEvidence)}
                label={item.displayName}
                onClick={() => item.characterFactId && onEvidence?.(item.characterFactId)}
              />
              <button
                type="button"
                aria-label={`${item.displayName} 제거`}
                onClick={() => onRemove(index)}
                style={{ background: 'none', border: 'none', color: C.t3, cursor: 'pointer', padding: 4, lineHeight: 0 }}
              >
                <X size={14} />
              </button>
            </div>
          </div>
        );
      })}
      {onAdd && (
        <button type="button" onClick={onAdd} style={{
          gridColumn: '1 / -1',
          height: 32, borderRadius: 6, border: `1px dashed ${C.border}`,
          background: 'transparent', color: C.t3, fontSize: 12, fontFamily: 'inherit',
          cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
        }}>
          <Plus size={13} /> {SETTING_GROUP_LABELS[group]} 추가
        </button>
      )}
    </div>
  );
}

function ModalButton({
  children,
  onClick,
  danger = false,
  primary = false,
  disabled = false,
}: {
  children: React.ReactNode;
  onClick: () => void;
  danger?: boolean;
  primary?: boolean;
  disabled?: boolean;
}) {
  return (
    <button type="button" onClick={onClick} disabled={disabled} style={{
      height: 36, padding: '0 15px', borderRadius: 6,
      border: primary ? 'none' : `1px solid ${C.border}`,
      background: primary ? (danger ? C.danger : C.primary) : 'transparent',
      color: primary ? '#fff' : danger ? C.danger : C.t2,
      fontSize: 12, fontFamily: 'inherit', cursor: disabled ? 'default' : 'pointer',
      opacity: disabled ? 0.55 : 1, display: 'flex', alignItems: 'center', gap: 6,
    }}>
      {children}
    </button>
  );
}

function ConfirmLayer({
  kind,
  busy,
  onCancel,
  onConfirm,
}: {
  kind: 'delete' | 'save';
  busy: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const deleting = kind === 'delete';
  return (
    <div style={{
      position: 'absolute', inset: 0, zIndex: 3, background: 'rgba(0,0,0,0.76)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 12,
    }}>
      <div style={{ width: 500, padding: '26px 28px', borderRadius: 10, background: C.surface, border: `1px solid ${C.border}`, boxShadow: '0 20px 60px rgba(0,0,0,0.5)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: C.t1, fontSize: 17, fontWeight: 700, marginBottom: 16 }}>
          {deleting ? <Archive size={20} color={C.t2} /> : <AlertCircle size={20} color={C.warning} />}
          {deleting ? '캐릭터를 삭제하시겠습니까?' : '수정 내용을 저장하시겠습니까?'}
        </div>
        <p style={{ color: C.t2, fontSize: 13, lineHeight: 1.7, margin: '0 0 16px' }}>
          {deleting
            ? '캐릭터 목록, 설정 검색, 이후 원고 캐릭터 매칭과 충돌 감지 대상에서 제외됩니다. 기존 설정 이력과 원문 근거는 그대로 보관됩니다.'
            : '값을 직접 변경한 설정에는 근거 문장이 표시되지 않습니다. 업로드한 원고와 AI 분석 당시의 데이터는 변경되지 않습니다.'}
        </p>
        <div style={{ padding: '11px 13px', borderRadius: 7, background: '#24242F', border: `1px solid ${C.border}`, color: C.t2, fontSize: 12, marginBottom: 20 }}>
          {deleting
            ? '삭제된 캐릭터는 보관함으로 이동하며, 보관함에서 다시 복구할 수 있습니다.'
            : '수정 뒤에는 설정 검색, 캐릭터 자동 연결, 충돌 감지, 원문 근거 표시 결과가 달라질 수 있습니다.'}
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <ModalButton onClick={onCancel} disabled={busy}>취소</ModalButton>
          <ModalButton onClick={onConfirm} danger={deleting} primary disabled={busy}>
            {busy && <Loader2 size={13} className="spin" />}
            {deleting ? '삭제' : '저장'}
          </ModalButton>
        </div>
      </div>
    </div>
  );
}

export function CharacterDatabase({
  workId,
  selectedCharacterId,
  isEditing,
  openInEditMode = false,
  demoMode,
  onOpen,
  onClose,
  onEditChange,
  onAnalyze,
}: Props) {
  const queryClient = useQueryClient();
  const [demoCharacters, setDemoCharacters] = useState(INITIAL_DEMO_CHARACTERS);
  const [draft, setDraft] = useState<CharacterDraft | null>(null);
  const [confirming, setConfirming] = useState<'delete' | 'save' | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [selectedEvidenceFactId, setSelectedEvidenceFactId] = useState<string | null>(null);
  const [firstVisibleIndex, setFirstVisibleIndex] = useState(0);
  const {
    containerRef,
    contentStartRef,
    columnCount,
    pageSize,
    ready: layoutReady,
  } = useResponsiveGridPagination({
    minItemWidth: 280,
    itemHeight: CHARACTER_CARD_HEIGHT,
    gap: CHARACTER_GRID_GAP,
    maxColumns: 5,
    maxPageSize: 24,
    reservedBottomSpace: 72,
  });
  const page = Math.floor(firstVisibleIndex / pageSize);

  const charactersQuery = useQuery({
    ...getCharactersOptions({ path: { workId }, query: { page, size: pageSize } }),
    enabled: !demoMode && Boolean(workId) && layoutReady,
  });
  const detailQuery = useQuery({
    ...getCharacterOptions({ path: { workId, characterId: selectedCharacterId ?? '' } }),
    enabled: !demoMode && Boolean(workId) && Boolean(selectedCharacterId),
  });

  const updateMutation = useMutation({
    ...updateCharacterMutation(),
    onSuccess: async response => {
      if (!selectedCharacterId) return;
      queryClient.setQueryData(
        getCharacterQueryKey({ path: { workId, characterId: selectedCharacterId } }),
        response,
      );
      await queryClient.invalidateQueries({ queryKey: getCharactersQueryKey({ path: { workId } }) });
      setConfirming(null);
      setActionError(null);
      setFeedback('캐릭터 설정을 저장했습니다.');
      onEditChange(false);
    },
    onError: error => {
      setConfirming(null);
      setActionError(errorMessage(error, '캐릭터 설정을 저장하지 못했습니다.'));
    },
  });

  const deleteMutation = useMutation({
    ...deleteCharacterMutation(),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: getCharactersQueryKey({ path: { workId } }) });
      setConfirming(null);
      setFeedback('캐릭터를 삭제했습니다. 보관함에서 복구할 수 있습니다.');
      onClose();
    },
    onError: error => {
      setConfirming(null);
      setActionError(errorMessage(error, '캐릭터를 보관하지 못했습니다.'));
    },
  });

  const demoDetail = demoCharacters.find(character => character.id === selectedCharacterId);
  const detail = demoMode ? demoDetail : detailQuery.data?.data;
  const demoSummaries = useMemo(() => demoCharacters.map(toSummary), [demoCharacters]);
  const characterPage = charactersQuery.data?.data;
  const characters = useMemo(
    () => demoMode
      ? demoSummaries.slice(page * pageSize, (page + 1) * pageSize)
      : characterPage?.content ?? [],
    [characterPage?.content, demoMode, demoSummaries, page, pageSize],
  );
  const totalElements = demoMode ? demoSummaries.length : characterPage?.totalElements ?? 0;
  const totalPages = demoMode
    ? Math.ceil(totalElements / pageSize)
    : characterPage?.totalPages ?? 0;

  useEffect(() => {
    setFirstVisibleIndex(0);
  }, [demoMode, workId]);

  useEffect(() => {
    const pageMetadataReady = demoMode || charactersQuery.isSuccess;
    if (!pageMetadataReady) return;
    if (totalPages === 0 && firstVisibleIndex !== 0) {
      setFirstVisibleIndex(0);
    } else if (totalPages > 0 && page >= totalPages) {
      setFirstVisibleIndex((totalPages - 1) * pageSize);
    }
  }, [
    charactersQuery.isSuccess,
    demoMode,
    firstVisibleIndex,
    page,
    pageSize,
    totalPages,
  ]);

  useEffect(() => {
    if (isEditing && detail) setDraft(toDraft(detail));
    if (!isEditing) setDraft(null);
    setActionError(null);
    setSelectedEvidenceFactId(null);
  }, [detail, isEditing]);

  useEffect(() => {
    if (!feedback) return;
    const timeoutId = window.setTimeout(() => setFeedback(null), 3000);
    return () => window.clearTimeout(timeoutId);
  }, [feedback]);

  const changeSetting = (group: SettingGroupKey, index: number, value: DraftSetting) => {
    setDraft(current => current ? {
      ...current,
      [group]: current[group].map((item, itemIndex) => itemIndex === index ? value : item),
    } : current);
  };

  const removeSetting = (group: SettingGroupKey, index: number) => {
    setDraft(current => current ? {
      ...current,
      [group]: current[group].filter((_, itemIndex) => itemIndex !== index),
    } : current);
  };

  const addSimpleSetting = (group: 'profile' | 'stats') => {
    const suffix = `${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const label = group === 'profile' ? '새 프로필' : '새 스탯';
    setDraft(current => current ? {
      ...current,
      [group]: [...current[group], {
        key: `${group}.manual_${suffix}`,
        displayName: label,
        value: '',
        valueType: group === 'stats' ? 'NUMBER' : 'STRING',
        properties: [{ key: 'name', displayName: '이름', value: label, valueType: 'STRING' }],
        hasEvidence: false,
      }],
    } : current);
  };

  const addComplexSetting = (group: 'skills' | 'items' | 'statuses') => {
    const suffix = `${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const singular = group === 'skills' ? 'skill' : group === 'items' ? 'item' : 'status';
    const label = group === 'skills' ? '새 스킬' : group === 'items' ? '새 아이템' : '새 상태';
    setDraft(current => current ? {
      ...current,
      [group]: [...current[group], {
        key: `${singular}.manual_${suffix}`,
        displayName: label,
        value: label,
        valueType: 'JSON',
        properties: [{ key: 'name', displayName: '이름', value: label, valueType: 'STRING' }],
        hasEvidence: false,
      }],
    } : current);
  };

  const save = () => {
    if (!draft || !selectedCharacterId || !detail) return;
    try {
      const body = toRequest(draft);
      if (demoMode) {
        setDemoCharacters(current => current.map(character => (
          character.id === selectedCharacterId ? draftToDemoDetail(character, draft) : character
        )));
        setConfirming(null);
        setActionError(null);
        setFeedback('캐릭터 설정을 저장했습니다.');
        onEditChange(false);
        return;
      }
      updateMutation.mutate({ path: { workId, characterId: selectedCharacterId }, body });
    } catch (error) {
      setConfirming(null);
      setActionError(error instanceof Error ? error.message : '입력값을 확인해 주세요.');
    }
  };

  const archive = () => {
    if (!selectedCharacterId) return;
    if (demoMode) {
      setDemoCharacters(current => current.filter(character => character.id !== selectedCharacterId));
      setConfirming(null);
      setFeedback('캐릭터를 삭제했습니다. 보관함에서 복구할 수 있습니다.');
      onClose();
      return;
    }
    deleteMutation.mutate({ path: { workId, characterId: selectedCharacterId } });
  };

  const loadingList = !demoMode && (!layoutReady || charactersQuery.isPending);
  const listError = !demoMode && charactersQuery.isError;
  const mutationPending = updateMutation.isPending || deleteMutation.isPending;

  return (
    <>
      {feedback && (
        <div
          role="status"
          aria-live="polite"
          style={{
            position: 'fixed', top: 84, right: 20, zIndex: 400,
            width: 360, maxWidth: 'calc(100vw - 40px)', boxSizing: 'border-box',
            padding: '11px 13px', borderRadius: 8,
            background: '#14241F', border: `1px solid ${C.success}66`,
            color: C.success, fontSize: 12,
            boxShadow: '0 12px 32px rgba(0, 0, 0, 0.36)',
            display: 'flex', alignItems: 'center', gap: 8,
          }}
        >
          <Check size={14} />
          <span style={{ flex: 1 }}>{feedback}</span>
          <button
            type="button"
            aria-label="알림 닫기"
            onClick={() => setFeedback(null)}
            style={{ background: 'none', border: 'none', color: C.success, cursor: 'pointer', padding: 2, lineHeight: 0 }}
          >
            <X size={13} />
          </button>
        </div>
      )}

      <div ref={containerRef} style={{ width: '100%', maxWidth: 1680 }}>
        <div style={{ marginBottom: 24 }}>
          <h2 style={{ color: C.t1, fontSize: 19, margin: '0 0 7px' }}>캐릭터 DB</h2>
          <p style={{ color: C.t3, fontSize: 13, margin: 0 }}>
            캐릭터 카드를 선택하면 현재 설정과 원문 근거를 확인할 수 있습니다.
            {openInEditMode && <span style={{ color: C.primary, marginLeft: 8 }}>편집할 캐릭터를 선택해 주세요.</span>}
          </p>
        </div>

        <div ref={contentStartRef} />

        {loadingList && (
          <div style={{ height: 240, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, color: C.t3, fontSize: 13 }}>
            <Loader2 size={18} className="spin" /> 캐릭터 목록을 불러오는 중입니다.
          </div>
        )}

        {listError && (
          <div style={{ height: 240, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, color: C.t3, fontSize: 13 }}>
            <AlertCircle size={24} color={C.danger} />
            <span>{errorMessage(charactersQuery.error, '캐릭터 목록을 불러오지 못했습니다.')}</span>
            <ModalButton onClick={() => charactersQuery.refetch()}><RefreshCw size={13} /> 다시 시도</ModalButton>
          </div>
        )}

        {!loadingList && !listError && characters.length === 0 && (
          <div style={{ height: 280, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
            <div style={{ width: 56, height: 56, borderRadius: 14, background: C.primary + '14', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Users size={26} color={C.primary} />
            </div>
            <strong style={{ color: C.t1, fontSize: 17 }}>등록된 캐릭터가 없습니다</strong>
            <span style={{ color: C.t3, fontSize: 13 }}>원고를 분석하여 캐릭터를 추출해 보세요!</span>
            <ModalButton primary onClick={onAnalyze}><Upload size={13} /> 원고 분석하기</ModalButton>
          </div>
        )}

        {!loadingList && !listError && characters.length > 0 && (
          <div>
            <div style={{
              display: 'grid',
              gridTemplateColumns: `repeat(${columnCount}, minmax(0, 1fr))`,
              gap: CHARACTER_GRID_GAP,
            }}>
              {characters.map(character => (
                <CharacterCard
                  key={character.id}
                  character={character}
                  selected={selectedCharacterId === character.id}
                  onClick={() => character.id && onOpen(character.id, openInEditMode)}
                />
              ))}
            </div>
            <div style={{ marginTop: 16 }}>
              <PageNavigation
                page={page}
                totalPages={totalPages}
                disabled={!demoMode && charactersQuery.isFetching}
                onPageChange={nextPage => setFirstVisibleIndex(nextPage * pageSize)}
              />
            </div>
          </div>
        )}
      </div>

      {selectedCharacterId && (
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          data-testid="character-modal-backdrop"
          onClick={() => {
            if (!mutationPending) onClose();
          }}
          style={{ position: 'fixed', inset: 0, zIndex: 200, padding: '36px 20px', overflowY: 'auto', background: 'rgba(0,0,0,0.72)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center' }}
        >
          <motion.div
            initial={{ y: 24, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
            onClick={event => event.stopPropagation()}
            style={{ width: 1000, maxWidth: 'calc(100vw - 40px)', minHeight: 420, position: 'relative', borderRadius: 12, background: C.surface, border: `1px solid ${C.border}`, boxShadow: '0 24px 70px rgba(0,0,0,0.58)', overflow: 'hidden' }}
          >
            {confirming && (
              <ConfirmLayer
                kind={confirming}
                busy={updateMutation.isPending || deleteMutation.isPending}
                onCancel={() => setConfirming(null)}
                onConfirm={confirming === 'save' ? save : archive}
              />
            )}

            {!demoMode && detailQuery.isPending && (
              <div style={{ minHeight: 420, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, color: C.t3, fontSize: 13 }}>
                <Loader2 size={18} className="spin" /> 캐릭터 정보를 불러오는 중입니다.
              </div>
            )}

            {((!demoMode && detailQuery.isError) || (demoMode && !detail)) && (
              <div style={{ minHeight: 420, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
                <AlertCircle size={26} color={C.danger} />
                <span style={{ color: C.t2, fontSize: 13 }}>
                  {!demoMode ? errorMessage(detailQuery.error, '캐릭터 정보를 찾을 수 없습니다.') : '캐릭터 정보를 찾을 수 없습니다.'}
                </span>
                <div style={{ display: 'flex', gap: 8 }}>
                  {!demoMode && <ModalButton onClick={() => detailQuery.refetch()}><RefreshCw size={13} /> 다시 시도</ModalButton>}
                  <ModalButton onClick={onClose}>닫기</ModalButton>
                </div>
              </div>
            )}

            {detail && (!detailQuery.isPending || demoMode) && (
              <>
                <div style={{ padding: '22px 28px', borderBottom: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', gap: 14 }}>
                  <Avatar id={detail.id ?? selectedCharacterId} name={isEditing ? draft?.name ?? detail.name ?? '' : detail.name ?? ''} size={54} />
                  <div style={{ flex: 1 }}>
                    <div style={{ color: C.t1, fontSize: 19, fontWeight: 700 }}>{isEditing ? draft?.name || detail.name : detail.name}</div>
                    <div style={{ color: C.primary, fontSize: 12, marginTop: 3 }}>{isEditing ? draft?.roleLabel || '역할 없음' : detail.roleLabel || '역할 없음'}</div>
                  </div>
                  {!isEditing && (
                    <>
                      <ModalButton danger onClick={() => { setActionError(null); setConfirming('delete'); }}><Trash2 size={14} /> 삭제</ModalButton>
                      <ModalButton onClick={() => onEditChange(true)}>수정</ModalButton>
                    </>
                  )}
                  <button type="button" aria-label="닫기" onClick={onClose} style={{ background: 'none', border: 'none', color: C.t3, cursor: 'pointer', padding: 5, lineHeight: 0 }}>
                    <X size={19} />
                  </button>
                </div>

                <div style={{ padding: '22px 28px 26px', maxHeight: 'calc(100vh - 190px)', overflowY: 'auto' }}>
                  {actionError && (
                    <div role="alert" style={{ padding: '10px 13px', marginBottom: 14, borderRadius: 7, background: C.danger + '12', border: `1px solid ${C.danger}44`, color: C.danger, fontSize: 12 }}>
                      {actionError}
                    </div>
                  )}
                  {selectedEvidenceFactId && (
                    <div role="status" style={{ padding: '10px 13px', marginBottom: 14, borderRadius: 7, background: C.primary + '12', border: `1px solid ${C.primary}44`, color: C.t2, fontSize: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
                      <FileText size={14} color={C.primary} /> 원문 근거 패널은 후속 character-fact API 작업에서 연결됩니다.
                      <button type="button" aria-label="안내 닫기" onClick={() => setSelectedEvidenceFactId(null)} style={{ marginLeft: 'auto', background: 'none', border: 'none', color: C.t3, cursor: 'pointer', lineHeight: 0 }}><X size={13} /></button>
                    </div>
                  )}

                  <SectionTitle>기본 정보</SectionTitle>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, minmax(0, 1fr))', borderRadius: 8, border: `1px solid ${C.border}`, overflow: 'hidden', background: C.bg, marginBottom: 20 }}>
                    {isEditing && draft ? (
                      [
                        ['이름', 'name', draft.name],
                        ['역할', 'roleLabel', draft.roleLabel],
                        ['현재 나이', 'currentAge', draft.currentAge],
                        ['현재 레벨', 'currentLevel', draft.currentLevel],
                        ['첫 등장 회차', 'firstAppearanceEpisodeNo', draft.firstAppearanceEpisodeNo],
                      ].map(([label, key, value], index) => {
                        const factReference = key === 'currentAge'
                          ? detail.currentAgeFact
                          : key === 'currentLevel'
                            ? detail.currentLevelFact
                            : null;
                        return (
                        <div key={key} style={{ padding: '10px 12px', borderRight: index < 4 ? `1px solid ${C.border}` : 'none' }}>
                          <div style={{ color: C.t3, fontSize: 10, marginBottom: 6, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 4 }}>
                            {label}
                            <EvidenceButton
                              enabled={Boolean(factReference?.hasEvidence && factReference.characterFactId)}
                              label={label}
                              onClick={() => factReference?.characterFactId && setSelectedEvidenceFactId(factReference.characterFactId)}
                            />
                          </div>
                          <input
                            aria-label={label}
                            value={value}
                            inputMode={['currentAge', 'currentLevel', 'firstAppearanceEpisodeNo'].includes(key) ? 'numeric' : undefined}
                            onChange={event => setDraft(current => current ? { ...current, [key]: event.target.value } : current)}
                            style={inputStyle}
                          />
                        </div>
                        );
                      })
                    ) : (
                      [
                        { label: '이름', value: detail.name || '—' },
                        { label: '역할', value: detail.roleLabel || '—' },
                        { label: '현재 나이', value: detail.currentAge == null ? '—' : `${detail.currentAge}세`, factReference: detail.currentAgeFact },
                        { label: '현재 레벨', value: detail.currentLevel == null ? '—' : String(detail.currentLevel), factReference: detail.currentLevelFact },
                        { label: '첫 등장 회차', value: detail.firstAppearanceEpisode?.episodeNo == null ? '—' : `${detail.firstAppearanceEpisode.episodeNo}화` },
                      ].map(({ label, value, factReference }, index) => (
                        <div key={label} style={{ padding: '12px 14px', borderRight: index < 4 ? `1px solid ${C.border}` : 'none' }}>
                          <div style={{ color: C.t3, fontSize: 10, marginBottom: 7, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 4 }}>
                            {label}
                            <EvidenceButton
                              enabled={Boolean(factReference?.hasEvidence && factReference.characterFactId)}
                              label={label}
                              onClick={() => factReference?.characterFactId && setSelectedEvidenceFactId(factReference.characterFactId)}
                            />
                          </div>
                          <div style={{ color: C.t1, fontSize: 13, fontWeight: 600 }}>{value}</div>
                        </div>
                      ))
                    )}
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'minmax(280px, 0.9fr) minmax(420px, 1.35fr)', gap: 18, alignItems: 'start' }}>
                    <div>
                      <SectionTitle>프로필</SectionTitle>
                      <div style={{ borderRadius: 8, border: `1px solid ${C.border}`, background: C.bg, overflow: 'hidden' }}>
                        {isEditing && draft
                          ? <EditSettingList settings={draft.profile} group="profile" emptyLabel="프로필" onChange={(index, value) => changeSetting('profile', index, value)} onRemove={index => removeSetting('profile', index)} onAdd={() => addSimpleSetting('profile')} onEvidence={setSelectedEvidenceFactId} />
                          : <SimpleSettingList settings={detail.profile ?? []} emptyLabel="프로필" onEvidence={setSelectedEvidenceFactId} />}
                      </div>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                      <div>
                        <SectionTitle>스탯</SectionTitle>
                        <div style={{ borderRadius: 8, border: `1px solid ${C.border}`, background: C.bg, overflow: 'hidden' }}>
                          {isEditing && draft
                            ? <EditSettingList settings={draft.stats} group="stats" emptyLabel="스탯" columns={2} onChange={(index, value) => changeSetting('stats', index, value)} onRemove={index => removeSetting('stats', index)} onAdd={() => addSimpleSetting('stats')} onEvidence={setSelectedEvidenceFactId} />
                            : <SimpleSettingList settings={detail.stats ?? []} emptyLabel="스탯" columns={2} onEvidence={setSelectedEvidenceFactId} />}
                        </div>
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 12 }}>
                        <div>
                          <SectionTitle>스킬</SectionTitle>
                          <div style={{ borderRadius: 8, border: `1px solid ${C.border}`, background: C.bg, overflow: 'hidden' }}>
                            {isEditing && draft
                              ? <EditSettingList settings={draft.skills} group="skills" emptyLabel="스킬" complex onChange={(index, value) => changeSetting('skills', index, value)} onRemove={index => removeSetting('skills', index)} onAdd={() => addComplexSetting('skills')} onEvidence={setSelectedEvidenceFactId} />
                              : <SimpleSettingList settings={detail.skills ?? []} emptyLabel="스킬" onEvidence={setSelectedEvidenceFactId} />}
                          </div>
                        </div>
                        <div>
                          <SectionTitle>아이템</SectionTitle>
                          <div style={{ borderRadius: 8, border: `1px solid ${C.border}`, background: C.bg, overflow: 'hidden' }}>
                            {isEditing && draft
                              ? <EditSettingList settings={draft.items} group="items" emptyLabel="아이템" complex onChange={(index, value) => changeSetting('items', index, value)} onRemove={index => removeSetting('items', index)} onAdd={() => addComplexSetting('items')} onEvidence={setSelectedEvidenceFactId} />
                              : <SimpleSettingList settings={detail.items ?? []} emptyLabel="아이템" onEvidence={setSelectedEvidenceFactId} />}
                          </div>
                        </div>
                      </div>

                      <div>
                        <SectionTitle>상태</SectionTitle>
                        <div
                          data-testid="character-status-settings"
                          style={{ borderRadius: 8, border: `1px solid ${C.border}`, background: C.bg, overflow: 'hidden' }}
                        >
                          {isEditing && draft
                            ? <EditSettingList settings={draft.statuses} group="statuses" emptyLabel="상태" complex columns={2} onChange={(index, value) => changeSetting('statuses', index, value)} onRemove={index => removeSetting('statuses', index)} onAdd={() => addComplexSetting('statuses')} onEvidence={setSelectedEvidenceFactId} />
                            : <SimpleSettingList settings={detail.statuses ?? []} emptyLabel="상태" columns={2} onEvidence={setSelectedEvidenceFactId} />}
                        </div>
                      </div>
                    </div>
                  </div>

                  {isEditing && (
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 22 }}>
                      <ModalButton onClick={() => onEditChange(false)}>취소</ModalButton>
                      <ModalButton primary onClick={() => { setActionError(null); setConfirming('save'); }}><Check size={14} /> 저장</ModalButton>
                    </div>
                  )}
                  {!isEditing && (
                    <div style={{ color: C.t3, fontSize: 11, marginTop: 20, display: 'flex', alignItems: 'center', gap: 7 }}>
                      <FileText size={13} color={C.primary} /> 문서 아이콘이 있는 설정은 선택하여 원문 근거를 확인할 수 있습니다.
                    </div>
                  )}
                </div>
              </>
            )}
          </motion.div>
        </motion.div>
      )}
    </>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ color: C.t3, fontSize: 10, fontWeight: 600, letterSpacing: '0.06em', marginBottom: 7 }}>
      {children}
    </div>
  );
}
