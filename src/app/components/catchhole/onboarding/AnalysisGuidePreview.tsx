import { CheckCircle2, Sparkles } from 'lucide-react';
import type { SettingCandidateResponse } from '../../../api/generated/types.gen';
import { SettingReviewSummary } from '../SettingReviewSummary';
import { CandidateDetail, CandidateGroupCard, ActionButton, QueryState } from '../characterreview/CharacterSettingReview';
import { SimpleSettingList } from '../character/CharacterDatabase';
import { C } from '../constants';
import { AnalysisReviewModeSelector } from './AnalysisReviewModeSelector';

const noop = () => {};
// 화면 설명 전용 데이터. 실제 계정·작품·Query 캐시와 연결하지 않는다.
const candidates: SettingCandidateResponse[] = [
  { id: 'guide-species', attributeName: 'profile.species', attributeValue: '엘프', evidenceSpans: [{ quote: '레온은 엘프였다.' }] },
  { id: 'guide-occupation', attributeName: 'profile.occupation', attributeValue: '정찰병', evidenceSpans: [{ quote: '레온은 왕국의 정찰병으로 일했다.' }] },
  { id: 'guide-healing', attributeName: 'skills.치유', attributeValue: '상처를 치유한다.', evidenceSpans: [{ quote: '레온과 유나가 동굴에 들어섰다. 그는 손끝으로 상처를 아물게 했다.' }],
    rawEntityMention: '그', matchStatus: 'AMBIGUOUS', comparisonStatus: 'FAILED',
    automaticReviewHoldReason: 'SUBJECT_RESOLUTION_FAILED', manualReviewAvailable: true },
].map(fact => ({
  episodeNo: 1, entityType: 'CHARACTER', entityName: '레온', rawEntityMention: '레온',
  matchStatus: 'MATCHED', matchedCharacterId: 'guide-leon', candidateKind: 'SETTING',
  valueType: 'STRING', confidence: 0.9, reviewStatus: 'PENDING_REVIEW',
  comparisonStatus: 'COMPLETED', suggestedOperation: 'ADD', comparisonRevision: 'guide',
  comparisonReason: '원문에서 확인한 새로운 설정입니다.', ...fact,
} as SettingCandidateResponse));

const descriptions = [
  '반영 방식 선택 화면. AI 판단으로 설정 자동 반영이 기본이며, 모든 설정 직접 검토를 선택할 수도 있습니다.',
  '직접 검토 예시. 반영됨 0개, 직접 확인 3개. 레온의 종족 엘프, 직업 정찰병, 치유 능력을 각각 원문과 비교하고 확정합니다. 치유 능력은 레온과 유나 중 누구의 설정인지 확인해야 합니다.',
  '자동 반영 예시. 명확한 2개가 작품에 저장됐습니다. 실제 캐릭터 설정 화면의 프로필에 종족 엘프, 직업 정찰병이 표시됩니다. 별도 확정 버튼을 누르지 않습니다. 대상이 모호한 치유 능력 1개는 아직 저장되지 않았습니다.',
  '자동 반영 후 직접 검토 예시. 반영됨 2개, 직접 확인 1개. 그는 손끝으로 상처를 아물게 했다는 원문의 치유 능력을 누구에게 연결할지 확인해야 합니다. 이미 저장된 종족과 직업은 다시 검토하지 않습니다.',
  '검토 완료 예시. 사람이 남은 설정을 확인하고 확정한 뒤 반영됨 3개, 직접 확인 0개가 됐습니다. 모든 설정 후보 검토를 완료했습니다. 원고 목록으로 돌아갈 수 있습니다.',
];

function ReviewExample({ manual }: { manual: boolean }) {
  const visible = manual ? candidates : candidates.slice(2);
  return <div className="analysis-guide-preview__review">
    <aside><CandidateGroupCard group={{ entityName: '레온', candidateCount: visible.length, candidates: visible, evidenceEpisodeNos: [1] }} selected onClick={noop} /></aside>
    <section className="setting-review-detail"><div><article>
      <header>
        <h2>레온 <span>{visible.length}개 설정</span></h2>
        <p>{manual ? '모든 설정의 원문과 AI 판단을 확인한 뒤 확정합니다.' : '자동으로 반영되지 않은 설정만 확인합니다.'}</p>
      </header>
      {visible.map(candidate => <CandidateDetail key={candidate.id} candidate={candidate}
        applicationMode="APPLY_PROPOSAL" actionError={null} actionPending={false}
        dismissing={false} retrying={false} retryError={null} manuallyReviewed={false}
        onDismiss={noop} onEdit={noop} onMatch={noop} onApplicationModeChange={noop} onRetryComparison={noop} />)}
      <footer>
        <div><strong>레온의 {visible.length}개 설정을 함께 확정합니다.</strong><p>캐릭터 연결이 모호한 설정을 먼저 확인해 주세요.</p></div>
        <ActionButton disabled tone={C.success}>{visible.length}개 설정 모두 확정</ActionButton>
      </footer>
    </article></div></section>
  </div>;
}

export function AnalysisGuidePreview({ step }: { step: number }) {
  return <div className="analysis-guide-preview" role="img" aria-label={descriptions[step]}>
    {/* 네이티브 inert로 마우스·키보드·폼 동작을 막고 위 설명을 접근성 대안으로 제공한다. */}
    <div {...{ inert: '' }} className="analysis-guide-preview__content setting-review-screen theme-v2">
      {step === 0 ? <AnalysisReviewModeSelector value="AUTOMATIC" onChange={noop} /> : <>
        <SettingReviewSummary episodeRange="1화 · 1개 회차" progress={{ total: 3, confirmed: step === 1 ? 0 : step === 4 ? 3 : 2, directReview: step === 1 ? 3 : step === 4 ? 0 : 1, dismissed: 0, processing: 0 }} />
        {(step === 1 || step === 3) && <ReviewExample manual={step === 1} />}
        {step === 2 && <div className="analysis-guide-preview__saved character-db">
          <div className="analysis-guide-preview__saved-status"><CheckCircle2 size={18} aria-hidden="true" /> 작품에 자동으로 저장됐어요</div>
          <h2>레온 <span>캐릭터 설정</span></h2>
          <h3>프로필</h3>
          <div className="character-setting-surface">
            <SimpleSettingList settings={[
              { key: 'species', displayName: '종족', value: '엘프', valueType: 'STRING', attributeNameEditable: false, displayNameEditable: false },
              { key: 'occupation', displayName: '직업', value: '정찰병', valueType: 'STRING', attributeNameEditable: false, displayNameEditable: false },
            ]} emptyLabel="프로필" onEvidence={noop} />
          </div>
        </div>}
        {step === 4 && <QueryState icon={<Sparkles size={26} color={C.primary} />}
          title="모든 설정 후보 검토를 완료했습니다."
          description="확정하거나 무시한 후보는 검토 상태 필터에서 다시 확인할 수 있습니다."
          action={<ActionButton tone={C.success}>원고 목록으로</ActionButton>} />}
      </>}
    </div>
  </div>;
}
