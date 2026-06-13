import React, { useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'motion/react';
import {
  ChevronLeft, FileText, BookMarked, Files, Check, CircleCheckBig, Trash2,
  Users, BookOpen, Sparkles, Clock, GitMerge, Scissors,
} from 'lucide-react';
import { C } from './constants';
import { useAppNavigate } from '../../hooks/useAppNavigate';
import { useAppContext } from '../../context/AppContext';
import { WORK_INFO } from './AppSidebar';
import { UserMenu } from './UserMenu';
import { BtnP, BtnG, DragDropArea } from './S1Dashboard';
import { ModeCard, InfoBar, SplitPane, ListItemCard } from './ReviewLayout';
import {
  AnalysisJobType, DetectedEpisodeBoundary, Episode, EpisodeProcessingStatus,
  EpisodeUploadMode, EpisodeUploadStep, JobProgressItem, UploadPurpose,
  PROCESSING_STATUS_LABELS, JOB_STATUS_LABELS,
} from './types';
import {
  mockCreateAnalysisJob, mockCreateEpisode, mockCreateMultiFileEpisodes, mockDetectBoundaries,
  mockManuscriptParagraphs, MOCK_SETTINGS_EXTRACTION,
} from './mockEpisodeData';

const SETTINGS_CATEGORY_STYLE: Record<string, { color: string; icon: React.ReactNode }> = {
  캐릭터: { color: C.primary, icon: <Users size={12} /> },
  아이템: { color: C.warning, icon: <BookOpen size={12} /> },
  스킬: { color: C.success, icon: <Sparkles size={12} /> },
  타임라인: { color: '#4BB8D9', icon: <Clock size={12} /> },
};

const PROCESSING_SEQUENCE: EpisodeProcessingStatus[] = [
  'UPLOADED', 'CHUNKING', 'CHUNKED', 'PREPROCESSING', 'PREPROCESSED', 'ANALYZING', 'ANALYZED',
];

function SpinningRing() {
  const size = 56;
  const strokeWidth = 2.5;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const arcLength = (270 / 360) * circumference;

  return (
    <motion.div
      animate={{ rotate: 360 }}
      transition={{ duration: 1.2, repeat: Infinity, ease: 'linear' }}
      style={{ width: size, height: size }}
    >
      <svg width={size} height={size} style={{ display: 'block' }}>
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke={C.border} strokeWidth={strokeWidth} />
        <circle
          cx={size / 2} cy={size / 2} r={radius}
          fill="none" stroke={C.primary} strokeWidth={strokeWidth}
          strokeDasharray={`${arcLength} ${circumference}`}
          strokeLinecap="round"
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </svg>
    </motion.div>
  );
}

function SmallSpinner() {
  return (
    <motion.div
      animate={{ rotate: 360 }}
      transition={{ duration: 0.8, repeat: Infinity, ease: 'linear' }}
      style={{ width: 14, height: 14, flexShrink: 0 }}
    >
      <svg width="14" height="14" viewBox="0 0 16 16">
        <circle cx="8" cy="8" r="6" fill="none" stroke={C.border} strokeWidth="2" />
        <circle
          cx="8" cy="8" r="6"
          fill="none" stroke={C.primary} strokeWidth="2"
          strokeDasharray={`${(270 / 360) * 2 * Math.PI * 6} ${2 * Math.PI * 6}`}
          strokeLinecap="round"
          transform="rotate(-90 8 8)"
        />
      </svg>
    </motion.div>
  );
}

function Header({ title, onBack }: { title: string; onBack: () => void }) {
  return (
    <div style={{
      height: 56, flexShrink: 0, display: 'flex', alignItems: 'center', gap: 12,
      padding: '0 20px', borderBottom: `1px solid ${C.border}`,
    }}>
      <button onClick={onBack} style={{
        width: 32, height: 32, borderRadius: 6, border: `1px solid ${C.border}`,
        background: 'transparent', color: C.t2, cursor: 'pointer',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <ChevronLeft size={16} />
      </button>
      <div style={{ color: C.t1, fontSize: 15, fontWeight: 700, letterSpacing: '-0.2px' }}>{title}</div>
      <div style={{ flex: 1 }} />
      <UserMenu />
    </div>
  );
}

function Stepper({ labels, current, maxWidth = 720 }: { labels: string[]; current: number; maxWidth?: number }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', maxWidth, margin: '0 auto', padding: '24px 20px 0' }}>
      {labels.map((label, i, arr) => (
        <React.Fragment key={label}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{
              width: 22, height: 22, borderRadius: '50%', flexShrink: 0,
              background: i + 1 <= current ? C.primary : C.border,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 11, fontWeight: 700, color: i + 1 <= current ? '#fff' : C.t3,
            }}>
              {i + 1 < current ? <Check size={12} /> : i + 1}
            </div>
            <span style={{ fontSize: 12, color: i + 1 === current ? C.t1 : C.t3, fontWeight: i + 1 === current ? 600 : 400, whiteSpace: 'nowrap' }}>
              {label}
            </span>
          </div>
          {i < arr.length - 1 && <div style={{ flex: 1, height: 1, background: i + 1 < current ? C.primary : C.border, margin: '0 12px' }} />}
        </React.Fragment>
      ))}
    </div>
  );
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ color: C.t3, fontSize: 11, fontWeight: 600, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
      {children}
    </div>
  );
}

function TextInput({ value, onChange, placeholder, type = 'text' }: {
  value: string; onChange: (v: string) => void; placeholder?: string; type?: string;
}) {
  return (
    <input
      value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} type={type}
      style={{
        width: '100%', height: 40, borderRadius: 6,
        background: C.bg, border: `1px solid ${C.border}`,
        color: C.t1, fontSize: 14, padding: '0 12px',
        fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box',
      }}
    />
  );
}

function SplitGap({ active, onClick }: { active: boolean; onClick: () => void }) {
  const [hover, setHover] = useState(false);
  const show = active || hover;
  const color = active ? C.warning : C.primary;
  return (
    <div
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onClick={onClick}
      style={{
        cursor: 'pointer', padding: '3px 12px', minHeight: 6,
        display: 'flex', alignItems: 'center', gap: 8, color, fontSize: 10.5,
      }}
    >
      <div style={{ flex: 1, borderTop: `1px dashed ${show ? color : 'transparent'}` }} />
      {show && <span style={{ whiteSpace: 'nowrap' }}>{active ? '✂ 여기서 회차 분리' : '✂ 여기서 분리'}</span>}
      <div style={{ flex: 1, borderTop: `1px dashed ${show ? color : 'transparent'}` }} />
    </div>
  );
}

function BoundaryDivider({ label, onMerge }: { label: string; onMerge: () => void }) {
  const [hover, setHover] = useState(false);
  return (
    <div
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', color: C.t3, fontSize: 10.5 }}
    >
      <div style={{ flex: 1, height: 1, background: C.border }} />
      <span style={{ whiteSpace: 'nowrap', letterSpacing: '0.05em' }}>{label}</span>
      {hover && (
        <button
          onClick={onMerge}
          style={{
            display: 'flex', alignItems: 'center', gap: 4, padding: '2px 8px', borderRadius: 10,
            background: C.primary + '1A', border: `1px solid ${C.primary}55`, color: C.primary,
            fontSize: 10.5, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
          }}
        >
          <GitMerge size={10} /> 합치기
        </button>
      )}
      <div style={{ flex: 1, height: 1, background: C.border }} />
    </div>
  );
}

function ManuscriptPreview({ paragraphs, boundaries, selectedBoundaryId, splitAtParagraph, onSelectSplitParagraph, onMergeWithPrevious }: {
  paragraphs: { number: number; text: string }[];
  boundaries: DetectedEpisodeBoundary[];
  selectedBoundaryId: string | null;
  splitAtParagraph: number | null;
  onSelectSplitParagraph: (n: number | null) => void;
  onMergeWithPrevious: (tempId: string) => void;
}) {
  const rowRefs = useRef<Map<number, HTMLDivElement>>(new Map());
  const selected = boundaries.find((b) => b.tempId === selectedBoundaryId);

  useEffect(() => {
    if (!selected) return;
    rowRefs.current.get(selected.startParagraph)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [selected]);

  return (
    <div style={{
      border: `1px solid ${C.border}`, borderRadius: 6, background: C.bg,
      maxHeight: 360, overflowY: 'auto', fontFamily: "'JetBrains Mono', 'Menlo', monospace", fontSize: 12,
    }}>
      {paragraphs.map(({ number, text }) => {
        const boundaryIdx = boundaries.findIndex((b) => b.startParagraph === number);
        const boundary = boundaryIdx >= 0 ? boundaries[boundaryIdx] : null;
        const prevBoundary = boundaryIdx > 0 ? boundaries[boundaryIdx - 1] : null;
        const inSelectedRange = !!selected && number >= selected.startParagraph && number <= selected.endParagraph;
        const isSplitCandidate = !!selected && number > selected.startParagraph && number <= selected.endParagraph;
        const isSplitPoint = number === splitAtParagraph;
        return (
          <React.Fragment key={number}>
            {boundary && prevBoundary && (
              <BoundaryDivider
                label={`EP ${prevBoundary.episodeNumber} END`}
                onMerge={() => onMergeWithPrevious(boundary.tempId)}
              />
            )}
            {boundary && (
              <div style={{
                padding: '8px 12px', margin: '2px 0', background: C.primary + '1A',
                borderLeft: `3px solid ${C.primary}`, color: C.primary, fontWeight: 700, fontSize: 13,
              }}>
                EP{boundary.episodeNumber}. {boundary.title}
              </div>
            )}
            {isSplitCandidate && (
              <SplitGap active={isSplitPoint} onClick={() => onSelectSplitParagraph(isSplitPoint ? null : number)} />
            )}
            <div
              ref={(el) => { if (el) rowRefs.current.set(number, el); else rowRefs.current.delete(number); }}
              style={{
                display: 'flex', gap: 12, padding: '3px 12px',
                background: isSplitPoint ? C.warning + '14' : inSelectedRange ? C.primary + '0A' : 'transparent',
              }}
            >
              <span style={{ width: 28, flexShrink: 0, textAlign: 'right', color: isSplitPoint ? C.warning : C.t3 }}>{number}</span>
              <span style={{ color: C.t2, lineHeight: 1.7 }}>{text}</span>
            </div>
          </React.Fragment>
        );
      })}
    </div>
  );
}

function SettingsDocToggle({
  includeSettings, setIncludeSettings, dragging, fileSelected, setDragging, setFileSelected,
}: {
  includeSettings: boolean; setIncludeSettings: (v: boolean) => void;
  dragging: boolean; fileSelected: boolean;
  setDragging: (v: boolean) => void; setFileSelected: (v: boolean) => void;
}) {
  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '4px 0 8px' }}>
        <input
          type="checkbox" id="includeSettingsDoc" checked={includeSettings}
          onChange={(e) => setIncludeSettings(e.target.checked)}
          style={{ accentColor: C.primary, width: 14, height: 14, cursor: 'pointer' }}
        />
        <label htmlFor="includeSettingsDoc" style={{ color: C.t2, fontSize: 13, cursor: 'pointer' }}>
          설정집도 함께 업로드 <span style={{ color: C.t3 }}>(선택사항)</span>
        </label>
      </div>
      {includeSettings && (
        <>
          <FieldLabel>설정집 파일</FieldLabel>
          <DragDropArea
            dragging={dragging} fileSelected={fileSelected}
            setDragging={setDragging} setFileSelected={setFileSelected}
            fileLabel="설정집.txt"
          />
        </>
      )}
    </>
  );
}

export default function SEpisodeUpload() {
  const navigate = useAppNavigate();
  const { selectedWork } = useAppContext();
  const work = WORK_INFO[selectedWork];

  const [step, setStep] = useState<EpisodeUploadStep>('select-mode');
  const [uploadMode, setUploadMode] = useState<EpisodeUploadMode | null>(null);

  // single
  const [episodeNumber, setEpisodeNumber] = useState('');
  const [episodeTitle, setEpisodeTitle] = useState('');
  const [singleDragging, setSingleDragging] = useState(false);
  const [singleFileSelected, setSingleFileSelected] = useState(false);
  const [uploadPurpose, setUploadPurpose] = useState<UploadPurpose>(
    selectedWork === 'murim' ? 'SETTING_EXTRACTION' : 'EPISODE_VALIDATION'
  );

  // bulk-single-file (회차 경계 감지)
  const [bulkDragging, setBulkDragging] = useState(false);
  const [bulkFileSelected, setBulkFileSelected] = useState(false);
  const [boundaries, setBoundaries] = useState<DetectedEpisodeBoundary[]>([]);
  const [separationCriteria, setSeparationCriteria] = useState<'AUTO' | 'TITLE_NUMBER'>('AUTO');
  const [selectedBoundaryId, setSelectedBoundaryId] = useState<string | null>(null);
  const [splitAtParagraph, setSplitAtParagraph] = useState<number | null>(null);

  // bulk-multi-file (파일별 1회차)
  const [multiStartEpisodeNumber, setMultiStartEpisodeNumber] = useState('');
  const [multiFileCount, setMultiFileCount] = useState('2');

  // 설정집 함께 업로드
  const [includeSettings, setIncludeSettings] = useState(false);
  const [settingsDragging, setSettingsDragging] = useState(false);
  const [settingsFileSelected, setSettingsFileSelected] = useState(false);
  const [pendingEpisodes, setPendingEpisodes] = useState<Episode[]>([]);

  // processing
  const [createdEpisodes, setCreatedEpisodes] = useState<Episode[]>([]);
  const [jobProgress, setJobProgress] = useState<JobProgressItem[]>([]);
  const [allDone, setAllDone] = useState(false);

  const manuscriptParagraphs = useMemo(() => mockManuscriptParagraphs(boundaries), [boundaries]);

  useEffect(() => {
    setSplitAtParagraph(null);
  }, [selectedBoundaryId]);

  const hasBoundaryStep = uploadMode === 'bulk-single-file';
  const wideLayout = step === 'select-mode' || step === 'boundary-preview';

  const stepLabels = (() => {
    const labels = ['업로드 방식', hasBoundaryStep ? '회차 분리 확인' : '회차 정보 입력'];
    if (includeSettings) labels.push('설정집 분석 결과');
    labels.push('분석 진행');
    return labels;
  })();

  const stepIndex = (() => {
    switch (step) {
      case 'select-mode': return 1;
      case 'input': return 2;
      case 'boundary-preview': return 2;
      case 'settings-review': return 3;
      case 'processing': return 2 + (includeSettings ? 1 : 0);
      default: return 1;
    }
  })();

  // 다회차(단일 파일) 모드에서 파일을 선택하면 같은 화면에서 AI 분리 미리보기를 보여준다
  useEffect(() => {
    if (uploadMode === 'bulk-single-file' && bulkFileSelected && boundaries.length === 0) {
      const lastChapters = work.title === WORK_INFO.detective.title ? 158 : 42;
      setBoundaries(mockDetectBoundaries(1, lastChapters + 1));
    }
  }, [uploadMode, bulkFileSelected, boundaries.length, work.title]);

  const mergeWithPrevious = (tempId: string) => {
    setBoundaries((prev) => {
      const idx = prev.findIndex((b) => b.tempId === tempId);
      if (idx <= 0) return prev;
      const current = prev[idx];
      const previous = prev[idx - 1];
      const merged: DetectedEpisodeBoundary = {
        ...previous,
        endParagraph: current.endParagraph,
        charCount: previous.charCount + current.charCount,
      };
      const next = [...prev];
      next.splice(idx - 1, 2, merged);
      setSelectedBoundaryId(merged.tempId);
      return next;
    });
  };

  const splitBoundary = (tempId: string) => {
    setBoundaries((prev) => {
      const idx = prev.findIndex((b) => b.tempId === tempId);
      if (idx === -1) return prev;
      const b = prev[idx];
      const midParagraph = splitAtParagraph !== null && splitAtParagraph > b.startParagraph && splitAtParagraph <= b.endParagraph
        ? splitAtParagraph - 1
        : Math.floor((b.startParagraph + b.endParagraph) / 2);
      const ratio = (midParagraph - b.startParagraph + 1) / (b.endParagraph - b.startParagraph + 1);
      const firstChars = Math.round(b.charCount * ratio);
      const first: DetectedEpisodeBoundary = { ...b, endParagraph: midParagraph, charCount: firstChars };
      const second: DetectedEpisodeBoundary = {
        ...b, tempId: `${b.tempId}-split`, episodeNumber: b.episodeNumber + 1,
        title: `${b.title} (계속)`, startParagraph: midParagraph + 1, charCount: b.charCount - firstChars,
      };
      const next = [...prev];
      next.splice(idx, 1, first, second);
      setSelectedBoundaryId(first.tempId);
      return next;
    });
    setSplitAtParagraph(null);
  };

  // 입력 단계 완료 후: 설정집 포함 시 분석 결과 확인 단계로, 아니면 바로 분석 시작
  const proceedFromInput = (episodes: Episode[]) => {
    if (includeSettings) {
      setPendingEpisodes(episodes);
      setStep('settings-review');
    } else {
      startProcessing(episodes);
    }
  };

  const startProcessing = (episodes: Episode[]) => {
    const jobType: AnalysisJobType = episodes[0]?.uploadPurpose === 'SETTING_EXTRACTION'
      ? 'SETTING_EXTRACTION' : 'EPISODE_VALIDATION';

    setCreatedEpisodes(episodes);
    setJobProgress(episodes.map((ep) => ({
      episodeId: ep.id,
      episodeLabel: ep.title === `${ep.episodeNumber}화` ? ep.title : `${ep.episodeNumber}화 ${ep.title}`.trim(),
      job: mockCreateAnalysisJob(ep.id, jobType),
      processingStatus: 'UPLOADED',
    })));
    setStep('processing');
  };

  // 회차/작업 진행 시뮬레이션
  useEffect(() => {
    if (step !== 'processing' || jobProgress.length === 0) return;

    const timers: ReturnType<typeof setTimeout>[] = [];

    jobProgress.forEach((item, idx) => {
      const stagger = idx * 250;

      // processingStatus 진행
      PROCESSING_SEQUENCE.forEach((status, i) => {
        if (i === 0) return; // 0번(UPLOADED)은 초기값
        timers.push(setTimeout(() => {
          setJobProgress((prev) => prev.map((p) => p.episodeId === item.episodeId ? { ...p, processingStatus: status } : p));
        }, stagger + i * 350));
      });

      // AnalysisJob 상태 진행 (PENDING -> RUNNING -> SUCCEEDED)
      timers.push(setTimeout(() => {
        setJobProgress((prev) => prev.map((p) => p.episodeId === item.episodeId ? { ...p, job: { ...p.job, status: 'RUNNING' } } : p));
      }, stagger + 500));

      timers.push(setTimeout(() => {
        setJobProgress((prev) => prev.map((p) => p.episodeId === item.episodeId ? { ...p, job: { ...p.job, status: 'SUCCEEDED' } } : p));
      }, stagger + PROCESSING_SEQUENCE.length * 350 + 200));
    });

    const lastFinish = (jobProgress.length - 1) * 250 + PROCESSING_SEQUENCE.length * 350 + 400;
    timers.push(setTimeout(() => setAllDone(true), lastFinish));

    return () => timers.forEach(clearTimeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  const goToReview = () => {
    const episodeIds = createdEpisodes.map((e) => e.id);
    if (createdEpisodes[0]?.uploadPurpose === 'EPISODE_VALIDATION') {
      navigate('/episode-validation-report', 'dissolve', { episodeIds });
    } else {
      navigate('/setting-review', 'dissolve', { episodeIds });
    }
  };

  return (
    <div style={{
      width: '100%', height: '100%', display: 'flex', flexDirection: 'column',
      background: C.bg, fontFamily: "'Pretendard Variable', 'Pretendard', 'Apple SD Gothic Neo', -apple-system, sans-serif",
    }}>
      <Header title="회차 업로드" onBack={() => navigate('/dashboard', 'pop')} />
      <Stepper labels={stepLabels} current={stepIndex} maxWidth={wideLayout ? 1040 : 720} />

      <div style={{ flex: 1, overflowY: 'auto' }}>
        <div style={{ maxWidth: wideLayout ? 1040 : 720, margin: '0 auto', padding: '24px 20px 60px' }}>

          {step === 'select-mode' && (
            <>
              <div style={{ color: C.t1, fontSize: 17, fontWeight: 700, letterSpacing: '-0.3px', marginBottom: 6 }}>
                {work.title} · 회차 업로드
              </div>
              <div style={{ color: C.t2, fontSize: 13, marginBottom: 24 }}>업로드 방식을 선택하세요</div>

              <div style={{ display: 'flex', gap: 12, marginBottom: uploadMode === 'bulk-single-file' ? 28 : 0 }}>
                <ModeCard
                  icon={<FileText size={22} />}
                  title="단일 회차 업로드"
                  desc="새 회차 1개를 업로드합니다"
                  color={C.primary}
                  selected={uploadMode === 'single'}
                  onSelect={() => { setUploadMode('single'); setStep('input'); }}
                />
                <ModeCard
                  icon={<BookMarked size={22} />}
                  title="다회차 - 단일 파일 업로드"
                  desc="여러 회차가 담긴 파일 1개를 업로드하고 회차 경계를 확인합니다"
                  color={C.success}
                  selected={uploadMode === 'bulk-single-file'}
                  onSelect={() => setUploadMode('bulk-single-file')}
                />
                <ModeCard
                  icon={<Files size={22} />}
                  title="다회차 - 여러 파일 업로드"
                  desc="회차별로 파일이 분리되어 있을 때, 파일마다 1개의 회차로 생성합니다"
                  color={C.warning}
                  selected={uploadMode === 'bulk-multi-file'}
                  onSelect={() => { setUploadMode('bulk-multi-file'); setStep('input'); }}
                />
              </div>

              {uploadMode === 'bulk-single-file' && (
                <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 24 }}>
                  <FieldLabel>원고 파일</FieldLabel>
                  <DragDropArea
                    dragging={bulkDragging} fileSelected={bulkFileSelected}
                    setDragging={setBulkDragging} setFileSelected={setBulkFileSelected}
                    fileLabel="대량 원고 파일"
                  />
                  <div style={{ color: C.t3, fontSize: 11, margin: '6px 0 20px' }}>
                    지원 형식: .txt, .docx, .hwp (최대 50MB)
                  </div>

                  <SettingsDocToggle
                    includeSettings={includeSettings} setIncludeSettings={setIncludeSettings}
                    dragging={settingsDragging} fileSelected={settingsFileSelected}
                    setDragging={setSettingsDragging} setFileSelected={setSettingsFileSelected}
                  />

                  <FieldLabel>회차 구분 기준</FieldLabel>
                  <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
                    {([
                      { id: 'AUTO', label: '자동 감지', desc: 'AI가 문맥 흐름으로 회차 경계를 감지합니다' },
                      { id: 'TITLE_NUMBER', label: '제목·회차 번호 기준', desc: '"제 N화", "Chapter N" 등의 표기를 기준으로 분리합니다' },
                    ] as { id: 'AUTO' | 'TITLE_NUMBER'; label: string; desc: string }[]).map((opt) => (
                      <button key={opt.id} onClick={() => setSeparationCriteria(opt.id)} style={{
                        flex: 1, padding: '10px 12px', borderRadius: 6, cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left',
                        background: separationCriteria === opt.id ? C.primary + '14' : C.surface,
                        border: `1px solid ${separationCriteria === opt.id ? C.primary : C.border}`,
                        color: separationCriteria === opt.id ? C.t1 : C.t2,
                      }}>
                        <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 2 }}>{opt.label}</div>
                        <div style={{ fontSize: 11, color: C.t3 }}>{opt.desc}</div>
                      </button>
                    ))}
                  </div>

                  {bulkFileSelected && boundaries.length > 0 && (
                    <>
                      <FieldLabel>AI 분리 미리보기</FieldLabel>
                      <InfoBar
                        items={[
                          { label: '감지된 회차', value: `${boundaries.length}개` },
                          { label: '총 글자 수', value: `${boundaries.reduce((s, b) => s + b.charCount, 0).toLocaleString()}자` },
                          { label: '분리 방식', value: separationCriteria === 'AUTO' ? '자동 감지' : '제목·회차 번호 기준' },
                        ]}
                        badge={(
                          <span style={{
                            padding: '2px 8px', borderRadius: 10, color: C.success, background: C.success + '1A',
                            border: `1px solid ${C.success}33`, fontSize: 11, fontWeight: 700,
                          }}>
                            총 {boundaries.length}회차 감지됨
                          </span>
                        )}
                      />
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 20 }}>
                        {boundaries.map((b) => (
                          <div key={b.tempId} style={{
                            display: 'flex', justifyContent: 'space-between', padding: '8px 12px',
                            borderRadius: 6, border: `1px solid ${C.border}`, background: C.surface, fontSize: 12,
                          }}>
                            <span style={{ color: C.t1, fontWeight: 600 }}>EP{b.episodeNumber}. {b.title}</span>
                            <span style={{ color: C.t3 }}>{b.charCount.toLocaleString()}자</span>
                          </div>
                        ))}
                      </div>
                    </>
                  )}

                  <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                    <BtnG label="← 뒤로" onClick={() => setUploadMode(null)} />
                    <div style={{ flex: 1 }}>
                      <BtnP label="다음 — 회차 분리 확인" onClick={() => setStep('boundary-preview')} />
                    </div>
                  </div>
                </div>
              )}
            </>
          )}

          {step === 'input' && uploadMode === 'single' && (
            <>
              <div style={{ color: C.t1, fontSize: 17, fontWeight: 700, letterSpacing: '-0.3px', marginBottom: 6 }}>회차 정보 입력</div>
              <div style={{ color: C.t2, fontSize: 13, marginBottom: 24 }}>회차 번호, 제목과 원고 파일을 입력하세요</div>

              <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
                <div style={{ flex: 1 }}>
                  <FieldLabel>회차 번호</FieldLabel>
                  <TextInput value={episodeNumber} onChange={setEpisodeNumber} placeholder="예: 159" type="number" />
                </div>
                <div style={{ flex: 2 }}>
                  <FieldLabel>회차 제목</FieldLabel>
                  <TextInput value={episodeTitle} onChange={setEpisodeTitle} placeholder="예: 운명의 실타래" />
                </div>
              </div>

              <FieldLabel>회차 파일</FieldLabel>
              <DragDropArea
                dragging={singleDragging} fileSelected={singleFileSelected}
                setDragging={setSingleDragging} setFileSelected={setSingleFileSelected}
                fileLabel="회차파일.txt"
              />

              <FieldLabel>업로드 목적</FieldLabel>
              <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
                {(['EPISODE_VALIDATION', 'SETTING_EXTRACTION'] as UploadPurpose[]).map((p) => (
                  <button key={p} onClick={() => setUploadPurpose(p)} style={{
                    flex: 1, padding: '10px 12px', borderRadius: 6, cursor: 'pointer', fontFamily: 'inherit',
                    textAlign: 'left',
                    background: uploadPurpose === p ? C.primary + '14' : C.surface,
                    border: `1px solid ${uploadPurpose === p ? C.primary : C.border}`,
                    color: uploadPurpose === p ? C.t1 : C.t2,
                  }}>
                    <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 2 }}>
                      {p === 'EPISODE_VALIDATION' ? '신규 회차 검수' : '기존 설정 구축'}
                    </div>
                    <div style={{ fontSize: 11, color: C.t3 }}>
                      {p === 'EPISODE_VALIDATION'
                        ? '확정된 설정과 충돌하는지 검수합니다'
                        : '원고에서 설정 후보를 추출합니다'}
                    </div>
                  </button>
                ))}
              </div>

              <SettingsDocToggle
                includeSettings={includeSettings} setIncludeSettings={setIncludeSettings}
                dragging={settingsDragging} fileSelected={settingsFileSelected}
                setDragging={setSettingsDragging} setFileSelected={setSettingsFileSelected}
              />

              <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                <BtnG label="← 뒤로" onClick={() => setStep('select-mode')} />
                <div style={{ flex: 1 }}>
                  <BtnP
                    label="다음 — 분석 시작"
                    onClick={() => {
                      const num = parseInt(episodeNumber, 10) || 0;
                      const ep = mockCreateEpisode(selectedWork, num, episodeTitle, uploadPurpose);
                      proceedFromInput([ep]);
                    }}
                  />
                </div>
              </div>
            </>
          )}

          {step === 'input' && uploadMode === 'bulk-multi-file' && (
            <>
              <div style={{ color: C.t1, fontSize: 17, fontWeight: 700, letterSpacing: '-0.3px', marginBottom: 6 }}>다회차 - 여러 파일 업로드</div>
              <div style={{ color: C.t2, fontSize: 13, marginBottom: 24 }}>파일마다 1개의 회차로 생성됩니다. 시작 회차 번호와 파일 개수를 입력하세요</div>

              <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
                <div style={{ flex: 1 }}>
                  <FieldLabel>시작 회차 번호</FieldLabel>
                  <TextInput value={multiStartEpisodeNumber} onChange={setMultiStartEpisodeNumber} placeholder="예: 161" type="number" />
                </div>
                <div style={{ flex: 1 }}>
                  <FieldLabel>파일 개수</FieldLabel>
                  <TextInput value={multiFileCount} onChange={setMultiFileCount} placeholder="예: 3" type="number" />
                </div>
              </div>

              <FieldLabel>회차 파일 (여러 개 선택)</FieldLabel>
              <DragDropArea
                dragging={bulkDragging} fileSelected={bulkFileSelected}
                setDragging={setBulkDragging} setFileSelected={setBulkFileSelected}
                fileLabel={`${multiFileCount || 0}개 파일`}
              />

              <SettingsDocToggle
                includeSettings={includeSettings} setIncludeSettings={setIncludeSettings}
                dragging={settingsDragging} fileSelected={settingsFileSelected}
                setDragging={setSettingsDragging} setFileSelected={setSettingsFileSelected}
              />

              <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                <BtnG label="← 뒤로" onClick={() => setStep('select-mode')} />
                <div style={{ flex: 1 }}>
                  <BtnP
                    label="다음 — 분석 시작"
                    onClick={() => {
                      const startNum = parseInt(multiStartEpisodeNumber, 10) || 0;
                      const count = Math.max(1, parseInt(multiFileCount, 10) || 1);
                      const episodes = mockCreateMultiFileEpisodes(selectedWork, startNum, count, uploadPurpose);
                      proceedFromInput(episodes);
                    }}
                  />
                </div>
              </div>
            </>
          )}

          {step === 'boundary-preview' && (() => {
            const selected = boundaries.find((b) => b.tempId === selectedBoundaryId) ?? boundaries[0];
            const totalChars = boundaries.reduce((s, b) => s + b.charCount, 0);
            return (
              <>
                <div style={{ color: C.t1, fontSize: 17, fontWeight: 700, letterSpacing: '-0.3px', marginBottom: 6 }}>회차 분리 확인</div>
                <div style={{ color: C.t2, fontSize: 13, marginBottom: 16 }}>
                  AI가 감지한 회차 경계를 확인하고 필요하면 회차 번호·제목을 수정하거나 합치기/나누기로 조정하세요
                </div>

                <InfoBar
                  items={[
                    { label: '파일 이름', value: '대량 원고 파일.txt' },
                    { label: '총 글자 수', value: `${totalChars.toLocaleString()}자` },
                    { label: '감지된 회차', value: `${boundaries.length}개` },
                    { label: '분리 방식', value: separationCriteria === 'AUTO' ? '자동 감지' : '제목·회차 번호 기준' },
                    { label: '설정집', value: includeSettings ? '함께 업로드' : '미사용' },
                  ]}
                  badge={(
                    <span style={{
                      padding: '2px 8px', borderRadius: 10, color: C.success, background: C.success + '1A',
                      border: `1px solid ${C.success}33`, fontSize: 11, fontWeight: 700,
                    }}>
                      총 {boundaries.length}회차 감지됨
                    </span>
                  )}
                />

                <SplitPane
                  left={boundaries.map((b) => (
                    <ListItemCard
                      key={b.tempId}
                      selected={b.tempId === selected?.tempId}
                      onClick={() => setSelectedBoundaryId(b.tempId)}
                      title={`EP${b.episodeNumber}. ${b.title}`}
                      subtitle={`${b.startParagraph}~${b.endParagraph}문단 · ${b.charCount.toLocaleString()}자`}
                      badge={b.confirmed ? '정상' : '확인 필요'}
                      badgeColor={b.confirmed ? C.success : C.warning}
                    />
                  ))}
                  right={selected ? (
                    <div style={{ border: `1px solid ${C.border}`, borderRadius: 8, padding: 16, background: C.surface }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                        <input
                          type="checkbox" checked={selected.confirmed}
                          onChange={(e) => setBoundaries((prev) => prev.map((x) => x.tempId === selected.tempId ? { ...x, confirmed: e.target.checked } : x))}
                          style={{ accentColor: C.primary, width: 14, height: 14, cursor: 'pointer' }}
                        />
                        <label style={{ color: C.t2, fontSize: 12 }}>이 회차 포함</label>
                      </div>

                      <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
                        <div style={{ width: 100 }}>
                          <FieldLabel>회차 번호</FieldLabel>
                          <TextInput
                            value={String(selected.episodeNumber)}
                            onChange={(v) => setBoundaries((prev) => prev.map((x) => x.tempId === selected.tempId ? { ...x, episodeNumber: parseInt(v, 10) || 0 } : x))}
                            type="number"
                          />
                        </div>
                        <div style={{ flex: 1 }}>
                          <FieldLabel>회차 제목</FieldLabel>
                          <TextInput
                            value={selected.title}
                            onChange={(v) => setBoundaries((prev) => prev.map((x) => x.tempId === selected.tempId ? { ...x, title: v } : x))}
                          />
                        </div>
                      </div>

                      <div style={{ display: 'flex', gap: 8, marginBottom: 16, alignItems: 'center' }}>
                        <BtnG small icon={<GitMerge size={13} />} label="이전 회차와 합치기" onClick={() => mergeWithPrevious(selected.tempId)} />
                        <BtnG small icon={<Scissors size={13} />} label="여기서 회차 나누기" onClick={() => splitBoundary(selected.tempId)} />
                        <div style={{ flex: 1 }} />
                        <button
                          onClick={() => setBoundaries((prev) => prev.filter((x) => x.tempId !== selected.tempId))}
                          style={{ background: 'transparent', border: 'none', color: C.t3, cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>

                      <FieldLabel>원문 미리보기</FieldLabel>
                      <div style={{ color: C.t3, fontSize: 11, marginBottom: 6 }}>
                        {splitAtParagraph !== null
                          ? `${splitAtParagraph}문단부터 새 회차로 분리됩니다`
                          : '분리할 줄을 클릭하면 그 줄부터 새 회차로 나눌 수 있어요'}
                      </div>
                      <ManuscriptPreview
                        paragraphs={manuscriptParagraphs}
                        boundaries={boundaries}
                        selectedBoundaryId={selected.tempId}
                        splitAtParagraph={splitAtParagraph}
                        onSelectSplitParagraph={setSplitAtParagraph}
                        onMergeWithPrevious={mergeWithPrevious}
                      />
                    </div>
                  ) : (
                    <div style={{ color: C.t3, fontSize: 13, textAlign: 'center', padding: '40px 0' }}>회차를 선택하세요</div>
                  )}
                />

                <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
                  <BtnG label="← 이전" onClick={() => { setUploadMode(null); setStep('select-mode'); }} />
                  <BtnG
                    label="다시 분리"
                    onClick={() => {
                      const lastChapters = work.title === WORK_INFO.detective.title ? 158 : 42;
                      setBoundaries(mockDetectBoundaries(1, lastChapters + 1));
                      setSelectedBoundaryId(null);
                    }}
                  />
                  <div style={{ flex: 1 }}>
                    <BtnP
                      label={`회차 분리 확정 (${boundaries.filter((b) => b.confirmed).length}개) →`}
                      onClick={() => {
                        const selectedBoundaries = boundaries.filter((b) => b.confirmed);
                        const episodes = selectedBoundaries.map((b) => mockCreateEpisode(selectedWork, b.episodeNumber, b.title, uploadPurpose));
                        proceedFromInput(episodes);
                      }}
                    />
                  </div>
                </div>
              </>
            );
          })()}

          {step === 'settings-review' && (
            <>
              <div style={{ color: C.t1, fontSize: 17, fontWeight: 700, marginBottom: 6 }}>설정집 분석 결과 확인</div>
              <div style={{ color: C.t2, fontSize: 13, marginBottom: 20 }}>AI가 설정집에서 추출한 항목을 확인하고 필요시 수정하세요</div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 20 }}>
                {MOCK_SETTINGS_EXTRACTION.map((cat) => {
                  const style = SETTINGS_CATEGORY_STYLE[cat.type] || { color: C.t2, icon: null };
                  return (
                    <div key={cat.type} style={{
                      background: C.surface, borderRadius: 6, border: `1px solid ${C.border}`,
                      overflow: 'hidden',
                    }}>
                      <div style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        padding: '9px 14px', borderBottom: `1px solid ${C.border}`,
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span style={{ color: style.color }}>{style.icon}</span>
                          <span style={{ color: style.color, fontSize: 13, fontWeight: 600 }}>{cat.type}</span>
                        </div>
                        <span style={{ color: C.t3, fontSize: 12 }}>{cat.count}개 추출됨</span>
                      </div>
                      <div style={{ padding: '8px 14px', display: 'flex', flexDirection: 'column', gap: 3 }}>
                        {cat.items.map((item) => (
                          <span key={item} style={{ color: C.t2, fontSize: 12 }}>· {item}</span>
                        ))}
                        {cat.count > cat.items.length && (
                          <span style={{ color: C.t3, fontSize: 11 }}>+ {cat.count - cat.items.length}개 더...</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              <div style={{ display: 'flex', gap: 8 }}>
                <BtnG label="나중에 수정" onClick={() => startProcessing(pendingEpisodes)} />
                <div style={{ flex: 1 }}>
                  <BtnP label="설정 DB 확정 및 등록" onClick={() => startProcessing(pendingEpisodes)} />
                </div>
              </div>
            </>
          )}

          {step === 'processing' && (
            <div style={{ textAlign: 'center' }}>
              <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 16 }}>
                <SpinningRing />
              </div>
              <div style={{ color: C.t1, fontSize: 17, fontWeight: 700, marginBottom: 4 }}>회차 생성 및 분석 중</div>
              <div style={{ color: C.t2, fontSize: 13, marginBottom: 28 }}>청킹 → LLM 전처리 → AI 설정 추출 순으로 진행됩니다</div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, textAlign: 'left' }}>
                {jobProgress.map((item) => {
                  const seqIndex = PROCESSING_SEQUENCE.indexOf(item.processingStatus);
                  const done = item.processingStatus === 'ANALYZED' && item.job.status === 'SUCCEEDED';
                  return (
                    <div key={item.episodeId} style={{
                      border: `1px solid ${C.border}`, borderRadius: 8, padding: 14, background: C.surface,
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                        <div style={{ color: C.t1, fontSize: 14, fontWeight: 600 }}>{item.episodeLabel}</div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          {done ? <CircleCheckBig size={14} color={C.success} /> : <SmallSpinner />}
                          <span style={{ color: done ? C.success : C.t2, fontSize: 12, fontWeight: 600 }}>
                            {JOB_STATUS_LABELS[item.job.status]}
                          </span>
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                        {PROCESSING_SEQUENCE.map((status, i) => (
                          <div key={status} style={{
                            display: 'flex', alignItems: 'center', gap: 4,
                            padding: '3px 8px', borderRadius: 12,
                            background: i <= seqIndex ? C.primary + '18' : C.bg,
                            border: `1px solid ${i <= seqIndex ? C.primary + '55' : C.border}`,
                            color: i <= seqIndex ? C.primary : C.t3, fontSize: 10.5, fontWeight: 600,
                          }}>
                            {PROCESSING_STATUS_LABELS[status]}
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>

              <div style={{ marginTop: 28 }}>
                {allDone
                  ? (
                    <BtnP
                      label={createdEpisodes[0]?.uploadPurpose === 'EPISODE_VALIDATION' ? '검사 결과 보기' : '설정 후보 검토하기'}
                      onClick={goToReview}
                    />
                  )
                  : <BtnG label="분석 진행 중..." />}
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
