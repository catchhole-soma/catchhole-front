import { useEffect, useMemo, useReducer, useRef, useState, type ReactNode } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  BookOpenText,
  Check,
  CheckCircle2,
  FileCheck2,
  FileText,
  Globe2,
  Info,
  LoaderCircle,
  MousePointer2,
  PencilLine,
  Play,
  RotateCcw,
  Search,
  Sparkles,
  ThumbsDown,
  Users,
  X,
} from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router';
import { AnimatePresence, motion, useReducedMotion, type Variants } from 'motion/react';
import type { CharacterDetailResponse } from '../../api/generated/types.gen';
import { CharacterDatabase } from './character/CharacterDatabase';
import { CharacterTimelineModal } from './character/CharacterTimeline';
import {
  clearTimelineSelection,
  readTimelineSelection,
  writeTimelineSelection,
  type TimelineSelection,
} from './character/character-timeline-filter';
import {
  INTERACTIVE_DEMO_ANALYSIS_PHASES,
  INTERACTIVE_DEMO_CANDIDATES,
  INTERACTIVE_DEMO_CHARACTER_DETAILS,
  INTERACTIVE_DEMO_CHARACTER_EVIDENCE,
  INTERACTIVE_DEMO_CHARACTER_TIMELINES,
  INTERACTIVE_DEMO_MANUSCRIPT,
  createInteractiveDemoWorldSettings,
  type DemoCharacterName,
} from './interactiveDemoFixture';
import { ActionButton } from './ui-v2/ActionButton';
import { ProductBrand } from './ui-v2/ProductBrand';
import { WorldSettingDatabase } from './worldsetting/WorldSettingDatabase';
import './interactive-demo.css';

type DemoScreen = 'analysis' | 'character-review' | 'complete' | 'database' | 'manuscript' | 'unsupported-review' | 'world-review';
type DemoDatabaseTab = 'character' | 'world';
type DemoWorldSubject = '거꾸로숲' | '무저갱 관문' | '백야 원정대';

type DemoState = {
  characterEvidenceId: string | null;
  characterEvidenceSource: 'setting' | 'timeline' | null;
  characterTimelineOpen: boolean;
  characterApproved: boolean;
  databaseTab: DemoDatabaseTab;
  expandedWorldEvidence: string | null;
  screen: DemoScreen;
  selectedCharacter: DemoCharacterName | null;
  selectedWorldSubject: DemoWorldSubject;
  unsupportedRejected: boolean;
  visitedDatabaseTabs: Record<DemoDatabaseTab, boolean>;
  viewedCharacterEvidence: boolean;
  viewedCharacterTimelineEvidence: boolean;
  worldApproved: boolean;
  worldDraft: string;
  worldEditApplied: boolean;
  worldEditing: boolean;
  worldValue: string | null;
};

type DemoAction =
  | { type: 'approve-character' }
  | { type: 'apply-world-edit' }
  | { type: 'cancel-world-editor' }
  | { type: 'close-character-evidence' }
  | { type: 'close-character-detail' }
  | { type: 'close-character-timeline' }
  | { type: 'confirm-world' }
  | { type: 'finish' }
  | { type: 'open-character-detail'; name: DemoCharacterName }
  | { type: 'open-character-evidence'; id: string; source: 'setting' | 'timeline' }
  | { type: 'open-character-timeline' }
  | { type: 'view-character-timeline-evidence' }
  | { type: 'open-world-editor' }
  | { type: 'reject-unsupported' }
  | { type: 'reset' }
  | { type: 'review-candidates' }
  | { type: 'select-database-tab'; tab: DemoDatabaseTab }
  | { type: 'select-world-subject'; subject: DemoWorldSubject }
  | { type: 'start-analysis' }
  | { type: 'toggle-world-evidence'; key: string | null }
  | { type: 'update-world-draft'; value: string };

const DEMO_MILESTONES = ['원고 확인', 'AI 분석', '후보 검토', '결과 탐색', '체험 완료'] as const;

function createInitialState(): DemoState {
  return {
    characterEvidenceId: null,
    characterEvidenceSource: null,
    characterTimelineOpen: false,
    characterApproved: false,
    databaseTab: 'character',
    expandedWorldEvidence: null,
    screen: 'manuscript',
    selectedCharacter: null,
    selectedWorldSubject: '거꾸로숲',
    unsupportedRejected: false,
    visitedDatabaseTabs: { character: false, world: false },
    viewedCharacterEvidence: false,
    viewedCharacterTimelineEvidence: false,
    worldApproved: false,
    worldDraft: INTERACTIVE_DEMO_CANDIDATES.world.proposedValue,
    worldEditApplied: false,
    worldEditing: false,
    worldValue: null,
  };
}

function demoReducer(state: DemoState, action: DemoAction): DemoState {
  switch (action.type) {
    case 'start-analysis':
      return { ...state, screen: 'analysis' };
    case 'review-candidates':
      return { ...state, screen: 'character-review' };
    case 'approve-character':
      return { ...state, characterApproved: true, screen: 'world-review' };
    case 'open-world-editor':
      return { ...state, worldEditing: true };
    case 'cancel-world-editor':
      return { ...state, worldEditing: false, worldDraft: state.worldValue ?? INTERACTIVE_DEMO_CANDIDATES.world.proposedValue };
    case 'update-world-draft':
      return { ...state, worldDraft: action.value };
    case 'apply-world-edit':
      return {
        ...state,
        worldEditApplied: true,
        worldEditing: false,
        worldValue: state.worldDraft.trim(),
      };
    case 'confirm-world':
      return { ...state, screen: 'unsupported-review', worldApproved: true };
    case 'reject-unsupported':
      return {
        ...state,
        characterEvidenceId: null,
        characterEvidenceSource: null,
        characterTimelineOpen: false,
        databaseTab: 'character',
        expandedWorldEvidence: null,
        screen: 'database',
        selectedCharacter: null,
        selectedWorldSubject: '거꾸로숲',
        unsupportedRejected: true,
        visitedDatabaseTabs: { ...state.visitedDatabaseTabs, character: true },
      };
    case 'select-database-tab':
      return {
        ...state,
        characterEvidenceId: null,
        characterEvidenceSource: null,
        characterTimelineOpen: false,
        databaseTab: action.tab,
        expandedWorldEvidence: null,
        selectedCharacter: null,
        selectedWorldSubject: action.tab === 'world' ? '거꾸로숲' : state.selectedWorldSubject,
        visitedDatabaseTabs: { ...state.visitedDatabaseTabs, [action.tab]: true },
      };
    case 'open-character-detail':
      return { ...state, characterEvidenceId: null, characterEvidenceSource: null, characterTimelineOpen: false, selectedCharacter: action.name };
    case 'close-character-detail':
      return { ...state, characterEvidenceId: null, characterEvidenceSource: null, characterTimelineOpen: false, selectedCharacter: null };
    case 'open-character-evidence':
      return {
        ...state,
        characterEvidenceId: action.id,
        characterEvidenceSource: action.source,
        viewedCharacterEvidence: state.viewedCharacterEvidence
          || (state.selectedCharacter === '에단 렌' && action.source === 'setting' && action.id === 'ethan-job-6'),
      };
    case 'close-character-evidence':
      return { ...state, characterEvidenceId: null, characterEvidenceSource: null };
    case 'open-character-timeline':
      return { ...state, characterEvidenceId: null, characterEvidenceSource: null, characterTimelineOpen: true };
    case 'close-character-timeline':
      return { ...state, characterEvidenceId: null, characterEvidenceSource: null, characterTimelineOpen: false };
    case 'view-character-timeline-evidence':
      return state.viewedCharacterTimelineEvidence
        ? state
        : { ...state, viewedCharacterTimelineEvidence: true };
    case 'select-world-subject':
      return { ...state, expandedWorldEvidence: null, selectedWorldSubject: action.subject };
    case 'toggle-world-evidence':
      return { ...state, expandedWorldEvidence: action.key };
    case 'finish':
      return { ...state, screen: 'complete' };
    case 'reset':
      return createInitialState();
    default:
      return state;
  }
}

function milestoneIndex(screen: DemoScreen) {
  if (screen === 'manuscript') return 0;
  if (screen === 'analysis') return 1;
  if (screen === 'character-review' || screen === 'world-review' || screen === 'unsupported-review') return 2;
  if (screen === 'database') return 3;
  return 4;
}

function DemoMilestones({ activeIndex }: { activeIndex: number }) {
  return (
    <ol className="interactive-demo-milestones" aria-label="데모 진행 단계">
      {DEMO_MILESTONES.map((milestone, index) => {
        const complete = index < activeIndex;
        const active = index === activeIndex;
        return (
          <li className={active ? 'is-active' : complete ? 'is-complete' : ''} key={milestone} aria-current={active ? 'step' : undefined}>
            <span>{complete ? <Check size={13} /> : index + 1}</span>
            <strong>{milestone}</strong>
          </li>
        );
      })}
    </ol>
  );
}

type CoachmarkProps = {
  actionLabel?: string;
  current: number;
  description: string;
  onAction?: () => void;
  title: string;
  waiting?: boolean;
};

const coachmarkCardVariants: Variants = {
  hidden: { filter: 'blur(7px)', opacity: 0, scale: 1.12, x: -30, y: 22 },
  visible: {
    filter: 'blur(0px)',
    opacity: 1,
    scale: 1,
    transition: {
      delayChildren: 0.08,
      staggerChildren: 0.065,
      type: 'spring',
      stiffness: 310,
      damping: 19,
      mass: 0.78,
    },
    x: 0,
    y: 0,
  },
  exit: {
    filter: 'blur(4px)',
    opacity: 0,
    scale: 0.97,
    transition: { duration: 0.18, ease: 'easeIn' },
    x: -18,
    y: 8,
  },
};

const coachmarkItemVariants: Variants = {
  hidden: { opacity: 0, y: 10 },
  visible: { opacity: 1, transition: { duration: 0.28, ease: 'easeOut' }, y: 0 },
  exit: { opacity: 0, transition: { duration: 0.12 }, y: -5 },
};

const coachmarkAccentVariants: Variants = {
  hidden: { opacity: 0, scaleX: 0 },
  visible: { opacity: 1, scaleX: 1, transition: { duration: 0.42, ease: 'easeOut' } },
  exit: { opacity: 0, scaleX: 0.6 },
};

function Coachmark({ actionLabel, current, description, onAction, title, waiting = false }: CoachmarkProps) {
  const reduceMotion = useReducedMotion();

  return (
    <motion.aside
      className="interactive-demo-coachmark"
      role="status"
      aria-live="polite"
      data-testid="demo-coachmark"
      variants={reduceMotion ? undefined : coachmarkCardVariants}
      initial={reduceMotion ? false : 'hidden'}
      animate={reduceMotion ? undefined : 'visible'}
      exit={reduceMotion ? undefined : 'exit'}
    >
      <motion.span className="interactive-demo-coachmark__accent" aria-hidden="true" variants={reduceMotion ? undefined : coachmarkAccentVariants} />
      <motion.header variants={reduceMotion ? undefined : coachmarkItemVariants}>
        <span><Sparkles size={14} /> 따라하기 가이드</span>
        <strong>{current} / 5</strong>
      </motion.header>
      <motion.h2 variants={reduceMotion ? undefined : coachmarkItemVariants}>{title}</motion.h2>
      <motion.p variants={reduceMotion ? undefined : coachmarkItemVariants}>{description}</motion.p>
      <motion.footer variants={reduceMotion ? undefined : coachmarkItemVariants}>
        <span>
          {waiting ? <LoaderCircle className="spin" size={15} /> : <MousePointer2 size={15} />}
          {waiting ? 'fixture 분석이 자동으로 진행됩니다.' : '파란색으로 강조된 곳에서 직접 행동해 보세요.'}
        </span>
        {actionLabel && onAction && <button type="button" onClick={onAction}>{actionLabel}<ArrowRight size={13} /></button>}
      </motion.footer>
    </motion.aside>
  );
}

function DemoFrameHeader({ eyebrow, title }: { eyebrow: string; title: string }) {
  return (
    <header className="interactive-demo-frame__header">
      <div>
        <small>{eyebrow}</small>
        <h1 id="interactive-demo-stage-title" tabIndex={-1}>{title}</h1>
      </div>
      <span className="interactive-demo-avatar" aria-hidden="true">K</span>
    </header>
  );
}

function ManuscriptScreen({ onStart }: { onStart: () => void }) {
  return (
    <section className="interactive-demo-frame" aria-labelledby="interactive-demo-stage-title">
      <DemoFrameHeader eyebrow="DEMO MANUSCRIPT" title="가상 원고 확인" />
      <div className="interactive-demo-manuscript">
        <article className="interactive-demo-manuscript__paper">
          <header>
            <span><BookOpenText size={18} /></span>
            <div>
              <strong>{INTERACTIVE_DEMO_MANUSCRIPT.episode} · {INTERACTIVE_DEMO_MANUSCRIPT.title}</strong>
              <small>{INTERACTIVE_DEMO_MANUSCRIPT.fileName} · 데모용 가상 원고</small>
            </div>
          </header>
          <div className="interactive-demo-manuscript__body">
            {INTERACTIVE_DEMO_MANUSCRIPT.paragraphs.map(paragraph => (
              <p className={paragraph.tone ? `is-${paragraph.tone}` : ''} key={paragraph.id}>{paragraph.text}</p>
            ))}
          </div>
        </article>

        <aside className="interactive-demo-manuscript__summary">
          <div className="interactive-demo-work-label">
            <span>데모 작품</span>
            <strong>{INTERACTIVE_DEMO_MANUSCRIPT.workTitle}</strong>
            <small>현대 판타지 · fixture 데이터</small>
          </div>
          <div className="interactive-demo-value-preview">
            <Sparkles size={19} />
            <div>
              <strong>이 원고에서 무엇을 찾을까요?</strong>
              <p>AI가 캐릭터 변화와 세계관 규칙 후보를 찾고, 원문 근거와 함께 검토할 수 있게 준비합니다.</p>
            </div>
          </div>
          <ul>
            <li><CheckCircle2 size={15} /> 실제 서비스 형식의 AI 결과 fixture</li>
            <li><CheckCircle2 size={15} /> Backend와 라이브 LLM 호출 없음</li>
            <li><CheckCircle2 size={15} /> 새로고침하면 언제든 처음부터 시작</li>
          </ul>
          <div className="interactive-demo-manuscript__actions">
            <ActionButton className="interactive-demo-guided-target" data-demo-focus="true" icon={<Play size={16} />} onClick={onStart}>
              AI 분석 시작
            </ActionButton>
          </div>
        </aside>
      </div>
    </section>
  );
}

type AnalysisScreenProps = {
  complete: boolean;
  phase: number;
  onReview: () => void;
};

function AnalysisScreen({ complete, phase, onReview }: AnalysisScreenProps) {
  const currentStatus = complete
    ? INTERACTIVE_DEMO_ANALYSIS_PHASES[INTERACTIVE_DEMO_ANALYSIS_PHASES.length - 1]
    : INTERACTIVE_DEMO_ANALYSIS_PHASES[Math.min(phase, INTERACTIVE_DEMO_ANALYSIS_PHASES.length - 1)];
  const uploadSteps = ['업로드 방식', '회차 정보 입력', '분석 진행'] as const;

  return (
    <section className="interactive-demo-frame" aria-labelledby="interactive-demo-stage-title">
      <DemoFrameHeader eyebrow="MANUSCRIPT" title="회차 업로드" />
      <div className="interactive-demo-analysis">
        <ol className="interactive-demo-analysis__upload-steps" aria-label="회차 업로드 단계">
          {uploadSteps.map((step, index) => (
            <li className={index === uploadSteps.length - 1 ? 'is-current' : 'is-complete'} key={step}>
              <span>{index === uploadSteps.length - 1 ? index + 1 : <Check size={12} />}</span>
              <strong>{step}</strong>
            </li>
          ))}
        </ol>

        <section className="interactive-demo-analysis__surface">
          <div className="interactive-demo-analysis__hero">
            <span className={`interactive-demo-analysis__status-icon ${complete ? 'is-complete' : 'is-running'}`}>
              {complete ? <Check size={27} /> : <LoaderCircle className="spin" size={25} />}
            </span>
            <h2>{complete ? '분석이 완료되었습니다' : '회차를 분석하고 있습니다'}</h2>
            <p>{INTERACTIVE_DEMO_MANUSCRIPT.workTitle} · 기존 설정 구축</p>
          </div>

          <article className="interactive-demo-analysis__episode" aria-label={`${INTERACTIVE_DEMO_MANUSCRIPT.episode} 분석 상태`}>
            <header>
              <strong>{INTERACTIVE_DEMO_MANUSCRIPT.episode} {INTERACTIVE_DEMO_MANUSCRIPT.title}</strong>
              <span className={complete ? 'is-complete' : 'is-running'} aria-live="polite">{currentStatus}</span>
            </header>
            <div className="interactive-demo-analysis__phases">
              {INTERACTIVE_DEMO_ANALYSIS_PHASES.map((item, index) => {
                const reached = complete || index <= phase;
                const current = !complete && index === phase;
                return <span className={current ? 'is-current' : reached ? 'is-complete' : ''} key={item}>{item}</span>;
              })}
            </div>
          </article>

          <footer className="interactive-demo-analysis__actions">
            <button type="button" disabled>분석 목록으로</button>
            {complete ? (
              <ActionButton className="interactive-demo-guided-target" data-demo-focus="true" icon={<ArrowRight size={16} />} onClick={onReview}>
                설정 후보 검토
              </ActionButton>
            ) : (
              <ActionButton disabled>분석 진행 중...</ActionButton>
            )}
          </footer>
        </section>
      </div>
    </section>
  );
}

type CandidateKey = keyof typeof INTERACTIVE_DEMO_CANDIDATES;

function CandidateRail({ active, completed }: { active: CandidateKey; completed: CandidateKey[] }) {
  const characterActive = active === 'character';
  const candidates: Array<{ key: CandidateKey; meta: string; title: string }> = characterActive
    ? [{ key: 'character', meta: '1개 설정 · 6화', title: '에단 렌' }]
    : [
        { key: 'world', meta: '1개 설정 · 6화', title: '장소 · 거꾸로숲' },
        { key: 'unsupported', meta: '1개 설정 · 6화', title: '규칙·역사 · 검은 달' },
      ];

  return (
    <aside className="interactive-demo-candidate-rail" aria-label="데모 설정 후보">
      <div className="interactive-demo-review-filter">
        <small>검토 상태</small>
        <span className="is-active">검토 대기</span><span>전체</span><span>확정</span><span>{characterActive ? '무시' : '제외됨'}</span>
      </div>
      {!characterActive && <div className="interactive-demo-review-filter"><small>세계관 분류</small><span className="is-active">전체</span><span>장소</span><span>규칙·역사</span></div>}
      <small className="interactive-demo-candidate-rail__order">{characterActive ? '↑ 회차 번호 · 생성 순' : '대상별 변경 묶음 · 생성 순'}</small>
      {candidates.map(candidate => {
        const done = completed.includes(candidate.key);
        const selected = active === candidate.key;
        return (
          <article className={selected ? 'is-active' : done ? 'is-complete' : ''} key={candidate.key}>
            <header><strong>{candidate.title}</strong><span>{done ? <Check size={12} /> : '1'}</span></header>
            <small>{candidate.meta}</small>
            {candidate.key === 'unsupported' && !done && <em>1개 확인 필요</em>}
          </article>
        );
      })}
    </aside>
  );
}

type ReviewShellProps = {
  active: CandidateKey;
  children: ReactNode;
  completed: CandidateKey[];
};

function ReviewShell({ active, children, completed }: ReviewShellProps) {
  const characterActive = active === 'character';
  const reviewed = completed.length;
  return (
    <section className="interactive-demo-frame" aria-labelledby="interactive-demo-stage-title">
      <DemoFrameHeader eyebrow="AI ANALYSIS" title={characterActive ? '캐릭터 후보 확정' : '세계관 후보 확정'} />
      <div className="interactive-demo-review-summary">
        <span><small>분석 대상</small><strong>6화 · 1개 회차</strong></span>
        <span><small>전체 후보</small><strong>3개</strong></span>
        <span><small>검토 완료</small><strong>{reviewed}개</strong></span>
        <span><small>검토 대기</small><strong>{3 - reviewed}개</strong></span>
        <span><small>확인 필요</small><strong>{completed.includes('unsupported') ? '0개' : '1개'}</strong></span>
        <em>{reviewed}/3 검토</em>
      </div>
      <nav className="interactive-demo-review-tabs" aria-label="설정 후보 종류">
        <button type="button" className={characterActive ? 'is-active' : ''} disabled={!characterActive}><Users size={15} /> 캐릭터 후보 <span>{completed.includes('character') ? 1 : 0}/1</span></button>
        <button type="button" className={!characterActive ? 'is-active' : ''} disabled={characterActive}><Globe2 size={15} /> 세계관 후보 <span>{completed.filter(item => item !== 'character').length}/2</span></button>
      </nav>
      <div className="interactive-demo-review-layout">
        <CandidateRail active={active} completed={completed} />
        <main className="interactive-demo-candidate-detail">{children}</main>
      </div>
    </section>
  );
}

function EvidenceCard({ children }: { children: ReactNode }) {
  return (
    <blockquote className="interactive-demo-evidence">
      <FileText size={18} />
      <div><strong>1차 추출 원문 · 6화</strong><p>{children}</p></div>
    </blockquote>
  );
}

function CharacterReviewScreen({ onApprove }: { onApprove: () => void }) {
  const candidate = INTERACTIVE_DEMO_CANDIDATES.character;
  return (
    <ReviewShell active="character" completed={[]}>
      <header className="interactive-demo-review-group-heading">
        <div><small>같은 캐릭터 후보</small><h2>에단 렌 <span>1개 설정</span></h2></div>
        <span>캐릭터 일괄 연결</span>
        <p>같은 캐릭터에서 추출된 설정을 아래로 이어서 검토하고 남은 항목을 함께 확정합니다.</p>
      </header>
      <header className="interactive-demo-candidate-detail__title">
        <div><small>프로필 · {candidate.settingName}</small><h2>{candidate.subject}</h2></div>
        <div className="interactive-demo-candidate-row-actions">
          <span className="interactive-demo-confidence">근거 명확도 98%</span>
          <ActionButton size="compact" variant="secondary" disabled>수정</ActionButton>
          <ActionButton size="compact" variant="secondary" disabled>제외</ActionButton>
        </div>
      </header>
      <EvidenceCard>{candidate.evidence}</EvidenceCard>
      <div className="interactive-demo-diff">
        <div><small>− 기존값</small><strong>{candidate.beforeValue}</strong></div>
        <ArrowRight size={20} />
        <div className="is-proposed"><small>+ 제안값</small><strong>{candidate.proposedValue}</strong></div>
      </div>
      <div className="interactive-demo-ai-reasoning"><Sparkles size={17} /><p><strong>AI 비교 판단</strong>{candidate.reasoning}</p></div>
      <footer className="interactive-demo-group-confirm">
        <p><strong>에단 렌의 1개 설정을 함께 확정합니다.</strong><small>각 항목의 제안을 함께 처리합니다.</small></p>
        <ActionButton className="interactive-demo-guided-target" data-demo-focus="true" icon={<CheckCircle2 size={16} />} onClick={onApprove}>
          1개 설정 모두 확정
        </ActionButton>
      </footer>
    </ReviewShell>
  );
}

type WorldReviewScreenProps = {
  draft: string;
  editApplied: boolean;
  editing: boolean;
  onApplyEdit: () => void;
  onCancelEdit: () => void;
  onChange: (value: string) => void;
  onConfirm: () => void;
  onEdit: () => void;
};

function WorldReviewScreen({ draft, editApplied, editing, onApplyEdit, onCancelEdit, onChange, onConfirm, onEdit }: WorldReviewScreenProps) {
  const candidate = INTERACTIVE_DEMO_CANDIDATES.world;
  const validEdit = draft.trim().length > 0 && draft.trim() !== candidate.proposedValue;
  return (
    <ReviewShell active="world" completed={['character']}>
      <header className="interactive-demo-review-group-heading">
        <div><small>같은 세계관 대상</small><h2>장소 · 거꾸로숲 <span>1개 설정</span></h2></div>
        <span>분류·대상 일괄 수정</span>
        <p>같은 대상에서 추출된 설정을 항목별로 검토합니다.</p>
      </header>
      <header className="interactive-demo-candidate-detail__title">
        <div><small>설정 항목</small><h2>{candidate.settingName}</h2></div>
        <div className="interactive-demo-candidate-row-actions">
          <span className="interactive-demo-operation">추가</span>
          <span className="interactive-demo-evidence-badge">6화 근거</span>
          <ActionButton
            className={!editApplied && !editing ? 'interactive-demo-guided-target' : undefined}
            data-demo-focus={!editApplied && !editing ? 'true' : undefined}
            size="compact"
            variant="secondary"
            icon={<PencilLine size={13} />}
            onClick={onEdit}
          >
            수정
          </ActionButton>
          <ActionButton size="compact" variant="secondary" disabled>제외</ActionButton>
        </div>
      </header>
      <div className="interactive-demo-diff">
        <div><small>− 기존값</small><strong>{candidate.beforeValue}</strong></div>
        <ArrowRight size={20} />
        <div className="is-proposed"><small>+ 제안값</small><strong>{editApplied ? draft : candidate.proposedValue}</strong></div>
      </div>
      <div className="interactive-demo-ai-reasoning is-warning"><Sparkles size={17} /><p><strong>AI 비교 판단</strong>{candidate.reasoning}</p></div>
      <EvidenceCard>{candidate.evidence}</EvidenceCard>
      {editApplied && <div className="interactive-demo-edit-applied" role="status"><CheckCircle2 size={15} /> 수정안이 적용되었습니다. 대상 그룹을 확정하면 세계관 설정에 반영됩니다.</div>}
      <footer className="interactive-demo-group-confirm">
        <p><strong>거꾸로숲의 1개 설정을 함께 확정합니다.</strong><small>{editApplied ? '수정한 최종 설정값을 반영합니다.' : '수정에서 최종 설정값을 먼저 정해 주세요.'}</small></p>
        <ActionButton
          className={editApplied ? 'interactive-demo-guided-target' : undefined}
          data-demo-focus={editApplied ? 'true' : undefined}
          icon={<Check size={15} />}
          disabled={!editApplied}
          onClick={onConfirm}
        >
          모두 확정
        </ActionButton>
      </footer>

      {editing && (
        <div className="interactive-demo-review-modal-layer" role="presentation">
          <form className="interactive-demo-review-modal interactive-demo-guided-target" onSubmit={event => { event.preventDefault(); if (validEdit) onApplyEdit(); }}>
            <header><strong>귀환문의 조건 반영 내용 수정</strong><button type="button" aria-label="닫기" onClick={onCancelEdit}><X size={18} /></button></header>
            <div className="interactive-demo-review-modal__body">
              <p>이 설정 항목 하나의 분류·대상·범위·설정명·반영 방식·최종값을 수정합니다. 다른 항목에는 적용되지 않으며 LLM 재비교도 호출하지 않습니다.</p>
              <div className="interactive-demo-review-modal__identity">
                <label>분류<select aria-label="분류" defaultValue="LOCATION"><option value="LOCATION">장소</option><option value="WORLD_RULE_HISTORY">규칙·역사</option></select></label>
                <label>대상<input aria-label="대상" defaultValue="거꾸로숲" /></label>
              </div>
              <div className="interactive-demo-review-modal__property">
                <label>범위 (선택)<input aria-label="범위 (선택)" placeholder="예: 1층" /></label>
                <label>설정명<input aria-label="설정명" defaultValue={candidate.settingName} /></label>
              </div>
              <div className="interactive-demo-review-modal__value">
                <label>반영 방식<select aria-label="반영 방식" defaultValue="ADD"><option value="ADD">추가</option><option value="UPDATE">수정</option><option value="EXCLUDE">제외</option></select></label>
                <label htmlFor="interactive-demo-world-value">최종 설정값<textarea id="interactive-demo-world-value" data-demo-focus="true" value={draft} onChange={event => onChange(event.target.value)} rows={4} /></label>
              </div>
              {!validEdit && <div className="interactive-demo-review-modal__hint">AI 제안과 다른 최종 설정값을 입력해 주세요.</div>}
            </div>
            <footer><ActionButton type="button" variant="secondary" onClick={onCancelEdit}>취소</ActionButton><ActionButton type="submit" disabled={!validEdit}>수정안 적용</ActionButton></footer>
          </form>
        </div>
      )}
    </ReviewShell>
  );
}

function UnsupportedReviewScreen({ onExclude }: { onExclude: () => void }) {
  const candidate = INTERACTIVE_DEMO_CANDIDATES.unsupported;
  return (
    <ReviewShell active="unsupported" completed={['character', 'world']}>
      <header className="interactive-demo-review-group-heading">
        <div><small>같은 세계관 대상</small><h2>규칙·역사 · 검은 달 <span>1개 설정</span></h2></div>
        <span>분류·대상 일괄 수정</span>
        <p>같은 대상에서 추출된 설정을 항목별로 검토합니다.</p>
      </header>
      <header className="interactive-demo-candidate-detail__title">
        <div><small>설정 항목</small><h2>{candidate.settingName}</h2></div>
        <div className="interactive-demo-candidate-row-actions">
          <span className="interactive-demo-operation">추가</span>
          <span className="interactive-demo-evidence-badge">6화 근거</span>
          <ActionButton size="compact" variant="secondary" disabled>수정</ActionButton>
          <ActionButton className="interactive-demo-action--danger interactive-demo-guided-target" data-demo-focus="true" size="compact" variant="secondary" onClick={onExclude}>제외</ActionButton>
        </div>
      </header>
      <div className="interactive-demo-diff">
        <div><small>− 기존값</small><strong>{candidate.beforeValue}</strong></div>
        <ArrowRight size={20} />
        <div className="is-proposed"><small>+ 제안값</small><strong>{candidate.proposedValue}</strong></div>
      </div>
      <div className="interactive-demo-ai-reasoning is-danger"><Info size={17} /><p><strong>AI 비교 판단</strong>{candidate.reasoning}</p></div>
      <EvidenceCard>{candidate.evidence}</EvidenceCard>
      <footer className="interactive-demo-group-confirm">
        <p><strong>검은 달의 1개 설정을 검토 중입니다.</strong><small>근거가 부족한 항목은 제외하면 세계관 설정에 저장되지 않습니다.</small></p>
        <ActionButton disabled>모두 확정</ActionButton>
      </footer>
    </ReviewShell>
  );
}

type DatabaseScreenProps = {
  activeTab: DemoDatabaseTab;
  characterEvidenceId: string | null;
  characterTimelineOpen: boolean;
  onCloseCharacter: () => void;
  onCloseCharacterEvidence: () => void;
  onCloseCharacterTimeline: () => void;
  onOpenCharacter: (name: DemoCharacterName) => void;
  onOpenCharacterEvidence: (id: string, source: 'setting' | 'timeline') => void;
  onOpenCharacterTimeline: () => void;
  onSelectTab: (tab: DemoDatabaseTab) => void;
  onSelectWorldSubject: (subject: DemoWorldSubject) => void;
  onToggleWorldEvidence: (key: string | null) => void;
  selectedCharacter: DemoCharacterName | null;
  timelineFactId: string | null;
  timelineSelection: TimelineSelection;
  viewedCharacterTimelineEvidence: boolean;
  worldValue: string;
};

function DatabaseScreen({
  activeTab,
  characterEvidenceId,
  characterTimelineOpen,
  onCloseCharacter,
  onCloseCharacterEvidence,
  onCloseCharacterTimeline,
  onOpenCharacter,
  onOpenCharacterEvidence,
  onOpenCharacterTimeline,
  onSelectTab,
  onSelectWorldSubject,
  onToggleWorldEvidence,
  selectedCharacter,
  timelineFactId,
  timelineSelection,
  viewedCharacterTimelineEvidence,
  worldValue,
}: DatabaseScreenProps) {
  const reduceMotion = useReducedMotion();
  const [, setSearchParams] = useSearchParams();
  const [demoCharacters, setDemoCharacters] = useState<CharacterDetailResponse[]>(
    () => INTERACTIVE_DEMO_CHARACTER_DETAILS,
  );
  const [demoArchivedCharacters, setDemoArchivedCharacters] = useState<CharacterDetailResponse[]>([]);
  const [isEditingCharacter, setIsEditingCharacter] = useState(false);
  const [archiveOpen, setArchiveOpen] = useState(false);
  const worldSettings = useMemo(() => createInteractiveDemoWorldSettings(worldValue), [worldValue]);
  const guideWorldTab = activeTab === 'character' && !selectedCharacter && viewedCharacterTimelineEvidence;

  const applyTimelineSelection = (selection: TimelineSelection) => {
    setSearchParams(previous => {
      const next = new URLSearchParams(previous);
      writeTimelineSelection(next, selection);
      next.delete('timelineView');
      next.delete('timelineEpisodeNo');
      next.delete('timelineFactId');
      return next;
    }, { replace: true });
  };

  return (
    <section className="interactive-demo-frame interactive-demo-database-frame workspace-v2 database-v2" aria-labelledby="interactive-demo-stage-title">
      <div className="interactive-demo-dashboard-heading">
        <div><small>설정 대시보드</small><h1 id="interactive-demo-stage-title">마나 0의 짐꾼 <span>현대 판타지</span></h1></div>
        <button type="button" disabled>회차 올리기</button>
      </div>
      <div className="interactive-demo-dashboard-tabs" role="tablist" aria-label="설정 대시보드 탭">
        <button type="button" role="tab" aria-selected={activeTab === 'character'} className={activeTab === 'character' ? 'is-active' : ''} onClick={() => onSelectTab('character')}>
          <Users size={15} /> 캐릭터 설정
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'world'}
          className={`${activeTab === 'world' ? 'is-active' : ''}${guideWorldTab ? ' interactive-demo-guided-target interactive-demo-guided-target--soft' : ''}`}
          data-demo-focus={guideWorldTab ? 'true' : undefined}
          onClick={() => onSelectTab('world')}
        >
          <Globe2 size={15} /> 세계관 설정
        </button>
        <button type="button" disabled><BookOpenText size={15} /> 설정집 목록</button>
        <button type="button" disabled><Search size={15} /> 설정 검색</button>
      </div>

      <AnimatePresence initial={false} mode="wait">
        <motion.main
          key={activeTab}
          className="interactive-demo-dashboard-content"
          initial={reduceMotion ? false : { opacity: 0, x: 10 }}
          animate={{ opacity: 1, x: 0 }}
          exit={reduceMotion ? { opacity: 1 } : { opacity: 0, x: -7 }}
          transition={reduceMotion ? { duration: 0 } : { duration: 0.22, ease: 'easeOut' }}
        >
          {activeTab === 'character' ? (
            <>
              <CharacterDatabase
                workId="interactive-demo"
                selectedCharacterId={selectedCharacter}
                selectedEvidenceFactId={characterEvidenceId}
                isEditing={isEditingCharacter}
                demoMode
                archiveOpen={archiveOpen}
                demoCharacters={demoCharacters}
                demoArchivedCharacters={demoArchivedCharacters}
                demoEvidence={INTERACTIVE_DEMO_CHARACTER_EVIDENCE}
                persistDemoState={false}
                setDemoCharacters={setDemoCharacters}
                setDemoArchivedCharacters={setDemoArchivedCharacters}
                onOpen={(characterId) => onOpenCharacter(characterId as DemoCharacterName)}
                onClose={onCloseCharacter}
                onEvidenceOpen={factId => onOpenCharacterEvidence(factId, 'setting')}
                onEvidenceClose={onCloseCharacterEvidence}
                timelineOpen={characterTimelineOpen}
                timelineEvidenceOpen={timelineFactId != null}
                appliedTimelineSelection={timelineSelection}
                onTimelineOpen={onOpenCharacterTimeline}
                onTimelineClose={onCloseCharacterTimeline}
                onTimelineSelectionChange={applyTimelineSelection}
                onArchiveOpen={() => setArchiveOpen(true)}
                onArchiveClose={() => setArchiveOpen(false)}
                onEditChange={setIsEditingCharacter}
                onEditComplete={() => setIsEditingCharacter(false)}
                onAnalyze={() => undefined}
              />
              {characterTimelineOpen && selectedCharacter && (
                <CharacterTimelineModal
                  workId="interactive-demo"
                  characterId={selectedCharacter}
                  demoMode
                  demoData={{
                    ...INTERACTIVE_DEMO_CHARACTER_TIMELINES[selectedCharacter],
                    evidenceByFactId: INTERACTIVE_DEMO_CHARACTER_EVIDENCE,
                  }}
                  onClose={onCloseCharacterTimeline}
                />
              )}
            </>
          ) : (
            <WorldSettingDatabase
              workId="interactive-demo"
              enabled
              onAnalyze={() => undefined}
              fixture={{
                settings: worldSettings,
                onSelectionChange: (_, subjectName) => {
                  if (subjectName === '거꾸로숲' || subjectName === '무저갱 관문' || subjectName === '백야 원정대') {
                    onSelectWorldSubject(subjectName);
                  }
                },
                onEvidenceToggle: ({ subjectName, settingName, expanded }) => {
                  if (subjectName !== '거꾸로숲' || settingName !== '귀환문의 조건') return;
                  onToggleWorldEvidence(expanded ? '거꾸로숲:귀환문의 조건' : null);
                },
              }}
            />
          )}
        </motion.main>
      </AnimatePresence>
    </section>
  );
}

function CompleteScreen({ onRestart, onSignup }: { onRestart: () => void; onSignup: () => void }) {
  return (
    <section className="interactive-demo-complete" aria-labelledby="interactive-demo-stage-title">
      <div className="interactive-demo-complete__icon"><Check size={34} /></div>
      <span>INTERACTIVE DEMO COMPLETE</span>
      <h1 id="interactive-demo-stage-title">한 편의 원고가<br />작품의 기준이 되었습니다</h1>
      <p>CatchHole은 AI가 찾은 내용을 자동으로 덮어쓰지 않습니다.<br />원문 근거를 확인하고, 작가가 결정한 설정만 작품에 남깁니다.</p>
      <div className="interactive-demo-complete__results">
        <article><span className="is-success"><CheckCircle2 /></span><small>캐릭터 후보 확정</small><strong>에단 렌 · 재액 운반자</strong></article>
        <article><span className="is-primary"><PencilLine /></span><small>세계관 수정안 적용·확정</small><strong>거꾸로숲 · 귀환문의 조건</strong></article>
        <article><span className="is-danger"><ThumbsDown /></span><small>근거 부족 후보 제외</small><strong>검은 달 · 왕실의 멸망</strong></article>
      </div>
      <div className="interactive-demo-complete__actions">
        <ActionButton onClick={onSignup} icon={<ArrowRight size={16} />}>내 작품으로 시작하기</ActionButton>
        <ActionButton onClick={onRestart} variant="secondary" icon={<RotateCcw size={16} />}>다시 체험하기</ActionButton>
      </div>
      <small className="interactive-demo-complete__note"><FileCheck2 size={14} /> 이 체험에서는 실제 원고와 계정 정보가 저장되지 않았습니다.</small>
    </section>
  );
}

export default function SInteractiveDemo() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const reduceMotion = useReducedMotion();
  const pageRef = useRef<HTMLDivElement>(null);
  const guideFocusLayerRef = useRef<HTMLDivElement>(null);
  const guideFocusBoxRef = useRef<HTMLDivElement>(null);
  const [state, dispatch] = useReducer(demoReducer, undefined, createInitialState);
  const [analysisPhase, setAnalysisPhase] = useState(0);
  const analysisComplete = analysisPhase >= INTERACTIVE_DEMO_ANALYSIS_PHASES.length;
  const timelineSelection = useMemo(() => readTimelineSelection(searchParams), [searchParams]);
  const timelineFactId = searchParams.get('timelineFactId');

  useEffect(() => {
    const previousTitle = document.title;
    document.title = '인터랙티브 데모 | CatchHole';
    return () => { document.title = previousTitle; };
  }, []);

  useEffect(() => {
    if (!state.selectedCharacter) return undefined;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      if (state.characterTimelineOpen) return;
      if (state.characterEvidenceId) dispatch({ type: 'close-character-evidence' });
      else dispatch({ type: 'close-character-detail' });
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [state.characterEvidenceId, state.characterTimelineOpen, state.selectedCharacter]);

  useEffect(() => {
    if (
      state.characterTimelineOpen
      && state.selectedCharacter === '에단 렌'
      && timelineFactId === 'ethan-job-6'
      && !state.viewedCharacterTimelineEvidence
    ) {
      dispatch({ type: 'view-character-timeline-evidence' });
    }
  }, [state.characterTimelineOpen, state.selectedCharacter, state.viewedCharacterTimelineEvidence, timelineFactId]);

  useEffect(() => {
    if (state.screen !== 'analysis') {
      setAnalysisPhase(0);
      return undefined;
    }
    if (analysisComplete) return undefined;

    const timer = window.setTimeout(() => setAnalysisPhase(current => current + 1), 560);
    return () => window.clearTimeout(timer);
  }, [analysisComplete, analysisPhase, state.screen]);

  useEffect(() => {
    const page = pageRef.current;
    page?.scrollTo({ top: 0, left: 0 });
  }, [state.databaseTab, state.screen]);

  useEffect(() => {
    const page = pageRef.current;
    if (!page) return undefined;

    page.querySelectorAll<HTMLElement>('[data-demo-runtime-focus="true"]').forEach(element => {
      element.classList.remove(
        'interactive-demo-guided-target',
        'interactive-demo-guided-target--inline',
        'interactive-demo-guided-target--soft',
      );
      element.removeAttribute('data-demo-focus');
      element.removeAttribute('data-demo-runtime-focus');
    });

    if (state.screen !== 'database') return undefined;

    const byLabel = (label: string) => page.querySelector<HTMLElement>(`[aria-label="${label}"]`);
    const buttonWithText = (copy: string) => Array.from(page.querySelectorAll<HTMLButtonElement>('button'))
      .find(button => button.textContent?.includes(copy)) ?? null;
    const findTarget = () => {
      let nextTarget: HTMLElement | null = null;

      if (state.databaseTab === 'character') {
        if (!state.selectedCharacter) {
          nextTarget = byLabel('에단 렌 캐릭터 상세 보기');
        } else if (state.selectedCharacter === '에단 렌') {
          const occupationSelected = timelineSelection.factKeys.includes('profile.occupation')
            || timelineSelection.factTypes.includes('PROFILE');
          if (state.characterEvidenceId === 'ethan-job-6') {
            nextTarget = null;
          } else if (!state.viewedCharacterEvidence) {
            nextTarget = byLabel('직업 원문 근거 보기');
          } else if (!state.characterTimelineOpen && !state.viewedCharacterTimelineEvidence) {
            nextTarget = buttonWithText('변화 이력 보기');
          } else if (state.characterTimelineOpen && !occupationSelected) {
            nextTarget = byLabel('직업 변화 이력 추가');
          } else if (state.characterTimelineOpen && !state.viewedCharacterTimelineEvidence) {
            nextTarget = byLabel('6화 직업 원문 근거 보기');
          } else if (state.characterTimelineOpen && !timelineFactId) {
            nextTarget = buttonWithText('이력 닫기');
          } else if (!state.characterTimelineOpen && state.viewedCharacterTimelineEvidence) {
            nextTarget = byLabel('닫기');
          }
        }
      } else if (state.selectedWorldSubject !== '거꾸로숲') {
        nextTarget = byLabel('거꾸로숲 세계관 대상 보기');
      } else {
        nextTarget = byLabel('귀환문의 조건 원문 근거 보기');
      }

      return nextTarget;
    };

    let target: HTMLElement | null = null;
    const applyTarget = () => {
      const nextTarget = findTarget();
      if (nextTarget === target) return;

      target?.classList.remove(
        'interactive-demo-guided-target',
        'interactive-demo-guided-target--inline',
        'interactive-demo-guided-target--soft',
      );
      target?.removeAttribute('data-demo-focus');
      target?.removeAttribute('data-demo-runtime-focus');
      target = nextTarget;

      target?.classList.add('interactive-demo-guided-target', 'interactive-demo-guided-target--soft');
      if (target?.closest('.character-detail-header')) {
        target.classList.add('interactive-demo-guided-target--inline');
      }
      target?.setAttribute('data-demo-focus', 'true');
      target?.setAttribute('data-demo-runtime-focus', 'true');
    };

    applyTarget();
    const observer = new MutationObserver(applyTarget);
    observer.observe(page, { childList: true, subtree: true });

    return () => {
      observer.disconnect();
      target?.classList.remove(
        'interactive-demo-guided-target',
        'interactive-demo-guided-target--inline',
        'interactive-demo-guided-target--soft',
      );
      target?.removeAttribute('data-demo-focus');
      target?.removeAttribute('data-demo-runtime-focus');
    };
  }, [
    state.characterEvidenceId,
    state.characterTimelineOpen,
    state.databaseTab,
    state.expandedWorldEvidence,
    state.screen,
    state.selectedCharacter,
    state.selectedWorldSubject,
    state.viewedCharacterEvidence,
    state.viewedCharacterTimelineEvidence,
    timelineFactId,
    timelineSelection.factKeys,
    timelineSelection.factTypes,
  ]);

  useEffect(() => {
    const page = pageRef.current;
    const layer = guideFocusLayerRef.current;
    const focusBox = guideFocusBoxRef.current;
    if (!page || !layer || !focusBox) return undefined;

    let frame = 0;
    let disposed = false;
    let observedTarget: HTMLElement | null = null;
    const resizeObserver = new ResizeObserver(() => scheduleUpdate());

    const update = () => {
      if (disposed) return;
      const target = page.querySelector<HTMLElement>('[data-demo-focus="true"]');
      const targetChanged = target !== observedTarget;

      if (targetChanged) {
        if (observedTarget) resizeObserver.unobserve(observedTarget);
        observedTarget = target;
        if (target) resizeObserver.observe(target);
      }

      if (!target) {
        focusBox.classList.remove('is-visible');
        frame = window.requestAnimationFrame(update);
        return;
      }

      if (target.classList.contains('interactive-demo-guided-target--inline')) {
        focusBox.classList.remove('is-visible');
        frame = window.requestAnimationFrame(update);
        return;
      }

      const headerBottom = Math.max(0, page.querySelector<HTMLElement>('.interactive-demo-header')?.getBoundingClientRect().bottom ?? 0);
      const bounds = target.getBoundingClientRect();
      const boxLeft = bounds.left - 5;
      const boxTop = bounds.top - headerBottom - 5;
      const boxWidth = bounds.width + 10;
      const boxHeight = bounds.height + 10;
      layer.style.top = `${headerBottom}px`;
      focusBox.style.left = `${boxLeft}px`;
      focusBox.style.top = `${boxTop}px`;
      focusBox.style.width = `${boxWidth}px`;
      focusBox.style.height = `${boxHeight}px`;
      focusBox.style.transformOrigin = 'center center';
      focusBox.classList.toggle('is-soft', target.classList.contains('interactive-demo-guided-target--soft'));

      if (targetChanged) {
        focusBox.classList.remove('is-visible');
        void focusBox.offsetWidth;
      }
      focusBox.classList.add('is-visible');
      frame = window.requestAnimationFrame(update);
    };

    function scheduleUpdate() {
      if (!frame) frame = window.requestAnimationFrame(update);
    }

    const mutationObserver = new MutationObserver(scheduleUpdate);
    mutationObserver.observe(page, {
      attributeFilter: ['data-demo-focus'],
      attributes: true,
      childList: true,
      subtree: true,
    });
    page.addEventListener('scroll', scheduleUpdate, true);
    window.addEventListener('resize', scheduleUpdate);
    scheduleUpdate();

    return () => {
      disposed = true;
      if (frame) window.cancelAnimationFrame(frame);
      mutationObserver.disconnect();
      resizeObserver.disconnect();
      page.removeEventListener('scroll', scheduleUpdate, true);
      window.removeEventListener('resize', scheduleUpdate);
    };
  }, []);

  useEffect(() => {
    const page = pageRef.current;
    const timer = window.setTimeout(() => {
      const target = page?.querySelector<HTMLElement>('[data-demo-focus="true"]');
      target?.focus({ preventScroll: true });

      if (!page || !target || !window.matchMedia('(max-width: 760px)').matches) return;

      const pageBounds = page.getBoundingClientRect();
      const targetBounds = target.getBoundingClientRect();
      const coachmarkBounds = page.querySelector<HTMLElement>('.interactive-demo-coachmark')?.getBoundingClientRect();
      const safeTop = pageBounds.top + 88;
      const safeBottom = Math.min(pageBounds.bottom - 16, (coachmarkBounds?.top ?? pageBounds.bottom) - 16);

      if (targetBounds.top < safeTop || targetBounds.bottom > safeBottom) {
        page.scrollTo({
          top: Math.max(0, page.scrollTop + targetBounds.top - safeTop),
          left: 0,
          behavior: 'auto',
        });
      }
    }, reduceMotion ? 0 : 280);
    return () => window.clearTimeout(timer);
  }, [
    analysisComplete,
    reduceMotion,
    state.characterEvidenceId,
    state.characterTimelineOpen,
    state.databaseTab,
    state.expandedWorldEvidence,
    state.screen,
    state.selectedCharacter,
    state.selectedWorldSubject,
    state.worldEditApplied,
    state.worldEditing,
    timelineFactId,
    timelineSelection.factKeys,
    timelineSelection.factTypes,
  ]);

  const worldValue = state.worldValue ?? INTERACTIVE_DEMO_CANDIDATES.world.proposedValue;
  let coachmark: CoachmarkProps | null = null;

  if (state.screen === 'manuscript') {
    coachmark = { current: 1, title: '원고 분석을 시작해 보세요', description: '가상 원고를 확인했다면 강조된 ‘AI 분석 시작’ 버튼을 눌러 첫 설정 후보를 만들어 보세요.' };
  } else if (state.screen === 'analysis') {
    coachmark = analysisComplete
      ? { current: 2, title: '후보가 준비되었습니다', description: '실제 분석 화면과 같은 ‘설정 후보 검토’ 버튼을 눌러 세 후보를 직접 판단해 보세요.' }
      : { current: 2, title: '회차별 처리 상태를 확인하세요', description: '실제 분석 화면처럼 원문 저장부터 설정 후보 생성까지 상태가 순서대로 바뀝니다.', waiting: true };
  } else if (state.screen === 'character-review') {
    coachmark = { current: 3, title: '명확한 캐릭터 설정을 확정하세요', description: '실제 캐릭터 후보 화면과 같은 ‘1개 설정 모두 확정’을 눌러 직업 변경을 반영해 보세요.' };
  } else if (state.screen === 'world-review') {
    coachmark = state.worldEditing
      ? { current: 4, title: '최종 설정값을 직접 다듬으세요', description: '실제 수정 모달에서 최종 설정값을 바꾼 뒤 ‘수정안 적용’을 눌러 주세요.' }
      : state.worldEditApplied
        ? { current: 4, title: '수정한 세계관 대상을 확정하세요', description: '수정안이 적용됐습니다. 실제 화면의 ‘모두 확정’을 눌러 세계관 설정에 반영해 보세요.' }
        : { current: 4, title: '세계관 설정 후보를 수정하세요', description: '실제 후보 항목의 ‘수정’을 눌러 귀환문 규칙의 범위와 시점을 직접 다듬어 보세요.' };
  } else if (state.screen === 'unsupported-review') {
    coachmark = { current: 5, title: '근거가 부족한 후보는 제외하세요', description: '원문에는 검은 달만 등장합니다. 실제 후보 항목의 ‘제외’를 눌러 세계관 설정에 저장하지 않습니다.' };
  } else if (state.screen === 'database') {
    if (state.databaseTab === 'character') {
      const occupationTimelineSelected = timelineSelection.factKeys.includes('profile.occupation')
        || timelineSelection.factTypes.includes('PROFILE');
      if (state.selectedCharacter === '에단 렌' && state.characterEvidenceId === 'ethan-job-6') {
        coachmark = {
          actionLabel: '근거 닫기',
          current: 5,
          title: '확정한 설정과 6화 근거를 함께 확인했습니다',
          description: '직업 ‘재액 운반자’가 어떤 원문에서 확정됐는지 현재 설정과 함께 확인할 수 있습니다.',
          onAction: () => dispatch({ type: 'close-character-evidence' }),
        };
      } else if (
        state.selectedCharacter === '에단 렌'
        && state.characterTimelineOpen
        && timelineFactId === 'ethan-job-6'
      ) {
        coachmark = {
          actionLabel: '근거 닫기',
          current: 5,
          title: '회차별 변화의 원문까지 연결됩니다',
          description: '실제 타임라인의 설정 변화에서도 해당 회차 원문을 같은 근거 패널로 확인할 수 있습니다.',
          onAction: () => setSearchParams(previous => {
            const next = new URLSearchParams(previous);
            next.delete('timelineFactId');
            return next;
          }, { replace: true }),
        };
      } else if (!state.viewedCharacterEvidence) {
        coachmark = {
          current: 5,
          title: state.selectedCharacter === '에단 렌'
            ? '직업 설정의 원문 근거를 열어 보세요'
            : '캐릭터 설정 DB에 반영됐습니다',
          description: state.selectedCharacter === '에단 렌'
            ? '실제 상세 화면에서 ‘직업’ 행의 문서 버튼을 눌러 확정 근거를 확인하세요.'
            : '에단 렌 카드를 눌러 직업 ‘재액 운반자’의 상세와 원문 근거를 직접 확인하세요.',
        };
      } else if (!state.characterTimelineOpen && !state.viewedCharacterTimelineEvidence) {
        coachmark = state.selectedCharacter === '에단 렌'
          ? { current: 5, title: '이전 회차의 변화 이력도 확인해 보세요', description: '실제 캐릭터 상세의 ‘변화 이력 보기’를 눌러 회차별 설정을 살펴보세요.' }
          : { current: 5, title: '에단 렌의 변화 이력도 확인해 보세요', description: '에단 렌 카드를 열고 실제 상세 화면의 ‘변화 이력 보기’를 눌러 주세요.' };
      } else if (state.characterTimelineOpen && !occupationTimelineSelected) {
        coachmark = {
          current: 5,
          title: '변화 이력을 볼 설정을 선택하세요',
          description: '실제 화면과 같이 왼쪽 현재 설정의 ‘직업’ 행을 눌러 직업 이력만 타임라인에 추가해 보세요.',
        };
      } else if (state.characterTimelineOpen && !state.viewedCharacterTimelineEvidence) {
        coachmark = {
          current: 5,
          title: '6화 직업 변화의 원문을 열어 보세요',
          description: '실제 타임라인에서 ‘6화 · 직업 · 재액 운반자’의 근거 버튼을 눌러 현재값이 된 원문을 확인하세요.',
        };
      } else if (state.characterTimelineOpen) {
        coachmark = { current: 5, title: '캐릭터 변화 이력을 확인했습니다', description: '강조된 ‘이력 닫기’를 눌러 현재 설정 상세로 돌아가세요.' };
      } else if (state.selectedCharacter === '에단 렌') {
        coachmark = { current: 5, title: '현재 설정과 변화 이력을 모두 확인했습니다', description: '캐릭터 상세를 닫고 세계관 설정 DB에서 수정한 규칙도 확인해 보세요.' };
      } else {
        coachmark = { current: 5, title: '이제 세계관 설정 DB를 확인하세요', description: '실제 설정 대시보드의 ‘세계관 설정’ 탭을 눌러 수정한 귀환문 규칙을 확인해 보세요.' };
      }
    } else {
      const guidedWorldEvidence = '거꾸로숲:귀환문의 조건';
      if (state.selectedWorldSubject !== '거꾸로숲') {
        coachmark = { current: 5, title: '수정한 세계관 대상을 다시 선택하세요', description: '대상 목록에서 ‘거꾸로숲’을 눌러 이번 체험에서 반영한 귀환문 규칙을 확인하세요.' };
      } else if (state.expandedWorldEvidence === guidedWorldEvidence) {
        coachmark = {
          actionLabel: '체험 마치기',
          current: 5,
          title: '세계관 설정값과 6화 근거까지 확인했습니다',
          description: '직접 다듬은 ‘귀환문의 조건’과 후보 확정에 사용한 원문이 설정 DB에 함께 남았습니다.',
          onAction: () => dispatch({ type: 'finish' }),
        };
      } else {
        coachmark = { current: 5, title: '세계관 설정의 원문 근거를 열어 보세요', description: '‘귀환문의 조건’ 행에서 최근 근거 6화를 눌러 최종 설정값과 원문을 함께 확인하세요.' };
      }
    }
  }

  const resetDemo = () => {
    setAnalysisPhase(0);
    setSearchParams(new URLSearchParams(), { replace: true });
    dispatch({ type: 'reset' });
  };

  const clearTimelineParams = () => {
    setSearchParams(previous => {
      const next = new URLSearchParams(previous);
      clearTimelineSelection(next);
      next.delete('timelineView');
      next.delete('timelineFactType');
      next.delete('timelineEpisodeNo');
      next.delete('timelineFactId');
      return next;
    }, { replace: true });
  };

  const closeCharacterDetail = () => {
    clearTimelineParams();
    dispatch({ type: 'close-character-detail' });
  };

  const closeCharacterTimeline = () => {
    clearTimelineParams();
    dispatch({ type: 'close-character-timeline' });
  };

  const openCharacterTimeline = () => {
    clearTimelineParams();
    dispatch({ type: 'open-character-timeline' });
  };

  const selectDatabaseTab = (tab: DemoDatabaseTab) => {
    setSearchParams(previous => {
      const next = new URLSearchParams(previous);
      clearTimelineSelection(next);
      ['timelineView', 'timelineFactType', 'timelineEpisodeNo', 'timelineFactId', 'modal'].forEach(key => next.delete(key));
      if (tab === 'world') {
        next.set('settingId', 'demo-world-reverse-forest');
        next.delete('q');
        next.delete('category');
        next.delete('sort');
        next.delete('page');
      } else {
        next.delete('settingId');
      }
      return next;
    }, { replace: true });
    dispatch({ type: 'select-database-tab', tab });
  };

  return (
    <div className="interactive-demo-page theme-v2" ref={pageRef}>
      <header className="interactive-demo-header">
        <div className="interactive-demo-header__brand">
          <ProductBrand compact />
          <span><Sparkles size={13} /> 인터랙티브 데모</span>
        </div>
        <DemoMilestones activeIndex={milestoneIndex(state.screen)} />
        <button type="button" className="interactive-demo-exit" onClick={() => navigate('/landing', { state: { transition: 'dissolve' } })}>
          <ArrowLeft size={15} /> 체험 나가기
        </button>
      </header>

      <div className="interactive-demo-guide-focus-layer" ref={guideFocusLayerRef} aria-hidden="true">
        <div className="interactive-demo-guide-focus-box" ref={guideFocusBoxRef} />
      </div>

      <main className={`interactive-demo-main ${coachmark ? 'has-coachmark' : ''}`}>
        <AnimatePresence initial={false} mode="wait">
          <motion.div
            className="interactive-demo-stage-transition"
            key={`${state.screen}-${state.worldEditing ? 'editing' : state.worldEditApplied ? 'edited' : state.databaseTab}`}
            initial={reduceMotion ? { opacity: 1 } : { opacity: 0, scale: 0.995, y: 18 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.997, y: -8 }}
            transition={reduceMotion ? { duration: 0 } : { duration: 0.24, ease: [0.25, 0.46, 0.45, 0.94] }}
          >
            {state.screen === 'manuscript' && <ManuscriptScreen onStart={() => dispatch({ type: 'start-analysis' })} />}
            {state.screen === 'analysis' && <AnalysisScreen complete={analysisComplete} phase={analysisPhase} onReview={() => dispatch({ type: 'review-candidates' })} />}
            {state.screen === 'character-review' && <CharacterReviewScreen onApprove={() => dispatch({ type: 'approve-character' })} />}
            {state.screen === 'world-review' && (
              <WorldReviewScreen
                draft={state.worldDraft}
                editApplied={state.worldEditApplied}
                editing={state.worldEditing}
                onApplyEdit={() => dispatch({ type: 'apply-world-edit' })}
                onCancelEdit={() => dispatch({ type: 'cancel-world-editor' })}
                onChange={value => dispatch({ type: 'update-world-draft', value })}
                onConfirm={() => dispatch({ type: 'confirm-world' })}
                onEdit={() => dispatch({ type: 'open-world-editor' })}
              />
            )}
            {state.screen === 'unsupported-review' && <UnsupportedReviewScreen onExclude={() => dispatch({ type: 'reject-unsupported' })} />}
            {state.screen === 'database' && (
              <DatabaseScreen
                activeTab={state.databaseTab}
                characterEvidenceId={state.characterEvidenceId}
                characterTimelineOpen={state.characterTimelineOpen}
                onCloseCharacter={closeCharacterDetail}
                onCloseCharacterEvidence={() => dispatch({ type: 'close-character-evidence' })}
                onCloseCharacterTimeline={closeCharacterTimeline}
                onOpenCharacter={name => dispatch({ type: 'open-character-detail', name })}
                onOpenCharacterEvidence={(id, source) => dispatch({ type: 'open-character-evidence', id, source })}
                onOpenCharacterTimeline={openCharacterTimeline}
                onSelectTab={selectDatabaseTab}
                onSelectWorldSubject={subject => dispatch({ type: 'select-world-subject', subject })}
                onToggleWorldEvidence={key => dispatch({ type: 'toggle-world-evidence', key })}
                selectedCharacter={state.selectedCharacter}
                timelineFactId={timelineFactId}
                timelineSelection={timelineSelection}
                viewedCharacterTimelineEvidence={state.viewedCharacterTimelineEvidence}
                worldValue={worldValue}
              />
            )}
            {state.screen === 'complete' && (
              <CompleteScreen
                onRestart={resetDemo}
                onSignup={() => navigate('/signup', { replace: true, state: { transition: 'dissolve' } })}
              />
            )}
          </motion.div>
        </AnimatePresence>
      </main>

      <AnimatePresence mode="wait">
        {coachmark && <Coachmark {...coachmark} />}
      </AnimatePresence>
    </div>
  );
}
