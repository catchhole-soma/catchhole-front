import { useEffect, useRef, useState, type FormEvent } from 'react';
import { ArrowLeft, Check, CreditCard } from 'lucide-react';
import { Link, useLocation, useSearchParams } from 'react-router';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { ProductBrand } from './ui-v2/ProductBrand';
import { BusinessInfo } from './BusinessInfo';
import {
  TOP_UP_PRODUCTS, PAYMENT_REVIEW_PREVIEW_PATH, createReviewPaymentRequest, reviewResultMessage,
} from '../../lib/payment-review';
import type { PaymentReviewPageResponse } from '../../api/generated/types.gen';
import { getPaymentReviewPage } from '../../api/generated/sdk.gen';
import { privateImageSessionEpoch } from '../../lib/private-image-session';
import './payment-review.css';

export function PaymentReviewPage({ localPreview = false, review }: { localPreview?: boolean; review: PaymentReviewPageResponse }) {
  const location = useLocation();
  const [params, setParams] = useSearchParams();
  const product = TOP_UP_PRODUCTS.find(item => item.id === params.get('product')) ?? TOP_UP_PRODUCTS[0];
  const [confirmedProduct, setConfirmedProduct] = useState<string | null>(null);
  const [opening, setOpening] = useState(false);
  const [reloadRequired, setReloadRequired] = useState(false);
  const [message, setMessage] = useState('');
  const openingRef = useRef(false);
  const checkoutRequestRef = useRef<AbortController | null>(null);
  useEffect(() => () => checkoutRequestRef.current?.abort(), []);
  const config = review;
  const purchaseConditions = review.purchaseConditions;
  const confirmed = confirmedProduct === product.id;
  const returned = params.has('paymentId') || params.has('code');
  const resultMessage = message || (returned ? reviewResultMessage(params.get('code'), params.get('message')) : '');

  const openCheckout = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (openingRef.current || reloadRequired || !confirmed || !config.ready) return;
    const data = new FormData(event.currentTarget);
    const customer = {
      fullName: String(data.get('fullName') ?? '').trim(),
      email: String(data.get('email') ?? '').trim(),
      phoneNumber: String(data.get('phoneNumber') ?? '').replace(/[\s-]/g, ''),
    };
    if (!customer.fullName || !/^\d{9,11}$/.test(customer.phoneNumber)) {
      setMessage('구매자 이름과 연락처를 확인해 주세요.');
      return;
    }
    const sessionEpoch = privateImageSessionEpoch();
    const controller = new AbortController();
    checkoutRequestRef.current = controller;
    const isCurrent = () => !controller.signal.aborted
      && sessionEpoch === privateImageSessionEpoch()
      && window.location.pathname === location.pathname;
    openingRef.current = true;
    setOpening(true);
    setMessage('');
    // Remove a previous return message; retries always start with a fresh paymentId.
    setParams({ product: product.id }, { replace: true });
    try {
      // Recheck server permission immediately before opening the PG window.
      const result = localPreview ? { success: true, data: review }
        : (await getPaymentReviewPage({ cache: 'no-store', signal: controller.signal })).data;
      if (!isCurrent()) return;
      const latest = result?.success === true ? result.data : undefined;
      if (!latest?.ready) throw new Error('Payment review access is unavailable');
      const { requestPayment } = await import('@portone/browser-sdk/v2');
      if (!isCurrent()) return;
      const response = await requestPayment(createReviewPaymentRequest(
        product, customer, `${location.pathname}?product=${product.id}`, latest,
      ));
      if (!isCurrent()) return;
      if (response) setMessage(reviewResultMessage(response.code, response.message));
      else setMessage('결제창을 닫았어요. 사용량은 충전되지 않았어요.');
    } catch {
      if (!isCurrent()) return;
      // The SDK caches a rejected script-loading promise, so a retry needs a reload.
      setReloadRequired(true);
      setMessage('결제창을 열지 못했어요. 화면을 새로고침한 뒤 다시 확인해 주세요.');
    } finally {
      openingRef.current = false;
      if (checkoutRequestRef.current === controller) checkoutRequestRef.current = null;
      if (isCurrent()) setOpening(false);
    }
  };

  return (
    <div className="payment-review theme-v2">
      <header className="payment-review__header">
        <ProductBrand compact />
        <Link to={localPreview ? '/landing' : '/works'}><ArrowLeft size={16} /> {localPreview ? '홈으로' : '내 작품으로'}</Link>
      </header>
      <main className="payment-review__main">
        <div className="payment-review__intro">
          <h1>사용량 충전</h1>
          <p>원고·설정집 분석부터 AI 대화까지, 모든 AI 기능에 함께 사용해요.</p>
        </div>
        <div className="payment-review__layout">
          <section aria-labelledby="product-title">
            <h2 id="product-title">충전권 선택</h2>
            <fieldset className="payment-review__products" disabled={opening}>
              <legend className="payment-review__sr-only">사용량 충전권</legend>
              {TOP_UP_PRODUCTS.map(item => (
                <label key={item.id} className={`payment-review__product${product.id === item.id ? ' is-selected' : ''}`}>
                  <input type="radio" name="product" value={item.id} checked={product.id === item.id} onChange={() => {
                    setConfirmedProduct(null);
                    setMessage('');
                    setParams({ product: item.id }, { replace: true });
                  }} />
                  <span className="payment-review__product-top"><strong>{item.name}</strong>{item.multiplier === 2 && <span className="payment-review__badge">사용량 2배</span>}</span>
                  <span className="payment-review__price">{item.amount.toLocaleString('ko-KR')}<small>원</small></span>
                  <span>{item.quantity}</span>
                  <span className="payment-review__estimate">예상 {item.estimatedEpisodes}회차 분석</span>
                  <span className="payment-review__product-note"><Check size={15} /> 구매 후 12개월 사용</span>
                </label>
              ))}
            </fieldset>
            <p className="payment-review__caption">회차당 5,000자(공백 포함) 기본 분석 기준의 예상 분량이에요. 원고 길이·쌓인 설정·이용 기능에 따라 실제 분량은 표시 범위보다 적거나 많을 수 있어요.</p>
            <p className="payment-review__caption">부가세 포함 · 한 번만 결제 · 자동 재결제 없음</p>
            <section className="payment-review__conditions" aria-labelledby="conditions-title">
              <h2 id="conditions-title">구매 전에 확인해 주세요</h2>
              <dl>
                <div><dt>사용 범위</dt><dd>원고 분석·재분석·설정집 분석·AI 대화 등 모든 AI 기능에서 함께 사용해요.</dd></div>
                <div><dt>차감 기준</dt><dd>이용한 AI 사용량만큼 캐치홀 토큰을 차감해요. 재분석·AI 대화도 같은 잔액에서 사용해요.</dd></div>
                <div><dt>사용 순서</dt><dd>무료 사용량을 먼저 쓰고, 유료분은 먼저 만료되는 구매분부터 사용해요.</dd></div>
                <div><dt>사용기간</dt><dd>각 구매분은 구매 후 12개월 동안 사용해요.</dd></div>
                <div><dt>환불</dt><dd>미사용은 전액, 일부 사용은 남은 유료 사용량의 비율만큼 수수료 없이 환불해요.</dd></div>
                <div><dt>만료·서비스 종료</dt><dd>남은 유료 사용량에 해당하는 금액을 자동 환불해요.</dd></div>
              </dl>
              <details>
                <summary>구매조건 전체 보기</summary>
                <div className="payment-review__policy"><ReactMarkdown remarkPlugins={[remarkGfm]}>{purchaseConditions}</ReactMarkdown></div>
              </details>
              <nav aria-label="법률 문서"><Link to={localPreview ? `${PAYMENT_REVIEW_PREVIEW_PATH}/terms` : '/billing/terms'} target="_blank" rel="noopener noreferrer">이용약관 ↗</Link><Link to={localPreview ? `${PAYMENT_REVIEW_PREVIEW_PATH}/privacy` : '/billing/privacy'} target="_blank" rel="noopener noreferrer">개인정보처리방침 ↗</Link></nav>
            </section>
          </section>
          <section className="payment-review__checkout" aria-labelledby="checkout-title">
            <h2 id="checkout-title">선택한 충전권</h2>
            <div className="payment-review__summary"><span>{product.name}</span><strong>{product.amount.toLocaleString('ko-KR')}원</strong></div>
            <p className="payment-review__caption">지급량 {product.quantity}</p>
            <p className="payment-review__caption">예상 {product.estimatedEpisodes}회차 · 회차당 5,000자 기준</p>
            <p className="payment-review__method"><CreditCard size={18} /> 신용·체크카드</p>
            <form onSubmit={event => void openCheckout(event)}>
              <fieldset disabled={opening}>
                <legend>구매자 정보</legend>
                <label>이름<input name="fullName" autoComplete="name" required maxLength={40} /></label>
                <label>이메일<input name="email" type="email" autoComplete="email" required maxLength={100} /></label>
                <label>연락처<input name="phoneNumber" type="tel" autoComplete="tel" inputMode="tel" required pattern={'[0-9\\s\\-]{9,14}'} maxLength={14} placeholder="010-1234-5678" /></label>
                <label className="payment-review__consent"><input type="checkbox" checked={confirmed} onChange={event => setConfirmedProduct(event.target.checked ? product.id : null)} /> <span>상품 내용과 사용기간·환불 조건을 확인했어요.</span></label>
              </fieldset>
              <button className="payment-review__pay" disabled={opening || reloadRequired || !confirmed || !config.ready} type="submit">{opening ? '결제창 여는 중…' : '결제창 열기'}</button>
              {!config.ready && <p className="payment-review__status" role="status">결제 서비스를 준비하고 있어요.</p>}
              {resultMessage && <p className="payment-review__status" role="status" aria-live="polite">{resultMessage}</p>}
              {reloadRequired && <button className="payment-review__reload" type="button" onClick={() => window.location.reload()}>화면 새로고침</button>}
            </form>
          </section>
        </div>
        <footer className="payment-review__footer"><BusinessInfo /></footer>
      </main>
    </div>
  );
}
