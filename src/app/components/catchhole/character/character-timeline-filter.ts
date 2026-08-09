export const TIMELINE_FACT_TYPES = [
  'PROFILE', 'AGE', 'LEVEL', 'STAT', 'SKILL', 'ITEM', 'STATUS',
] as const;

export type TimelineFactType = typeof TIMELINE_FACT_TYPES[number];

export interface TimelineSelection {
  factTypes: TimelineFactType[];
  factKeys: string[];
}

export const EMPTY_TIMELINE_SELECTION: TimelineSelection = {
  factTypes: [],
  factKeys: [],
};

export function normalizeTimelineSelection(selection: TimelineSelection): TimelineSelection {
  return {
    factTypes: [...new Set(selection.factTypes.filter(type => TIMELINE_FACT_TYPES.includes(type)))]
      .sort((left, right) => TIMELINE_FACT_TYPES.indexOf(left) - TIMELINE_FACT_TYPES.indexOf(right)),
    factKeys: [...new Set(selection.factKeys.map(key => key.trim()).filter(Boolean))].sort(),
  };
}

export function createTimelineSelection(
  factTypes: readonly string[],
  factKeys: readonly string[],
): TimelineSelection {
  return normalizeTimelineSelection({
    factTypes: factTypes.filter((value): value is TimelineFactType => (
      TIMELINE_FACT_TYPES.includes(value as TimelineFactType)
    )),
    factKeys: [...factKeys],
  });
}

export function readTimelineSelection(params: URLSearchParams): TimelineSelection {
  return createTimelineSelection(
    params.getAll('timelineFactTypes'),
    params.getAll('timelineFactKeys'),
  );
}

export function writeTimelineSelection(
  params: URLSearchParams,
  selection: TimelineSelection,
): void {
  const normalized = normalizeTimelineSelection(selection);
  params.delete('timelineFactTypes');
  normalized.factTypes.forEach(type => params.append('timelineFactTypes', type));
  params.delete('timelineFactKeys');
  normalized.factKeys.forEach(key => params.append('timelineFactKeys', key));
}

export function clearTimelineSelection(params: URLSearchParams): void {
  params.delete('timelineFactTypes');
  params.delete('timelineFactKeys');
}

export function hasTimelineSelection(selection: TimelineSelection): boolean {
  return selection.factTypes.length > 0 || selection.factKeys.length > 0;
}

export function toggleTimelineFactType(
  selection: TimelineSelection,
  factType: TimelineFactType,
  visibleFactKeys: string[] = [],
): TimelineSelection {
  const parentSelected = selection.factTypes.includes(factType);
  return normalizeTimelineSelection({
    factTypes: parentSelected
      ? selection.factTypes.filter(type => type !== factType)
      : [...selection.factTypes, factType],
    // 종류 전체와 같은 화면의 세부 항목이 중복 적용되지 않게 정리한다.
    factKeys: selection.factKeys.filter(key => !visibleFactKeys.includes(key)),
  });
}

export function toggleTimelineFactKey(
  selection: TimelineSelection,
  factType: TimelineFactType,
  visibleFactKeys: string[],
  factKey: string,
): TimelineSelection {
  const selectedKeys = new Set(selection.factKeys);
  if (selection.factTypes.includes(factType)) {
    // 전체 이력을 선택한 상태에서 한 항목을 누르면 전체를 해제하고 해당 항목만 남긴다.
    visibleFactKeys.forEach(key => selectedKeys.delete(key));
    selectedKeys.add(factKey);
  } else if (selectedKeys.has(factKey)) {
    selectedKeys.delete(factKey);
  } else {
    selectedKeys.add(factKey);
  }

  return normalizeTimelineSelection({
    factTypes: selection.factTypes.filter(type => type !== factType),
    factKeys: [...selectedKeys],
  });
}
