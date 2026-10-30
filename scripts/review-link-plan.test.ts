import assert from 'node:assert/strict';
import test from 'node:test';
import type { CharacterDetailResponse, SettingCandidateResponse, WorldSettingCandidateResponse } from '../src/app/api/generated/types.gen.ts';
import {
  candidateEpisodesLabel,
  existingCharacterSettingValue,
  mentionSearchText,
} from '../src/app/components/catchhole/characterreview/characterReviewFormat.ts';
import {
  planWorldTargetLink,
  worldPropertyPathKey,
  type WorldTargetLinkUnit,
} from '../src/app/components/catchhole/worldsetting/worldReviewDecisions.ts';

// 인물·대상·설정은 모두 합성 데이터다.
const setting = (key: string, displayName: string, value: string) => ({
  key, displayName, value, attributeNameEditable: false, displayNameEditable: false,
});
const detail: CharacterDetailResponse = {
  id: 'c1', name: '합성 인물', currentAge: 19, currentLevel: null,
  profile: [setting('profile.occupation', '직업', '기사')],
  stats: [setting('stats.strength', '근력', '12')],
};
const candidate = (overrides: Partial<SettingCandidateResponse>): SettingCandidateResponse => ({ id: 'x', ...overrides } as SettingCandidateResponse);

test('연결 미리보기는 서버가 해석한 key를 먼저 쓰고, 없으면 표시명으로 찾으며, 나이·레벨은 상세 필드를 읽는다', () => {
  assert.equal(existingCharacterSettingValue(detail, candidate({ attributeName: 'profile.job', resolvedCanonicalFactKey: 'profile.occupation' })), '기사');
  assert.equal(existingCharacterSettingValue(detail, candidate({ attributeName: 'profile.custom', attributeDisplayName: '근력' })), '12');
  assert.equal(existingCharacterSettingValue(detail, candidate({ attributeName: 'age' })), '19');
  assert.equal(existingCharacterSettingValue(detail, candidate({ attributeName: 'level' })), null);
  assert.equal(existingCharacterSettingValue(detail, candidate({ attributeName: 'profile.species', attributeDisplayName: '종족' })), null);
});

test('선택 요약의 회차는 중복 없이 오름차순으로, 설정집은 따로 표시한다', () => {
  assert.equal(candidateEpisodesLabel([candidate({ episodeNo: 2 }), candidate({ episodeNo: 1 }), candidate({ episodeNo: 2 })]), '회차 1, 2');
  assert.equal(candidateEpisodesLabel([candidate({ episodeNo: 3 }), candidate({ source: { sourceKind: 'SETTING_BOOK' } as SettingCandidateResponse['source'] })]), '회차 3 · 설정집');
  assert.equal(candidateEpisodesLabel([]), '');
});

test('원문 표현은 미상·빈 값이 아니면 검색어로 쓴다', () => {
  assert.equal(mentionSearchText(candidate({ rawEntityMention: ' 아리 ' })), '아리');
  assert.equal(mentionSearchText(candidate({ rawEntityMention: '미상' })), '');
  assert.equal(mentionSearchText(candidate({})), '');
});

const unit = (id: string, settingName: string, extra: Partial<WorldTargetLinkUnit> = {}): WorldTargetLinkUnit => ({
  candidate: { id } as WorldSettingCandidateResponse,
  candidateIds: [id],
  draft: { operation: 'ADD', category: 'LOCATION', subjectName: '항구', scopeName: null, settingName, value: `${settingName} 값` },
  conflict: false,
  ...extra,
});
const target = { worldSettingId: 't1', category: 'LOCATION' as const, subjectName: ' 은빛 항구 ' };

test('대상에 같은 경로가 없는 행만 원문 값 그대로 ADD로 저장하고 나머지는 결정으로 남긴다', () => {
  const existing = new Set([worldPropertyPathKey(null, ' 기후 ')]);
  const plan = planWorldTargetLink([
    unit('w1', '기후'),
    unit('w2', '인구'),
    unit('w3', '항로', { candidateIds: ['w3', 'w4'] }),
    unit('w5', '특산물', { conflict: true }),
    unit('w6', '인구'),
  ], target, existing);
  assert.deepEqual(plan.rows.map(row => row.outcome), ['existing', 'add', 'add', 'conflict', 'duplicate']);
  assert.deepEqual(plan.saves.map(save => save.candidateId), ['w2', 'w3', 'w4']);
  assert.ok(plan.saves.every(save => save.operation === 'ADD' && save.category === 'LOCATION' && save.subjectName === '은빛 항구'));
  assert.equal(plan.saves[0].value, '인구 값');
  assert.deepEqual(plan.pending.map(row => row.unit.candidate.id), ['w1', 'w5', 'w6']);
});

test('경로 비교는 범위 없음과 빈 범위를 같게, 대소문자·앞뒤 공백을 무시한다', () => {
  assert.equal(worldPropertyPathKey('', 'Climate'), worldPropertyPathKey(null, ' climate'));
  assert.notEqual(worldPropertyPathKey('부두', '규모'), worldPropertyPathKey(null, '규모'));
});
