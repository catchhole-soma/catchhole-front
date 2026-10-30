import assert from 'node:assert/strict';
import test from 'node:test';
import { candidateHasSavedUpdate } from '../src/app/components/catchhole/characterreview/characterReviewFormat.ts';

// 응답을 잃은 수정 저장의 재확인 판정. 합성 값만 사용한다.
const saved = { attributeName: 'skill.sword', attributeValue: '검술 3단계', reviewedApplicationMode: 'APPLY_PROPOSAL' as const };

test('설정명·설정값·반영 방식이 모두 같아야 저장된 것으로 본다', () => {
  assert.equal(candidateHasSavedUpdate(saved, { attributeName: 'skill.sword', attributeValue: ' 검술 3단계 ', reviewedApplicationMode: 'APPLY_PROPOSAL' }), true);
  assert.equal(candidateHasSavedUpdate(saved, { attributeName: 'skill.sword', attributeValue: '검술 3단계' }), true);
  assert.equal(candidateHasSavedUpdate(saved, { attributeName: 'skill.sword', attributeValue: '검술 3단계', reviewedApplicationMode: 'HISTORY_ONLY' }), false);
});

test('값이 그대로여도 설정명을 바꾼 수정이 반영되지 않았으면 저장된 것으로 보지 않는다', () => {
  assert.equal(candidateHasSavedUpdate(saved, { attributeName: 'skill.spear', attributeValue: '검술 3단계' }), false);
  assert.equal(candidateHasSavedUpdate({ ...saved, attributeValue: null }, { attributeName: 'skill.sword', attributeValue: null }), true);
});
