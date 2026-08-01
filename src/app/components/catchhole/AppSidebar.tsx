import React, { useState } from 'react';
import {
  BookOpen, BarChart3, ListChecks, Network, FileText, MessageSquare,
} from 'lucide-react';
import { C, NavId } from './constants';
import { useAppNavigate } from '../../hooks/useAppNavigate';
import { useAppContext } from '../../context/AppContext';

/** 작품 정보가 아직 로드되지 않았을 때 사용하는 기본 표시값 */
export const FALLBACK_WORK_INFO = { title: '내 작품', genre: '' };

function NavItem({
  icon, label, active, upcoming = false, onClick,
}: { icon: React.ReactNode; label: string; active?: boolean; upcoming?: boolean; onClick?: () => void }) {
  const [h, setH] = useState(false);
  return (
    <button type="button" onClick={onClick} onMouseEnter={() => setH(true)} onMouseLeave={() => setH(false)}
      style={{
        width: '100%', border: 0, fontFamily: 'inherit', textAlign: 'left',
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
      {upcoming && (
        <span style={{
          padding: '1px 6px', borderRadius: 8, background: C.primary + '12',
          color: C.t2, fontSize: 9, fontWeight: 600, border: `1px solid ${C.primary}33`,
          whiteSpace: 'nowrap',
        }}>업데이트 예정</span>
      )}
    </button>
  );
}

interface Props {
  activeNav?: NavId;
  onNavChange?: (nav: NavId) => void;
  onComingSoon?: (feature: string) => void;
}

export function AppSidebar({ activeNav, onNavChange, onComingSoon }: Props) {
  const navigate = useAppNavigate();
  const { selectedWork, selectedWorkInfo } = useAppContext();
  const workInfo = selectedWorkInfo?.id === selectedWork
    ? selectedWorkInfo
    : FALLBACK_WORK_INFO;

  const nav = (id: NavId) => {
    onNavChange?.(id);
  };

  return (
    <div style={{
      width: 220, background: C.bg, borderRight: `1px solid ${C.border}`,
      padding: '16px 0', display: 'flex', flexDirection: 'column', flexShrink: 0,
    }}>
      {/* 현재 작품 */}
      <div style={{ padding: '0 16px 12px' }}>
        <div style={{ color: C.t3, fontSize: 10, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 8 }}>현재 작품</div>
        <div style={{
          background: C.surface, border: `1px solid ${C.border}`, borderRadius: 6,
          padding: '8px 12px', marginBottom: 6,
        }}>
          <div style={{ color: C.t1, fontSize: 12, fontWeight: 600, marginBottom: 2, letterSpacing: '-0.2px' }}>
            {workInfo.title}
          </div>
          <div style={{ color: C.t3, fontSize: 11 }}>{workInfo.genre}</div>
        </div>
        <button onClick={() => navigate('/works', 'push-left')} style={{
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

      <NavItem icon={<FileText size={14} />} label="원고 목록"
        active={activeNav === 'manuscripts'}
        onClick={() => nav('manuscripts')} />
      <NavItem icon={<BookOpen size={14} />} label="설정 DB"
        active={activeNav === 'settingDB'}
        onClick={() => nav('settingDB')} />
      <NavItem icon={<ListChecks size={14} />} label="분석 목록"
        active={activeNav === 'analyses'}
        onClick={() => nav('analyses')} />
      <NavItem icon={<BarChart3 size={14} />} label="분석 리포트" upcoming
        onClick={() => onComingSoon?.('분석 리포트')} />
      <NavItem icon={<Network size={14} />} label="그래프 뷰" upcoming
        onClick={() => onComingSoon?.('그래프 뷰')} />
      <NavItem icon={<MessageSquare size={14} />} label="챗봇" upcoming
        onClick={() => onComingSoon?.('챗봇')} />
    </div>
  );
}
