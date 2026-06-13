import React, { useMemo, useState } from 'react';
import { useLocation } from 'react-router';
import { ChevronLeft, Check, Pencil, EyeOff, RotateCcw } from 'lucide-react';
import { C } from './constants';
import { useAppNavigate } from '../../hooks/useAppNavigate';
import { BtnP, BtnG } from './S1Dashboard';
import {
  SettingCandidate, SettingCandidateReviewStatus, SettingGroupBy, SettingReviewFilter,
  SETTING_TYPE_LABELS, REVIEW_STATUS_LABELS,
} from './types';
import { MOCK_SETTING_CANDIDATES } from './mockEpisodeData';
import { UserMenu } from './UserMenu';

const CHARACTER_COLORS: Record<string, string> = {
  '수아': C.primary,
  '강민준': '#E25C5C',
  '이레나': '#4BB8D9',
};

const FILTER_TABS: SettingReviewFilter[] = ['PENDING_REVIEW', 'APPROVED', 'EDITED', 'IGNORED', 'ALL'];

function confidenceColor(confidence: number) {
  if (confidence >= 0.8) return C.success;
  if (confidence >= 0.5) return C.warning;
  return C.danger;
}

function Header({ onBack, total, reviewed }: { onBack: () => void; total: number; reviewed: number }) {
  const pct = total === 0 ? 100 : Math.round((reviewed / total) * 100);
  return (
    <div style={{
      height: 56, flexShrink: 0, display: 'flex', alignItems: 'center', gap: 12,
      padding: '0 20px', borderBottom: `1px solid ${C.border}`,
    }}>
      <button onClick={onBack} style={{
        width: 32, height: 32, borderRadius: 6, border: `1px solid ${C.border}`,
        background: 'transparent', color: C.t2, cursor: 'pointer',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <ChevronLeft size={16} />
      </button>
      <div style={{ color: C.t1, fontSize: 15, fontWeight: 700, letterSpacing: '-0.2px' }}>설정 후보 검토</div>

      <div style={{ flex: 1 }} />

      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ color: C.t2, fontSize: 12 }}>{reviewed} / {total} 검토 완료</span>
        <div style={{ width: 100, height: 6, background: C.border, borderRadius: 3, overflow: 'hidden' }}>
          <div style={{ width: `${pct}%`, height: '100%', background: C.primary, borderRadius: 3, transition: 'width 0.2s' }} />
        </div>
      </div>
      <UserMenu />
    </div>
  );
}

function FilterTabs({ filter, setFilter, counts }: {
  filter: SettingReviewFilter; setFilter: (f: SettingReviewFilter) => void; counts: Record<SettingReviewFilter, number>;
}) {
  const labelOf = (f: SettingReviewFilter) => f === 'ALL' ? '전체' : REVIEW_STATUS_LABELS[f];
  return (
    <div style={{ display: 'flex', gap: 6 }}>
      {FILTER_TABS.map((f) => (
        <button key={f} onClick={() => setFilter(f)} style={{
          padding: '6px 12px', borderRadius: 6, cursor: 'pointer', fontFamily: 'inherit',
          background: filter === f ? C.primary + '18' : 'transparent',
          border: `1px solid ${filter === f ? C.primary : C.border}`,
          color: filter === f ? C.primary : C.t2, fontSize: 12, fontWeight: filter === f ? 600 : 400,
          whiteSpace: 'nowrap',
        }}>
          {labelOf(f)} ({counts[f]})
        </button>
      ))}
    </div>
  );
}

function GroupByToggle({ groupBy, setGroupBy }: { groupBy: SettingGroupBy; setGroupBy: (g: SettingGroupBy) => void }) {
  const opts: { id: SettingGroupBy; label: string }[] = [
    { id: 'character', label: '캐릭터별' },
    { id: 'type', label: '유형별' },
    { id: 'none', label: '없음' },
  ];
  return (
    <div style={{ display: 'flex', border: `1px solid ${C.border}`, borderRadius: 6, overflow: 'hidden' }}>
      {opts.map((o) => (
        <button key={o.id} onClick={() => setGroupBy(o.id)} style={{
          padding: '6px 10px', cursor: 'pointer', fontFamily: 'inherit', border: 'none',
          background: groupBy === o.id ? C.primary + '18' : 'transparent',
          color: groupBy === o.id ? C.primary : C.t2, fontSize: 12, fontWeight: groupBy === o.id ? 600 : 400,
        }}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

function ActionButton({ icon, label, onClick, color }: { icon: React.ReactNode; label: string; onClick: () => void; color: string }) {
  const [hover, setHover] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 6,
        border: `1px solid ${hover ? color : C.border}`, background: hover ? color + '14' : 'transparent',
        color: hover ? color : C.t2, fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
        transition: 'all 0.12s',
      }}
    >
      {icon}{label}
    </button>
  );
}

function SettingCandidateCard({ candidate, onUpdate }: {
  candidate: SettingCandidate;
  onUpdate: (id: string, patch: Partial<SettingCandidate>) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState(candidate.editedValue ?? candidate.settingValue);

  const reviewed = candidate.reviewStatus !== 'PENDING_REVIEW';
  const displayValue = candidate.editedValue ?? candidate.settingValue;
  const charColor = candidate.characterName ? (CHARACTER_COLORS[candidate.characterName] ?? C.t2) : C.t3;

  const borderColor =
    candidate.reviewStatus === 'APPROVED' || candidate.reviewStatus === 'EDITED' ? C.success
    : candidate.reviewStatus === 'IGNORED' ? C.border
    : C.border;

  return (
    <div style={{
      border: `1px solid ${borderColor}`, borderRadius: 8, padding: 14, background: C.surface,
      opacity: candidate.reviewStatus === 'IGNORED' ? 0.5 : 1, transition: 'opacity 0.15s',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
        {candidate.characterName && (
          <span style={{
            padding: '2px 8px', borderRadius: 10, background: charColor + '1A', color: charColor,
            fontSize: 11, fontWeight: 700, border: `1px solid ${charColor}33`,
          }}>{candidate.characterName}</span>
        )}
        <span style={{
          padding: '2px 8px', borderRadius: 10, background: C.bg, color: C.t2,
          fontSize: 11, fontWeight: 600, border: `1px solid ${C.border}`,
        }}>{SETTING_TYPE_LABELS[candidate.settingType]}</span>

        <span style={{
          padding: '2px 8px', borderRadius: 10, fontSize: 11, fontWeight: 700,
          color: confidenceColor(candidate.confidence),
          background: confidenceColor(candidate.confidence) + '1A',
          border: `1px solid ${confidenceColor(candidate.confidence)}33`,
        }}>신뢰도 {Math.round(candidate.confidence * 100)}%</span>

        <div style={{ flex: 1 }} />

        {reviewed && (
          <span style={{
            padding: '2px 8px', borderRadius: 10, fontSize: 11, fontWeight: 700,
            color: C.t2, background: C.bg, border: `1px solid ${C.border}`,
          }}>{REVIEW_STATUS_LABELS[candidate.reviewStatus]}</span>
        )}
      </div>

      <div style={{ marginBottom: 10 }}>
        <span style={{ color: C.t2, fontSize: 13 }}>{candidate.settingKey}: </span>
        {editing ? (
          <input
            value={editValue} onChange={(e) => setEditValue(e.target.value)} autoFocus
            style={{
              width: 220, height: 28, borderRadius: 4, background: C.bg, border: `1px solid ${C.primary}`,
              color: C.t1, fontSize: 13, padding: '0 8px', fontFamily: 'inherit', outline: 'none',
            }}
          />
        ) : (
          <span style={{ color: C.t1, fontSize: 14, fontWeight: 700 }}>{displayValue}</span>
        )}
      </div>

      <div style={{
        borderLeft: `2px solid ${C.border}`, paddingLeft: 10, marginBottom: 12,
        color: C.t2, fontSize: 12, fontStyle: 'italic', lineHeight: 1.6,
      }}>
        <span style={{ color: C.t3, fontStyle: 'normal', fontWeight: 600, marginRight: 6 }}>
          {candidate.evidenceChunk.episodeNumber}화 · {candidate.evidenceChunk.paragraph}문단
        </span>
        "{candidate.evidenceChunk.quote}"
      </div>

      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
        {reviewed ? (
          <ActionButton
            icon={<RotateCcw size={12} />} label="되돌리기" color={C.t2}
            onClick={() => onUpdate(candidate.id, { reviewStatus: 'PENDING_REVIEW', editedValue: undefined })}
          />
        ) : editing ? (
          <>
            <ActionButton
              icon={<Pencil size={12} />} label="취소" color={C.t2}
              onClick={() => { setEditing(false); setEditValue(candidate.editedValue ?? candidate.settingValue); }}
            />
            <ActionButton
              icon={<Check size={12} />} label="저장" color={C.success}
              onClick={() => { onUpdate(candidate.id, { reviewStatus: 'EDITED', editedValue: editValue }); setEditing(false); }}
            />
          </>
        ) : (
          <>
            <ActionButton
              icon={<EyeOff size={12} />} label="무시" color={C.t3}
              onClick={() => onUpdate(candidate.id, { reviewStatus: 'IGNORED' })}
            />
            <ActionButton
              icon={<Pencil size={12} />} label="수정" color={C.warning}
              onClick={() => setEditing(true)}
            />
            <ActionButton
              icon={<Check size={12} />} label="확정" color={C.success}
              onClick={() => onUpdate(candidate.id, { reviewStatus: 'APPROVED' })}
            />
          </>
        )}
      </div>
    </div>
  );
}

export default function SSettingReview() {
  const navigate = useAppNavigate();
  const location = useLocation();
  const episodeIds = (location.state as { episodeIds?: string[] } | null)?.episodeIds;

  const [candidates, setCandidates] = useState<SettingCandidate[]>(() =>
    episodeIds && episodeIds.length > 0
      ? MOCK_SETTING_CANDIDATES.filter((c) => episodeIds.includes(c.episodeId))
      : MOCK_SETTING_CANDIDATES
  );
  const [filter, setFilter] = useState<SettingReviewFilter>('PENDING_REVIEW');
  const [groupBy, setGroupBy] = useState<SettingGroupBy>('character');

  const handleUpdate = (id: string, patch: Partial<SettingCandidate>) => {
    setCandidates((prev) => prev.map((c) => c.id === id ? { ...c, ...patch } : c));
  };

  const total = candidates.length;
  const reviewed = candidates.filter((c) => c.reviewStatus !== 'PENDING_REVIEW').length;
  const allReviewed = total > 0 && reviewed === total;

  const counts = useMemo(() => {
    const base: Record<SettingReviewFilter, number> = {
      ALL: candidates.length, PENDING_REVIEW: 0, APPROVED: 0, EDITED: 0, IGNORED: 0,
    };
    candidates.forEach((c) => { base[c.reviewStatus] += 1; });
    return base;
  }, [candidates]);

  const filtered = useMemo(() => {
    if (filter === 'ALL') return candidates;
    return candidates.filter((c) => c.reviewStatus === filter);
  }, [candidates, filter]);

  const groups = useMemo<{ key: string; label: string; items: SettingCandidate[] }[]>(() => {
    if (groupBy === 'none') return [{ key: 'all', label: '', items: filtered }];
    if (groupBy === 'character') {
      const byChar = new Map<string, SettingCandidate[]>();
      filtered.forEach((c) => {
        const key = c.characterName ?? '공통/세계관';
        if (!byChar.has(key)) byChar.set(key, []);
        byChar.get(key)!.push(c);
      });
      return Array.from(byChar.entries()).map(([key, items]) => ({ key, label: key, items }));
    }
    // type
    const byType = new Map<string, SettingCandidate[]>();
    filtered.forEach((c) => {
      const key = c.settingType;
      if (!byType.has(key)) byType.set(key, []);
      byType.get(key)!.push(c);
    });
    return Array.from(byType.entries()).map(([key, items]) => ({
      key, label: SETTING_TYPE_LABELS[key as SettingCandidate['settingType']], items,
    }));
  }, [filtered, groupBy]);

  return (
    <div style={{
      width: '100%', height: '100%', display: 'flex', flexDirection: 'column',
      background: C.bg, fontFamily: "'Pretendard Variable', 'Pretendard', 'Apple SD Gothic Neo', -apple-system, sans-serif",
    }}>
      <Header onBack={() => navigate('/dashboard', 'pop')} total={total} reviewed={reviewed} />

      <div style={{ flex: 1, overflowY: 'auto' }}>
        <div style={{ maxWidth: 720, margin: '0 auto', padding: '20px 20px 60px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, gap: 12, flexWrap: 'wrap' }}>
            <FilterTabs filter={filter} setFilter={setFilter} counts={counts} />
            <GroupByToggle groupBy={groupBy} setGroupBy={setGroupBy} />
          </div>

          {filtered.length === 0 && (
            <div style={{ textAlign: 'center', padding: '60px 0', color: C.t3, fontSize: 13 }}>
              해당하는 설정 후보가 없습니다.
            </div>
          )}

          {groups.map((group) => (
            <div key={group.key} style={{ marginBottom: 20 }}>
              {group.label && (
                <div style={{ color: C.t3, fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>
                  {group.label} ({group.items.length})
                </div>
              )}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {group.items.map((c) => (
                  <SettingCandidateCard key={c.id} candidate={c} onUpdate={handleUpdate} />
                ))}
              </div>
            </div>
          ))}

          <div style={{ marginTop: 24, display: 'flex', justifyContent: 'flex-end' }}>
            {allReviewed
              ? <BtnP label="설정 DB에 반영" onClick={() => navigate('/dashboard', 'pop')} />
              : <BtnG label="설정 DB에 반영 (모든 항목 검토 필요)" />}
          </div>
        </div>
      </div>
    </div>
  );
}
