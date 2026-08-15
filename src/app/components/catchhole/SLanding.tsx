import type { ReactNode } from 'react';
import {
  ArrowRight,
  BookOpenText,
  CheckCircle2,
  Database,
  ShieldCheck,
  Sparkles,
  UploadCloud,
  WandSparkles,
} from 'lucide-react';
import { usePublicModalNavigation } from '../../hooks/usePublicModalNavigation';
import { ActionButton } from './ui-v2/ActionButton';
import { ProductBrand } from './ui-v2/ProductBrand';
import { SurfaceCard } from './ui-v2/SurfaceCard';
import { LandingProductDemo } from './LandingProductDemo';
import './landing-v2.css';

type Feature = {
  description: string;
  icon: ReactNode;
  step: string;
  title: string;
};

const QUICK_ACTIONS = [
  {
    icon: <UploadCloud size={23} />,
    title: '원고 업로드',
    description: '회차 원고를 올리면 분석 준비가 끝나요.',
  },
  {
    icon: <WandSparkles size={23} />,
    title: 'AI 설정 추출',
    description: '인물과 세계관 설정을 근거와 함께 찾아요.',
  },
  {
    icon: <Database size={23} />,
    title: '작품 설정 정리',
    description: '검토한 설정을 작품별로 안전하게 관리해요.',
  },
] as const;

const FEATURES: Feature[] = [
  {
    icon: <BookOpenText size={25} />,
    step: '01',
    title: '원고를 그대로 올리세요',
    description: '복잡한 양식 없이 작업 중인 회차 원고를 업로드하면 작품 단위로 차곡차곡 정리됩니다.',
  },
  {
    icon: <Sparkles size={25} />,
    step: '02',
    title: 'AI가 설정을 찾아드려요',
    description: '캐릭터와 세계관 후보를 추출하고, 어떤 문장에서 찾았는지 원문 근거까지 연결합니다.',
  },
  {
    icon: <ShieldCheck size={25} />,
    step: '03',
    title: '작가가 확인하고 확정해요',
    description: 'AI 제안을 검토한 뒤 필요한 내용만 작품 설정에 저장해 작품의 기준을 직접 관리합니다.',
  },
];

export default function SLanding() {
  const { openAuth, openTerms } = usePublicModalNavigation();
  const scrollTo = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });

  return (
    <div className="landing-page theme-v2">
      <header className="landing-header">
        <div className="landing-header__inner">
          <ProductBrand compact />
          <div className="landing-header__right">
            <nav className="landing-header__nav" aria-label="서비스 소개">
              <button type="button" onClick={() => scrollTo('features')}>서비스 소개</button>
              <button type="button" onClick={() => scrollTo('how-it-works')}>이용 방법</button>
            </nav>
            <div className="landing-header__actions">
              <ActionButton size="compact" variant="secondary" onClick={() => openAuth('/login')}>
                로그인
              </ActionButton>
              <ActionButton size="compact" onClick={() => openAuth('/signup')}>
                무료로 시작하기
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
                웹소설 설정 관리 AI
              </div>
              <h1 className="landing-hero-title">
                이야기의 빈틈은 줄이고,<br /><em>창작의 몰입은 더하고</em>
              </h1>
              <p className="landing-hero-description">
                원고 속 캐릭터와 세계관 설정을 AI가 찾아 정리해 드려요.
                작가님은 이야기의 다음 장면에만 집중하세요.
              </p>
              <div className="landing-actions">
                <ActionButton icon={<ArrowRight size={16} />} onClick={() => openAuth('/signup')}>
                  지금 무료로 시작하기
                </ActionButton>
                <ActionButton variant="secondary" onClick={() => scrollTo('how-it-works')}>
                  서비스 둘러보기
                </ActionButton>
              </div>
              <div className="landing-trust">
                <span className="landing-trust__item"><CheckCircle2 size={14} /> 원문 근거까지 한눈에</span>
                <span className="landing-trust__item"><CheckCircle2 size={14} /> 작가가 직접 최종 확정</span>
              </div>
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

        <section className="landing-features" id="how-it-works">
          <div className="landing-section__inner">
            <div className="landing-section-heading">
              <h2>복잡한 설정 관리,<br />세 단계면 충분해요</h2>
              <p>
                원고 업로드부터 AI 분석, 작가님의 최종 검토까지 하나의 흐름으로 이어집니다.
                작품의 설정은 자동으로 덮어쓰지 않고 언제나 작가님의 확인을 거칩니다.
              </p>
            </div>
            <div className="landing-feature-grid">
              {FEATURES.map(feature => (
                <SurfaceCard className="landing-feature-card" key={feature.step}>
                  <span className="landing-icon-box">{feature.icon}</span>
                  <div className="landing-step__label">
                    <span className="landing-step__number">{feature.step}</span>
                    STEP
                  </div>
                  <h3>{feature.title}</h3>
                  <p>{feature.description}</p>
                </SurfaceCard>
              ))}
            </div>
          </div>
        </section>

        <section className="landing-bottom-cta">
          <div className="landing-section__inner">
            <div className="landing-cta">
              <div>
                <h2>당신의 이야기를<br />더 오래, 단단하게</h2>
                <p>첫 작품을 등록하고 CatchHole의 설정 관리 흐름을 경험해 보세요.</p>
              </div>
              <div className="landing-cta__actions">
                <ActionButton icon={<ArrowRight size={16} />} onClick={() => openAuth('/signup')}>
                  무료로 시작하기
                </ActionButton>
                <ActionButton variant="secondary" onClick={() => openAuth('/login')}>
                  로그인
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
            <span>이야기의 빈틈을 찾는 가장 쉬운 방법</span>
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
