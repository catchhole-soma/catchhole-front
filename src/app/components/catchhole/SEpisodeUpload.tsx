import React, { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import {
  ChevronLeft, FileText, BookMarked, Files, Check, CircleCheckBig, Trash2,
  Users, BookOpen, Sparkles, Clock,
} from 'lucide-react';
import { C } from './constants';
import { useAppNavigate } from '../../hooks/useAppNavigate';
import { useAppContext } from '../../context/AppContext';
import { WORK_INFO } from './AppSidebar';
import { UserMenu } from './UserMenu';
import { BtnP, BtnG, TypeCard, DragDropArea } from './S1Dashboard';
import {
  AnalysisJobType, DetectedEpisodeBoundary, Episode, EpisodeProcessingStatus,
  EpisodeUploadMode, EpisodeUploadStep, JobProgressItem, UploadPurpose,
  PROCESSING_STATUS_LABELS, JOB_STATUS_LABELS,
} from './types';
import {
  mockCreateAnalysisJob, mockCreateEpisode, mockCreateMultiFileEpisodes, mockDetectBoundaries,
  MOCK_SETTINGS_EXTRACTION,
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

function Stepper({ labels, current }: { labels: string[]; current: number }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', maxWidth: 720, margin: '0 auto', padding: '24px 20px 0' }}>
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

  const hasBoundaryStep = uploadMode === 'bulk-single-file';

  const stepLabels = (() => {
    const labels = ['업로드 방식', uploadMode === 'bulk-single-file' ? '파일 업로드' : '회차 정보 입력'];
    if (hasBoundaryStep) labels.push('회차 경계 확인');
    if (includeSettings) labels.push('설정집 분석 결과');
    labels.push('분석 진행');
    return labels;
  })();

  const stepIndex = (() => {
    switch (step) {
      case 'select-mode': return 1;
      case 'input': return 2;
      case 'boundary-preview': return 3;
      case 'settings-review': return hasBoundaryStep ? 4 : 3;
      case 'processing': return 3 + (hasBoundaryStep ? 1 : 0) + (includeSettings ? 1 : 0);
      default: return 1;
    }
  })();

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
      <Stepper labels={stepLabels} current={stepIndex} />

      <div style={{ flex: 1, overflowY: 'auto' }}>
        <div style={{ maxWidth: 720, margin: '0 auto', padding: '24px 20px 60px' }}>

          {step === 'select-mode' && (
            <>
              <div style={{ color: C.t1, fontSize: 17, fontWeight: 700, letterSpacing: '-0.3px', marginBottom: 6 }}>
                {work.title} · 회차 업로드
              </div>
              <div style={{ color: C.t2, fontSize: 13, marginBottom: 24 }}>업로드 방식을 선택하세요</div>
              <TypeCard
                icon={<FileText size={20} />}
                label="단일 회차 업로드"
                desc="새 회차 1개를 업로드합니다"
                color={C.primary}
                onSelect={() => { setUploadMode('single'); setStep('input'); }}
              />
              <TypeCard
                icon={<BookMarked size={20} />}
                label="다회차 - 단일 파일 업로드"
                desc="여러 회차가 담긴 파일 1개를 업로드하고 회차 경계를 확인합니다"
                color={C.success}
                onSelect={() => { setUploadMode('bulk-single-file'); setStep('input'); }}
              />
              <TypeCard
                icon={<Files size={20} />}
                label="다회차 - 여러 파일 업로드"
                desc="회차별로 파일이 분리되어 있을 때, 파일마다 1개의 회차로 생성합니다"
                color={C.warning}
                onSelect={() => { setUploadMode('bulk-multi-file'); setStep('input'); }}
              />
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

          {step === 'input' && uploadMode === 'bulk-single-file' && (
            <>
              <div style={{ color: C.t1, fontSize: 17, fontWeight: 700, letterSpacing: '-0.3px', marginBottom: 6 }}>다회차 - 단일 파일 업로드</div>
              <div style={{ color: C.t2, fontSize: 13, marginBottom: 24 }}>여러 회차가 포함된 원고 파일을 업로드하면 AI가 회차 경계를 감지합니다</div>

              <FieldLabel>원고 파일</FieldLabel>
              <DragDropArea
                dragging={bulkDragging} fileSelected={bulkFileSelected}
                setDragging={setBulkDragging} setFileSelected={setBulkFileSelected}
                fileLabel="대량 원고 파일"
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
                    label="다음 — 회차 경계 감지"
                    onClick={() => {
                      const lastChapters = work.title === WORK_INFO.detective.title ? 158 : 42;
                      setBoundaries(mockDetectBoundaries(1, lastChapters + 1));
                      setStep('boundary-preview');
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

          {step === 'boundary-preview' && (
            <>
              <div style={{ color: C.t1, fontSize: 17, fontWeight: 700, letterSpacing: '-0.3px', marginBottom: 6 }}>회차 경계 확인</div>
              <div style={{ color: C.t2, fontSize: 13, marginBottom: 16 }}>
                AI가 감지한 회차 경계를 확인하고 필요하면 회차 번호·제목을 수정하거나 항목을 제외하세요
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}>
                <BtnG
                  small
                  label={boundaries.every((b) => b.confirmed) ? '전체 해제' : '전체 선택'}
                  onClick={() => {
                    const allSelected = boundaries.every((b) => b.confirmed);
                    setBoundaries((prev) => prev.map((b) => ({ ...b, confirmed: !allSelected })));
                  }}
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 20 }}>
                {boundaries.map((b) => (
                  <div key={b.tempId} style={{
                    border: `1px solid ${b.confirmed ? C.border : C.border}`,
                    borderRadius: 8, padding: 14, background: C.surface,
                    opacity: b.confirmed ? 1 : 0.45, transition: 'opacity 0.15s',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                      <input
                        type="checkbox" checked={b.confirmed}
                        onChange={(e) => setBoundaries((prev) => prev.map((x) => x.tempId === b.tempId ? { ...x, confirmed: e.target.checked } : x))}
                        style={{ accentColor: C.primary, width: 14, height: 14, cursor: 'pointer', flexShrink: 0 }}
                      />
                      <input
                        value={String(b.episodeNumber)}
                        onChange={(e) => setBoundaries((prev) => prev.map((x) => x.tempId === b.tempId ? { ...x, episodeNumber: parseInt(e.target.value, 10) || 0 } : x))}
                        type="number"
                        style={{
                          width: 64, height: 32, borderRadius: 6, background: C.bg, border: `1px solid ${C.border}`,
                          color: C.t1, fontSize: 13, padding: '0 8px', fontFamily: 'inherit', outline: 'none',
                        }}
                      />
                      <input
                        value={b.title}
                        onChange={(e) => setBoundaries((prev) => prev.map((x) => x.tempId === b.tempId ? { ...x, title: e.target.value } : x))}
                        style={{
                          flex: 1, height: 32, borderRadius: 6, background: C.bg, border: `1px solid ${C.border}`,
                          color: C.t1, fontSize: 13, padding: '0 10px', fontFamily: 'inherit', outline: 'none',
                        }}
                      />
                      <div style={{ color: C.t3, fontSize: 11, whiteSpace: 'nowrap' }}>
                        {b.startParagraph}~{b.endParagraph}문단 · {b.charCount.toLocaleString()}자
                      </div>
                      <button
                        onClick={() => setBoundaries((prev) => prev.filter((x) => x.tempId !== b.tempId))}
                        style={{ background: 'transparent', border: 'none', color: C.t3, cursor: 'pointer', display: 'flex', flexShrink: 0 }}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                    <div style={{
                      borderLeft: `2px solid ${C.border}`, paddingLeft: 10,
                      color: C.t2, fontSize: 12, fontStyle: 'italic', lineHeight: 1.6,
                    }}>
                      "{b.preview}"
                    </div>
                  </div>
                ))}
              </div>

              <div style={{ display: 'flex', gap: 8 }}>
                <BtnG label="← 뒤로" onClick={() => setStep('input')} />
                <div style={{ flex: 1 }}>
                  <BtnP
                    label={`선택한 ${boundaries.filter((b) => b.confirmed).length}개 회차 생성하기`}
                    onClick={() => {
                      const selected = boundaries.filter((b) => b.confirmed);
                      const episodes = selected.map((b) => mockCreateEpisode(selectedWork, b.episodeNumber, b.title, uploadPurpose));
                      proceedFromInput(episodes);
                    }}
                  />
                </div>
              </div>
            </>
          )}

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
