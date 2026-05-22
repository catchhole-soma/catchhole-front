import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { C, NavigateFn } from './constants';
import {
  BookOpen, Users, GitBranch, Clock, Globe, BarChart3,
  Settings, Shield, OctagonAlert, AlertTriangle, Plus,
  Upload, ChevronRight, Activity, Scale, Scroll,
  BookMarked, FileText, Check, CircleCheckBig, Network,
  Eye, EyeOff, Trash2, X, Sparkles, Lock, LockOpen, Search,
} from 'lucide-react';
import { GraphView } from './GraphView';

interface Props { navigate: NavigateFn; onPrePublish?: () => void; }

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
                placeholder="160" type="number" min="1"
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
            borderRadius: 5, border: `1px solid ${C.danger}44`, background: C.danger + '08',
          }}>
            <span style={{ color: C.danger + 'BB', letterSpacing: 3, fontSize: 11 }}>●●●●●</span>
            {/* 👁 임시 열람 — isSpoiler 변경 없이 내용만 확인 */}
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

// ── CharCardDynamic (CharacterSetting 기반, 클릭 수정 가능) ──
function CharCardDynamic({ setting, onEdit }: { setting: CharacterSetting; onEdit: () => void }) {
  const [hovered, setHovered] = useState(false);
  const color = CHAR_COLORS[setting.id] || C.primary;
  const get = (label: string) =>
    setting.entries.find(e => e.label.includes(label))?.content || '—';

  const rows = ['나이', '눈', '직업', '첫등장'].map(k => ({ k, v: get(k) })).filter(r => r.v !== '—');
  const role = get('역할');

  return (
    <div
      onClick={onEdit}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: C.bg, borderRadius: 8,
        border: `1px solid ${hovered ? color + '88' : C.border}`,
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
              <span style={{ color: C.t2, fontSize: 12 }}>{item.v}</span>
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

const SEARCH_DATA = [
  { cat: '캐릭터', title: '수아', sub: '눈 색깔 · 갈색', src: '1화', catColor: '#7C5CFC' },
  { cat: '캐릭터', title: '강민준', sub: '직업 · 수석검사', src: '3화', catColor: '#7C5CFC' },
  { cat: '캐릭터', title: '이레나', sub: '역할 · 라이벌/화해', src: '12화', catColor: '#7C5CFC' },
  { cat: '아이템', title: '증거 봉투', sub: '소유 · 강민준', src: '47화', catColor: '#F4A261' },
  { cat: '아이템', title: '법원 영장', sub: '종류 · 서류', src: '89화', catColor: '#F4A261' },
  { cat: '스킬', title: '반대심문', sub: '사용 · 수아, 강민준', src: '89화', catColor: '#00C896' },
  { cat: '스킬', title: '증거 제출', sub: '사용 조건 · 공판 개시 후', src: '47화', catColor: '#00C896' },
  { cat: '세계관', title: '검사 사적 접촉 금지', sub: '규칙 위반 시 충돌 감지', src: '3화', catColor: '#4BB8D9' },
  { cat: '타임라인', title: '이레나 갈등 심화', sub: '89화 대립 극한', src: '89화', catColor: '#FF4D4D' },
  { cat: '타임라인', title: '이레나 화해', sub: '142화 화해 완료', src: '142화', catColor: '#FF4D4D' },
];

const SEARCH_CATS = ['전체', '캐릭터', '아이템', '스킬', '세계관', '타임라인'] as const;

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
type SettingTabId = 'characters' | 'relations' | 'timeline' | 'worldrules' | 'search';

export default function S1Dashboard({ navigate, onPrePublish }: Props) {
  const [activeNav, setActiveNav] = useState<NavId>('works');
  const [settingTab, setSettingTab] = useState<SettingTabId>('characters');
  const [selectedWork, setSelectedWork] = useState<'detective' | 'murim'>('detective');
  const [showUpload, setShowUpload] = useState<false | 'settings' | 'episode'>(false);
  const [episodeTargetWork, setEpisodeTargetWork] = useState('');
  const [showBuilder, setShowBuilder] = useState(false);
  const [chars, setChars] = useState<CharacterSetting[]>(INIT_CHARS);
  const [editTarget, setEditTarget] = useState<CharacterSetting | null>(null);

  const handleCharSave = (s: CharacterSetting) => {
    setChars(prev => {
      const idx = prev.findIndex(c => c.id === s.id);
      return idx >= 0 ? prev.map(c => c.id === s.id ? s : c) : [...prev, s];
    });
  };

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
                      <motion.div key="chars" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14, maxWidth: 860 }}>
                          {chars.map(s => (
                            <CharCardDynamic key={s.id} setting={s} onEdit={() => setEditTarget(s)} />
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

                    {settingTab === 'search' && (
                      <motion.div key="search" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} style={{ maxWidth: 900 }}>
                        <SearchView />
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
                  <div style={{ display: 'flex', gap: 8 }}>
                    <BtnG label="발행 전 검수" onClick={onPrePublish} icon={<Shield size={12} />} />
                    <BtnG label="전체 내보내기" icon={<Scroll size={12} />} />
                  </div>
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
