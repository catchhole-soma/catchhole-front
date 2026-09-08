import React, { useId, useState } from 'react';
import { Check } from 'lucide-react';
import { C } from './constants';

export function ModeCard({ icon, title, desc, color, selected, onSelect, badge }: {
  icon: React.ReactNode; title: string; desc: string; color: string; selected: boolean; onSelect: () => void;
  badge?: string;
}) {
  const [hovered, setHovered] = useState(false);
  const descriptionId = useId();
  return (
    <button
      type="button"
      aria-label={title}
      aria-describedby={descriptionId}
      aria-pressed={selected}
      className={`mode-card${selected ? ' is-selected' : ''}`}
      onClick={onSelect}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        flex: 1, minWidth: 0, borderRadius: 12, padding: '28px 18px', textAlign: 'center', cursor: 'pointer',
        position: 'relative', transition: 'all 0.15s', fontFamily: 'inherit',
        border: `${selected ? 2 : 1}px solid ${selected ? color : hovered ? color : C.border}`,
        background: selected ? color + '0D' : C.surface,
      }}
    >
      {badge && <span className="mode-card__badge">{badge}</span>}
      {selected && (
        <span aria-hidden="true" style={{ position: 'absolute', top: 12, right: 12, color }}>
          <Check size={16} />
        </span>
      )}
      <span aria-hidden="true" style={{
        width: 48, height: 48, borderRadius: 8, margin: '0 auto 12px',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: selected ? color + '33' : color + '18', color,
      }}>
        {icon}
      </span>
      <span className="mode-card__title" style={{ display: 'block', color: selected ? color : C.t1, fontSize: 15, fontWeight: 700, marginBottom: 6 }}>{title}</span>
      <span id={descriptionId} className="mode-card__description" style={{ display: 'block', color: C.t3, fontSize: 12, lineHeight: 1.5 }}>{desc}</span>
    </button>
  );
}
