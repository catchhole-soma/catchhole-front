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

/** 화면이 서버 `groupKey`가 빈 묶음에 붙이는 key의 접두사(URL에서 빈 문자열은 선택 없음과 구분되지 않는다). */
export const UNNAMED_GROUP_KEY_PREFIX = '__unnamed__:';
/**
 * 이름이 빈 미연결 묶음의 고정 key. 서버는 이름이 빈 후보를 `groupKey: ''` 하나로 묶으므로, 첫 후보 ID로 key를 만들면
 * 그 후보를 연결하는 순간 남은 묶음의 key가 바뀌어 다른 묶음처럼 보인다.
 */
export const UNNAMED_GROUP_KEY = `${UNNAMED_GROUP_KEY_PREFIX}blank`;

/**
 * URL의 묶음 key가 미연결 묶음(`미상`·이름 없음)인지. 묶음이 비어 목록에 없을 때도 key만으로 판단한다.
 * 이름 없는 묶음은 고정 key만 인정한다. 첫 후보 ID로 만들던 예전 key(`__unnamed__:<id>`)는 지금 목록의 key와 달라
 * 비었는지 판단할 수 없기 때문이다.
 */
export function isUnlinkedGroupKey(groupKey?: string | null): boolean {
  if (!groupKey) return false;
  if (groupKey.startsWith(UNNAMED_GROUP_KEY_PREFIX)) return groupKey === UNNAMED_GROUP_KEY;
  return !groupKey.startsWith('existing:') && isUnidentifiedCharacterName(groupKey);
}

type CandidateGroupLike = GroupLike & { candidates?: ReadonlyArray<{ id?: string | null; reviewStatus?: string | null }> | null };

/**
 * 미연결 묶음에서 연결·제외한 뒤 다시 받은 목록으로 그 묶음을 어떻게 보여 줄지 정한다. 미연결 묶음은 화면을 옮기지 않는다.
 * - `stay`: 지금 목록에 그 묶음의 미처리 후보가 남아 있다. 그대로 둔다.
 * - `done`: 미처리 후보가 남지 않았다(목록에서 사라졌거나 `전체` 필터에서 처리된 후보만 남았다). 그 자리에 완료 상태를 보인다.
 * - `find`: 지금 목록에는 없지만 직전 목록 기준으로 남은 후보가 있다. 연결로 생긴 인물 묶음이 앞에 끼어들어 다음
 *   페이지로 밀렸을 수 있으므로 다른 페이지에서 같은 key를 찾는다.
 *
 * `partialList`는 구버전 Backend의 후보 단위 페이지가 여러 쪽이라 지금 목록의 묶음이 일부만 담겼다는 뜻이다. 다른
 * 페이지에 같은 묶음의 대기 후보가 있을 수 있으므로 `done` 대신 `find`로 다른 페이지를 확인하게 한다.
 */
export function unlinkedGroupAfterChange(
  previous: ReadonlyArray<CandidateGroupLike>,
  groupKey: string,
  removedIds: ReadonlyArray<string>,
  current: ReadonlyArray<CandidateGroupLike>,
  { partialList = false }: { partialList?: boolean } = {},
): 'stay' | 'done' | 'find' {
  const listed = current.find(group => group.groupKey === groupKey);
  if (listed && hasPendingCandidate(listed)) return 'stay';
  if (partialList) return 'find';
  if (listed) return 'done';
  const removed = new Set(removedIds);
  const remaining = previous.find(group => group.groupKey === groupKey)?.candidates?.some(candidate => (
    candidate.reviewStatus === 'PENDING_REVIEW' && candidate.id != null && !removed.has(candidate.id)
  ));
  return remaining ? 'find' : 'done';
}

/**
 * 미연결 묶음을 모두 정리한 뒤 `다음 미처리 묶음`이 열 묶음. 미연결 묶음은 목록 맨 뒤라 뒤에 있던 묶음이 거의 없으므로,
 * 연결로 새로 생긴 인물 묶음(완료 상태에 따로 보여 준다)보다 직전 목록의 앞쪽 묶음으로 돌아가는 것을 먼저 고른다.
 * 1. 직전 목록에서 사라진 묶음 뒤에 있던 묶음 2. 직전 목록에 있던 나머지 묶음 3. 직전 목록에 없던 묶음 4. 없으면 `null`.
 * 순서는 모두 현재 목록 순서다(서버 정렬은 안정적이라 남은 묶음끼리의 순서는 직전 목록과 같다).
 */
export function nextGroupKeyWrapping(
  previous: ReadonlyArray<GroupLike>,
  removedKey: string,
  current: ReadonlyArray<GroupLike>,
): string | null {
  const previousIndex = new Map<string, number>();
  previous.forEach((group, index) => {
    if (group.groupKey != null && !previousIndex.has(group.groupKey)) previousIndex.set(group.groupKey, index);
  });
  const removedIndex = previousIndex.get(removedKey) ?? -1;
  const remaining = current.filter((group): group is { groupKey: string } => (
    group.groupKey != null && group.groupKey !== removedKey
  ));
  return remaining.find(group => (previousIndex.get(group.groupKey) ?? -1) > removedIndex)?.groupKey
    ?? remaining.find(group => previousIndex.has(group.groupKey))?.groupKey
    ?? remaining[0]?.groupKey
    ?? null;
}

/** 미연결 묶음에서 연결한 후보 하나의 기록. 대상을 알 수 없으면(응답 없이 확인한 경우) `target`이 없다. */
export interface UnlinkedLinkRecord {
  candidateId: string;
  target: {
    /** 같은 인물인지 묶는 key: 기존 인물은 `existing:<id>`, 새 인물 등록 예정은 정규화한 이름. */
    key: string;
    name: string;
    /** 연결한 묶음으로 갈 때 URL에 넣는 key. 새 인물 등록 예정은 후보 ID로 찾으므로 `null`. */
    groupKey: string | null;
  } | null;
}

/**
 * 연결된 후보가 지금 어느 인물 묶음에 있는지. 서버 묶음 규칙(기존 인물은 `existing:<id>`, 새 인물 등록 예정은 정규화한 이름)을
 * 따른다. 다시 미연결(`미상`·빈 이름)로 돌아갔으면 `unlinked`다.
 */
export function unlinkedLinkTarget(candidate: { matchedCharacterId?: string | null; entityName?: string | null }):
  NonNullable<UnlinkedLinkRecord['target']> | 'unlinked' {
  if (candidate.matchedCharacterId) {
    const groupKey = `existing:${candidate.matchedCharacterId}`;
    return { key: groupKey, name: candidate.entityName || '이름 없는 인물', groupKey };
  }
  if (isUnidentifiedCharacterName(candidate.entityName)) return 'unlinked';
  return { key: normalizeCharacterGroupName(candidate.entityName), name: candidate.entityName || '새 인물', groupKey: null };
}

/**
 * 이미 기록한 후보의 연결이 어디서든(이름 있는 묶음·묶음 일괄 연결·응답 유실 복구 포함) 바뀌면 기록을 새 대상으로 맞춘다.
 * 대상을 모르면 `null`(왼쪽 목록 안내), 다시 미연결로 돌아갔으면 기록에서 뺀다. 기록에 없는 후보는 무시한다.
 */
export function retargetUnlinkedLinks(
  links: Readonly<Record<string, ReadonlyArray<UnlinkedLinkRecord>>>,
  changes: ReadonlyArray<{ candidateId: string; target: UnlinkedLinkRecord['target'] | 'unlinked' }>,
): Record<string, UnlinkedLinkRecord[]> {
  const byId = new Map(changes.map(change => [change.candidateId, change.target] as const));
  if (!Object.values(links).some(records => records.some(record => byId.has(record.candidateId)))) {
    return links as Record<string, UnlinkedLinkRecord[]>;
  }
  return Object.fromEntries(Object.entries(links).map(([sourceKey, records]) => [sourceKey, records.flatMap(record => {
    if (!byId.has(record.candidateId)) return [record];
    const target = byId.get(record.candidateId)!;
    return target === 'unlinked' ? [] : [{ candidateId: record.candidateId, target }];
  })]));
}

/** 같은 후보를 다시 기록하면 마지막 연결로 바꾸고, 처음 연결한 순서는 유지한다. */
export function mergeUnlinkedLinks(
  existing: ReadonlyArray<UnlinkedLinkRecord>,
  added: ReadonlyArray<UnlinkedLinkRecord>,
): UnlinkedLinkRecord[] {
  const merged = [...existing];
  added.forEach(record => {
    const index = merged.findIndex(item => item.candidateId === record.candidateId);
    if (index >= 0) merged[index] = record;
    else merged.push(record);
  });
  return merged;
}

export interface UnlinkedLinkSummary {
  /** 옮긴 설정 수(대상을 알 수 없는 연결 포함). */
  settingCount: number;
  /** 옮겨 간 인물 묶음. 처음 연결한 순서이며 `candidateIds`는 지금 그 묶음에 있다고 기록된 후보다(`보기`가 찾을 때 쓴다). */
  people: Array<{ key: string; name: string; groupKey: string | null; count: number; candidateIds: string[] }>;
  /** 대상을 알 수 없는 연결 수. */
  untracked: number;
}

export function summarizeUnlinkedLinks(records: ReadonlyArray<UnlinkedLinkRecord>): UnlinkedLinkSummary {
  const people: UnlinkedLinkSummary['people'] = [];
  let untracked = 0;
  records.forEach(record => {
    if (!record.target) {
      untracked += 1;
      return;
    }
    const person = people.find(item => item.key === record.target!.key);
    if (person) {
      person.count += 1;
      person.candidateIds.push(record.candidateId);
      // 같은 인물로 기록된 후보 중 마지막에 연결된 이름을 쓴다(예: 이름 변경 뒤 다시 연결).
      person.name = record.target.name;
    } else {
      people.push({ ...record.target, count: 1, candidateIds: [record.candidateId] });
    }
  });
  return { settingCount: records.length, people, untracked };
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

type PendingGroupLike = GroupLike & { candidates?: ReadonlyArray<{ reviewStatus?: string | null }> | null };

/** 대기(`PENDING_REVIEW`) 후보가 남은 묶음인지. `전체` 상태 필터 목록에는 확정·제외만 남은 묶음도 있다. */
export function hasPendingCandidate(group: PendingGroupLike): boolean {
  return Boolean(group.candidates?.some(candidate => candidate.reviewStatus === 'PENDING_REVIEW'));
}

/**
 * 지금 페이지에 열 미처리 묶음이 없을 때 이어서 찾을 페이지 순서(0부터). 직전 목록 순서를 잇도록 다음 페이지부터
 * 끝까지 본 뒤 첫 페이지부터 지금 페이지 앞까지 본다.
 */
export function otherPageOrder(currentPage: number, totalPages: number): number[] {
  const after = Array.from({ length: Math.max(totalPages - currentPage - 1, 0) }, (_, index) => currentPage + 1 + index);
  const before = Array.from({ length: Math.min(Math.max(currentPage, 0), totalPages) }, (_, index) => index);
  return [...after, ...before];
}

/**
 * 페이지를 순서대로 읽어 미처리 후보가 남은 첫 묶음과 그 페이지를 찾는다(`excludeKey`는 방금 확정한 묶음).
 * 끝까지 없으면 `null`(탭의 검토가 끝났다는 뜻). 페이지를 읽지 못하면 예외를 그대로 던진다.
 */
export async function findPendingGroupOnPages<G extends PendingGroupLike>(
  pages: ReadonlyArray<number>,
  fetchPage: (page: number) => Promise<ReadonlyArray<G> | undefined>,
  excludeKey?: string | null,
): Promise<{ groupKey: string; page: number } | null> {
  return findGroupOnPages(pages, fetchPage, item => item.groupKey !== excludeKey && hasPendingCandidate(item));
}

/** 페이지를 순서대로 읽어 조건에 맞는 첫 묶음과 그 페이지를 찾는다. 끝까지 없으면 `null`, 읽지 못하면 예외를 던진다. */
export async function findGroupOnPages<G extends GroupLike>(
  pages: ReadonlyArray<number>,
  fetchPage: (page: number) => Promise<ReadonlyArray<G> | undefined>,
  matches: (group: G) => boolean,
): Promise<{ groupKey: string; page: number } | null> {
  for (const page of pages) {
    const group = (await fetchPage(page))?.find(item => item.groupKey && matches(item));
    if (group?.groupKey) return { groupKey: group.groupKey, page };
  }
  return null;
}

/**
 * 체크한 후보를 한 번에 연결하는 요청의 상한. 캐릭터 `selected-character-match`의 `candidateIds`와 세계관
 * `PATCH /world-setting-candidates/decisions`의 `candidates`가 모두 1~100건이다(공유 결정은 원문 수로 센다).
 */
export const REVIEW_SELECTION_LINK_LIMIT = 100;
export const REVIEW_SELECTION_LINK_LIMIT_TEXT = `한 번에 ${REVIEW_SELECTION_LINK_LIMIT}개까지 연결할 수 있어요. 선택을 줄여 주세요.`;
