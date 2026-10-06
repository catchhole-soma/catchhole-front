export function OrderedReviewImpactNotice() {
  return (
    <p role="note" style={{
      margin: '12px 0', padding: '10px 12px', borderRadius: 8,
      border: '1px solid var(--ch-border)', background: 'var(--ch-surface)',
      color: 'var(--ch-text-muted)', fontSize: 12, lineHeight: 1.6,
    }}>
      이 변경은 이미 완료된 다른 회차의 분석 결과를 바꾸지 않습니다.
      {' '}현재 설정에 반영을 선택하면 확정 시점의 해당 설정을 바꾸고, 이력에만 저장을 선택하면 현재 설정을 유지합니다.
    </p>
  );
}
