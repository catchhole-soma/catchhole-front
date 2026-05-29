import React, { useState } from 'react';
import {
  BookOpen, BarChart3, Network, FileText, MessageSquare, Settings,
} from 'lucide-react';
import { C, NavigateFn, WorkId, NavId } from './constants';

const WORK_INFO: Record<WorkId, { title: string; genre: string }> = {
  detective: { title: '빛나는 검사 로맨스', genre: '로맨스' },
  murim: { title: '무협지존', genre: '무협' },
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

interface Props {
  navigate: NavigateFn;
  selectedWork: WorkId;
  onChangeWork: () => void;
  activeNav?: NavId;
  onNavChange?: (nav: NavId) => void;
  activePage: 'dashboard' | 'chat';
}

export function AppSidebar({ navigate, selectedWork, onChangeWork, activeNav, onNavChange, activePage }: Props) {
  const nav = (id: NavId) => {
    if (activePage !== 'dashboard') {
      navigate('S1', 'pop');
    }
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

      <NavItem icon={<BookOpen size={14} />} label="설정 DB"
        active={activePage === 'dashboard' && activeNav === 'settingDB'}
        onClick={() => nav('settingDB')} />
      <NavItem icon={<BarChart3 size={14} />} label="분석 리포트" badge="3"
        active={activePage === 'dashboard' && activeNav === 'reports'}
        onClick={() => nav('reports')} />
      <NavItem icon={<Network size={14} />} label="그래프 뷰"
        active={activePage === 'dashboard' && activeNav === 'graph'}
        onClick={() => nav('graph')} />
      <NavItem icon={<FileText size={14} />} label="원고 목록"
        active={activePage === 'dashboard' && activeNav === 'manuscripts'}
        onClick={() => nav('manuscripts')} />
      <NavItem icon={<MessageSquare size={14} />} label="챗봇"
        active={activePage === 'chat'}
        onClick={() => activePage !== 'chat' && navigate('S3', 'push-right')} />

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
  );
}
