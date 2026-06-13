import React, { useState } from 'react';
import { Check, Search } from 'lucide-react';
import { C } from './constants';

export function ModeCard({ icon, title, desc, color, selected, onSelect }: {
  icon: React.ReactNode; title: string; desc: string; color: string; selected: boolean; onSelect: () => void;
}) {
  const [hovered, setHovered] = useState(false);
  return (
    <div
      onClick={onSelect}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        flex: 1, minWidth: 0, borderRadius: 12, padding: '28px 18px', textAlign: 'center', cursor: 'pointer',
        position: 'relative', transition: 'all 0.15s',
        border: `${selected ? 2 : 1}px solid ${selected ? color : hovered ? color : C.border}`,
        background: selected ? color + '0D' : C.surface,
      }}
    >
      {selected && (
        <div style={{ position: 'absolute', top: 12, right: 12, color }}>
          <Check size={16} />
        </div>
      )}
      <div style={{
        width: 48, height: 48, borderRadius: 8, margin: '0 auto 12px',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: selected ? color + '33' : color + '18', color,
      }}>
        {icon}
      </div>
      <div style={{ color: selected ? color : C.t1, fontSize: 15, fontWeight: 700, marginBottom: 6 }}>{title}</div>
      <div style={{ color: C.t3, fontSize: 12, lineHeight: 1.5 }}>{desc}</div>
    </div>
  );
}

export function InfoBar({ items, badge }: {
  items: { label: string; value: React.ReactNode }[];
  badge?: React.ReactNode;
}) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 28, padding: '14px 18px',
      background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8,
      marginBottom: 16, flexWrap: 'wrap',
    }}>
      {items.map((it, i) => (
        <div key={i}>
          <div style={{ color: C.t3, fontSize: 11, marginBottom: 2 }}>{it.label}</div>
          <div style={{ color: C.t1, fontSize: 14, fontWeight: 600 }}>{it.value}</div>
        </div>
      ))}
      {badge && <div style={{ marginLeft: 'auto' }}>{badge}</div>}
    </div>
  );
}

export function SplitPane({ left, right, leftWidth = 300 }: {
  left: React.ReactNode; right: React.ReactNode; leftWidth?: number;
}) {
  return (
    <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
      <div style={{ width: leftWidth, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
        {left}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>{right}</div>
    </div>
  );
}

export function SearchInput({ value, onChange, placeholder }: {
  value: string; onChange: (v: string) => void; placeholder?: string;
}) {
  return (
    <div style={{ position: 'relative' }}>
      <Search size={14} color={C.t3} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)' }} />
      <input
        value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
        style={{
          width: '100%', height: 36, borderRadius: 6, background: C.bg, border: `1px solid ${C.border}`,
          color: C.t1, fontSize: 13, padding: '0 12px 0 32px', fontFamily: 'inherit',
          outline: 'none', boxSizing: 'border-box',
        }}
      />
    </div>
  );
}

export function CategoryTabs({ tabs, active, onChange }: {
  tabs: { id: string; label: string; count?: number }[]; active: string; onChange: (id: string) => void;
}) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
      {tabs.map((t) => (
        <button key={t.id} onClick={() => onChange(t.id)} style={{
          padding: '5px 10px', borderRadius: 6, cursor: 'pointer', fontFamily: 'inherit',
          background: active === t.id ? C.primary + '18' : 'transparent',
          border: `1px solid ${active === t.id ? C.primary : C.border}`,
          color: active === t.id ? C.primary : C.t2, fontSize: 12,
          fontWeight: active === t.id ? 600 : 400, whiteSpace: 'nowrap',
        }}>
          {t.label}{t.count !== undefined ? ` (${t.count})` : ''}
        </button>
      ))}
    </div>
  );
}

export function ListItemCard({ selected, onClick, title, subtitle, badge, badgeColor }: {
  selected: boolean; onClick: () => void; title: React.ReactNode; subtitle?: React.ReactNode;
  badge?: React.ReactNode; badgeColor?: string;
}) {
  const color = badgeColor ?? C.t2;
  return (
    <div onClick={onClick} style={{
      padding: '12px 14px', borderRadius: 8, cursor: 'pointer', transition: 'all 0.12s',
      border: `1px solid ${selected ? C.primary : C.border}`,
      background: selected ? C.primary + '0D' : C.surface,
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ color: C.t1, fontSize: 13, fontWeight: 600, marginBottom: subtitle ? 4 : 0 }}>{title}</div>
          {subtitle && <div style={{ color: C.t3, fontSize: 11 }}>{subtitle}</div>}
        </div>
        {badge && (
          <span style={{
            flexShrink: 0, padding: '2px 8px', borderRadius: 10, fontSize: 10, fontWeight: 700,
            color, background: color + '1A', border: `1px solid ${color}33`,
          }}>
            {badge}
          </span>
        )}
      </div>
    </div>
  );
}
