import { ArrowLeft, UserRound } from 'lucide-react';
import { generationLabel, isDistantAncestry, SUBTYPE_LABELS, type RelationshipKind, type RelationshipSubtype, type RelationshipTime } from './relationship-presentation';
import './relationship-pair-preview.css';

type Props = {
  subjectName: string;
  objectName: string;
  kind: RelationshipKind;
  subtype?: RelationshipSubtype;
  generationGap?: number | null;
  temporalScope?: RelationshipTime;
  objectHasProfile: boolean;
  objectSelectionChanged?: boolean;
  changesPending?: boolean;
  uncertain: boolean;
  disabled: boolean;
  pickerOpen: boolean;
  pickerId: string;
  onPickObject: () => void;
};

export function RelationshipPairPreview({
  subjectName, objectName, kind, subtype, generationGap, temporalScope, objectHasProfile,
  objectSelectionChanged = false, changesPending = false, uncertain, disabled, pickerOpen, pickerId, onPickObject,
}: Props) {
  const distant = isDistantAncestry(kind);
  const ancestry = distant || kind === 'PARENT_OF' || kind === 'CHILD_OF';
  const reversed = kind === 'CHILD_OF' || kind === 'DESCENDANT_OF';
  const subjectRole = distant ? reversed ? 'descendant' : 'ancestor' : ancestry ? reversed ? 'child' : 'parent' : 'peer';
  const objectRole = distant ? reversed ? 'ancestor' : 'descendant' : ancestry ? reversed ? 'parent' : 'child' : 'peer';
  const relationshipLabel = distant ? '조상·후손' : kind === 'SPOUSE' ? '배우자' : kind === 'SIBLING' ? '형제·자매' : '부모·자녀';
  const qualifiers = [
    !uncertain && subtype && subtype !== 'UNSPECIFIED' ? SUBTYPE_LABELS[subtype] : null,
    temporalScope === 'HISTORICAL' ? '과거 관계' : temporalScope === 'UNKNOWN' ? '시점 확인 필요' : null,
  ].filter(Boolean).join(' · ');
  const parentName = reversed ? objectName : subjectName;
  const childName = reversed ? subjectName : objectName;
  const description = uncertain ? `검토할 관계: ${subjectName}와 ${objectName}, ${relationshipLabel}. 실제 가족 관계인지 확인이 필요해요.`
    : distant ? `가족 관계: ${parentName}의 ${generationGap == null ? '후손' : generationLabel(generationGap)} ${childName}. 중간 계보 생략.`
      : ancestry ? `가족 관계: ${parentName}의 자녀 ${childName}.` : `가족 관계: ${subjectName}와 ${objectName}, ${relationshipLabel} 관계.`;
  const objectStatus = !objectHasProfile ? '프로필 미등록' : objectSelectionChanged ? '연결할 프로필 · 저장 전' : '프로필 등록됨';

  function personContent(person: 'subject' | 'object') {
    const role = person === 'subject' ? subjectRole : objectRole;
    return <>
      {role !== 'peer' && <span className="relationship-pair-preview__role">{role === 'ancestor' ? '조상' : role === 'descendant' ? '후손' : role === 'parent' ? '부모' : '자녀'}</span>}
      <span className="relationship-pair-preview__avatar" aria-hidden="true"><UserRound size={24} /></span>
      <strong className="relationship-pair-preview__name">{person === 'subject' ? subjectName : objectName}</strong>
      <span className="relationship-pair-preview__status">{person === 'subject' ? '프로필 등록됨' : objectStatus}</span>
      {person === 'object' && !disabled && <span className="relationship-pair-preview__action">
        <ArrowLeft className="relationship-pair-preview__action-arrow" size={18} aria-hidden="true" />
        <span>{objectHasProfile ? '연결할 캐릭터를 바꾸려면 클릭' : '캐릭터를 연결하려면 클릭'}</span>
      </span>}
    </>;
  }

  const subject = <div className="relationship-pair-preview__person" data-person="subject" data-role={subjectRole}>
    {personContent('subject')}
  </div>;
  const object = <button type="button" className="relationship-pair-preview__person relationship-pair-preview__person--action"
    data-person="object" data-role={objectRole} data-profile={objectHasProfile ? 'registered' : 'missing'}
    aria-label={`${objectName} 프로필 선택`} aria-expanded={pickerOpen} aria-controls={pickerOpen ? pickerId : undefined}
    onClick={onPickObject} disabled={disabled}>
    {personContent('object')}
  </button>;

  return <figure className="relationship-pair-preview" data-kind={kind} data-uncertain={uncertain}
    data-distant-ancestry={distant}
    data-layout={ancestry ? 'ancestry' : 'peer'} aria-label={`${description} ${objectName}: ${objectStatus}${qualifiers ? `. ${qualifiers}` : ''}`}>
    {(uncertain || changesPending) && <figcaption className="relationship-pair-preview__caption">
      {uncertain ? `검토할 관계${changesPending ? ' · 저장 전' : ''}` : '저장 전'}
    </figcaption>}
    <div className="relationship-pair-preview__diagram">
      {ancestry && reversed ? object : subject}
      <div className="relationship-pair-preview__connector" aria-hidden="true">
        {(distant || !ancestry || uncertain) && <span>
          <span>{distant ? generationLabel(generationGap) : relationshipLabel}</span>
          {distant && <small>중간 계보 생략</small>}
          {uncertain && <small>확인 필요</small>}
        </span>}
      </div>
      {ancestry && reversed ? subject : object}
    </div>
    {qualifiers && <p className="relationship-pair-preview__qualifiers">{qualifiers}</p>}
  </figure>;
}
