import assert from 'node:assert/strict';
import test from 'node:test';
import type { SettingCandidateResponse } from '../src/app/api/generated/types.gen.ts';
import {
  computeGroupConfirmBlock,
  type CharacterGroupBlockInput,
} from '../src/app/components/catchhole/characterreview/groupConfirmBlock.ts';
import {
  computeWorldGroupConfirmBlock,
  worldDuplicatePaths,
  type WorldGroupBlockRow,
} from '../src/app/components/catchhole/worldsetting/worldGroupConfirmBlock.ts';

// 합성 후보만 사용한다.
const candidate = (id: string, overrides: Partial<SettingCandidateResponse> = {}): SettingCandidateResponse => ({
  id, reviewStatus: 'PENDING_REVIEW', candidateKind: 'SETTING', matchStatus: 'MATCHED', comparisonStatus: 'COMPLETED',
  suggestedOperation: 'ADD', attributeName: `status.${id}`, attributeDisplayName: `상태 ${id}`, manualReviewAvailable: false,
  ...overrides,
} as SettingCandidateResponse);

const input = (candidates: SettingCandidateResponse[], overrides: Partial<CharacterGroupBlockInput> = {}): CharacterGroupBlockInput => ({
  candidates, legacyPartial: false, automaticPendingMessage: '자동 반영 대기', usesFinalCurrentSelection: false,
  sharedComparisonRevision: true, isSaveUnresolved: () => false, hasLocalChoice: () => false,
  applicationMode: () => 'APPLY_PROPOSAL', needsCurrentChoice: () => false,
  settingLabel: item => item.attributeDisplayName ?? '', ...overrides,
});

test('캐릭터: 막는 것이 없으면 null', () => {
  assert.equal(computeGroupConfirmBlock(input([candidate('a'), candidate('b', { suggestedOperation: 'EXCLUDE' })])), null);
});

test('캐릭터: 첫 차단 문장은 기존 체인 순서를 따르고, 후보 ID는 모든 후보 차단을 화면 순서로 모은다', () => {
  const block = computeGroupConfirmBlock(input([
    candidate('saved', { manualReviewAvailable: true, reviewedApplicationMode: 'APPLY_PROPOSAL', suggestedOperation: 'REVIEW_REQUIRED' }),
    candidate('review', { suggestedOperation: 'REVIEW_REQUIRED' }),
    candidate('ambiguous', { matchStatus: 'AMBIGUOUS', comparisonStatus: 'WAITING_FOR_CHARACTER_MATCH' }),
    candidate('exclude', { suggestedOperation: 'EXCLUDE' }),
  ]));
  assert.deepEqual(block, { reason: '캐릭터 연결이 모호한 설정을 먼저 해소해 주세요.', candidateIds: ['review', 'ambiguous'] });
});

test('캐릭터: 그룹 전체 사유는 후보 없이 돌려준다', () => {
  const rows = [candidate('a', { matchStatus: 'AMBIGUOUS' })];
  assert.deepEqual(computeGroupConfirmBlock(input(rows, { legacyPartial: true })),
    { reason: '이 캐릭터의 설정이 일부만 표시되어 한꺼번에 확정할 수 없습니다.', candidateIds: [] });
  assert.deepEqual(computeGroupConfirmBlock(input([])), { reason: '확정할 검토 대기 설정이 없습니다.', candidateIds: [] });
  assert.deepEqual(computeGroupConfirmBlock(input([candidate('a', { automaticApplicationPending: true })])),
    { reason: '자동 반영 대기', candidateIds: [] });
  assert.deepEqual(computeGroupConfirmBlock(input([candidate('a')], { sharedComparisonRevision: false })),
    { reason: '모든 설정의 비교 결과가 준비된 뒤 함께 확정할 수 있습니다.', candidateIds: [] });
});

test('캐릭터: 로컬 선택이 있으면 판단 필요 후보로 막지 않고, 저장 확인 중이면 그 후보를 먼저 든다', () => {
  const review = candidate('review', { suggestedOperation: 'REVIEW_REQUIRED' });
  assert.equal(computeGroupConfirmBlock(input([review], { hasLocalChoice: () => true })), null);
  assert.deepEqual(computeGroupConfirmBlock(input([review, candidate('b')], { isSaveUnresolved: id => id === 'b' })), {
    reason: '저장 결과를 확인하는 설정이 있어요. 확인이 끝난 뒤 확정할 수 있어요.', candidateIds: ['review', 'b'],
  });
});

test('캐릭터: 같은 항목을 여러 번 현재 반영하면 두 후보를 함께 든다', () => {
  const rows = [
    candidate('first', { resolvedCanonicalFactKey: 'job', attributeDisplayName: '직업' }),
    candidate('other'),
    candidate('second', { resolvedCanonicalFactKey: 'job' }),
  ];
  assert.equal(computeGroupConfirmBlock(input(rows)), null);
  assert.deepEqual(computeGroupConfirmBlock(input(rows, { usesFinalCurrentSelection: true })), {
    reason: '‘직업’에 현재 반영을 여러 번 선택했어요. 현재로 남길 하나를 선택하고 나머지는 이력에 저장하거나 제외해 주세요.',
    candidateIds: ['first', 'second'],
  });
});

test('캐릭터: 비교가 끝나지 않은 후보와 값 오류·수동 확인 미저장을 모두 차단 후보로 센다', () => {
  const block = computeGroupConfirmBlock(input([
    candidate('processing', { comparisonStatus: 'PROCESSING', suggestedOperation: undefined }),
    candidate('invalid', { valueValidation: { status: 'INVALID' } }),
    candidate('manual', { manualReviewAvailable: true, suggestedOperation: 'REVIEW_REQUIRED' }),
  ]));
  assert.equal(block?.reason, '값 형식이 잘못된 설정을 수정하거나 제외한 뒤 확정해 주세요.');
  assert.deepEqual(block?.candidateIds, ['processing', 'invalid', 'manual']);
});

const row = (id: string, overrides: Partial<WorldGroupBlockRow> = {}): WorldGroupBlockRow => ({
  id, pathKey: `path-${id}`, displayPath: `설정 ${id}`, sharedDecisionKey: null, unsaved: false, quotaInterrupted: false,
  needsDecision: false, conflict: false, bookChoicePending: false, ...overrides,
});

test('세계관: 막는 것이 없으면 null, 그룹 전체 사유는 행 없이 돌려준다', () => {
  assert.equal(computeWorldGroupConfirmBlock({ rows: [row('a'), row('b')], automaticPendingMessage: null, filtered: false }), null);
  assert.deepEqual(computeWorldGroupConfirmBlock({ rows: [row('a', { needsDecision: true })], automaticPendingMessage: '자동', filtered: true }),
    { kind: 'automatic', reason: '자동', candidateIds: [] });
  assert.equal(computeWorldGroupConfirmBlock({ rows: [row('a')], automaticPendingMessage: null, filtered: true })?.kind, 'filtered');
  assert.equal(computeWorldGroupConfirmBlock({ rows: [], automaticPendingMessage: null, filtered: false })?.kind, 'empty');
});

test('세계관: 결정 없는 행·충돌 행·미저장 행·대상만 고른 행을 화면 순서로 모으고 문장은 우선순위로 고른다', () => {
  const block = computeWorldGroupConfirmBlock({ rows: [
    row('ok'),
    row('conflict', { conflict: true }),
    row('pending', { needsDecision: true }),
    row('dirty', { unsaved: true }),
  ], automaticPendingMessage: null, filtered: false });
  assert.equal(block?.kind, 'unsaved');
  assert.equal(block?.reason, '수정한 내용을 저장하거나 취소한 뒤 모두 확정해 주세요.');
  assert.deepEqual(block?.candidateIds, ['conflict', 'pending', 'dirty']);
});

test('세계관: 같은 위치의 행은 중복으로 막되 같은 공유 결정의 원문은 하나로 본다', () => {
  const rows = [
    row('a', { pathKey: 'p', displayPath: '능력 › 근력', sharedDecisionKey: 'd1' }),
    row('b', { pathKey: 'p', sharedDecisionKey: 'd1' }),
    row('c', { pathKey: 'q', displayPath: '역사' }),
    row('d', { pathKey: 'q' }),
    row('e', { pathKey: null }),
    row('f', { pathKey: null }),
  ];
  assert.deepEqual(worldDuplicatePaths(rows), { paths: ['역사'], ids: new Set(['c', 'd']) });
  const block = computeWorldGroupConfirmBlock({ rows, automaticPendingMessage: null, filtered: false });
  assert.equal(block?.kind, 'duplicate');
  assert.equal(block?.reason, '같은 대상 안에서 같은 범위와 설정명 ‘역사’이 여러 번 있습니다. 내용을 하나로 합치거나 중복 항목을 제외해 주세요.');
  assert.deepEqual(block?.candidateIds, ['c', 'd']);
});
