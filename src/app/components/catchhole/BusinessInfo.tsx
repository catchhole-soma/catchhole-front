import './business-info.css';

export function BusinessInfo() {
  const phone = import.meta.env.VITE_CUSTOMER_SERVICE_PHONE?.trim() || '070-8027-2690';
  const mailOrderNumber = import.meta.env.VITE_MAIL_ORDER_REGISTRATION?.trim();
  return (
    <address className="business-info">
      <span>상호 캐치홀 · 대표 임준우 · 사업자등록번호 549-48-01054</span>
      <span>경기도 고양시 일산서구 일중로 30 산들마을 5단지 503동 1502호</span>
      <span>고객 문의 <a href="mailto:aicatchhole@gmail.com">aicatchhole@gmail.com</a> · <a href={`tel:${phone.replace(/[^+\d]/g, '')}`}>{phone}</a></span>
      <span>전화 상담 평일 10:00~18:00</span>
      {mailOrderNumber && <span>통신판매업 신고번호 {mailOrderNumber}</span>}
    </address>
  );
}
