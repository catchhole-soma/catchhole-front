import React from 'react';
import {
  BookOpen, BarChart3, ListChecks, Network, FileText, MessageSquare,
} from 'lucide-react';
import { NavId } from './constants';
import { useAppNavigate } from '../../hooks/useAppNavigate';
import { useAppContext } from '../../context/AppContext';

/** 작품 정보가 아직 로드되지 않았을 때 사용하는 기본 표시값 */
export const FALLBACK_WORK_INFO = { title: '내 작품', genre: '' };

function NavItem({
  icon, label, active, upcoming = false, onClick,
}: { icon: React.ReactNode; label: string; active?: boolean; upcoming?: boolean; onClick?: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`workspace-nav-item${active ? ' is-active' : ''}`}
    >
      <span className="workspace-nav-item__icon">{icon}</span>
      <span className="workspace-nav-item__label">{label}</span>
      {upcoming && (
        <span className="workspace-nav-item__upcoming">업데이트 예정</span>
      )}
    </button>
  );
}

interface Props {
  activeNav?: NavId;
  onNavChange?: (nav: NavId) => void;
  onComingSoon?: (feature: string) => void;
  onClose?: () => void;
  className?: string;
}

export function AppSidebar({ activeNav, onNavChange, onComingSoon, onClose, className }: Props) {
  const navigate = useAppNavigate();
  const { selectedWork, selectedWorkInfo } = useAppContext();
  const workInfo = selectedWorkInfo?.id === selectedWork
    ? selectedWorkInfo
    : FALLBACK_WORK_INFO;

  const nav = (id: NavId) => {
    onNavChange?.(id);
    onClose?.();
  };

  return (
    <aside className={`app-sidebar workspace-sidebar ${className ?? ''}`.trim()}>
      {/* 현재 작품 */}
      <div className="workspace-sidebar__work">
        <div className="workspace-sidebar__label">현재 작품</div>
        <div className="workspace-sidebar__work-card">
          <div className="workspace-sidebar__work-title">{workInfo.title}</div>
          <div className="workspace-sidebar__work-genre">{workInfo.genre}</div>
        </div>
        <button className="workspace-sidebar__change-work" onClick={() => { onClose?.(); navigate('/works', 'push-left'); }}>
          작품 변경
        </button>
      </div>

      <div className="workspace-sidebar__divider" />
      <div className="workspace-sidebar__label workspace-sidebar__label--nav">워크스페이스</div>

      <NavItem icon={<FileText size={14} />} label="원고 목록"
        active={activeNav === 'manuscripts'}
        onClick={() => nav('manuscripts')} />
      <NavItem icon={<BookOpen size={14} />} label="작품 설정"
        active={activeNav === 'settingDB'}
        onClick={() => nav('settingDB')} />
      <NavItem icon={<ListChecks size={14} />} label="분석 목록"
        active={activeNav === 'analyses'}
        onClick={() => nav('analyses')} />
      <NavItem icon={<BarChart3 size={14} />} label="분석 리포트" upcoming
        onClick={() => { onComingSoon?.('분석 리포트'); onClose?.(); }} />
      <NavItem icon={<Network size={14} />} label="그래프 뷰" upcoming
        onClick={() => { onComingSoon?.('그래프 뷰'); onClose?.(); }} />
      <NavItem icon={<MessageSquare size={14} />} label="챗봇" upcoming
        onClick={() => { onComingSoon?.('챗봇'); onClose?.(); }} />

    </aside>
  );
}
