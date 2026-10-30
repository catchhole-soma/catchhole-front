import { toApiError } from '../../../lib/api-errors';
import { CHARACTER_FACT_TYPE_LABELS, type CharacterFactTypeLabels } from '../../../lib/character-setting-labels';
import { isUnidentifiedCharacterName } from '../../../lib/setting-review-groups';
import type { CharacterDetailResponse, SettingCandidateResponse } from '../../../api/generated/types.gen';
import { C } from '../constants';
import { REVIEW_TEXT } from '../review-v2-colors';

export function settingTypeLabels(labels: CharacterFactTypeLabels): Record<string, string> {
  return {
    age: '나이/레벨',
    level: '나이/레벨',
    profile: '프로필',
    stats: labels.STAT,
    skill: labels.SKILL,
    skills: labels.SKILL,
    item: labels.ITEM,
    items: labels.ITEM,
    status: '상태',
    statuses: '상태',
    time: '시간/사건',
  };
}
const SETTING_NAME_LABELS: Record<string, string> = {
  age: '나이',
  level: '레벨',
  profile: '프로필',
  'profile.gender': '성별',
  'profile.species': '종족',
  'profile.affiliation': '소속',
  'profile.occupation': '직업',
  'profile.eye_color': '눈 색깔',
  'profile.description': '설명',
  'profile.attribute': '특징',
  'stats.strength': '근력',
  'stats.mana': '마나',
  'stats.physique': '육체',
  'stats.mental': '정신',
  'stats.supernatural': '이능',
  'stats.item_level': '아이템 레벨',
  'stats.combat_power': '전투지수',
  'stats.agility': '민첩성',
  'stats.endurance': '지구력',
  'stats.soul_power': '영혼력',
  'stats.magic_resistance': '항마력',
  'stats.physical_resistance': '물리내성',
  'stats.natural_regeneration': '자연재생력',
  'stats.bone_strength': '골강도',
  'stats.energy': '기력',
  'stats.perception': '인지력',
  'stats.mental_power': '정신력',
  'statuses.condition': '상태',
  'skills.skill': CHARACTER_FACT_TYPE_LABELS.SKILL,
  'items.item': CHARACTER_FACT_TYPE_LABELS.ITEM,
};
const DECIMAL_VALUE_PATTERN = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/;

export interface SettingDisplay {
  typeLabel: string;
  nameLabel: string;
}

/**
 * 저장용 attributeName은 유지하고, 목록과 상세에서 사용할 사용자용 문구만 만든다.
 */
export function toSettingDisplay(
  attributeName?: string | null,
  attributeDisplayName?: string | null,
  labels: CharacterFactTypeLabels = CHARACTER_FACT_TYPE_LABELS,
): SettingDisplay {
  const normalized = attributeName?.trim();
  if (!normalized) return { typeLabel: '설정', nameLabel: '설정명 없음' };

  const [prefix, ...suffixParts] = normalized.split('.');
  const suffix = suffixParts.join('.');
  return {
    typeLabel: settingTypeLabels(labels)[prefix] ?? '기타',
    nameLabel: attributeDisplayName?.trim() || ((normalized === 'skills.skill' ? labels.SKILL : SETTING_NAME_LABELS[normalized])
      ?? (suffix ? suffix.replace(/_/g, ' ') : normalized.replace(/_/g, ' '))),
  };
}

export function validateCandidateDisplayValue(
  valueType: SettingCandidateResponse['valueType'],
  value: string,
): string | null {
  const normalized = value.trim();
  if (valueType === 'NUMBER' && !DECIMAL_VALUE_PATTERN.test(normalized)) {
    return '숫자 설정값은 숫자만 입력해 주세요. (예: 36, -1.5)';
  }
  if (valueType === 'BOOLEAN' && normalized !== 'true' && normalized !== 'false') {
    return '참/거짓 설정값은 true 또는 false로 입력해 주세요.';
  }
  return null;
}

export function splitDynamicSettingName(attributeName: string, dynamicPrefix?: string | null): {
  prefix: string;
  suffix: string;
} {
  const normalized = attributeName.trim();
  if (dynamicPrefix && normalized.startsWith(dynamicPrefix)) {
    return {
      prefix: dynamicPrefix,
      suffix: normalized.slice(dynamicPrefix.length).replace(/_/g, ' '),
    };
  }
  const separatorIndex = normalized.indexOf('.');
  if (separatorIndex < 0) return { prefix: `${normalized}.`, suffix: '' };
  return {
    prefix: normalized.slice(0, separatorIndex + 1),
    suffix: normalized.slice(separatorIndex + 1).replace(/_/g, ' '),
  };
}

export function errorMessage(error: unknown, fallback: string): string {
  return toApiError(error)?.message ?? (error instanceof Error ? error.message : fallback);
}

export const modalInputStyle = {
  width: '100%',
  minHeight: 40,
  boxSizing: 'border-box' as const,
  borderRadius: 7,
  border: `1px solid ${C.border}`,
  background: C.bg,
  color: REVIEW_TEXT.ink,
  padding: '0 12px',
  fontFamily: 'inherit',
  fontSize: 13,
};

/** Backend `GET /characters`의 query 길이 상한과 같다. */
export const CHARACTER_SEARCH_MAX_LENGTH = 100;

/** 원문 표현을 인물 검색어로 쓸 수 있을 때만 돌려준다. `미상`·빈 값은 검색어가 아니다. */
export function mentionSearchText(candidate: SettingCandidateResponse): string {
  const mention = candidate.rawEntityMention?.trim() ?? '';
  return isUnidentifiedCharacterName(mention) ? '' : mention.slice(0, CHARACTER_SEARCH_MAX_LENGTH);
}

/**
 * 연결 미리보기에서 이 후보의 설정이 대상 인물에 이미 저장돼 있는지 찾는다. 서버 비교 결과가 아니라 상세 응답의 현재 값이다.
 * 후보 key는 서버가 해석한 canonical key → 비교 대상 key → 원래 설정명 순으로 쓰고, 찾지 못하면 표시명으로 한 번 더 찾는다.
 * 나이·레벨은 상세의 별도 필드에 있다. 값이 없으면 `null`(기존값 없음)이다.
 */
export function existingCharacterSettingValue(detail: CharacterDetailResponse, candidate: SettingCandidateResponse): string | null {
  const key = candidate.resolvedCanonicalFactKey ?? candidate.comparisonTargetFactKey ?? candidate.attributeName;
  if (key === 'age') return detail.currentAge == null ? null : String(detail.currentAge);
  if (key === 'level') return detail.currentLevel == null ? null : String(detail.currentLevel);
  const settings = [detail.profile, detail.stats, detail.skills, detail.items, detail.statuses].flatMap(list => list ?? []);
  const displayName = candidate.attributeDisplayName?.trim();
  const setting = settings.find(item => key && item.key === key)
    ?? (displayName ? settings.find(item => item.displayName?.trim() === displayName) : undefined);
  const value = setting?.value?.trim();
  return value ? value : null;
}

/** 후보 묶음의 회차를 `회차 1, 2` 형태로 줄인다. 설정집 출처는 `설정집`으로 묶는다. */
export function candidateEpisodesLabel(candidates: SettingCandidateResponse[]): string {
  const episodes = [...new Set(candidates.flatMap(candidate => {
    if (candidate.source?.sourceKind === 'SETTING_BOOK') return [];
    const number = candidate.source?.episodeNo ?? candidate.episodeNo;
    return number == null ? [] : [number];
  }))].sort((first, second) => first - second);
  const books = candidates.some(candidate => candidate.source?.sourceKind === 'SETTING_BOOK');
  return [episodes.length ? `회차 ${episodes.join(', ')}` : null, books ? '설정집' : null].filter(Boolean).join(' · ');
}
