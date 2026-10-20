import { useRef, useState } from 'react';
import { Link2, UserRound } from 'lucide-react';
import type { RelationshipCandidateResponse } from '../../../api/generated/types.gen';
import { ReviewNotice, ReviewSettingHeading } from '../review-ui/ReviewPrimitives';
import { ActionButton } from '../ui-v2/ActionButton';
import { RelationshipCandidateEditor } from './RelationshipCandidateEditor';
import { FamilyMentionGrouping } from './FamilyMentionGrouping';
import { RelationshipCurrentSetting, RelationshipEvidenceDisclosure } from './RelationshipEvidence';
import { COUNTERPART_ROLES, generationLabel, isDistantAncestry, SUBTYPE_LABELS, TIME_LABELS } from './relationship-presentation';
import '../../../../styles/family-mention-detail.css';

function relationDescription(candidate: RelationshipCandidateResponse): string {
  const subject = candidate.subjectCharacterName || '상대 인물';
  if (candidate.assertion !== 'ASSERTED') return `${subject}의 가족 설정에 언급된 인물이에요.`;
  if (candidate.kind === 'DESCENDANT_OF' && candidate.generationGap != null) {
    return `${subject}: 이 인물의 ${generationLabel(candidate.generationGap)}으로 언급돼요.`;
  }
  if (candidate.kind === 'ANCESTOR_OF' && candidate.generationGap != null) {
    return `${subject}의 ${generationLabel(candidate.generationGap)}으로 언급된 인물이에요.`;
  }
  const role = candidate.kind === 'SIBLING' ? '형제·자매' : candidate.kind ? COUNTERPART_ROLES[candidate.kind] : null;
  return role ? `${subject}의 ${role}${isDistantAncestry(candidate.kind) ? '으로' : '로'} 언급된 인물이에요.` : `${subject}의 가족 설정에 언급된 인물이에요.`;
}

export function FamilyMentionDetail({ workId, candidate, onChanged, onOpenEvidence, onSelectCandidate }: {
  workId: string; candidate: RelationshipCandidateResponse;
  onChanged: (decided: boolean) => void; onOpenEvidence: (factId: string) => void;
  onSelectCandidate: (candidateId: string) => void;
}) {
  const detail = useRef<HTMLDivElement>(null);
  const [editing, setEditing] = useState<'link' | 'edit' | null>(null);
  const evidence = candidate.evidence ?? [];
  const displayable = candidate.status === 'PENDING' && candidate.displayableAsMention === true;
  const pending = candidate.status === 'PENDING';
  const originalSources = evidence.filter(source => source.hasEvidence && source.sourceFactId);
  const subject = candidate.subjectCharacterName || '인물';
  const object = candidate.objectCharacterName || candidate.objectMention || '언급된 인물';
  const stateLabel = candidate.status === 'CONFIRMED' ? '인물 연결됨'
    : candidate.status === 'DISMISSED' ? '제외된 후보'
      : !candidate.objectCharacterId ? '프로필 미등록' : '연결할 프로필 선택됨';

  if (editing) return <RelationshipCandidateEditor workId={workId} candidate={candidate} initialIntent={editing} closeLabel="근거로 돌아가기"
    onClose={() => {
      const action = editing;
      setEditing(null);
      requestAnimationFrame(() => {
        const trigger = detail.current?.querySelector<HTMLButtonElement>(`[data-mention-action="${action}"]`);
        trigger?.scrollIntoView({ block: 'nearest', behavior: 'instant' });
        trigger?.focus({ preventScroll: true });
      });
    }} onChanged={onChanged} onOpenEvidence={onOpenEvidence} />;

  return <div className="relationship-detail family-mention-detail" ref={detail}>
    <ReviewSettingHeading title={object} subtitle="가족 관계의 근거"
      image={<UserRound aria-hidden="true" />}
      badge={<span className="relationship-badge">{stateLabel}</span>}
      actions={pending && <ActionButton variant="ghost" size="compact" data-mention-action="edit" onClick={() => setEditing('edit')}>관계 내용 수정</ActionButton>} />
    <p className="family-mention-detail__relation">{relationDescription(candidate)}</p>
    <p className="family-mention-detail__metadata">
      {candidate.temporalScope && TIME_LABELS[candidate.temporalScope]}
      {candidate.timeLabel && <span>{candidate.timeLabel}</span>}
      {candidate.subtype && candidate.subtype !== 'UNSPECIFIED' && <span>{SUBTYPE_LABELS[candidate.subtype]}</span>}
      {isDistantAncestry(candidate.kind) && <><span>{generationLabel(candidate.generationGap)}</span><span>중간 계보 생략</span></>}
    </p>

    <FamilyMentionGrouping key={`${candidate.id}:${candidate.mentionGroupId ?? ''}`} workId={workId} candidate={candidate} onChanged={onChanged}
      onOpenEvidence={onOpenEvidence} onSelectCandidate={onSelectCandidate} />

    <div className="family-mention-detail__sources" aria-label="관계의 바탕이 된 설정">
      {evidence.length === 0 && <p className="relationship-muted">연결된 설정 근거가 없어요.</p>}
      {evidence.map(source => {
        const owner = source.characterId && source.characterId === candidate.subjectCharacterId ? subject
          : source.characterId && source.characterId === candidate.objectCharacterId ? object : null;
        return <section className="family-mention-detail__source" key={`${source.sourceFactId}-${source.sourceToken}-${source.candidateId}`}>
          <div className="family-mention-detail__source-heading">
            <span>{owner ? `${owner}의 가족 설정` : '바탕이 된 가족 설정'}</span>
            <span>{!source.current ? '이전 근거' : source.manuallyEdited ? '직접 수정한 설정' : '현재 설정'}</span>
          </div>
          {source.currentValue != null ? <RelationshipCurrentSetting value={source.currentValue} />
            : <p className="relationship-muted">{source.current ? '설정 내용을 확인할 수 없어요.'
              : source.hasEvidence && source.sourceFactId ? '현재 설정과 일치하지 않는 근거예요. 원문 근거에서 이전 내용을 확인할 수 있어요.'
                : '현재 설정과 일치하지 않는 근거예요.'}</p>}
        </section>;
      })}
    </div>

    <RelationshipEvidenceDisclosure workId={workId} evidence={evidence} onOpen={onOpenEvidence}
      summary={originalSources.length ? `원문 근거 ${originalSources.length}개 확인` : '원문 근거 확인'}
      characterNames={{
        ...(candidate.subjectCharacterId ? { [candidate.subjectCharacterId]: subject } : {}),
        ...(candidate.objectCharacterId ? { [candidate.objectCharacterId]: object } : {}),
      }} />

    {displayable ? <section className="family-mention-detail__connection" aria-label="선택적 프로필 연결">
      <div><strong>같은 인물의 프로필이 있나요?</strong>
        <p>프로필을 연결하지 않아도 이 설정을 바탕으로 가계도에 표시할 수 있어요.</p></div>
      <ActionButton variant="secondary" data-mention-action="link" icon={<Link2 size={16} aria-hidden="true" />} onClick={() => setEditing('link')}>프로필 연결</ActionButton>
    </section> : candidate.status === 'CONFIRMED'
      ? <ReviewNotice title="등록된 인물과 연결했어요.">가계도 표시는 현재 근거와 선택한 관계 시점에 따라 달라져요.</ReviewNotice>
      : candidate.status === 'DISMISSED'
        ? <ReviewNotice title="가족 관계 후보에서 제외했어요.">바탕이 된 가족 설정과 원문은 그대로 유지돼요.</ReviewNotice>
        : <ReviewNotice tone="warning" title="가계도에 표시하기 전에 확인이 필요해요.">관계 내용이나 현재 설정이 바뀌었을 수 있어요. 관계 내용 수정에서 확인할 수 있어요.</ReviewNotice>}
  </div>;
}
