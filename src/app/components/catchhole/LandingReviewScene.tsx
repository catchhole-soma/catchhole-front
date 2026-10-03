import { useLayoutEffect, useRef, useState } from 'react';
import { Globe2, Users } from 'lucide-react';
import { PublicCharacterReviewExample } from './PublicReviewExamples';
import { WorldKeyDiffRow } from './worldsetting/WorldSettingReview';
import { INTERACTIVE_DEMO_CANDIDATES } from './interactiveDemoFixture';

const noop = () => undefined;

/** A fitted live component preview; it never receives a work ID or writes demo state. */
export function LandingReviewScene({ kind }: { kind: 'character' | 'world' }) {
  const host = useRef<HTMLDivElement>(null);
  const content = useRef<HTMLDivElement>(null);
  const [fit, setFit] = useState({ width: 900, scale: 0.5 });
  useLayoutEffect(() => {
    const container = host.current;
    const source = content.current;
    if (!container || !source) return;
    const resize = () => {
      const width = container.clientWidth < 420 ? 360 : 900;
      const scale = Math.min(container.clientWidth / width, container.clientHeight / Math.max(source.scrollHeight, 1), 1);
      setFit(previous => previous.width === width && Math.abs(previous.scale - scale) < 0.001 ? previous : { width, scale });
    };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(container);
    observer.observe(source);
    return () => observer.disconnect();
  }, []);
  const world = INTERACTIVE_DEMO_CANDIDATES.world;
  return <div className="landing-native-screen landing-review-scene" {...{ inert: '' }}>
    <header className="landing-review-scene__heading"><small>설정 후보 검토 · 6화{kind === 'world' ? ' · 명확한 새 설정 예시' : ' · 직업 변경 예시'}</small><strong>{kind === 'character' ? '캐릭터 후보 확정' : '세계관 후보 확정'}</strong></header>
    <div className="landing-native-review-tabs"><span className={kind === 'character' ? 'is-active' : ''}><Users />캐릭터 후보 <b>1개 직접 확인</b></span><span className={kind === 'world' ? 'is-active' : ''}><Globe2 />세계관 후보 <b>2개 직접 확인</b></span></div>
    <div ref={host} className="landing-review-scene__viewport"><div ref={content} className="landing-review-scene__source setting-review-screen review-clear-blue" style={{ width: fit.width, zoom: fit.scale }}>
      {kind === 'character' ? <PublicCharacterReviewExample /> : <WorldKeyDiffRow candidate={{
        id: 'public-world-new', automaticApplicationPending: false, category: 'LOCATION', subjectName: world.subject, settingName: world.settingName,
        extractedValue: world.proposedValue, proposedValue: world.proposedValue,
        suggestedOperation: 'ADD', comparisonStatus: 'COMPLETED', reviewStatus: 'PENDING_REVIEW',
        sourceEpisodeNo: 6, evidenceSpans: [{ quote: world.evidence }],
      }} decision={null} conflictResolved={false} recompared={false} includeRootMoveNotice={false}
        activeComparisonJobCount={0} canResumeTokenInterrupted={false} disabled onExclude={noop} onEdit={noop}
        onDecide={noop} linkedCandidateIds={[]} onAnalysis={noop} />}
      <footer className="landing-review-scene__confirm"><span>이 대상의 남은 설정을 함께 확정합니다.</span><button type="button">1개 설정 모두 확정</button></footer>
    </div></div>
  </div>;
}
