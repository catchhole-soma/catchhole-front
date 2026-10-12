import { Fragment, useEffect, useRef, useState, type ReactNode } from 'react';
import {
  ArrowRight,
  BookOpenText,
  CheckCircle2,
  FileWarning,
  GitBranch,
  Globe2,
  MessageSquareText,
  Quote,
  ShieldCheck,
  UploadCloud,
  UsersRound,
  WandSparkles,
  X,
} from 'lucide-react';
import { Link, useLocation, useNavigate } from 'react-router';
import { usePublicModalNavigation } from '../../hooks/usePublicModalNavigation';
import { ActionButton } from './ui-v2/ActionButton';
import { ProductBrand } from './ui-v2/ProductBrand';
import { SurfaceCard } from './ui-v2/SurfaceCard';
import { LandingProductDemo } from './LandingProductDemo';
import './landing-v2.css';
import './landing-video/landing-video-hero.css';
import { LandingVideoHero } from './landing-video/LandingVideoHero';
import uploadArtwork from '../../../assets/landing/catchhole-upload-friendly-v1.png';
import analysisArtwork from '../../../assets/landing/catchhole-analysis-friendly-v1.png';

type Service = {
  category: string;
  description: string;
  icon: ReactNode;
  status?: 'upcoming';
  title: string;
};

const QUICK_ACTIONS = [
  {
    icon: <WandSparkles size={23} />,
    title: '캐릭터·세계관 정리',
    description: '원고에서 인물과 세계관 설정을 찾아 구분해 드려요.',
  },
  {
    icon: <BookOpenText size={23} />,
    title: '원문 근거 연결',
    description: '어떤 문장에서 찾았는지 설정마다 함께 확인해요.',
  },
  {
    icon: <ShieldCheck size={23} />,
    title: '자동 반영·직접 확인',
    description: '명확한 설정은 자동 반영하고 필요한 내용만 확인해요.',
  },
] as const;

const SERVICES: Service[] = [
  {
    icon: <UploadCloud size={25} />,
    category: '원고 관리',
    title: '작품 업로드',
    description: '단일 회차, 다회차 단일 파일, 다회차 여러 파일 중 원하는 방식으로 올리고 감지된 회차 번호와 제목을 확인합니다.',
  },
  {
    icon: <WandSparkles size={25} />,
    category: 'AI 분석',
    title: '캐릭터·세계관 자동 추출',
    description: '원고에서 찾은 명확한 설정은 자동으로 작품에 쌓고, 연결이나 내용 확인이 필요한 항목은 직접 검토하도록 정리합니다.',
  },
  {
    icon: <Globe2 size={25} />,
    category: '세계관',
    title: '세계관 DB',
    description: '장소·세력·규칙 등 확정된 세계관 설정을 분류와 대상별로 정리하고 검색하거나 직접 수정합니다.',
  },
  {
    icon: <UsersRound size={25} />,
    category: '캐릭터',
    title: '캐릭터 DB',
    description: '확정된 인물 설정과 회차별 변화 이력을 모아보고, 현재 설정값이 만들어진 출처까지 이어서 확인합니다.',
  },
  {
    icon: <Quote size={25} />,
    category: '원문 연결',
    title: '원문 근거',
    description: '각 설정이 어느 회차의 어떤 문장에서 나왔는지 원문 인용과 함께 확인하고 판단의 근거로 사용합니다.',
  },
  {
    icon: <GitBranch size={25} />,
    category: '관계 분석',
    title: '캐릭터 관계도',
    description: '캐릭터 사이의 관계를 관점별 그래프로 살펴보는 기능을 준비하고 있습니다.',
    status: 'upcoming',
  },
  {
    icon: <MessageSquareText size={25} />,
    category: 'AI 도우미',
    title: '설정 챗봇',
    description: '작품 설정을 자연어로 묻고 원문 근거와 함께 답을 확인하는 기능을 준비하고 있습니다.',
    status: 'upcoming',
  },
  {
    icon: <FileWarning size={25} />,
    category: '설정 검수',
    title: '오류 리포트',
    description: '설정 충돌과 회차 사이의 불일치를 찾아 한곳에서 검토하는 리포트 기능을 준비하고 있습니다.',
    status: 'upcoming',
  },
];

export default function SLanding() {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const headerRef = useRef<HTMLElement>(null);
  const location = useLocation();
  const navigate = useNavigate();
  const { openAuth } = usePublicModalNavigation();
  const locationState = (location.state ?? {}) as Record<string, unknown>;
  const withdrawalAccepted = locationState.memberWithdrawalAccepted === true;
  const [withdrawalNoticeVisible, setWithdrawalNoticeVisible] = useState(withdrawalAccepted);
  const scrollTo = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
  const openDemo = () => {
    navigate('/demo', { state: { transition: 'dissolve' } });
  };

  useEffect(() => {
    const root = scrollContainerRef.current;
    if (!root || !('IntersectionObserver' in window)
      || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const targets = root.querySelectorAll<HTMLElement>('[data-landing-reveal]');
    const observer = new IntersectionObserver(entries => {
      for (const entry of entries) {
        if (!entry.isIntersecting || entry.intersectionRatio < 0.15) continue;
        (entry.target as HTMLElement).dataset.landingReveal = 'visible';
        observer.unobserve(entry.target);
      }
    }, { root, threshold: 0.15, rootMargin: '0px 0px -64px 0px' });

    for (const target of targets) {
      target.dataset.landingReveal = 'pending';
      observer.observe(target);
    }

    return () => {
      observer.disconnect();
      for (const target of targets) target.dataset.landingReveal = '';
    };
  }, []);

  useEffect(() => {
    if (!withdrawalAccepted) return;
    setWithdrawalNoticeVisible(true);
    const nextState = { ...((location.state ?? {}) as Record<string, unknown>) };
    delete nextState.memberWithdrawalAccepted;
    navigate(`${location.pathname}${location.search}${location.hash}`, {
      replace: true,
      state: nextState,
    });
  }, [location.hash, location.pathname, location.search, location.state, navigate, withdrawalAccepted]);

  return (
    <div ref={scrollContainerRef} className="landing-page theme-v2">
      {withdrawalNoticeVisible && (
        <div className="landing-withdrawal-notice" role="status" aria-live="polite" aria-atomic="true">
          <CheckCircle2 size={20} aria-hidden="true" />
          <span>
            <strong>회원 탈퇴가 접수되었습니다.</strong>
            <span>계정과 세션을 더 이상 사용할 수 없습니다.</span>
          </span>
          <button
            type="button"
            aria-label="회원 탈퇴 안내 닫기"
            onClick={() => setWithdrawalNoticeVisible(false)}
          >
            <X size={18} />
          </button>
        </div>
      )}
      <header ref={headerRef} className="landing-header">
        <div className="landing-header__inner">
          <ProductBrand compact />
          <div className="landing-header__right">
            <nav className="landing-header__nav" aria-label="서비스 소개">
              <button type="button" onClick={() => scrollTo('features')}>서비스 소개</button>
              <button type="button" onClick={() => scrollTo('services')}>주요 서비스</button>
            </nav>
            <div className="landing-header__actions">
              <ActionButton className="landing-header__login-action" size="compact" variant="secondary" onClick={() => openAuth('/login')}>
                로그인
              </ActionButton>
              <ActionButton className="landing-header__signup-action" size="compact" variant="secondary" onClick={() => openAuth('/signup')}>
                무료로 시작하기
              </ActionButton>
              <ActionButton className="landing-primary-action" size="compact" onClick={openDemo}>
                로그인 없이 체험하기
              </ActionButton>
            </div>
          </div>
        </div>
      </header>

      <main>
        <LandingVideoHero
          scrollContainerRef={scrollContainerRef}
          headerRef={headerRef}
          onDemo={openDemo}
          onSignup={() => openAuth("/signup")}
        />

        <section className="landing-demo-section" aria-labelledby="landing-demo-heading">
          <div className="landing-demo-section__inner">
            <div className="landing-demo-section__heading">
              <span data-landing-reveal="">이야기에 집중할 수 있도록</span>
              <h2 id="landing-demo-heading" data-landing-reveal="" data-reveal-order="1">원고가 작품 설정이 되는 과정을<br />직접 확인하세요</h2>
              <p data-landing-reveal="" data-reveal-order="2">원고에서 발견하고, 확인하고, 다시 찾아보는 일. 캐치홀이 함께해요.</p>
            </div>
            <LandingProductDemo />
          </div>
        </section>

        <section className="landing-manuscript-notice" id="manuscript-protection" aria-labelledby="landing-manuscript-notice-heading">
          <div className="landing-section__inner" data-landing-reveal="">
            <h2 id="landing-manuscript-notice-heading">
              작가님의 원고는 <strong>AI 학습에 사용하지 않습니다.</strong>
            </h2>
            <p>원고와 분석 결과 모두에 적용됩니다.</p>
            <Link className="landing-manuscript-notice__link" to="/privacy">
              개인정보 처리방침 보기
              <ArrowRight size={16} aria-hidden="true" />
            </Link>
          </div>
        </section>

        <div className="landing-section__inner landing-quick-actions" aria-label="CatchHole 핵심 기능">
          {QUICK_ACTIONS.map((item, index) => (
            <SurfaceCard className="landing-quick-action" key={item.title} data-landing-reveal="" data-reveal-order={index}>
              <span className="landing-quick-action__top">
                <span className="landing-icon-box">{item.icon}</span>
                <span className="landing-quick-action__number" aria-hidden="true">0{index + 1}</span>
              </span>
              <span className="landing-quick-action__copy">
                <strong>{item.title}</strong>
                <span>{item.description}</span>
              </span>
            </SurfaceCard>
          ))}
        </div>

        <section className="landing-features" id="services">
          <div className="landing-section__inner">
            <div className="landing-section-heading" data-landing-reveal="">
              <div>
                <span className="landing-section-heading__eyebrow">원고에서 시작되는 설정 관리</span>
                <h2>주요 서비스</h2>
              </div>
              <p>
                원고를 올리는 순간부터 설정을 확정하고 다시 찾는 과정까지,
                CatchHole의 기능을 한눈에 확인해 보세요.
              </p>
            </div>
            <div className="landing-feature-grid">
              {SERVICES.map((service, index) => (
                <Fragment key={service.title}>
                  {index === 5 && (
                    <div className="landing-upcoming-heading" data-landing-reveal="">
                      <h3>다음으로 준비하는 기능</h3>
                      <p>더 깊이 살펴보고, 더 쉽게 찾아볼 수 있도록.</p>
                    </div>
                  )}
                  <SurfaceCard
                    className={`landing-feature-card${index < 2 ? ' landing-feature-card--lead' : ''}${service.status === 'upcoming' ? ' landing-feature-card--upcoming' : ''}`}
                    data-landing-reveal=""
                    data-reveal-order={index < 2 ? index : (index - 2) % 3}
                  >
                    {index < 2 && <img className="landing-service-card__artwork" src={index === 0 ? uploadArtwork : analysisArtwork} alt="" loading="lazy" />}
                    <span className="landing-icon-box">{service.icon}</span>
                    <div className="landing-service-card__copy">
                      <div className="landing-service-card__meta">
                        <span>{service.category}</span>
                        {service.status === 'upcoming' && (
                          <span className="landing-service-card__status">업데이트 예정</span>
                        )}
                      </div>
                      <h3>{service.title}</h3>
                      <p>{service.description}</p>
                    </div>
                  </SurfaceCard>
                </Fragment>
              ))}
            </div>
          </div>
        </section>

        <section className="landing-story" aria-labelledby="landing-story-heading">
          <div className="landing-story__inner">
            <span className="landing-story__eyebrow" data-landing-reveal="">캐치홀을 만드는 마음</span>
            <h2 id="landing-story-heading" data-landing-reveal="">
              다음 화를 기다리는 마음으로,<br />
              <span>캐치홀을 만들어요.</span>
            </h2>
            <p data-landing-reveal="">
              웹소설을 좋아하는 한 명의 독자로서,<br />
              좋은 이야기를 써 주시는 작가님들의 수고를 조금 덜어드리고 싶었어요.
            </p>
            <p data-landing-reveal="">
              회차가 쌓일수록 인물과 세계관의 설정도 늘어나죠.<br />
              이미 쓴 내용을 다시 찾고, 설정을 정리하고 확인하는 데에도<br className="landing-story__desktop-break" />
              많은 시간과 노력이 든다는 걸 알게 됐어요.
            </p>
            <p className="landing-story__idea" data-landing-reveal="">
              “원고에서 설정을 알아서 모아주면 어떨까?”<br />
              <span>캐치홀은 그 생각에서 시작했어요.</span>
            </p>
            <p data-landing-reveal="">
              설정을 찾고 정리하는 일은 캐치홀이 돕고,<br />
              작가님은 쓰고 싶은 이야기에 조금 더 집중하실 수 있도록.<br />
              그런 도구를 만들어가고 싶어요.
            </p>
            <div className="landing-story__signature" data-landing-reveal="">
              <strong>작가님의 다음 이야기를, 독자의 마음으로 응원합니다.</strong>
              <span>캐치홀 드림</span>
            </div>
          </div>
        </section>

        <section className="landing-bottom-cta">
          <div className="landing-section__inner">
            <div className="landing-cta" data-landing-reveal="">
              <div>
                <h2>회원가입 없이<br />설정 관리 흐름을 확인하세요</h2>
                <p>가상 원고로 원문 근거를 확인하고, 설정을 직접 검토하는 방식을 체험해 보세요.</p>
              </div>
              <div className="landing-cta__actions">
                <ActionButton className="landing-primary-action" icon={<ArrowRight size={16} />} onClick={openDemo}>
                  로그인 없이 체험하기
                </ActionButton>
                <ActionButton variant="secondary" onClick={() => openAuth('/signup')}>
                  무료로 시작하기
                </ActionButton>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="landing-footer">
        <div className="landing-footer__inner" data-landing-reveal="">
          <div className="landing-footer__brand">
            <ProductBrand compact />
            <span>원문 근거와 함께 관리하는 작품 설정</span>
          </div>
          <div className="landing-footer__links">
            <button type="button" onClick={() => navigate('/privacy')}>개인정보 처리방침</button>
            <button type="button" onClick={() => navigate('/terms')}>이용약관</button>
            <span>© 2026 CatchHole</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
