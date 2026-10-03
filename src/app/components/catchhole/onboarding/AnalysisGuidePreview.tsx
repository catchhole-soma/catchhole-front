import { CheckCircle2, Sparkles } from 'lucide-react';
import { SettingReviewSummary } from '../SettingReviewSummary';
import { CandidateDetail, CandidateGroupCard, ActionButton, QueryState } from '../characterreview/CharacterSettingReview';
import { SimpleSettingList } from '../character/CharacterDatabase';
import { C } from '../constants';
import { AnalysisReviewModeSelector } from './AnalysisReviewModeSelector';
import { guideCandidates, guideCharacters } from './analysisGuideFixture';

const noop = () => {};
const descriptions = [
  '반영 방식 선택 화면. AI 판단으로 설정 자동 반영이 기본이며, 모든 설정 직접 검토를 선택할 수도 있습니다.',
  '직접 검토 예시. 반영됨 0개, 직접 확인 3개. 레온의 종족 엘프는 새 설정이며, 직업은 왕국 정찰병에서 북부 원정대 정찰병으로 바뀝니다. 사진과 함께 새 설정은 한 칸, 바뀌는 설정은 빨강·초록 비교로 표시됩니다. 레온의 2개를 함께 확정한 뒤, 인물 미상의 치유 능력 1개도 확인해야 합니다.',
  '자동 반영 예시. 명확한 2개가 작품에 저장됐습니다. 실제 캐릭터 설정 화면의 프로필에 종족 엘프, 직업 북부 원정대 정찰병이 표시됩니다. 별도 확정 버튼을 누르지 않습니다. 대상이 모호한 치유 능력 1개는 아직 저장되지 않았습니다.',
  '자동 반영 후 직접 검토 예시. 반영됨 2개, 직접 확인 1개. 그는 손끝으로 상처를 아물게 했다는 원문의 치유 능력을 레온, 유나, 새로운 인물 중 누구에게 연결할지 카드로 선택하는 화면입니다. 예시에서는 선택하거나 저장하지 않습니다. 이미 저장된 종족과 직업은 다시 검토하지 않습니다.',
  '검토 완료 예시. 사람이 남은 설정을 확인하고 확정한 뒤 반영됨 3개, 직접 확인 0개가 됐습니다. 모든 설정 후보 검토를 완료했습니다. 원고 목록으로 돌아갈 수 있습니다.',
];

function ReviewExample({ manual }: { manual: boolean }) {
  const visible = manual ? guideCandidates.slice(0, 2) : guideCandidates.slice(2);
  const name = manual ? '레온' : '인물 미상';
  return <div className="analysis-guide-preview__review">
    <aside>
      <div className="analysis-guide-preview__queue-label">미처리 설정</div>
      {manual && <CandidateGroupCard group={{ entityName: '레온', candidateCount: 2,
        candidates: guideCandidates.slice(0, 2), evidenceEpisodeNos: [2] }} selected onClick={noop} />}
      <CandidateGroupCard group={{ entityName: '인물 미상', candidateCount: 1,
        candidates: guideCandidates.slice(2), evidenceEpisodeNos: [2] }} selected={!manual} onClick={noop} />
    </aside>
    <section className="setting-review-detail"><div><article>
      <header>
        <div className="analysis-guide-preview__queue-label">같은 캐릭터 후보</div>
        <h2>{name} <span>{visible.length}개 설정</span></h2>
        <p>{manual ? '새 설정은 그대로 확인하고, 바뀌는 설정은 반영 전후를 비교해요.' : '누구의 설정인지 확인해 이 인물의 설정을 함께 확정해요.'}</p>
      </header>
      {visible.map(candidate => <CandidateDetail key={candidate.id} candidate={candidate}
        previewCharacters={guideCharacters}
        applicationMode="APPLY_PROPOSAL" actionError={null} actionPending={false}
        dismissing={false} retrying={false} retryError={null} manuallyReviewed={false}
        onDismiss={noop} onEdit={noop} onMatch={noop} onResolveTarget={noop}
        onApplicationModeChange={noop} onRetryComparison={noop} />)}
      <footer>
        <div><strong>{name}의 {visible.length}개 설정을 함께 확정합니다.</strong>
          <p>{manual ? '레온을 확정한 뒤에는 인물 미상의 설정 1개를 확인해요.' : '누구에 관한 내용인지 선택하면 확정할 수 있어요.'}</p></div>
        <ActionButton disabled={!manual} tone={C.success}>{visible.length}개 설정 모두 확정</ActionButton>
      </footer>
    </article></div></section>
  </div>;
}

export function AnalysisGuidePreview({ step }: { step: number }) {
  return <div className="analysis-guide-preview" role="img" aria-label={descriptions[step]}>
    {/* 네이티브 inert로 마우스·키보드·폼 동작을 막고 위 설명을 접근성 대안으로 제공한다. */}
    <div {...{ inert: '' }} className="analysis-guide-preview__content setting-review-screen theme-v2">
      {step === 0 ? <AnalysisReviewModeSelector value="AUTOMATIC" onChange={noop} /> : <>
        <SettingReviewSummary episodeRange="2화 · 1개 회차" progress={{ total: 3, confirmed: step === 1 ? 0 : step === 4 ? 3 : 2, directReview: step === 1 ? 3 : step === 4 ? 0 : 1, dismissed: 0, processing: 0 }} />
        {(step === 1 || step === 3) && <ReviewExample manual={step === 1} />}
        {step === 2 && <div className="analysis-guide-preview__saved character-db">
          <div className="analysis-guide-preview__saved-status"><CheckCircle2 size={18} aria-hidden="true" /> 작품에 자동으로 저장됐어요</div>
          <h2>레온 <span>캐릭터 설정</span></h2>
          <h3>프로필</h3>
          <div className="character-setting-surface">
            <SimpleSettingList settings={[
              { key: 'species', displayName: '종족', value: '엘프', valueType: 'STRING', attributeNameEditable: false, displayNameEditable: false },
              { key: 'occupation', displayName: '직업', value: '북부 원정대 정찰병', valueType: 'STRING', attributeNameEditable: false, displayNameEditable: false },
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
