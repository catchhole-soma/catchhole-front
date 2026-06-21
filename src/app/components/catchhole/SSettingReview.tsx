import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router';
import { ChevronLeft, Check, Pencil, EyeOff, RotateCcw, TriangleAlert } from 'lucide-react';
import { C } from './constants';
import { useAppNavigate } from '../../hooks/useAppNavigate';
import { BtnP, BtnG } from './S1Dashboard';
import { InfoBar, SplitPane, SearchInput, CategoryTabs, ListItemCard } from './ReviewLayout';
import {
  SettingCandidate, SettingCandidateReviewStatus, SettingCandidateType, SettingReviewFilter,
  SETTING_TYPE_LABELS, REVIEW_STATUS_LABELS,
} from './types';
import { MOCK_SETTING_CANDIDATES } from './mockEpisodeData';
import { UserMenu } from './UserMenu';
import { getSettingCandidates, updateCandidate } from '../../lib/settingsApi';
import { isDemoMode } from '../../lib/worksApi';

const CHARACTER_COLORS: Record<string, string> = {
  '수아': C.primary,
  '강민준': '#E25C5C',
  '이레나': '#4BB8D9',
};

const FILTER_TABS: SettingReviewFilter[] = ['PENDING_REVIEW', 'CONFIRMED', 'EDITED', 'DISMISSED', 'ALL'];

function confidenceColor(confidence: number) {
  if (confidence >= 0.8) return C.success;
  if (confidence >= 0.5) return C.warning;
  return C.danger;
}

function statusColor(status: SettingCandidateReviewStatus) {
  if (status === 'PENDING_REVIEW') return C.warning;
  if (status === 'DISMISSED') return C.t3;
  return C.success;
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

function ReviewFilterTabs({ filter, setFilter, counts }: {
  filter: SettingReviewFilter; setFilter: (f: SettingReviewFilter) => void; counts: Record<SettingReviewFilter, number>;
}) {
  const labelOf = (f: SettingReviewFilter) => f === 'ALL' ? '전체' : REVIEW_STATUS_LABELS[f];
  return (
    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
      {FILTER_TABS.map((f) => (
        <button key={f} onClick={() => setFilter(f)} style={{
          padding: '4px 8px', borderRadius: 6, cursor: 'pointer', fontFamily: 'inherit',
          background: filter === f ? C.primary + '18' : 'transparent',
          border: `1px solid ${filter === f ? C.primary : C.border}`,
          color: filter === f ? C.primary : C.t2, fontSize: 11, fontWeight: filter === f ? 600 : 400,
          whiteSpace: 'nowrap',
        }}>
          {labelOf(f)} ({counts[f]})
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

function CandidateDetail({ candidate, onUpdate }: {
  candidate: SettingCandidate;
  onUpdate: (id: string, patch: Partial<SettingCandidate>) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState(candidate.editedValue ?? candidate.settingValue);

  const reviewed = candidate.reviewStatus !== 'PENDING_REVIEW';
  const displayValue = candidate.editedValue ?? candidate.settingValue;
  const charColor = candidate.characterName ? (CHARACTER_COLORS[candidate.characterName] ?? C.t2) : C.t3;

  return (
    <div style={{ border: `1px solid ${C.border}`, borderRadius: 8, padding: 18, background: C.surface }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
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

      <div style={{ marginBottom: 16 }}>
        <div style={{ color: C.t3, fontSize: 11, fontWeight: 600, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          {candidate.settingKey}
        </div>
        {editing ? (
          <input
            value={editValue} onChange={(e) => setEditValue(e.target.value)} autoFocus
            style={{
              width: '100%', height: 36, borderRadius: 6, background: C.bg, border: `1px solid ${C.primary}`,
              color: C.t1, fontSize: 15, padding: '0 10px', fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box',
            }}
          />
        ) : (
          <div style={{ color: C.t1, fontSize: 18, fontWeight: 700 }}>{displayValue}</div>
        )}
      </div>

      <div style={{ color: C.t3, fontSize: 11, fontWeight: 600, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
        근거 문장
      </div>
      <div style={{
        borderLeft: `2px solid ${C.border}`, paddingLeft: 10, marginBottom: 12,
        color: C.t2, fontSize: 13, fontStyle: 'italic', lineHeight: 1.6,
      }}>
        <span style={{ color: C.t3, fontStyle: 'normal', fontWeight: 600, marginRight: 6 }}>
          {candidate.evidenceChunk.episodeNumber}화 · {candidate.evidenceChunk.paragraph}문단
        </span>
        "{candidate.evidenceChunk.quote}"
      </div>

      {candidate.confidence < 0.8 && (
        <div style={{
          marginBottom: 16, padding: 12, borderRadius: 6,
          border: `1px solid ${C.danger}33`, background: C.danger + '0D',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4, color: C.danger, fontSize: 12, fontWeight: 700 }}>
            <TriangleAlert size={13} /> AI 분석 의견
          </div>
          <div style={{ color: C.t2, fontSize: 12, lineHeight: 1.6 }}>
            신뢰도가 {Math.round(candidate.confidence * 100)}%로 낮습니다. 근거 문장의 표현이 명확하지 않아 다른 해석이 가능하니 원문을 직접 확인한 뒤 값을 수정하거나 무시해주세요.
          </div>
        </div>
      )}

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
              onClick={() => onUpdate(candidate.id, { reviewStatus: 'DISMISSED' })}
            />
            <ActionButton
              icon={<Pencil size={12} />} label="수정" color={C.warning}
              onClick={() => setEditing(true)}
            />
            <ActionButton
              icon={<Check size={12} />} label="확정" color={C.success}
              onClick={() => onUpdate(candidate.id, { reviewStatus: 'CONFIRMED' })}
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
  const state = (location.state as { episodeIds?: string[]; workId?: string } | null);
  const episodeIds = state?.episodeIds;
  const workId = state?.workId;

  const [candidates, setCandidates] = useState<SettingCandidate[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<SettingReviewFilter>('PENDING_REVIEW');
  const [typeFilter, setTypeFilter] = useState<SettingCandidateType | 'ALL'>('ALL');
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const fetchCandidates = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getSettingCandidates(workId ?? '', episodeIds);
      setCandidates(data);
    } catch {
      const fallback = episodeIds && episodeIds.length > 0
        ? MOCK_SETTING_CANDIDATES.filter((c) => episodeIds.includes(c.episodeId))
        : MOCK_SETTING_CANDIDATES;
      setCandidates(fallback);
    } finally {
      setLoading(false);
    }
  }, [workId, episodeIds]);

  useEffect(() => { fetchCandidates(); }, [fetchCandidates]);

  const handleUpdate = (id: string, patch: Partial<SettingCandidate>) => {
    setCandidates((prev) => prev.map((c) => c.id === id ? { ...c, ...patch } : c));
    if (workId && !isDemoMode()) {
      updateCandidate(workId, id, {
        reviewStatus: patch.reviewStatus,
        editedValue: patch.editedValue ?? null,
      }).catch(console.error);
    }
  };

  const total = candidates.length;
  const reviewed = candidates.filter((c) => c.reviewStatus !== 'PENDING_REVIEW').length;
  const allReviewed = total > 0 && reviewed === total;

  const counts = useMemo(() => {
    const base: Record<SettingReviewFilter, number> = {
      ALL: candidates.length, PENDING_REVIEW: 0, CONFIRMED: 0, EDITED: 0, DISMISSED: 0,
    };
    candidates.forEach((c) => { base[c.reviewStatus] += 1; });
    return base;
  }, [candidates]);

  const typeCounts = useMemo(() => {
    const base: Record<SettingCandidateType, number> = {
      CHARACTER_BASIC: 0, NUMERIC_STATE: 0, POSSESSION: 0, TIME_STATUS: 0, EXTENDED: 0,
    };
    candidates.forEach((c) => { base[c.settingType] += 1; });
    return base;
  }, [candidates]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return candidates.filter((c) => {
      if (filter !== 'ALL' && c.reviewStatus !== filter) return false;
      if (typeFilter !== 'ALL' && c.settingType !== typeFilter) return false;
      if (q) {
        const haystack = `${c.characterName ?? ''} ${c.settingKey} ${c.settingValue}`.toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [candidates, filter, typeFilter, search]);

  const selected = filtered.find((c) => c.id === selectedId) ?? filtered[0];

  const categoryTabs = [
    { id: 'ALL', label: '전체', count: candidates.length },
    ...Object.entries(SETTING_TYPE_LABELS).map(([type, label]) => ({
      id: type, label, count: typeCounts[type as SettingCandidateType],
    })),
  ];

  if (loading) {
    return (
      <div style={{
        width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: C.bg, color: C.t2, fontSize: 14,
        fontFamily: "'Pretendard Variable', 'Pretendard', 'Apple SD Gothic Neo', -apple-system, sans-serif",
      }}>
        설정 후보를 불러오는 중...
      </div>
    );
  }

  return (
    <div style={{
      width: '100%', height: '100%', display: 'flex', flexDirection: 'column',
      background: C.bg, fontFamily: "'Pretendard Variable', 'Pretendard', 'Apple SD Gothic Neo', -apple-system, sans-serif",
    }}>
      <Header onBack={() => navigate('/dashboard', 'pop')} total={total} reviewed={reviewed} />

      <div style={{ flex: 1, overflowY: 'auto' }}>
        <div style={{ maxWidth: 1040, margin: '0 auto', padding: '20px 20px 60px' }}>
          <InfoBar
            items={[
              { label: '설정집 파일', value: '설정집.txt' },
              ...Object.entries(SETTING_TYPE_LABELS).map(([type, label]) => ({
                label, value: `${typeCounts[type as SettingCandidateType]}개`,
              })),
            ]}
            badge={(
              <span style={{
                padding: '2px 8px', borderRadius: 10, color: C.warning, background: C.warning + '1A',
                border: `1px solid ${C.warning}33`, fontSize: 11, fontWeight: 700,
              }}>
                확인 필요 {counts.PENDING_REVIEW}개
              </span>
            )}
          />

          <SplitPane
            left={[
              <SearchInput key="search" value={search} onChange={setSearch} placeholder="캐릭터명 또는 설정 항목 검색" />,
              <ReviewFilterTabs key="filter" filter={filter} setFilter={setFilter} counts={counts} />,
              <CategoryTabs key="category" tabs={categoryTabs} active={typeFilter} onChange={(id) => setTypeFilter(id as SettingCandidateType | 'ALL')} />,
              ...(filtered.length === 0
                ? [<div key="empty" style={{ textAlign: 'center', padding: '40px 0', color: C.t3, fontSize: 13 }}>해당하는 설정 후보가 없습니다.</div>]
                : filtered.map((c) => (
                  <ListItemCard
                    key={c.id}
                    selected={c.id === selected?.id}
                    onClick={() => setSelectedId(c.id)}
                    title={c.characterName ? `${c.characterName} · ${c.settingKey}` : c.settingKey}
                    subtitle={c.editedValue ?? c.settingValue}
                    badge={REVIEW_STATUS_LABELS[c.reviewStatus]}
                    badgeColor={statusColor(c.reviewStatus)}
                  />
                ))),
            ]}
            right={selected
              ? <CandidateDetail key={selected.id} candidate={selected} onUpdate={handleUpdate} />
              : <div style={{ color: C.t3, fontSize: 13, textAlign: 'center', padding: '40px 0' }}>설정 후보를 선택하세요</div>}
          />

          <div style={{ marginTop: 20, display: 'flex', gap: 8 }}>
            <BtnG label="← 이전" onClick={() => navigate('/dashboard', 'pop')} />
            <BtnG label="설정집 다시 분석" onClick={fetchCandidates} />
            <div style={{ flex: 1 }}>
              {allReviewed
                ? <BtnP label="회차 검사 시작 →" onClick={() => navigate('/dashboard', 'pop')} />
                : <BtnG label="회차 검사 시작 (모든 항목 검토 필요)" />}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
