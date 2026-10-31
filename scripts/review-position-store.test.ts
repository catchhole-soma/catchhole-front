import assert from 'node:assert/strict';
import test from 'node:test';
import {
  readReviewPosition,
  REVIEW_POSITION_MAX_AGE_MS,
  reviewPositionKey,
  saveReviewPosition,
} from '../src/app/lib/review-position-store.ts';

function memoryStorage() {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { values.set(key, value); },
  };
}

test('검토 위치 키는 작품·업로드 묶음·출처·후보 종류를 구분한다', () => {
  assert.equal(reviewPositionKey({ workId: 'w', batchId: 'b', candidateType: 'character' }),
    'catchhole:review-position:w:b:EPISODE:character');
  assert.equal(reviewPositionKey({ workId: 'w', batchId: 'b', sourceAnalysisJobId: 'j', candidateType: 'world' }),
    'catchhole:review-position:w:b:j:world');
});

test('저장한 위치를 24시간 안에서만 복원하고 깨진 값은 무시한다', () => {
  const storage = memoryStorage();
  saveReviewPosition('key', { scrollTop: 400, candidateId: 'c-1', groupKey: 'g' }, 1_000, storage);
  assert.deepEqual(readReviewPosition('key', 2_000, storage), { scrollTop: 400, candidateId: 'c-1', groupKey: 'g', savedAt: 1_000 });
  assert.equal(readReviewPosition('key', 1_000 + REVIEW_POSITION_MAX_AGE_MS + 1, storage), null);
  storage.setItem('broken', '{');
  assert.equal(readReviewPosition('broken', 2_000, storage), null);
  storage.setItem('negative', JSON.stringify({ scrollTop: -1, savedAt: 1_000 }));
  assert.equal(readReviewPosition('negative', 2_000, storage), null);
});

test('저장소 접근이 막혀도 예외를 밖으로 던지지 않는다', () => {
  const blocked = {
    getItem: () => { throw new Error('blocked'); },
    setItem: () => { throw new Error('blocked'); },
  };
  assert.doesNotThrow(() => saveReviewPosition('key', { scrollTop: 1, candidateId: null, groupKey: null }, 1, blocked));
  assert.equal(readReviewPosition('key', 1, blocked), null);
  assert.equal(readReviewPosition('key', 1, null), null);
});
