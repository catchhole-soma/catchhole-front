import React, { useMemo, useState } from 'react';
import { useLocation } from 'react-router';
import { ChevronLeft, OctagonAlert, Clock, CircleCheckBig } from 'lucide-react';
import { C } from './constants';
import { useAppNavigate } from '../../hooks/useAppNavigate';
import { BtnP, BtnG } from './S1Dashboard';
import { ErrorCard, ErrorCardData } from './S5Report';
import { InfoBar, SplitPane, SearchInput, CategoryTabs, ListItemCard } from './ReviewLayout';
import { UserMenu } from './UserMenu';

const MOCK_VALIDATION_ISSUES: ErrorCardData[] = [
  {
    id: 1,
    episodeId: 'episode-159',
    severity: 'danger',
    tag: '사실 기반 오류',
    badge: '높음',
    icon: <OctagonAlert size={11} />,
    title: '수아의 눈 색 불일치',
    changeArrow: { from: '갈색 눈동자', to: '파란 눈' },
    sourceQuote: {
      label: '기존 설정',
      chapter: '23화 3문단',
      text: '수아가 천천히 고개를 들었다. 그 순간, 그녀의 갈색 눈동자가 형광등 불빛에 반짝였다. "당신이 강민준 검사님이십니까?" 그녀의 목소리는 미세하게 떨렸다.',
      highlight: '갈색 눈동자',
      highlightColor: C.success,
    },
    currentQuote: {
      label: '현재 원고',
      chapter: '159화 9행',
      text: '수아는 천천히 고개를 들었다. 햇살이 창문을 통해 쏟아지며 그녀의 파란 눈을 가득 채웠다. 검찰청 복도는 언제나처럼 차갑고 조용했다.',
      highlight: '파란 눈',
      highlightColor: C.danger,
    },
    occurrences: [
      { chapter: '1화', snippet: '"수아의 갈색 눈이 반짝였다."', status: 'match' },
      { chapter: '23화', snippet: '"갈색 눈동자가 형광등 불빛에 반짝였다."', status: 'match' },
      { chapter: '159화', snippet: '"그녀의 파란 눈을 가득 채웠다."', status: 'conflict' },
    ],
    aiSuggestion: '"그녀의 파란 눈" → "그녀의 갈색 눈동자" 로 수정하거나, 콘텍스트상 눈 색이 바뀐 설정이라면 23화 설정 DB를 업데이트하세요.',
  },
  {
    id: 2,
    episodeId: 'episode-159',
    severity: 'warning',
    tag: '타임라인 오류',
    badge: '중간',
    icon: <Clock size={11} />,
    title: '장면 시간대 불일치',
    changeArrow: { from: '사건 5일 후 첫 만남', to: '3일 전 만남으로 서술' },
    sourceQuote: {
      label: '기존 설정',
      chapter: '47화 2문단',
      text: '그것이 처음 만남이었다. 사건이 터지고 닷새가 지난 오후, 그들은 법원 복도에서 처음으로 얼굴을 마주쳤다. 운명이라고 부르기엔 너무도 냉혹한 상황이었다.',
      highlight: '닷새가 지난',
      highlightColor: C.success,
    },
    currentQuote: {
      label: '현재 원고',
      chapter: '159화 13행',
      text: '강민준은 저편에서 그녀를 주시하고 있었다. 3일 전 우연히 마주쳤을 때처럼, 그는 아무 말도 하지 않았다. 마치 처음부터 아무 일도 없었던 것처럼.',
      highlight: '3일 전 우연히 마주쳤을 때',
      highlightColor: C.warning,
    },
    occurrences: [
      { chapter: '47화', snippet: '"닷새가 지난 오후, 법원 복도에서 첫 만남."', status: 'match' },
      { chapter: '52화', snippet: '"처음 만난 그날 이후로..."', status: 'match' },
      { chapter: '159화', snippet: '"3일 전 우연히 마주쳤을 때처럼"', status: 'conflict' },
    ],
    aiSuggestion: '"3일 전 우연히 마주쳤을 때처럼" → "닷새 전 처음 마주쳤을 때처럼" 으로 수정하거나, 별도의 만남이라면 47화 이후 흐름을 재검토하세요.',
  },
];

type IssueFilter = 'ALL' | 'danger' | 'warning' | 'ignored';

function Header({ onBack, dangerCount, warningCount }: { onBack: () => void; dangerCount: number; warningCount: number }) {
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
      <div style={{ color: C.t1, fontSize: 15, fontWeight: 700, letterSpacing: '-0.2px' }}>회차 검사 결과</div>

      <div style={{ flex: 1 }} />

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
        <span style={{
          padding: '2px 8px', borderRadius: 10, color: C.danger, background: C.danger + '1A',
          border: `1px solid ${C.danger}33`, fontWeight: 700,
        }}>충돌 {dangerCount}건</span>
        <span style={{
          padding: '2px 8px', borderRadius: 10, color: C.warning, background: C.warning + '1A',
          border: `1px solid ${C.warning}33`, fontWeight: 700,
        }}>모순 {warningCount}건</span>
      </div>
      <UserMenu />
    </div>
  );
}

export default function SEpisodeValidationReport() {
  const navigate = useAppNavigate();
  const location = useLocation();
  const episodeIds = (location.state as { episodeIds?: string[] } | null)?.episodeIds;

  const issues = useMemo(
    () => (episodeIds && episodeIds.length > 0
      ? MOCK_VALIDATION_ISSUES.filter((i) => i.episodeId && episodeIds.includes(i.episodeId))
      : MOCK_VALIDATION_ISSUES),
    [episodeIds],
  );

  const [ignoredIds, setIgnoredIds] = useState<Set<number>>(new Set());
  const [filter, setFilter] = useState<IssueFilter>('ALL');
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<number | null>(null);

  const toggleIgnore = (id: number) => {
    setIgnoredIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const activeIssues = issues.filter((i) => !ignoredIds.has(i.id));
  const dangerCount = activeIssues.filter((i) => i.severity === 'danger').length;
  const warningCount = activeIssues.filter((i) => i.severity === 'warning').length;
  const goToDashboard = () => navigate('/dashboard', 'pop');

  const categoryTabs = [
    { id: 'ALL', label: '전체', count: issues.length },
    { id: 'danger', label: '설정 충돌', count: issues.filter((i) => i.severity === 'danger' && !ignoredIds.has(i.id)).length },
    { id: 'warning', label: '모순', count: issues.filter((i) => i.severity === 'warning' && !ignoredIds.has(i.id)).length },
    { id: 'ignored', label: '승인됨', count: ignoredIds.size },
  ];

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return issues.filter((issue) => {
      const ignored = ignoredIds.has(issue.id);
      if (filter === 'danger' && (issue.severity !== 'danger' || ignored)) return false;
      if (filter === 'warning' && (issue.severity !== 'warning' || ignored)) return false;
      if (filter === 'ignored' && !ignored) return false;
      if (q && !`${issue.title} ${issue.tag}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [issues, filter, ignoredIds, search]);

  const selected = filtered.find((i) => i.id === selectedId) ?? filtered[0];

  return (
    <div style={{
      width: '100%', height: '100%', display: 'flex', flexDirection: 'column',
      background: C.bg, fontFamily: "'Pretendard Variable', 'Pretendard', 'Apple SD Gothic Neo', -apple-system, sans-serif",
    }}>
      <Header onBack={goToDashboard} dangerCount={dangerCount} warningCount={warningCount} />

      <div style={{ flex: 1, overflowY: 'auto' }}>
        <div style={{ maxWidth: 1040, margin: '0 auto', padding: '20px 20px 60px' }}>
          <InfoBar
            items={[
              { label: '분석 상태', value: '분석 완료' },
              { label: '검사 회차', value: episodeIds && episodeIds.length > 0 ? `${episodeIds.length}회차` : '전체' },
              { label: '오류 후보', value: `${issues.length}건` },
              { label: '확인 필요', value: `${activeIssues.length}건` },
              { label: '설정집 기준', value: '적용됨' },
            ]}
            badge={(
              <span style={{
                padding: '2px 8px', borderRadius: 10, color: C.success, background: C.success + '1A',
                border: `1px solid ${C.success}33`, fontSize: 11, fontWeight: 700,
              }}>
                {activeIssues.length === 0 ? '충돌/모순 없음' : `검토 필요 ${activeIssues.length}건`}
              </span>
            )}
          />

          {issues.length === 0 ? (
            <div style={{
              textAlign: 'center', padding: '60px 0', color: C.success,
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10,
            }}>
              <CircleCheckBig size={28} />
              <div style={{ fontSize: 14, fontWeight: 600 }}>충돌/모순이 발견되지 않았습니다</div>
              <div style={{ color: C.t3, fontSize: 12 }}>설정 DB와 비교한 결과 새 회차에 문제가 없습니다.</div>
            </div>
          ) : (
            <SplitPane
              left={[
                <SearchInput key="search" value={search} onChange={setSearch} placeholder="이슈 제목 또는 태그 검색" />,
                <CategoryTabs key="category" tabs={categoryTabs} active={filter} onChange={(id) => setFilter(id as IssueFilter)} />,
                ...(filtered.length === 0
                  ? [<div key="empty" style={{ textAlign: 'center', padding: '40px 0', color: C.t3, fontSize: 13 }}>해당하는 이슈가 없습니다.</div>]
                  : filtered.map((issue) => {
                    const ignored = ignoredIds.has(issue.id);
                    const color = ignored ? C.t3 : issue.severity === 'danger' ? C.danger : C.warning;
                    return (
                      <ListItemCard
                        key={issue.id}
                        selected={issue.id === selected?.id}
                        onClick={() => setSelectedId(issue.id)}
                        title={issue.title}
                        subtitle={issue.tag}
                        badge={ignored ? '승인됨' : issue.badge}
                        badgeColor={color}
                      />
                    );
                  })),
              ]}
              right={selected ? (
                <ErrorCard
                  key={selected.id}
                  data={selected}
                  ignored={ignoredIds.has(selected.id)}
                  onIgnore={() => toggleIgnore(selected.id)}
                  onFix={goToDashboard}
                />
              ) : (
                <div style={{ color: C.t3, fontSize: 13, textAlign: 'center', padding: '40px 0' }}>이슈를 선택하세요</div>
              )}
            />
          )}

          <div style={{ display: 'flex', gap: 8, marginTop: 20 }}>
            <BtnG label="← 이전" onClick={goToDashboard} />
            <BtnG label="검사 다시 실행" onClick={() => setIgnoredIds(new Set())} />
            <div style={{ flex: 1 }} />
            <BtnP label="다음 — AI 분석 리포트 보기 →" onClick={goToDashboard} />
          </div>
        </div>
      </div>
    </div>
  );
}
