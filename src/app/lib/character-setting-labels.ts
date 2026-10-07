/** 캐릭터 분류의 화면 이름. 저장용 enum·설정 키와 작가가 붙인 이름은 바꾸지 않는다. */
export const CHARACTER_FACT_TYPE_LABELS = {
  PROFILE: '프로필',
  AGE: '나이',
  LEVEL: '레벨',
  STAT: '스탯',
  SKILL: '기술·특기',
  ITEM: '소지품',
  STATUS: '상태',
} as const;

export type CharacterFactTypeLabels = Readonly<Record<keyof typeof CHARACTER_FACT_TYPE_LABELS, string>>;

const FANTASY_LABELS: CharacterFactTypeLabels = { ...CHARACTER_FACT_TYPE_LABELS, SKILL: '스킬' };
const MARTIAL_ARTS_LABELS: CharacterFactTypeLabels = { ...CHARACTER_FACT_TYPE_LABELS, SKILL: '무공·기예' };

export function characterFactTypeLabels(genre?: string | null): CharacterFactTypeLabels {
  if (genre === '판타지') return FANTASY_LABELS;
  if (genre === '무협') return MARTIAL_ARTS_LABELS;
  return CHARACTER_FACT_TYPE_LABELS;
}

export function characterFactTypeLabel(
  factType?: string | null,
  fallback = '설정',
  labels: CharacterFactTypeLabels = CHARACTER_FACT_TYPE_LABELS,
): string {
  return factType && Object.prototype.hasOwnProperty.call(labels, factType)
    ? labels[factType as keyof CharacterFactTypeLabels]
    : fallback;
}
