import { ArrowRight, Quote } from 'lucide-react';
import { Link } from 'react-router';
import manuscript from '../../../assets/landing/product-manuscript-20261012.png';
import reviewMobile from '../../../assets/landing/product-review-mobile-20261012.png';
import review from '../../../assets/landing/product-review-20261012.png';
import character from '../../../assets/landing/product-character-20261012.png';
import world from '../../../assets/landing/product-world-20261012.png';
import timeline from '../../../assets/landing/product-timeline-20261012.png';
import './landing-product-story.css';

/** Captures of current product components, rendered with the public demo's fictional data. */
export function LandingProductDemo() {
  return (
    <div className="landing-product-story" aria-label="원고에서 시작되는 네 가지 설정 관리">
      <article className="product-story product-story--extract" aria-labelledby="product-extract-title" data-landing-reveal="">
        <div className="product-story__copy">
          <span className="product-story__eyebrow">01 / 원고에서 발견</span>
          <h3 id="product-extract-title">써둔 이야기 속에,<br />설정은 이미 있으니까.</h3>
          <p>원고를 올리면 인물과 세계관 설정을 찾아요. 따로 옮겨 적느라 집필의 흐름을 끊지 않아도 돼요.</p>
          <span className="product-story__note">캐릭터 · 장소 · 세력 · 세계의 규칙</span>
        </div>
        <div className="product-story__visual product-story__extraction">
          <img className="product-story__manuscript" src={manuscript} alt="가상 원고 6화 숨겨진 전직의 원문" loading="lazy" decoding="async" />
          <div className="product-story__found">
            <span className="product-story__found-label">원고에서 찾은 설정</span>
            <strong>에단 렌</strong>
            <span>직업 <b>재액 운반자</b></span>
            <div><Quote size={15} aria-hidden="true" /><p>직업 변경: 짐꾼 → 재액 운반자.</p></div>
          </div>
        </div>
      </article>

      <article className="product-story product-story--review" aria-labelledby="product-review-title" data-landing-reveal="">
        <div className="product-story__copy">
          <span className="product-story__eyebrow">02 / 원문과 함께 확인</span>
          <h3 id="product-review-title">어디서 나온 설정인지,<br />어떻게 달라지는지.</h3>
          <p>명확한 설정은 자동으로 반영해요. 확인이 필요한 내용은 기존 설정·제안값·원문을 함께 보고 결정할 수 있어요.</p>
          <span className="product-story__note">현재 설정에 반영하거나, 이력에만 남기거나.</span>
        </div>
        <div className="product-story__visual product-story__review">
          <picture>
            <source media="(max-width: 520px)" srcSet={reviewMobile} />
            <img src={review} alt="실제 캐릭터 검토 화면: 직업이 짐꾼에서 재액 운반자로 바뀌는 비교와 반영 방식 선택, 원문 근거" loading="lazy" decoding="async" />
          </picture>
        </div>
      </article>

      <article className="product-story product-story--library" aria-labelledby="product-library-title" data-landing-reveal="">
        <div className="product-story__copy">
          <span className="product-story__eyebrow">03 / 나만의 설정집</span>
          <h3 id="product-library-title">그 인물, 그 장소.<br />기억을 뒤적이는 대신.</h3>
          <p>확정한 설정이 인물과 세계관별로 모여요. 다음 장면을 쓰다가 궁금해지면, 작품의 설정집에서 바로 찾아보세요.</p>
          <span className="product-story__note">인물의 현재 설정부터 세계관의 세부 조건까지.</span>
        </div>
        <div className="product-story__visual product-story__library">
          <img className="product-story__character" src={character} alt="현재 제품의 에단 렌 캐릭터 상세 화면과 확정된 프로필 설정" loading="lazy" decoding="async" />
          <img className="product-story__world" src={world} alt="현재 제품의 거꾸로숲 세계관 상세 화면과 귀환문의 조건" loading="lazy" decoding="async" />
        </div>
      </article>

      <article className="product-story product-story--history" aria-labelledby="product-history-title" data-landing-reveal="">
        <div className="product-story__copy">
          <span className="product-story__eyebrow">04 / 변화의 기록</span>
          <h3 id="product-history-title">처음의 모습부터,<br />지금의 인물까지.</h3>
          <p>회차가 쌓이며 달라진 설정을 따라가 보세요. 언제 바뀌었는지, 어떤 문장에서 시작됐는지 이력과 원문으로 이어져요.</p>
          <Link to="/demo" className="product-story__link">가상 원고로 직접 체험하기 <ArrowRight size={18} aria-hidden="true" /></Link>
        </div>
        <div className="product-story__visual product-story__history">
          <div className="product-story__history-caption" aria-hidden="true">
            <span>한 인물의 이야기가 쌓이는 과정</span>
            <strong>짐꾼 <ArrowRight size={20} /> 재액 운반자</strong>
          </div>
          <img src={timeline} alt="현재 제품의 직업 변화 이력: 1화의 짐꾼과 6화의 재액 운반자, 각 회차의 원문 근거 버튼" loading="lazy" decoding="async" />
        </div>
      </article>
      <p className="landing-product-story__caption">가상 원고를 사용한 실제 서비스 화면 예시입니다.</p>
    </div>
  );
}
