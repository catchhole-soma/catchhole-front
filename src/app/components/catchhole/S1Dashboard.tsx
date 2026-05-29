import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { C, NavigateFn } from './constants';
import {
  BookOpen, Users, GitBranch, Clock, Globe, BarChart3,
  Settings, Shield, OctagonAlert, AlertTriangle, Plus,
  Upload, ChevronRight, Activity, Scale, Scroll,
  BookMarked, FileText, Check, CircleCheckBig, Network,
  Eye, EyeOff, Trash2, X, Sparkles, Lock, LockOpen, Search, MessageSquare, MapPin,
  Share2, Copy, Mail, UserPlus, ExternalLink, CheckCheck, ChevronDown,
} from 'lucide-react';
import { GraphView } from './GraphView';
import { ShareModal } from './ShareModal';

import { WorkId } from './constants';
interface Props { navigate: NavigateFn; onPrePublish?: () => void; selectedWork: WorkId; onChangeWork: () => void; }

const charColors: Record<string, string> = {
  sua: C.primary,
  min: '#E25C5C',
  lena: '#4BB8D9',
  hayun: C.success,
  choi: '#D4A04A',
  pak: '#F4A261',
  oh: '#00C896',
  kim: '#B48BFF',
  jung: '#A78BFA',
  shin: '#64748B',
};

function NavItem({
  icon, label, active, badge, onClick,
}: { icon: React.ReactNode; label: string; active?: boolean; badge?: string; onClick?: () => void }) {
  const [h, setH] = useState(false);
  return (
    <div onClick={onClick} onMouseEnter={() => setH(true)} onMouseLeave={() => setH(false)}
      style={{
        display: 'flex', alignItems: 'center', gap: 9,
        padding: '9px 16px 9px 20px', cursor: 'pointer',
        color: active ? C.primary : h ? C.t1 : C.t2,
        fontSize: 13, fontWeight: active ? 600 : 400,
        transition: 'color 0.13s', position: 'relative', userSelect: 'none',
        background: active ? C.primary + '0D' : 'transparent',
      }}>
      {active && <div style={{
        position: 'absolute', left: 0, top: '50%', transform: 'translateY(-50%)',
        width: 3, height: 18, background: C.primary, borderRadius: '0 2px 2px 0',
      }} />}
      <span style={{ flexShrink: 0, opacity: active ? 1 : 0.7 }}>{icon}</span>
      <span style={{ flex: 1 }}>{label}</span>
      {badge && (
        <span style={{
          padding: '1px 6px', borderRadius: 8, background: C.danger + '22',
          color: C.danger, fontSize: 11, fontWeight: 600, border: `1px solid ${C.danger}33`,
        }}>{badge}</span>
      )}
    </div>
  );
}

function BtnG({ label, onClick, icon, small }: { label: string; onClick?: () => void; icon?: React.ReactNode; small?: boolean }) {
  const [h, setH] = useState(false);
  return (
    <button onClick={onClick} onMouseEnter={() => setH(true)} onMouseLeave={() => setH(false)}
      style={{
        height: small ? 32 : 38, padding: small ? '0 12px' : '0 16px', borderRadius: 6,
        border: `1px solid ${h ? '#3A3A4A' : C.border}`, background: h ? '#1F1F2A' : 'transparent',
        color: C.t2, fontSize: small ? 12 : 13, cursor: 'pointer', transition: 'all 0.15s',
        whiteSpace: 'nowrap', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 6,
      }}>
      {icon}{label}
    </button>
  );
}
function BtnP({ label, onClick, icon }: { label: string; onClick?: () => void; icon?: React.ReactNode }) {
  const [h, setH] = useState(false);
  return (
    <button onClick={onClick} onMouseEnter={() => setH(true)} onMouseLeave={() => setH(false)}
      style={{
        height: 38, padding: '0 18px', borderRadius: 6, border: 'none',
        background: h ? '#6B4EE8' : C.primary, color: '#fff', fontSize: 13, fontWeight: 600,
        cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.15s',
        display: 'flex', alignItems: 'center', gap: 6,
      }}>
      {icon}{label}
    </button>
  );
}

const GENRES = ['로맨스', '판타지', '무협', '현대', '미스터리', '기타'];

function TypeCard({ icon, label, desc, color, onSelect }: {
  icon: React.ReactNode; label: string; desc: string; color: string; onSelect: () => void;
}) {
  const [hovered, setHovered] = useState(false);
  return (
    <div
      onClick={onSelect}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex', alignItems: 'center', gap: 14,
        padding: '14px 16px', borderRadius: 8, cursor: 'pointer',
        border: `1px solid ${hovered ? color : C.border}`,
        background: hovered ? color + '0A' : C.bg,
        marginBottom: 8, transition: 'all 0.15s',
      }}
    >
      <div style={{
        width: 40, height: 40, borderRadius: 8, flexShrink: 0,
        background: color + '18',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: color,
      }}>
        {icon}
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ color: C.t1, fontSize: 14, fontWeight: 600, marginBottom: 3 }}>{label}</div>
        <div style={{ color: C.t2, fontSize: 12 }}>{desc}</div>
      </div>
      <ChevronRight size={16} color={C.t3} />
    </div>
  );
}

function DragDropArea({ dragging, fileSelected, setDragging, setFileSelected, fileLabel }: {
  dragging: boolean; fileSelected: boolean;
  setDragging: (v: boolean) => void; setFileSelected: (v: boolean) => void;
  fileLabel: string;
}) {
  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={() => { setDragging(false); setFileSelected(true); }}
      onClick={() => setFileSelected(true)}
      style={{
        border: `2px dashed ${dragging ? C.primary : fileSelected ? C.success : C.border}`,
        borderRadius: 8, padding: '24px', textAlign: 'center',
        background: dragging ? C.primary + '08' : fileSelected ? C.success + '08' : 'transparent',
        cursor: 'pointer', transition: 'all 0.15s', marginBottom: 12,
      }}
    >
      {fileSelected ? (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
          <CircleCheckBig size={18} color={C.success} />
          <span style={{ color: C.success, fontSize: 14, fontWeight: 600 }}>{fileLabel} — 업로드 준비 완료</span>
        </div>
      ) : (
        <>
          <Upload size={24} color={C.t3} style={{ margin: '0 auto 10px' }} />
          <div style={{ color: C.t2, fontSize: 14, marginBottom: 4 }}>파일을 드래그하거나 클릭하여 업로드</div>
          <div style={{ color: C.t3, fontSize: 12 }}>txt, docx 지원 · {fileLabel}</div>
        </>
      )}
    </div>
  );
}

type UploadSubType = 'fresh' | 'ep-only';

const MOCK_WORKS = [
  { title: '빛나는 검사 로맨스', chapters: 158 },
  { title: '무협지존', chapters: 42 },
];

function UploadModal({ onClose, mode, initialWork, initialChapters, works, navigate: nav }: {
  onClose: () => void;
  mode: 'settings' | 'episode' | 'new-work';
  initialWork?: string;
  initialChapters?: number;
  works?: { title: string; chapters: number }[];
  navigate?: NavigateFn;
}) {
  const [title, setTitle] = useState('');
  const [genre, setGenre] = useState('');
  const [dragging, setDragging] = useState(false);
  const [fileSelected, setFileSelected] = useState(false);
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [episodeWork, setEpisodeWork] = useState(initialWork || '');
  const [episodeNum, setEpisodeNum] = useState(initialChapters ? String(initialChapters + 1) : '');
  const [uploadType, setUploadType] = useState<UploadSubType | null>(
    mode === 'episode' ? 'ep-only' : null
  );
  const [settingsDragging, setSettingsDragging] = useState(false);
  const [settingsFileSelected, setSettingsFileSelected] = useState(false);
  const [includeSettings, setIncludeSettings] = useState(false);

  const isSettings = mode === 'settings';

  const canProceed = (() => {
    if (!uploadType) return false;
    if (uploadType === 'fresh') return !!(title.trim() && genre && fileSelected && (!includeSettings || settingsFileSelected));
    return !!(episodeWork && episodeNum.trim() && fileSelected);
  })();

  const stepLabels =
    uploadType === 'fresh' ? ['회차 등록', 'AI 분석', '확인·수정']
    : uploadType === 'ep-only' ? ['회차 등록', 'AI 대조 분석']
    : isSettings ? ['설정집 등록', 'AI 분석', '확인·수정']
    : ['회차 선택', 'AI 대조'];

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)',
        zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
      onClick={onClose}
    >
      <motion.div
        initial={{ y: 32, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
        exit={{ y: 16, opacity: 0 }} transition={{ duration: 0.22, ease: 'easeOut' }}
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 500, background: C.surface, borderRadius: 12,
          border: `1px solid ${C.border}`, padding: 32,
          boxShadow: '0 24px 64px rgba(0,0,0,0.6)',
          maxHeight: '90vh', overflowY: 'auto',
        }}
      >
        {uploadType !== null && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 0, marginBottom: 28 }}>
            {stepLabels.map((s, i, arr) => (
              <React.Fragment key={s}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <div style={{
                    width: 22, height: 22, borderRadius: '50%', flexShrink: 0,
                    background: i + 1 <= step ? C.primary : C.border,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 11, fontWeight: 700, color: i + 1 <= step ? '#fff' : C.t3,
                  }}>
                    {i + 1 < step ? <Check size={12} /> : i + 1}
                  </div>
                  <span style={{ fontSize: 12, color: i + 1 === step ? C.t1 : C.t3, fontWeight: i + 1 === step ? 600 : 400 }}>{s}</span>
                </div>
                {i < arr.length - 1 && <div style={{ flex: 1, height: 1, background: i + 1 < step ? C.primary : C.border, margin: '0 8px' }} />}
              </React.Fragment>
            ))}
          </div>
        )}

        {mode === 'new-work' && !uploadType && (
          <>
            <div style={{ color: C.t1, fontSize: 17, fontWeight: 700, letterSpacing: '-0.3px', marginBottom: 6 }}>새 작품 등록</div>
            <div style={{ color: C.t2, fontSize: 13, marginBottom: 24 }}>업로드 방식을 선택하세요</div>
            <TypeCard
              icon={<BookOpen size={20} />}
              label="1화부터 새로 업로드"
              desc="처음 작품을 등록하거나 전체 회차를 재업로드할 때"
              color={C.primary}
              onSelect={() => setUploadType('fresh')}
            />
            <TypeCard
              icon={<FileText size={20} />}
              label="신규 회차 업로드"
              desc="기존 작품에 새 회차를 올릴 때 (설정집 선택 추가 가능)"
              color={C.success}
              onSelect={() => setUploadType('ep-only')}
            />
            <button onClick={onClose} style={{
              width: '100%', height: 40, borderRadius: 6, background: 'transparent',
              border: `1px solid ${C.border}`, color: C.t2, fontSize: 13,
              cursor: 'pointer', fontFamily: 'inherit', marginTop: 8,
            }}>취소</button>
          </>
        )}

        {(isSettings || uploadType === 'fresh') && step === 1 && (
          <>
            <div style={{ color: C.t1, fontSize: 17, fontWeight: 700, letterSpacing: '-0.3px', marginBottom: 6 }}>
              {uploadType === 'fresh' ? '1화부터 새로 업로드' : '설정집 올리기'}
            </div>
            <div style={{ color: C.t2, fontSize: 13, marginBottom: 24 }}>
              {uploadType === 'fresh'
                ? '작품 정보와 회차 파일을 입력하세요. 설정집은 선택사항입니다.'
                : '설정집을 업로드하면 AI가 캐릭터·세계관·타임라인을 자동 추출합니다'}
            </div>

            <div style={{ marginBottom: 16 }}>
              <div style={{ color: C.t3, fontSize: 11, fontWeight: 600, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>작품 제목</div>
              <input
                value={title} onChange={(e) => setTitle(e.target.value)}
                placeholder="빛나는 검사 로맨스"
                style={{
                  width: '100%', height: 40, borderRadius: 6,
                  background: C.bg, border: `1px solid ${C.border}`,
                  color: C.t1, fontSize: 14, padding: '0 12px',
                  fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box',
                }}
              />
            </div>

            <div style={{ marginBottom: 20 }}>
              <div style={{ color: C.t3, fontSize: 11, fontWeight: 600, marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>장르</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
                {GENRES.map((g) => (
                  <button key={g} onClick={() => setGenre(g)} style={{
                    padding: '5px 12px', borderRadius: 4, cursor: 'pointer', fontFamily: 'inherit',
                    background: genre === g ? C.primary + '22' : 'transparent',
                    border: `1px solid ${genre === g ? C.primary : C.border}`,
                    color: genre === g ? C.primary : C.t2, fontSize: 13, transition: 'all 0.13s',
                  }}>{g}</button>
                ))}
              </div>
            </div>

            <div style={{ color: C.t3, fontSize: 11, fontWeight: 600, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              {uploadType === 'fresh' ? '회차 파일' : '설정집 파일'}
            </div>
            <DragDropArea
              dragging={dragging} fileSelected={fileSelected}
              setDragging={setDragging} setFileSelected={setFileSelected}
              fileLabel={uploadType === 'fresh' ? '회차 파일' : '설정집.txt'}
            />

            {uploadType === 'fresh' && (
              <>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '4px 0 8px' }}>
                  <input
                    type="checkbox" id="includeSettings" checked={includeSettings}
                    onChange={(e) => setIncludeSettings(e.target.checked)}
                    style={{ accentColor: C.primary, width: 14, height: 14, cursor: 'pointer' }}
                  />
                  <label htmlFor="includeSettings" style={{ color: C.t2, fontSize: 13, cursor: 'pointer' }}>
                    설정집도 함께 업로드 <span style={{ color: C.t3 }}>(선택사항)</span>
                  </label>
                </div>
                {includeSettings && (
                  <>
                    <div style={{ color: C.t3, fontSize: 11, fontWeight: 600, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>설정집 파일</div>
                    <DragDropArea
                      dragging={settingsDragging} fileSelected={settingsFileSelected}
                      setDragging={setSettingsDragging} setFileSelected={setSettingsFileSelected}
                      fileLabel="설정집.txt"
                    />
                  </>
                )}
              </>
            )}

            <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
              <button
                onClick={() => uploadType === 'fresh' ? setUploadType(null) : onClose()}
                style={{
                  flex: 1, height: 40, borderRadius: 6, background: 'transparent',
                  border: `1px solid ${C.border}`, color: C.t2, fontSize: 13,
                  cursor: 'pointer', fontFamily: 'inherit',
                }}>
                {uploadType === 'fresh' ? '← 뒤로' : '취소'}
              </button>
              <button
                onClick={() => canProceed && setStep(2)}
                style={{
                  flex: 2, height: 40, borderRadius: 6, border: 'none',
                  background: canProceed ? C.primary : C.border,
                  color: canProceed ? '#fff' : C.t3, fontSize: 13, fontWeight: 600,
                  cursor: canProceed ? 'pointer' : 'default', fontFamily: 'inherit', transition: 'all 0.15s',
                }}>
                다음 — AI 분석
              </button>
            </div>
          </>
        )}

        {uploadType === 'ep-only' && step === 1 && (
          <>
            <div style={{ color: C.t1, fontSize: 17, fontWeight: 700, letterSpacing: '-0.3px', marginBottom: 6 }}>회차 올리기</div>
            <div style={{ color: C.t2, fontSize: 13, marginBottom: 24 }}>회차 파일을 업로드하면 AI가 설정 DB와 대조해 충돌을 탐지합니다</div>

            <div style={{ marginBottom: 16 }}>
              <div style={{ color: C.t3, fontSize: 11, fontWeight: 600, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>작품 선택</div>
              {works ? (
                <select
                  value={episodeWork}
                  onChange={(e) => {
                    const selected = works.find(w => w.title === e.target.value);
                    setEpisodeWork(e.target.value);
                    setEpisodeNum(selected ? String(selected.chapters + 1) : '');
                  }}
                  style={{
                    width: '100%', height: 40, borderRadius: 6,
                    background: C.bg, border: `1px solid ${C.border}`,
                    color: episodeWork ? C.t1 : C.t3, fontSize: 14, padding: '0 12px',
                    fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box', cursor: 'pointer',
                  }}
                >
                  <option value="">작품을 선택하세요</option>
                  {works.map(w => (
                    <option key={w.title} value={w.title}>{w.title}</option>
                  ))}
                </select>
              ) : (
                <div style={{
                  width: '100%', height: 40, borderRadius: 6,
                  background: C.bg, border: `1px solid ${C.border}`,
                  color: C.t1, fontSize: 14, padding: '0 12px',
                  display: 'flex', alignItems: 'center', boxSizing: 'border-box',
                }}>
                  {episodeWork}
                </div>
              )}
            </div>

            {(() => {
              const selectedChapters = works?.find(w => w.title === episodeWork)?.chapters;
              const hintChapters = selectedChapters ?? (initialChapters || null);
              return (
                <div style={{ marginBottom: 16 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                    <div style={{ color: C.t3, fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>회차 번호</div>
                    {hintChapters != null && (
                      <div style={{ color: C.t3, fontSize: 11 }}>마지막 업로드: {hintChapters}화</div>
                    )}
                  </div>
                  <input
                    value={episodeNum} onChange={(e) => setEpisodeNum(e.target.value)}
                    placeholder={hintChapters != null ? String(hintChapters + 1) : '회차 번호 입력'}
                    type="number" min="1"
                    style={{
                      width: '100%', height: 40, borderRadius: 6,
                      background: C.bg, border: `1px solid ${C.border}`,
                      color: C.t1, fontSize: 14, padding: '0 12px',
                      fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box',
                    }}
                  />
                </div>
              );
            })()}

            <div style={{ color: C.t3, fontSize: 11, fontWeight: 600, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>회차 파일</div>
            <DragDropArea
              dragging={dragging} fileSelected={fileSelected}
              setDragging={setDragging} setFileSelected={setFileSelected}
              fileLabel="회차파일.txt"
            />

            <div style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '4px 0 8px' }}>
              <input
                type="checkbox" id="includeSettingsEp" checked={includeSettings}
                onChange={(e) => setIncludeSettings(e.target.checked)}
                style={{ accentColor: C.primary, width: 14, height: 14, cursor: 'pointer' }}
              />
              <label htmlFor="includeSettingsEp" style={{ color: C.t2, fontSize: 13, cursor: 'pointer' }}>
                설정집도 함께 업로드 <span style={{ color: C.t3 }}>(선택사항)</span>
              </label>
            </div>
            {includeSettings && (
              <>
                <div style={{ color: C.t3, fontSize: 11, fontWeight: 600, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>설정집 파일</div>
                <DragDropArea
                  dragging={settingsDragging} fileSelected={settingsFileSelected}
                  setDragging={setSettingsDragging} setFileSelected={setSettingsFileSelected}
                  fileLabel="설정집.txt"
                />
              </>
            )}

            <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
              <button
                onClick={() => mode === 'new-work' ? setUploadType(null) : onClose()}
                style={{
                  flex: 1, height: 40, borderRadius: 6, background: 'transparent',
                  border: `1px solid ${C.border}`, color: C.t2, fontSize: 13,
                  cursor: 'pointer', fontFamily: 'inherit',
                }}>
                {mode === 'new-work' ? '← 뒤로' : '취소'}
              </button>
              <button
                onClick={() => canProceed && setStep(2)}
                style={{
                  flex: 2, height: 40, borderRadius: 6, border: 'none',
                  background: canProceed ? C.primary : C.border,
                  color: canProceed ? '#fff' : C.t3, fontSize: 13, fontWeight: 600,
                  cursor: canProceed ? 'pointer' : 'default', fontFamily: 'inherit', transition: 'all 0.15s',
                }}>
                다음 — AI 대조 분석
              </button>
            </div>
          </>
        )}

        {step === 2 && (() => {
          const cfg = uploadType === 'fresh' || isSettings ? {
            title: uploadType === 'fresh' ? 'AI 분석 중...' : 'AI 설정 DB 구축 중...',
            desc: uploadType === 'fresh' ? '회차 기반 설정 DB를 구축합니다' : '캐릭터·관계·타임라인을 자동 추출합니다',
            items: ['캐릭터 목록 추출 완료', '외모·성격 설정 파싱 중', '관계도 구축 중', '타임라인 분석 대기'],
            onNext: () => setStep(3),
            btnLabel: '계속',
          } : {
            title: 'AI 설정 대조 중...',
            desc: '설정 DB와 대조하여 충돌을 탐지합니다',
            items: ['캐릭터 설정 로드 완료', '회차 텍스트 파싱 중', '충돌 패턴 대조 중', '타임라인 검증 대기'],
            onNext: () => { nav?.('S4', 'dissolve'); onClose(); },
            btnLabel: '결과 보기',
          };
          return (
            <div style={{ textAlign: 'center', padding: '20px 0' }}>
              <motion.div
                animate={{ rotate: 360 }} transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
                style={{ width: 48, height: 48, margin: '0 auto 20px', borderRadius: '50%', border: `3px solid ${C.primary}33`, borderTop: `3px solid ${C.primary}` }}
              />
              <div style={{ color: C.t1, fontSize: 16, fontWeight: 700, marginBottom: 8 }}>{cfg.title}</div>
              <div style={{ color: C.t2, fontSize: 13, marginBottom: 24 }}>{cfg.desc}</div>
              {cfg.items.map((item, i) => (
                <div key={item} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0', textAlign: 'left', justifyContent: 'center' }}>
                  {i < 2 ? <CircleCheckBig size={14} color={C.success} /> : <motion.div animate={{ opacity: [0.3, 1, 0.3] }} transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.3 }} style={{ width: 14, height: 14, borderRadius: '50%', border: `2px solid ${C.t3}` }} />}
                  <span style={{ color: i < 2 ? C.t1 : C.t3, fontSize: 13 }}>{item}</span>
                </div>
              ))}
              <button
                onClick={cfg.onNext}
                style={{
                  marginTop: 24, height: 38, padding: '0 24px', borderRadius: 6,
                  background: C.primary, border: 'none', color: '#fff', fontSize: 13,
                  fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
                }}>{cfg.btnLabel}</button>
            </div>
          );
        })()}

        {(isSettings || uploadType === 'fresh') && step === 3 && (
          <>
            <div style={{ color: C.t1, fontSize: 17, fontWeight: 700, marginBottom: 6 }}>추출 결과 확인 · 수정</div>
            <div style={{ color: C.t2, fontSize: 13, marginBottom: 20 }}>AI가 설정집에서 추출한 항목을 확인하고 필요시 수정하세요</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 20 }}>
              {[
                {
                  type: '캐릭터', count: 5, color: C.primary, icon: <Users size={12} />,
                  items: ['수아 (주인공)', '강민준 (남자주인공)', '이레나 (라이벌)'],
                },
                {
                  type: '아이템', count: 3, color: C.warning, icon: <BookOpen size={12} />,
                  items: ['증거 봉투', '법원 영장', '검사 배지'],
                },
                {
                  type: '스킬', count: 4, color: C.success, icon: <Sparkles size={12} />,
                  items: ['반대심문', '증거 제출', '공판 개시'],
                },
                {
                  type: '타임라인', count: 8, color: '#4BB8D9', icon: <Clock size={12} />,
                  items: ['1화: 수아 등장', '3화: 강민준 등장', '23화: 갈색 눈 설정'],
                },
              ].map((cat) => (
                <div key={cat.type} style={{
                  background: C.bg, borderRadius: 6, border: `1px solid ${C.border}`,
                  overflow: 'hidden',
                }}>
                  <div style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '9px 14px', borderBottom: `1px solid ${C.border}`,
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ color: cat.color }}>{cat.icon}</span>
                      <span style={{ color: cat.color, fontSize: 13, fontWeight: 600 }}>{cat.type}</span>
                    </div>
                    <span style={{ color: C.t3, fontSize: 12 }}>{cat.count}개 추출됨</span>
                  </div>
                  <div style={{ padding: '8px 14px', display: 'flex', flexDirection: 'column', gap: 3 }}>
                    {cat.items.map(item => (
                      <span key={item} style={{ color: C.t2, fontSize: 12 }}>· {item}</span>
                    ))}
                    {cat.count > 3 && (
                      <span style={{ color: C.t3, fontSize: 11 }}>+ {cat.count - 3}개 더...</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={onClose} style={{
                flex: 1, height: 40, borderRadius: 6, border: `1px solid ${C.border}`,
                background: 'transparent', color: C.t2, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit',
              }}>나중에 수정</button>
              <button onClick={onClose} style={{
                flex: 2, height: 40, borderRadius: 6, border: 'none',
                background: C.primary, color: '#fff', fontSize: 13, fontWeight: 600,
                cursor: 'pointer', fontFamily: 'inherit',
              }}>설정 DB 확정 및 등록</button>
            </div>
          </>
        )}
      </motion.div>
    </motion.div>
  );
}

function WorkCard({ title, genre, chapters, conflicts, hasConflict, lastUpdated, selected, onClick, onReport, onEditor, onEpisode }: {
  title: string; genre: string; chapters: number; conflicts: number;
  hasConflict: boolean; lastUpdated?: string; selected?: boolean;
  onClick?: () => void; onReport?: () => void; onEditor?: () => void; onEpisode?: () => void;
}) {
  return (
    <div onClick={onClick} style={{
      background: C.surface,
      borderRadius: 8, border: `1px solid ${selected ? C.primary + '66' : C.border}`,
      padding: 18, cursor: 'pointer', transition: 'all 0.15s',
      boxShadow: selected ? `0 0 0 2px ${C.primary}33` : 'none',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
        <div>
          <div style={{ color: C.t1, fontSize: 14, fontWeight: 600, marginBottom: 4 }}>{title}</div>
          <div style={{ display: 'flex', gap: 6 }}>
            <span style={{ padding: '2px 7px', borderRadius: 3, background: C.primary + '18', color: C.primary, fontSize: 11, fontWeight: 500, border: `1px solid ${C.primary}33` }}>{genre}</span>
            <span style={{ color: C.t3, fontSize: 12 }}>{chapters}화</span>
          </div>
        </div>
        <span style={{
          padding: '3px 8px', borderRadius: 4, fontSize: 11, fontWeight: 600,
          background: hasConflict ? '#3D1515' : '#0D2E1E',
          color: hasConflict ? C.danger : C.success,
          border: `1px solid ${hasConflict ? C.danger + '44' : C.success + '44'}`,
        }}>
          충돌 {conflicts}건
        </span>
      </div>
      {lastUpdated && <div style={{ color: C.t3, fontSize: 11, marginBottom: 12 }}>{lastUpdated} 업데이트</div>}
      <div style={{ display: 'flex', gap: 6 }}>
        {onReport && <BtnG label="리포트" onClick={() => { onReport?.(); }} small icon={<BarChart3 size={11} />} />}
        {onEditor && <BtnG label="에디터" onClick={() => { onEditor?.(); }} small icon={<FileText size={11} />} />}
        {onEpisode && <BtnG label="회차 올리기" onClick={() => { onEpisode?.(); }} small icon={<Upload size={11} />} />}
      </div>
    </div>
  );
}

// ── 설정집 빌더 타입 ─────────────────────────────
interface SettingEntry {
  id: string;
  label: string;       // AI가 생성한 항목명 (편집 가능)
  content: string;     // 사용자가 채우는 값
  placeholder: string; // AI 예시 답변
  isSpoiler: boolean;
}
interface CharacterSetting { id: string; name: string; seed: string; entries: SettingEntry[]; }

type WorldCategory = 'geography' | 'society' | 'magic_tech' | 'history' | 'rules' | 'place';
interface WorldSetting { id: string; category: WorldCategory; title: string; entries: SettingEntry[]; }

const mkId = () => Math.random().toString(36).slice(2, 8);

const CHAR_COLORS: Record<string, string> = {
  sua: C.primary, min: '#E25C5C', lena: '#4BB8D9', hayun: C.success, choi: '#D4A04A',
};

function mkE(label: string, content: string, isSpoiler = false): SettingEntry {
  return { id: mkId(), label, content, placeholder: '', isSpoiler };
}

const INIT_CHARS: CharacterSetting[] = [
  { id: 'sua',  name: '수아',    seed: '', entries: [mkE('역할','주인공'), mkE('나이','23세'), mkE('눈','갈색'), mkE('직업','검사 지망생'), mkE('첫등장','1화')] },
  { id: 'min',  name: '강민준',  seed: '', entries: [mkE('역할','남자주인공'), mkE('나이','32세'), mkE('눈','짙은갈색'), mkE('직업','수석검사'), mkE('첫등장','3화')] },
  { id: 'lena', name: '이레나',  seed: '', entries: [mkE('역할','라이벌/화해'), mkE('나이','28세'), mkE('눈','흑색'), mkE('직업','변호사'), mkE('첫등장','12화')] },
  { id: 'hayun',name: '하윤',    seed: '', entries: [mkE('역할','절친'), mkE('나이','23세'), mkE('눈','밝은갈색'), mkE('직업','대학원생'), mkE('첫등장','2화')] },
  { id: 'choi', name: '최 검사', seed: '', entries: [mkE('역할','상사'), mkE('나이','45세'), mkE('눈','—'), mkE('직업','검사장'), mkE('첫등장','5화')] },
];

interface CharAppearance { ep: number; desc: string; conflict?: boolean }
interface CharDetailData {
  appearances: CharAppearance[];
  conflicts: { title: string; ep: number }[];
  relations: { name: string; type: string; color: string }[];
}
const CHAR_DETAIL: Record<string, CharDetailData> = {
  sua: {
    appearances: [
      { ep: 1,   desc: '첫 등장 · 법학전문대학원 수석 졸업' },
      { ep: 23,  desc: '눈 색 확정 묘사 — 갈색 눈동자' },
      { ep: 82,  desc: '3년 경과 서술 (나이 오류 위험)' },
      { ep: 89,  desc: '임용 대기 중 서술' },
      { ep: 159, desc: '설정 충돌 감지', conflict: true },
    ],
    conflicts: [
      { title: '눈 색 불일치 (갈색 → 파란 눈)', ep: 159 },
      { title: '나이 계산 오류 (26세여야 함 → 25세 서술)', ep: 159 },
      { title: '임용 전 단독 수사 서술 (규칙 위반)', ep: 123 },
    ],
    relations: [
      { name: '강민준', type: '로맨스', color: '#E25C5C' },
      { name: '이레나',  type: '화해',   color: '#4BB8D9' },
      { name: '하윤',   type: '절친',   color: C.success },
    ],
  },
  min: {
    appearances: [
      { ep: 3,   desc: '첫 등장 · 수석검사로 법정 입장' },
      { ep: 5,   desc: '성격 확정 묘사 — 냉담·절제' },
      { ep: 23,  desc: '수아와 첫 단독 대면' },
      { ep: 159, desc: '즉각적 감정 노출 서술', conflict: true },
    ],
    conflicts: [
      { title: '감정 흐름 불일치 (냉담 → 즉각 노출)', ep: 159 },
    ],
    relations: [
      { name: '수아',   type: '로맨스', color: C.primary },
      { name: '최검사', type: '상사',   color: '#D4A04A' },
      { name: '이레나', type: '적대',   color: '#4BB8D9' },
    ],
  },
  lena: {
    appearances: [
      { ep: 12,  desc: '첫 등장 · 변호사로 법정 출석' },
      { ep: 55,  desc: '수아와 첫 충돌' },
      { ep: 142, desc: '수아와 화해 완료' },
      { ep: 159, desc: '적대 관계로 재묘사', conflict: true },
    ],
    conflicts: [
      { title: '관계 상태 불일치 (화해 완료 → 적대 묘사)', ep: 159 },
    ],
    relations: [
      { name: '수아',    type: '화해',  color: C.primary },
      { name: '강민준',  type: '적대',  color: '#E25C5C' },
      { name: '오변호사', type: '동료', color: '#00C896' },
    ],
  },
  hayun: {
    appearances: [
      { ep: 2,  desc: '첫 등장 · 수아의 절친' },
      { ep: 18, desc: '수사 조력 장면' },
      { ep: 89, desc: '대학원 진학 서술' },
    ],
    conflicts: [],
    relations: [
      { name: '수아', type: '절친', color: C.primary },
    ],
  },
  choi: {
    appearances: [
      { ep: 5,   desc: '첫 등장 · 수사팀 회의 주재' },
      { ep: 23,  desc: '강민준과 단독 면담' },
      { ep: 101, desc: '최종 보스 복선 시작' },
    ],
    conflicts: [],
    relations: [
      { name: '강민준', type: '부하',  color: '#E25C5C' },
      { name: '이레나', type: '적대',  color: '#4BB8D9' },
    ],
  },
};

const WORLD_CATEGORY_META: Record<WorldCategory, { label: string; color: string; icon: React.ReactNode }> = {
  geography:  { label: '지리/환경', color: C.success,  icon: <Globe size={12} /> },
  society:    { label: '사회/문화', color: C.primary,  icon: <Users size={12} /> },
  magic_tech: { label: '마법/기술', color: '#B48BFF',  icon: <Sparkles size={12} /> },
  history:    { label: '역사',      color: C.warning,  icon: <BookOpen size={12} /> },
  rules:      { label: '세계 규칙', color: C.danger,   icon: <Scale size={12} /> },
  place:      { label: '장소',      color: '#4BB8D9',  icon: <MapPin size={12} /> },
};

const INIT_WORLD_SETTINGS: WorldSetting[] = [
  {
    id: 'wr-rules', category: 'rules', title: '법정·수사 규칙',
    entries: [
      mkE('검사와 피의자', '사적으로 접촉 불가'),
      mkE('증거 제출 기한', '공판 3일 전'),
      mkE('임용 전 검사',   '독립 수사 권한 없음'),
    ],
  },
  {
    id: 'wr-chars', category: 'society', title: '캐릭터 공통 설정',
    entries: [
      mkE('수아',   '법학전문대학원 수석 졸업'),
      mkE('이레나', '수아와 같은 법무법인 출신'),
      mkE('강민준', '10년 경력의 냉혹한 검사'),
    ],
  },
  {
    id: 'wr-place', category: 'place', title: '장소 설정',
    entries: [
      mkE('주 무대',          '서울 중앙지방검찰청'),
      mkE('주요 법정',        '3호 법정 (분위기 서늘, 조명 냉백색)'),
      mkE('수아 거주지',      '을지로 14층 오피스텔 (혼자 거주)'),
      mkE('강민준 사무실',    '검찰청 12층, 1인실, 창문에서 한강 조망'),
      mkE('단골 카페',        '검찰청 인근 을지로 스페셜티 카페'),
      mkE('수사팀 회의실',    '지하 2층, 보안구역, 출입카드 필요'),
      mkE('범인 거주지',      '—'),
      mkE('병원',             '서울대병원 응급실 — 주요 목격자 이송'),
      mkE('수아 모교',        '서울대 법학전문대학원 (회상 장면)'),
      mkE('구치소',           '서울 구치소 — 피의자 면담 장소'),
    ],
  },
  {
    id: 'wt-forensic', category: 'magic_tech', title: '디지털 포렌식',
    entries: [
      mkE('기술/능력 이름', '디지털 포렌식'),
      mkE('설명/개요',      '전자 증거 분석 및 삭제 데이터 복구'),
      mkE('사용 조건',      '법원 영장 + 수사팀 IT 전담 요원 참여'),
      mkE('제약사항',       '최소 48시간 소요, 결과 법원 허가 후 제출'),
      mkE('활용 사례',      '스마트폰·PC 삭제 파일·통화 기록 복구'),
      mkE('담당 인물/기관', '수사팀 IT 포렌식 전담 요원'),
      mkE('법적 약점',      '압수수색 절차 위반 시 위법 수집 증거로 전면 배제 가능',    true),
      mkE('기술적 약점',    '기기 완전 초기화 + 덮어쓰기(7회↑) 시 복구 불가',          true),
      mkE('무력화 방법',    '변호인이 해시값 무결성 오류 입증 시 증거 능력 소멸',        true),
      mkE('충돌 위험',      '159화 — 수아 측 압수 절차 하자로 핵심 증거 위기',          true),
    ],
  },
  {
    id: 'wt-dna', category: 'magic_tech', title: 'DNA 감식',
    entries: [
      mkE('기술/능력 이름', 'DNA 감식'),
      mkE('설명/개요',      '생체 샘플 분석으로 피의자·피해자 특정'),
      mkE('사용 조건',      '현장 검체 확보, 국과수 의뢰'),
      mkE('제약사항',       '결과 통보 7~14일 소요'),
      mkE('활용 사례',      '현장 혈흔·모발에서 피의자 동일인 확인'),
      mkE('담당 인물/기관', '국립과학수사연구원'),
      mkE('과학적 약점',    '루미놀은 혈액 외 염소계 세제·식물에도 반응 → 오탐 가능',  true),
      mkE('오염 위험',      '검체 보관·이송 중 오염 시 결과 무효, 재채취 불가',         true),
      mkE('법적 허점',      '검체 채취 동의 없거나 영장 미비 시 증거 능력 소멸',        true),
      mkE('무력화 방법',    '변호인이 국과수 분석 과정 오염·오류 입증 시 전면 무효',     true),
    ],
  },
  {
    id: 'wt-cctv', category: 'magic_tech', title: 'CCTV 추적 시스템',
    entries: [
      mkE('기술/능력 이름', 'CCTV 추적 시스템'),
      mkE('설명/개요',      '도심 카메라망 연계 피의자 동선 추적'),
      mkE('사용 조건',      '경찰 협력 + 수사 영장'),
      mkE('제약사항',       '저장 기간 30일, 검찰청 지하 2층 사각지대'),
      mkE('활용 사례',      '피의자 알리바이 파훼, 도주 경로 재구성'),
      mkE('담당 인물/기관', '수사팀 + 경찰 사이버수사대'),
      mkE('법적 약점',      '영장 없이 취득한 영상은 위법 수집 증거로 법정 배제 가능',  true),
      mkE('기술적 약점',    '저장 기간(30일) 초과 시 완전 삭제, 복구 불가',            true),
      mkE('사각지대',       '검찰청 지하 2층 특정 복도·계단 미설치 구간 — 핵심 장면 위치', true),
      mkE('무력화 방법',    '변호인이 영상 연속성 단절(편집 의혹) 제기 시 증거력 약화',  true),
    ],
  },
];

function generateMockEntries(_seed: string): SettingEntry[] {
  const e = (label: string, placeholder: string, isSpoiler = false): SettingEntry =>
    ({ id: mkId(), label, content: '', placeholder, isSpoiler });
  return [
    // 기본
    e('역할',              '주인공 / 라이벌 / 조력자'),
    e('성별',              '여성'),
    e('나이',              '23세'),
    e('호칭 / 별명',       '"검사님" — 직위에서 비롯된 호칭'),
    // 외모
    e('눈 색깔',           '짙은 갈색'),
    e('머리 색 / 스타일',  '흑발, 단발'),
    e('키 / 체형',         '170cm, 보통 체형'),
    e('특이한 신체 특징',  '왼쪽 손목 흉터'),
    e('목소리 특징',       '낮고 차분한 편'),
    // 배경
    e('출신지 / 성장 배경','서울 출신, 평범한 중산층 가정'),
    e('학력 / 경력',       '서울대 법학전문대학원 수석 졸업'),
    e('가족 관계',         '부모 사망, 현재 혼자 생활'),
    e('현재 소속 / 직위',  '서울 중앙지검 검사 지망생'),
    e('재산 / 경제 상황',  '학자금 대출 상환 중, 오피스텔 월세'),
    // 성격
    e('성격',              '원칙주의적이지만 감정에 약함'),
    e('성격이 그렇게 된 이유', '어린 시절 부당한 일을 겪고 정의감 형성', true),
    e('말버릇 / 입버릇',   '긴장하면 "그렇죠?"를 반복'),
    e('습관',              '생각할 때 볼펜을 돌림'),
    e('스트레스 받을 때 행동', '말없이 사라져서 혼자 해결하려 함'),
    // 내면
    e('매력',              '강직함 속에 숨은 따뜻함'),
    e('강점',              '뛰어난 기억력과 논리적 사고'),
    e('약점',              '특정 인물에 대한 집착으로 판단력 흐려짐', true),
    e('콤플렉스',          '가족의 비밀로 인한 죄책감', true),
    e('자신만의 가치관',   '진실은 반드시 밝혀져야 한다'),
    e('가장 두려워하는 것','자신이 아버지와 같은 사람이 될까 봐', true),
    e('표면적 욕구',       '검사가 되어 사회 정의를 실현'),
    e('내면적 욕구',       '아버지에게서 도망치지 않는 자신이 되고 싶음', true),
    e('자기기만',          '"나는 감정에 흔들리지 않는다"고 믿음', true),
    e('타인이 모르는 비밀','핵심 증거를 은폐한 적이 있음', true),
    // 서사
    e('현재 처지',         '시험 준비 중인 검사 지망생'),
    e('주인공과의 관계',   '처음엔 적대, 이후 협력 관계로 발전'),
    e('주인공을 어떻게 변화시키는가', '주인공이 감정을 직면하도록 강제함'),
    e('결말에서의 운명',   '모든 진실을 밝히고 떠남', true),
  ];
}

function generateWorldEntries(category: WorldCategory, sourceText: string): SettingEntry[] {
  const filled = sourceText.trim().length > 0;
  const e = (label: string, placeholder: string, content = ''): SettingEntry =>
    ({ id: mkId(), label, content, placeholder, isSpoiler: false });
  const templates: Record<WorldCategory, Array<[string, string, string]>> = {
    geography: [
      ['주요 대륙/지역', '서울특별시 및 수도권',             filled ? '서울 및 수도권' : ''],
      ['기후 특성',      '한국의 사계절, 겨울이 긴 편',      filled ? '현대 한국 기후' : ''],
      ['지형 특징',      '한강이 가로지르는 도심',           filled ? '—' : ''],
      ['주요 지명',      '서초구 법원 삼거리, 을지로 일대',  filled ? '서울 중앙지검, 을지로' : ''],
    ],
    society: [
      ['지배 체제',  '민주공화제 / 3권 분립',            filled ? '민주주의 국가' : ''],
      ['사회 계층',  '법조계 엘리트, 일반 시민',         filled ? '법조계 위계 구조' : ''],
      ['주요 세력',  '검찰, 변호사 단체, 재벌 그룹',     filled ? '검찰청, 변호사 단체' : ''],
      ['경제 체제',  '자본주의 시장경제',                filled ? '현대 자본주의' : ''],
    ],
    magic_tech: [
      ['기술/능력 이름',    '디지털 포렌식',                     filled ? '디지털 포렌식' : ''],
      ['설명/개요',         '전자 증거 분석 및 데이터 복구',     filled ? '전자 증거 분석 기법' : ''],
      ['사용 조건',         '법원 영장, 전문 인력 필요',         filled ? '법원 영장 필요' : ''],
      ['제약사항',          '분석 시간 최소 48시간',             filled ? '—' : ''],
      ['활용 사례',         '스마트폰 삭제 데이터 복구',         filled ? '—' : ''],
      ['담당 인물/기관',    '수사팀 IT 포렌식 전담 요원',        filled ? '—' : ''],
    ],
    history: [
      ['시대 배경',     '2020년대 현대 한국',                    filled ? '현대 한국, 21세기' : ''],
      ['주요 사건',     '검찰 개혁 법안 통과, 수사권 조정',      filled ? '검찰 개혁 이슈' : ''],
      ['현재 상황 원인','검찰·경찰 갈등이 조직 내 분열 초래',    filled ? '수아 아버지 사건의 여파' : ''],
    ],
    rules: [
      ['핵심 규칙',         '검사는 피의자와 사적 접촉 불가',         filled ? '검사는 피의자와 사적 접촉 불가' : ''],
      ['금기·위반 시 결과', '직권 남용 시 파면 및 형사처벌',          filled ? '직권 남용으로 파면' : ''],
      ['예외 규정',         '긴급 수사 명령 시 일부 제한 완화 가능',  filled ? '긴급 수사 명령 시 예외 가능' : ''],
    ],
    place: [
      ['장소 이름',            '서울 중앙지방검찰청',                  filled ? '서울 중앙지방검찰청' : ''],
      ['분위기·특징',          '엄숙하고 위압적, 냉형광등 조명',      filled ? '엄숙하고 위압감 있는 청사' : ''],
      ['위치/접근',            '서초구, 지하철 서초역 도보 5분',       filled ? '—' : ''],
      ['주요 인물 연관',       '수아가 매일 출근하는 공간',            filled ? '수아의 주 활동 무대' : ''],
      ['자주 등장하는 시간대', '출퇴근 시간 및 심야 수사',             filled ? '—' : ''],
      ['장소의 비밀/특이사항', '지하 1층 기록보관소, 감시 사각지대',  filled ? '—' : ''],
      ['주변 랜드마크',        '서초구청, 법원 삼거리, 양재천',        filled ? '—' : ''],
      ['충돌 위험 요소',       '—',                                    filled ? '—' : ''],
    ],
  };
  return templates[category].map(([label, placeholder, content]) => e(label, placeholder, content));
}

// ── EntryRow ─────────────────────────────────────
function EntryRow({ entry, onChange, onRemove }: {
  entry: SettingEntry;
  onChange: (p: Partial<SettingEntry>) => void;
  onRemove: () => void;
}) {
  const [revealed, setRevealed] = useState(false);
  const [focused, setFocused] = useState(false);
  const showContent = !entry.isSpoiler || revealed;
  const showHint = focused && entry.content === '' && !!entry.placeholder && showContent;

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowRight' && entry.content === '' && entry.placeholder) {
      e.preventDefault();
      onChange({ content: entry.placeholder });
    }
  };

  const baseInp: React.CSSProperties = {
    height: 34, borderRadius: 5, background: C.bg,
    border: `1px solid ${focused ? C.primary : C.border}`,
    color: C.t1, fontSize: 12, padding: '0 10px',
    fontFamily: 'inherit', outline: 'none', width: '100%', boxSizing: 'border-box',
  };

  return (
    <div style={{
      display: 'grid', gridTemplateColumns: '130px 1fr 28px 28px', gap: 8, alignItems: 'center',
      paddingLeft: 6,
      borderLeft: entry.isSpoiler ? `2px solid ${C.danger}66` : '2px solid transparent',
      transition: 'border-color 0.15s',
    }}>
      {/* 항목명 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        <input value={entry.label} onChange={e => onChange({ label: e.target.value })} placeholder="항목명"
          style={{ ...baseInp, color: C.t2, fontWeight: 500, border: `1px solid ${C.border}` }} />
      </div>

      {/* 내용 입력 or 마스킹 */}
      <div style={{ position: 'relative' }}>
        {showContent ? (
          <input
            value={entry.content}
            onChange={e => onChange({ content: e.target.value })}
            placeholder={entry.placeholder}
            onKeyDown={handleKeyDown}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            style={{
              ...baseInp,
              paddingRight: (entry.isSpoiler && revealed) ? 72 : (showHint ? 52 : 10),
            }}
          />
        ) : (
          <div style={{
            height: 34, display: 'flex', alignItems: 'center', gap: 8, paddingLeft: 10,
            borderRadius: 5, background: C.danger + '08',
          }}>
            <span style={{ color: C.danger + 'BB', letterSpacing: 3, fontSize: 11 }}>●●●●●</span>
            <span style={{ color: C.danger, fontSize: 10, fontWeight: 600, flexShrink: 0 }}>스포일러</span>
            <button onClick={() => setRevealed(true)}
              style={{ background: 'none', border: 'none', color: C.t3, cursor: 'pointer', fontSize: 11, padding: 2, display: 'flex', alignItems: 'center', gap: 3, marginLeft: 'auto', marginRight: 4 }}>
              <Eye size={11} /> 잠깐 보기
            </button>
          </div>
        )}
        {/* → 수용 힌트 */}
        {showHint && (
          <span style={{
            position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)',
            fontSize: 10, color: C.t3, pointerEvents: 'none', userSelect: 'none',
            background: C.bg, padding: '0 3px',
          }}>→ 수용</span>
        )}
        {/* 열람 중 다시 숨기기 */}
        {entry.isSpoiler && revealed && (
          <button onClick={() => setRevealed(false)}
            style={{
              position: 'absolute', right: 6, top: '50%', transform: 'translateY(-50%)',
              background: C.bg, border: 'none', color: C.t3, cursor: 'pointer',
              padding: '2px 6px', borderRadius: 4,
              display: 'flex', alignItems: 'center', gap: 3, fontSize: 11,
            }}>
            <EyeOff size={11} /> 숨기기
          </button>
        )}
      </div>

      {/* 🔒 스포일러 설정/해제 — 잠금 아이콘으로 역할 명시 */}
      <button
        onClick={() => { onChange({ isSpoiler: !entry.isSpoiler }); setRevealed(false); }}
        title={entry.isSpoiler ? '스포일러 해제 (공유 시 공개됨)' : '스포일러 설정 (공유 시 가려짐)'}
        style={{
          background: 'none', border: 'none', cursor: 'pointer', padding: 4,
          color: entry.isSpoiler ? C.danger : C.t3,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          transition: 'color 0.13s',
        }}>
        {entry.isSpoiler ? <Lock size={13} /> : <LockOpen size={13} />}
      </button>

      {/* 삭제 */}
      <button onClick={onRemove}
        style={{ background: 'none', border: 'none', color: C.t3, cursor: 'pointer', padding: 4, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Trash2 size={13} />
      </button>
    </div>
  );
}

// ── SavedSettingCard ──────────────────────────────
function SavedSettingCard({ setting }: { setting: CharacterSetting }) {
  const spoilerCount = setting.entries.filter(e => e.isSpoiler).length;
  const filledCount = setting.entries.filter(e => e.content.trim()).length;
  return (
    <div style={{ background: C.bg, borderRadius: 8, border: `1px solid ${C.border}`, padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ width: 40, height: 40, borderRadius: '50%', flexShrink: 0, background: C.primary + '22', border: `1.5px solid ${C.primary}`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.primary, fontSize: 16, fontWeight: 700 }}>
          {setting.name[0] || '?'}
        </div>
        <div>
          <div style={{ color: C.t1, fontSize: 14, fontWeight: 600 }}>{setting.name}</div>
          <div style={{ color: C.primary, fontSize: 11, fontWeight: 500, display: 'flex', alignItems: 'center', gap: 4 }}>
            <Sparkles size={10} /> 설정집
          </div>
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
        {[
          { k: '설정 항목', v: `${setting.entries.length}개` },
          { k: '작성 완료', v: `${filledCount}개` },
          { k: '스포일러', v: spoilerCount > 0 ? `${spoilerCount}개 숨김` : '없음' },
        ].map(item => (
          <div key={item.k} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ color: C.t3, fontSize: 12 }}>{item.k}</span>
            <span style={{ color: C.t2, fontSize: 12 }}>{item.v}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── SettingsBuilderModal ──────────────────────────
function SettingsBuilderModal({ onClose, onSave, initial }: {
  onClose: () => void;
  onSave: (s: CharacterSetting) => void;
  initial?: CharacterSetting;
}) {
  const [name, setName] = useState(initial?.name ?? '');
  const [seed, setSeed] = useState(initial?.seed ?? '');
  const [entries, setEntries] = useState<SettingEntry[]>(initial?.entries ?? []);
  const [generated, setGenerated] = useState(!!initial);

  const addEntry = () => setEntries(p => [...p, { id: mkId(), label: '', content: '', placeholder: '', isSpoiler: false }]);
  const rmEntry = (id: string) => setEntries(p => p.filter(e => e.id !== id));
  const upEntry = (id: string, patch: Partial<SettingEntry>) =>
    setEntries(p => p.map(e => e.id === id ? { ...e, ...patch } : e));

  const generate = () => {
    setEntries(generateMockEntries(seed));
    setGenerated(true);
  };

  const handleSave = () => {
    onSave({ id: initial?.id ?? mkId(), name: name.trim(), seed, entries });
    onClose();
  };

  const baseStyle: React.CSSProperties = {
    borderRadius: 6, background: C.bg, border: `1px solid ${C.border}`,
    color: C.t1, fontFamily: 'inherit', outline: 'none',
  };

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', zIndex: 200, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', overflowY: 'auto', padding: '40px 20px' }}
      onClick={onClose}
    >
      <motion.div
        initial={{ y: 32, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
        exit={{ y: 16, opacity: 0 }} transition={{ duration: 0.22, ease: 'easeOut' }}
        onClick={e => e.stopPropagation()}
        style={{ width: 660, background: C.surface, borderRadius: 12, border: `1px solid ${C.border}`, boxShadow: '0 24px 64px rgba(0,0,0,0.6)', marginBottom: 40 }}
      >
        {/* 헤더 */}
        <div style={{ padding: '24px 28px 20px', borderBottom: `1px solid ${C.border}` }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <div style={{ color: C.t1, fontSize: 16, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
              <Sparkles size={16} color={C.primary} /> {initial ? '캐릭터 설정 수정' : '캐릭터 설정 만들기'}
            </div>
            <button onClick={onClose} style={{ background: 'none', border: 'none', color: C.t3, cursor: 'pointer', padding: 4 }}>
              <X size={18} />
            </button>
          </div>
          <input value={name} onChange={e => setName(e.target.value)} placeholder="캐릭터 이름"
            style={{ ...baseStyle, width: '100%', height: 40, fontSize: 15, fontWeight: 600, padding: '0 12px', boxSizing: 'border-box' }}
            onFocus={e => (e.target.style.borderColor = C.primary)} onBlur={e => (e.target.style.borderColor = C.border)} />
        </div>

        {/* 바디 */}
        <div style={{ padding: '20px 28px', display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* 힌트 입력 + AI 생성 */}
          {!generated && (
            <>
              <div>
                <div style={{ color: C.t3, fontSize: 12, marginBottom: 8 }}>
                  떠오르는 설정을 간단히 적으면 AI가 항목을 맞춤 생성합니다 (선택)
                </div>
                <textarea value={seed} onChange={e => setSeed(e.target.value)}
                  placeholder={'예) 수아는 검사 지망생인데 아버지가 범인임. 이걸 숨기고 있고 강민준은 눈치채는 것 같음...'}
                  style={{ ...baseStyle, width: '100%', height: 100, fontSize: 13, lineHeight: 1.7, padding: '10px 12px', resize: 'none', boxSizing: 'border-box' }}
                  onFocus={e => (e.target.style.borderColor = C.primary)} onBlur={e => (e.target.style.borderColor = C.border)} />
              </div>
              <button onClick={generate} style={{
                height: 42, borderRadius: 7, border: 'none', background: C.primary, color: '#fff',
                fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, transition: 'opacity 0.15s',
              }}
                onMouseEnter={e => { e.currentTarget.style.opacity = '0.85'; }}
                onMouseLeave={e => { e.currentTarget.style.opacity = '1'; }}>
                <Sparkles size={15} /> AI 항목 생성
              </button>
            </>
          )}

          {/* 생성된 항목 목록 */}
          {generated && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '130px 1fr 28px 28px', gap: 8, padding: '0 2px', paddingLeft: 8 }}>
                {['항목', '내용  (→ 키로 예시 수용)', '🔒', ''].map((h, i) => (
                  <span key={i} style={{ color: C.t3, fontSize: 11 }}>{h}</span>
                ))}
              </div>
              {entries.map(e => (
                <EntryRow key={e.id} entry={e} onChange={p => upEntry(e.id, p)} onRemove={() => rmEntry(e.id)} />
              ))}
              <button onClick={addEntry} style={{
                height: 32, borderRadius: 5, border: `1px dashed ${C.border}`, background: 'transparent',
                color: C.t3, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5, transition: 'all 0.13s',
              }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = C.primary; e.currentTarget.style.color = C.primary; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.color = C.t3; }}>
                <Plus size={13} /> 항목 추가
              </button>
            </div>
          )}
        </div>

        {/* 푸터 */}
        <div style={{ padding: '16px 28px', borderTop: `1px solid ${C.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ color: C.t3, fontSize: 12 }}>
            {generated
              ? <>
                  {entries.length}개 항목 ·{' '}
                  <span style={{ color: C.danger + 'AA' }}>
                    <Lock size={10} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 2 }} />
                    {entries.filter(e => e.isSpoiler).length}개
                  </span>
                  {' '}는 챗봇·공유 시 가려짐
                </>
              : 'AI 항목 생성 후 내용을 채워주세요'}
          </span>
          <div style={{ display: 'flex', gap: 8 }}>
            <BtnG label="취소" onClick={onClose} />
            <BtnP label="저장" onClick={name.trim() && generated ? handleSave : undefined} icon={<Check size={14} />} />
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ── WorldBuilderModal ──────────────────────────────
function WorldBuilderModal({ onClose, onSave, initial }: {
  onClose: () => void;
  onSave: (ws: WorldSetting) => void;
  initial?: WorldSetting;
}) {
  const [title, setTitle] = useState(initial?.title ?? '');
  const [category, setCategory] = useState<WorldCategory>(initial?.category ?? 'geography');
  const [entries, setEntries] = useState<SettingEntry[]>(initial?.entries ?? []);
  const [generated, setGenerated] = useState(!!initial);
  const [mode, setMode] = useState<'manual' | 'extract'>('manual');
  const [uploadType, setUploadType] = useState<'settings' | 'new_ep' | 'bulk_ep'>('settings');
  const [uploadedFile, setUploadedFile] = useState('');
  const [dragging, setDragging] = useState(false);

  const prevCategoryRef = React.useRef(category);
  React.useEffect(() => {
    if (prevCategoryRef.current === category) return;
    prevCategoryRef.current = category;
    if (generated) setEntries(generateWorldEntries(category, ''));
  }, [category]); // eslint-disable-line react-hooks/exhaustive-deps

  const addEntry = () => setEntries(p => [...p, { id: mkId(), label: '', content: '', placeholder: '', isSpoiler: false }]);
  const rmEntry = (id: string) => setEntries(p => p.filter(e => e.id !== id));
  const upEntry = (id: string, patch: Partial<SettingEntry>) =>
    setEntries(p => p.map(e => e.id === id ? { ...e, ...patch } : e));

  const generate = () => {
    const hasSrc = mode === 'extract' && uploadedFile;
    setEntries(generateWorldEntries(category, hasSrc ? uploadedFile : ''));
    setGenerated(true);
  };

  const handleSave = () => {
    onSave({ id: initial?.id ?? mkId(), category, title: title.trim(), entries });
    onClose();
  };

  const meta = WORLD_CATEGORY_META[category];
  const canGenerate = mode === 'manual' || !!uploadedFile;

  const baseStyle: React.CSSProperties = {
    borderRadius: 6, background: C.bg, border: `1px solid ${C.border}`,
    color: C.t1, fontFamily: 'inherit', outline: 'none',
  };

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', zIndex: 200, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', overflowY: 'auto', padding: '40px 20px' }}
      onClick={onClose}
    >
      <motion.div
        initial={{ y: 32, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
        exit={{ y: 16, opacity: 0 }} transition={{ duration: 0.22, ease: 'easeOut' }}
        onClick={e => e.stopPropagation()}
        style={{ width: 660, background: C.surface, borderRadius: 12, border: `1px solid ${C.border}`, boxShadow: '0 24px 64px rgba(0,0,0,0.6)', marginBottom: 40 }}
      >
        {/* 헤더 */}
        <div style={{ padding: '24px 28px 20px', borderBottom: `1px solid ${C.border}` }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <div style={{ color: C.t1, fontSize: 16, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
              <Globe size={16} color={C.success} /> {initial ? '세계관 설정 수정' : '세계관 설정 만들기'}
            </div>
            <button onClick={onClose} style={{ background: 'none', border: 'none', color: C.t3, cursor: 'pointer', padding: 4 }}>
              <X size={18} />
            </button>
          </div>
          <input
            value={title} onChange={e => setTitle(e.target.value)}
            placeholder="설정 카드 제목 (예: 대륙 지형, 마법 체계, 사회 계층)"
            style={{ ...baseStyle, width: '100%', height: 40, fontSize: 15, fontWeight: 600, padding: '0 12px', boxSizing: 'border-box', marginBottom: 12 }}
            onFocus={e => (e.target.style.borderColor = C.success)} onBlur={e => (e.target.style.borderColor = C.border)}
          />
          {/* 카테고리 선택 */}
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {(Object.keys(WORLD_CATEGORY_META) as WorldCategory[]).map(cat => {
              const m = WORLD_CATEGORY_META[cat];
              const active = category === cat;
              return (
                <button key={cat} onClick={() => setCategory(cat)} style={{
                  padding: '4px 10px', borderRadius: 5, border: `1px solid ${active ? m.color : C.border}`,
                  background: active ? m.color + '1A' : 'transparent',
                  color: active ? m.color : C.t3, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit',
                  display: 'flex', alignItems: 'center', gap: 4, transition: 'all 0.13s',
                }}>
                  {m.icon}{m.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* 바디 */}
        <div style={{ padding: '20px 28px', display: 'flex', flexDirection: 'column', gap: 16 }}>
          {!generated && (
            <>
              {/* 모드 탭 */}
              <div style={{ display: 'flex', gap: 0, borderBottom: `1px solid ${C.border}` }}>
                {([['manual', '직접 입력'], ['extract', '텍스트로 추출']] as const).map(([m, label]) => (
                  <button key={m} onClick={() => setMode(m)} style={{
                    height: 36, padding: '0 14px', background: 'none', border: 'none',
                    borderBottom: `2px solid ${mode === m ? meta.color : 'transparent'}`,
                    color: mode === m ? meta.color : C.t2,
                    fontSize: 13, fontWeight: mode === m ? 600 : 400,
                    cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.15s', marginBottom: -1,
                  }}>{label}</button>
                ))}
              </div>

              {mode === 'manual' && (
                <div style={{ color: C.t3, fontSize: 13 }}>
                  선택한 카테고리에 맞는 항목 템플릿을 생성합니다. 생성 후 내용을 직접 입력하세요.
                </div>
              )}

              {mode === 'extract' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {/* 업로드 종류 선택 */}
                  <div style={{ display: 'flex', gap: 6 }}>
                    {([
                      ['settings', '설정집'],
                      ['new_ep',   '신규 회차'],
                      ['bulk_ep',  '기존 회차 대용량'],
                    ] as const).map(([val, label]) => (
                      <button key={val} onClick={() => setUploadType(val)} style={{
                        padding: '4px 12px', borderRadius: 5,
                        border: `1px solid ${uploadType === val ? meta.color : C.border}`,
                        background: uploadType === val ? meta.color + '1A' : 'transparent',
                        color: uploadType === val ? meta.color : C.t3,
                        fontSize: 12, cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.13s',
                      }}>{label}</button>
                    ))}
                  </div>
                  {/* 파일 드롭존 */}
                  <div
                    onDragOver={e => { e.preventDefault(); setDragging(true); }}
                    onDragLeave={() => setDragging(false)}
                    onDrop={e => { e.preventDefault(); setDragging(false); setUploadedFile('업로드파일.txt'); }}
                    onClick={() => setUploadedFile('업로드파일.txt')}
                    style={{
                      border: `2px dashed ${dragging ? meta.color : uploadedFile ? C.success : C.border}`,
                      borderRadius: 8, padding: '28px', textAlign: 'center',
                      background: dragging ? meta.color + '08' : uploadedFile ? C.success + '08' : 'transparent',
                      cursor: 'pointer', transition: 'all 0.15s',
                    }}
                  >
                    {uploadedFile ? (
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                        <CircleCheckBig size={18} color={C.success} />
                        <span style={{ color: C.success, fontSize: 14, fontWeight: 600 }}>{uploadedFile} — 업로드 준비 완료</span>
                      </div>
                    ) : (
                      <>
                        <Upload size={22} color={C.t3} style={{ margin: '0 auto 8px' }} />
                        <div style={{ color: C.t2, fontSize: 14, marginBottom: 4 }}>파일을 드래그하거나 클릭하여 업로드</div>
                        <div style={{ color: C.t3, fontSize: 12 }}>txt, docx 지원</div>
                      </>
                    )}
                  </div>
                </div>
              )}

              <button onClick={canGenerate ? generate : undefined} style={{
                height: 42, borderRadius: 7, border: 'none', background: meta.color, color: '#fff',
                fontSize: 14, fontWeight: 600, cursor: canGenerate ? 'pointer' : 'default',
                fontFamily: 'inherit', opacity: canGenerate ? 1 : 0.45,
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, transition: 'opacity 0.15s',
              }}
                onMouseEnter={e => { if (canGenerate) e.currentTarget.style.opacity = '0.85'; }}
                onMouseLeave={e => { e.currentTarget.style.opacity = canGenerate ? '1' : '0.45'; }}>
                {mode === 'extract'
                  ? <><Sparkles size={15} /> AI 항목 추출</>
                  : <><Plus size={15} /> 항목 템플릿 생성</>}
              </button>
            </>
          )}

          {generated && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '130px 1fr 28px 28px', gap: 8, padding: '0 2px', paddingLeft: 8 }}>
                <span style={{ color: C.t3, fontSize: 11 }}>항목</span>
                <span style={{ color: C.t3, fontSize: 11 }}>내용  (→ 키로 예시 수용)</span>
                <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Lock size={10} color={C.t3} />
                </span>
                <span />
              </div>
              {entries.map(e => (
                <EntryRow key={e.id} entry={e} onChange={p => upEntry(e.id, p)} onRemove={() => rmEntry(e.id)} />
              ))}
              <button onClick={addEntry} style={{
                height: 32, borderRadius: 5, border: `1px dashed ${C.border}`, background: 'transparent',
                color: C.t3, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5, transition: 'all 0.13s',
              }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = meta.color; e.currentTarget.style.color = meta.color; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.color = C.t3; }}>
                <Plus size={13} /> 항목 추가
              </button>
            </div>
          )}
        </div>

        {/* 푸터 */}
        <div style={{ padding: '16px 28px', borderTop: `1px solid ${C.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ color: C.t3, fontSize: 12 }}>
            {generated ? `${entries.length}개 항목` : '항목 생성 후 내용을 채워주세요'}
          </span>
          <div style={{ display: 'flex', gap: 8 }}>
            <BtnG label="취소" onClick={onClose} />
            <BtnP label="저장" onClick={title.trim() && generated ? handleSave : undefined} icon={<Check size={14} />} />
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ── CharCardDynamic (CharacterSetting 기반, 클릭 → 상세 / 수정 버튼 → 편집) ──
function CharCardDynamic({ setting, onEdit, onView }: { setting: CharacterSetting; onEdit: () => void; onView: () => void }) {
  const [hovered, setHovered] = useState(false);
  const color = CHAR_COLORS[setting.id] || C.primary;
  const get = (label: string) =>
    setting.entries.find(e => e.label.includes(label))?.content || '—';

  const rows = ['나이', '눈', '직업', '첫등장'].map(k => ({ k, v: get(k) })).filter(r => r.v !== '—');
  const role = get('역할');
  const detail = CHAR_DETAIL[setting.id];
  const hasConflict = detail && detail.conflicts.length > 0;

  return (
    <div
      onClick={onView}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: C.bg, borderRadius: 8,
        border: `1px solid ${hovered ? color + '88' : hasConflict ? C.warning + '55' : C.border}`,
        padding: 16, display: 'flex', flexDirection: 'column', gap: 10,
        cursor: 'pointer', transition: 'border-color 0.15s', position: 'relative',
      }}
    >
      {hasConflict && (
        <div style={{
          position: 'absolute', top: 10, left: 10,
          width: 6, height: 6, borderRadius: '50%', background: C.warning,
        }} />
      )}
      {hovered && (
        <div
          onClick={(e) => { e.stopPropagation(); onEdit(); }}
          style={{
            position: 'absolute', top: 10, right: 10, background: C.surface,
            border: `1px solid ${C.border}`, borderRadius: 4,
            padding: '2px 8px', fontSize: 11, color: C.t3, cursor: 'pointer',
          }}
        >수정</div>
      )}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{
          width: 40, height: 40, borderRadius: '50%', flexShrink: 0,
          background: color + '22', border: `1.5px solid ${color}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color, fontSize: 16, fontWeight: 700,
        }}>{setting.name[0]}</div>
        <div>
          <div style={{ color: C.t1, fontSize: 14, fontWeight: 600 }}>{setting.name}</div>
          <div style={{ color, fontSize: 11, fontWeight: 500 }}>{role}</div>
        </div>
      </div>
      {rows.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
          {rows.map(item => (
            <div key={item.k} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ color: C.t3, fontSize: 12 }}>{item.k}</span>
              <span style={{ color: item.k === '눈' && hasConflict ? C.warning : C.t2, fontSize: 12 }}>{item.v}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── CharDetailModal ──────────────────────────────────
function CharDetailModal({ charId, chars, onClose, onEdit }: {
  charId: string; chars: CharacterSetting[]; onClose: () => void; onEdit: () => void;
}) {
  const setting = chars.find(c => c.id === charId);
  if (!setting) return null;
  const color = CHAR_COLORS[charId] || C.primary;
  const detail = CHAR_DETAIL[charId] || { appearances: [], conflicts: [], relations: [] };

  // 타임라인: 공백 제거 후 이름 대조
  const normalName = setting.name.replace(/\s/g, '');
  const charEvents = TL_EVENTS.filter(e =>
    e.characters.some(c => c.replace(/\s/g, '') === normalName)
  );

  // 미니 관계도 SVG 좌표 계산
  const GW = 400, GH = 208;
  const cx = GW / 2, cy = GH / 2;
  const R = 80;
  const nodeR = 20;
  const relNodes = detail.relations.map((rel, i) => {
    const angle = (i / Math.max(detail.relations.length, 1)) * Math.PI * 2 - Math.PI / 2;
    return { ...rel, x: cx + Math.cos(angle) * R, y: cy + Math.sin(angle) * R };
  });

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', zIndex: 200,
        display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
        overflowY: 'auto', padding: '40px 20px',
      }}
      onClick={onClose}
    >
      <motion.div
        initial={{ y: 32, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
        exit={{ y: 16, opacity: 0 }} transition={{ duration: 0.22, ease: 'easeOut' }}
        onClick={e => e.stopPropagation()}
        style={{
          width: 900, background: C.surface, borderRadius: 12,
          border: `1px solid ${C.border}`, boxShadow: '0 24px 64px rgba(0,0,0,0.6)',
          marginBottom: 40,
        }}
      >
        {/* 헤더 */}
        <div style={{ padding: '22px 28px 18px', borderBottom: `1px solid ${C.border}` }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{
              width: 48, height: 48, borderRadius: '50%', flexShrink: 0,
              background: color + '22', border: `2px solid ${color}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color, fontSize: 20, fontWeight: 700,
            }}>{setting.name[0]}</div>
            <div style={{ flex: 1 }}>
              <div style={{ color: C.t1, fontSize: 17, fontWeight: 700, letterSpacing: '-0.3px' }}>{setting.name}</div>
              <div style={{ color, fontSize: 12, fontWeight: 500, marginTop: 1 }}>
                {setting.entries.find(e => e.label.includes('역할'))?.content || ''}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={onEdit} style={{
                padding: '6px 14px', borderRadius: 5, border: `1px solid ${C.border}`,
                background: 'transparent', color: C.t2, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit',
              }}>수정</button>
              <button onClick={onClose} style={{
                background: 'none', border: 'none', color: C.t3, cursor: 'pointer', padding: 4,
              }}><X size={18} /></button>
            </div>
          </div>
        </div>

        {/* 바디 */}
        <div style={{ padding: '22px 28px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* 상단 2단: 기본 설정 + 관계도 */}
          <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start' }}>
            {/* 좌: 기본 설정 + 충돌 + 등장 이력 */}
            <div style={{ flex: '0 0 200px', display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <div style={{ color: C.t3, fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>기본 설정</div>
                <div style={{ background: C.bg, borderRadius: 8, border: `1px solid ${C.border}`, overflow: 'hidden' }}>
                  {setting.entries.map((entry, i) => {
                    const isConflict = entry.label.includes('눈') && detail.conflicts.some(c => c.title.includes('눈'));
                    return (
                      <div key={entry.id} style={{
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                        padding: '9px 14px',
                        borderBottom: i < setting.entries.length - 1 ? `1px solid ${C.border}` : 'none',
                      }}>
                        <span style={{ color: C.t3, fontSize: 12, flexShrink: 0 }}>{entry.label}</span>
                        {entry.isSpoiler ? (
                          <span style={{ color: C.t3, fontSize: 11, fontStyle: 'italic' }}>스포일러</span>
                        ) : (
                          <span style={{
                            color: isConflict ? C.warning : C.t2, fontSize: 12,
                            fontWeight: isConflict ? 600 : 400,
                            maxWidth: 110, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                          }}>
                            {entry.content || '—'}{isConflict ? ' ⚠' : ''}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

            </div>

            {/* 중: 관계도 */}
            <div style={{ flex: 1 }}>
              <div style={{ color: C.t3, fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>관계도</div>
              <div style={{ background: C.bg, borderRadius: 8, border: `1px solid ${C.border}`, padding: '12px 16px' }}>
                {detail.relations.length === 0 ? (
                  <div style={{ color: C.t3, fontSize: 12, padding: '30px 0', textAlign: 'center' }}>등록된 관계 없음</div>
                ) : (
                  <svg viewBox={`0 0 ${GW} ${GH}`} width="100%" style={{ display: 'block' }}>
                    {/* 점 격자 배경 */}
                    {Array.from({ length: 6 }, (_, r) =>
                      Array.from({ length: 12 }, (_, c) => (
                        <circle key={`${r}-${c}`} cx={18 + c * 35} cy={18 + r * 38} r={1.1} fill={C.border} opacity={0.4} />
                      ))
                    )}
                    {/* 엣지 */}
                    {relNodes.map((node, i) => {
                      const dx = node.x - cx, dy = node.y - cy;
                      const len = Math.sqrt(dx * dx + dy * dy) || 1;
                      const x1 = cx + (dx / len) * (nodeR + 1);
                      const y1 = cy + (dy / len) * (nodeR + 1);
                      const x2 = node.x - (dx / len) * (nodeR + 1);
                      const y2 = node.y - (dy / len) * (nodeR + 1);
                      const lx = (cx + node.x) / 2;
                      const ly = (cy + node.y) / 2;
                      return (
                        <g key={`e-${i}`}>
                          <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={node.color} strokeWidth={1.5} strokeOpacity={0.5} />
                          <rect x={lx - 18} y={ly - 6} width={36} height={12} rx={2}
                            fill={C.surface} stroke={node.color} strokeWidth={0.6} strokeOpacity={0.65} />
                          <text x={lx} y={ly + 3.5} fill={node.color} fontSize={9.5} textAnchor="middle"
                            style={{ fontFamily: 'inherit', fontWeight: '600' }}>{node.type}</text>
                        </g>
                      );
                    })}
                    {/* 링 노드 */}
                    {relNodes.map((node, i) => (
                      <g key={`n-${i}`}>
                        <circle cx={node.x} cy={node.y} r={nodeR + 5} fill={node.color + '08'} />
                        <circle cx={node.x} cy={node.y} r={nodeR} fill={node.color + '1C'} stroke={node.color} strokeWidth={1.5} />
                        <text x={node.x} y={node.y + 4} fill={node.color} fontSize={11} fontWeight="700"
                          textAnchor="middle" style={{ fontFamily: 'inherit' }}>{node.name}</text>
                      </g>
                    ))}
                    {/* 중심 노드 */}
                    <circle cx={cx} cy={cy} r={nodeR + 7} fill={color + '0C'} />
                    <circle cx={cx} cy={cy} r={nodeR} fill={color + '28'} stroke={color} strokeWidth={2} />
                    <text x={cx} y={cy + 4} fill={color} fontSize={12} fontWeight="700"
                      textAnchor="middle" style={{ fontFamily: 'inherit' }}>{setting.name}</text>
                  </svg>
                )}
              </div>
            </div>

            {/* 우: 등장이력 */}
            {(() => {
              const apps = detail.appearances.filter(a => a.desc !== '설정 충돌 감지');
              return (
                <div style={{ flex: '0 0 200px' }}>
                  <div style={{ color: C.t3, fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>
                    등장 이력 ({apps.length}회)
                  </div>
                  <div style={{ background: C.bg, borderRadius: 8, border: `1px solid ${C.border}`, overflow: 'hidden' }}>
                    {apps.map((a, i) => (
                      <div key={a.ep} style={{
                        display: 'flex', alignItems: 'flex-start', gap: 8, padding: '6px 10px',
                        borderBottom: i < apps.length - 1 ? `1px solid ${C.border}` : 'none',
                      }}>
                        <span style={{
                          padding: '1px 6px', borderRadius: 4, fontSize: 10, fontWeight: 600, flexShrink: 0, marginTop: 1,
                          background: a.conflict ? C.warning + '1A' : C.surface,
                          border: `1px solid ${a.conflict ? C.warning + '55' : C.border}`,
                          color: a.conflict ? C.warning : C.t3,
                        }}>{a.ep}화</span>
                        <span style={{ color: a.conflict ? C.warning : C.t2, fontSize: 11, lineHeight: 1.4 }}>{a.desc}</span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })()}
          </div>

          {/* 하단: 타임라인 (가로) */}
          <div>
            <div style={{ color: C.t3, fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>
              타임라인 ({charEvents.length}건)
            </div>
            {charEvents.length === 0 ? (
              <div style={{ color: C.t3, fontSize: 12, padding: '12px 0' }}>이 캐릭터 관련 이벤트 없음</div>
            ) : (
              <div style={{ background: C.bg, borderRadius: 8, border: `1px solid ${C.border}`, padding: '16px', overflowX: 'auto' }}>
                <div style={{ position: 'relative', minWidth: Math.max(480, charEvents.length * 100) }}>
                  {/* 가로선: 첫 dot 중심 ~ 마지막 dot 중심 */}
                  <div style={{
                    position: 'absolute',
                    top: 5,
                    left: `${50 / charEvents.length}%`,
                    right: `${50 / charEvents.length}%`,
                    height: 2,
                    background: C.border,
                    borderRadius: 1,
                  }} />
                  {/* dot + 카드 */}
                  <div style={{ display: 'flex' }}>
                    {charEvents.map((ev, i) => {
                      const color = TL_COLORS[ev.type] ?? C.t3;
                      return (
                        <div key={i} style={{
                          flex: 1, padding: '0 4px',
                          display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center',
                        }}>
                          <div style={{
                            width: 10, height: 10, borderRadius: '50%',
                            background: color,
                            border: `2px solid ${C.bg}`,
                            boxShadow: `0 0 0 1.5px ${color}`,
                            flexShrink: 0,
                            position: 'relative', zIndex: 1,
                            marginBottom: 8,
                          }} />
                          <div style={{ padding: '2px 6px', borderRadius: 3, background: color + '18', border: `1px solid ${color}33`, color, fontSize: 10, fontWeight: 600, marginBottom: 5 }}>
                            {ev.ch}
                          </div>
                          <div style={{ color: C.t1, fontSize: 11, fontWeight: 600, lineHeight: 1.3, marginBottom: 2 }}>
                            {ev.title}
                          </div>
                          <div style={{ color: C.t3, fontSize: 10, lineHeight: 1.4 }}>
                            {ev.desc}
                          </div>
                          {ev.errors && ev.errors.length > 0 && (
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3, marginTop: 4, justifyContent: 'center' }}>
                              {ev.errors.map((err, ei) => (
                                <span key={ei} style={{
                                  fontSize: 9, padding: '1px 4px', borderRadius: 3,
                                  color: TL_ERROR_CFG[err.type].color,
                                  background: TL_ERROR_CFG[err.type].color + '18',
                                }}>
                                  {TL_ERROR_CFG[err.type].label}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
            <div style={{ display: 'flex', gap: 12, marginTop: 12, flexWrap: 'wrap' }}>
              {([
                { color: C.primary,  label: '설정 등록' },
                { color: C.success,  label: '관계 해소' },
                { color: C.danger,   label: '갈등 발생' },
                { color: C.warning,  label: '충돌 감지' },
                { color: C.t3,       label: '일반 이벤트' },
              ] as { color: string; label: string }[]).map(({ color, label }) => (
                <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <div style={{ width: 7, height: 7, borderRadius: '50%', background: color, flexShrink: 0 }} />
                  <span style={{ fontSize: 10, color: C.t3 }}>{label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ── WorldCardDynamic ───────────────────────────────
function WorldCardDynamic({ ws, onEdit }: { ws: WorldSetting; onEdit: () => void }) {
  const [hovered, setHovered] = useState(false);
  const meta = WORLD_CATEGORY_META[ws.category];
  const preview = ws.entries.slice(0, 3);

  return (
    <div
      onClick={onEdit}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: C.bg, borderRadius: 8,
        border: `1px solid ${hovered ? meta.color + '88' : C.border}`,
        padding: 16, display: 'flex', flexDirection: 'column', gap: 10,
        cursor: 'pointer', transition: 'border-color 0.15s', position: 'relative',
      }}
    >
      {hovered && (
        <div style={{
          position: 'absolute', top: 10, right: 10, background: C.surface,
          border: `1px solid ${C.border}`, borderRadius: 4,
          padding: '2px 8px', fontSize: 11, color: C.t3,
        }}>수정</div>
      )}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{
          padding: '3px 8px', borderRadius: 4, fontSize: 11, fontWeight: 500,
          background: meta.color + '1A', color: meta.color, border: `1px solid ${meta.color}33`,
          display: 'flex', alignItems: 'center', gap: 4,
        }}>
          {meta.icon}{meta.label}
        </div>
      </div>
      <div style={{ color: C.t1, fontSize: 14, fontWeight: 600 }}>{ws.title}</div>
      {preview.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
          {preview.map(entry => (
            <div key={entry.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ color: C.t3, fontSize: 12 }}>{entry.label}</span>
              <span style={{
                color: entry.content ? C.t2 : C.t3 + '66', fontSize: 12,
                maxWidth: 130, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>
                {entry.content || '미입력'}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function CharCard({ name, role, age, eyes, job, chapter, eyeConflict, colorKey }: {
  name: string; role: string; age: number; eyes: string; job: string;
  chapter: number; eyeConflict?: boolean; colorKey: string;
}) {
  const color = charColors[colorKey] || C.primary;
  return (
    <div style={{
      background: C.bg, borderRadius: 8, border: `1px solid ${C.border}`,
      padding: 16, display: 'flex', flexDirection: 'column', gap: 10,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{
          width: 40, height: 40, borderRadius: '50%', flexShrink: 0,
          background: color + '22', border: `1.5px solid ${color}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color, fontSize: 16, fontWeight: 700,
        }}>{name[0]}</div>
        <div>
          <div style={{ color: C.t1, fontSize: 14, fontWeight: 600 }}>{name}</div>
          <div style={{ color: color, fontSize: 11, fontWeight: 500 }}>{role}</div>
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
        {[
          { k: '나이', v: `${age}세`, warn: false },
          { k: '눈', v: eyes, warn: eyeConflict },
          { k: '직업', v: job, warn: false },
          { k: '첫등장', v: `${chapter}화`, warn: false },
        ].map((item) => (
          <div key={item.k} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ color: C.t3, fontSize: 12 }}>{item.k}</span>
            <span style={{ color: item.warn ? C.warning : C.t2, fontSize: 12, fontWeight: item.warn ? 600 : 400, display: 'flex', alignItems: 'center', gap: 4 }}>
              {item.warn && <AlertTriangle size={10} color={C.warning} />}{item.v}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

type RelGraphId = 'triangle' | 'prosecution' | 'court';
interface RelGraphNode { id: string; label: string; role: string; x: number; y: number; }
interface RelGraphEdge { from: string; to: string; label: string; color: string; t: number; ox: number; oy: number; dashed?: boolean; }
interface RelGraph { id: RelGraphId; label: string; subtitle: string; nodes: RelGraphNode[]; edges: RelGraphEdge[]; }

const RELATION_GRAPHS: RelGraph[] = [
  {
    id: 'triangle', label: '주인공 삼각관계', subtitle: '핵심 3인 감정선 + 주변 인물',
    nodes: [
      { id: 'sua',   label: '수아',   role: '주인공',    x: 250, y: 128 },
      { id: 'min',   label: '강민준', role: '남자주인공', x: 418, y: 62  },
      { id: 'lena',  label: '이레나', role: '라이벌',    x: 418, y: 194 },
      { id: 'hayun', label: '하윤',   role: '절친',      x: 82,  y: 62  },
      { id: 'choi',  label: '최검사', role: '상사',      x: 82,  y: 194 },
    ],
    edges: [
      { from: 'hayun', to: 'sua',  label: '절친',     color: C.success,  t: 0.44, ox:  0,  oy: -13 },
      { from: 'sua',   to: 'min',  label: '갈등/끌림', color: '#E25C5C', t: 0.50, ox:  6,  oy: -13, dashed: true },
      { from: 'sua',   to: 'lena', label: '화해',     color: C.success,  t: 0.50, ox: 12,  oy:  12 },
      { from: 'min',   to: 'lena', label: '법적 대립', color: C.warning,  t: 0.50, ox: -48, oy:   0 },
      { from: 'choi',  to: 'min',  label: '상사-부하', color: C.t3,       t: 0.22, ox:  0,  oy:  13 },
    ],
  },
  {
    id: 'prosecution', label: '검찰 조직도', subtitle: '수사팀 계층 구조 및 지휘 체계',
    nodes: [
      { id: 'choi', label: '최검사', role: '검사장',    x: 250, y: 38  },
      { id: 'min',  label: '강민준', role: '수석검사',  x: 140, y: 128 },
      { id: 'pak',  label: '박형사', role: '형사',      x: 360, y: 128 },
      { id: 'jung', label: '정형사', role: '수사관',    x: 70,  y: 215 },
      { id: 'shin', label: '신비서', role: '비서',      x: 230, y: 215 },
    ],
    edges: [
      { from: 'choi', to: 'min',  label: '상사-부하', color: C.t3,       t: 0.50, ox:  0, oy: -13 },
      { from: 'choi', to: 'pak',  label: '직속관리',  color: '#F4A261',  t: 0.50, ox:  0, oy: -13 },
      { from: 'min',  to: 'jung', label: '수사지시',  color: C.t3,       t: 0.50, ox:  0, oy: -13 },
      { from: 'min',  to: 'shin', label: '연락',      color: '#64748B',  t: 0.50, ox:  0, oy: -13 },
    ],
  },
  {
    id: 'court', label: '법정 대립구도', subtitle: '기소측 vs 변호측, 판사 중재',
    nodes: [
      { id: 'sua',  label: '수아',    role: '수습검사',  x: 72,  y: 88  },
      { id: 'min',  label: '강민준',  role: '수석검사',  x: 72,  y: 178 },
      { id: 'kim',  label: '김판사',  role: '재판장',    x: 250, y: 128 },
      { id: 'lena', label: '이레나',  role: '변호사',    x: 428, y: 88  },
      { id: 'oh',   label: '오변호사', role: '변호인',   x: 428, y: 178 },
    ],
    edges: [
      { from: 'min',  to: 'kim',  label: '기소',  color: '#E25C5C', t: 0.50, ox:  0, oy: -13 },
      { from: 'sua',  to: 'kim',  label: '보조',  color: C.primary, t: 0.50, ox:  0, oy: -13 },
      { from: 'lena', to: 'kim',  label: '변호',  color: C.success, t: 0.50, ox:  0, oy: -13, dashed: true },
      { from: 'oh',   to: 'kim',  label: '진행',  color: '#00C896', t: 0.50, ox:  0, oy: -13 },
      { from: 'min',  to: 'oh',   label: '대립',  color: C.warning, t: 0.50, ox:  0, oy:  13, dashed: true },
    ],
  },
];

function RelationGraph({ graph }: { graph: RelGraph }) {
  const nodeMap = Object.fromEntries(graph.nodes.map((n) => [n.id, n]));
  const R = 26;
  const LW = 68;

  return (
    <div style={{ background: C.bg, borderRadius: 8, border: `1px solid ${C.border}`, padding: '14px 16px 12px' }}>
      <svg viewBox="0 0 500 250" width="100%" style={{ display: 'block' }}>
        {Array.from({ length: 7 }, (_, r) =>
          Array.from({ length: 14 }, (_, c) => (
            <circle key={`${r}-${c}`} cx={18 + c * 35} cy={18 + r * 33} r={1.1} fill={C.border} opacity={0.45} />
          ))
        )}

        {graph.edges.map((edge, ei) => {
          const f = nodeMap[edge.from];
          const to = nodeMap[edge.to];
          if (!f || !to) return null;
          const dx = to.x - f.x;
          const dy = to.y - f.y;
          const len = Math.sqrt(dx * dx + dy * dy);
          const x1 = f.x + (dx / len) * R;
          const y1 = f.y + (dy / len) * R;
          const x2 = to.x - (dx / len) * R;
          const y2 = to.y - (dy / len) * R;
          const lx = f.x + dx * edge.t + edge.ox;
          const ly = f.y + dy * edge.t + edge.oy;
          return (
            <g key={ei}>
              <line x1={x1} y1={y1} x2={x2} y2={y2}
                stroke={edge.color} strokeWidth={1.5} strokeOpacity={0.48}
                strokeDasharray={edge.dashed ? '6 3' : undefined} />
              <rect x={lx - LW / 2} y={ly - 9} width={LW} height={16} rx={3}
                fill={C.bg} stroke={edge.color} strokeWidth={0.5} strokeOpacity={0.5} />
              <text x={lx} y={ly + 3.5} fill={edge.color} fontSize={9.5} textAnchor="middle"
                style={{ fontFamily: 'inherit', fontWeight: '500' }}>
                {edge.label}
              </text>
            </g>
          );
        })}

        {graph.nodes.map((node) => {
          const color = charColors[node.id] || C.primary;
          return (
            <g key={node.id}>
              <circle cx={node.x} cy={node.y} r={R + 5} fill={color + '08'} />
              <circle cx={node.x} cy={node.y} r={R} fill={color + '1C'} stroke={color} strokeWidth={1.5} />
              <text x={node.x} y={node.y + 4} fill={color} fontSize={12} fontWeight="700" textAnchor="middle"
                style={{ fontFamily: 'inherit' }}>
                {node.label}
              </text>
            </g>
          );
        })}
      </svg>

      <div style={{
        display: 'flex', flexWrap: 'wrap', gap: '4px 14px',
        marginTop: 10, paddingTop: 10, borderTop: `1px solid ${C.border}`,
        justifyContent: 'center',
      }}>
        {graph.nodes.map((node) => {
          const color = charColors[node.id] || C.primary;
          return (
            <div key={node.id} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <div style={{ width: 7, height: 7, borderRadius: '50%', background: color, flexShrink: 0 }} />
              <span style={{ color: C.t3, fontSize: 11 }}>
                {node.label}
                <span style={{ opacity: 0.55 }}> · {node.role}</span>
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

interface TLError {
  type: 'time' | 'inventory' | 'calculation';
  desc: string;
}
interface TLEvent {
  ch: string; title: string; desc: string; type: string;
  characters: string[]; eventTags: string[]; items: string[];
  errors?: TLError[];
}

const TL_ERROR_CFG = {
  time:        { label: '시간 흐름', color: '#E25C5C', icon: '⏳' },
  inventory:   { label: '소지품',   color: '#F4A261', icon: '🎒' },
  calculation: { label: '수치 계산', color: '#A78BFA', icon: '🔢' },
} as const;
const TL_EVENTS: TLEvent[] = [
  { ch: '1화',   title: '수아 등장',       desc: '검사 지망생 수아 첫 서술',             type: 'normal',   characters: ['수아'],                      eventTags: ['등장'],          items: ['검사 배지'] },
  { ch: '2화',   title: '하윤 등장',       desc: '수아의 절친 하윤 첫 등장',             type: 'normal',   characters: ['하윤', '수아'],               eventTags: ['등장', '만남'],   items: [] },
  { ch: '3화',   title: '강민준 등장',     desc: '수석검사 강민준 첫 서술',              type: 'normal',   characters: ['강민준'],                     eventTags: ['등장'],          items: [] },
  { ch: '12화',  title: '수사 시작',       desc: '강민준 수사팀 출동, 박형사 합류',      type: 'normal',   characters: ['강민준', '박형사'],            eventTags: ['수사'],          items: ['수사 수첩'] },
  { ch: '23화',  title: '갈색 눈 설정',   desc: '수아 핵심 외모 설정 확정',             type: 'setting',  characters: ['수아'],                       eventTags: ['설정 등록'],     items: [] },
  { ch: '35화',  title: '이레나 등장',     desc: '라이벌 이레나 첫 법정 출현',           type: 'normal',   characters: ['이레나'],                     eventTags: ['등장'],          items: [] },
  { ch: '47화',  title: '법정 첫 만남',   desc: '수아·강민준 공식 대면, 증거 제출',     type: 'normal',   characters: ['수아', '강민준'],             eventTags: ['재판', '만남'],  items: ['증거 봉투', '검사 배지'] },
  { ch: '55화',  title: '내부고발 정황',   desc: '최검사, 증거 조작 단서 포착',          type: 'conflict', characters: ['최검사', '강민준'],           eventTags: ['갈등', '수사'],  items: ['증거 USB'] },
  { ch: '67화',  title: '공판 개시',       desc: '오변호사 기각 신청, 강민준 기소 강행', type: 'conflict', characters: ['강민준', '오변호사'],          eventTags: ['재판'],          items: ['법정 판결문'] },
  { ch: '89화',  title: '이레나 갈등 심화', desc: '수아·이레나 대립 극한에 달함',        type: 'conflict', characters: ['수아', '이레나'],             eventTags: ['갈등'],          items: ['법원 영장'],
    errors: [{ type: 'time', desc: '법정 입문 1년 후로 서술됐으나 1화 대비 실제 9개월 경과' }] },
  { ch: '107화', title: '증거 조작 발각',  desc: '핵심 USB 증거 조작 정황 확인',        type: 'conflict', characters: ['신비서', '강민준'],           eventTags: ['수사', '충돌'],  items: ['증거 USB', '수사 수첩'],
    errors: [{ type: 'inventory', desc: '증거 USB를 최검사에게 제출한 것으로 기록됨 (이후 충돌 기준점)' }] },
  { ch: '118화', title: '2차 공판',        desc: '이레나 항소, 오변호사 반격 시작',      type: 'normal',   characters: ['이레나', '오변호사', '김판사'], eventTags: ['재판'],        items: ['법정 판결문'] },
  { ch: '123화', title: '핵심 설정 확정',  desc: '수아 임용 전 권한 제한 규칙 명시',    type: 'setting',  characters: ['수아'],                       eventTags: ['설정 등록'],     items: [] },
  { ch: '142화', title: '이레나 화해',     desc: '수아–이레나 화해 완료, 관계 해소',    type: 'resolved', characters: ['수아', '이레나'],             eventTags: ['화해'],          items: [] },
  { ch: '145화', title: '반전 복선',       desc: '강민준 과거 트라우마 암시',             type: 'normal',   characters: ['강민준', '최검사'],           eventTags: ['반전'],          items: ['수사 수첩'] },
  { ch: '150화', title: '수아 체포 위기',  desc: '수아, 증거 조작 혐의로 구금 위기',    type: 'conflict', characters: ['수아', '박형사'],             eventTags: ['체포', '갈등'],  items: ['법원 영장', '증거 USB'],
    errors: [{ type: 'inventory', desc: '107화에서 제출된 USB를 수아가 다시 소지한 것으로 서술 ⚠' }] },
  { ch: '155화', title: '로맨스 전환점',   desc: '수아·강민준 감정선 결정적 분기',       type: 'normal',   characters: ['수아', '강민준'],             eventTags: ['만남'],          items: ['빨간 볼펜'],
    errors: [{ type: 'calculation', desc: '23화(23세) 기준 \'3년 후\' → 26세여야 하나 25세로 서술' }] },
  { ch: '158화', title: 'DB 최신화',       desc: '분석 완료, 설정 최신 반영 상태',       type: 'current',  characters: [],                             eventTags: [],                items: [] },
  { ch: '159화', title: '설정 충돌 감지',  desc: '강민준 눈 색 충돌 ⚠, USB 재등장',    type: 'writing',  characters: ['수아', '강민준', '이레나'],   eventTags: ['충돌'],          items: ['증거 USB', '검사 배지'],
    errors: [
      { type: 'time', desc: '\"그로부터 2년이 흘렀다\" 서술이 실제 흐름과 1년 차이' },
      { type: 'inventory', desc: '107화에서 이미 제출된 USB가 이 화에서 재등장 ⚠' },
    ] },
  { ch: '160화', title: '재판 결말부',     desc: '김판사 판결, 사건 결정적 분기점',      type: 'conflict', characters: ['강민준', '수아', '김판사'],   eventTags: ['재판', '반전'],  items: ['법정 판결문'] },
];
const TL_COLORS: Record<string, string> = {
  normal: C.t3, setting: C.primary, conflict: C.danger, resolved: C.success,
  current: C.primary, writing: C.warning,
};
const TL_FILTER_OPTIONS = {
  character: ['수아', '강민준', '이레나', '하윤', '최검사', '박형사', '오변호사', '김판사', '신비서'],
  event:     ['등장', '갈등', '수사', '재판', '화해', '충돌', '체포', '반전', '만남', '설정 등록'],
  item:      ['검사 배지', '수사 수첩', '증거 USB', '법정 판결문', '증거 봉투', '법원 영장', '빨간 볼펜'],
  error:     ['시간 흐름', '소지품', '수치 계산'],
};

function TimelineView() {
  const [tlFilter, setTlFilter] = useState<'all' | 'character' | 'event' | 'item' | 'error'>('all');
  const [tlSelected, setTlSelected] = useState<string | null>(null);

  const filteredEvents = TL_EVENTS.filter(e => {
    if (tlFilter === 'all') return true;
    if (!tlSelected) {
      if (tlFilter === 'error') return (e.errors?.length ?? 0) > 0;
      return true;
    }
    if (tlFilter === 'character') return e.characters.includes(tlSelected);
    if (tlFilter === 'event')     return e.eventTags.includes(tlSelected);
    if (tlFilter === 'item')      return e.items.includes(tlSelected);
    if (tlFilter === 'error')     return e.errors?.some(err => TL_ERROR_CFG[err.type].label === tlSelected) ?? false;
    return true;
  });

  const filterLabels: Record<string, string> = { all: '전체', character: '인물별', event: '사건별', item: '아이템별', error: '오류별' };
  const filterColors: Record<string, string> = { character: '#7C5CFC', event: '#E25C5C', item: '#F4A261', error: '#E25C5C' };

  return (
    <div>
      {/* 1차 필터 */}
      <div style={{ display: 'flex', gap: 7, marginBottom: 10, flexWrap: 'wrap' }}>
        {(['all', 'character', 'event', 'item', 'error'] as const).map(f => {
          const active = tlFilter === f;
          const fc = filterColors[f] || C.primary;
          return (
            <button key={f} onClick={() => { setTlFilter(f); setTlSelected(null); }} style={{
              padding: '5px 14px', borderRadius: 20, cursor: 'pointer', fontFamily: 'inherit', fontSize: 12,
              background: active ? (f === 'all' ? C.primary : fc) + '1A' : 'transparent',
              border: `1px solid ${active ? (f === 'all' ? C.primary : fc) : C.border}`,
              color: active ? (f === 'all' ? C.primary : fc) : C.t3,
              fontWeight: f === 'error' ? 600 : 400,
              transition: 'all 0.13s',
            }}>
              {f === 'error' ? '⚠ 오류별' : filterLabels[f]}
            </button>
          );
        })}
      </div>

      {/* 2차 선택 chip */}
      {tlFilter !== 'all' && (
        <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginBottom: 14, paddingBottom: 12, borderBottom: `1px solid ${C.border}` }}>
          {(tlFilter === 'error'
            ? TL_FILTER_OPTIONS.error.map(opt => {
                const errType = (Object.keys(TL_ERROR_CFG) as Array<keyof typeof TL_ERROR_CFG>).find(k => TL_ERROR_CFG[k].label === opt);
                const errColor = errType ? TL_ERROR_CFG[errType].color : '#E25C5C';
                const errIcon  = errType ? TL_ERROR_CFG[errType].icon  : '';
                const sel = tlSelected === opt;
                return (
                  <button key={opt} onClick={() => setTlSelected(prev => prev === opt ? null : opt)} style={{
                    padding: '3px 10px', borderRadius: 4, cursor: 'pointer', fontFamily: 'inherit', fontSize: 11,
                    background: sel ? errColor + '20' : 'transparent',
                    border: `1px solid ${sel ? errColor : C.border}`,
                    color: sel ? errColor : C.t3,
                    transition: 'all 0.12s',
                  }}>
                    {errIcon} {opt}
                  </button>
                );
              })
            : TL_FILTER_OPTIONS[tlFilter as 'character' | 'event' | 'item'].map(opt => {
                const sel = tlSelected === opt;
                const fc = filterColors[tlFilter] || C.primary;
                return (
                  <button key={opt} onClick={() => setTlSelected(prev => prev === opt ? null : opt)} style={{
                    padding: '3px 10px', borderRadius: 4, cursor: 'pointer', fontFamily: 'inherit', fontSize: 11,
                    background: sel ? fc + '20' : 'transparent',
                    border: `1px solid ${sel ? fc : C.border}`,
                    color: sel ? fc : C.t3,
                    transition: 'all 0.12s',
                  }}>
                    {opt}
                  </button>
                );
              })
          )}
        </div>
      )}

      {/* 오류 상세 패널 */}
      {tlFilter === 'error' && filteredEvents.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 14 }}>
          {filteredEvents.flatMap(ev =>
            (ev.errors ?? [])
              .filter(err => !tlSelected || TL_ERROR_CFG[err.type].label === tlSelected)
              .map((err, i) => (
                <div key={`${ev.ch}-${i}`} style={{
                  background: TL_ERROR_CFG[err.type].color + '0A',
                  border: `1px solid ${TL_ERROR_CFG[err.type].color}33`,
                  borderLeft: `3px solid ${TL_ERROR_CFG[err.type].color}`,
                  borderRadius: 6, padding: '10px 14px',
                  display: 'flex', flexDirection: 'column', gap: 4,
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 12 }}>{TL_ERROR_CFG[err.type].icon}</span>
                    <span style={{ color: TL_ERROR_CFG[err.type].color, fontSize: 11, fontWeight: 700 }}>
                      {TL_ERROR_CFG[err.type].label}
                    </span>
                    <span style={{ color: C.t2, fontSize: 12, fontWeight: 600 }}>{ev.ch} · {ev.title}</span>
                  </div>
                  <div style={{ color: C.t3, fontSize: 11, lineHeight: 1.5 }}>{err.desc}</div>
                </div>
              ))
          )}
        </div>
      )}

      {/* 타임라인 본체 */}
      <div style={{ background: C.bg, borderRadius: 8, border: `1px solid ${C.border}`, padding: '24px 20px', overflowX: 'auto' }}>
        {filteredEvents.length === 0 ? (
          <div style={{ color: C.t3, textAlign: 'center', padding: '28px 0', fontSize: 13 }}>
            해당 조건의 이벤트가 없습니다
          </div>
        ) : (
          <div style={{ minWidth: Math.max(520, filteredEvents.length * 90) }}>
            <div style={{ position: 'relative', height: 2, background: C.border, margin: '30px 24px 0', borderRadius: 1 }}>
              {filteredEvents.map((ev, i) => {
                const hasErr = (ev.errors?.length ?? 0) > 0;
                return (
                  <div key={i} style={{
                    position: 'absolute',
                    left: filteredEvents.length === 1 ? '50%' : `${i / (filteredEvents.length - 1) * 100}%`,
                    transform: 'translateX(-50%) translateY(-50%)',
                    width: 12, height: 12, borderRadius: '50%',
                    background: hasErr ? '#E25C5C' : TL_COLORS[ev.type],
                    border: `2px solid ${C.bg}`,
                    boxShadow: `0 0 0 1.5px ${hasErr ? '#E25C5C' : TL_COLORS[ev.type]}`,
                  }} />
                );
              })}
            </div>
            <div style={{ display: 'flex', marginTop: 16 }}>
              {filteredEvents.map((ev, i) => {
                const color = TL_COLORS[ev.type];
                return (
                  <div key={i} style={{
                    flex: 1, padding: '0 4px',
                    display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center',
                  }}>
                    <div style={{ padding: '2px 6px', borderRadius: 3, background: color + '18', border: `1px solid ${color}33`, color, fontSize: 10, fontWeight: 600, marginBottom: 5 }}>{ev.ch}</div>
                    <div style={{ color: C.t1, fontSize: 12, fontWeight: 600, lineHeight: 1.3, marginBottom: 3 }}>{ev.title}</div>
                    <div style={{ color: C.t3, fontSize: 10, lineHeight: 1.4 }}>{ev.desc}</div>
                    {/* 인물·아이템 태그 */}
                    {(ev.characters.length > 0 || ev.items.length > 0) && (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3, marginTop: 5, justifyContent: 'center' }}>
                        {ev.characters.slice(0, 2).map(c => (
                          <span key={c} style={{ fontSize: 9, color: '#7C5CFC', background: '#7C5CFC14', border: '1px solid #7C5CFC33', borderRadius: 3, padding: '1px 4px' }}>{c}</span>
                        ))}
                        {ev.items.slice(0, 1).map(it => (
                          <span key={it} style={{ fontSize: 9, color: '#F4A261', background: '#F4A26114', border: '1px solid #F4A26133', borderRadius: 3, padding: '1px 4px' }}>{it}</span>
                        ))}
                      </div>
                    )}
                    {/* 오류 배지 (항상 표시) */}
                    {ev.errors && ev.errors.length > 0 && (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3, marginTop: 4, justifyContent: 'center' }}>
                        {ev.errors.map((err, ei) => (
                          <span key={ei} style={{
                            fontSize: 9, padding: '1px 4px', borderRadius: 3,
                            color: TL_ERROR_CFG[err.type].color,
                            background: TL_ERROR_CFG[err.type].color + '18',
                            border: `1px solid ${TL_ERROR_CFG[err.type].color}44`,
                          }}>
                            {TL_ERROR_CFG[err.type].icon} {TL_ERROR_CFG[err.type].label}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

const SEARCH_DATA = [
  // 캐릭터
  { cat: '캐릭터', title: '수아',        sub: '눈 색깔 · 갈색',                          src: '1화',   catColor: '#7C5CFC' },
  { cat: '캐릭터', title: '강민준',      sub: '직업 · 수석검사',                         src: '3화',   catColor: '#7C5CFC' },
  { cat: '캐릭터', title: '이레나',      sub: '역할 · 라이벌/화해',                      src: '12화',  catColor: '#7C5CFC' },
  { cat: '캐릭터', title: '하윤',        sub: '역할 · 절친',                             src: '2화',   catColor: '#7C5CFC' },
  { cat: '캐릭터', title: '최 검사',     sub: '직위 · 검사장',                           src: '5화',   catColor: '#7C5CFC' },
  { cat: '캐릭터', title: '수아 아버지', sub: '역할 · 핵심 범인 [스포일러]',             src: '—',     catColor: '#7C5CFC' },
  { cat: '캐릭터', title: '이진혁 변호사', sub: '역할 · 이레나 측 변호인',               src: '67화',  catColor: '#7C5CFC' },
  { cat: '캐릭터', title: '박 수사관',   sub: '역할 · 수사팀 베테랑 형사',               src: '20화',  catColor: '#7C5CFC' },
  { cat: '캐릭터', title: '강민준',      sub: '약점 · 10년 전 사건 트라우마 [스포일러]', src: '—',     catColor: '#7C5CFC' },
  { cat: '캐릭터', title: '수아',        sub: '자기기만 · "나는 감정에 흔들리지 않는다"',src: '—',     catColor: '#7C5CFC' },
  // 아이템
  { cat: '아이템', title: '증거 봉투',         sub: '소유 · 강민준',                       src: '47화',  catColor: '#F4A261' },
  { cat: '아이템', title: '법원 영장',          sub: '종류 · 서류',                         src: '89화',  catColor: '#F4A261' },
  { cat: '아이템', title: '검사 배지',          sub: '소유 · 수아',                         src: '1화',   catColor: '#F4A261' },
  { cat: '아이템', title: '수사 노트',          sub: '소유 · 강민준',                       src: '15화',  catColor: '#F4A261' },
  { cat: '아이템', title: '핵심 USB',           sub: '등장 · 159화 충돌 감지',              src: '159화', catColor: '#F4A261' },
  { cat: '아이템', title: '결정적 문자',        sub: '종류 · 디지털 메시지, 핵심 증거',     src: '159화', catColor: '#F4A261' },
  { cat: '아이템', title: '빨간 볼펜',          sub: '소유 · 수아, 긴장 시 돌리는 습관',   src: '1화',   catColor: '#F4A261' },
  { cat: '아이템', title: '공판 기록 파일',     sub: '내용 · 47화 증거 목록 전체',          src: '47화',  catColor: '#F4A261' },
  { cat: '아이템', title: '수아 아버지 유품',   sub: '의미 · 결말 복선 [스포일러]',         src: '—',     catColor: '#F4A261' },
  { cat: '아이템', title: '포렌식 분석 보고서', sub: '내용 · 디지털 포렌식 결과물',         src: '55화',  catColor: '#F4A261' },
  // 세계 규칙 — 수사 기법
  { cat: '세계 규칙', title: '반대심문',      sub: '수사 기법 · 피의자 논리 파훼, 공판 핵심',  src: '89화',  catColor: '#FF4D4D' },
  { cat: '세계 규칙', title: '증거 제출',     sub: '수사 기법 · 공판 개시 후 가능, 기한 엄수', src: '47화',  catColor: '#FF4D4D' },
  { cat: '세계 규칙', title: '증인 심문',     sub: '수사 기법 · 수아 특기, 목격자 확보',       src: '47화',  catColor: '#FF4D4D' },
  { cat: '세계 규칙', title: '현장 감식',     sub: '수사 기법 · 수사팀 현장 출동 필수',        src: '31화',  catColor: '#FF4D4D' },
  { cat: '세계 규칙', title: '심리 압박 심문',sub: '수사 기법 · 강민준 전용, 위험 충돌',       src: '89화',  catColor: '#FF4D4D' },
  { cat: '세계 규칙', title: '공판 개시',     sub: '수사 기법 · 검사 특권, 강민준',            src: '3화',   catColor: '#FF4D4D' },
  { cat: '세계 규칙', title: '알리바이 검증', sub: '수사 기법 · CCTV·포렌식 연계 파훼',        src: '89화',  catColor: '#FF4D4D' },
  { cat: '세계 규칙', title: '탐문 수사',     sub: '수사 기법 · 현장 출동, 관계자 진술 확보',  src: '31화',  catColor: '#FF4D4D' },
  { cat: '세계 규칙', title: '기각 신청',     sub: '수사 기법 · 이레나 변호사 특기, 절차 공략',src: '67화',  catColor: '#FF4D4D' },
  // 세계 규칙 — 법규
  { cat: '세계 규칙', title: '검사 사적 접촉 금지',  sub: '법규 · 위반 시 충돌 감지',               src: '3화',   catColor: '#FF4D4D' },
  { cat: '세계 규칙', title: '증거 제출 기한',        sub: '법규 · 공판 3일 전',                     src: '15화',  catColor: '#FF4D4D' },
  { cat: '세계 규칙', title: '임용 전 검사 제한',     sub: '법규 · 독립 수사 권한 없음',             src: '123화', catColor: '#FF4D4D' },
  { cat: '세계 규칙', title: '수사 기밀 유지',        sub: '법규 · 위반 시 직무유기 해당',           src: '15화',  catColor: '#FF4D4D' },
  { cat: '세계 규칙', title: '피의자 심문 녹취',      sub: '법규 · 전 과정 필수 녹음',               src: '31화',  catColor: '#FF4D4D' },
  { cat: '세계 규칙', title: '공판 기일 변경 불가',   sub: '법규 · 천재지변 외 변경 불허',           src: '47화',  catColor: '#FF4D4D' },
  { cat: '세계 규칙', title: '검사 겸직 금지',        sub: '법규 · 공직 외 영리활동 불가',           src: '—',     catColor: '#FF4D4D' },
  { cat: '세계 규칙', title: '검사장 특별 명령권',    sub: '법규 · 최 검사 권한, 예외 수사 승인',    src: '20화',  catColor: '#FF4D4D' },
  { cat: '세계 규칙', title: '위법 수집 증거 배제',   sub: '법규 · 영장 없는 증거 전면 무효',        src: '123화', catColor: '#FF4D4D' },
  // 마법/기술
  { cat: '마법/기술', title: '디지털 포렌식',         sub: '기술 · 영장 필요, 48시간 소요',          src: '47화',  catColor: '#B48BFF' },
  { cat: '마법/기술', title: 'DNA 감식',              sub: '기술 · 국과수 의뢰, 14일 소요',          src: '55화',  catColor: '#B48BFF' },
  { cat: '마법/기술', title: 'CCTV 추적',             sub: '기술 · 30일 보존, 사각지대',             src: '31화',  catColor: '#B48BFF' },
  { cat: '마법/기술', title: '해시값 무결성',         sub: '기술 · 포렌식 증거 위·변조 방지',        src: '55화',  catColor: '#B48BFF' },
  { cat: '마법/기술', title: '포렌식 법적 약점',      sub: '기술 · 절차 위반 시 증거 전면 배제',     src: '159화', catColor: '#B48BFF' },
  { cat: '마법/기술', title: 'DNA 루미놀 오탐',       sub: '기술 · 염소계 세제에도 반응, 오탐 주의', src: '55화',  catColor: '#B48BFF' },
  { cat: '마법/기술', title: 'CCTV 사각지대',         sub: '기술 · 지하 2층 복도 미설치 구간',       src: '—',     catColor: '#B48BFF' },
  { cat: '마법/기술', title: 'DNA 오염 위험',         sub: '기술 · 이송 중 오염 시 결과 무효',       src: '55화',  catColor: '#B48BFF' },
  // 장소
  { cat: '장소', title: '3호 법정',              sub: '냉백색 조명, 서늘한 분위기',     src: '3화',   catColor: '#4BB8D9' },
  { cat: '장소', title: '수사팀 회의실',         sub: '지하 2층, 출입카드 보안구역',    src: '20화',  catColor: '#4BB8D9' },
  { cat: '장소', title: '을지로 오피스텔',       sub: '수아 거주지, 14층',              src: '7화',   catColor: '#4BB8D9' },
  { cat: '마법/기술', title: '능력 거리/매체 제한 (설정오류 주의)', sub: '룰 · CCTV, 영상통화, 녹음본으로는 절대 색이 보이지 않음. 오직 육안 직시 반경 15m 이내', src: '설정집', catColor: '#B48BFF' },
  { cat: '마법/기술', title: '투명 매개체 반사 설정', sub: '룰 · 유리창이나 거울에 반사된 모습에서도 아우라가 보임 (37화 취조실 거울 트릭 활용)', src: '37화', catColor: '#B48BFF' },
  { cat: '마법/기술', title: '이종 언어(외국어) 거짓말 판정', sub: '룰 · 범인이 영어로 거짓말을 해도, 속마음과 발화 내용이 다르면 언어 무관하게 발동', src: '82화', catColor: '#B48BFF' },
  { cat: '타임라인', title: '시력 저하 누적 데미지 타임라인', sub: '오류 방지 · 12화, 45화, 88화, 112화에서 한계치 이상 사용. 130화부터 안경 착용 시작', src: '130화', catColor: '#8E9196' },
  { cat: '타임라인', title: '과거 7세 화재 사건 생존자 모순점', sub: '오류 방지 · 당시 3층에 있었다는 A의 증언과 구조대 기록이 안 맞음. 추후 최종보스 단서', src: '기획 노트', catColor: '#8E9196' },
  { cat: '캐릭터', title: '강민준 (트라우마 및 총기 사용)', sub: '설정 · 과거 오발 사고로 인해 실탄 장전 및 총기 사용을 극도로 꺼림 (위기 상황 복선)', src: '설정집', catColor: '#7C5CFC' },
  { cat: '캐릭터', title: '이레나 (눈치챈 시점 오류 주의)', sub: '오류 방지 · 이레나가 수아의 능력을 확신하는 건 142화. 그 전엔 단순 직감으로만 서술할 것', src: '142화', catColor: '#7C5CFC' },
  { cat: '세계 규칙', title: '거짓말 탐지기 vs 수아의 능력', sub: '룰 · 탐지기는 자율신경계를, 수아는 의지를 읽음. 사이코패스는 탐지기를 통과해도 수아에겐 걸림', src: '22화', catColor: '#FF4D4D' },
  { cat: '사회/문화', title: '수아의 자금출처/생활고', sub: '현실성 · 공판과 사적 수사를 병행하느라 만성 적자. 하윤의 카페 건물 옥탑방 세입자로 서술됨', src: '초반부', catColor: '#2D9CDB' },
  { cat: '아이템', title: '선글라스/색안경의 효과', sub: '설정 · 물리적으로 붉은색을 차단해도 시각 신경에 맺히는 현상이라 눈을 감지 않는 한 보임', src: '설정집', catColor: '#F4A261' },
  { cat: '마법/기술', title: '과장과 허풍에 대한 판정', sub: '룰 · 농담이나 명백한 허풍("나 방금 100그릇 먹음")에는 아우라가 연하게 나타남 (농도 차이 존재)', src: '설정집', catColor: '#B48BFF' },
  { cat: '세계 규칙', title: '법정 내 특수 결계 (차단 장치)', sub: '오류 방지 · 이 세계관엔 마법 차단 장치가 없음. 현대 한국과 100% 동일한 물리법칙', src: '설정집', catColor: '#FF4D4D' },
  { cat: '캐릭터', title: '최 검사장 (최종 보스 의혹)', sub: '떡밥 · 5화 회의 중 유일하게 수아의 시선을 피함. 그 이후 단 한 번도 수아와 1:1 대면을 안 함', src: '5화', catColor: '#7C5CFC' },
  { cat: '역사', title: '구(舊) 중앙지검 폭발사건', sub: '배경 · 수아 부모님 화재 사건과 동일한 날짜(15년 전)에 발생한 미제 사건. 두 사건의 배후가 같음', src: '기획 노트', catColor: '#E67E22' },
  { cat: '아이템', title: '강민준의 만년필', sub: '아이템 · 거짓말을 한 용의자 취조 시 책상을 딱딱 치는 습관이 있는데 항상 이 만년필을 씀', src: '공통', catColor: '#F4A261' },
  { cat: '마법/기술', title: '능력 이식/탈취 가능성 (떡밥)', sub: '떡밥 · 신흥 사이비 종교 에피소드에서 "보는 눈"을 뽑아 이식하려는 광신도 등장 예정', src: '시즌2', catColor: '#B48BFF' },
  { cat: '타임라인', title: '하윤 카페 아르바이트생 변동', sub: '오류 방지 · 40화에서 알바생 교체됨. 45화에서 전 알바생 이름 부르지 않도록 주의', src: '40화', catColor: '#8E9196' },
  { cat: '사회/문화', title: '수사팀 내 커피 취향', sub: '설정 · 수아: 얼죽아 / 민준: 에스프레소(설탕 2개) / 이레나: 라떼 (사소한 대화 디테일용)', src: '설정집', catColor: '#2D9CDB' },
  { cat: '세계 규칙', title: '침묵에 대한 판정', sub: '룰 · 거짓말을 하지 않고 완전히 입을 다물고 있으면 아우라가 발생하지 않음 (능력의 최고 맹점)', src: '99화', catColor: '#FF4D4D' },
  { cat: '캐릭터', title: '수사팀 막내(김형사)', sub: '떡밥 · 어리버리한 성격이나, 77화에서 범인의 도주로를 실수인 척 열어줌 (내통자 의혹)', src: '77화', catColor: '#7C5CFC' },
  { cat: '장소', title: '검찰청 12층',           sub: '강민준 사무실, 한강 조망',       src: '12화',  catColor: '#4BB8D9' },
  { cat: '장소', title: '을지로 카페',           sub: '수아·강민준 단골 스페셜티',      src: '22화',  catColor: '#4BB8D9' },
  { cat: '장소', title: '서울 구치소',           sub: '피의자 면담 장소',               src: '89화',  catColor: '#4BB8D9' },
  { cat: '장소', title: '서울대병원 응급실',     sub: '주요 목격자 이송',               src: '55화',  catColor: '#4BB8D9' },
  { cat: '장소', title: '서울대 법전원',         sub: '수아 모교, 회상 장면',           src: '—',     catColor: '#4BB8D9' },
  // 판타지 — 캐릭터
  { cat: '캐릭터', title: '아르켄',    sub: '역할 · 주인공, 실낙원 출신 마법사',              src: '1화',   catColor: '#7C5CFC' },
  { cat: '캐릭터', title: '세리아',    sub: '역할 · 조력자, 치유 성녀',                       src: '3화',   catColor: '#7C5CFC' },
  { cat: '캐릭터', title: '카드론',    sub: '역할 · 라이벌, 흑마법 계승자',                   src: '12화',  catColor: '#7C5CFC' },
  { cat: '캐릭터', title: '나이아',    sub: '역할 · 흑막, 고대 마신 빙의 [스포일러]',         src: '—',     catColor: '#7C5CFC' },
  // 판타지 — 아이템
  { cat: '아이템', title: '혼돈의 서',    sub: '소유 · 아르켄, 금지 마법 전부 기록',          src: '1화',   catColor: '#F4A261' },
  { cat: '아이템', title: '마나 결정체',  sub: '효과 · 마나 200 즉시 회복, 1회용',            src: '15화',  catColor: '#F4A261' },
  { cat: '아이템', title: '봉인 반지',    sub: '효과 · 대상 마법력 90% 봉쇄',                 src: '47화',  catColor: '#F4A261' },
  { cat: '아이템', title: '공허의 파편',  sub: '등장 · 마신 강화 핵심 아이템 [스포일러]',     src: '—',     catColor: '#F4A261' },
  // 판타지 — 마법/기술 (스킬)
  { cat: '마법/기술', title: '섬광연환',  sub: '광역 광속 타격 · 마나 120 · 암속성 면역 유닛 무효',     src: '5화',   catColor: '#B48BFF' },
  { cat: '마법/기술', title: '흑염폭',    sub: '단일 폭발 · 마나 85 · 화염+암흑 복합 속성',            src: '15화',  catColor: '#B48BFF' },
  { cat: '마법/기술', title: '빙결진',    sub: '광역 이동 불가 5초 · 마나 150 · 불 속성에 해제',        src: '22화',  catColor: '#B48BFF' },
  { cat: '마법/기술', title: '공간 균열', sub: '차원 슬래시 · 마나 200 · 결계 내 사용 불가',            src: '31화',  catColor: '#B48BFF' },
  { cat: '마법/기술', title: '정령 소환', sub: '계약 정령 최대 3체 · 마나 175 · 계약자 사망 시 해제',   src: '35화',  catColor: '#B48BFF' },
  { cat: '마법/기술', title: '신성 방패', sub: '피해 흡수 500 · 마나 100/초 유지 · 암속성 2배 흡수',    src: '42화',  catColor: '#B48BFF' },
  { cat: '마법/기술', title: '암흑 침식', sub: '마력 지속 감소 · 마나 60 · 신성계 유닛 면역',           src: '55화',  catColor: '#B48BFF' },
  { cat: '마법/기술', title: '마력 압축', sub: '다음 마법 위력 3배 · 마나 50 · 연속 사용 불가',         src: '67화',  catColor: '#B48BFF' },
  { cat: '마법/기술', title: '시간 역류', sub: '10초 전 상태 복구 · 마나 500 · [스포일러]',             src: '—',     catColor: '#B48BFF' },
  { cat: '마법/기술', title: '혼돈 해방', sub: '봉인 마법 전체 해제 · 마나 전량 소모 · [스포일러]',     src: '—',     catColor: '#B48BFF' },
  // 판타지 — 세계 규칙 (마법 법칙)
  { cat: '세계 규칙', title: '마나 고갈 시 행동 불가', sub: '법규 · 회복 전 마법 사용 불가, 10분 휴식 필요',     src: '3화',  catColor: '#FF4D4D' },
  { cat: '세계 규칙', title: '속성 상쇄 원칙',         sub: '법규 · 반대 속성 마법 충돌 시 상쇄',               src: '5화',  catColor: '#FF4D4D' },
  { cat: '세계 규칙', title: '계약 마법 해제 조건',    sub: '법규 · 계약자 사망 시 정령·소환수 자동 해제',      src: '22화', catColor: '#FF4D4D' },
  { cat: '세계 규칙', title: '금지 마법 목록',         sub: '법규 · 시간·차원·부활 계열 사용 시 처형',          src: '31화', catColor: '#FF4D4D' },
  { cat: '세계 규칙', title: '마법 등록제',            sub: '법규 · S등급 이상 마법 국가 신고 필수',            src: '—',    catColor: '#FF4D4D' },
  { cat: '세계 규칙', title: '봉인된 마신의 저주',     sub: '법규 · 마신 마법 사용 시 부작용 [스포일러]',        src: '—',    catColor: '#FF4D4D' },
  // 판타지 — 장소
  { cat: '장소', title: '마법사 탑',    sub: '7층 구조, 아르켄 소속 마법사 길드',             src: '1화',  catColor: '#4BB8D9' },
  { cat: '장소', title: '금단의 숲',    sub: '고레벨 마수 서식, 출입 금지 구역',              src: '22화', catColor: '#4BB8D9' },
  { cat: '장소', title: '왕도 카엘론',  sub: '대륙 중심 도시, 마법 의회 소재지',              src: '5화',  catColor: '#4BB8D9' },
  { cat: '장소', title: '공허의 균열',  sub: '마신 봉인 장소, 진입 시 즉사 위험 [스포일러]',  src: '—',    catColor: '#4BB8D9' },
  // 타임라인
  { cat: '타임라인', title: '수아 법전원 시절',    sub: '과거 — 강민준과 첫 인지 (회상)',     src: '—',     catColor: '#FF4D4D' },
  { cat: '타임라인', title: '강민준 첫 등장',      sub: '3화 냉혹한 수석검사 도입',           src: '3화',   catColor: '#FF4D4D' },
  { cat: '타임라인', title: '수아 첫 법정 출석',   sub: '3화 검사 자격 정지 위기',            src: '3화',   catColor: '#FF4D4D' },
  { cat: '타임라인', title: '이레나 첫 등장',      sub: '12화 라이벌 등장, 긴장 고조',        src: '12화',  catColor: '#FF4D4D' },
  { cat: '타임라인', title: '첫 법정 대결',        sub: '15화 수아 vs 강민준 격돌',           src: '15화',  catColor: '#FF4D4D' },
  { cat: '타임라인', title: '핵심 증거 발견',      sub: '47화 USB 단서 최초 등장',            src: '47화',  catColor: '#FF4D4D' },
  { cat: '타임라인', title: '강민준 과거 폭로',    sub: '89화 10년 전 사건 드러남',           src: '89화',  catColor: '#FF4D4D' },
  { cat: '타임라인', title: '이레나 갈등 심화',    sub: '89화 대립 극한',                     src: '89화',  catColor: '#FF4D4D' },
  { cat: '타임라인', title: '이레나 화해',         sub: '142화 화해 완료',                    src: '142화', catColor: '#FF4D4D' },
  { cat: '타임라인', title: '159화 클라이맥스',    sub: '증거 충돌 최고조, 오류 5건 동시 감지', src: '159화', catColor: '#FF4D4D' },
  // 판타지 — 타임라인
  { cat: '타임라인', title: '마신 봉인 해제 사건', sub: '1화 세계관 위기 발단',                    src: '1화',   catColor: '#FF4D4D' },
  { cat: '타임라인', title: '아르켄 정체 폭로',    sub: '47화 실낙원 출신 밝혀짐',                 src: '47화',  catColor: '#FF4D4D' },
  { cat: '타임라인', title: '세리아 각성',          sub: '89화 신성력 최대 개방, 마나 한계 돌파',   src: '89화',  catColor: '#FF4D4D' },
  { cat: '타임라인', title: '나이아 흑막 드러남',   sub: '142화 마신 빙의 사실 폭로 [스포일러]',    src: '142화', catColor: '#FF4D4D' },
];

const SEARCH_CATS = ['전체', '캐릭터', '아이템', '마법/기술', '장소', '세계 규칙', '사회/문화', '역사', '타임라인'] as const;

function SearchView() {
  const [query, setQuery] = useState('');
  const [cat, setCat] = useState<string>('전체');
  const [focused, setFocused] = useState(false);

  const results = SEARCH_DATA.filter(d => {
    const matchCat = cat === '전체' || d.cat === cat;
    const matchQ = !query.trim() || d.title.includes(query) || d.sub.includes(query);
    return matchCat && matchQ;
  });

  return (
    <div>
      {/* 검색창 */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10,
        background: C.bg, border: `1px solid ${focused ? C.primary : C.border}`,
        borderRadius: 8, padding: '0 14px', height: 44, marginBottom: 12,
        transition: 'border-color 0.15s',
      }}>
        <Search size={15} color={C.t3} style={{ flexShrink: 0 }} />
        <input
          value={query}
          onChange={e => setQuery(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          placeholder="캐릭터, 아이템, 스킬, 설정 항목 검색..."
          style={{
            flex: 1, background: 'none', border: 'none', outline: 'none',
            color: C.t1, fontSize: 14, fontFamily: 'inherit',
          }}
        />
        {query && (
          <button onClick={() => setQuery('')} style={{ background: 'none', border: 'none', color: C.t3, cursor: 'pointer', padding: 2 }}>
            <X size={14} />
          </button>
        )}
      </div>

      {/* 카테고리 필터 */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 16, flexWrap: 'wrap' }}>
        {SEARCH_CATS.map(c => (
          <button key={c} onClick={() => setCat(c)} style={{
            height: 28, padding: '0 12px', borderRadius: 14, cursor: 'pointer',
            fontFamily: 'inherit', fontSize: 12, transition: 'all 0.13s',
            background: cat === c ? C.primary + '22' : 'transparent',
            border: `1px solid ${cat === c ? C.primary : C.border}`,
            color: cat === c ? C.primary : C.t2,
            fontWeight: cat === c ? 600 : 400,
          }}>{c}</button>
        ))}
      </div>

      {/* 결과 수 */}
      <div style={{ color: C.t3, fontSize: 12, marginBottom: 10 }}>
        검색 결과 {results.length}개
      </div>

      {/* 결과 카드 그리드 */}
      {results.length > 0 ? (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          {results.map((r, i) => (
            <div key={i} style={{
              background: C.surface, borderRadius: 6, border: `1px solid ${C.border}`,
              padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 10,
              cursor: 'pointer', transition: 'border-color 0.13s',
            }}
              onMouseEnter={e => (e.currentTarget.style.borderColor = '#3A3A4A')}
              onMouseLeave={e => (e.currentTarget.style.borderColor = C.border)}
            >
              {/* 카테고리 뱃지 */}
              <span style={{
                flexShrink: 0, padding: '2px 7px', borderRadius: 3, fontSize: 10, fontWeight: 600,
                background: r.catColor + '22', border: `1px solid ${r.catColor}55`, color: r.catColor,
              }}>{r.cat}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ color: C.t1, fontSize: 13, fontWeight: 600, marginBottom: 2 }}>{r.title}</div>
                <div style={{ color: C.t3, fontSize: 11 }}>{r.sub}</div>
              </div>
              <span style={{ color: C.t3, fontSize: 11, flexShrink: 0 }}>{r.src}</span>
            </div>
          ))}
        </div>
      ) : (
        <div style={{ textAlign: 'center', padding: '48px 0', color: C.t3, fontSize: 14 }}>
          검색 결과가 없습니다
        </div>
      )}
    </div>
  );
}

function WorldRulesView({ worldSettings, onAdd, onEdit }: {
  worldSettings: WorldSetting[];
  onAdd: () => void;
  onEdit: (ws: WorldSetting) => void;
}) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14, maxWidth: 860 }}>
      {worldSettings.map(ws => (
        <WorldCardDynamic key={ws.id} ws={ws} onEdit={() => onEdit(ws)} />
      ))}
      <div onClick={onAdd} style={{
        background: C.bg, borderRadius: 8, border: `2px dashed ${C.border}`,
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        gap: 8, cursor: 'pointer', minHeight: 160, transition: 'border-color 0.15s',
      }}
        onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.borderColor = C.success; }}
        onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.borderColor = C.border; }}>
        <Globe size={20} color={C.success} />
        <span style={{ color: C.t3, fontSize: 13 }}>세계관 설정 만들기</span>
      </div>
    </div>
  );
}


type NavId = 'settingDB' | 'reports' | 'graph';
type SettingTabId = 'characters' | 'relations' | 'timeline' | 'worldrules' | 'search';

const WORK_INFO: Record<WorkId, { title: string; genre: string }> = {
  detective: { title: '빛나는 검사 로맨스', genre: '로맨스' },
  murim: { title: '무협지존', genre: '무협' },
};

export default function S1Dashboard({ navigate, onPrePublish, selectedWork, onChangeWork }: Props) {
  const [activeNav, setActiveNav] = useState<NavId>('settingDB');
  const [settingTab, setSettingTab] = useState<SettingTabId>('characters');
  const [relGraphId, setRelGraphId] = useState<RelGraphId>('triangle');
  const [showUpload, setShowUpload] = useState<false | 'settings' | 'episode' | 'new-work'>(false);
  const [episodeTargetWork, setEpisodeTargetWork] = useState('');
  const [episodeTargetChapters, setEpisodeTargetChapters] = useState(0);
  const [showBuilder, setShowBuilder] = useState(false);
  const [chars, setChars] = useState<CharacterSetting[]>(INIT_CHARS);
  const [editTarget, setEditTarget] = useState<CharacterSetting | null>(null);
  const [worldSettings, setWorldSettings] = useState<WorldSetting[]>(INIT_WORLD_SETTINGS);
  const [showWorldBuilder, setShowWorldBuilder] = useState(false);
  const [editWorldTarget, setEditWorldTarget] = useState<WorldSetting | null>(null);
  const [showShare, setShowShare] = useState(false);
  const [selectedCharDetail, setSelectedCharDetail] = useState<string | null>(null);

  const handleCharSave = (s: CharacterSetting) => {
    setChars(prev => {
      const idx = prev.findIndex(c => c.id === s.id);
      return idx >= 0 ? prev.map(c => c.id === s.id ? s : c) : [...prev, s];
    });
  };

  const handleWorldSave = (ws: WorldSetting) => {
    setWorldSettings(prev => {
      const idx = prev.findIndex(w => w.id === ws.id);
      return idx >= 0 ? prev.map(w => w.id === ws.id ? ws : w) : [...prev, ws];
    });
  };

  const goToSettingDB = () => {
    setActiveNav('settingDB');
  };

  return (
    <div style={{
      background: C.bg, width: '100%', height: '100%',
      display: 'flex', flexDirection: 'column',
      fontFamily: "'Pretendard Variable', 'Pretendard', 'Apple SD Gothic Neo', -apple-system, sans-serif",
    }}>
      <div style={{
        height: 56, background: C.bg, borderBottom: `1px solid ${C.border}`,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 24px', flexShrink: 0, zIndex: 10,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{
            width: 26, height: 26, borderRadius: 6, background: `linear-gradient(135deg, ${C.primary}, #B48BFF)`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Shield size={14} color="#fff" />
          </div>
          <span style={{ color: C.t1, fontSize: 15, fontWeight: 700, letterSpacing: '-0.3px' }}>CatchHole</span>
          <span style={{
            padding: '2px 7px', borderRadius: 3, background: C.primary + '18',
            color: C.primary, fontSize: 10, fontWeight: 600, border: `1px solid ${C.primary}33`,
            marginLeft: 2,
          }}>BETA</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ color: C.t3, fontSize: 12 }}>구독제 · 이번 달 14/20회 사용</span>
          <div style={{
            width: 32, height: 32, borderRadius: '50%',
            background: `linear-gradient(135deg, ${C.primary}, #9B7BFD)`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer',
          }}>K</div>
        </div>
      </div>

      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        <div style={{
          width: 220, background: C.bg, borderRight: `1px solid ${C.border}`,
          padding: '16px 0', display: 'flex', flexDirection: 'column', flexShrink: 0,
        }}>
          {/* 현재 작품 표시 */}
          <div style={{ padding: '0 16px 12px' }}>
            <div style={{ color: C.t3, fontSize: 10, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 8 }}>현재 작품</div>
            <div style={{
              background: C.surface, border: `1px solid ${C.border}`, borderRadius: 6,
              padding: '8px 12px', marginBottom: 6,
            }}>
              <div style={{ color: C.t1, fontSize: 12, fontWeight: 600, marginBottom: 2, letterSpacing: '-0.2px' }}>
                {WORK_INFO[selectedWork].title}
              </div>
              <div style={{ color: C.t3, fontSize: 11 }}>{WORK_INFO[selectedWork].genre}</div>
            </div>
            <button onClick={onChangeWork} style={{
              width: '100%', padding: '5px 0', borderRadius: 5,
              border: `1px solid ${C.border}`, background: 'transparent',
              color: C.t2, fontSize: 11, cursor: 'pointer', fontFamily: 'inherit',
              transition: 'all 0.15s', letterSpacing: '-0.1px',
            }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = C.primary + '66'; e.currentTarget.style.color = C.primary; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.color = C.t2; }}
            >
              작품 변경
            </button>
          </div>
          <div style={{ margin: '0 16px 10px', borderTop: `1px solid ${C.border}` }} />
          <div style={{ padding: '0 20px 10px', color: C.t3, fontSize: 10, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase' }}>워크스페이스</div>
          <NavItem icon={<BookOpen size={14} />} label="설정 DB" active={activeNav === 'settingDB'} onClick={() => setActiveNav('settingDB')} />
          <NavItem icon={<BarChart3 size={14} />} label="분석 리포트" active={activeNav === 'reports'} badge="3" onClick={() => setActiveNav('reports')} />
          <NavItem icon={<Network size={14} />} label="그래프 뷰" active={activeNav === 'graph'} onClick={() => setActiveNav('graph')} />
          <NavItem icon={<MessageSquare size={14} />} label="챗봇" onClick={() => navigate('S3', 'push-right')} />
          <div style={{ margin: '12px 16px', borderTop: `1px solid ${C.border}` }} />
          <div style={{ padding: '0 20px 10px', color: C.t3, fontSize: 10, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase' }}>계정</div>
          <NavItem icon={<Settings size={14} />} label="설정" />

          <div style={{ marginTop: 'auto', padding: '16px 20px', borderTop: `1px solid ${C.border}` }}>
            <div style={{ color: C.t3, fontSize: 11, marginBottom: 6 }}>이번 달 분석</div>
            <div style={{ height: 4, background: C.border, borderRadius: 2, overflow: 'hidden', marginBottom: 4 }}>
              <div style={{ width: '70%', height: '100%', background: C.primary, borderRadius: 2 }} />
            </div>
            <div style={{ color: C.t3, fontSize: 11 }}>14 / 20회</div>
          </div>
        </div>

        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <AnimatePresence mode="wait">
            {activeNav === 'settingDB' && (
              <motion.div key="settingDB" initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }}
                style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', position: 'relative' }}>
                <div style={{
                  padding: '20px 40px', borderBottom: `1px solid ${C.border}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0,
                }}>
                  <div>
                    <div style={{ color: C.t3, fontSize: 12, marginBottom: 4 }}>설정 대시보드</div>
                    <div style={{ color: C.t1, fontSize: 18, fontWeight: 700, letterSpacing: '-0.4px' }}>
                      {WORK_INFO[selectedWork].title}
                      <span style={{ marginLeft: 8, padding: '2px 8px', borderRadius: 4, background: C.primary + '18', color: C.primary, fontSize: 12, fontWeight: 500, border: `1px solid ${C.primary}33`, verticalAlign: 'middle' }}>{WORK_INFO[selectedWork].genre}</span>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <BtnG label="설정 수정" icon={<Settings size={12} />} />
                    <BtnP label="신규 회차 분석" onClick={() => navigate('S2', 'push-right')} icon={<Activity size={12} />} />
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 0, padding: '0 40px', borderBottom: `1px solid ${C.border}`, flexShrink: 0 }}>
                  {([
                    { id: 'characters', label: '캐릭터 DB', icon: <Users size={13} /> },
                    { id: 'relations', label: '관계도', icon: <GitBranch size={13} /> },
                    { id: 'timeline', label: '타임라인', icon: <Clock size={13} /> },
                    { id: 'worldrules', label: '세계관 규칙', icon: <Globe size={13} /> },
                    { id: 'search', label: '설정 검색', icon: <Search size={13} /> },
                  ] as { id: SettingTabId; label: string; icon: React.ReactNode }[]).map((tab) => (
                    <button key={tab.id} onClick={() => setSettingTab(tab.id)} style={{
                      height: 44, padding: '0 16px', background: 'none', border: 'none',
                      borderBottom: `2px solid ${settingTab === tab.id ? C.primary : 'transparent'}`,
                      color: settingTab === tab.id ? C.primary : C.t2,
                      fontSize: 13, fontWeight: settingTab === tab.id ? 600 : 400,
                      cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.15s',
                      display: 'flex', alignItems: 'center', gap: 6, marginBottom: -1,
                    }}>
                      {tab.icon}{tab.label}
                    </button>
                  ))}
                </div>

                <div style={{ flex: 1, overflowY: 'auto', padding: '24px 40px' }}>
                  <AnimatePresence mode="wait">
                    {settingTab === 'characters' && (
                      <motion.div key="chars" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} style={{ position: 'relative' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14, maxWidth: 860 }}>
                          {chars.map(s => (
                            <CharCardDynamic
                              key={s.id}
                              setting={s}
                              onEdit={() => setEditTarget(s)}
                              onView={() => setSelectedCharDetail(s.id)}
                            />
                          ))}
                          <div onClick={() => setShowBuilder(true)} style={{
                            background: C.bg, borderRadius: 8, border: `2px dashed ${C.border}`,
                            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                            gap: 8, cursor: 'pointer', minHeight: 160, transition: 'border-color 0.15s',
                          }}
                            onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.borderColor = C.primary; }}
                            onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.borderColor = C.border; }}>
                            <Sparkles size={20} color={C.primary} />
                            <span style={{ color: C.t3, fontSize: 13 }}>캐릭터 설정 만들기</span>
                          </div>
                        </div>
                        <div style={{ marginTop: 24, maxWidth: 860 }}>
                          <div style={{ color: C.t3, fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>변경 이력</div>
                          <div style={{ background: C.bg, borderRadius: 8, border: `1px solid ${C.border}`, overflow: 'hidden' }}>
                            {[
                              { time: '방금 전', desc: '수아 · 눈 색 충돌 감지 (159화)', type: 'danger' },
                              { time: '어제', desc: '이레나 관계 상태: 갈등 → 화해 (142화)', type: 'success' },
                              { time: '2일 전', desc: '타임라인 이벤트 추가: 법정 첫 만남 (47화)', type: 'info' },
                            ].map((item, i) => (
                              <div key={i} style={{
                                display: 'flex', alignItems: 'center', gap: 10,
                                padding: '10px 14px', borderBottom: i < 2 ? `1px solid ${C.border}` : 'none',
                              }}>
                                <div style={{
                                  width: 6, height: 6, borderRadius: '50%', flexShrink: 0,
                                  background: item.type === 'danger' ? C.danger : item.type === 'success' ? C.success : C.primary,
                                }} />
                                <span style={{ color: C.t2, fontSize: 13, flex: 1 }}>{item.desc}</span>
                                <span style={{ color: C.t3, fontSize: 12 }}>{item.time}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      </motion.div>
                    )}

                    {settingTab === 'relations' && (
                      <motion.div key="rel" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} style={{ maxWidth: 860 }}>
                        <div style={{ color: C.t3, fontSize: 13, marginBottom: 14 }}>캐릭터 간 관계를 그래프로 시각화합니다. 관점별로 전환하며 확인하세요.</div>

                        {/* 그래프 선택 chip */}
                        <div style={{ display: 'flex', gap: 8, marginBottom: 6, flexWrap: 'wrap' }}>
                          {RELATION_GRAPHS.map(g => {
                            const active = relGraphId === g.id;
                            return (
                              <button key={g.id} onClick={() => setRelGraphId(g.id)} style={{
                                padding: '6px 16px', borderRadius: 20, cursor: 'pointer', fontFamily: 'inherit', fontSize: 13,
                                background: active ? C.primary + '1A' : 'transparent',
                                border: `1px solid ${active ? C.primary : C.border}`,
                                color: active ? C.primary : C.t2,
                                transition: 'all 0.13s',
                              }}>
                                {g.label}
                              </button>
                            );
                          })}
                        </div>
                        <div style={{ color: C.t3, fontSize: 12, marginBottom: 12 }}>
                          {RELATION_GRAPHS.find(g => g.id === relGraphId)?.subtitle}
                        </div>

                        <RelationGraph graph={RELATION_GRAPHS.find(g => g.id === relGraphId)!} />

                        <div style={{ display: 'flex', gap: 12, marginTop: 16 }}>
                          <div style={{ flex: 1, background: C.bg, borderRadius: 8, border: `1px solid ${C.border}`, padding: 14 }}>
                            <div style={{ color: C.t3, fontSize: 11, fontWeight: 600, marginBottom: 8 }}>최근 관계 변화</div>
                            <div style={{ color: C.success, fontSize: 13, fontWeight: 600 }}>수아 ↔ 이레나: 갈등 → 화해</div>
                            <div style={{ color: C.t3, fontSize: 12, marginTop: 4 }}>142화 / 2일 전</div>
                          </div>
                          <div style={{ flex: 1, background: C.bg, borderRadius: 8, border: `1px solid ${C.border}`, padding: 14 }}>
                            <div style={{ color: C.t3, fontSize: 11, fontWeight: 600, marginBottom: 8 }}>주의 관계</div>
                            <div style={{ color: C.warning, fontSize: 13, fontWeight: 600 }}>수아 ↔ 강민준: 감정 변화 중</div>
                            <div style={{ color: C.t3, fontSize: 12, marginTop: 4 }}>159화 갈등 서술 불일치 감지</div>
                          </div>
                        </div>
                      </motion.div>
                    )}

                    {settingTab === 'timeline' && (
                      <motion.div key="tl" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} style={{ maxWidth: 900 }}>
                        <div style={{ color: C.t3, fontSize: 13, marginBottom: 16 }}>작중 시간 흐름을 시각화합니다. 빨간 항목은 현재 분석 회차에서 충돌이 감지된 설정입니다.</div>
                        <TimelineView />
                        <div style={{ marginTop: 16, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                          {[
                            { color: C.primary, label: '설정 등록' },
                            { color: C.success, label: '관계 해소' },
                            { color: C.danger, label: '갈등 발생' },
                            { color: C.warning, label: '충돌 감지' },
                            { color: C.t3, label: '일반 이벤트' },
                          ].map((l) => (
                            <div key={l.label} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                              <div style={{ width: 8, height: 8, borderRadius: '50%', background: l.color }} />
                              <span style={{ color: C.t3, fontSize: 11 }}>{l.label}</span>
                            </div>
                          ))}
                        </div>
                      </motion.div>
                    )}

                    {settingTab === 'worldrules' && (
                      <motion.div key="wr" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} style={{ maxWidth: 900 }}>
                        <div style={{ color: C.t3, fontSize: 13, marginBottom: 16 }}>작품 고유의 세계관·환경 설정입니다. 설정집이나 회차에서 AI가 자동 추출하거나 직접 입력할 수 있습니다.</div>
                        <WorldRulesView
                          worldSettings={worldSettings}
                          onAdd={() => setShowWorldBuilder(true)}
                          onEdit={ws => setEditWorldTarget(ws)}
                        />
                      </motion.div>
                    )}

                    {settingTab === 'search' && (
                      <motion.div key="search" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} style={{ maxWidth: 900 }}>
                        <div style={{ color: C.t3, fontSize: 13, marginBottom: 16 }}>AI가 추출한 전체 설정 DB에서 키워드로 빠르게 검색합니다. 설정 오류를 방지하거나 떡밥을 확인할 때 유용합니다.</div>
                        <SearchView />
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
                <AnimatePresence>
                  {selectedCharDetail && (
                    <CharDetailModal
                      charId={selectedCharDetail}
                      chars={chars}
                      onClose={() => setSelectedCharDetail(null)}
                      onEdit={() => {
                        const s = chars.find(c => c.id === selectedCharDetail);
                        if (s) { setEditTarget(s); setSelectedCharDetail(null); }
                      }}
                    />
                  )}
                </AnimatePresence>
              </motion.div>
            )}

            {activeNav === 'reports' && (
              <motion.div key="reports" initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }}
                style={{ flex: 1, padding: '32px 40px', overflowY: 'auto' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
                  <span style={{ color: C.t1, fontSize: 20, fontWeight: 700, letterSpacing: '-0.5px' }}>분석 리포트</span>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <BtnG label="발행 전 검수" onClick={onPrePublish} icon={<Shield size={12} />} />
                    <BtnG label="전체 내보내기" icon={<Scroll size={12} />} />
                  </div>
                </div>

                {/* 통계 요약 */}
                <div style={{ display: 'flex', gap: 12, marginBottom: 24, maxWidth: 760 }}>
                  {[
                    { label: '분석 회차', value: '158화', sub: '총 누적' },
                    { label: '누적 오류', value: '23건', sub: '전체 감지', color: C.danger },
                    { label: '심각', value: '4건', sub: '즉시 수정 권장', color: C.danger },
                    { label: '오류 없음', value: '144화', sub: '정상 통과', color: C.success },
                  ].map(s => (
                    <div key={s.label} style={{
                      flex: 1, background: C.surface, border: `1px solid ${C.border}`,
                      borderRadius: 8, padding: '12px 16px',
                    }}>
                      <div style={{ color: C.t3, fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>{s.label}</div>
                      <div style={{ color: (s as { color?: string }).color || C.t1, fontSize: 20, fontWeight: 700, marginBottom: 2 }}>{s.value}</div>
                      <div style={{ color: C.t3, fontSize: 11 }}>{s.sub}</div>
                    </div>
                  ))}
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxWidth: 760 }}>
                  {[
                    { work: '빛나는 검사 로맨스', chapter: '159화', count: 5, severity: '심각 1건', date: '오늘', bars: [C.danger, C.warning, C.warning, C.warning, C.warning] },
                    { work: '빛나는 검사 로맨스', chapter: '158화', count: 2, severity: '주의 2건', date: '3일 전', bars: [C.warning, C.warning] },
                    { work: '무협지존', chapter: '42화', count: 0, severity: '오류 없음', date: '1주 전', bars: [] },
                    { work: '빛나는 검사 로맨스', chapter: '155화', count: 1, severity: '주의 1건', date: '2주 전', bars: [C.warning] },
                  ].filter(item => item.work === WORK_INFO[selectedWork].title).map((item, i) => (
                    <div key={i} onClick={() => navigate('S5', 'push-right')} style={{
                      background: C.surface, borderRadius: 8, border: `1px solid ${C.border}`,
                      padding: '14px 18px', cursor: 'pointer', transition: 'border-color 0.15s',
                    }}
                      onMouseEnter={(e) => (e.currentTarget.style.borderColor = '#3A3A4A')}
                      onMouseLeave={(e) => (e.currentTarget.style.borderColor = C.border)}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: item.bars.length > 0 ? 10 : 0 }}>
                        <div>
                          <div style={{ color: C.t1, fontSize: 14, fontWeight: 600, marginBottom: 3 }}>{item.work} · {item.chapter}</div>
                          <div style={{ color: C.t3, fontSize: 12 }}>{item.date} 분석</div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                          <span style={{
                            padding: '3px 9px', borderRadius: 4, fontSize: 12, fontWeight: 600,
                            background: item.count > 0 ? (item.count >= 3 ? C.danger + '1A' : C.warning + '1A') : C.success + '1A',
                            color: item.count > 0 ? (item.count >= 3 ? C.danger : C.warning) : C.success,
                            border: `1px solid ${item.count > 0 ? (item.count >= 3 ? C.danger + '44' : C.warning + '44') : C.success + '44'}`,
                          }}>{item.severity}</span>
                          <ChevronRight size={14} color={C.t3} />
                        </div>
                      </div>
                      {item.bars.length > 0 && (
                        <div style={{ display: 'flex', gap: 3 }}>
                          {item.bars.map((color, j) => (
                            <div key={j} style={{ flex: 1, height: 3, borderRadius: 2, background: color + 'AA' }} />
                          ))}
                          <div style={{ flex: Math.max(0, 8 - item.bars.length), height: 3, borderRadius: 2, background: C.border }} />
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </motion.div>
            )}

            {activeNav === 'graph' && (
              <motion.div key="graph" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                style={{ flex: 1, overflow: 'hidden' }}>
                <GraphView />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      <AnimatePresence>
        {editTarget && (
        <SettingsBuilderModal
          initial={editTarget}
          onClose={() => setEditTarget(null)}
          onSave={s => { handleCharSave(s); setEditTarget(null); }}
        />
      )}
      {showBuilder && (
        <SettingsBuilderModal
          onClose={() => setShowBuilder(false)}
          onSave={s => { handleCharSave(s); setShowBuilder(false); }}
        />
      )}
      {editWorldTarget && (
        <WorldBuilderModal
          initial={editWorldTarget}
          onClose={() => setEditWorldTarget(null)}
          onSave={ws => { handleWorldSave(ws); setEditWorldTarget(null); }}
        />
      )}
      {showWorldBuilder && (
        <WorldBuilderModal
          onClose={() => setShowWorldBuilder(false)}
          onSave={ws => { handleWorldSave(ws); setShowWorldBuilder(false); }}
        />
      )}
      {showShare && (
        <ShareModal workTitle="빛나는 검사 로맨스" onClose={() => setShowShare(false)} />
      )}
      {showUpload !== false && (
          <UploadModal
            onClose={() => setShowUpload(false)}
            mode={showUpload}
            initialWork={episodeTargetWork}
            initialChapters={episodeTargetChapters}
            works={MOCK_WORKS}
            navigate={navigate}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
