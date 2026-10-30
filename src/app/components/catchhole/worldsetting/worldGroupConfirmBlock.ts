/**
 * 세계관 그룹 확정(`모두 확정`/`확정하고 다음`)을 막는 이유와 그 이유에 걸린 행.
 *
 * 화면은 행마다 아래 사실을 계산해 넘긴다. 이 모듈은 같은 경로 중복을 찾고, 기존 안내 문장 중 하나를 고르고,
 * 막힌 행을 화면 순서대로 모은다. `kind`는 같은 문장의 안내가 화면에 이미 있으면 버튼 설명을 그 안내에 연결하는 데 쓴다.
 */
export interface WorldGroupBlockRow {
  id: string;
  /** 같은 대상 안의 설정 위치 비교 키. 제외 결정이거나 설정명이 없으면 null(중복 검사 제외). */
  pathKey: string | null;
  displayPath: string;
  /** 같은 원문 묶음의 같은 결정이면 같은 값. 이 경우 같은 경로여도 중복으로 보지 않는다. */
  sharedDecisionKey: string | null;
  /** 저장하지 않은 인라인 수정이 있다. */
  unsaved: boolean;
  /** 사용량 부족으로 비교가 중단됐다. */
  quotaInterrupted: boolean;
  /** 비교가 끝나지 않았거나, 결정(서버 초안·제안)이 없거나, 보류가 해소되지 않았거나, 묶음에서 고른 대상이 남은 행. */
  needsDecision: boolean;
  /** 원문마다 내용이 달라 최종 내용을 아직 정하지 않았다. */
  conflict: boolean;
  /** 설정집 현재 반영 여부를 아직 고르지 않았다. */
  bookChoicePending: boolean;
}

type WorldGroupBlockKind = 'automatic' | 'filtered' | 'empty' | 'unsaved' | 'quota' | 'decision' | 'duplicate' | 'conflict' | 'book';

export interface WorldGroupBlock {
  kind: WorldGroupBlockKind;
  reason: string;
  candidateIds: string[];
}

const WORLD_BLOCK_TEXT = {
  filtered: '분류·반영 방식 필터를 해제한 뒤 이 대상의 모든 설정을 함께 확정해 주세요.',
  empty: '확정할 검토 대기 설정이 없습니다.',
  unsaved: '수정한 내용을 저장하거나 취소한 뒤 모두 확정해 주세요.',
  quota: '사용량 부족으로 비교가 중단된 설정은 비교를 이어서 마친 뒤 확정할 수 있어요.',
  decision: '반영할 내용을 정하지 않은 설정이 있어요. 각 설정에서 반영할 내용을 정해 주세요.',
  conflict: '원문마다 내용이 다른 설정입니다. 위에서 최종 내용을 정하거나 해당 항목을 제외해 주세요.',
  book: '각 항목에서 내용을 확인하고 확정할 방법을 선택해 주세요.',
} as const;

function worldDuplicateText(paths: string[]): string {
  return `같은 대상 안에서 같은 범위와 설정명 ‘${paths.join('’, ‘')}’이 여러 번 있습니다. 내용을 하나로 합치거나 중복 항목을 제외해 주세요.`;
}

/** 같은 대상 안에서 같은 위치를 두 번 이상 쓰는 행과 표시 경로. 같은 공유 결정의 원문은 하나로 본다. */
export function worldDuplicatePaths(rows: WorldGroupBlockRow[]): { paths: string[]; ids: Set<string> } {
  const seen = new Map<string, { row: WorldGroupBlockRow }>();
  const paths = new Set<string>();
  const ids = new Set<string>();
  for (const row of rows) {
    if (!row.pathKey) continue;
    const existing = seen.get(row.pathKey);
    if (!existing) {
      seen.set(row.pathKey, { row });
      continue;
    }
    const sameSharedDecision = row.sharedDecisionKey != null && row.sharedDecisionKey === existing.row.sharedDecisionKey;
    if (sameSharedDecision) continue;
    paths.add(existing.row.displayPath);
    ids.add(existing.row.id);
    ids.add(row.id);
  }
  return { paths: [...paths], ids };
}

export function computeWorldGroupConfirmBlock({ rows, automaticPendingMessage, filtered }: {
  /** 검토 대기 행(화면 순서). */
  rows: WorldGroupBlockRow[];
  /** 그룹에 자동 반영 대기 행이 있으면 그 안내 문장. */
  automaticPendingMessage: string | null;
  /** 분류·반영 방식 필터로 같은 결정의 행이 숨을 수 있다. */
  filtered: boolean;
}): WorldGroupBlock | null {
  if (automaticPendingMessage) return { kind: 'automatic', reason: automaticPendingMessage, candidateIds: [] };
  if (filtered) return { kind: 'filtered', reason: WORLD_BLOCK_TEXT.filtered, candidateIds: [] };
  if (rows.length === 0) return { kind: 'empty', reason: WORLD_BLOCK_TEXT.empty, candidateIds: [] };
  const duplicates = worldDuplicatePaths(rows);
  const checks: Array<{ kind: WorldGroupBlockKind; reason: string; blocks: (row: WorldGroupBlockRow) => boolean }> = [
    { kind: 'unsaved', reason: WORLD_BLOCK_TEXT.unsaved, blocks: row => row.unsaved },
    { kind: 'quota', reason: WORLD_BLOCK_TEXT.quota, blocks: row => row.quotaInterrupted },
    { kind: 'decision', reason: WORLD_BLOCK_TEXT.decision, blocks: row => row.needsDecision },
    { kind: 'duplicate', reason: worldDuplicateText(duplicates.paths), blocks: row => duplicates.ids.has(row.id) },
    { kind: 'conflict', reason: WORLD_BLOCK_TEXT.conflict, blocks: row => row.conflict },
    { kind: 'book', reason: WORLD_BLOCK_TEXT.book, blocks: row => row.bookChoicePending },
  ];
  const first = checks.find(check => rows.some(check.blocks));
  if (!first) return null;
  return {
    kind: first.kind,
    reason: first.reason,
    candidateIds: rows.filter(row => checks.some(check => check.blocks(row))).map(row => row.id),
  };
}
