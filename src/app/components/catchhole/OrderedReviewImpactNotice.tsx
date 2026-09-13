export function OrderedReviewImpactNotice() {
  return (
    <p role="note" style={{
      margin: '12px 0', padding: '10px 12px', borderRadius: 8,
      border: '1px solid var(--ch-border)', background: 'var(--ch-surface)',
      color: 'var(--ch-warning-ink)', fontSize: 12, lineHeight: 1.6,
    }}>
      이 회차의 설정을 수정·확정·제외하면 뒤 회차의 분석을 다시 시작해야 할 수 있습니다.
      {' '}뒤 회차를 분석 중이라면 해당 분석이 중단되므로, 분석 완료 후 변경해 주세요.
    </p>
  );
}
