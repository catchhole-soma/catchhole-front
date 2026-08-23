import type { ReactNode } from 'react';
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
  Sparkles,
  UploadCloud,
  UsersRound,
  WandSparkles,
} from 'lucide-react';
import { useNavigate } from 'react-router';
import { usePublicModalNavigation } from '../../hooks/usePublicModalNavigation';
import { ActionButton } from './ui-v2/ActionButton';
import { ProductBrand } from './ui-v2/ProductBrand';
import { SurfaceCard } from './ui-v2/SurfaceCard';
import { LandingProductDemo } from './LandingProductDemo';
import './landing-v2.css';

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
    title: '캐릭터·세계관 후보',
    description: '원고에서 인물과 세계관 설정 후보를 구분해 보여드려요.',
  },
  {
    icon: <BookOpenText size={23} />,
    title: '원문 근거 연결',
    description: '어떤 문장에서 찾았는지 후보마다 함께 확인해요.',
  },
  {
    icon: <ShieldCheck size={23} />,
    title: '작가 최종 확정',
    description: '검토한 내용만 작품 설정으로 저장해요.',
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
    description: '회차 원고를 분석해 캐릭터와 세계관 설정 후보를 구분하고, 작가가 확인할 검토 목록으로 정리합니다.',
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
  const navigate = useNavigate();
  const { openAuth, openTerms } = usePublicModalNavigation();
  const scrollTo = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
  const openDemo = () => navigate('/demo', { state: { transition: 'dissolve' } });

  return (
    <div className="landing-page theme-v2">
      <header className="landing-header">
        <div className="landing-header__inner">
          <ProductBrand compact />
          <div className="landing-header__right">
            <nav className="landing-header__nav" aria-label="서비스 소개">
              <button type="button" onClick={() => scrollTo('features')}>서비스 소개</button>
              <button type="button" onClick={() => scrollTo('services')}>주요 서비스</button>
            </nav>
            <div className="landing-header__actions">
              <ActionButton size="compact" variant="secondary" onClick={() => openAuth('/login')}>
                로그인
              </ActionButton>
              <ActionButton size="compact" variant="secondary" onClick={() => openAuth('/signup')}>
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
        <section className="landing-hero" id="features">
          <div className="landing-section__inner landing-hero__inner">
            <div className="landing-hero-copy">
              <div className="landing-eyebrow">
                <Sparkles size={14} />
                웹소설 원고에서 작품 설정까지
              </div>
              <h1 className="landing-hero-title">
                원고 속 캐릭터와 세계관을,<br /><em>근거와 함께 정리하세요</em>
              </h1>
              <p className="landing-hero-description">
                AI가 설정 후보와 원문 근거를 연결해 보여드려요.
                작가님이 확인한 내용만 작품 설정으로 확정합니다.
              </p>
              <div className="landing-actions">
                <ActionButton className="landing-primary-action" icon={<ArrowRight size={16} />} onClick={openDemo}>
                  로그인 없이 체험하기
                </ActionButton>
                <ActionButton variant="secondary" onClick={() => openAuth('/signup')}>
                  지금 무료로 시작하기
                </ActionButton>
              </div>
              <div className="landing-trust">
                <span className="landing-trust__item"><CheckCircle2 size={14} /> 원문 근거까지 한눈에</span>
                <span className="landing-trust__item"><CheckCircle2 size={14} /> 작가가 직접 최종 확정</span>
              </div>
            </div>
          </div>
        </section>

        <section className="landing-demo-section" aria-labelledby="landing-demo-heading">
          <div className="landing-demo-section__inner">
            <div className="landing-demo-section__heading">
              <span>8단계 제품 흐름</span>
              <h2 id="landing-demo-heading">원고가 작품 설정이 되는 과정을<br />직접 확인하세요</h2>
              <p>단계에 마우스를 올리거나 선택하면 실제 CatchHole 화면이 넓게 펼쳐집니다.</p>
            </div>
            <LandingProductDemo />
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
                <p>가상 원고로 후보 추출부터 원문 근거, 작가 확정까지 직접 체험할 수 있어요.</p>
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
            <button type="button" onClick={() => openTerms('privacy')}>개인정보 처리방침</button>
            <button type="button" onClick={() => openTerms('terms')}>이용약관</button>
            <span>© 2026 CatchHole</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
