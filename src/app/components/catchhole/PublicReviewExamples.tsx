import type { ReactNode } from 'react';
import { CandidateDetail } from './characterreview/CharacterSettingReview';
import type { CharacterFactApplicationMode } from './character/character-fact-comparison-policy';
import { INTERACTIVE_DEMO_CANDIDATES, INTERACTIVE_DEMO_REVIEW_CHARACTER } from './interactiveDemoFixture';
import { ReviewEvidence, ReviewInlineValue, ReviewNotice, ReviewSettingHeading } from './review-ui/ReviewPrimitives';
import { WorldSubjectImage } from './worldsetting/WorldSubjectImage';

const noop = () => undefined;

export function PublicCharacterReviewExample({ mode = 'APPLY_PROPOSAL', onModeChange = noop }: {
  mode?: CharacterFactApplicationMode;
  onModeChange?: (mode: CharacterFactApplicationMode) => void;
}) {
  return <CandidateDetail candidate={INTERACTIVE_DEMO_REVIEW_CHARACTER} applicationMode={mode}
    actionError={null} actionPending={false} dismissing={false} retrying={false} retryError={null}
    manuallyReviewed={false} decisionChosen onApplicationModeChange={onModeChange} />;
}

/** The walkthrough exposes only the final-value edit it can actually demonstrate in its local result DB. */
export function PublicWorldReviewExample({ kind = 'world', value, actions, children, saved = false }: {
  kind?: 'world' | 'unsupported'; value?: string; actions?: ReactNode; children?: ReactNode; saved?: boolean;
}) {
  const candidate = INTERACTIVE_DEMO_CANDIDATES[kind];
  return <section className="world-setting-diff-row review-cb-setting-card">
    <ReviewSettingHeading title={candidate.settingName} subtitle={`${kind === 'world' ? '장소' : '규칙·역사'} · ${candidate.subject}`}
      image={<WorldSubjectImage category={kind === 'world' ? 'LOCATION' : 'WORLD_RULE_HISTORY'} />}
      badge={<span className={`public-review-badge${saved ? ' is-saved' : ''}`}>{saved ? '검토 완료' : '내용 확인 필요'}</span>}
      episode="6화에서 찾은 설정" actions={actions} />
    <ReviewInlineValue label={saved ? '선택한 최종 내용' : '이번 원고에서 찾은 내용'} tone={saved ? 'new' : 'neutral'}>{value ?? candidate.proposedValue}</ReviewInlineValue>
    {saved ? <ReviewNotice tone="success" title="선택한 내용이 준비됐어요">아래의 모두 확정으로 작품 설정에 반영해 주세요.</ReviewNotice>
      : <ReviewNotice tone="warning" title="확인이 필요한 이유">{candidate.reasoning}</ReviewNotice>}
    {children}
    <ReviewEvidence summary="원문 근거 확인 · 6화"><blockquote>{candidate.evidence}</blockquote></ReviewEvidence>
  </section>;
}
