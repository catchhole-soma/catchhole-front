import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router';
import { AnimatePresence, motion } from 'motion/react';
import { C, EditorMode } from './constants';
import { useAppNavigate } from '../../hooks/useAppNavigate';
import { useAppContext } from '../../context/AppContext';
import {
  ChevronLeft, CircleCheckBig, AlertTriangle, BookOpen,
  Clock, Sparkles, Play, Pause, RotateCcw, Scan, Zap, Share2, Eye,
} from 'lucide-react';
import { ShareModal } from './ShareModal';
import { UserMenu } from './UserMenu';

interface Props {
  mode?: EditorMode;
}

const DEMO_SCRIPT =
  `제159화. 운명의 실타래\n\n` +
  `이레나가 법정에 들어서는 순간, 방청석 전체가 숨을 죽였다. 그녀의 존재감은\n` +
  `언제나 공간을 압도했다. 붉은 립스틱과 날카로운 눈매는 수십 번의 재판에서도\n` +
  `결코 흐트러진 적이 없었다.\n\n` +
  `강민준은 서류를 내려놓으며 피고인석 쪽으로 시선을 옮겼다. 그의 표정에서\n` +
  `감정을 읽기란 거의 불가능했다. 검사로서의 세월이 그를 그렇게 만들었다.\n\n` +
  `수아는 천천히 고개를 들었다. 햇살이 창문을 통해 쏟아지며 그녀의 파란 눈을\n` +
  `가득 채웠다. 검찰청 복도는 언제나처럼 차갑고 조용했다.\n\n` +
  `강민준의 시선이 그녀에게 잠시 머물렀다. 그는 아무 말 없이 서류를 한 장\n` +
  `넘겼다. 재판장이 기침을 한 번 했다.\n\n` +
  `"피고인은 당일 오후 몇 시에 현장을 떠났습니까?"\n\n` +
  `이레나가 자리에서 일어섰다. 그녀의 구두 소리가 대리석 바닥을 울렸다.\n` +
  `방청석 어딘가에서 카메라 셔터 소리가 들렸다.`;

const SCAN_START_IDX = DEMO_SCRIPT.indexOf('파란');
const CONFLICT_END_IDX = DEMO_SCRIPT.indexOf('파란 눈') + '파란 눈'.length;

function HighlightedText({ text, tooltip }: { text: string; tooltip: string }) {
  const [show, setShow] = useState(false);
  return (
    <span
      style={{ position: 'relative', display: 'inline' }}
      onMouseEnter={() => setShow(true)}
      onMouseLeave={() => setShow(false)}
    >
      <span style={{ color: C.warning, borderBottom: `1.5px dashed ${C.warning}`, cursor: 'pointer', paddingBottom: 1 }}>
        {text}
      </span>
      <AnimatePresence>
        {show && (
          <motion.div
            initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 4 }} transition={{ duration: 0.12 }}
            style={{
              position: 'absolute', bottom: '130%', left: '50%',
              transform: 'translateX(-50%)', background: C.surface,
              border: `1px solid ${C.border}`, borderRadius: 6,
              padding: '6px 12px', fontSize: 12, color: C.warning,
              whiteSpace: 'nowrap', zIndex: 200,
              boxShadow: '0 4px 16px rgba(0,0,0,0.5)', pointerEvents: 'none',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <AlertTriangle size={11} color={C.warning} />{tooltip}
            </div>
            <div style={{
              position: 'absolute', bottom: -5, left: '50%', transform: 'translateX(-50%)',
              width: 8, height: 8, background: C.surface, border: `1px solid ${C.border}`,
              borderTop: 'none', borderLeft: 'none', rotate: '45deg',
            }} />
          </motion.div>
        )}
      </AnimatePresence>
    </span>
  );
}

function S3Modal({ onStart, onCancel }: { onStart: () => void; onCancel: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }} onClick={onCancel}
      style={{
        position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.6)',
        zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
    >
      <motion.div
        initial={{ y: 40, opacity: 0 }} animate={{ y: 0, opacity: 1, transition: { duration: 0.25, ease: 'easeOut' } }}
        exit={{ y: 20, opacity: 0, transition: { duration: 0.2 } }}
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 480, background: C.surface, borderRadius: 12,
          border: `1px solid ${C.border}`, padding: 32,
          boxShadow: '0 20px 60px rgba(0,0,0,0.6)',
        }}
      >
        <div style={{ color: C.t1, fontSize: 18, fontWeight: 700, marginBottom: 8, letterSpacing: '-0.4px' }}>
          159화 분석 요청
        </div>
        <div style={{ color: C.t2, fontSize: 14, marginBottom: 24 }}>기존 158개 회차 설정 DB와 대조합니다</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 24 }}>
          {['캐릭터 설정 대조', '타임라인 검증', '관계도 확인'].map((item) => (
            <div key={item} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <CircleCheckBig size={16} color={C.primary} />
              <span style={{ color: C.t1, fontSize: 14 }}>{item}</span>
            </div>
          ))}
        </div>
        <button onClick={onStart} style={{
          width: '100%', height: 40, borderRadius: 6, background: C.primary,
          border: 'none', color: C.t1, fontSize: 14, fontWeight: 600,
          cursor: 'pointer', fontFamily: 'inherit', transition: 'opacity 0.15s', marginBottom: 8,
        }}
          onMouseEnter={(e) => (e.currentTarget.style.opacity = '0.85')}
          onMouseLeave={(e) => (e.currentTarget.style.opacity = '1')}
        >분석 시작</button>
        <button onClick={onCancel} style={{
          width: '100%', height: 40, borderRadius: 6, background: 'transparent',
          border: `1px solid ${C.border}`, color: C.t2, fontSize: 14,
          cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.15s',
        }}
          onMouseEnter={(e) => { e.currentTarget.style.background = '#1F1F2A'; e.currentTarget.style.borderColor = '#3A3A4A'; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderColor = C.border; }}
        >취소</button>
      </motion.div>
    </motion.div>
  );
}

type DetectionPhase = 'none' | 'scanning' | 'detected';

function RightPanelContent({
  detectionPhase, intentional, setIntentional, onRunAnalysis, demoPhase,
}: {
  detectionPhase: DetectionPhase;
  intentional: boolean;
  setIntentional: (v: boolean) => void;
  onRunAnalysis: () => void;
  demoPhase: 'idle' | 'playing' | 'paused' | 'done';
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14, flex: 1 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ color: C.t2, fontSize: 13, fontWeight: 600, letterSpacing: '-0.2px' }}>설정 변경 감지</span>
        <AnimatePresence mode="wait">
          {(detectionPhase === 'detected' || demoPhase === 'idle') ? (
            <motion.span key="badge-detected"
              initial={{ scale: 0.7, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
              style={{
                padding: '2px 7px', borderRadius: 10, background: '#3D1515',
                color: C.danger, fontSize: 11, fontWeight: 600,
                border: `1px solid ${C.danger}44`,
              }}>
              충돌 1건
            </motion.span>
          ) : detectionPhase === 'scanning' ? (
            <motion.span key="badge-scanning"
              animate={{ opacity: [1, 0.4, 1] }} transition={{ duration: 1, repeat: Infinity }}
              style={{
                padding: '2px 7px', borderRadius: 10, background: C.warning + '1A',
                color: C.warning, fontSize: 11, fontWeight: 600,
                border: `1px solid ${C.warning}44`, display: 'flex', alignItems: 'center', gap: 4,
              }}>
              <motion.span
                animate={{ rotate: 360 }} transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }}
                style={{ display: 'inline-block', fontSize: 11 }}
              >⟳</motion.span>
              스캔 중
            </motion.span>
          ) : (
            <motion.span key="badge-idle"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              style={{
                padding: '2px 7px', borderRadius: 10, background: C.success + '1A',
                color: C.success, fontSize: 11, fontWeight: 500,
                border: `1px solid ${C.success}44`,
              }}>
              이상 없음
            </motion.span>
          )}
        </AnimatePresence>
      </div>

      <AnimatePresence>
        {detectionPhase === 'scanning' && (
          <motion.div
            key="scanning-panel"
            initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.2 }}
            style={{
              background: C.bg, borderRadius: 6, border: `1px solid ${C.warning}33`,
              borderLeft: `3px solid ${C.warning}`, padding: '14px',
              display: 'flex', flexDirection: 'column', gap: 10,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <motion.div
                animate={{ scale: [1, 1.3, 1], opacity: [0.7, 1, 0.7] }}
                transition={{ duration: 0.9, repeat: Infinity }}
                style={{ width: 8, height: 8, borderRadius: '50%', background: C.warning, flexShrink: 0 }}
              />
              <div>
                <div style={{ color: C.t3, fontSize: 11 }}>설정 대조 중</div>
                <div style={{ color: C.warning, fontSize: 13, fontWeight: 600 }}>수아 · 눈 색 확인 중...</div>
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {[0, 0.15, 0.3].map((delay, i) => (
                <motion.div key={i}
                  animate={{ scaleX: [0.3, 1, 0.3], opacity: [0.3, 0.7, 0.3] }}
                  transition={{ duration: 1.2, repeat: Infinity, delay }}
                  style={{
                    height: 3, background: C.warning + '55', borderRadius: 2,
                    transformOrigin: 'left',
                  }}
                />
              ))}
            </div>
            <div style={{ color: C.t3, fontSize: 11, lineHeight: 1.5 }}>
              158화 설정 DB와 대조 중...
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {detectionPhase === 'none' && demoPhase !== 'idle' && (
          <motion.div key="none-panel"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            style={{
              background: C.bg, borderRadius: 6, border: `1px solid ${C.border}`,
              padding: '14px', display: 'flex', flexDirection: 'column', gap: 8,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Scan size={14} color={C.t3} />
              <span style={{ color: C.t3, fontSize: 13 }}>실시간 감지 대기 중</span>
            </div>
            <div style={{ color: C.t3, fontSize: 11, lineHeight: 1.5 }}>
              원고가 작성되는 동안 설정 DB와 지속적으로 대조합니다.
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 2 }}>
              {['캐릭터 설정', '타임라인', '관계 상태'].map((item, i) => (
                <div key={item} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <motion.div
                    animate={{ opacity: [0.3, 0.8, 0.3] }}
                    transition={{ duration: 1.5, repeat: Infinity, delay: i * 0.4 }}
                    style={{ width: 5, height: 5, borderRadius: '50%', background: C.t3 }}
                  />
                  <span style={{ color: C.t3, fontSize: 11 }}>{item} 모니터링 중</span>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {(detectionPhase === 'detected' || demoPhase === 'idle') && (
          <motion.div key="conflict-card"
            initial={detectionPhase === 'detected' && demoPhase !== 'idle' ? { x: 24, opacity: 0 } : false}
            animate={{ x: 0, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 260, damping: 24 }}
          >
            <div style={{
              background: C.bg, borderRadius: 6,
              border: `1px solid ${C.border}`, borderLeft: `3px solid ${C.danger}`,
              overflow: 'hidden', position: 'relative',
            }}>
              <div style={{ padding: '11px 13px', borderBottom: `1px solid ${C.border}` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <div>
                    <div style={{ color: C.t3, fontSize: 11, marginBottom: 3 }}>수아 · 눈 색</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ color: C.success, fontSize: 12, fontWeight: 600 }}>갈색</span>
                      <span style={{ color: C.t3, fontSize: 12 }}>→</span>
                      <span style={{ color: C.danger, fontSize: 12, fontWeight: 600 }}>파란색</span>
                    </div>
                  </div>
                  <span style={{
                    padding: '2px 6px', borderRadius: 4, background: '#3D1515',
                    color: C.danger, fontSize: 11, fontWeight: 500,
                    border: `1px solid ${C.danger}44`,
                  }}>
                    충돌
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ color: C.t3, fontSize: 12 }}>의도적 변경?</span>
                  <div onClick={() => setIntentional(!intentional)} style={{
                    width: 34, height: 19, borderRadius: 10,
                    background: intentional ? C.primary : C.t3 + '40',
                    cursor: 'pointer', position: 'relative', transition: 'background 0.2s', flexShrink: 0,
                  }}>
                    <div style={{
                      position: 'absolute', top: 1.5, left: intentional ? 16 : 1.5,
                      width: 16, height: 16, borderRadius: '50%', background: '#fff',
                      transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
                    }} />
                  </div>
                </div>
              </div>

              <div style={{ padding: '11px 13px', borderBottom: `1px solid ${C.border}` }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 7 }}>
                  <BookOpen size={11} color={C.t3} />
                  <span style={{ color: C.t3, fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>원문 근거</span>
                  <span style={{ padding: '1px 6px', borderRadius: 3, background: C.surface, border: `1px solid ${C.border}`, color: C.t3, fontSize: 10 }}>23화 3문단</span>
                </div>
                <div style={{ background: C.surface, borderRadius: '0 5px 5px 0', borderLeft: `2px solid ${C.success}`, padding: '8px 11px', fontSize: 12, lineHeight: 1.75, color: C.t2, fontStyle: 'italic' }}>
                  <span style={{ color: C.t3 }}>"</span>
                  수아가 천천히 고개를 들었다. 그 순간, 그녀의{' '}
                  <mark style={{ background: C.success + '22', color: C.success, padding: '1px 2px', borderRadius: 2, fontStyle: 'normal', fontWeight: 700 }}>갈색 눈동자</mark>
                  {' '}가 형광등 불빛에 반짝였다.
                  <span style={{ color: C.t3 }}>"</span>
                </div>
              </div>

              <div style={{ padding: '11px 13px', borderBottom: `1px solid ${C.border}` }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 7 }}>
                  <span style={{ color: C.t3, fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>현재 원고</span>
                  <span style={{ padding: '1px 6px', borderRadius: 3, background: '#3D1515', border: `1px solid ${C.danger}44`, color: C.danger, fontSize: 10 }}>159화 7행</span>
                </div>
                <div style={{ background: '#1C1010', borderRadius: '0 5px 5px 0', borderLeft: `2px solid ${C.danger}`, padding: '8px 11px', fontSize: 12, lineHeight: 1.75, color: C.t2, fontStyle: 'italic' }}>
                  <span style={{ color: C.t3 }}>"</span>
                  햇살이 창문을 통해 쏟아지며 그녀의{' '}
                  <mark style={{ background: C.danger + '22', color: C.danger, padding: '1px 2px', borderRadius: 2, fontStyle: 'normal', fontWeight: 700 }}>파란 눈</mark>
                  {' '}을 가득 채웠다.
                  <span style={{ color: C.t3 }}>"</span>
                </div>
              </div>

              <div style={{ padding: '10px 13px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 8 }}>
                  <Clock size={11} color={C.t3} />
                  <span style={{ color: C.t3, fontSize: 11, fontWeight: 600 }}>등장 이력 (4회)</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                  {[
                    { chap: '1화', text: '"갈색 눈이 반짝였다."', ok: true },
                    { chap: '23화', text: '"갈색 눈동자가 반짝였다."', ok: true },
                    { chap: '89화', text: '"갈색 눈동자에 슬픔이."', ok: true },
                    { chap: '159화', text: '"파란 눈을 채웠다."', ok: false },
                  ].map((item) => (
                    <div key={item.chap} style={{
                      display: 'flex', alignItems: 'flex-start', gap: 6,
                      padding: '5px 8px', borderRadius: 4,
                      background: item.ok ? 'transparent' : '#1C0E0E',
                      border: `1px solid ${item.ok ? C.border : C.danger + '33'}`,
                    }}>
                      <span style={{ flexShrink: 0, padding: '1px 5px', borderRadius: 3, background: item.ok ? C.success + '1A' : '#3D1515', color: item.ok ? C.success : C.danger, fontSize: 10, fontWeight: 600 }}>{item.chap}</span>
                      <span style={{ color: C.t2, fontSize: 11, fontStyle: 'italic', lineHeight: 1.5 }}>{item.text}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {(detectionPhase === 'detected' || demoPhase === 'idle') && (
          <motion.div key="ai-sug"
            initial={detectionPhase === 'detected' && demoPhase !== 'idle' ? { opacity: 0, y: 6 } : false}
            animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
            style={{ background: C.primary + '0D', border: `1px solid ${C.primary}33`, borderRadius: 6, padding: '10px 12px' }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 6 }}>
              <Sparkles size={12} color={C.primary} />
              <span style={{ color: C.primary, fontSize: 11, fontWeight: 600 }}>AI 제안</span>
            </div>
            <div style={{ color: C.t2, fontSize: 12, lineHeight: 1.65 }}>
              <span style={{ color: C.danger }}>"파란 눈"</span> →{' '}
              <span style={{ color: C.success }}>"갈색 눈동자"</span>로 수정하거나 설정 DB를 업데이트하세요.
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <button onClick={onRunAnalysis} style={{
        height: 36, borderRadius: 6, background: C.primary + '1A',
        border: `1px solid ${C.primary}44`, color: C.primary, fontSize: 13,
        cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.15s', marginTop: 'auto',
      }}
        onMouseEnter={(e) => (e.currentTarget.style.background = C.primary + '2A')}
        onMouseLeave={(e) => (e.currentTarget.style.background = C.primary + '1A')}
      >
        전체 분석 실행
      </button>

      {demoPhase === 'idle' && (
        <div>
          <div style={{ color: C.t3, fontSize: 11, fontWeight: 600, marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>최근 감지 내역</div>
          {[
            { time: '방금 전', text: '수아 눈 색 변경', color: C.danger },
            { time: '1시간 전', text: '강민준 나이 오류', color: C.warning },
          ].map((item) => (
            <div key={item.time} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: `1px solid ${C.border}` }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <div style={{ width: 5, height: 5, borderRadius: '50%', background: item.color, flexShrink: 0 }} />
                <span style={{ color: C.t2, fontSize: 12 }}>{item.text}</span>
              </div>
              <span style={{ color: C.t3, fontSize: 11 }}>{item.time}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function EditorText({ text, detectionPhase, showCursor }: {
  text: string;
  detectionPhase: DetectionPhase;
  showCursor: boolean;
}) {
  const lines = text.split('\n');
  const conflictPhrase = '파란 눈';

  return (
    <>
      {lines.map((line, lineIdx) => {
        const isLast = lineIdx === lines.length - 1;
        const ciIdx = line.indexOf(conflictPhrase);
        const showHighlight = ciIdx !== -1 && detectionPhase !== 'none';

        return (
          <div key={lineIdx} style={{ minHeight: '1.8em', lineHeight: '1.8' }}>
            {showHighlight ? (
              <>
                {line.slice(0, ciIdx)}
                <HighlightedText text={conflictPhrase} tooltip="23화: 갈색 눈으로 설정됨" />
                {line.slice(ciIdx + conflictPhrase.length)}
              </>
            ) : line}
            {isLast && showCursor && (
              <motion.span
                animate={{ opacity: [1, 0, 1] }}
                transition={{ duration: 1, repeat: Infinity }}
                style={{
                  display: 'inline-block', width: 2, height: '0.9em',
                  background: C.primary, borderRadius: 1,
                  marginLeft: 2, verticalAlign: 'text-top',
                }}
              />
            )}
          </div>
        );
      })}
    </>
  );
}

export default function S2Editor() {
  const navigate = useAppNavigate();
  const { editorMode, setEditorMode } = useAppContext();
  const mode = editorMode;
  const isViewMode = mode === 'view';
  const [searchParams, setSearchParams] = useSearchParams();
  const showModal = searchParams.get('modal') === 'analysis-request';
  const setShowModal = (show: boolean) => setSearchParams(prev => {
    if (show) prev.set('modal', 'analysis-request'); else prev.delete('modal');
    return prev;
  });
  const [showShare, setShowShare] = useState(false);
  const [intentional, setIntentional] = useState(false);
  const [activePill, setActivePill] = useState('수아');

  const [demoPhase, setDemoPhase] = useState<'idle' | 'playing' | 'paused' | 'done'>('idle');
  const [typedText, setTypedText] = useState('');
  const [detectionPhase, setDetectionPhase] = useState<DetectionPhase>('none');

  const idxRef = useRef(0);
  const demoActiveRef = useRef(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const detectionTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stepRef = useRef<() => void>(() => {});

  const clearTimeout_ = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    if (detectionTimeoutRef.current) clearTimeout(detectionTimeoutRef.current);
  };

  stepRef.current = () => {
    if (!demoActiveRef.current) return;

    const idx = idxRef.current;
    if (idx >= DEMO_SCRIPT.length) {
      setDemoPhase('done');
      demoActiveRef.current = false;
      return;
    }

    const newText = DEMO_SCRIPT.slice(0, idx + 1);
    setTypedText(newText);
    idxRef.current = idx + 1;

    if (idx + 1 === CONFLICT_END_IDX) {
      detectionTimeoutRef.current = setTimeout(() => {
        setDetectionPhase('scanning');
        detectionTimeoutRef.current = setTimeout(() => {
          setDetectionPhase('detected');
        }, 1200);
      }, 3000);
    }

    const inConflictZone = idx >= SCAN_START_IDX && idx < CONFLICT_END_IDX;
    const delay = inConflictZone ? 110 : 28;
    timeoutRef.current = setTimeout(stepRef.current, delay);
  };

  const startDemo = () => {
    clearTimeout_();
    idxRef.current = 0;
    demoActiveRef.current = true;
    setTypedText('');
    setDemoPhase('playing');
    setDetectionPhase('none');
    timeoutRef.current = setTimeout(stepRef.current, 150);
  };

  const pauseDemo = () => {
    clearTimeout_();
    demoActiveRef.current = false;
    setDemoPhase('paused');
  };

  const resumeDemo = () => {
    demoActiveRef.current = true;
    setDemoPhase('playing');
    timeoutRef.current = setTimeout(stepRef.current, 100);
  };

  const resetDemo = () => {
    clearTimeout_();
    demoActiveRef.current = false;
    setDemoPhase('idle');
    setTypedText('');
    setDetectionPhase('none');
    idxRef.current = 0;
  };

  useEffect(() => () => clearTimeout_(), []);

  const handleAnalysisStart = () => {
    setShowModal(false);
    navigate('/loading', 'dissolve');
  };

  const isPlaying = demoPhase === 'playing';
  const demoActive = demoPhase !== 'idle';

  return (
    <div style={{
      background: C.bg, width: '100%', height: '100%',
      display: 'flex', flexDirection: 'column',
      fontFamily: "'Pretendard Variable', 'Pretendard', 'Apple SD Gothic Neo', -apple-system, sans-serif",
      position: 'relative', overflow: 'hidden',
    }}>
      <div style={{
        height: 56, background: C.bg, borderBottom: `1px solid ${C.border}`,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 20px', flexShrink: 0, zIndex: 10,
      }}>
        <button onClick={() => navigate('/dashboard', 'pop')} style={{
          display: 'flex', alignItems: 'center', gap: 6, background: 'none',
          border: 'none', color: C.t2, cursor: 'pointer', fontSize: 13,
          padding: '4px 8px', borderRadius: 4, fontFamily: 'inherit', transition: 'color 0.15s',
        }}
          onMouseEnter={(e) => (e.currentTarget.style.color = C.t1)}
          onMouseLeave={(e) => (e.currentTarget.style.color = C.t2)}
        >
          <ChevronLeft size={16} /><span>뒤로</span>
        </button>

        <span style={{ color: C.t2, fontSize: 14, position: 'absolute', left: '50%', transform: 'translateX(-50%)' }}>
          빛나는 검사 로맨스 — 159화 작성
        </span>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {isViewMode ? (
            <button onClick={() => setEditorMode('edit')} style={{
              height: 36, padding: '0 12px', borderRadius: 6,
              background: 'transparent', border: `1px solid ${C.border}`,
              color: C.t2, fontSize: 13, cursor: 'pointer',
              fontFamily: 'inherit', transition: 'all 0.15s',
              display: 'flex', alignItems: 'center', gap: 6,
            }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = C.primary; e.currentTarget.style.color = C.primary; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.color = C.t2; }}
            >
              <Eye size={13} />편집 모드
            </button>
          ) : (
            <button onClick={() => setEditorMode('view')} style={{
              height: 36, padding: '0 12px', borderRadius: 6,
              background: 'transparent', border: `1px solid ${C.border}`,
              color: C.t2, fontSize: 13, cursor: 'pointer',
              fontFamily: 'inherit', transition: 'all 0.15s',
              display: 'flex', alignItems: 'center', gap: 6,
            }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = C.primary; e.currentTarget.style.color = C.primary; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.color = C.t2; }}
            >
              <Eye size={13} />보기 모드
            </button>
          )}
          {/* 공유 버튼 (상시 노출) */}
          <button onClick={() => setShowShare(true)} style={{
            height: 36, padding: '0 12px', borderRadius: 6,
            background: 'transparent', border: `1px solid ${C.border}`,
            color: C.t2, fontSize: 13, cursor: 'pointer',
            fontFamily: 'inherit', transition: 'all 0.15s',
            display: 'flex', alignItems: 'center', gap: 6,
          }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = C.primary; e.currentTarget.style.color = C.primary; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.color = C.t2; }}
          >
            <Share2 size={13} />공유
          </button>
          <AnimatePresence mode="wait">
            {demoPhase === 'idle' && (
              <motion.button key="play" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                onClick={startDemo}
                style={{
                  height: 36, padding: '0 14px', borderRadius: 6,
                  background: 'transparent', border: `1px solid ${C.border}`,
                  color: C.t2, fontSize: 13, cursor: 'pointer',
                  fontFamily: 'inherit', transition: 'all 0.15s',
                  display: 'flex', alignItems: 'center', gap: 6,
                }}
                onMouseEnter={(e) => { e.currentTarget.style.borderColor = C.primary; e.currentTarget.style.color = C.primary; }}
                onMouseLeave={(e) => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.color = C.t2; }}
              >
                <Zap size={13} />데모 재생
              </motion.button>
            )}
            {(demoPhase === 'playing' || demoPhase === 'paused') && (
              <motion.div key="controls" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <button onClick={isPlaying ? pauseDemo : resumeDemo} style={{
                  height: 36, padding: '0 12px', borderRadius: 6,
                  background: C.primary + '1A', border: `1px solid ${C.primary}44`,
                  color: C.primary, fontSize: 13, cursor: 'pointer',
                  fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 5,
                }}>
                  {isPlaying ? <><Pause size={12} />일시정지</> : <><Play size={12} />계속</>}
                </button>
                <button onClick={resetDemo} style={{
                  height: 36, width: 36, borderRadius: 6,
                  background: 'transparent', border: `1px solid ${C.border}`,
                  color: C.t3, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <RotateCcw size={13} />
                </button>
              </motion.div>
            )}
            {demoPhase === 'done' && (
              <motion.button key="reset" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                onClick={resetDemo} style={{
                  height: 36, padding: '0 12px', borderRadius: 6,
                  background: 'transparent', border: `1px solid ${C.border}`,
                  color: C.t3, fontSize: 13, cursor: 'pointer',
                  fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 5,
                  transition: 'all 0.15s',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.color = C.t2; e.currentTarget.style.borderColor = '#3A3A4A'; }}
                onMouseLeave={(e) => { e.currentTarget.style.color = C.t3; e.currentTarget.style.borderColor = C.border; }}
              >
                <RotateCcw size={13} />처음부터
              </motion.button>
            )}
          </AnimatePresence>

          {!isViewMode && (
            <button onClick={() => setShowModal(true)} style={{
              height: 40, padding: '0 18px', borderRadius: 6, background: C.primary,
              border: 'none', color: C.t1, fontSize: 14, fontWeight: 600,
              cursor: 'pointer', fontFamily: 'inherit', transition: 'opacity 0.15s',
            }}
              onMouseEnter={(e) => (e.currentTarget.style.opacity = '0.85')}
              onMouseLeave={(e) => (e.currentTarget.style.opacity = '1')}
            >분석 요청</button>
          )}
          <UserMenu />
        </div>
      </div>

      {isViewMode && (
        <div style={{
          height: 36, background: C.warning + '18', borderBottom: `1px solid ${C.warning}44`,
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, flexShrink: 0,
        }}>
          <Eye size={13} color={C.warning} />
          <span style={{ color: C.warning, fontSize: 12, fontWeight: 600 }}>읽기 전용</span>
          <button onClick={() => setEditorMode('edit')} style={{
            height: 24, padding: '0 10px', borderRadius: 4,
            border: `1px solid ${C.warning}66`, background: C.warning + '18',
            color: C.warning, fontSize: 11, fontWeight: 600,
            cursor: 'pointer', fontFamily: 'inherit',
          }}>
            편집으로 전환
          </button>
        </div>
      )}

      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        <div style={{
          width: 240, background: C.surface, borderRight: `1px solid ${C.border}`,
          padding: 20, display: 'flex', flexDirection: 'column', gap: 16,
          flexShrink: 0, overflowY: 'auto',
        }}>
          <div style={{ color: C.t2, fontSize: 13, fontWeight: 600, letterSpacing: '-0.2px' }}>설정 DB</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {['수아', '이레나', '강민준'].map((name) => (
              <button key={name} onClick={() => setActivePill(name)} style={{
                padding: '4px 10px', borderRadius: 4,
                background: activePill === name ? C.primary + '22' : 'transparent',
                border: `1px solid ${activePill === name ? C.primary : C.border}`,
                color: activePill === name ? C.primary : C.t2,
                fontSize: 13, cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.15s',
              }}>{name}</button>
            ))}
          </div>

          {activePill === '수아' && (
            <div style={{ background: C.bg, borderRadius: 6, border: `1px solid ${C.border}`, padding: 12 }}>
              <div style={{ color: C.t2, fontSize: 12, fontWeight: 600, marginBottom: 10 }}>수아</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {[{ key: '나이', val: '23세' }, { key: '눈', val: '갈색', w: true }, { key: '직업', val: '검사' }, { key: '첫등장', val: '1화' }].map((item) => (
                  <div key={item.key} style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: C.t3, fontSize: 12 }}>{item.key}</span>
                    <span style={{ color: item.w ? C.warning : C.t2, fontSize: 12, fontWeight: item.w ? 600 : 400 }}>{item.val}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          {activePill === '이레나' && (
            <div style={{ background: C.bg, borderRadius: 6, border: `1px solid ${C.border}`, padding: 12 }}>
              <div style={{ color: C.t2, fontSize: 12, fontWeight: 600, marginBottom: 10 }}>이레나</div>
              {[{ key: '나이', val: '28세' }, { key: '눈', val: '흑색' }, { key: '직업', val: '변호사' }].map((item) => (
                <div key={item.key} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                  <span style={{ color: C.t3, fontSize: 12 }}>{item.key}</span>
                  <span style={{ color: C.t2, fontSize: 12 }}>{item.val}</span>
                </div>
              ))}
            </div>
          )}
          {activePill === '강민준' && (
            <div style={{ background: C.bg, borderRadius: 6, border: `1px solid ${C.border}`, padding: 12 }}>
              <div style={{ color: C.t2, fontSize: 12, fontWeight: 600, marginBottom: 10 }}>강민준</div>
              {[{ key: '나이', val: '32세' }, { key: '눈', val: '짙은갈색' }, { key: '직업', val: '수석검사' }].map((item) => (
                <div key={item.key} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                  <span style={{ color: C.t3, fontSize: 12 }}>{item.key}</span>
                  <span style={{ color: C.t2, fontSize: 12 }}>{item.val}</span>
                </div>
              ))}
            </div>
          )}

          <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 12 }}>
            <div style={{ color: C.t3, fontSize: 12, marginBottom: 4 }}>화수 정보</div>
            <div style={{ color: C.t2, fontSize: 12 }}>현재: 159화</div>
            <div style={{ color: C.t3, fontSize: 12, marginTop: 4 }}>총 158화 설정 로드됨</div>
          </div>
        </div>

        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <AnimatePresence>
            {demoActive && (
              <motion.div
                initial={{ height: 0, opacity: 0 }} animate={{ height: 36, opacity: 1 }}
                exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }}
                style={{
                  background: demoPhase === 'done' && detectionPhase === 'detected'
                    ? C.danger + '18' : C.primary + '12',
                  borderBottom: `1px solid ${demoPhase === 'done' && detectionPhase === 'detected'
                    ? C.danger + '44' : C.primary + '33'}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  flexShrink: 0,
                }}
              >
                {isPlaying && (
                  <motion.div
                    animate={{ opacity: [1, 0.4, 1] }} transition={{ duration: 1, repeat: Infinity }}
                    style={{ width: 6, height: 6, borderRadius: '50%', background: C.primary }}
                  />
                )}
                <span style={{
                  fontSize: 12,
                  color: demoPhase === 'done' && detectionPhase === 'detected' ? C.danger : C.primary,
                  fontWeight: 500,
                }}>
                  {isPlaying && detectionPhase === 'none' && '● 재연 재생 중 — 실시간 설정 감지 모니터링 중'}
                  {isPlaying && detectionPhase === 'scanning' && '● 설정 대조 감지됨 — 수아 · 눈 색 분석 중...'}
                  {demoPhase === 'paused' && '⏸ 재연 일시정지됨'}
                  {demoPhase === 'done' && detectionPhase === 'detected' && '⚠ 설정 충돌 감지됨 — 우측 패널을 확인하세요'}
                </span>
              </motion.div>
            )}
          </AnimatePresence>

          <div style={{ flex: 1, display: 'flex', overflow: 'auto', padding: '32px 0' }}>
            <div style={{
              padding: '0 16px 0 24px', color: C.t3, fontSize: 14, lineHeight: '1.8',
              textAlign: 'right', userSelect: 'none', flexShrink: 0, minWidth: 56,
            }}>
              {Array.from({ length: 20 }, (_, i) => (
                <div key={i + 1} style={{ height: '1.8em' }}>{i + 1}</div>
              ))}
            </div>

            <div style={{ flex: 1, color: C.t1, fontSize: 15, lineHeight: 1.8, paddingRight: 32, maxWidth: 680 }}>
              {demoActive ? (
                <EditorText
                  text={typedText}
                  detectionPhase={detectionPhase}
                  showCursor={isPlaying || demoPhase === 'paused'}
                />
              ) : (
                <>
                  <div style={{ color: C.t2, fontWeight: 600, height: '1.8em' }}>제159화. 운명의 실타래</div>
                  <div style={{ height: '1.8em' }} />
                  <div>
                    <p style={{ margin: 0, height: '1.8em' }}>이레나가 법정에 들어서는 순간, 방청석 전체가 숨을 죽였다. 그녀의 존재감은</p>
                    <p style={{ margin: 0, height: '1.8em' }}>언제나 공간을 압도했다. 붉은 립스틱과 날카로운 눈매는 수십 번의 재판에서도</p>
                  </div>
                  <div style={{ height: '1.8em' }} />
                  <div>
                    <p style={{ margin: 0, height: '1.8em' }}>강민준은 서류를 내려놓으며 피고인석 쪽으로 시선을 옮겼다. 그의 표정에서</p>
                    <p style={{ margin: 0, height: '1.8em' }}>감정을 읽기란 거의 불가능했다. 검사로서의 세월이 그를 그렇게 만들었다.</p>
                  </div>
                  <div style={{ height: '1.8em' }} />
                  <div>
                    <p style={{ margin: 0, height: '1.8em' }}>
                      수아는 천천히 고개를 들었다. 햇살이 창문을 통해 쏟아지며 그녀의{' '}
                      <HighlightedText text="파란 눈" tooltip="23화: 갈색 눈으로 설정됨" />
                      {' '}을 가득 채웠다.
                    </p>
                    <p style={{ margin: 0, height: '1.8em' }}>검찰청 복도는 언제나처럼 차갑고 조용했다.</p>
                  </div>
                </>
              )}
            </div>
          </div>

          <div style={{
            height: 36, borderTop: `1px solid ${C.border}`,
            display: 'flex', alignItems: 'center', padding: '0 24px', gap: 16, flexShrink: 0,
          }}>
            <span style={{ color: C.t3, fontSize: 12 }}>159화</span>
            <span style={{ color: C.t3, fontSize: 12 }}>·</span>
            <span style={{ color: C.t3, fontSize: 12 }}>
              {demoActive ? `${typedText.length}자 작성됨` : '432자 작성됨'}
            </span>
            <span style={{ color: C.t3, fontSize: 12 }}>·</span>
            <AnimatePresence mode="wait">
              {detectionPhase === 'scanning' ? (
                <motion.span key="s" initial={{ opacity: 0 }} animate={{ opacity: [1, 0.5, 1] }}
                  transition={{ duration: 0.8, repeat: Infinity }}
                  style={{ color: C.warning, fontSize: 12, display: 'flex', alignItems: 'center', gap: 4 }}>
                  <Scan size={11} />설정 스캔 중...
                </motion.span>
              ) : (detectionPhase === 'detected' || demoPhase === 'idle') ? (
                <motion.span key="d" initial={{ opacity: 0, x: -4 }} animate={{ opacity: 1, x: 0 }}
                  style={{ color: C.danger, fontSize: 12, display: 'flex', alignItems: 'center', gap: 4 }}>
                  <AlertTriangle size={11} />설정 충돌 1건 감지됨
                </motion.span>
              ) : (
                <motion.span key="n" initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                  style={{ color: C.t3, fontSize: 12 }}>
                  설정 충돌 없음
                </motion.span>
              )}
            </AnimatePresence>
          </div>
        </div>

        <div style={{
          width: 300, background: C.surface, borderLeft: `1px solid ${C.border}`,
          padding: 18, display: 'flex', flexDirection: 'column',
          gap: 14, flexShrink: 0, overflowY: 'auto',
        }}>
          <RightPanelContent
            detectionPhase={detectionPhase}
            intentional={intentional}
            setIntentional={setIntentional}
            onRunAnalysis={() => setShowModal(true)}
            demoPhase={demoPhase}
          />
        </div>
      </div>

      <AnimatePresence>
        {showModal && <S3Modal onStart={handleAnalysisStart} onCancel={() => setShowModal(false)} />}
        {showShare && <ShareModal workTitle="빛나는 검사 로맨스" onClose={() => setShowShare(false)} defaultTab="link" />}
      </AnimatePresence>
    </div>
  );
}
