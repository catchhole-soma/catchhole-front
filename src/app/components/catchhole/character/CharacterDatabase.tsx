import { useEffect, useMemo, useRef, useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';
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
  getArchivedCharactersOptions,
  getArchivedCharactersQueryKey,
  getCharacterOptions,
  getCharacterFactEvidenceOptions,
  getCharacterQueryKey,
  getCharactersOptions,
  getCharactersQueryKey,
  restoreCharacterMutation,
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
import { shouldRetryQuery } from '../../../lib/query-client';
import { C } from '../constants';
import { PageNavigation } from '../PageNavigation';
import { CharacterEvidencePanel } from './CharacterEvidencePanel';
import { getDemoCharacterEvidence, saveDemoCharacterState } from './demoCharacters';
import './character-evidence.css';

type SettingValueType = CharacterSettingUpdateRequest['valueType'];
type SettingGroupKey = 'profile' | 'stats' | 'skills' | 'items' | 'statuses';

interface DraftProperty extends CharacterSettingPropertyRequest {
  displayName: string;
}

interface DraftSetting {
  draftId: string;
  characterFactId?: string;
  key: string;
  displayName: string;
  value: string;
  valueType: SettingValueType;
  properties: DraftProperty[];
  hasEvidence: boolean;
  attributeNameEditable: boolean;
  attributeNamePrefix: string | null;
  displayNameEditable: boolean;
  initialKey: string | null;
  initialDisplayName: string | null;
  initialValue: string | null;
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
  selectedEvidenceFactId: string | null;
  isEditing: boolean;
  demoMode: boolean;
  archiveOpen: boolean;
  demoCharacters: CharacterDetailResponse[];
  demoArchivedCharacters: CharacterDetailResponse[];
  setDemoCharacters: Dispatch<SetStateAction<CharacterDetailResponse[]>>;
  setDemoArchivedCharacters: Dispatch<SetStateAction<CharacterDetailResponse[]>>;
  onOpen: (characterId: string, edit: boolean) => void;
  onClose: () => void;
  onEvidenceOpen: (characterFactId: string) => void;
  onEvidenceClose: () => void;
  onArchiveOpen: () => void;
  onArchiveClose: () => void;
  onEditChange: (editing: boolean) => void;
  onEditComplete: () => void;
  onAnalyze: () => void;
}

const AVATAR_COLORS = [C.primary, '#E25C5C', '#4BB8D9', C.success, '#D4A04A', '#B48BFF'];
const CHARACTER_CARD_HEIGHT = 177;
const CHARACTER_GRID_GAP = 16;
const ARCHIVE_PAGE_SIZE = 9;
const SETTING_GROUP_LABELS: Record<SettingGroupKey, string> = {
  profile: '프로필',
  stats: '스탯',
  skills: '스킬',
  items: '아이템',
  statuses: '상태',
};
const SETTING_GROUP_PREFIXES: Record<SettingGroupKey, string> = {
  profile: 'profile.',
  stats: 'stats.',
  skills: 'skill.',
  items: 'item.',
  statuses: 'status.',
};
let nextDraftSettingId = 0;

function createDraftSettingId(): string {
  nextDraftSettingId += 1;
  return `character-setting-${nextDraftSettingId}`;
}

function colorFor(id: string): string {
  const hash = Array.from(id).reduce((value, char) => value + char.charCodeAt(0), 0);
  return AVATAR_COLORS[hash % AVATAR_COLORS.length];
}

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
  const key = value.key ?? '';
  const displayName = value.displayName ?? value.key ?? '설정';
  const settingValue = value.value ?? '';
  return {
    draftId: value.characterFactId ?? createDraftSettingId(),
    characterFactId: value.characterFactId,
    key,
    displayName,
    value: settingValue,
    valueType: value.valueType ?? 'STRING',
    properties: (value.properties ?? []).map(property => ({
      key: property.key ?? '',
      displayName: property.displayName ?? property.key ?? '속성',
      value: property.value ?? null,
      valueType: property.valueType ?? 'STRING',
    })),
    hasEvidence: value.hasEvidence ?? false,
    attributeNameEditable: value.attributeNameEditable ?? false,
    attributeNamePrefix: value.attributeNamePrefix ?? null,
    displayNameEditable: value.displayNameEditable ?? false,
    initialKey: key,
    initialDisplayName: displayName,
    initialValue: settingValue,
  };
}

function orderManualSettingsLast<T extends { key?: string | null }>(settings: readonly T[]): T[] {
  return settings
    .map((setting, index) => ({ setting, index }))
    .sort((left, right) => {
      const leftKey = left.setting.key ?? '';
      const rightKey = right.setting.key ?? '';
      const leftManual = leftKey.includes('.manual_');
      const rightManual = rightKey.includes('.manual_');

      if (leftManual !== rightManual) return leftManual ? 1 : -1;
      if (leftManual && rightManual) {
        const keyComparison = leftKey.localeCompare(rightKey);
        if (keyComparison !== 0) return keyComparison;
      }
      return left.index - right.index;
    })
    .map(({ setting }) => setting);
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
    profile: orderManualSettingsLast(detail.profile ?? []).map(toDraftSetting),
    stats: orderManualSettingsLast(detail.stats ?? []).map(toDraftSetting),
    skills: orderManualSettingsLast(detail.skills ?? []).map(toDraftSetting),
    items: orderManualSettingsLast(detail.items ?? []).map(toDraftSetting),
    statuses: orderManualSettingsLast(detail.statuses ?? []).map(toDraftSetting),
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

function normalizeDynamicSuffix(value: string): string {
  return value.trim().replace(/\s+/g, '_');
}

function toNameOnlyProperties(item: DraftSetting): DraftProperty[] {
  const nameProperty = item.properties.find(property => property.key === 'name');
  return [{
    key: 'name',
    displayName: nameProperty?.displayName ?? '이름',
    value: item.displayName.trim(),
    valueType: 'STRING',
  }];
}

function hasSettingContentChanged(item: DraftSetting): boolean {
  if (!item.characterFactId) return true;
  return item.key !== item.initialKey
    || item.displayName.trim() !== item.initialDisplayName?.trim()
    || nullable(item.value) !== nullable(item.initialValue ?? '');
}

function toRequestSettings(
  settings: DraftSetting[],
  complex: boolean,
  groupLabel: string,
): CharacterSettingUpdateRequest[] {
  const keys = new Set<string>();
  return settings.map(item => {
    const key = item.key.trim();
    if (!key) throw new Error(`${groupLabel} 설정명을 입력해 주세요.`);
    if (item.attributeNameEditable) {
      const prefix = item.attributeNamePrefix;
      const suffix = prefix && key.startsWith(prefix) ? key.slice(prefix.length) : '';
      if (!prefix || !suffix.replace(/_/g, ' ').trim()) {
        throw new Error(`${groupLabel} 설정명 뒷부분을 입력해 주세요.`);
      }
    }
    if (item.displayNameEditable && !item.displayName.trim()) {
      throw new Error(`${groupLabel} 설정명을 입력해 주세요.`);
    }
    if (keys.has(key)) {
      throw new Error(`${groupLabel}에 같은 설정명이 두 개 있습니다.`);
    }
    keys.add(key);

    // 복합 설정의 valueType은 valueJson 전체 타입이다. 화면용 factValue(Lv.3, 보유 등)는
    // 일반 문자열일 수 있으므로 대표값은 검증하지 않고, 세부 properties만 각 타입대로 검증한다.
    if (!complex) {
      validateTypedValue(item.value, item.valueType, item.displayName);
    }
    const contentChanged = hasSettingContentChanged(item);
    const patternEdited = item.attributeNameEditable;
    const manualOrCustomEdited = !item.attributeNameEditable && item.displayNameEditable;
    const properties = (patternEdited || manualOrCustomEdited) && contentChanged
      ? toNameOnlyProperties(item)
      : item.properties;
    properties.forEach(property => validateTypedValue(
      property.value,
      property.valueType,
      `${item.displayName} ${property.displayName}`,
    ));
    return {
      key,
      value: nullable(item.value),
      valueType: item.valueType,
      properties: properties.map(property => ({
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
    profile: toRequestSettings(draft.profile, false, '프로필'),
    stats: toRequestSettings(draft.stats, false, '스탯'),
    skills: toRequestSettings(draft.skills, true, '스킬'),
    items: toRequestSettings(draft.items, true, '아이템'),
    statuses: toRequestSettings(draft.statuses, true, '상태'),
  };
}

function isUnchangedSetting(previous: CharacterSettingResponse | undefined, draft: DraftSetting): boolean {
  if (!previous || previous.key !== draft.key || (previous.valueType ?? 'STRING') !== draft.valueType) {
    return false;
  }
  if ((previous.displayName ?? previous.key ?? '설정').trim() !== draft.displayName.trim()) return false;
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
    const contentChanged = hasSettingContentChanged(item);
    const patternEdited = item.attributeNameEditable;
    const manualOrCustomEdited = !item.attributeNameEditable && item.displayNameEditable;
    const properties = (patternEdited || manualOrCustomEdited) && contentChanged
      ? toNameOnlyProperties(item)
      : item.properties;
    return {
      characterFactId: item.characterFactId ?? `demo-fact-${item.key}`,
      key: item.key,
      displayName: item.displayName,
      value: nullable(item.value),
      valueType: item.valueType,
      properties,
      hasEvidence: isUnchangedSetting(previousItem, item)
        ? previousItem?.hasEvidence ?? false
        : false,
      attributeNameEditable: item.attributeNameEditable,
      attributeNamePrefix: item.attributeNamePrefix,
      displayNameEditable: item.displayNameEditable,
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
  const orderedSettings = orderManualSettingsLast(settings);
  return (
    <div className={`character-simple-settings character-setting-columns-${columns}`} style={{ display: 'grid', gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}>
      {orderedSettings.map((item, index) => (
        <div className="character-setting-row" key={item.characterFactId ?? item.key ?? index} style={{
          minHeight: 40, padding: '8px 14px', display: 'grid',
          gridTemplateColumns: columns === 2 ? '80px minmax(0, 1fr) auto' : '110px minmax(0, 1fr) auto',
          alignItems: 'center', gap: 10,
          borderRight: columns === 2 && index % 2 === 0 ? `1px solid ${C.border}` : 'none',
          borderBottom: Math.floor(index / columns) < Math.ceil(orderedSettings.length / columns) - 1
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
    <div className={`character-edit-settings character-setting-columns-${columns}`} style={{
      display: 'grid',
      gridTemplateColumns: columns === 2 ? 'repeat(2, minmax(0, 1fr))' : 'minmax(0, 1fr)',
      gap: complex ? 8 : 0,
    }}>
      {settings.length === 0 && <div style={{ gridColumn: '1 / -1' }}><EmptyArea label={emptyLabel} /></div>}
      {settings.map((item, index) => {
        const dynamicNameEditable = item.attributeNameEditable && Boolean(item.attributeNamePrefix);
        const editableName = dynamicNameEditable || item.displayNameEditable;
        return (
          <div className={`character-edit-setting-row${complex ? ' character-edit-setting-row--complex' : ''}`} key={item.draftId} style={{
            display: 'grid',
            gridTemplateColumns: complex
              ? 'minmax(120px, 1fr) minmax(100px, 0.7fr) auto'
              : dynamicNameEditable
                ? columns === 2
                  ? '135px minmax(0, 1fr) auto'
                  : '160px minmax(0, 1fr) auto'
                : columns === 2
                  ? '80px minmax(0, 1fr) auto'
                  : '110px minmax(0, 1fr) auto',
            minWidth: 0,
            gap: 8, alignItems: 'center', padding: complex ? 8 : '7px 12px',
            border: complex ? `1px solid ${C.border}` : 'none',
            borderRight: !complex && columns === 2 && index % 2 === 0 ? `1px solid ${C.border}` : undefined,
            borderBottom: !complex
              && Math.floor(index / columns) < Math.ceil(settings.length / columns) - 1
              ? `1px solid ${C.border}`
              : undefined,
            borderRadius: complex ? 7 : 0,
          }}>
            {dynamicNameEditable ? (
              <div style={{ display: 'flex', minWidth: 0 }}>
                <span
                  title={item.attributeNamePrefix ?? undefined}
                  style={{
                    minHeight: 36,
                    padding: '0 9px',
                    borderRadius: '6px 0 0 6px',
                    border: `1px solid ${C.border}`,
                    borderRight: 'none',
                    background: C.bg,
                    color: C.t3,
                    display: 'inline-flex',
                    alignItems: 'center',
                    flexShrink: 0,
                    whiteSpace: 'nowrap',
                    fontSize: 11,
                  }}
                >
                  {SETTING_GROUP_LABELS[group]}
                </span>
                <input
                  aria-label={`${emptyLabel} 이름`}
                  value={item.displayName}
                  onChange={event => {
                    const displayName = event.target.value;
                    const prefix = item.attributeNamePrefix ?? '';
                    const revertedToInitialName = displayName.trim() === item.initialDisplayName?.trim();
                    onChange(index, {
                      ...item,
                      key: revertedToInitialName && item.initialKey
                        ? item.initialKey
                        : `${prefix}${normalizeDynamicSuffix(displayName)}`,
                      displayName,
                    });
                  }}
                  style={{
                    ...inputStyle,
                    minWidth: 0,
                    borderRadius: '0 6px 6px 0',
                  }}
                />
              </div>
            ) : editableName ? (
              <input
                aria-label={`${emptyLabel} 이름`}
                value={item.displayName}
                onChange={event => {
                  const displayName = event.target.value;
                  onChange(index, {
                    ...item,
                    displayName,
                  });
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

function ArchivedCharactersLayer({
  characters,
  loading,
  error,
  page,
  totalPages,
  restoringCharacterId,
  onClose,
  onRetry,
  onRestore,
  onPageChange,
}: {
  characters: CharacterSummaryResponse[];
  loading: boolean;
  error: string | null;
  page: number;
  totalPages: number;
  restoringCharacterId: string | null;
  onClose: () => void;
  onRetry: () => void;
  onRestore: (characterId: string) => void;
  onPageChange: (page: number) => void;
}) {
  const restoring = restoringCharacterId !== null;
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      data-testid="character-archive-backdrop"
      onClick={() => {
        if (!restoring) onClose();
      }}
      style={{
        position: 'fixed', inset: 0, zIndex: 210, padding: '48px 20px',
        background: 'rgba(0,0,0,0.72)', display: 'flex', alignItems: 'flex-start',
        justifyContent: 'center', overflowY: 'auto',
      }}
    >
      <motion.div
        role="dialog"
        aria-label="보관된 캐릭터"
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        onClick={event => event.stopPropagation()}
        style={{
          width: 680, maxWidth: 'calc(100vw - 40px)', borderRadius: 12,
          background: C.surface, border: `1px solid ${C.border}`,
          boxShadow: '0 24px 70px rgba(0,0,0,0.58)', overflow: 'hidden',
        }}
      >
        <div style={{
          padding: '20px 24px', borderBottom: `1px solid ${C.border}`,
          display: 'flex', alignItems: 'center', gap: 12,
        }}>
          <div style={{
            width: 38, height: 38, borderRadius: 9, background: C.primary + '18',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Archive size={18} color={C.primary} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ color: C.t1, fontSize: 17, fontWeight: 700 }}>보관된 캐릭터</div>
            <div style={{ color: C.t3, fontSize: 11, marginTop: 3 }}>
              삭제한 캐릭터를 설정 이력과 원문 근거 그대로 복구할 수 있습니다.
            </div>
          </div>
          <button
            type="button"
            aria-label="보관함 닫기"
            onClick={onClose}
            disabled={restoring}
            style={{
              background: 'none', border: 'none', color: C.t3,
              cursor: restoring ? 'default' : 'pointer', padding: 5, lineHeight: 0,
            }}
          >
            <X size={19} />
          </button>
        </div>

        <div style={{ padding: 24, minHeight: 250 }}>
          {loading && (
            <div style={{ height: 210, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, color: C.t3, fontSize: 13 }}>
              <Loader2 size={18} className="spin" /> 보관된 캐릭터를 불러오는 중입니다.
            </div>
          )}

          {!loading && error && characters.length === 0 && (
            <div role="alert" style={{ height: 210, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, color: C.t3, fontSize: 13 }}>
              <AlertCircle size={24} color={C.danger} />
              <span>{error}</span>
              <ModalButton onClick={onRetry}><RefreshCw size={13} /> 다시 시도</ModalButton>
            </div>
          )}

          {!loading && !error && characters.length === 0 && (
            <div style={{ height: 210, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
              <Archive size={28} color={C.t3} />
              <strong style={{ color: C.t1, fontSize: 15 }}>보관된 캐릭터가 없습니다</strong>
              <span style={{ color: C.t3, fontSize: 12 }}>삭제한 캐릭터가 이곳에 표시됩니다.</span>
            </div>
          )}

          {!loading && characters.length > 0 && (
            <>
              {error && (
                <div role="alert" style={{ marginBottom: 12, padding: '10px 12px', borderRadius: 7, background: C.danger + '12', border: `1px solid ${C.danger}44`, color: C.danger, fontSize: 12 }}>
                  {error}
                </div>
              )}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {characters.map(character => (
                  <div
                    key={character.id}
                    style={{
                      minHeight: 70, padding: '12px 14px', borderRadius: 8,
                      border: `1px solid ${C.border}`, background: C.bg,
                      display: 'flex', alignItems: 'center', gap: 12,
                    }}
                  >
                    <Avatar id={character.id ?? character.name ?? ''} name={character.name ?? ''} size={40} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ color: C.t1, fontSize: 13, fontWeight: 650 }}>{character.name}</div>
                      <div style={{ color: C.t3, fontSize: 11, marginTop: 4 }}>
                        나이 {character.currentAge == null ? '—' : `${character.currentAge}세`}
                        {' · '}
                        첫 등장 {character.firstAppearanceEpisodeNo == null ? '—' : `${character.firstAppearanceEpisodeNo}화`}
                      </div>
                    </div>
                    <ModalButton
                      primary
                      disabled={restoring}
                      onClick={() => character.id && onRestore(character.id)}
                    >
                      {restoringCharacterId === character.id && <Loader2 size={13} className="spin" />}
                      복구
                    </ModalButton>
                  </div>
                ))}
              </div>
              <div style={{ marginTop: 16 }}>
                <PageNavigation
                  page={page}
                  totalPages={totalPages}
                  disabled={restoring}
                  onPageChange={onPageChange}
                />
              </div>
            </>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}

export function CharacterDatabase({
  workId,
  selectedCharacterId,
  selectedEvidenceFactId,
  isEditing,
  demoMode,
  archiveOpen,
  demoCharacters,
  demoArchivedCharacters,
  setDemoCharacters,
  setDemoArchivedCharacters,
  onOpen,
  onClose,
  onEvidenceOpen,
  onEvidenceClose,
  onArchiveOpen,
  onArchiveClose,
  onEditChange,
  onEditComplete,
  onAnalyze,
}: Props) {
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState<CharacterDraft | null>(null);
  const [confirming, setConfirming] = useState<'delete' | 'save' | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [firstVisibleIndex, setFirstVisibleIndex] = useState(0);
  const [archivePage, setArchivePage] = useState(0);
  const [archiveError, setArchiveError] = useState<string | null>(null);
  const [restoringCharacterId, setRestoringCharacterId] = useState<string | null>(null);
  const draftCharacterIdRef = useRef<string | null>(null);
  const currentViewRef = useRef({
    workId,
    selectedCharacterId,
    archiveOpen,
    restoringCharacterId,
  });
  currentViewRef.current = {
    workId,
    selectedCharacterId,
    archiveOpen,
    restoringCharacterId,
  };
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
    mobilePageSize: 6,
  });
  const page = Math.floor(firstVisibleIndex / pageSize);

  const charactersQuery = useQuery({
    ...getCharactersOptions({ path: { workId }, query: { page, size: pageSize } }),
    enabled: !demoMode && Boolean(workId) && layoutReady,
  });
  const detailQuery = useQuery({
    ...getCharacterOptions({ path: { workId, characterId: selectedCharacterId ?? '' } }),
    enabled: !demoMode && Boolean(workId) && Boolean(selectedCharacterId),
    retry: (failureCount, error) => (
      toApiError(error)?.status !== 404
      && shouldRetryQuery(failureCount, error, 3)
    ),
  });
  const evidenceQuery = useQuery({
    ...getCharacterFactEvidenceOptions({
      path: {
        workId,
        characterFactId: selectedEvidenceFactId ?? '',
      },
    }),
    enabled: !demoMode && Boolean(workId) && Boolean(selectedEvidenceFactId),
    retry: (failureCount, error) => (
      toApiError(error)?.status !== 404
      && shouldRetryQuery(failureCount, error, 3)
    ),
  });
  const archivedCharactersQuery = useQuery({
    ...getArchivedCharactersOptions({
      path: { workId },
      query: { page: archivePage, size: ARCHIVE_PAGE_SIZE },
    }),
    enabled: !demoMode && Boolean(workId) && archiveOpen,
  });

  const updateMutation = useMutation({
    ...updateCharacterMutation(),
    onSuccess: async (response, variables) => {
      const targetWorkId = variables.path.workId;
      const targetCharacterId = variables.path.characterId;
      queryClient.setQueryData(
        getCharacterQueryKey({
          path: { workId: targetWorkId, characterId: targetCharacterId },
        }),
        response,
      );
      await queryClient.invalidateQueries({
        queryKey: getCharactersQueryKey({ path: { workId: targetWorkId } }),
      });
      if (workId !== targetWorkId || selectedCharacterId !== targetCharacterId) return;
      setConfirming(null);
      setActionError(null);
      setFeedback('캐릭터 설정을 저장했습니다.');
      onEditComplete();
    },
    onError: (error, variables) => {
      if (
        workId !== variables.path.workId
        || selectedCharacterId !== variables.path.characterId
      ) return;
      setConfirming(null);
      setActionError(errorMessage(error, '캐릭터 설정을 저장하지 못했습니다.'));
    },
  });

  const deleteMutation = useMutation({
    ...deleteCharacterMutation(),
    onSuccess: async (_, variables) => {
      const targetWorkId = variables.path.workId;
      const targetCharacterId = variables.path.characterId;
      // ACTIVE 전용 상세 캐시가 뒤로가기로 보관 캐릭터를 다시 노출하지 않게 제거한다.
      queryClient.removeQueries({
        queryKey: getCharacterQueryKey({
          path: { workId: targetWorkId, characterId: targetCharacterId },
        }),
        exact: true,
      });
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: getCharactersQueryKey({ path: { workId: targetWorkId } }),
        }),
        queryClient.invalidateQueries({
          queryKey: getArchivedCharactersQueryKey({ path: { workId: targetWorkId } }),
        }),
      ]);
      const currentView = currentViewRef.current;
      if (
        currentView.workId !== targetWorkId
        || currentView.selectedCharacterId !== targetCharacterId
      ) return;
      setConfirming(null);
      setFeedback('캐릭터를 삭제했습니다. 보관함에서 복구할 수 있습니다.');
      onClose();
    },
    onError: (error, variables) => {
      const currentView = currentViewRef.current;
      if (
        currentView.workId !== variables.path.workId
        || currentView.selectedCharacterId !== variables.path.characterId
      ) return;
      setConfirming(null);
      setActionError(errorMessage(error, '캐릭터를 보관하지 못했습니다.'));
    },
  });

  const restoreMutation = useMutation({
    ...restoreCharacterMutation(),
    onSuccess: async (_, variables) => {
      const targetWorkId = variables.path.workId;
      const targetCharacterId = variables.path.characterId;
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: getCharactersQueryKey({ path: { workId: targetWorkId } }),
        }),
        queryClient.invalidateQueries({
          queryKey: getArchivedCharactersQueryKey({ path: { workId: targetWorkId } }),
        }),
      ]);
      const currentView = currentViewRef.current;
      if (
        currentView.workId !== targetWorkId
        || !currentView.archiveOpen
        || currentView.restoringCharacterId !== targetCharacterId
      ) return;
      setArchiveError(null);
      setFeedback('캐릭터를 복구했습니다.');
    },
    onError: (error, variables) => {
      const currentView = currentViewRef.current;
      if (
        currentView.workId !== variables.path.workId
        || !currentView.archiveOpen
        || currentView.restoringCharacterId !== variables.path.characterId
      ) return;
      setArchiveError(errorMessage(error, '캐릭터를 복구하지 못했습니다.'));
    },
    onSettled: (_, __, variables) => {
      const currentView = currentViewRef.current;
      if (
        currentView.workId !== variables.path.workId
        || currentView.restoringCharacterId !== variables.path.characterId
      ) return;
      setRestoringCharacterId(null);
    },
  });

  const demoDetail = demoCharacters.find(character => character.id === selectedCharacterId);
  const detail = demoMode ? demoDetail : detailQuery.data?.data;
  const evidence = selectedEvidenceFactId
    ? demoMode
      ? getDemoCharacterEvidence(selectedEvidenceFactId)
      : evidenceQuery.data?.data ?? null
    : null;
  const demoSummaries = useMemo(() => demoCharacters.map(toSummary), [demoCharacters]);
  const characterPage = charactersQuery.data?.data;
  const hasCharacterPage = characterPage !== undefined;
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
  const demoArchivedSummaries = useMemo(
    () => demoArchivedCharacters.map(toSummary),
    [demoArchivedCharacters],
  );
  const archivedCharacterPage = archivedCharactersQuery.data?.data;
  const archivedCharacters = demoMode
    ? demoArchivedSummaries.slice(
      archivePage * ARCHIVE_PAGE_SIZE,
      (archivePage + 1) * ARCHIVE_PAGE_SIZE,
    )
    : archivedCharacterPage?.content ?? [];
  const archivedTotalPages = demoMode
    ? Math.ceil(demoArchivedSummaries.length / ARCHIVE_PAGE_SIZE)
    : archivedCharacterPage?.totalPages ?? 0;

  useEffect(() => {
    setFirstVisibleIndex(0);
    setRestoringCharacterId(null);
    setArchiveError(null);
  }, [demoMode, workId]);

  useEffect(() => {
    const pageMetadataReady = demoMode || hasCharacterPage;
    if (!pageMetadataReady) return;
    if (totalPages === 0 && firstVisibleIndex !== 0) {
      setFirstVisibleIndex(0);
    } else if (totalPages > 0 && page >= totalPages) {
      setFirstVisibleIndex((totalPages - 1) * pageSize);
    }
  }, [
    demoMode,
    firstVisibleIndex,
    hasCharacterPage,
    page,
    pageSize,
    totalPages,
  ]);

  useEffect(() => {
    setConfirming(null);
  }, [selectedCharacterId]);

  useEffect(() => {
    if (!isEditing) {
      setDraft(null);
      draftCharacterIdRef.current = null;
      setActionError(null);
      return;
    }
    if (!detail || !selectedCharacterId || draftCharacterIdRef.current === selectedCharacterId) {
      return;
    }
    setDraft(toDraft(detail));
    draftCharacterIdRef.current = selectedCharacterId;
    setActionError(null);
  }, [detail, isEditing, selectedCharacterId]);

  useEffect(() => {
    if (!archiveOpen) {
      setArchivePage(0);
      setArchiveError(null);
      return;
    }
    // 다음 페이지 응답을 기다리는 동안 totalPages가 잠시 0이 되어 첫 페이지로 되돌아가지 않게 한다.
    const pageMetadataReady = demoMode || archivedCharactersQuery.isSuccess;
    if (!pageMetadataReady) return;
    if (archivedTotalPages === 0 && archivePage !== 0) {
      setArchivePage(0);
    } else if (archivedTotalPages > 0 && archivePage >= archivedTotalPages) {
      setArchivePage(archivedTotalPages - 1);
    }
  }, [
    archiveOpen,
    archivePage,
    archivedCharactersQuery.isSuccess,
    archivedTotalPages,
    demoMode,
  ]);

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
    const label = group === 'profile' ? '새 프로필' : '새 스탯';
    const prefix = SETTING_GROUP_PREFIXES[group];
    setDraft(current => current ? {
      ...current,
      [group]: [...current[group], {
        draftId: createDraftSettingId(),
        key: `${prefix}${normalizeDynamicSuffix(label)}`,
        displayName: label,
        value: '',
        valueType: group === 'stats' ? 'NUMBER' : 'STRING',
        properties: [{ key: 'name', displayName: '이름', value: label, valueType: 'STRING' }],
        hasEvidence: false,
        attributeNameEditable: true,
        attributeNamePrefix: prefix,
        displayNameEditable: true,
        initialKey: null,
        initialDisplayName: null,
        initialValue: null,
      }],
    } : current);
  };

  const addComplexSetting = (group: 'skills' | 'items' | 'statuses') => {
    const label = group === 'skills' ? '새 스킬' : group === 'items' ? '새 아이템' : '새 상태';
    const prefix = SETTING_GROUP_PREFIXES[group];
    setDraft(current => current ? {
      ...current,
      [group]: [...current[group], {
        draftId: createDraftSettingId(),
        key: `${prefix}${normalizeDynamicSuffix(label)}`,
        displayName: label,
        value: label,
        valueType: 'JSON',
        properties: [{ key: 'name', displayName: '이름', value: label, valueType: 'STRING' }],
        hasEvidence: false,
        attributeNameEditable: true,
        attributeNamePrefix: prefix,
        displayNameEditable: true,
        initialKey: null,
        initialDisplayName: null,
        initialValue: null,
      }],
    } : current);
  };

  const save = () => {
    if (!draft || !selectedCharacterId || !detail) return;
    try {
      const body = toRequest(draft);
      if (demoMode) {
        const nextCharacters = demoCharacters.map(character => (
          character.id === selectedCharacterId ? draftToDemoDetail(character, draft) : character
        ));
        setDemoCharacters(nextCharacters);
        saveDemoCharacterState(workId, nextCharacters, demoArchivedCharacters);
        setConfirming(null);
        setActionError(null);
        setFeedback('캐릭터 설정을 저장했습니다.');
        onEditComplete();
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
      const archivedCharacter = demoCharacters.find(character => character.id === selectedCharacterId);
      if (!archivedCharacter) return;
      const nextCharacters = demoCharacters.filter(character => character.id !== selectedCharacterId);
      const nextArchivedCharacters = [archivedCharacter, ...demoArchivedCharacters];
      setDemoCharacters(nextCharacters);
      setDemoArchivedCharacters(nextArchivedCharacters);
      saveDemoCharacterState(workId, nextCharacters, nextArchivedCharacters);
      setConfirming(null);
      setFeedback('캐릭터를 삭제했습니다. 보관함에서 복구할 수 있습니다.');
      onClose();
      return;
    }
    deleteMutation.mutate({ path: { workId, characterId: selectedCharacterId } });
  };

  const restore = (characterId: string) => {
    setArchiveError(null);
    setRestoringCharacterId(characterId);
    if (demoMode) {
      const restoredCharacter = demoArchivedCharacters.find(character => character.id === characterId);
      if (!restoredCharacter) {
        setRestoringCharacterId(null);
        setArchiveError('복구할 캐릭터를 찾을 수 없습니다.');
        return;
      }
      const nextArchivedCharacters = demoArchivedCharacters.filter(character => character.id !== characterId);
      const nextCharacters = [restoredCharacter, ...demoCharacters];
      setDemoArchivedCharacters(nextArchivedCharacters);
      setDemoCharacters(nextCharacters);
      saveDemoCharacterState(workId, nextCharacters, nextArchivedCharacters);
      setRestoringCharacterId(null);
      setFeedback('캐릭터를 복구했습니다.');
      return;
    }
    restoreMutation.mutate({ path: { workId, characterId } });
  };

  const loadingList = !demoMode && (!layoutReady || charactersQuery.isPending);
  const listError = !demoMode && charactersQuery.isLoadingError;
  const listRefetchError = !demoMode && charactersQuery.isRefetchError && hasCharacterPage;
  const mutationPending = updateMutation.isPending || deleteMutation.isPending || restoreMutation.isPending;
  const closeDetail = () => {
    if (mutationPending) return;
    setConfirming(null);
    onClose();
  };

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
        <div className="character-database-header" style={{ marginBottom: 24, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
          <div className="character-database-heading">
            <h2 style={{ color: C.t1, fontSize: 19, margin: '0 0 7px' }}>캐릭터 DB</h2>
            <p style={{ color: C.t3, fontSize: 13, margin: 0 }}>
              캐릭터 카드를 선택하면 현재 설정과 원문 근거를 확인할 수 있습니다.
            </p>
          </div>
          <div className="character-archive-action">
            <ModalButton onClick={onArchiveOpen}><Archive size={14} /> 보관된 캐릭터</ModalButton>
          </div>
        </div>

        <div ref={contentStartRef} />

        {listRefetchError && (
          <div role="alert" style={{ padding: '10px 13px', marginBottom: 14, borderRadius: 7, background: C.danger + '12', border: `1px solid ${C.danger}44`, color: C.danger, fontSize: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
            <AlertCircle size={14} />
            <span style={{ flex: 1 }}>{errorMessage(charactersQuery.error, '캐릭터 목록을 새로고침하지 못했습니다.')}</span>
            <button type="button" onClick={() => charactersQuery.refetch()} style={{ background: 'none', border: 'none', color: C.danger, cursor: 'pointer', padding: 0, fontSize: 12 }}>
              다시 시도
            </button>
          </div>
        )}

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
                  onClick={() => character.id && onOpen(character.id, false)}
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

      {archiveOpen && (
        <ArchivedCharactersLayer
          characters={archivedCharacters}
          loading={!demoMode && archivedCharactersQuery.isPending}
          error={archiveError ?? (
            !demoMode && archivedCharactersQuery.isError
              ? errorMessage(archivedCharactersQuery.error, '보관된 캐릭터를 불러오지 못했습니다.')
              : null
          )}
          page={archivePage}
          totalPages={archivedTotalPages}
          restoringCharacterId={restoringCharacterId}
          onClose={onArchiveClose}
          onRetry={() => {
            setArchiveError(null);
            void archivedCharactersQuery.refetch();
          }}
          onRestore={restore}
          onPageChange={setArchivePage}
        />
      )}

      {selectedCharacterId && (
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          data-testid="character-modal-backdrop"
          onClick={closeDetail}
          className="character-detail-backdrop"
          style={{ position: 'fixed', inset: 0, zIndex: 200, padding: '36px 20px', overflowY: 'auto', background: 'rgba(0,0,0,0.72)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center' }}
        >
          <motion.div
            initial={{ y: 24, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
            onClick={event => event.stopPropagation()}
            className={`character-detail-modal${selectedEvidenceFactId ? ' character-detail-modal--with-evidence' : ''}${isEditing ? ' character-detail-modal--editing' : ''}`}
            style={{ width: selectedEvidenceFactId ? 1640 : 1000, maxWidth: 'calc(100vw - 40px)', minHeight: 420, position: 'relative', borderRadius: 12, background: C.surface, border: `1px solid ${C.border}`, boxShadow: '0 24px 70px rgba(0,0,0,0.58)', overflow: 'hidden' }}
          >
            {confirming && (
              <ConfirmLayer
                kind={confirming}
                busy={updateMutation.isPending || deleteMutation.isPending}
                onCancel={() => setConfirming(null)}
                onConfirm={confirming === 'save' ? save : archive}
              />
            )}

            {selectedEvidenceFactId && (
              <CharacterEvidencePanel
                evidence={evidence}
                loading={!demoMode && evidenceQuery.isPending}
                error={!demoMode && evidenceQuery.isError
                  ? errorMessage(evidenceQuery.error, '원문 근거를 불러오지 못했습니다.')
                  : null}
                onRetry={() => {
                  if (!demoMode) void evidenceQuery.refetch();
                }}
                onClose={onEvidenceClose}
              />
            )}

            <div style={{ minWidth: 0 }}>
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
                  <ModalButton onClick={closeDetail}>닫기</ModalButton>
                </div>
              </div>
            )}

            {detail && (demoMode || (!detailQuery.isPending && !detailQuery.isError)) && (
              <>
                <div className="character-detail-header" style={{ padding: '22px 28px', borderBottom: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', gap: 14 }}>
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
                  <button type="button" aria-label="닫기" onClick={closeDetail} style={{ background: 'none', border: 'none', color: C.t3, cursor: 'pointer', padding: 5, lineHeight: 0 }}>
                    <X size={19} />
                  </button>
                </div>

                <div className="character-detail-body" style={{ padding: '22px 28px 26px', maxHeight: 'calc(100dvh - 190px)', overflowY: 'auto' }}>
                  {actionError && (
                    <div role="alert" style={{ padding: '10px 13px', marginBottom: 14, borderRadius: 7, background: C.danger + '12', border: `1px solid ${C.danger}44`, color: C.danger, fontSize: 12 }}>
                      {actionError}
                    </div>
                  )}

                  <SectionTitle>기본 정보</SectionTitle>
                  <div className="character-basic-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(5, minmax(0, 1fr))', borderRadius: 8, border: `1px solid ${C.border}`, overflow: 'hidden', background: C.bg, marginBottom: 20 }}>
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
                              onClick={() => factReference?.characterFactId && onEvidenceOpen(factReference.characterFactId)}
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
                              onClick={() => factReference?.characterFactId && onEvidenceOpen(factReference.characterFactId)}
                            />
                          </div>
                          <div style={{ color: C.t1, fontSize: 13, fontWeight: 600 }}>{value}</div>
                        </div>
                      ))
                    )}
                  </div>

                  <div
                    data-testid="character-detail-sections"
                    style={{ display: 'flex', flexWrap: 'wrap', gap: 18, alignItems: 'flex-start' }}
                  >
                    <div data-testid="character-profile-section" style={{ flex: '0.9 1 280px', minWidth: 0 }}>
                      <SectionTitle>프로필</SectionTitle>
                      <div style={{ borderRadius: 8, border: `1px solid ${C.border}`, background: C.bg, overflow: 'hidden' }}>
                        {isEditing && draft
                          ? <EditSettingList settings={draft.profile} group="profile" emptyLabel="프로필" onChange={(index, value) => changeSetting('profile', index, value)} onRemove={index => removeSetting('profile', index)} onAdd={() => addSimpleSetting('profile')} onEvidence={onEvidenceOpen} />
                          : <SimpleSettingList settings={detail.profile ?? []} emptyLabel="프로필" onEvidence={onEvidenceOpen} />}
                      </div>
                    </div>

                    <div data-testid="character-setting-sections" style={{ display: 'flex', flex: '1.35 1 420px', minWidth: 0, flexDirection: 'column', gap: 14 }}>
                      <div>
                        <SectionTitle>스탯</SectionTitle>
                        <div style={{ borderRadius: 8, border: `1px solid ${C.border}`, background: C.bg, overflow: 'hidden' }}>
                          {isEditing && draft
                            ? <EditSettingList settings={draft.stats} group="stats" emptyLabel="스탯" columns={2} onChange={(index, value) => changeSetting('stats', index, value)} onRemove={index => removeSetting('stats', index)} onAdd={() => addSimpleSetting('stats')} onEvidence={onEvidenceOpen} />
                            : <SimpleSettingList settings={detail.stats ?? []} emptyLabel="스탯" columns={2} onEvidence={onEvidenceOpen} />}
                        </div>
                      </div>

                      <div
                        className="character-skill-item-sections"
                        data-testid="character-skill-item-sections"
                        style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}
                      >
                        <div data-testid="character-skill-section" style={{ flex: '1 1 220px', minWidth: 0 }}>
                          <SectionTitle>스킬</SectionTitle>
                          <div style={{ borderRadius: 8, border: `1px solid ${C.border}`, background: C.bg, overflow: 'hidden' }}>
                            {isEditing && draft
                              ? <EditSettingList settings={draft.skills} group="skills" emptyLabel="스킬" complex onChange={(index, value) => changeSetting('skills', index, value)} onRemove={index => removeSetting('skills', index)} onAdd={() => addComplexSetting('skills')} onEvidence={onEvidenceOpen} />
                              : <SimpleSettingList settings={detail.skills ?? []} emptyLabel="스킬" onEvidence={onEvidenceOpen} />}
                          </div>
                        </div>
                        <div data-testid="character-item-section" style={{ flex: '1 1 220px', minWidth: 0 }}>
                          <SectionTitle>아이템</SectionTitle>
                          <div style={{ borderRadius: 8, border: `1px solid ${C.border}`, background: C.bg, overflow: 'hidden' }}>
                            {isEditing && draft
                              ? <EditSettingList settings={draft.items} group="items" emptyLabel="아이템" complex onChange={(index, value) => changeSetting('items', index, value)} onRemove={index => removeSetting('items', index)} onAdd={() => addComplexSetting('items')} onEvidence={onEvidenceOpen} />
                              : <SimpleSettingList settings={detail.items ?? []} emptyLabel="아이템" onEvidence={onEvidenceOpen} />}
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
                            ? <EditSettingList settings={draft.statuses} group="statuses" emptyLabel="상태" complex columns={2} onChange={(index, value) => changeSetting('statuses', index, value)} onRemove={index => removeSetting('statuses', index)} onAdd={() => addComplexSetting('statuses')} onEvidence={onEvidenceOpen} />
                            : <SimpleSettingList settings={detail.statuses ?? []} emptyLabel="상태" columns={2} onEvidence={onEvidenceOpen} />}
                        </div>
                      </div>
                    </div>
                  </div>

                  {isEditing && (
                    <div className="character-detail-actions" style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 22 }}>
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
            </div>
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
