import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Shield, Plus, OctagonAlert, AlertTriangle, CircleCheckBig, BookOpen, Tag, Hash } from 'lucide-react';
import { C, WorkId } from './constants';
import { useAppNavigate } from '../../hooks/useAppNavigate';
import { useAppContext } from '../../context/AppContext';

interface Props { workId?: WorkId; }

const WORKS: { id: WorkId; title: string; genre: string; chapters: number; conflicts: number; status: 'danger' | 'warning' | 'ok' | 'pending' }[] = [
  { id: 'detective', title: '빛나는 검사 로맨스', genre: '로맨스', chapters: 158, conflicts: 5, status: 'danger' },
  { id: 'murim', title: '무협지존', genre: '무협', chapters: 42, conflicts: 0, status: 'ok' },
];

const COVER_GRADIENTS: Record<WorkId, string> = {
  detective: `linear-gradient(135deg, #1a1030 0%, #2d1b4e 50%, #1a0820 100%)`,
  murim: `linear-gradient(135deg, #0d1a2e 0%, #1a3040 50%, #0d2010 100%)`,
};

function ConflictBadge({ status, count }: { status: 'danger' | 'warning' | 'ok' | 'pending'; count: number }) {
  if (status === 'pending') return (
    <span style={{
      padding: '3px 9px', borderRadius: 12, fontSize: 11, fontWeight: 600,
      background: C.t3 + '33', color: C.t3, border: `1px solid ${C.t3}44`,
      display: 'flex', alignItems: 'center', gap: 4,
    }}>
      분석 대기 중
    </span>
  );
  if (status === 'ok') return (
    <span style={{
      padding: '3px 9px', borderRadius: 12, fontSize: 11, fontWeight: 600,
      background: C.success + '22', color: C.success, border: `1px solid ${C.success}44`,
      display: 'flex', alignItems: 'center', gap: 4,
    }}>
      <CircleCheckBig size={11} /> 모두 해결됨
    </span>
  );
  const isHigh = status === 'danger';
  return (
    <span style={{
      padding: '3px 9px', borderRadius: 12, fontSize: 11, fontWeight: 600,
      background: (isHigh ? C.danger : C.warning) + '22',
      color: isHigh ? C.danger : C.warning,
      border: `1px solid ${(isHigh ? C.danger : C.warning)}44`,
      display: 'flex', alignItems: 'center', gap: 4,
    }}>
      {isHigh ? <OctagonAlert size={11} /> : <AlertTriangle size={11} />}
      {count}개의 충돌
    </span>
  );
}

function WorkCard({ work, onClick }: { work: typeof WORKS[0]; onClick: () => void }) {
  const [hovered, setHovered] = useState(false);

  return (
    <motion.div
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      whileHover={{ y: -4 }}
      transition={{ duration: 0.18 }}
      style={{
        borderRadius: 12, overflow: 'hidden', cursor: 'pointer',
        border: `1px solid ${hovered ? C.primary + '55' : C.border}`,
        transition: 'border-color 0.18s',
        boxShadow: hovered ? `0 8px 32px ${C.primary}18` : 'none',
      }}
    >
      {/* 커버 이미지 영역 */}
      <div style={{
        height: 200, background: COVER_GRADIENTS[work.id],
        position: 'relative', display: 'flex', alignItems: 'flex-start',
        justifyContent: 'flex-end', padding: 12,
      }}>
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: 0.12 }}>
          <BookOpen size={80} color="#fff" />
        </div>
        <ConflictBadge status={work.status} count={work.conflicts} />
      </div>

      {/* 정보 영역 */}
      <div style={{ background: C.surface, padding: '14px 16px' }}>
        <div style={{ color: C.t1, fontSize: 16, fontWeight: 700, marginBottom: 6, letterSpacing: '-0.3px' }}>
          {work.title}
        </div>
        <div style={{ display: 'flex', gap: 14, color: C.t3, fontSize: 12 }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <Tag size={11} /> {work.genre}
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <Hash size={11} /> {work.chapters}화
          </span>
        </div>
      </div>
    </motion.div>
  );
}

function NewWorkCard({ onClick }: { onClick: () => void }) {
  const [hovered, setHovered] = useState(false);
  return (
    <motion.div
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      whileHover={{ y: -4 }}
      transition={{ duration: 0.18 }}
      style={{
        borderRadius: 12, overflow: 'hidden', cursor: 'pointer',
        border: `1.5px dashed ${hovered ? C.primary + '66' : C.border}`,
        background: hovered ? C.primary + '08' : 'transparent',
        transition: 'all 0.18s',
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        minHeight: 256, gap: 10,
      }}
    >
      <div style={{
        width: 40, height: 40, borderRadius: 10,
        background: hovered ? C.primary + '22' : C.border + '66',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        transition: 'all 0.18s',
      }}>
        <Plus size={20} color={hovered ? C.primary : C.t3} />
      </div>
      <span style={{ color: hovered ? C.primary : C.t3, fontSize: 13, fontWeight: 500, transition: 'color 0.18s' }}>
        새 작품 등록
      </span>
    </motion.div>
  );
}

export default function S0WorkPicker() {
  const navigate = useAppNavigate();
  const { setSelectedWork } = useAppContext();

  const handleSelect = (workId: WorkId) => {
    setSelectedWork(workId);
    navigate('/dashboard', 'push-right');
  };

  return (
    <div style={{
      background: C.bg, width: '100%', height: '100%', display: 'flex', flexDirection: 'column',
      fontFamily: "'Pretendard Variable', 'Pretendard', 'Apple SD Gothic Neo', -apple-system, sans-serif",
    }}>
      {/* 헤더 */}
      <div style={{
        height: 56, background: C.bg, borderBottom: `1px solid ${C.border}`,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 32px', flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{
            width: 26, height: 26, borderRadius: 6,
            background: `linear-gradient(135deg, ${C.primary}, #B48BFF)`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Shield size={14} color="#fff" />
          </div>
          <span style={{ color: C.t1, fontSize: 15, fontWeight: 700, letterSpacing: '-0.3px' }}>CatchHole</span>
          <span style={{
            padding: '2px 7px', borderRadius: 3, background: C.primary + '18',
            color: C.primary, fontSize: 10, fontWeight: 600, border: `1px solid ${C.primary}33`, marginLeft: 2,
          }}>BETA</span>
        </div>
        <div style={{
          width: 32, height: 32, borderRadius: '50%',
          background: `linear-gradient(135deg, ${C.primary}, #9B7BFD)`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer',
        }}>K</div>
      </div>

      {/* 콘텐츠 */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '48px 64px' }}>
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
          <div style={{ marginBottom: 6 }}>
            <span style={{ color: C.t1, fontSize: 28, fontWeight: 700, letterSpacing: '-0.6px' }}>작품 선택</span>
          </div>
          <div style={{ color: C.t3, fontSize: 14, marginBottom: 36 }}>
            분석할 작품을 선택하거나 새 작품을 등록하세요.
          </div>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
            gap: 16, maxWidth: 960,
          }}>
            {WORKS.map(work => (
              <WorkCard key={work.id} work={work} onClick={() => handleSelect(work.id)} />
            ))}
            <NewWorkCard onClick={() => navigate('/dashboard', 'push-right')} />
          </div>
        </motion.div>
      </div>
    </div>
  );
}
