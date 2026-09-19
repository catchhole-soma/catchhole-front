export function OrderedReviewImpactNotice() {
  return (
    <p role="note" style={{
      margin: '12px 0', padding: '10px 12px', borderRadius: 8,
      border: '1px solid var(--ch-border)', background: 'var(--ch-surface)',
      color: 'var(--ch-warning-ink)', fontSize: 12, lineHeight: 1.6,
    }}>
      이 변경은 이미 완료된 다른 회차의 분석 결과를 바꾸지 않습니다.
      {' '}최신 설정이나 직접 수정한 값이 있으면 현재 값은 유지하고 이력에 저장합니다. 연속 분석이 끝난 뒤 변경해 주세요.
    </p>
  );
}
