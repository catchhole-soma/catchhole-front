import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { C, NavigateFn } from './constants';
import {
  BookOpen, Users, GitBranch, Clock, Globe, BarChart3,
  Settings, Shield, OctagonAlert, AlertTriangle, Plus,
  Upload, ChevronRight, Activity, Scale, Scroll,
  BookMarked, FileText, Check, CircleCheckBig, Network,
} from 'lucide-react';
import { GraphView } from './GraphView';

interface Props { navigate: NavigateFn; }

const charColors: Record<string, string> = {
  sua: C.primary,
  min: '#E25C5C',
  lena: '#4BB8D9',
  hayun: C.success,
  choi: '#D4A04A',
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
function UploadModal({ onClose, mode, initialWork, navigate: nav }: {
  onClose: () => void;
  mode: 'settings' | 'episode';
  initialWork?: string;
  navigate?: NavigateFn;
}) {
  const [title, setTitle] = useState('');
  const [genre, setGenre] = useState('');
  const [dragging, setDragging] = useState(false);
  const [fileSelected, setFileSelected] = useState(false);
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [episodeWork] = useState(initialWork || '');
  const [episodeNum, setEpisodeNum] = useState('');

  const isSettings = mode === 'settings';
  const canProceed = isSettings
    ? (title.trim() && genre && fileSelected)
    : (episodeWork && episodeNum.trim() && fileSelected);

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
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 0, marginBottom: 28 }}>
          {(isSettings ? ['설정집 등록', 'AI 분석', '확인·수정'] : ['회차 선택', 'AI 대조']).map((s, i, arr) => (
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

        {isSettings && step === 1 && (
          <>
            <div style={{ color: C.t1, fontSize: 17, fontWeight: 700, letterSpacing: '-0.3px', marginBottom: 6 }}>설정집 올리기</div>
            <div style={{ color: C.t2, fontSize: 13, marginBottom: 24 }}>설정집을 업로드하면 AI가 캐릭터·세계관·타임라인을 자동 추출합니다</div>

            <div style={{ marginBottom: 16 }}>
              <div style={{ color: C.t3, fontSize: 11, fontWeight: 600, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>작품 제목</div>
              <input
                value={title} onChange={(e) => setTitle(e.target.value)}
                placeholder="예: 빛나는 검사 로맨스"
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

            <div
              onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onDrop={() => { setDragging(false); setFileSelected(true); }}
              onClick={() => setFileSelected(true)}
              style={{
                border: `2px dashed ${dragging ? C.primary : fileSelected ? C.success : C.border}`,
                borderRadius: 8, padding: '24px', textAlign: 'center',
                background: dragging ? C.primary + '08' : fileSelected ? C.success + '08' : 'transparent',
                cursor: 'pointer', transition: 'all 0.15s', marginBottom: 20,
              }}
            >
              {fileSelected ? (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                  <CircleCheckBig size={18} color={C.success} />
                  <span style={{ color: C.success, fontSize: 14, fontWeight: 600 }}>설정집.txt — 업로드 준비 완료</span>
                </div>
              ) : (
                <>
                  <Upload size={24} color={C.t3} style={{ margin: '0 auto 10px' }} />
                  <div style={{ color: C.t2, fontSize: 14, marginBottom: 4 }}>파일을 드래그하거나 클릭하여 업로드</div>
                  <div style={{ color: C.t3, fontSize: 12 }}>txt, docx 지원 · 설정집 파일</div>
                </>
              )}
            </div>

            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={onClose} style={{
                flex: 1, height: 40, borderRadius: 6, background: 'transparent',
                border: `1px solid ${C.border}`, color: C.t2, fontSize: 13,
                cursor: 'pointer', fontFamily: 'inherit',
              }}>취소</button>
              <button
                onClick={() => canProceed && setStep(2)}
                style={{
                  flex: 2, height: 40, borderRadius: 6, border: 'none',
                  background: canProceed ? C.primary : C.border,
                  color: canProceed ? '#fff' : C.t3, fontSize: 13, fontWeight: 600,
                  cursor: canProceed ? 'pointer' : 'default', fontFamily: 'inherit', transition: 'all 0.15s',
                }}>
                다음 — AI 설정 추출
              </button>
            </div>
          </>
        )}

        {!isSettings && step === 1 && (
          <>
            <div style={{ color: C.t1, fontSize: 17, fontWeight: 700, letterSpacing: '-0.3px', marginBottom: 6 }}>회차 올리기</div>
            <div style={{ color: C.t2, fontSize: 13, marginBottom: 24 }}>회차 파일을 업로드하면 AI가 설정 DB와 대조해 충돌을 탐지합니다</div>

            <div style={{ marginBottom: 16 }}>
              <div style={{ color: C.t3, fontSize: 11, fontWeight: 600, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>작품 선택</div>
              <div style={{
                width: '100%', height: 40, borderRadius: 6,
                background: C.bg, border: `1px solid ${C.border}`,
                color: C.t1, fontSize: 14, padding: '0 12px',
                display: 'flex', alignItems: 'center', boxSizing: 'border-box',
              }}>
                {episodeWork}
              </div>
            </div>

            <div style={{ marginBottom: 20 }}>
              <div style={{ color: C.t3, fontSize: 11, fontWeight: 600, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>회차 번호</div>
              <input
                value={episodeNum} onChange={(e) => setEpisodeNum(e.target.value)}
                placeholder="예: 160" type="number" min="1"
                style={{
                  width: '100%', height: 40, borderRadius: 6,
                  background: C.bg, border: `1px solid ${C.border}`,
                  color: C.t1, fontSize: 14, padding: '0 12px',
                  fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box',
                }}
              />
            </div>

            <div
              onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onDrop={() => { setDragging(false); setFileSelected(true); }}
              onClick={() => setFileSelected(true)}
              style={{
                border: `2px dashed ${dragging ? C.primary : fileSelected ? C.success : C.border}`,
                borderRadius: 8, padding: '24px', textAlign: 'center',
                background: dragging ? C.primary + '08' : fileSelected ? C.success + '08' : 'transparent',
                cursor: 'pointer', transition: 'all 0.15s', marginBottom: 20,
              }}
            >
              {fileSelected ? (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                  <CircleCheckBig size={18} color={C.success} />
                  <span style={{ color: C.success, fontSize: 14, fontWeight: 600 }}>회차파일.txt — 업로드 준비 완료</span>
                </div>
              ) : (
                <>
                  <Upload size={24} color={C.t3} style={{ margin: '0 auto 10px' }} />
                  <div style={{ color: C.t2, fontSize: 14, marginBottom: 4 }}>파일을 드래그하거나 클릭하여 업로드</div>
                  <div style={{ color: C.t3, fontSize: 12 }}>txt, docx 지원 · 회차 파일</div>
                </>
              )}
            </div>

            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={onClose} style={{
                flex: 1, height: 40, borderRadius: 6, background: 'transparent',
                border: `1px solid ${C.border}`, color: C.t2, fontSize: 13,
                cursor: 'pointer', fontFamily: 'inherit',
              }}>취소</button>
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

        {step === 2 && (
          <div style={{ textAlign: 'center', padding: '20px 0' }}>
            <motion.div
              animate={{ rotate: 360 }} transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
              style={{ width: 48, height: 48, margin: '0 auto 20px', borderRadius: '50%', border: `3px solid ${C.primary}33`, borderTop: `3px solid ${C.primary}` }}
            />
            <div style={{ color: C.t1, fontSize: 16, fontWeight: 700, marginBottom: 8 }}>
              {isSettings ? 'AI 설정 DB 구축 중...' : 'AI 설정 대조 중...'}
            </div>
            <div style={{ color: C.t2, fontSize: 13, marginBottom: 24 }}>
              {isSettings ? '캐릭터·관계·타임라인을 자동 추출합니다' : '설정 DB와 대조하여 충돌을 탐지합니다'}
            </div>
            {(isSettings
              ? ['캐릭터 목록 추출 완료', '외모·성격 설정 파싱 중', '관계도 구축 중', '타임라인 분석 대기']
              : ['캐릭터 설정 로드 완료', '회차 텍스트 파싱 중', '충돌 패턴 대조 중', '타임라인 검증 대기']
            ).map((item, i) => (
              <div key={item} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0', textAlign: 'left', justifyContent: 'center' }}>
                {i < 2 ? <CircleCheckBig size={14} color={C.success} /> : <motion.div animate={{ opacity: [0.3, 1, 0.3] }} transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.3 }} style={{ width: 14, height: 14, borderRadius: '50%', border: `2px solid ${C.t3}` }} />}
                <span style={{ color: i < 2 ? C.t1 : C.t3, fontSize: 13 }}>{item}</span>
              </div>
            ))}
            <button
              onClick={() => isSettings ? setStep(3) : (nav?.('S4', 'dissolve'), onClose())}
              style={{
                marginTop: 24, height: 38, padding: '0 24px', borderRadius: 6,
                background: C.primary, border: 'none', color: '#fff', fontSize: 13,
                fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
              }}>계속</button>
          </div>
        )}

        {isSettings && step === 3 && (
          <>
            <div style={{ color: C.t1, fontSize: 17, fontWeight: 700, marginBottom: 6 }}>설정 DB 미리보기</div>
            <div style={{ color: C.t2, fontSize: 13, marginBottom: 20 }}>AI가 추출한 설정을 확인하고 필요시 수정하세요</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 }}>
              {[
                { type: '캐릭터', count: '5명', icon: <Users size={13} /> },
                { type: '설정 항목', count: '23개', icon: <BookOpen size={13} /> },
                { type: '관계 엣지', count: '8개', icon: <GitBranch size={13} /> },
                { type: '타임라인 이벤트', count: '14개', icon: <Clock size={13} /> },
              ].map((item) => (
                <div key={item.type} style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '10px 14px', background: C.bg, borderRadius: 6, border: `1px solid ${C.border}`,
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: C.t2, fontSize: 13 }}>
                    <span style={{ color: C.t3 }}>{item.icon}</span>{item.type}
                  </div>
                  <span style={{ color: C.primary, fontSize: 13, fontWeight: 600 }}>{item.count}</span>
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

const GRAPH_NODES = [
  { id: 'sua',   label: '수아',   role: '주인공',     x: 250, y: 128 },
  { id: 'min',   label: '강민준', role: '남자주인공',  x: 418, y: 62  },
  { id: 'lena',  label: '이레나', role: '라이벌',     x: 418, y: 194 },
  { id: 'hayun', label: '하윤',   role: '절친',       x: 82,  y: 62  },
  { id: 'choi',  label: '최검사', role: '상사',       x: 82,  y: 194 },
];

const GRAPH_EDGES = [
  { from: 'hayun', to: 'sua',  label: '절친',    color: C.success,  t: 0.44, ox:  0,   oy: -13, dashed: false },
  { from: 'sua',   to: 'min',  label: '갈등/끌림', color: '#E25C5C', t: 0.50, ox:  6,   oy: -13, dashed: true  },
  { from: 'sua',   to: 'lena', label: '화해',    color: C.success,  t: 0.50, ox: 12,   oy:  12, dashed: false },
  { from: 'min',   to: 'lena', label: '법적 대립', color: C.warning,  t: 0.50, ox: -48,  oy:  0,  dashed: false },
  { from: 'choi',  to: 'min',  label: '상사-부하', color: C.t3,       t: 0.22, ox:  0,   oy:  13, dashed: false },
];

function RelationGraph() {
  const nodeMap = Object.fromEntries(GRAPH_NODES.map((n) => [n.id, n]));
  const R = 26;
  const LW = 70;

  return (
    <div style={{ background: C.bg, borderRadius: 8, border: `1px solid ${C.border}`, padding: '14px 16px 12px' }}>
      <svg viewBox="0 0 500 250" width="100%" style={{ display: 'block' }}>
        {Array.from({ length: 7 }, (_, r) =>
          Array.from({ length: 14 }, (_, c) => (
            <circle key={`${r}-${c}`} cx={18 + c * 35} cy={18 + r * 33} r={1.1} fill={C.border} opacity={0.45} />
          ))
        )}

        {GRAPH_EDGES.map((edge) => {
          const f = nodeMap[edge.from];
          const to = nodeMap[edge.to];
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
            <g key={`${edge.from}-${edge.to}`}>
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

        {GRAPH_NODES.map((node) => {
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
        {GRAPH_NODES.map((node) => {
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

const TL_EVENTS = [
  { ch: '1화', title: '수아 등장', desc: '주인공 세계 입문', type: 'normal' },
  { ch: '3화', title: '강민준 등장', desc: '수석검사 첫 서술', type: 'normal' },
  { ch: '23화', title: '갈색 눈 설정', desc: '핵심 외모 설정 확정', type: 'setting' },
  { ch: '47화', title: '법정 첫 만남', desc: '두 주인공 대면', type: 'normal' },
  { ch: '89화', title: '이레나 갈등 심화', desc: '대립 극한에 달함', type: 'conflict' },
  { ch: '142화', title: '이레나 화해', desc: '수아–이레나 화해 완료', type: 'resolved' },
  { ch: '158화', title: 'DB 최신화', desc: '분석 완료 상태', type: 'current' },
  { ch: '159화', title: '집필 중', desc: '충돌 감지 ⚠', type: 'writing' },
];
const TL_COLORS: Record<string, string> = {
  normal: C.t3, setting: C.primary, conflict: C.danger, resolved: C.success,
  current: C.primary, writing: C.warning,
};

function TimelineView() {
  return (
    <div style={{ background: C.bg, borderRadius: 8, border: `1px solid ${C.border}`, padding: '24px 20px', overflowX: 'auto' }}>
      <div style={{ minWidth: 680 }}>
        <div style={{ position: 'relative', height: 2, background: C.border, margin: '30px 24px 0', borderRadius: 1 }}>
          {TL_EVENTS.map((ev, i) => (
            <div key={i} style={{
              position: 'absolute', left: `${i / (TL_EVENTS.length - 1) * 100}%`,
              transform: 'translateX(-50%) translateY(-50%)',
              width: 12, height: 12, borderRadius: '50%',
              background: TL_COLORS[ev.type], border: `2px solid ${C.bg}`,
              boxShadow: `0 0 0 1.5px ${TL_COLORS[ev.type]}`,
            }} />
          ))}
        </div>
        <div style={{ display: 'flex', marginTop: 16 }}>
          {TL_EVENTS.map((ev, i) => {
            const color = TL_COLORS[ev.type];
            return (
              <div key={i} style={{
                flex: 1, padding: '0 4px',
                display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center',
              }}>
                <div style={{ padding: '2px 6px', borderRadius: 3, background: color + '18', border: `1px solid ${color}33`, color, fontSize: 10, fontWeight: 600, marginBottom: 5 }}>{ev.ch}</div>
                <div style={{ color: C.t1, fontSize: 12, fontWeight: 600, lineHeight: 1.3, marginBottom: 3 }}>{ev.title}</div>
                <div style={{ color: C.t3, fontSize: 10, lineHeight: 1.4 }}>{ev.desc}</div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

type WorldRuleItem = { text: string; src: string; conflict?: boolean };
const WORLD_RULES: { category: string; icon: React.ReactNode; color: string; items: WorldRuleItem[] }[] = [
  {
    category: '법정·수사 규칙',
    icon: <Scale size={13} />,
    color: C.warning,
    items: [
      { text: '검사는 피의자와 사적으로 접촉 불가', src: '3화' },
      { text: '증거 제출 기한은 공판 3일 전', src: '15화' },
      { text: '임용 전 검사는 독립 수사 권한 없음', src: '123화', conflict: true },
    ],
  },
  {
    category: '캐릭터 공통 설정',
    icon: <Users size={13} />,
    color: C.primary,
    items: [
      { text: '수아: 법학전문대학원 수석 졸업', src: '1화' },
      { text: '이레나: 수아와 같은 법무법인 출신', src: '8화' },
      { text: '강민준: 10년 경력의 냉혹한 검사', src: '5화' },
    ],
  },
  {
    category: '장소 설정',
    icon: <Globe size={13} />,
    color: C.success,
    items: [
      { text: '배경: 서울 중앙지방검찰청', src: '1화' },
      { text: '수아의 거주지: 을지로 14층 오피스텔', src: '7화' },
      { text: '주요 법정: 3호 법정 (분위기 서늘)', src: '3화' },
    ],
  },
];

function WorldRulesView() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {WORLD_RULES.map((cat) => (
        <div key={cat.category} style={{ background: C.bg, borderRadius: 8, border: `1px solid ${C.border}`, padding: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 12 }}>
            <span style={{ color: cat.color }}>{cat.icon}</span>
            <span style={{ color: cat.color, fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{cat.category}</span>
            <span style={{ color: C.t3, fontSize: 11 }}>({cat.items.length}개)</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
            {cat.items.map((item, i) => (
              <div key={i} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '7px 10px', borderRadius: 5,
                background: item.conflict ? C.danger + '0D' : C.surface,
                border: `1px solid ${item.conflict ? C.danger + '33' : C.border}`,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                  {item.conflict ? <AlertTriangle size={12} color={C.warning} /> : <div style={{ width: 5, height: 5, borderRadius: '50%', background: cat.color, flexShrink: 0 }} />}
                  <span style={{ color: item.conflict ? C.warning : C.t1, fontSize: 13 }}>{item.text}</span>
                </div>
                <span style={{
                  padding: '1px 6px', borderRadius: 3, fontSize: 10, fontWeight: 500, flexShrink: 0,
                  background: item.conflict ? C.warning + '22' : C.border,
                  color: item.conflict ? C.warning : C.t3,
                  border: `1px solid ${item.conflict ? C.warning + '44' : 'transparent'}`,
                }}>{item.src}</span>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

type NavId = 'works' | 'settingDB' | 'reports' | 'graph';
type SettingTabId = 'characters' | 'relations' | 'timeline' | 'worldrules';

export default function S1Dashboard({ navigate }: Props) {
  const [activeNav, setActiveNav] = useState<NavId>('works');
  const [settingTab, setSettingTab] = useState<SettingTabId>('characters');
  const [selectedWork, setSelectedWork] = useState<'detective' | 'murim'>('detective');
  const [showUpload, setShowUpload] = useState<false | 'settings' | 'episode'>(false);
  const [episodeTargetWork, setEpisodeTargetWork] = useState('');

  const goToSettingDB = () => {
    setSelectedWork('detective');
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
          <div style={{ padding: '0 20px 10px', color: C.t3, fontSize: 10, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase' }}>워크스페이스</div>
          <NavItem icon={<BookMarked size={14} />} label="내 작품" active={activeNav === 'works'} badge="2" onClick={() => setActiveNav('works')} />
          <NavItem icon={<BookOpen size={14} />} label="설정 DB" active={activeNav === 'settingDB'} onClick={() => setActiveNav('settingDB')} />
          <NavItem icon={<BarChart3 size={14} />} label="분석 리포트" active={activeNav === 'reports'} badge="3" onClick={() => setActiveNav('reports')} />
          <NavItem icon={<Network size={14} />} label="그래프 뷰" active={activeNav === 'graph'} onClick={() => setActiveNav('graph')} />
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
            {activeNav === 'works' && (
              <motion.div key="works" initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }}
                style={{ flex: 1, padding: '32px 40px', overflowY: 'auto' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 28 }}>
                  <span style={{ color: C.t1, fontSize: 20, fontWeight: 700, letterSpacing: '-0.5px' }}>내 작품</span>
                  <BtnP label="새 작품 등록" onClick={() => setShowUpload('settings')} icon={<Plus size={14} />} />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, maxWidth: 860, marginBottom: 28 }}>
                  <WorkCard title="빛나는 검사 로맨스" genre="로맨스" chapters={158} conflicts={5} hasConflict lastUpdated="2시간 전"
                    selected={selectedWork === 'detective'}
                    onClick={() => setSelectedWork('detective')}
                    onReport={() => navigate('S5', 'push-right')}
                    onEditor={() => navigate('S2', 'push-right')}
                    onEpisode={() => { setEpisodeTargetWork('빛나는 검사 로맨스'); setShowUpload('episode'); }}
                  />
                  <WorkCard title="무협지존" genre="무협" chapters={42} conflicts={0} hasConflict={false}
                    selected={selectedWork === 'murim'}
                    onClick={() => setSelectedWork('murim')}
                    onEditor={() => navigate('S2', 'push-right')}
                    onEpisode={() => { setEpisodeTargetWork('무협지존'); setShowUpload('episode'); }}
                  />
                </div>

                {selectedWork === 'detective' && (
                  <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} style={{ maxWidth: 860 }}>
                    <div style={{
                      background: C.surface, borderRadius: 8, border: `1px solid ${C.border}`,
                      padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    }}>
                      <div style={{ display: 'flex', gap: 28 }}>
                        {[
                          { icon: <Users size={13} />, label: '캐릭터', value: '5명' },
                          { icon: <BookOpen size={13} />, label: '설정 항목', value: '23개' },
                          { icon: <GitBranch size={13} />, label: '관계 엣지', value: '8개' },
                          { icon: <Clock size={13} />, label: '타임라인', value: '14개' },
                          { icon: <OctagonAlert size={13} />, label: '탐지 오류', value: '5건', color: C.danger },
                        ].map((item) => (
                          <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <span style={{ color: C.t3 }}>{item.icon}</span>
                            <span style={{ color: C.t3, fontSize: 12 }}>{item.label}</span>
                            <span style={{ color: (item as { color?: string }).color || C.t1, fontSize: 13, fontWeight: 600 }}>{item.value}</span>
                          </div>
                        ))}
                      </div>
                      <button onClick={goToSettingDB} style={{
                        display: 'flex', alignItems: 'center', gap: 5,
                        background: 'none', border: 'none', color: C.primary, fontSize: 13,
                        cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600,
                      }}>
                        설정 DB 보기 <ChevronRight size={14} />
                      </button>
                    </div>
                  </motion.div>
                )}

                <div style={{ display: 'flex', gap: 14, marginTop: 24, maxWidth: 860 }}>
                  {[
                    { label: '전체 작품', value: '2', sub: '등록됨' },
                    { label: '이번 주 오류', value: '5', sub: '탐지됨', color: C.danger },
                    { label: '이달 분석', value: '14', sub: '회 실행' },
                    { label: '설정 항목', value: '47', sub: '총 등록' },
                  ].map((s) => (
                    <div key={s.label} style={{
                      flex: 1, background: C.surface, border: `1px solid ${C.border}`,
                      borderRadius: 8, padding: '14px 18px',
                    }}>
                      <div style={{ color: C.t3, fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>{s.label}</div>
                      <div style={{ color: (s as { color?: string }).color || C.t1, fontSize: 22, fontWeight: 700, marginBottom: 2 }}>{s.value}</div>
                      <div style={{ color: C.t3, fontSize: 12 }}>{s.sub}</div>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}

            {activeNav === 'settingDB' && (
              <motion.div key="settingDB" initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }}
                style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                <div style={{
                  padding: '20px 40px', borderBottom: `1px solid ${C.border}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0,
                }}>
                  <div>
                    <div style={{ color: C.t3, fontSize: 12, marginBottom: 4 }}>설정 대시보드</div>
                    <div style={{ color: C.t1, fontSize: 18, fontWeight: 700, letterSpacing: '-0.4px' }}>
                      빛나는 검사 로맨스
                      <span style={{ marginLeft: 8, padding: '2px 8px', borderRadius: 4, background: C.primary + '18', color: C.primary, fontSize: 12, fontWeight: 500, border: `1px solid ${C.primary}33`, verticalAlign: 'middle' }}>로맨스</span>
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
                      <motion.div key="chars" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14, maxWidth: 860 }}>
                          <CharCard name="수아" role="주인공" age={23} eyes="갈색 ⚠" job="검사 지망생" chapter={1} eyeConflict colorKey="sua" />
                          <CharCard name="강민준" role="남자주인공" age={32} eyes="짙은갈색" job="수석검사" chapter={3} colorKey="min" />
                          <CharCard name="이레나" role="라이벌/화해" age={28} eyes="흑색" job="변호사" chapter={12} colorKey="lena" />
                          <CharCard name="하윤" role="절친" age={23} eyes="밝은갈색" job="대학원생" chapter={2} colorKey="hayun" />
                          <CharCard name="최 검사" role="상사" age={45} eyes="―" job="검사장" chapter={5} colorKey="choi" />
                          <div style={{
                            background: C.bg, borderRadius: 8, border: `2px dashed ${C.border}`,
                            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                            gap: 8, cursor: 'pointer', minHeight: 160,
                          }}>
                            <Plus size={20} color={C.t3} />
                            <span style={{ color: C.t3, fontSize: 13 }}>캐릭터 추가</span>
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
                        <div style={{ color: C.t3, fontSize: 13, marginBottom: 16 }}>캐릭터 간 관계를 그래프로 시각화합니다. 회차에 따른 관계 변화를 추적합니다.</div>
                        <RelationGraph />
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
                      <motion.div key="wr" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} style={{ maxWidth: 860 }}>
                        <div style={{ color: C.t3, fontSize: 13, marginBottom: 16 }}>작품 고유의 세계관 규칙입니다. 노란 항목은 현재 원고에서 위반이 감지된 규칙입니다.</div>
                        <WorldRulesView />
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </motion.div>
            )}

            {activeNav === 'reports' && (
              <motion.div key="reports" initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }}
                style={{ flex: 1, padding: '32px 40px', overflowY: 'auto' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
                  <span style={{ color: C.t1, fontSize: 20, fontWeight: 700, letterSpacing: '-0.5px' }}>분석 리포트</span>
                  <BtnG label="전체 내보내기" icon={<Scroll size={12} />} />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxWidth: 760 }}>
                  {[
                    { work: '빛나는 검사 로맨스', chapter: '159화', count: 5, severity: '심각 1건', date: '오늘', onClick: () => navigate('S5', 'push-right') },
                    { work: '빛나는 검사 로맨스', chapter: '158화', count: 2, severity: '주의 2건', date: '3일 전', onClick: undefined },
                    { work: '무협지존', chapter: '42화', count: 0, severity: '오류 없음', date: '1주 전', onClick: undefined },
                    { work: '빛나는 검사 로맨스', chapter: '155화', count: 1, severity: '주의 1건', date: '2주 전', onClick: undefined },
                  ].map((item, i) => (
                    <div key={i} onClick={item.onClick} style={{
                      background: C.surface, borderRadius: 8, border: `1px solid ${C.border}`,
                      padding: '14px 18px', display: 'flex', alignItems: 'center',
                      justifyContent: 'space-between', cursor: item.onClick ? 'pointer' : 'default',
                      transition: 'border-color 0.15s',
                    }}
                      onMouseEnter={(e) => item.onClick && (e.currentTarget.style.borderColor = '#3A3A4A')}
                      onMouseLeave={(e) => (e.currentTarget.style.borderColor = C.border)}
                    >
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
                        {item.onClick && <ChevronRight size={14} color={C.t3} />}
                      </div>
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
        {showUpload !== false && (
          <UploadModal
            onClose={() => setShowUpload(false)}
            mode={showUpload}
            initialWork={episodeTargetWork}
            navigate={navigate}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
