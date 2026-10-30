/**
 * 설정 후보 검토 그룹의 순수 계산.
 *
 * 캐릭터 그룹 키는 Backend `SettingCandidateServiceImpl`의 규칙을 따른다. 기존 캐릭터에 연결된
 * 후보는 `existing:<characterId>`, 미연결 후보는 이름을 trim → 연속 공백 1칸 → 소문자로 정규화한
 * 값이다. 정규화 결과가 빈 문자열이거나 `미상`이면 서버도 인물을 확인하지 못한 후보로 보고 마지막에 둔다.
 */
interface GroupLike {
  groupKey?: string | null;
}

const UNIDENTIFIED_CHARACTER_NAMES = new Set(['', '미상']);

export function normalizeCharacterGroupName(name?: string | null): string {
  return (name ?? '').trim().replace(/\s+/g, ' ').toLocaleLowerCase();
}

/** 이름으로 인물을 특정하지 못한 후보인지 판단한다. 같은 묶음이어도 같은 인물이라는 뜻이 아니다. */
export function isUnidentifiedCharacterName(name?: string | null): boolean {
  return UNIDENTIFIED_CHARACTER_NAMES.has(normalizeCharacterGroupName(name));
}

export function isUnlinkedCandidateGroup(group: GroupLike & { entityName?: string | null }): boolean {
  return !(group.groupKey ?? '').startsWith('existing:') && isUnidentifiedCharacterName(group.entityName);
}

/**
 * 확정·연결로 사라진 그룹 다음에 검토할 그룹을 고른다.
 *
 * `previous`는 사라지기 직전 화면의 목록 순서, `current`는 서버에서 다시 받은 목록이다. 다음 우선순위로 고른다.
 * 1. 직전 목록에서 사라진 그룹보다 뒤에 있던 그룹 중 지금 남아 있는 첫 그룹(현재 목록 순서 기준).
 * 2. 없으면 직전 목록에 없던 그룹 중 현재 목록의 첫 그룹. 다음 페이지에서 당겨진 그룹이거나 연결로 새로 생긴
 *    `existing:<id>` 그룹이다. 새로 생긴 그룹이 원래 다음 차례였던 그룹을 앞지르지 않도록 1보다 뒤에 둔다.
 * 3. 없으면 현재 목록의 첫 그룹.
 * 4. 현재 목록이 비면 `null`(페이지 보정은 화면이 처리한다).
 */
export function nextGroupKeyAfter(
  previous: ReadonlyArray<GroupLike>,
  removedKey: string,
  current: ReadonlyArray<GroupLike>,
): string | null {
  const previousIndex = new Map<string, number>();
  previous.forEach((group, index) => {
    if (group.groupKey != null && !previousIndex.has(group.groupKey)) previousIndex.set(group.groupKey, index);
  });
  const removedIndex = previousIndex.get(removedKey);
  const remaining = current.filter((group): group is { groupKey: string } => (
    group.groupKey != null && group.groupKey !== removedKey
  ));
  if (removedIndex != null) {
    const following = remaining.find(group => (previousIndex.get(group.groupKey) ?? -1) > removedIndex);
    if (following) return following.groupKey;
  }
  const arrived = remaining.find(group => !previousIndex.has(group.groupKey));
  if (arrived) return arrived.groupKey;
  return remaining[0]?.groupKey ?? null;
}
