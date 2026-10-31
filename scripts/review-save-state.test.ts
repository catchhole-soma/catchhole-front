import assert from 'node:assert/strict';
import test from 'node:test';
import { ApiError, NetworkError } from '../src/app/lib/api-errors.ts';
import { ClientRejectedError, isResponseLost } from '../src/app/lib/review-save-state.ts';

// 저장·확정 오류를 "확실한 실패"와 "결과 미확인(재조회로 판정)"으로 나누는 규칙. 캐릭터 저장 추적기·세계관 결정 저장/확정/제외가
// 모두 이 함수 하나로 분류한다.
test('서버가 돌려준 오류 응답과 보내기 전에 화면이 막은 쓰기만 확실한 실패다', () => {
  assert.equal(isResponseLost(new ApiError('충돌', 'CONFLICT', 409)), false);
  assert.equal(isResponseLost({ success: false, data: null, message: '버전이 달라요', error: { code: 'CONFLICT', status: 409 } }), false);
  assert.equal(isResponseLost({ success: false, message: '오류 본문' }), false);
  assert.equal(isResponseLost(new ClientRejectedError('이전 분석 기록은 수정할 수 없습니다.')), false);
});

test('응답을 받지 못했거나 본문을 읽다 끊기거나 해석하지 못한 오류는 결과 미확인이다', () => {
  assert.equal(isResponseLost(new NetworkError()), true);
  // 헤더를 받은 뒤 본문을 읽다 연결이 끊기면 `response.text()`가 네이티브 TypeError를 낸다.
  assert.equal(isResponseLost(new TypeError('network error while reading body')), true);
  // 성공 응답의 깨진 JSON 본문.
  assert.equal(isResponseLost(new SyntaxError('Unexpected end of JSON input')), true);
  assert.equal(isResponseLost(new DOMException('The operation was aborted.', 'AbortError')), true);
  assert.equal(isResponseLost(new Error('알 수 없는 오류')), true);
  // 프록시 오류 페이지처럼 해석할 수 없는 본문, 빈 오류.
  assert.equal(isResponseLost('<html>502 Bad Gateway</html>'), true);
  assert.equal(isResponseLost(undefined), true);
  assert.equal(isResponseLost({}), true);
});
