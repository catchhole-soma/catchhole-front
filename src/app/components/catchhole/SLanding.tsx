import { useEffect, useRef, useState, type ReactNode } from 'react';
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
              <span>8단계 제품 흐름</span>
              <h2 id="landing-demo-heading">원고가 작품 설정이 되는 과정을<br />직접 확인하세요</h2>
              <p>단일 회차에서 직접 검토를 선택한 예시예요. 단계를 선택해 화면을 살펴보세요.</p>
            </div>
            <LandingProductDemo />
          </div>
        </section>

        <section className="landing-manuscript-notice" id="manuscript-protection" aria-labelledby="landing-manuscript-notice-heading">
          <div className="landing-section__inner">
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
          {QUICK_ACTIONS.map(item => (
            <SurfaceCard className="landing-quick-action" key={item.title}>
              <span className="landing-icon-box">{item.icon}</span>
              <span className="landing-quick-action__copy">
                <strong>{item.title}</strong>
                <span>{item.description}</span>
              </span>
            </SurfaceCard>
          ))}
        </div>

        <section className="landing-features" id="services">
          <div className="landing-section__inner">
            <div className="landing-section-heading">
              <h2>주요 서비스</h2>
              <p>
                원고를 올리는 순간부터 설정을 확정하고 다시 찾는 과정까지,
                CatchHole의 기능을 한눈에 확인해 보세요.
              </p>
            </div>
            <div className="landing-feature-grid">
              {SERVICES.map(service => (
                <SurfaceCard className="landing-feature-card" key={service.title}>
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
              ))}
            </div>
          </div>
        </section>

        <section className="landing-bottom-cta">
          <div className="landing-section__inner">
            <div className="landing-cta">
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
        <div className="landing-footer__inner">
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
